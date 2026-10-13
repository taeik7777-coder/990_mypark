/**
 * 마이파크 라운딩 요금제 – 상담 신청 폼 수신 (Google Apps Script)
 *
 * 1) 구글 시트 → 확장 프로그램 → Apps Script 에 이 코드를 붙여넣기
 * 2) 배포 → 새 배포 → 유형: 웹 앱 / 실행: 나 / 액세스: 모든 사용자
 * 3) 발급된 웹 앱 URL을 js/main.js 의 FORM_ENDPOINT 에 넣기
 */

// 받을 메일 주소. 비워두면 이 스크립트를 만든 구글 계정 메일로 발송됩니다.
// 여러 명이면 쉼표로 구분: 'a@example.com,b@example.com'
const TO_EMAIL = 'taeik7777@gmail.com';

// 신청 내역이 쌓일 시트 탭 이름
const SHEET_NAME = '상담신청';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const p = (e && e.parameter) || {};

    // 스팸 봇(숨김 필드가 채워진 경우)은 조용히 무시
    if (p._hp) return json({ ok: true });

    const row = {
      time: new Date(),
      name: clean(p.name),
      phone: clean(p.phone),
      marketing: clean(p.marketing) || '미동의',
      page: clean(p.page, 300),
    };

    if (!row.name || !row.phone) return json({ ok: false, error: 'required' });

    saveToSheet(row);
    sendMail(row);
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// 브라우저로 URL을 열었을 때 동작 확인용
function doGet() {
  return ContentService.createTextOutput('OK');
}

const HEADERS = ['접수 시간', '성함', '연락처', '유입 페이지', '마케팅 동의'];

function saveToSheet(r) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME, 0); // 맨 앞 탭으로 생성

  // 헤더(1행)를 항상 최신 항목으로 유지
  const head = sh.getRange(1, 1, 1, HEADERS.length);
  if (head.getValues()[0].join('|') !== HEADERS.join('|')) {
    head.setValues([HEADERS]).setFontWeight('bold');
    const extra = sh.getMaxColumns() - HEADERS.length;
    if (extra > 0) sh.getRange(1, HEADERS.length + 1, 1, extra).clearContent();
    sh.setFrozenRows(1);
  }

  // 연락처는 앞자리 0이 사라지지 않도록 텍스트로 저장
  sh.appendRow([r.time, safe(r.name), "'" + r.phone, r.page, r.marketing]);
}

function sendMail(r) {
  const to = TO_EMAIL || Session.getEffectiveUser().getEmail();
  const when = Utilities.formatDate(r.time, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();

  const rows = [
    ['접수 시간', when],
    ['성함', r.name],
    ['연락처', r.phone],
    ['유입 페이지', r.page || '-'],
    ['마케팅 동의', r.marketing],
  ];

  const th = 'padding:10px 14px;background:#f4f6f5;border:1px solid #e3e7e5;text-align:left;white-space:nowrap;font-weight:600;';
  const td = 'padding:10px 14px;border:1px solid #e3e7e5;';
  const htmlBody =
    '<div style="font-family:Apple SD Gothic Neo,Malgun Gothic,sans-serif;font-size:14px;color:#111;">' +
    '<h2 style="margin:0 0 16px;font-size:18px;">새 창업 상담 신청이 접수되었습니다</h2>' +
    '<table style="border-collapse:collapse;min-width:360px;">' +
    rows.map(([k, v]) => `<tr><th style="${th}">${k}</th><td style="${td}">${esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('') +
    '</table>' +
    `<p style="margin-top:18px;"><a href="${sheetUrl}">전체 신청 내역 보기 (구글 시트)</a></p>` +
    '</div>';

  const body = rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\n전체 신청 내역: ${sheetUrl}`;

  MailApp.sendEmail({
    to: to,
    subject: `[마이파크 라운딩 요금제] 창업 상담 신청 – ${r.name}`,
    body: body,
    htmlBody: htmlBody,
    name: '마이파크 상담 신청',
  });
}

/* ---------- helpers ---------- */
function clean(v, max) {
  return String(v || '').trim().slice(0, max || 200);
}

// 시트 수식 삽입 방지 (=, +, -, @ 로 시작하는 값)
function safe(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function esc(v) {
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
