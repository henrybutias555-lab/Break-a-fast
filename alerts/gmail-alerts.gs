/**
 * Break-a-Fast order alerts → Gmail
 * Paste into a new project at https://script.google.com, set ALERT_KEY,
 * then Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 * The key must match the ALERT_KEY environment variable on the Render order server.
 */
const ALERT_KEY = "PASTE-THE-KEY-HERE";
// Who receives the alerts. Add more addresses separated by commas.
const SEND_TO = Session.getEffectiveUser().getEmail();

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.key !== ALERT_KEY) return reply("denied");
    MailApp.sendEmail({ to: SEND_TO, subject: String(d.subject).slice(0, 250), htmlBody: String(d.html), name: "Break-a-Fast Orders" });
    return reply("ok");
  } catch (err) {
    return reply("error: " + err);
  }
}
function doGet() { return reply("Break-a-Fast alerts are running"); }
function reply(t) { return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.TEXT); }

/** Run this once from the editor to grant Gmail permission and get a test email. */
function sendTestEmail() {
  MailApp.sendEmail({ to: SEND_TO, subject: "✅ Break-a-Fast alerts test", htmlBody: "If you can read this, order alerts will reach this inbox.", name: "Break-a-Fast Orders" });
}
