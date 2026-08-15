import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = "Gepeto <notifications@gepeto.com>";

// ── Shared HTML wrapper ───────────────────────────────────────────────────────

function layout(title: string, body: string) {
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
          <span style="font-size:11.5px;color:#9a9a9a;">Gepeto · Dental Lab Logistics · You're receiving this because you manage alerts for your lab.</span>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function badge(text: string, color: string, bg: string) {
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:11px;font-weight:600;border-radius:4px;padding:2px 8px;letter-spacing:0.03em;">${text}</span>`;
}

function metaRow(label: string, value: string) {
  return `<tr>
    <td style="padding:5px 0;font-size:12px;color:#5F5E5A;width:130px;">${label}</td>
    <td style="padding:5px 0;font-size:13px;color:#1a1a1a;font-weight:500;">${value}</td>
  </tr>`;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export type StatJobAlertData = {
  caseId: string;
  officeName: string;
  deliveryAddress: string;
  labName: string;
  dashboardUrl: string;
};

export type DriverOffDutyData = {
  driverName: string;
  labName: string;
  dashboardUrl: string;
};

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

export async function sendStatJobAlert(to: string[], data: StatJobAlertData) {
  const body = `
    <h2 style="margin:0 0 6px;font-size:17px;font-weight:600;color:#1a1a1a;">
      ${badge("STAT", "#C53B0A", "#FFF0EB")} New STAT Job Created
    </h2>
    <p style="margin:0 0 20px;font-size:13.5px;color:#5F5E5A;line-height:1.5;">
      A high-priority job has been added to your queue and needs a driver assigned.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid rgba(0,0,0,0.08);border-radius:8px;padding:14px 16px;background:#FAFAFA;margin-bottom:24px;">
      ${metaRow("Case ID", data.caseId)}
      ${metaRow("Office", data.officeName)}
      ${metaRow("Delivery address", data.deliveryAddress)}
    </table>
    <a href="${data.dashboardUrl}" style="display:inline-block;background:#185FA5;color:#ffffff;font-size:13.5px;font-weight:500;border-radius:7px;padding:10px 20px;text-decoration:none;">
      View in Dashboard →
    </a>`;

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `[STAT] New job — ${data.caseId} · ${data.labName}`,
    html: layout(`STAT Job Alert — ${data.caseId}`, body),
  });
}

export async function sendDriverOffDutyAlert(to: string[], data: DriverOffDutyData) {
  const body = `
    <h2 style="margin:0 0 6px;font-size:17px;font-weight:600;color:#1a1a1a;">
      Driver Went Off-Duty
    </h2>
    <p style="margin:0 0 20px;font-size:13.5px;color:#5F5E5A;line-height:1.5;">
      <strong>${data.driverName}</strong> has changed their status to <strong>Off Duty</strong>.
      If they had active jobs, those may need to be reassigned.
    </p>
    <a href="${data.dashboardUrl}" style="display:inline-block;background:#185FA5;color:#ffffff;font-size:13.5px;font-weight:500;border-radius:7px;padding:10px 20px;text-decoration:none;">
      View Drivers →
    </a>`;

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `Driver off-duty — ${data.driverName} · ${data.labName}`,
    html: layout("Driver Off-Duty Alert", body),
  });
}

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

// ── Helper: get dispatcher emails for a lab ───────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

export async function getDispatcherEmails(labId: string): Promise<string[]> {
  const users = await db("lab_users")
    .where({ lab_id: labId })
    .whereIn("labRole", ["owner", "dispatcher"])
    .select("email");
  return users.map((u: { email: string }) => u.email).filter(Boolean);
}

export function getDashboardUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
