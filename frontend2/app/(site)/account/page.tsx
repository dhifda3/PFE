"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { usersApi, ordersApi, wishlistApi } from "@/lib/api";
import {
  User as UserIcon,
  Mail,
  Calendar,
  Sparkles,
  Heart,
  ShoppingBag,
  Edit2,
  Check,
  X,
  Loader2,
  LogOut,
  AlertCircle,
} from "lucide-react";

/* ─── option lists (mirror OnboardingModal) ──────────────────────────── */
const SKIN_TYPES = [
  { value: "oily",        label: "Oily",        hint: "Shiny by midday" },
  { value: "dry",         label: "Dry",         hint: "Tight, flaky" },
  { value: "combination", label: "Combination", hint: "Oily T-zone, dry cheeks" },
  { value: "sensitive",   label: "Sensitive",   hint: "Reacts easily" },
  { value: "normal",      label: "Normal",      hint: "Balanced" },
];
const HAIR_TYPES = [
  { value: "dry",     label: "Dry",     hint: "Frizzy, brittle" },
  { value: "oily",    label: "Oily",    hint: "Greasy fast" },
  { value: "curly",   label: "Curly",   hint: "Coily or wavy" },
  { value: "fine",    label: "Fine",    hint: "Thin, flat" },
  { value: "normal",  label: "Normal",  hint: "Easy to manage" },
];
const CONCERNS = [
  { value: "acne",              label: "Acne" },
  { value: "aging",             label: "Aging" },
  { value: "dullness",          label: "Dullness" },
  { value: "hyperpigmentation", label: "Dark spots" },
  { value: "dehydration",       label: "Dehydration" },
  { value: "redness",           label: "Redness" },
];
const DISCOVERY = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok",    label: "TikTok"    },
  { value: "friend",    label: "A friend"  },
  { value: "search",    label: "Search engine" },
  { value: "ad",        label: "An ad"     },
  { value: "other",     label: "Other"     },
];

interface UserProfile {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string;
  skinType?: string | null;
  hairType?: string | null;
  skinConcerns?: string | null;
  discoverySource?: string | null;
  createdAt?: string;
}

interface OrderRow {
  id: string;
  status: string;
  totalAmount: number | string;
  createdAt: string;
  items?: any[];
}

interface WishlistRow {
  productId?: string;
  productName?: string;
  price?: number | string;
  productImage?: string;
}

const ORDER_COLORS: Record<string, string> = {
  PENDING:    "var(--amber)",
  CONFIRMED:  "var(--cyan)",
  ON_THE_WAY: "var(--cyan)",
  DELIVERED:  "#00FFAA",
  CANCELLED:  "rgba(255,80,80,0.85)",
};

function initials(name?: string) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtMoney(v: number | string | undefined) {
  if (v == null) return "0";
  return `${Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 })} TND`;
}

/* ─── page ──────────────────────────────────────────────────────────── */

