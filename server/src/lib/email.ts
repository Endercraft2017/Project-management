import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getTenantContext } from "../tenancy/context";
import { getTenantById } from "../platform/store";
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}
export class EmailUnavailableError extends Error {
  status = 503;
  code = "EMAIL_DISABLED";
  constructor() {
    super("Email delivery is disabled or not configured. No email was sent.");
  }
}
export const isEmailEnabled = () =>
  process.env.MAIL_ENABLED === "true" &&
  Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM,
  );
export function escapeEmailHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
let transporter: Transporter | undefined;
function getTransporter(): Transporter {
  if (!isEmailEnabled()) throw new EmailUnavailableError();
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new EmailUnavailableError();
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "true",
      requireTLS: true,
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
      connectionTimeout: 10000,
      socketTimeout: 20000,
      tls: { rejectUnauthorized: true },
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }
  return transporter;
}
export async function sendEmail(options: EmailOptions): Promise<void> {
  if (
    /[\r\n]/.test(options.to + options.subject) ||
    options.html.length > 1000000
  )
    throw new Error("Invalid email envelope");
  if (!isEmailEnabled()) throw new EmailUnavailableError();
  const tenant = await getTenantById(getTenantContext().id);
  if (!tenant || tenant.status !== "ACTIVE") throw new EmailUnavailableError();
  const transport = getTransporter();
  try {
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, " "),
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    if (!info.accepted?.length || info.rejected?.length)
      throw new Error("Not accepted");
  } catch {
    throw Object.assign(
      new Error(
        "Email provider did not confirm acceptance. Delivery may be uncertain; review before retrying.",
      ),
      { status: 502, code: "EMAIL_DELIVERY_FAILED" },
    );
  }
}
function link(path: string, parameters: Record<string, string>): string {
  const base =
    process.env.APP_URL || process.env.CLIENT_URL || "http://localhost:5173";
  const u = new URL(path, base);
  if (
    u.username ||
    u.password ||
    !["https:", "http:"].includes(u.protocol) ||
    (process.env.NODE_ENV === "production" && u.protocol !== "https:")
  )
    throw new Error("Invalid public application URL");
  for (const [k, v] of Object.entries(parameters)) u.searchParams.set(k, v);
  return u.toString();
}
function page(title: string, body: string): string {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#202033;max-width:680px;margin:auto;padding:24px"><h1>E-Z</h1><h2>${escapeEmailHtml(title)}</h2>${body}<p>Sent by E-Z Project Manager</p></body></html>`;
}
export async function sendInvitationEmail(
  to: string,
  inviterName: string,
  inviteToken: string,
  role: "ADMIN" | "MEMBER",
): Promise<void> {
  const url = escapeEmailHtml(link("/accept-invite", { token: inviteToken }));
  await sendEmail({
    to,
    subject: "You are invited to E-Z",
    html: page(
      "Team invitation",
      `<p>${escapeEmailHtml(inviterName)} invited you as ${escapeEmailHtml(role)}.</p><p><a href="${url}">Review invitation</a></p><p>If unexpected, ignore this message.</p>`,
    ),
  });
}
export async function sendInvitationReminderEmail(
  to: string,
  inviterName: string,
  inviteToken: string,
  daysRemaining: number,
): Promise<void> {
  const url = escapeEmailHtml(link("/accept-invite", { token: inviteToken }));
  await sendEmail({
    to,
    subject: "Your E-Z invitation reminder",
    html: page(
      "Invitation reminder",
      `<p>${escapeEmailHtml(inviterName)} invited you. ${escapeEmailHtml(daysRemaining)} days remain.</p><a href="${url}">Review invitation</a>`,
    ),
  });
}
export async function sendWeeklySummaryEmail(
  to: string,
  weekStartDate: string,
  weekEndDate: string,
  summaries: Array<{
    userName: string;
    summary: string;
    impactLevel: "HIGH" | "MEDIUM" | "LOW";
  }>,
): Promise<void> {
  const cards = summaries
    .map(
      (s) =>
        `<section><h3>${escapeEmailHtml(s.userName)}</h3><p>${escapeEmailHtml(s.summary)}</p><p>AI assessment: ${escapeEmailHtml(s.impactLevel)}</p></section>`,
    )
    .join("");
  await sendEmail({
    to,
    subject: "E-Z weekly team summary",
    html: page(
      "Weekly team summary",
      `<p>${escapeEmailHtml(weekStartDate)} – ${escapeEmailHtml(weekEndDate)}</p>${cards}<p>AI-generated summary. Review against the original updates.</p>`,
    ),
  });
}
export async function sendDailyUpdateReminderEmail(
  to: string,
  userName: string,
  date: string,
): Promise<void> {
  const url = escapeEmailHtml(link("/app", { view: "updates", date }));
  await sendEmail({
    to,
    subject: "E-Z daily update reminder",
    html: page(
      "Daily update reminder",
      `<p>Hello ${escapeEmailHtml(userName)}, your update for ${escapeEmailHtml(date)} is missing.</p><a href="${url}">Write your update</a>`,
    ),
  });
}
export default {
  sendEmail,
  sendInvitationEmail,
  sendInvitationReminderEmail,
  sendWeeklySummaryEmail,
  sendDailyUpdateReminderEmail,
};
