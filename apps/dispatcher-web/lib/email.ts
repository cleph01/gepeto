import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = "Gepeto <notifications@gepeto.delivery>";

// Resend reports most failures (quota hit, bad address, domain problem) in its
// response rather than throwing, so a bare .catch() misses them. Check both.
export async function delivered(send: Promise<{ error: unknown }>, label: string) {
  try {
    const { error } = await send;
    if (!error) return true;
    console.error(`[email] ${label} failed:`, error);
  } catch (e) {
    console.error(`[email] ${label} failed:`, e);
  }
  return false;
}

// ── Shared HTML wrapper ───────────────────────────────────────────────────────

// Served by the landing site (apps/landing/public). Absolute URL because email
// clients can't resolve relative paths.
const LOGO_URL = "https://gepeto.delivery/gepeto-icon.png";

const LAB_FOOTER ="Gepeto · Dental Lab Logistics · You're receiving this because you manage alerts for your lab.";

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

        <!-- Header: logo on white, then a thin brand bar -->
        <tr><td style="background:#ffffff;border:1px solid rgba(0,0,0,0.08);border-bottom:none;border-radius:10px 10px 0 0;padding:16px 24px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;padding-right:10px;">
              <img src="${LOGO_URL}" width="36" height="36" alt="" style="display:block;border:0;" />
            </td>
            <td style="vertical-align:middle;font-size:19px;font-weight:700;color:#185FA5;letter-spacing:-0.01em;">Gepeto</td>
          </tr></table>
        </td></tr>
        <tr><td style="background:#185FA5;height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>

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

// ── Auth emails (bypass Supabase's rate-limited built-in mailer) ──────────────

export type InviteRole = "driver" | "dispatcher";

// Store links for the driver app. Unset until the EAS build is published; the
// invite then says the dispatcher will send the app instead of showing buttons.
export function getDriverAppLinks() {
  return {
    ios: process.env.DRIVER_APP_IOS_URL || null,
    android: process.env.DRIVER_APP_ANDROID_URL || null,
  };
}

const INVITE_COPY: Record<InviteRole, {
  lead: (lab: string) => string;
  perks: { title: string; text: string }[];
}> = {
  driver: {
    lead: (lab) => `${lab} has added you as a driver on Gepeto, the app the lab uses to run its deliveries.`,
    perks: [
      { title: "Your jobs, on your phone", text: "New runs show up the moment dispatch assigns them, with the address, case details and pickup notes in one place." },
      { title: "Message dispatch without phone tag", text: "Ask a question or flag a problem right from the job. The conversation stays with the case." },
      { title: "Proof of delivery in one tap", text: "Snap a photo at drop-off and the lab knows it's done. No paperwork, no call-back." },
    ],
  },
  dispatcher: {
    lead: (lab) => `${lab} has added you to its dispatch team on Gepeto.`,
    perks: [
      { title: "Every run on one board", text: "See what's unassigned, in transit and delivered, and assign drivers in a couple of clicks." },
      { title: "Drivers on a live map", text: "Know where each driver is without calling around." },
      { title: "Offices track their own cases", text: "Dental offices get a tracking page, so fewer \"where's my case?\" calls." },
    ],
  },
};

function perkRow(n: number, title: string, text: string) {
  return `<tr>
    <td style="vertical-align:top;padding:0 12px 14px 0;width:26px;">
      <div style="width:26px;height:26px;border-radius:13px;background:#EBF2FA;color:#185FA5;font-size:13px;font-weight:700;line-height:26px;text-align:center;">${n}</div>
    </td>
    <td style="vertical-align:top;padding:0 0 14px;">
      <div style="font-size:14px;font-weight:600;color:#1a1a1a;margin:3px 0 2px;">${title}</div>
      <div style="font-size:13px;color:#5F5E5A;line-height:1.5;">${text}</div>
    </td>
  </tr>`;
}

function storeButton(href: string, small: string, big: string) {
  return `<a href="${href}" style="display:inline-block;background:#111827;color:#ffffff;border-radius:8px;padding:7px 14px;text-decoration:none;margin:0 8px 8px 0;">
    <span style="display:block;font-size:10px;line-height:1.2;opacity:0.85;">${small}</span>
    <span style="display:block;font-size:15px;font-weight:600;line-height:1.3;">${big}</span>
  </a>`;
}

function driverAppStep() {
  const { ios, android } = getDriverAppLinks();
  if (!ios && !android) {
    return `Your dispatcher will send you a link to download the Gepeto driver app.`;
  }
  return `Download the Gepeto driver app:<div style="margin-top:10px;">${
    (ios ? storeButton(ios, "Download on the", "App Store") : "") +
    (android ? storeButton(android, "Get it on", "Google Play") : "")
  }</div>`;
}

