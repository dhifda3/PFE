"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import api from "@/lib/api";
import { useTheme } from "@/components/ui/ThemeContext";

const schema = z.object({
  email:    z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type FormData = z.infer<typeof schema>;

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 60;

/* ── Animated gradient orb component ──────────────────────────────────── */
function AnimatedGradientBG({ isDark }: { isDark: boolean }) {
  return (
    <>
      <style>{`
        @keyframes lm-orb1 {
          0%   { transform: translate(0%, 0%)   scale(1); }
          33%  { transform: translate(8%, -12%) scale(1.15); }
          66%  { transform: translate(-6%, 10%) scale(0.9); }
          100% { transform: translate(0%, 0%)   scale(1); }
        }
        @keyframes lm-orb2 {
          0%   { transform: translate(0%, 0%)   scale(1); }
          33%  { transform: translate(-10%, 8%) scale(1.2); }
          66%  { transform: translate(7%, -9%)  scale(0.85); }
          100% { transform: translate(0%, 0%)   scale(1); }
        }
        @keyframes lm-orb3 {
          0%   { transform: translate(0%, 0%)   scale(1); }
          50%  { transform: translate(12%, 6%)  scale(1.1); }
          100% { transform: translate(0%, 0%)   scale(1); }
        }
        @keyframes lm-orb4 {
          0%   { transform: translate(0%, 0%)   scale(1); }
          40%  { transform: translate(-8%, -7%) scale(1.18); }
          80%  { transform: translate(5%, 10%)  scale(0.92); }
          100% { transform: translate(0%, 0%)   scale(1); }
        }
      `}</style>

      {/* Orb 1 — orange, top-right */}
      <div style={{
        position: 'absolute', top: '-18%', right: '-18%',
        width: '70%', height: '70%',
        background: isDark
          ? 'radial-gradient(ellipse, rgba(255,95,31,0.22) 0%, rgba(255,140,0,0.10) 45%, transparent 70%)'
          : 'radial-gradient(ellipse, rgba(255,95,31,0.18) 0%, rgba(255,140,0,0.08) 45%, transparent 70%)',
        filter: 'blur(55px)',
        animation: 'lm-orb1 14s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* Orb 2 — cyan, bottom-left */}
      <div
        style={{
          position: "absolute",
          bottom: "-20%",
          left: "-20%",
          width: "72%",
          height: "72%",
          background: isDark
            ? "radial-gradient(ellipse, rgba(0,255,255,0.18) 0%, rgba(0,180,220,0.08) 45%, transparent 70%)"
            : "radial-gradient(ellipse, rgba(0,170,255,0.32) 0%, rgba(0,120,220,0.18) 45%, transparent 72%)",
          filter: "blur(55px)",
          animation: "lm-orb2 18s ease-in-out infinite",
          pointerEvents: "none",
        }} />

      {/* Orb 3 — orange bleed, bottom-right (accent) */}
      <div style={{
        position: 'absolute', bottom: '10%', right: '-10%',
        width: '45%', height: '45%',
        background: isDark
          ? 'radial-gradient(ellipse, rgba(255,180,50,0.10) 0%, transparent 65%)'
          : 'radial-gradient(ellipse, rgba(255,160,30,0.09) 0%, transparent 65%)',
        filter: 'blur(45px)',
        animation: 'lm-orb3 22s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* Orb 4 — cyan bleed, top-left (accent) */}
      <div style={{
        position: 'absolute', top: '15%', left: '-8%',
        width: '40%', height: '40%',
        background: isDark
          ? 'radial-gradient(ellipse, rgba(0,255,255,0.08) 0%, transparent 65%)'
          : 'radial-gradient(ellipse, rgba(0,200,220,0.07) 0%, transparent 65%)',
        filter: 'blur(40px)',
        animation: 'lm-orb4 17s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
    </>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { login, logout, loading } = useAuthStore();
  const [showPass, setShowPass]       = useState(false);
  const [error, setError]             = useState("");
  const [step, setStep]               = useState<"credentials" | "otp">("credentials");
  const [otp, setOtp]                 = useState("");
  const [otpLoading, setOtpLoading]   = useState(false);
  const [attempts, setAttempts]       = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown]     = useState(0);

  const pendingEmail    = useRef("");
  const pendingPassword = useRef("");
  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const startLockout = () => {
    const until = Date.now() + LOCKOUT_SECONDS * 1000;
    setLockedUntil(until);
    setCountdown(LOCKOUT_SECONDS);
    countdownRef.current = setInterval(() => {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        setLockedUntil(null);
        setAttempts(0);
        setCountdown(0);
        setError("");
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  };

  const onSubmit = async (data: FormData) => {
    setError("");
    try {
      await login(data.email, data.password);
      await logout();
      pendingEmail.current    = data.email;
      pendingPassword.current = data.password;
      await api.post("/api/auth/email-otp/send-verification-otp", {
        email: data.email,
        type: "sign-in",
      });
      setAttempts(0);
      setStep("otp");
    } catch {
      setError("Invalid email or password. Please try again.");
    }
  };

  const onVerifyOtp = async () => {
    if (lockedUntil && Date.now() < lockedUntil) {
      setError(`Too many attempts. Try again in ${countdown}s.`);
      return;
    }
    if (otp.length !== 6) { setError("Enter the 6-digit code."); return; }
    setError("");
    setOtpLoading(true);
    try {
      await api.post("/api/auth/sign-in/email-otp", {
        email: pendingEmail.current,
        otp,
      });
      await login(pendingEmail.current, pendingPassword.current);
      pendingEmail.current    = "";
      pendingPassword.current = "";
      router.push("/");
    } catch {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= MAX_ATTEMPTS) {
        startLockout();
        setError(`Too many failed attempts. Locked for ${LOCKOUT_SECONDS}s.`);
      } else {
        setError(`Invalid or expired code. ${MAX_ATTEMPTS - next} attempt${MAX_ATTEMPTS - next === 1 ? "" : "s"} remaining.`);
      }
    } finally {
      setOtpLoading(false);
      setOtp("");
    }
  };

  const resendOtp = async () => {
    if (lockedUntil && Date.now() < lockedUntil) return;
    setError("");
    setAttempts(0);
    await api.post("/api/auth/email-otp/send-verification-otp", {
      email: pendingEmail.current,
      type: "sign-in",
    });
  };

  const goBack = () => {
    pendingEmail.current    = "";
    pendingPassword.current = "";
    setOtp("");
    setAttempts(0);
    setLockedUntil(null);
    setCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setError("");
    setStep("credentials");
  };

  const isLocked = !!(lockedUntil && Date.now() < lockedUntil);

  /* ── shared style tokens (theme-aware) ─────────────────────────────── */
  const inputBase: React.CSSProperties = {
    width: '100%',
    background: 'var(--ap-input-bg)',
    border: `1px solid var(--ap-input-border)`,
    color: 'var(--ap-text)',
    fontSize: '0.9rem',
    padding: '1rem 1.2rem',
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'border-color 0.3s',
  };
  const inputFocus  = (e: React.FocusEvent<HTMLInputElement>) =>
    (e.currentTarget.style.borderColor = 'var(--ap-accent-glow)');
  const inputBlur   = (e: React.FocusEvent<HTMLInputElement>, hasErr: boolean) =>
    (e.currentTarget.style.borderColor = hasErr ? 'rgba(255,95,31,0.6)' : 'var(--ap-input-border)');
  const labelStyle: React.CSSProperties = {
    fontFamily: "'Syncopate', sans-serif",
    fontSize: '0.55rem', letterSpacing: '0.2em',
    textTransform: 'uppercase', color: 'var(--ap-text-muted)',
    display: 'block', marginBottom: '0.5rem',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

      {/* ─── Left: Hero panel ─── */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: `url('/images/hero-cyan-dark.jpg') center/cover no-repeat`,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '4rem',
      }} className="hidden md:flex">
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(7,5,10,0.85) 0%, rgba(7,5,10,0.5) 50%, rgba(7,5,10,0.8) 100%)' }} />
        <div style={{ position: 'absolute', top: '20%', left: '60%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(0,255,255,0.08) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: '0.85rem', letterSpacing: '0.3em', fontWeight: 700, color: '#fff' }}>
              LUM<span style={{ color: '#00FFFF' }}>I</span>NA
            </p>
          </Link>
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <blockquote style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem, 3.5vw, 3rem)', fontWeight: 300, fontStyle: 'italic', color: '#fff', lineHeight: 1.3, marginBottom: '1.5rem' }}>
            "Your skin tells<br />your story."
          </blockquote>
          <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
            Science-backed skincare for every skin type.
          </p>
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {["Hydrating", "Brightening", "Anti-aging", "Sensitive"].map((tag) => (
            <span key={tag} style={{ fontFamily: "'Syncopate', sans-serif", fontSize: '0.5rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem' }}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* ─── Right: Form ─── */}
      <div style={{
        position: 'relative',
        background: 'var(--ap-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '3rem 2rem',
        overflow: 'hidden',
      }}>
        {/* ── Animated gradient background ── */}
        <AnimatedGradientBG isDark={isDark} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '400px' }}>

          {/* Mobile logo */}
          <div className="md:hidden" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: '0.85rem', letterSpacing: '0.3em', fontWeight: 700, color: 'var(--ap-text)' }}>
                LUM<span style={{ color: 'var(--ap-accent)' }}>I</span>NA
              </p>
            </Link>
          </div>

          {/* ══ STEP 1: credentials ══ */}
          {step === "credentials" && (
            <>
              <div style={{ marginBottom: '2.5rem' }}>
                <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: '0.55rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--ap-accent)', marginBottom: '0.75rem', opacity: 0.9 }}>
                  Welcome back
                </p>
                <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', fontWeight: 300, color: 'var(--ap-text)', lineHeight: 1.1 }}>
                  Sign in
                </h1>
              </div>

              {error && (
                <div style={{ background: 'rgba(255,95,31,0.08)', border: '1px solid rgba(255,95,31,0.3)', color: '#F89880', padding: '0.9rem 1.2rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Email address</label>
                  <input
                    {...register("email")} type="email" placeholder="you@example.com"
                    style={{ ...inputBase, border: errors.email ? '1px solid rgba(255,95,31,0.6)' : `1px solid var(--ap-input-border)` }}
                    onFocus={inputFocus}
                    onBlur={e => inputBlur(e, !!errors.email)}
                  />
                  {errors.email && <p style={{ fontSize: '0.75rem', color: '#F89880', marginTop: '0.4rem' }}>{errors.email.message}</p>}
                </div>

                <div>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      {...register("password")} type={showPass ? "text" : "password"} placeholder="••••••••"
                      style={{ ...inputBase, padding: '1rem 3rem 1rem 1.2rem', border: errors.password ? '1px solid rgba(255,95,31,0.6)' : `1px solid var(--ap-input-border)` }}
                      onFocus={inputFocus}
                      onBlur={e => inputBlur(e, !!errors.password)}
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--ap-text-faint)', cursor: 'pointer', transition: 'color 0.3s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--ap-accent)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--ap-text-faint)')}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <p style={{ fontSize: '0.75rem', color: '#F89880', marginTop: '0.4rem' }}>{errors.password.message}</p>}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <Link href="/auth/forgot-password" style={{ fontFamily: "'Syncopate', sans-serif", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ap-text-muted)', textDecoration: 'none', transition: 'color 0.3s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--ap-accent)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ap-text-muted)')}>
                    Forgot password?
                  </Link>
                </div>

                <button type="submit" disabled={loading} style={{ width: '100%', background: '#FF5F1F', border: 'none', color: '#fff', fontFamily: "'Syncopate', sans-serif", fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', padding: '1.1rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 0 40px rgba(255,95,31,0.45)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : "Sign In"}
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '2rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--ap-divider)' }} />
                <span style={{ fontFamily: "'Syncopate', sans-serif", fontSize: '0.5rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--ap-text-faint)' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--ap-divider)' }} />
              </div>

              <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--ap-text-muted)' }}>
                Don't have an account?{" "}
                <Link href="/auth/register" style={{ color: '#F89880', textDecoration: 'none', fontWeight: 500, transition: 'color 0.3s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#FF5F1F')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#F89880')}>
                  Create one
                </Link>
              </p>
            </>
          )}

          {/* ══ STEP 2: OTP ══ */}
          {step === "otp" && (
            <>
              <div style={{ marginBottom: '2.5rem' }}>
                <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: '0.55rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--ap-accent)', marginBottom: '0.75rem', opacity: 0.9 }}>
                  Verification
                </p>
                <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', fontWeight: 300, color: 'var(--ap-text)', lineHeight: 1.1, marginBottom: '0.75rem' }}>
                  Check your email
                </h1>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', color: 'var(--ap-text-muted)', lineHeight: 1.6 }}>
                  We sent a 6-digit code to<br />
                  <span style={{ color: 'var(--ap-accent)' }}>{pendingEmail.current}</span>
                </p>
              </div>

              {attempts > 0 && !isLocked && (
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem' }}>
                  {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                    <div key={i} style={{ flex: 1, height: '3px', background: i < attempts ? 'rgba(255,95,31,0.8)' : 'var(--ap-divider)' }} />
                  ))}
                </div>
              )}

              {error && (
                <div style={{ background: isLocked ? 'rgba(255,0,0,0.08)' : 'rgba(255,95,31,0.08)', border: `1px solid ${isLocked ? 'rgba(255,0,0,0.3)' : 'rgba(255,95,31,0.3)'}`, color: '#F89880', padding: '0.9rem 1.2rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Verification code</label>
                  <input
                    type="text" inputMode="numeric" maxLength={6} placeholder="000000"
                    value={otp} disabled={isLocked}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                    style={{ ...inputBase, fontSize: '1.5rem', padding: '1rem 1.2rem', letterSpacing: '0.5em', textAlign: 'center', cursor: isLocked ? 'not-allowed' : 'text', opacity: isLocked ? 0.4 : 1 }}
                    onFocus={e => { if (!isLocked) e.currentTarget.style.borderColor = 'var(--ap-accent-glow)' }}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--ap-input-border)')}
                  />
                </div>

                <button onClick={onVerifyOtp} disabled={otpLoading || isLocked} style={{ width: '100%', background: isLocked ? 'rgba(255,95,31,0.3)' : '#FF5F1F', border: 'none', color: '#fff', fontFamily: "'Syncopate', sans-serif", fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', padding: '1.1rem', cursor: (otpLoading || isLocked) ? 'not-allowed' : 'pointer', opacity: (otpLoading || isLocked) ? 0.5 : 1, transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  onMouseEnter={e => { if (!otpLoading && !isLocked) e.currentTarget.style.boxShadow = '0 0 40px rgba(255,95,31,0.45)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}>
                  {otpLoading ? <Loader2 size={16} className="animate-spin" /> : isLocked ? `Locked — ${countdown}s` : "Verify & Continue"}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Syncopate', sans-serif", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ap-text-muted)', transition: 'color 0.3s', padding: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--ap-text)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ap-text-muted)')}>
                    ← Back
                  </button>
                  <button onClick={resendOtp} disabled={isLocked} style={{ background: 'none', border: 'none', cursor: isLocked ? 'not-allowed' : 'pointer', fontFamily: "'Syncopate', sans-serif", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: isLocked ? 'var(--ap-text-faint)' : 'var(--ap-text-muted)', transition: 'color 0.3s', padding: 0 }}
                    onMouseEnter={e => { if (!isLocked) e.currentTarget.style.color = 'var(--ap-accent)' }}
                    onMouseLeave={e => { if (!isLocked) e.currentTarget.style.color = 'var(--ap-text-muted)' }}>
                    Resend code
                  </button>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}