"use client";

import Link from "next/link";
import { useTheme } from "@/components/ui/ThemeContext";
import { Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ap-bg)", padding: "2rem" }}>
      <div style={{ width: "100%", maxWidth: 460, textAlign: "center" }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: "0.85rem", letterSpacing: "0.3em", fontWeight: 700, color: "var(--ap-text)", marginBottom: "3rem" }}>
            LUM<span style={{ color: "var(--ap-accent)" }}>I</span>NA
          </p>
        </Link>

        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, border: "1px solid var(--ap-input-border)", borderRadius: "50%", marginBottom: "1.5rem" }}>
          <Mail size={24} color="var(--ap-accent)" />
        </div>

        <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: "0.55rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--ap-accent)", marginBottom: "0.75rem", opacity: 0.9 }}>
          Password reset
        </p>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2.4rem", fontWeight: 300, color: "var(--ap-text)", lineHeight: 1.2, marginBottom: "1rem" }}>
          Need to reset your password?
        </h1>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem", color: "var(--ap-text-muted)", lineHeight: 1.6, marginBottom: "2rem" }}>
          Reach out to <a href="mailto:support@lumina.app" style={{ color: "var(--ap-accent)", textDecoration: "none" }}>support@lumina.app</a> with your account email and we'll get you back in.
        </p>

        <Link href="/auth/login" style={{ display: "inline-block", fontFamily: "'Syncopate', sans-serif", fontSize: "0.55rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ap-text-muted)", textDecoration: "none", borderBottom: "1px solid var(--ap-input-border)", paddingBottom: "0.25rem" }}>
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
