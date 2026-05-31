// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { bearer, openAPI, emailOTP, twoFactor } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from '../infrastructure/db/index.js';
import { NodemailerEmailService } from '../infrastructure/services/NodemailerEmailService.js';

const emailService = new NodemailerEmailService();

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
    }),
    emailAndPassword: {
        enabled: true,
    },
    session: {
        user: {
            fields: ['id', 'name', 'email', 'role']
        }
    },
    trustedOrigins: [
        "http://localhost:3001",
        "http://localhost:3002",
        process.env.FRONTEND_URL ?? "http://localhost:3002",
        "https://*.vercel.app",
    ],
    advanced: {
        defaultCookieAttributes: {
            sameSite: "none",
            secure: true,
        },
    },
    plugins: [
        bearer(),
        openAPI(),

        // ── Email OTP (primary auth for all users) ─────────────────────────
        emailOTP({
            async sendVerificationOTP({ email, otp }) {
                // Dev shortcut — print OTP to backend console instead of sending email
                if (process.env.BYPASS_OTP === 'true' || !process.env.SMTP_USER) {
                    console.log(`\n========================================`);
                    console.log(`[DEV OTP] email=${email}  code=${otp}`);
                    console.log(`========================================\n`);
                    return;
                }
                await emailService.sendOtp(email, otp, 10);
            },
            otpLength: 6,
            expiresIn: 600,
        }),

        // ── TOTP (second factor — required for admin accounts) ─────────────
        // Endpoints exposed:
        //   POST /api/auth/two-factor/enable-totp    → returns QR code URI
        //   POST /api/auth/two-factor/verify-totp    → verifies code, marks session
        //   POST /api/auth/two-factor/disable-totp
        //   GET  /api/auth/two-factor/get-totp-uri   → re-fetch QR code URI
        twoFactor({
            issuer: "PFE2026 Lacuna",
            totpOptions: {
                digits: 6,
                period: 30,   // seconds — standard TOTP (Google Authenticator compatible)
            },
        }),
    ]
});
