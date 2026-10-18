/**
 * Nahoa Life — website forms → this Google Sheet.
 *  - /music "join my community" → tab "Signups"
 *  - /content UGC inquiries      → tab "UGC Inquiries" + email alert to nahoacontent@gmail.com
 *  - /feature Get Featured       → tab "Feature Requests" + email alert to nahoalifemusic@gmail.com
 * After pasting: Deploy › Manage deployments › ✏️ › Version: New version › Deploy (keeps the same URL).
 */
const ALERT_EMAIL = 'nahoacontent@gmail.com';
const FEATURE_EMAIL = 'nahoalifemusic@gmail.com';
const TABS = {
  signup: { name: 'Signups', headers: ['Timestamp', 'First name', 'Phone', 'Email', 'City', 'Instagram', 'Consent', 'Consent text', 'Page'] },
  ugc:    { name: 'UGC Inquiries', headers: ['Timestamp', 'Name', 'Brand', 'Email', 'Content type', 'Timeline', 'Message', 'Status', 'Page'] },
  feature:{ name: 'Feature Requests', headers: ['Timestamp', 'Type', 'Name', 'Email', 'Role', 'Artist / project', 'Date', 'Link', 'Message', 'Status', 'Page'] }
};

function doPost(e) {
  const p = (e && e.parameter) || {};
  if (p.website) return reply_();                                   // spam bot filled the hidden field
  const c = (v, n) => String(v || '').slice(0, n || 300).replace(/^[=+\-@]/, "'$&"); // stored as text, never a formula
  if (p.form === 'ugc') {
    if (!p.name || !p.brand || !p.email) return reply_();
    append_(TABS.ugc, [new Date(), c(p.name), c(p.brand), c(p.email), c(p.content_type), c(p.timeline), c(p.message, 2000), 'New', c(p.page)]);
    MailApp.sendEmail({
      to: ALERT_EMAIL, replyTo: String(p.email).slice(0, 120),
      subject: 'New UGC inquiry: ' + String(p.brand).slice(0, 80),
      body: 'Name: ' + p.name + '\nBrand: ' + p.brand + '\nEmail: ' + p.email +
            '\nContent type: ' + (p.content_type || '-') + '\nTimeline: ' + (p.timeline || '-') +
            '\n\n' + String(p.message || '').slice(0, 2000) + '\n\nReply to this email to answer them directly.'
    });
    return reply_();
  }
  if (p.form === 'feature') {
    if (!p.name || !p.email) return reply_();
    append_(TABS.feature, [new Date(), c(p.type), c(p.name), c(p.email), c(p.role), c(p.project), c(p.date), c(p.link, 500),
                           c(p.message, 2000), 'New', c(p.page)]);
    MailApp.sendEmail({
      to: FEATURE_EMAIL, replyTo: String(p.email).slice(0, 120),
      subject: 'Feature request: ' + String(p.type || '').slice(0, 40) + ' — ' + String(p.project || p.name).slice(0, 80),
      body: 'Type: ' + (p.type || '-') + '\nName: ' + p.name + '\nEmail: ' + p.email + '\nRole: ' + (p.role || '-') +
            '\nArtist / project: ' + (p.project || '-') + '\nDate: ' + (p.date || '-') + '\nLink: ' + (p.link || '-') +
            '\n\n' + String(p.message || '').slice(0, 2000) + '\n\nReply to this email to answer them directly.'
    });
    return reply_();
  }
  if (!p.city || (!p.phone && !p.email)) return reply_();
  append_(TABS.signup, [new Date(), c(p.first_name), c(p.phone), c(p.email), c(p.city), c(p.instagram),
                        p.consent === 'yes' ? 'yes' : 'no', c(p.consent_text), c(p.page)]);
  return reply_();
}

function append_(tab, row) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(tab.name) || ss.insertSheet(tab.name);
    if (sh.getLastRow() === 0) { sh.appendRow(tab.headers); sh.setFrozenRows(1); }
    sh.appendRow(row);
  } finally { lock.releaseLock(); }
}

function doGet() { return reply_(); }
function reply_() { return ContentService.createTextOutput('{"ok":true}').setMimeType(ContentService.MimeType.JSON); }

/** Run this once from the editor (pick "authorize" in the toolbar, then ▶ Run) to approve sending email. */
function authorize() { Logger.log('Emails left today: ' + MailApp.getRemainingDailyQuota()); }
