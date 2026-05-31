// src/infrastructure/services/NodemailerEmailService.ts
// DROP IN: src/infrastructure/services/NodemailerEmailService.ts
// INSTALL: npm install nodemailer
//          npm install --save-dev @types/nodemailer
//
// .env vars required:
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=587
//   SMTP_USER=yourapp@gmail.com
//   SMTP_PASS=your_gmail_app_password   <-- NOT your Gmail password, see note below
//   SMTP_FROM="LACUNA <yourapp@gmail.com>"
//
// Gmail app password setup:
//   1. Go to myaccount.google.com → Security → 2-Step Verification → App Passwords
//   2. Create one for "Mail" + "Other (LACUNA)"
//   3. Copy the 16-char password into SMTP_PASS

import nodemailer, { Transporter } from 'nodemailer';
import { IEmailService } from '../../core/services/IEmailService';

export class NodemailerEmailService implements IEmailService {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port:   Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        // Allows local AV / corporate proxy to intercept TLS (dev only)
        rejectUnauthorized: false,
      },
    });
  }

  // ── Verify connection on startup ──────────────────────────────
  async verify(): Promise<void> {
    await this.transporter.verify();
    console.log('[Email] SMTP connection verified');
  }

  // ── Send 2FA OTP ──────────────────────────────────────────────
  async sendOtp(to: string, otp: string, expiresInMinutes = 10): Promise<void> {
    await this.transporter.sendMail({
      from:    process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject: 'Your LACUNA verification code',
      text:    `Your verification code is: ${otp}\n\nThis code expires in ${expiresInMinutes} minutes.\n\nIf you did not request this, please ignore this email.`,
      html:    otpEmailTemplate(otp, expiresInMinutes),
    });
  }

  // ── Send welcome email on registration ────────────────────────
  async sendWelcome(to: string, firstName: string): Promise<void> {
    await this.transporter.sendMail({
      from:    process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject: 'Welcome to LACUNA',
      html:    welcomeEmailTemplate(firstName),
    });
  }

  // ── Generic send (for other use cases) ───────────────────────
  async send(to: string, subject: string, html: string): Promise<void> {
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject,
      html,
    });
  }
}

// ══════════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ══════════════════════════════════════════════════════════════════

function otpEmailTemplate(otp: string, expiresInMinutes: number): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <tr>
          <td style="background:#1B2A4A;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">LACUNA</h1>
            <p style="margin:6px 0 0;color:#93C5FD;font-size:13px;">Security Verification</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 20px;">
            <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
              You requested a verification code to sign in to your LACUNA account.
            </p>
            <p style="margin:0 0 24px;color:#374151;font-size:15px;">
              Enter this code in the app:
            </p>

            <!-- OTP Box -->
            <div style="text-align:center;margin:0 0 32px;">
              <span style="display:inline-block;background:#EFF6FF;border:2px solid #BFDBFE;border-radius:12px;padding:20px 48px;font-size:40px;font-weight:700;letter-spacing:12px;color:#1B2A4A;font-family:'Courier New',monospace;">
                ${otp}
              </span>
            </div>

            <p style="margin:0 0 8px;color:#6B7280;font-size:13px;text-align:center;">
              This code expires in <strong>${expiresInMinutes} minutes</strong>.
            </p>
            <p style="margin:0;color:#6B7280;font-size:13px;text-align:center;">
              If you did not request this, you can safely ignore this email.
            </p>
          </td>
        </tr>

        <!-- Security notice -->
        <tr>
          <td style="padding:20px 40px;background:#FEF2F2;border-top:1px solid #FEE2E2;">
            <p style="margin:0;color:#DC2626;font-size:12px;text-align:center;">
              <strong>Security tip:</strong> LACUNA will never ask for this code by phone or email reply.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;text-align:center;border-top:1px solid #E5E7EB;">
            <p style="margin:0;color:#9CA3AF;font-size:12px;">
              &copy; ${new Date().getFullYear()} LACUNA. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function welcomeEmailTemplate(firstName: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:#1B2A4A;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:2px;">LACUNA</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 16px;color:#1B2A4A;font-size:22px;">Welcome, ${firstName}!</h2>
            <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">
              Your account has been created successfully. You can now browse products, 
              place orders, and use the AI advisor.
            </p>
            <p style="margin:0;color:#374151;font-size:15px;line-height:1.7;">
              For your security, we recommend enabling two-factor authentication in your account settings.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 40px;text-align:center;">
            <p style="margin:0;color:#9CA3AF;font-size:12px;">
              &copy; ${new Date().getFullYear()} LACUNA
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}