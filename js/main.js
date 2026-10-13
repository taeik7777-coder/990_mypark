/* =========================================================
   MyPark 라운딩 요금제 – Interactions
   ========================================================= */
(() => {
  'use strict';

  // ---- 가격 설정 (단위: 만원) ----
  const PRICE = {
    oldPerSystem: 2300,   // 기존 시스템 기기당 가격
    newPerSystem: 990,    // 라운딩 요금제 시스템 기기당 가격
  };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);
  // 금액 카운트용: 끝부분에서 너무 오래 멈추지 않도록 조금 완만한 감속
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  // 카운트 중 표시 단위(10만원) – 1억 → 9,900만 구간이 끊기지 않고 자연스럽게 이어짐
  const stepRound = (v) => Math.round(v / 10) * 10;

  // ---- Analytics (GA4 + Clarity) 이벤트 기록 ----
  const track = (name, params = {}) => {
    try {
      if (typeof window.gtag === 'function') window.gtag('event', name, params);
      if (typeof window.clarity === 'function') window.clarity('event', name);
    } catch (_) { /* 분석 도구 오류가 사이트 동작에 영향 주지 않도록 */ }
  };

  // 상담 버튼 클릭 (어느 버튼인지 구분)
  const CTA_LABELS = {
    'nav-cta': '상단_창업상담',
    'hero-cta-contact': '히어로_무료상담',
    'hero-cta-sim': '히어로_절감액계산',
    'sim-cta': '계산기_상담받기',
  };
  Object.entries(CTA_LABELS).forEach(([id, label]) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => track('cta_click', { cta: label }));
  });

  // 전화·이메일 링크 클릭
  document.querySelectorAll('a[href^="tel:"]').forEach((a) =>
    a.addEventListener('click', () => track('phone_click')));
  document.querySelectorAll('a[href^="mailto:"]').forEach((a) =>
    a.addEventListener('click', () => track('email_click')));

  /** 만원 단위 숫자를 "1억 9,500만원" 형태로 변환 */
  const fmtKRW = (manwon, suffix = '원') => {
    manwon = Math.round(manwon);
    const eok = Math.floor(manwon / 10000);
    const rest = manwon % 10000;
    if (eok && rest) return `${eok}억 ${rest.toLocaleString('ko-KR')}만${suffix}`;
    if (eok) return `${eok}억${suffix}`;
    return `${rest.toLocaleString('ko-KR')}만${suffix}`;
  };

  const animate = (from, to, duration, onUpdate, onDone, ease = easeOut) => {
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      onUpdate(from + (to - from) * ease(t));
      if (t < 1) requestAnimationFrame(tick);
      else onDone && onDone();
    };
    requestAnimationFrame(tick);
  };

  // ---- Nav ----
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 20);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  $('#nav-toggle').addEventListener('click', () => nav.classList.toggle('is-open'));
  $$('.nav__links a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('is-open')));

  // ---- Reveal + one-shot triggers ----
  const triggers = new Map([
    ['hero-drop-card', heroCountdown],
    ['compare-chart', compareCut],
  ]);

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add('is-in');
      const fn = triggers.get(el.id);
      if (fn) fn(el);
      io.unobserve(el);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });

  $$('.reveal').forEach((el, i) => {
    // 같은 부모 내 순차 등장
    const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
    el.style.transitionDelay = `${siblings.indexOf(el) * 90}ms`;
    io.observe(el);
  });

  /** 숫자는 크게, 단위(억·만원)는 작게 표시하는 HTML 버전 */
  const fmtKRWHtml = (manwon) => {
    manwon = Math.round(manwon);
    const eok = Math.floor(manwon / 10000);
    const rest = manwon % 10000;
    const u = (t) => `<span class="unit">${t}</span>`;
    if (eok && rest) return `${eok}${u('억')} ${rest.toLocaleString('ko-KR')}${u('만원')}`;
    if (eok) return `${eok}${u('억원')}`;
    return `${rest.toLocaleString('ko-KR')}${u('만원')}`;
  };

  // ---- Hero: 2억 3,000만원 → 9,900만원 카운트다운 (시스템 10대 기준) ----
  function heroCountdown() {
    const el = $('#hero-counter');
    const card = $('#hero-drop-card');
    const meter = $('#hero-meter');
    const from = +el.dataset.from;
    const to = +el.dataset.to;
    setTimeout(() => {
      const pct = `${(to / from) * 100}%`;
      meter.style.width = pct;
      // 57% 절감 라벨을 막대 끝점 바로 아래에 맞춤
      meter.closest('.drop-card__meter').style.setProperty('--pct', pct);
      animate(from, to, 2200, (v) => {
        el.innerHTML = fmtKRWHtml(stepRound(v));
      }, () => {
        el.innerHTML = fmtKRWHtml(to);
        card.classList.add('is-done'); // 최종 가격 강조 연출
      }, easeOutCubic);
    }, 900);
  }

  // ---- Compare: 2억 3,000만 막대에서 1억 3,100만이 잘려나가는 연출 ----
  function compareCut(box) {
    const total = $('#compare-new-total');
    const label = $('#compare-new-label');
    const from = 23000, to = 9900;
    setTimeout(() => {
      box.classList.add('is-cut');
      label.textContent = '시스템 10대 · 대당 990만';
      animate(from, to, 1500, (v) => {
        total.textContent = fmtKRW(stepRound(v), ' 원');
      }, () => {
        total.textContent = fmtKRW(to, ' 원');
        box.classList.add('is-done');
      }, easeOutCubic);
    }, 1100);
  }

  // 990만원 · 13,100만원 숫자는 카운트 없이 CSS(.num-pop)로 간단히 등장

  // ---- Simulator ----
  const range = $('#sim-rooms');
  const visual = $('#sim-visual');
  const maxRooms = +range.max;
  for (let i = 0; i < maxRooms; i++) {
    const d = document.createElement('div');
    d.className = 'room';
    visual.appendChild(d);
  }
  const rooms = $$('.room', visual);
  const maxSave = maxRooms * (PRICE.oldPerSystem - PRICE.newPerSystem);

  const updateSim = () => {
    const n = +range.value;
    const oldCost = n * PRICE.oldPerSystem;
    const newCost = n * PRICE.newPerSystem;
    const save = oldCost - newCost;

    $('#sim-rooms-val').textContent = n;
    $('#sim-old').textContent = fmtKRW(oldCost);
    $('#sim-new').textContent = fmtKRW(newCost);
    $('#sim-save').textContent = fmtKRW(save);
    $('#sim-bar').style.width = `${(save / maxSave) * 100}%`;

    const pct = ((n - range.min) / (range.max - range.min)) * 100;
    range.style.setProperty('--p', `${pct}%`);
    rooms.forEach((r, i) => r.classList.toggle('on', i < n));
  };
  range.addEventListener('input', updateSim);
  // 계산기 사용 (슬라이더를 놓을 때 기록, 첫 사용은 별도 이벤트)
  let simUsed = false;
  range.addEventListener('change', () => {
    if (!simUsed) { simUsed = true; track('simulator_use'); }
    track('simulator_set', { rooms: +range.value });
  });
  updateSim();

  // ---- Contact form → Google Apps Script (메일 수신 + 구글 시트 저장) ----
  // 배포한 Apps Script 웹 앱 URL을 넣으세요. 비워두면 기존처럼 방문자의 메일 앱이 열립니다.
  const FORM_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwVTXPZkxVVUZyBIUDF1c69SPHgUpCuLz2JbrBipzpZix3Rg8zPcCSNg7OsHN2s2HquBQ/exec';

  const form = $('#contact-form');
  const msg = $('#form-msg');
  const submitBtn = $('#f-submit');
  const submitLabel = submitBtn.textContent;

  const setMsg = (text, isErr) => {
    msg.textContent = text;
    msg.className = isErr ? 'form__msg err' : 'form__msg';
  };

  // 연락처: 숫자만 입력되도록
  const phoneInput = $('#f-phone');
  phoneInput.addEventListener('input', () => {
    phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 11);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#f-name');
    const phone = phoneInput;
    const agree = $('#f-agree');
    const phoneOk = /^0\d{8,10}$/.test(phone.value);
    name.classList.toggle('error', !name.value.trim());
    phone.classList.toggle('error', !phoneOk);

    if (!name.value.trim()) {
      setMsg('성함을 입력해 주세요.', true);
      return;
    }
    if (!phoneOk) {
      setMsg('연락처를 숫자만 정확히 입력해 주세요.', true);
      return;
    }
    if (!agree.checked) {
      setMsg('개인정보 수집 및 이용에 동의해 주세요. (필수)', true);
      return;
    }

    const data = {
      name: name.value.trim(),
      phone: phone.value.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3'),
      marketing: $('#f-marketing').checked ? '동의' : '미동의',
      page: location.href,
      _hp: $('#f-hp').value,
    };

    // 엔드포인트 미설정 시: 메일 앱으로 대체
    if (!FORM_ENDPOINT) {
      const body = [
        `성함: ${data.name}`,
        `연락처: ${data.phone}`,
        `마케팅 수신: ${data.marketing}`,
      ].join('\n');
      const subject = `[마이파크 라운딩 요금제] 창업 상담 신청 – ${data.name}`;
      window.location.href = `mailto:taeik7777@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setMsg('메일 앱이 열립니다. 전송 버튼을 눌러 상담 신청을 완료해 주세요.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '전송 중…';
    setMsg('');

    try {
      const res = await fetch(FORM_ENDPOINT, { method: 'POST', body: new URLSearchParams(data) });
      const out = await res.json().catch(() => ({ ok: res.ok }));
      if (!out.ok) throw new Error(out.error || 'send failed');
      form.reset();
      setMsg('상담 신청이 접수되었습니다. 담당자가 빠르게 연락드리겠습니다.');
      track('generate_lead', { marketing_agree: data.marketing });
    } catch (err) {
      console.error(err);
      setMsg('전송에 실패했습니다. 잠시 후 다시 시도하시거나 010-5647-7357로 연락 주세요.', true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = submitLabel;
    }
  });
})();