export default function AccountPage() {
  const router = useRouter();
  const { user: authUser, logout, fetchMe } = useAuthStore();

  const [profile,  setProfile]  = useState<UserProfile | null>(null);
  const [orders,   setOrders]   = useState<OrderRow[]>([]);
  const [wishlist, setWishlist] = useState<WishlistRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");

  /* edit modes */
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingSkincare, setEditingSkincare] = useState(false);

  /* form state */
  const [nameDraft,        setNameDraft]        = useState("");
  const [skinTypeDraft,    setSkinTypeDraft]    = useState<string | null>(null);
  const [hairTypeDraft,    setHairTypeDraft]    = useState<string | null>(null);
  const [concernsDraft,    setConcernsDraft]    = useState<string[]>([]);
  const [discoveryDraft,   setDiscoveryDraft]   = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /* ─── fetch all data once authorized ─────────────────────────────── */
  useEffect(() => {
    if (authUser === null) {
      // not logged in
      router.push("/auth/login?redirect=/account");
      return;
    }
    if (authUser === undefined) return; // still loading

    let cancelled = false;

    (async () => {
      try {
        const [meRes, ordersRes, wishRes] = await Promise.allSettled([
          usersApi.me(),
          ordersApi.getAll(),
          wishlistApi.get(),
        ]);

        if (cancelled) return;

        if (meRes.status === "fulfilled") {
          const data = meRes.value.data?.data ?? meRes.value.data;
          setProfile(data);
          setNameDraft(data.name ?? "");
          setSkinTypeDraft(data.skinType ?? null);
          setHairTypeDraft(data.hairType ?? null);
          setConcernsDraft(
            (data.skinConcerns ?? "")
              .split(",")
              .map((c: string) => c.trim())
              .filter(Boolean)
          );
          setDiscoveryDraft(data.discoverySource ?? null);
        } else {
          setErr("Could not load your profile.");
        }

        if (ordersRes.status === "fulfilled") {
          const data = ordersRes.value.data?.data ?? ordersRes.value.data ?? [];
          setOrders(Array.isArray(data) ? data.slice(0, 4) : []);
        }

        if (wishRes.status === "fulfilled") {
          const data = wishRes.value.data?.data ?? wishRes.value.data ?? [];
          const items = Array.isArray(data) ? data : data?.items ?? [];
          setWishlist(items.slice(0, 4));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [authUser, router]);

  /* ─── save handlers ───────────────────────────────────────────── */
  const savePersonal = async () => {
    if (!nameDraft.trim()) { setErr("Name can't be empty."); return; }
    setSaving(true); setErr("");
    try {
      const res = await usersApi.updateMe({ name: nameDraft.trim() });
      const data = res.data?.data ?? res.data;
      setProfile((p) => p ? { ...p, ...data } : data);
      setEditingPersonal(false);
      fetchMe();
    } catch {
      setErr("Could not save your name. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveSkincare = async () => {
    setSaving(true); setErr("");
    try {
      const res = await usersApi.updateMe({
        skinType:        skinTypeDraft ?? "",
        hairType:        hairTypeDraft ?? "",
        skinConcerns:    concernsDraft.join(","),
        discoverySource: discoveryDraft ?? "",
      });
      const data = res.data?.data ?? res.data;
      setProfile((p) => p ? { ...p, ...data } : data);
      setEditingSkincare(false);
    } catch {
      setErr("Could not save your preferences. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const cancelPersonal = () => {
    setNameDraft(profile?.name ?? "");
    setErr("");
    setEditingPersonal(false);
  };
  const cancelSkincare = () => {
    setSkinTypeDraft(profile?.skinType ?? null);
    setHairTypeDraft(profile?.hairType ?? null);
    setConcernsDraft((profile?.skinConcerns ?? "").split(",").map((c) => c.trim()).filter(Boolean));
    setDiscoveryDraft(profile?.discoverySource ?? null);
    setErr("");
    setEditingSkincare(false);
  };

  const toggleConcern = (v: string) => {
    setConcernsDraft((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v]);
  };

  /* ─── derived UI bits ──────────────────────────────────────────── */
  const personalLocked = useMemo(() => !editingPersonal, [editingPersonal]);
  const skincareLocked = useMemo(() => !editingSkincare, [editingSkincare]);

  /* ─── style tokens ─────────────────────────────────────────────── */
  const card: React.CSSProperties = {
    background:    "var(--bg-card)",
    border:        "1px solid var(--border)",
    borderRadius:  "var(--radius-md, 6px)",
    padding:       "1.75rem",
  };
  const cardHeader: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: "1.25rem",
  };
  const sectionTitle: React.CSSProperties = {
    fontFamily: "'Syncopate', sans-serif",
    fontSize: "0.55rem", letterSpacing: "0.3em", textTransform: "uppercase",
    color: "var(--text-muted)",
  };
  const fieldLabel: React.CSSProperties = {
    fontFamily: "'Syncopate', sans-serif",
    fontSize: "0.45rem", letterSpacing: "0.25em", textTransform: "uppercase",
    color: "var(--text-faint)",
    marginBottom: "0.4rem",
  };
  const fieldValue: React.CSSProperties = {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.95rem",
    color: "var(--text-primary)",
  };
  const chip = (active: boolean): React.CSSProperties => ({
    display: "inline-block",
    padding: "0.5rem 0.9rem",
    border: `1px solid ${active ? "var(--cyan)" : "var(--border)"}`,
    background: active ? "rgba(0,255,255,0.08)" : "transparent",
    color: active ? "var(--cyan)" : "var(--text-primary)",
    fontFamily: "'Syncopate', sans-serif",
    fontSize: "0.55rem", letterSpacing: "0.2em", textTransform: "uppercase",
    cursor: "pointer",
    transition: "all 0.15s",
    userSelect: "none",
    minWidth: 100,
    textAlign: "center" as const,
  });
  const inputCss: React.CSSProperties = {
    width: "100%",
    background: "var(--input-bg, var(--bg-card))",
    border: "1px solid var(--input-border, var(--border))",
    color: "var(--text-primary)",
    padding: "0.7rem 0.9rem",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.9rem",
    outline: "none",
  };
  const btnPrimary: React.CSSProperties = {
    background: "var(--amber, #FF5F1F)",
    border: "none",
    color: "#fff",
    fontFamily: "'Syncopate', sans-serif",
    fontSize: "0.55rem", letterSpacing: "0.22em", textTransform: "uppercase",
    padding: "0.65rem 1.2rem", cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: "0.4rem",
  };
  const btnGhost: React.CSSProperties = {
    background: "transparent",
    border: "1px solid var(--border)",
    color: "var(--text-muted)",
    fontFamily: "'Syncopate', sans-serif",
    fontSize: "0.55rem", letterSpacing: "0.22em", textTransform: "uppercase",
    padding: "0.65rem 1.2rem", cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: "0.4rem",
  };

  /* ─── render ───────────────────────────────────────────────────── */

  if (loading || !profile) {
    return (
      <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--amber)" }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "6rem 1.5rem 5rem" }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "3rem" }}>
        <div style={{
          width: 78, height: 78,
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--amber), var(--cyan))",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "2.1rem", color: "#fff", fontWeight: 600,
          }}>
            {initials(profile.name)}
          </span>
        </div>
        <div>
          <p style={{
            fontFamily: "'Syncopate', sans-serif",
            fontSize: "0.5rem", letterSpacing: "0.3em",
            textTransform: "uppercase", color: "var(--amber)",
            marginBottom: "0.4rem",
          }}>
            My Account
          </p>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "2.6rem", fontWeight: 300,
            color: "var(--text-primary)", lineHeight: 1.1,
          }}>
            {profile.name}
          </h1>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem",
          }}>
            {profile.email} · member since {fmtDate(profile.createdAt)}
          </p>
        </div>
      </div>

      {err && (
        <div style={{
          background: "rgba(255,80,80,0.08)",
          border: "1px solid rgba(255,80,80,0.3)",
          color: "#F89880",
          padding: "0.85rem 1.2rem",
          fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem",
          display: "flex", alignItems: "center", gap: "0.6rem",
          marginBottom: "1.5rem",
        }}>
          <AlertCircle size={16} /> {err}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }} className="account-grid">

        {/* ───────────────── Personal info ───────────────── */}
        <section style={card}>
          <div style={cardHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <UserIcon size={14} color="var(--amber)" />
              <p style={sectionTitle}>Personal info</p>
            </div>
            {personalLocked ? (
              <button onClick={() => setEditingPersonal(true)} style={btnGhost} title="Edit">
                <Edit2 size={11} /> Edit
              </button>
            ) : (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={cancelPersonal} style={btnGhost} disabled={saving}>
                  <X size={11} /> Cancel
                </button>
                <button onClick={savePersonal} style={btnPrimary} disabled={saving}>
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  Save
                </button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            <div>
              <p style={fieldLabel}>Name</p>
              {personalLocked
                ? <p style={fieldValue}>{profile.name}</p>
                : <input style={inputCss} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
              }
            </div>
            <div>
              <p style={fieldLabel}>Email</p>
              <p style={{ ...fieldValue, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Mail size={13} color="var(--text-muted)" />
                {profile.email}
                <span style={{
                  fontFamily: "'Syncopate', sans-serif",
                  fontSize: "0.4rem", letterSpacing: "0.2em",
                  color: "var(--text-faint)", marginLeft: "0.5rem",
                }}>
                  locked
                </span>
              </p>
            </div>
            <div>
              <p style={fieldLabel}>Member since</p>
              <p style={{ ...fieldValue, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Calendar size={13} color="var(--text-muted)" />
                {fmtDate(profile.createdAt)}
              </p>
            </div>
          </div>
        </section>

        {/* ───────────────── Skincare profile ───────────────── */}
        <section style={card}>
          <div style={cardHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Sparkles size={14} color="var(--cyan)" />
              <p style={sectionTitle}>Skincare profile</p>
            </div>
            {skincareLocked ? (
              <button onClick={() => setEditingSkincare(true)} style={btnGhost}>
                <Edit2 size={11} /> Edit
              </button>
            ) : (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={cancelSkincare} style={btnGhost} disabled={saving}>
                  <X size={11} /> Cancel
                </button>
                <button onClick={saveSkincare} style={btnPrimary} disabled={saving}>
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  Save
                </button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>

            {/* Skin type */}
            <div>
              <p style={fieldLabel}>Skin type</p>
              {skincareLocked ? (
                <p style={fieldValue}>
                  {SKIN_TYPES.find((s) => s.value === profile.skinType)?.label ?? <em style={{ color: "var(--text-faint)" }}>Not set</em>}
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {SKIN_TYPES.map((o) => (
                    <span key={o.value}
                      onClick={() => setSkinTypeDraft(o.value)}
                      style={chip(skinTypeDraft === o.value)}>
                      {o.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Hair type */}
            <div>
              <p style={fieldLabel}>Hair type</p>
              {skincareLocked ? (
                <p style={fieldValue}>
                  {HAIR_TYPES.find((h) => h.value === profile.hairType)?.label ?? <em style={{ color: "var(--text-faint)" }}>Not set</em>}
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {HAIR_TYPES.map((o) => (
                    <span key={o.value}
                      onClick={() => setHairTypeDraft(o.value)}
                      style={chip(hairTypeDraft === o.value)}>
                      {o.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Concerns */}
            <div>
              <p style={fieldLabel}>Skin concerns</p>
              {skincareLocked ? (
                <p style={fieldValue}>
                  {(profile.skinConcerns ?? "")
                    .split(",")
                    .map((c) => c.trim())
                    .filter(Boolean)
                    .map((c) => CONCERNS.find((x) => x.value === c)?.label ?? c)
                    .join(", ") || <em style={{ color: "var(--text-faint)" }}>None set</em>}
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {CONCERNS.map((o) => (
                    <span key={o.value}
                      onClick={() => toggleConcern(o.value)}
                      style={chip(concernsDraft.includes(o.value))}>
                      {o.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Discovery */}
            <div>
              <p style={fieldLabel}>How you found us</p>
              {skincareLocked ? (
                <p style={fieldValue}>
                  {DISCOVERY.find((d) => d.value === profile.discoverySource)?.label ?? <em style={{ color: "var(--text-faint)" }}>Not set</em>}
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {DISCOVERY.map((o) => (
                    <span key={o.value}
                      onClick={() => setDiscoveryDraft(o.value)}
                      style={chip(discoveryDraft === o.value)}>
                      {o.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ───────────────── Orders ───────────────── */}
        <section style={card}>
          <div style={cardHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <ShoppingBag size={14} color="var(--amber)" />
              <p style={sectionTitle}>Recent orders</p>
            </div>
            <Link href="/orders" style={{
              ...btnGhost, textDecoration: "none",
            }}>
              See all
            </Link>
          </div>

          {orders.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem" }}>
              No orders yet. <Link href="/" style={{ color: "var(--amber)", textDecoration: "none" }}>Start shopping →</Link>
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {orders.map((o) => {
                const itemCount = Array.isArray(o.items) ? o.items.length : 0;
                return (
                  <Link key={o.id} href={`/orders`} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.85rem 1rem",
                    border: "1px solid var(--border)",
                    borderRadius: 3,
                    textDecoration: "none",
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <span style={{
                        fontFamily: "'Syncopate', sans-serif",
                        fontSize: "0.55rem", letterSpacing: "0.2em", textTransform: "uppercase",
                        color: ORDER_COLORS[o.status] ?? "var(--text-muted)",
                      }}>
                        {o.status}
                      </span>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", color: "var(--text-primary)" }}>
                        {itemCount} item{itemCount === 1 ? "" : "s"} · {fmtDate(o.createdAt)}
                      </span>
                    </div>
                    <span style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: "1.2rem", color: "var(--text-primary)",
                    }}>
                      {fmtMoney(o.totalAmount)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ───────────────── Wishlist + Quick links ───────────────── */}
        <section style={card}>
          <div style={cardHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Heart size={14} color="#e05c7a" />
              <p style={sectionTitle}>Wishlist</p>
            </div>
            <Link href="/wishlist" style={{ ...btnGhost, textDecoration: "none" }}>
              See all
            </Link>
          </div>

          {wishlist.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", marginBottom: "1.2rem" }}>
              Nothing saved yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1.2rem" }}>
              {wishlist.map((w, i) => (
                <Link
                  key={(w.productId ?? i) + ""}
                  href={w.productId ? `/products/${w.productId}` : "/wishlist"}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.6rem 0.85rem",
                    border: "1px solid var(--border)",
                    borderRadius: 3,
                    textDecoration: "none",
                  }}>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", color: "var(--text-primary)" }}>
                    {w.productName ?? "Saved item"}
                  </span>
                  {w.price != null && (
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.05rem", color: "var(--text-muted)" }}>
                      {fmtMoney(w.price)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}

          <div style={{
            display: "flex", flexDirection: "column", gap: "0.5rem",
            paddingTop: "1rem", borderTop: "1px solid var(--border)",
          }}>
            <button
              onClick={async () => { await logout(); router.push("/"); }}
              style={{
                ...btnGhost,
                width: "100%",
                justifyContent: "center",
                color: "rgba(255,80,80,0.85)",
                borderColor: "rgba(255,80,80,0.3)",
              }}
            >
              <LogOut size={11} /> Sign out
            </button>
          </div>
        </section>

      </div>

      <style jsx>{`
        @media (max-width: 760px) {
          :global(.account-grid) { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
