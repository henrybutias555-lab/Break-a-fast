/**
 * Break-a-Fast order alerts → Gmail, plus live order status for the tracking links
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
    const props = PropertiesService.getScriptProperties();
    if (d.action === "get") return reply(props.getProperty("st_" + d.ref) || "");
    if (d.action === "set") { props.setProperty("st_" + d.ref, String(d.s).slice(0, 4)); props.setProperty("at_" + d.ref, String(Date.now())); tidy(props); return reply("ok"); }
    MailApp.sendEmail({ to: SEND_TO, subject: String(d.subject).slice(0, 250), htmlBody: String(d.html), name: "Break-a-Fast Orders" });
    return reply("ok");
  } catch (err) {
    return reply("error: " + err);
  }
}
function doGet() { return reply("Break-a-Fast alerts are running (status v2)"); }
// Keeps the order-status list small: forgets orders not updated for 120 days.
function tidy(props) {
  if (Math.random() > 0.05) return;
  const all = props.getProperties(), old = Date.now() - 120 * 864e5;
  Object.keys(all).forEach(function (k) { if (k.indexOf("at_") === 0 && Number(all[k]) < old) { props.deleteProperty(k); props.deleteProperty("st_" + k.slice(3)); } });
}
function reply(t) { return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.TEXT); }

/** Run this once from the editor to grant Gmail permission and get a test email. */
function sendTestEmail() {
  MailApp.sendEmail({ to: SEND_TO, subject: "✅ Break-a-Fast alerts test", htmlBody: "If you can read this, order alerts will reach this inbox.", name: "Break-a-Fast Orders" });
}
