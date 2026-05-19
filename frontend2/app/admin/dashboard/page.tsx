"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { MessageSquare, Users, ThumbsDown, AlertTriangle, ShieldAlert, Activity, ArrowRight, Info } from "lucide-react";
import { useD } from "@/components/admin/AdminTokensContext";

interface MiniHealth {
  totalConversations: number; uniqueUsers: number; anonSessions: number;
  negativeFeedbackRate: number; hallucinationRate: number; avgConfidence: number;
}

const GUIDE_CARDS = [
  { icon: ShieldAlert, title: "Suspicious messages",  color: "rgba(255,80,80,0.85)",
    body: "Flagged automatically when a user message matches known injection patterns: XSS (<script, javascript:), SQL injection (SELECT, UNION, DROP), path traversal (../), or system file probes (etc/passwd). A single flag is not always an attack — context and repetition matter." },
  { icon: Users,       title: "Anonymous visitors",    color: "#00FFFF",
    body: "Users who chat without an account. Identified by a random session ID saved in their browser's localStorage. Clearing the browser or using private mode creates a new anonymous identity — they cannot be linked to orders or profiles." },
  { icon: Activity,    title: "Confidence score",      color: "#FFD700",
    body: "How well-grounded the bot's reply is in the product catalogue returned by the RAG pipeline. ≥ 80 % = high, 60–79 % = medium, < 60 % = low (review for hallucinations). Defaults to 50 % when not set by the model." },
  { icon: AlertTriangle, title: "Hallucination estimate", color: "#FF5F1F",
    body: "Estimated as: low confidence (< 70 %) AND a negative thumbs-down on the same message. It is a heuristic — not every low-confidence reply is wrong, and not every wrong reply receives feedback. Use it as a triage signal, not a hard metric." },
  { icon: Info,        title: "Admin markers",         color: "#FF5F1F",
    body: "In the Chat Monitor, hover any message and click the flag icon to annotate it with a colour (Critical / Review / Noted) and an optional note. Markers are stored in your browser only — private to your session, not saved to the database." },
];

function StatPill({ l, value, warn }: { l: string; value: string | number; warn?: boolean }) {
  const D = useD();
  return (
    <div style={{ background:D.panel, border:`1px solid ${warn?"rgba(255,80,80,0.3)":D.border}`, borderRadius:4, padding:"1rem 1.25rem", display:"flex", flexDirection:"column", gap:"0.4rem" }}>
      <span style={{ fontFamily:D.mono, fontSize:"1.5rem", fontWeight:700, color:warn?D.red:D.orange, lineHeight:1 }}>{value}</span>
      <span style={{ fontFamily:D.font, fontSize:"0.7rem", letterSpacing:"0.18em", textTransform:"uppercase" as const, color:D.dim }}>{l}</span>
    </div>
  );
}

export default function AdminDashboardPage() {
  const D = useD();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [health, setHealth]         = useState<MiniHealth | null>(null);

  useEffect(() => {
    api.get("/api/admin/ping")
      .then(() => { setAuthorized(true); return api.get("/api/admin/chat/health"); })
      .then(r => setHealth(r.data.data))
      .catch(() => router.push("/auth/login"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color:D.dim, fontFamily:D.font, fontSize:"0.5rem", letterSpacing:"0.3em" }}>Checking permissions…</div>;
  if (!authorized) return null;

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ marginBottom:"2.5rem" }}>
        <p style={{ fontFamily:D.font, fontSize:"1.1rem", letterSpacing:"0.25em", fontWeight:700, color:D.text, marginBottom:"0.4rem" }}>Admin Dashboard</p>
        <p style={{ fontFamily:D.font, fontSize:"0.72rem", letterSpacing:"0.18em", color:D.dim }}>Welcome. Use the sidebar to manage users, products, and monitor the chatbot.</p>
      </div>

      <section style={{ marginBottom:"2.5rem" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.6rem" }}>
            <MessageSquare size={14} color={D.orange} />
            <span style={{ fontFamily:D.font, fontSize:"0.78rem", letterSpacing:"0.15em", color:D.muted }}>Chatbot · last 24h</span>
            <span style={{ width:6, height:6, borderRadius:"50%", background:D.green, boxShadow:`0 0 6px ${D.green}`, display:"inline-block" }} />
          </div>
          <Link href="/admin/chat" style={{ display:"flex", alignItems:"center", gap:"0.3rem", fontFamily:D.font, fontSize:"0.7rem", letterSpacing:"0.15em", color:D.orange, textDecoration:"none" }}>
            Full monitor <ArrowRight size={10} />
          </Link>
        </div>
        {health ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"0.75rem" }}>
            <StatPill l="Conversations"    value={health.totalConversations} />
            <StatPill l="Unique chatters"  value={health.uniqueUsers} />
            <StatPill l="Anonymous"        value={health.anonSessions} />
            <StatPill l="Avg confidence"   value={`${(health.avgConfidence*100).toFixed(0)}%`} warn={health.avgConfidence<0.6} />
            <StatPill l="Negative feedback" value={`${health.negativeFeedbackRate.toFixed(1)}%`} warn={health.negativeFeedbackRate>20} />
          </div>
        ) : (
          <p style={{ fontFamily:D.font, fontSize:"0.7rem", letterSpacing:"0.15em", color:D.dim }}>Loading health data…</p>
        )}
      </section>

      <section>
        <div style={{ display:"flex", alignItems:"center", gap:"0.6rem", marginBottom:"1.25rem" }}>
          <Info size={13} color={D.dim} />
          <span style={{ fontFamily:D.font, fontSize:"0.7rem", letterSpacing:"0.15em", color:D.muted }}>How to read the monitor</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" }}>
          {GUIDE_CARDS.map(g => (
            <div key={g.title} style={{ background:D.panel, border:`1px solid ${D.border}`, borderRadius:4, padding:"1.25rem" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"0.6rem", marginBottom:"0.75rem" }}>
                <g.icon size={13} color={g.color} />
                <span style={{ fontFamily:D.font, fontSize:"0.7rem", letterSpacing:"0.15em", color:D.text }}>{g.title}</span>
              </div>
              <p style={{ fontSize:"0.78rem", color:D.muted, lineHeight:1.65, margin:0 }}>{g.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
