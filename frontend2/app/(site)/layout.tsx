"use client";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Navbar from "@/components/site/Navbar";
import ChatbotWidget from "@/components/site/chatbot/ChatbotWidget";
import OnboardingModal from "@/components/site/OnboardingModal";
import CustomCursor from "@/components/site/CustomCursor";
import dynamic from 'next/dynamic';
const IntroAnimation = dynamic(() => import('@/components/site/IntroAnimation'), { ssr: false });
import { useAuthStore } from "@/lib/authStore";
import api from "@/lib/api";

export default function SiteLayout({ children }: { children: ReactNode }) {
  const { user, fetchMe } = useAuthStore();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Restore session from cookie on every page load
  useEffect(() => { fetchMe(); }, []);

  // Only show the intro once per browser session — skip on subsequent navigations
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("lumina_intro_seen");
  });

  useEffect(() => {
    if (!user) return;
    api
      .get("/api/v1/users/me")
      .then((res) => {
        const data = res.data?.data ?? res.data;
        if (data && data.onboardingDone === false) {
          setShowOnboarding(true);
        }
      })
      .catch(() => {});
  }, [user]);

  const handleIntroComplete = () => {
    sessionStorage.setItem("lumina_intro_seen", "1");
    setShowIntro(false);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
      {/* Global grain texture */}
      <div className="grain-overlay" />

      {/* Custom cursor */}
      <CustomCursor />

      {/* Intro animation — shown once per session */}
      {showIntro && <IntroAnimation onComplete={handleIntroComplete} />}

      {/* Navbar — hidden during intro */}
      <div
        style={{
          opacity: showIntro ? 0 : 1,
          pointerEvents: showIntro ? "none" : "auto",
          transition: "opacity 0.5s ease",
        }}
      >
        <Navbar />
      </div>

      {/* Page content — hidden during intro */}
      <main
        className="flex-1"
        style={{
          opacity: showIntro ? 0 : 1,
          transition: "opacity 0.7s ease 0.2s",
        }}
      >
        {children}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "2rem",
          textAlign: "center",
          opacity: showIntro ? 0 : 1,
          transition: "opacity 0.7s ease",
        }}
      >
        <p
          style={{
            fontFamily: "'Syncopate', sans-serif",
            fontSize: "0.75rem",
            letterSpacing: "0.3em",
            color: "var(--text-muted)",
            marginBottom: "0.5rem",
          }}
        >
          LUM<span style={{ color: "var(--cyan)" }}>I</span>NA
        </p>
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          © 2026 Lumina Skincare. All rights reserved.
        </p>
      </footer>

      <ChatbotWidget />

      {showOnboarding && (
        <OnboardingModal onComplete={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}