export async function sendInviteEmail(
  to: string,
  data: { name: string; inviteUrl: string; role: InviteRole; labName?: string | null },
) {
  const firstName = escapeHtml(data.name.trim().split(/\s+/)[0] || data.name);
  const lab = escapeHtml(data.labName?.trim() || "Your lab");
  const copy = INVITE_COPY[data.role];
  const email = escapeHtml(to);

  const steps =
    data.role === "driver"
      ? [
          "Set your password with the button above.",
          driverAppStep(),
          `Log in to the app with <strong style="color:#1a1a1a;">${email}</strong> and the password you chose.`,
        ]
      : [
          "Set your password with the button above.",
          `You'll land on the dispatch board. Next time, sign in at <a href="${getDashboardUrl()}" style="color:#185FA5;">${getDashboardUrl().replace(/^https?:\/\//, "")}</a> with <strong style="color:#1a1a1a;">${email}</strong>.`,
        ];

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.01em;">
      Welcome to the team, ${firstName}
    </h1>
    <p style="margin:0 0 22px;font-size:14.5px;color:#3d3d3a;line-height:1.55;">
      ${copy.lead(lab)}
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 8px;"><tr><td style="border-radius:8px;background:#185FA5;">
      <a href="${data.inviteUrl}" style="display:inline-block;color:#ffffff;font-size:15px;font-weight:600;border-radius:8px;padding:13px 26px;text-decoration:none;">
        Set your password →
      </a>
    </td></tr></table>
    <p style="margin:0 0 26px;font-size:12px;color:#9a9a9a;">This link expires in 24 hours.</p>

    <div style="border-top:1px solid rgba(0,0,0,0.08);padding-top:22px;">
      <div style="font-size:11.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#185FA5;margin:0 0 14px;">What Gepeto does for you</div>
      <table cellpadding="0" cellspacing="0" width="100%">
        ${copy.perks.map((p, i) => perkRow(i + 1, p.title, p.text)).join("")}
      </table>
    </div>

    <div style="background:#F8F9FB;border-radius:8px;padding:16px 18px;margin-top:8px;">
      <div style="font-size:11.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#5F5E5A;margin:0 0 10px;">Getting started</div>
      <ol style="margin:0;padding-left:18px;font-size:13px;color:#5F5E5A;line-height:1.55;">
        ${steps.map((s) => `<li style="margin:0 0 8px;">${s}</li>`).join("")}
      </ol>
    </div>

    <p style="margin:20px 0 0;font-size:12px;color:#9a9a9a;line-height:1.5;">
      Weren't expecting this? You can safely ignore this email.
    </p>`;

  const subject = data.labName?.trim()
    ? `${data.labName.trim()} invited you to Gepeto`
    : "You've been invited to Gepeto";

  return getResend().emails.send({
    from: FROM,
    to,
    subject,
    html: layout(escapeHtml(subject), body, `Gepeto · Dental lab delivery · <a href="https://gepeto.delivery" style="color:#9a9a9a;">gepeto.delivery</a><br/>You're receiving this because ${lab} invited you.`),
  });
}

export async function sendPasswordResetEmail(to: string, data: { resetUrl: string; name?: string; isReset?: boolean }) {
  const greeting = data.name ? `Hi ${escapeHtml(data.name)}, c` : "C";
  const heading = data.isReset ? "Reset your Gepeto password" : "Set up your Gepeto account";
  const body = `
    <h2 style="margin:0 0 6px;font-size:17px;font-weight:600;color:#1a1a1a;">
      ${heading}
    </h2>
    <p style="margin:0 0 20px;font-size:13.5px;color:#5F5E5A;line-height:1.5;">
      ${greeting}lick the link below to ${data.isReset ? "reset your password" : "set a password for your account"} and sign in.
    </p>
    <a href="${data.resetUrl}" style="display:inline-block;background:#185FA5;color:#ffffff;font-size:13.5px;font-weight:500;border-radius:7px;padding:10px 20px;text-decoration:none;">
      ${data.isReset ? "Reset password" : "Set password"} →
    </a>
    <p style="margin:16px 0 0;font-size:12px;color:#9a9a9a;line-height:1.5;">
      This link expires shortly. If you didn't request this, you can safely ignore it.
    </p>`;

  return getResend().emails.send({
    from: FROM,
    to,
    subject: heading,
    html: layout(heading, body, "Gepeto · You're receiving this because a password reset was requested for your account."),
  });
}
