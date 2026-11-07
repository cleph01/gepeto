import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = "Gepeto <notifications@gepeto.delivery>";

// ── Shared HTML wrapper ───────────────────────────────────────────────────────

const LAB_FOOTER = "Gepeto · Dental Lab Logistics · You're receiving this because you manage alerts for your lab.";

function layout(title: string, body: string, footer = LAB_FOOTER) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F8F9FB;font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FB;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Header -->
        <tr><td style="background:#185FA5;border-radius:10px 10px 0 0;padding:18px 24px;display:flex;align-items:center;gap:10px;">
          <span style="font-size:16px;font-weight:600;color:#ffffff;letter-spacing:-0.01em;">Gepeto</span>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:28px 24px;border-left:1px solid rgba(0,0,0,0.08);border-right:1px solid rgba(0,0,0,0.08);">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#F8F9FB;border:1px solid rgba(0,0,0,0.08);border-top:none;border-radius:0 0 10px 10px;padding:14px 24px;text-align:center;">
          <span style="font-size:11.5px;color:#9a9a9a;">${footer}</span>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function metaRow(label: string, value: string) {
  return `<tr>
    <td style="padding:5px 0;font-size:12px;color:#5F5E5A;width:130px;">${label}</td>
    <td style="padding:5px 0;font-size:13px;color:#1a1a1a;font-weight:500;">${value}</td>
  </tr>`;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export type UnassignedJobData = {
  caseId: string;
  officeName: string;
  minutesUnassigned: number;
  labName: string;
  dashboardUrl: string;
};

export type LateDeliveryData = {
  caseId: string;
  officeName: string;
  driverName: string;
  minutesOverdue: number;
  labName: string;
  dashboardUrl: string;
};

// ── Send helpers ──────────────────────────────────────────────────────────────

export async function sendUnassignedJobAlert(to: string[], data: UnassignedJobData) {
  const body = `
    <h2 style="margin:0 0 6px;font-size:17px;font-weight:600;color:#1a1a1a;">
      Job Unassigned for ${data.minutesUnassigned} Minutes
    </h2>
    <p style="margin:0 0 20px;font-size:13.5px;color:#5F5E5A;line-height:1.5;">
      A job has been waiting for a driver longer than your configured threshold.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid rgba(0,0,0,0.08);border-radius:8px;padding:14px 16px;background:#FAFAFA;margin-bottom:24px;">
      ${metaRow("Case ID", data.caseId)}
      ${metaRow("Office", data.officeName)}
      ${metaRow("Unassigned for", `${data.minutesUnassigned} min`)}
    </table>
    <a href="${data.dashboardUrl}" style="display:inline-block;background:#185FA5;color:#ffffff;font-size:13.5px;font-weight:500;border-radius:7px;padding:10px 20px;text-decoration:none;">
      Assign a Driver →
    </a>`;

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `Unassigned job — ${data.caseId} · ${data.labName}`,
    html: layout("Unassigned Job Alert", body),
  });
}

export async function sendLabDeletionWarning(to: string[], data: { labName: string; deleteOn: Date }) {
  const date = data.deleteOn.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const body = `
    <h2 style="margin:0 0 6px;font-size:17px;font-weight:600;color:#1a1a1a;">
      Your Gepeto data will be deleted after ${date}
    </h2>
    <p style="margin:0 0 14px;font-size:13.5px;color:#5F5E5A;line-height:1.5;">
      The subscription for ${escapeHtml(data.labName)} has ended. After ${date}, we'll permanently delete your lab's jobs, returns, messages, delivery photos, and driver and office records, along with your team's and drivers' sign-ins. This can't be undone.
    </p>
    <p style="margin:0 0 20px;font-size:13.5px;color:#5F5E5A;line-height:1.5;">
      To keep your data, start a plan in Settings before then. To get a copy, email hello@gepeto.delivery.
    </p>
    <a href="${getDashboardUrl()}/settings?section=billing" style="display:inline-block;background:#185FA5;color:#ffffff;font-size:13.5px;font-weight:500;padding:9px 18px;border-radius:7px;text-decoration:none;">
      Open Settings →
    </a>`;

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `Your Gepeto data will be deleted after ${date}`,
    html: layout("Your Gepeto data will be deleted", body),
  });
}

export async function sendLateDeliveryAlert(to: string[], data: LateDeliveryData) {
  const body = `
    <h2 style="margin:0 0 6px;font-size:17px;font-weight:600;color:#1a1a1a;">
      Delivery Overdue by ${data.minutesOverdue} Minutes
    </h2>
    <p style="margin:0 0 20px;font-size:13.5px;color:#5F5E5A;line-height:1.5;">
      A delivery has exceeded its scheduled time and has not been marked as delivered.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid rgba(0,0,0,0.08);border-radius:8px;padding:14px 16px;background:#FAFAFA;margin-bottom:24px;">
      ${metaRow("Case ID", data.caseId)}
      ${metaRow("Office", data.officeName)}
      ${metaRow("Driver", data.driverName)}
      ${metaRow("Overdue by", `${data.minutesOverdue} min`)}
    </table>
    <a href="${data.dashboardUrl}" style="display:inline-block;background:#185FA5;color:#ffffff;font-size:13.5px;font-weight:500;border-radius:7px;padding:10px 20px;text-decoration:none;">
      View Job →
    </a>`;

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `Late delivery — ${data.caseId} · ${data.labName}`,
    html: layout("Late Delivery Alert", body),
  });
}

