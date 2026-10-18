/**
 * Nahoa Life — community sign-ups from nahoalife.com/music → this Google Sheet.
 * Setup: open the Sheet › Extensions › Apps Script › paste this › Deploy › New deployment ›
 * type "Web app", Execute as "Me", Who has access "Anyone" › Deploy › copy the Web app URL.
 */
const TAB = 'Signups';
const HEADERS = ['Timestamp', 'First name', 'Phone', 'Email', 'City', 'Instagram', 'Consent', 'Consent text', 'Page'];

function doPost(e) {
  const p = (e && e.parameter) || {};
  if (p.website) return reply_();                       // spam bot filled the hidden field
  if (!p.city || (!p.phone && !p.email)) return reply_();
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(TAB) || ss.insertSheet(TAB);
    if (sh.getLastRow() === 0) { sh.appendRow(HEADERS); sh.setFrozenRows(1); }
    const c = (v) => String(v || '').slice(0, 300).replace(/^[=+\-@]/, "'$&"); // stored as text, never a formula
    sh.appendRow([new Date(), c(p.first_name), c(p.phone), c(p.email), c(p.city), c(p.instagram),
                  p.consent === 'yes' ? 'yes' : 'no', c(p.consent_text), c(p.page)]);
  } finally { lock.releaseLock(); }
  return reply_();
}

function doGet() { return reply_(); }
function reply_() { return ContentService.createTextOutput('{"ok":true}').setMimeType(ContentService.MimeType.JSON); }
