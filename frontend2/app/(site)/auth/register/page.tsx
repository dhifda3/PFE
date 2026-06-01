"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { authApi } from "@/lib/api";
import { useTheme } from "@/components/ui/ThemeContext";

const schema = z.object({
  name:     z.string().min(2, "Name must be at least 2 characters"),
  email:    z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type FormData = z.infer<typeof schema>;

/* ── Animated gradient orb component ──────────────────────────────────── */
function AnimatedGradientBG({ isDark }: { isDark: boolean }) {
  return (
    <>
      <style>{`
        @keyframes rg-orb1 {
          0%   { transform: translate(0%, 0%)   scale(1); }
          33%  { transform: translate(-9%, 11%) scale(1.12); }
          66%  { transform: translate(7%, -8%)  scale(0.92); }
          100% { transform: translate(0%, 0%)   scale(1); }
        }
        @keyframes rg-orb2 {
          0%   { transform: translate(0%, 0%)    scale(1); }
          33%  { transform: translate(10%, -10%) scale(1.18); }
          66%  { transform: translate(-6%, 8%)   scale(0.88); }
          100% { transform: translate(0%, 0%)    scale(1); }
        }
        @keyframes rg-orb3 {
          0%   { transform: translate(0%, 0%)   scale(1); }
          50%  { transform: translate(-11%, 6%) scale(1.1); }
          100% { transform: translate(0%, 0%)   scale(1); }
        }
        @keyframes rg-orb4 {
          0%   { transform: translate(0%, 0%)    scale(1); }
          40%  { transform: translate(8%, -9%)   scale(1.15); }
          80%  { transform: translate(-5%, 10%)  scale(0.9); }
          100% { transform: translate(0%, 0%)    scale(1); }
        }
      `}</style>

      {/* Orb 1 — orange, top-left (register uses amber side, so orbs flipped) */}
      <div style={{
        position: 'absolute', top: '-18%', left: '-18%',
        width: '70%', height: '70%',
        background: isDark
          ? 'radial-gradient(ellipse, rgba(255,95,31,0.22) 0%, rgba(255,140,0,0.10) 45%, transparent 70%)'
          : 'radial-gradient(ellipse, rgba(255,95,31,0.18) 0%, rgba(255,140,0,0.08) 45%, transparent 70%)',
        filter: 'blur(55px)',
        animation: 'rg-orb1 16s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* Orb 2 — cyan, bottom-right */}
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-20%',
        width: '72%', height: '72%',
        background: isDark
          ? 'radial-gradient(ellipse, rgba(0,255,255,0.18) 0%, rgba(0,180,220,0.08) 45%, transparent 70%)'
          : 'radial-gradient(ellipse, rgba(0,210,230,0.16) 0%, rgba(0,150,200,0.07) 45%, transparent 70%)',
        filter: 'blur(60px)',
        animation: 'rg-orb2 20s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* Orb 3 — amber accent, bottom-left */}
      <div style={{
        position: 'absolute', bottom: '8%', left: '-8%',
        width: '42%', height: '42%',
        background: isDark
          ? 'radial-gradient(ellipse, rgba(255,180,50,0.10) 0%, transparent 65%)'
          : 'radial-gradient(ellipse, rgba(255,160,30,0.09) 0%, transparent 65%)',
        filter: 'blur(45px)',
        animation: 'rg-orb3 24s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* Orb 4 — cyan accent, top-right */}
      <div style={{
        position: 'absolute', top: '12%', right: '-6%',
        width: '38%', height: '38%',
        background: isDark
          ? 'radial-gradient(ellipse, rgba(0,255,255,0.08) 0%, transparent 65%)'
          : 'radial-gradient(ellipse, rgba(0,200,220,0.07) 0%, transparent 65%)',
        filter: 'blur(40px)',
        animation: 'rg-orb4 19s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
    </>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError("");
    setLoading(true);
    try {
      await authApi.register(data);
      // Better-auth returns a session on sign-up — user is already logged in.
      router.push("/");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

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

      {/* ─── Left: Hero panel (amber) ─── */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: `url('/images/hero-amber-side.jpg') center/cover no-repeat`,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '4rem',
      }} className="hidden md:flex">
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(7,5,10,0.85) 0%, rgba(7,5,10,0.45) 50%, rgba(7,5,10,0.8) 100%)' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '20%', width: '350px', height: '350px', background: 'radial-gradient(circle, rgba(255,95,31,0.1) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: '0.85rem', letterSpacing: '0.3em', fontWeight: 700, color: '#fff' }}>
              LUM<span style={{ color: '#00FFFF' }}>I</span>NA
            </p>
          </Link>
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <blockquote style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem, 3.5vw, 3rem)', fontWeight: 300, fontStyle: 'italic', color: '#fff', lineHeight: 1.3, marginBottom: '1.5rem' }}>
            "Begin your<br />beauty journey."
          </blockquote>
          <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
            Personalized recommendations await.
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

      {/* ─── Right: Register form ─── */}
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

          <div style={{ marginBottom: '2.5rem' }}>
            <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: '0.55rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#FF5F1F', marginBottom: '0.75rem', opacity: 0.9 }}>
              Begin your ritual
            </p>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', fontWeight: 300, color: 'var(--ap-text)', lineHeight: 1.1 }}>
              Create account
            </h1>
          </div>

          {error && (
            <div style={{ background: 'rgba(255,95,31,0.08)', border: '1px solid rgba(255,95,31,0.3)', color: '#F89880', padding: '0.9rem 1.2rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Name */}
            <div>
              <label style={labelStyle}>Full name</label>
              <input
                {...register("name")} type="text" placeholder="Your name"
                style={{ ...inputBase, border: errors.name ? '1px solid rgba(255,95,31,0.6)' : `1px solid var(--ap-input-border)` }}
                onFocus={inputFocus}
                onBlur={e => inputBlur(e, !!errors.name)}
              />
              {errors.name && <p style={{ fontSize: '0.75rem', color: '#F89880', marginTop: '0.4rem' }}>{errors.name.message}</p>}
            </div>

            {/* Email */}
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

            {/* Password */}
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

            <button type="submit" disabled={loading} style={{ width: '100%', background: '#FF5F1F', border: 'none', color: '#fff', fontFamily: "'Syncopate', sans-serif", fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', padding: '1.1rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 0 40px rgba(255,95,31,0.45)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Create Account"}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '2rem 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--ap-divider)' }} />
            <span style={{ fontFamily: "'Syncopate', sans-serif", fontSize: '0.5rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--ap-text-faint)' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--ap-divider)' }} />
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--ap-text-muted)' }}>
            Already have an account?{" "}
            <Link href="/auth/login" style={{ color: '#F89880', textDecoration: 'none', fontWeight: 500, transition: 'color 0.3s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#FF5F1F')}
              onMouseLeave={e => (e.currentTarget.style.color = '#F89880')}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}