// ── Office access code ────────────────────────────────────────────────────────

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type OfficeAccessCodeData = {
  officeName: string;
  labName: string;
  code: string;
  replyTo: string[];
};

// Deliberately leaves out the tracking link: if both were in one email,
// forwarding it would hand over full access.
export async function sendOfficeAccessCode(to: string, data: OfficeAccessCodeData) {
  const office = escapeHtml(data.officeName);
  const lab = escapeHtml(data.labName);
  const body = `
    <h2 style="margin:0 0 6px;font-size:17px;font-weight:600;color:#1a1a1a;">
      Your delivery tracking access code
    </h2>
    <p style="margin:0 0 20px;font-size:13.5px;color:#5F5E5A;line-height:1.5;">
      ${lab} uses this code to protect ${office}'s delivery details. Share it with your staff.
    </p>
    <div style="text-align:center;background:#F0F4F8;border:1px solid rgba(0,0,0,0.08);border-radius:8px;padding:18px 16px;margin-bottom:20px;font-family:ui-monospace,Menlo,monospace;font-size:24px;font-weight:600;letter-spacing:0.08em;color:#1a1a1a;">
      ${escapeHtml(data.code)}
    </div>
    <p style="margin:0 0 10px;font-size:13.5px;color:#3a3a3a;line-height:1.5;">
      Open your office's tracking page and enter this code to see your cases, driver locations, messages, delivery history and photos, and to request pickups. Each device stays unlocked for 30 days.
    </p>
    <p style="margin:0;font-size:13.5px;color:#3a3a3a;line-height:1.5;">
      Don't have the tracking page saved? Reply to this email and ${lab} will send it to you.
    </p>`;

  return getResend().emails.send({
    from: FROM,
    to,
    replyTo: data.replyTo,
    subject: `Tracking access code for ${data.officeName}`,
    html: layout("Your access code", body, `Gepeto · Sent on behalf of ${lab}. Please keep this code within your office.`),
  });
}

export type OfficeTrackingLinkData = {
  officeName: string;
  labName: string;
  url: string;
  replyTo: string[];
};

// Deliberately leaves out the access code, for the same reason the code email
// leaves out the link.
export async function sendOfficeTrackingLink(to: string, data: OfficeTrackingLinkData) {
  const office = escapeHtml(data.officeName);
  const lab = escapeHtml(data.labName);
  const url = escapeHtml(data.url);
  const body = `
    <h2 style="margin:0 0 6px;font-size:17px;font-weight:600;color:#1a1a1a;">
      Your delivery tracking page
    </h2>
    <p style="margin:0 0 20px;font-size:13.5px;color:#5F5E5A;line-height:1.5;">
      ${lab} uses this page to keep ${office} up to date on your cases. Save it for your staff.
    </p>
    <div style="text-align:center;margin-bottom:20px;">
      <a href="${url}" style="display:inline-block;background:#185FA5;color:#ffffff;text-decoration:none;border-radius:8px;padding:11px 22px;font-size:14px;font-weight:600;">
        Open tracking page
      </a>
    </div>
    <p style="margin:0 0 10px;font-size:13.5px;color:#3a3a3a;line-height:1.5;">
      The page opens with your office's access code, which is sent separately. It unlocks your cases, driver locations, messages, delivery history and photos, and pickup requests.
    </p>
    <p style="margin:0;font-size:13.5px;color:#3a3a3a;line-height:1.5;">
      Don't have the code? Reply to this email and ${lab} will send it to you.
    </p>`;

  return getResend().emails.send({
    from: FROM,
    to,
    replyTo: data.replyTo,
    subject: `Tracking link for ${data.officeName}`,
    html: layout("Your tracking page", body, `Gepeto · Sent on behalf of ${lab}. Please keep this link within your office.`),
  });
}

// ── Helper: get dispatcher emails for a lab ───────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// Test logins can still sign in, but they never receive email: nobody on the team
// reads these addresses. Card 99 deletes the accounts before production.
const NO_EMAIL_ADDRESSES = /@(gepeto\.dev|123\.com)$/i;

export async function getDispatcherEmails(labId: string): Promise<string[]> {
  const users = await db("lab_users")
    .where({ lab_id: labId })
    .whereIn("labRole", ["owner", "dispatcher"])
    .select("email");
  return users
    .map((u: { email: string }) => u.email)
    .filter((email: string) => email && !NO_EMAIL_ADDRESSES.test(email));
}

export function getDashboardUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
