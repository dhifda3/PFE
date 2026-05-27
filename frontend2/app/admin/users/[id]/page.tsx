"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { useD } from "@/components/admin/AdminTokensContext";
import {
  ArrowLeft, Crown, Shield, User, CheckCircle2, Clock, Star,
  ShoppingBag, Package, XCircle, ChevronDown, ChevronUp,
  Mail, Calendar, Hash, MapPin, Loader2, TrendingUp, TrendingDown,
} from "lucide-react";

/* -- Types --------------------------------------------------------------- */
interface UserDetail {
  id: string; name: string; email: string; role: string;
  emailVerified: boolean; createdAt: string; banned?: boolean;
}
interface OrderItem { id?: string; productName?: string; name?: string; quantity: number; price: number; }
interface Order {
  id: string; status: string; totalAmount: number;
  createdAt: string; items?: OrderItem[];
}
interface Review {
  id: string; rating: number; comment?: string;
  createdAt: string; isApproved: boolean;
  product?: { id: string; name: string | null } | null;
}
interface Address {
  id: string; streetAddress: string; isDefault: boolean;
}

/* -- Helpers ----------------------------------------------------------- */
function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}
function getAccent(role: string) {
  if (role === "admin") return "#aa7305";
  return "#066969";
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtCurrency(n: number) {
  return `${Number(n).toFixed(2)} DT`;
}

const STATUS: Record<string, { color: string; bg: string; label: string }> = {
  pending:     { color: "#be7f00", bg: "rgba(255,170,0,0.1)",    label: "Pending"    },
  confirmed:   { color: "#0e3b52", bg: "rgba(0,170,255,0.08)",   label: "Confirmed"  },
  on_the_way:  { color: "#004353", bg: "rgba(0,200,255,0.08)",   label: "On the way" },
  processing:  { color: "#0c415c", bg: "rgba(0,170,255,0.08)",   label: "Processing" },
  shipped:     { color: "#00AA88", bg: "rgba(0,170,136,0.12)",   label: "Shipped"    },
  delivered:   { color: "#00532e", bg: "rgba(0,187,102,0.12)",   label: "Delivered"  },
  cancelled:   { color: "#FF5050", bg: "rgba(255,80,80,0.08)",   label: "Cancelled"  },
  refunded:    { color: "#CC88FF", bg: "rgba(204,136,255,0.08)", label: "Refunded"   },
};

/* -- Sub-components ---------------------------------------------------- */
function SectionHeader({ label, count, D }: { label: string; count?: number; D: any }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
      <div style={{ width: "18px", height: "1px", background: D.orange }} />
      <p style={{ fontFamily: D.font, fontSize: "0.65rem", letterSpacing: "0.3em", textTransform: "uppercase" as const, color: D.orange, opacity: 0.75 }}>
        {label}
      </p>
      {count !== undefined && (
        <span style={{ fontFamily: D.font, fontSize: "0.6rem", color: D.dim, background: D.panelB, border: `1px solid ${D.border}`, padding: "0.1rem 0.45rem" }}>
          {count}
        </span>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color, D }: { label: string; value: string | number; sub?: string; color: string; D: any }) {
  return (
    <div style={{ background: D.panelB, border: `1px solid ${D.border}`, padding: "1.25rem 1.5rem", flex: 1 }}>
      <p style={{ fontFamily: D.font, fontSize: "1.5rem", fontWeight: 700, color, lineHeight: 1, marginBottom: "0.4rem" }}>{value}</p>
      <p style={{ fontFamily: D.font, fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase" as const, color: D.dim }}>{label}</p>
      {sub && <p style={{ fontFamily: D.mono, fontSize: "0.62rem", color: `${color}99`, marginTop: "0.35rem" }}>{sub}</p>}
    </div>
  );
}

function StarDisplay({ value, size = 11 }: { value: number; size?: number }) {
  return (
    <div style={{ display: "flex", gap: "2px" }}>
      {[1,2,3,4,5].map((s) => (
        <Star key={s} size={size} style={{
          fill:  s <= value ? "#FF5F1F" : "transparent",
          color: s <= value ? "#FF5F1F" : "rgba(128,128,128,0.4)",
          flexShrink: 0,
        }} />
      ))}
    </div>
  );
}

function OrderRow({ order, D }: { order: Order; D: any }) {
  const [open, setOpen] = useState(false);
  const key = order.status?.toLowerCase().replace(/ /g, "_");
  const st  = STATUS[key] ?? { color: D.dim, bg: D.panelB, label: order.status };
  const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];

  return (
    <div style={{ border: `1px solid ${D.border}`, marginBottom: "1px", background: D.panelB }}>
      <button onClick={() => setOpen((p) => !p)}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", color: D.text, flexWrap: "wrap" as const }}>
        <Package size={13} style={{ color: st.color, flexShrink: 0 }} />
        <span style={{ fontFamily: D.mono, fontSize: "0.68rem", color: D.dim, flexShrink: 0 }}>
          #{order.id.slice(0, 10).toUpperCase()}
        </span>
        <span style={{ fontFamily: D.font, fontSize: "0.6rem", letterSpacing: "0.1em", background: st.bg, color: st.color, border: `1px solid ${st.color}44`, padding: "0.2rem 0.55rem", textTransform: "uppercase" as const, flexShrink: 0 }}>
          {st.label}
        </span>
        <span style={{ fontFamily: D.font, fontSize: "0.72rem", color: D.text, marginLeft: "auto", flexShrink: 0 }}>
          {fmtCurrency(order.totalAmount)}
        </span>
        <span style={{ fontFamily: D.mono, fontSize: "0.62rem", color: D.dim, flexShrink: 0 }}>
          {fmtDate(order.createdAt)}
        </span>
        {items.length > 0 && (open ? <ChevronUp size={12} color={D.dim} /> : <ChevronDown size={12} color={D.dim} />)}
      </button>

      {open && items.length > 0 && (
        <div style={{ borderTop: `1px solid ${D.border}`, padding: "0.75rem 1.25rem 1rem" }}>
          {items.map((item, i) => (
            <div key={item.id ?? i} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: `1px solid ${D.border}22` }}>
              <span style={{ fontFamily: D.font, fontSize: "0.7rem", color: D.dim }}>
                {item.productName ?? item.name ?? "Product"}
              </span>
              <span style={{ fontFamily: D.mono, fontSize: "0.68rem", color: D.text }}>
                ?{item.quantity} ? {fmtCurrency(item.price)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -- Promote / demote button ------------------------------------------- */
function RoleButton({ userId, currentRole, isSuperAdmin, D, onRoleChange, targetName }: {
  userId: string; currentRole: string; isSuperAdmin: boolean;
  D: any; onRoleChange: (role: string) => void; targetName: string;
}) {
  const [busy, setBusy]       = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped]     = useState("");
  const [hovered, setHovered] = useState(false);

 if (!isSuperAdmin || currentRole === "admin") return null;

  const isUser  = currentRole === "user";
  const action  = isUser ? "Promote to Admin" : "Demote to User";
  const newRole = isUser ? "admin" : "user";
  const color   = isUser ? "#FFAA00" : "rgba(255,80,80,0.85)";
  const Icon    = isUser ? TrendingUp : TrendingDown;
  const match   = typed.trim().toLowerCase() === targetName.trim().toLowerCase();

  const execute = async () => {
    if (!match) return;
    setBusy(true);
    try {
      await api.patch(`/api/admin/users/${userId}/role`, { role: newRole });
      onRoleChange(newRole);
      setConfirm(false);
      setTyped("");
    } finally {
      setBusy(false);
    }
  };

  if (!confirm) return (
    <button
      onClick={() => setConfirm(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: "0.4rem",
        background: hovered ? `${color}18` : "none",
        border: `1px solid ${hovered ? color : D.border}`,
        cursor: "pointer", padding: "0.4rem 0.85rem",
        color: hovered ? color : D.dim,
        fontFamily: D.font, fontSize: "0.65rem",
        letterSpacing: "0.12em", textTransform: "uppercase" as const,
        transition: "all 0.15s",
      }}>
      <Icon size={11} /> {action}
    </button>
  );

  return (
    <div style={{ background: `${color}10`, border: `1px solid ${color}44`, padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "360px" }}>
      <p style={{ fontFamily: D.font, fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, color, margin: 0 }}>
        Type <strong style={{ color: D.text }}>{targetName}</strong> to confirm {action.toLowerCase()}
      </p>
      <input
        value={typed}
        onChange={e => setTyped(e.target.value)}
        placeholder={targetName}
        autoFocus
        style={{
          background: D.bg, border: `1px solid ${match ? color : D.border}`,
          padding: "0.45rem 0.75rem", color: D.text,
          fontFamily: D.mono, fontSize: "0.72rem",
          outline: "none", transition: "border 0.15s",
        }}
      />
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={execute} disabled={!match || busy}
          style={{
            background: match ? color : `${color}44`, border: "none",
            cursor: match && !busy ? "pointer" : "not-allowed",
            padding: "0.35rem 0.85rem", color: "#000",
            fontFamily: D.font, fontSize: "0.6rem",
            letterSpacing: "0.12em", textTransform: "uppercase" as const,
            display: "flex", alignItems: "center", gap: "0.35rem",
            opacity: busy ? 0.6 : 1, transition: "background 0.15s",
          }}>
          {busy && <Loader2 size={10} style={{ animation: "spin 0.8s linear infinite" }} />}
          Confirm
        </button>
        <button onClick={() => { setConfirm(false); setTyped(""); }}
          style={{ background: "none", border: `1px solid ${D.border}`, cursor: "pointer", padding: "0.35rem 0.85rem", color: D.dim, fontFamily: D.font, fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase" as const }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* -- Main page --------------------------------------------------------- */
export default function AdminUserDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const D       = useD();

  const [user, setUser]           = useState<UserDetail | null>(null);
  const [orders, setOrders]       = useState<Order[]>([]);
  const [reviews, setReviews]     = useState<Review[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [myRole, setMyRole]       = useState("");
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.allSettled([
      api.get("/api/admin/users"),
      api.get(`/api/admin/orders?userId=${id}`),
      api.get(`/api/admin/users/${id}/reviews`),
      api.get(`/api/v1/users/me`),
      api.get(`/api/admin/users/${id}/addresses`).catch(() => ({ data: { data: [] } })),
    ]).then(([usersRes, ordersRes, reviewsRes, meRes, addrRes]) => {
      // -- Current user (for permission check)
      if (meRes.status === "fulfilled") {
        const d = meRes.value.data;
        const role = d?.data?.role ?? d?.role ?? "";
        setMyRole(role);
      }
      // -- Target user
      if (usersRes.status === "fulfilled") {
        const all: UserDetail[] = usersRes.value.data?.data ?? [];
        const found = all.find((u) => u.id === id);
        found ? setUser(found) : setError("User not found");
      } else {
        setError("Could not load user");
      }
      // -- Orders
      if (ordersRes.status === "fulfilled") {
        const raw = ordersRes.value.data?.data ?? [];
        setOrders(Array.isArray(raw) ? raw : []);
      }
      // -- Reviews
      if (reviewsRes.status === "fulfilled") {
        const raw = reviewsRes.value.data?.data ?? [];
        setReviews(Array.isArray(raw) ? raw : []);
      } else {
        console.error("[reviews failed]", reviewsRes.reason);
      }
      // -- Addresses
      if (addrRes.status === "fulfilled") {
        const raw = addrRes.value.data?.data ?? [];
        setAddresses(Array.isArray(raw) ? raw : []);
      }
    }).finally(() => setLoading(false));
  }, [id]);

  /* -- Derived -- */
  const totalSpent = orders.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);
  const avgRating  = reviews.length
    ? reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length
    : null;
  const accent     = user ? getAccent(user.role) : D.orange;
  const canManageRoles = myRole  === "admin";

  /* -- Loading -- */
  if (loading) return (
    <div style={{ minHeight: "100vh", background: D.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: "center" }}>
        <Loader2 size={24} style={{ color: D.orange, animation: "spin 0.9s linear infinite", margin: "0 auto 1rem" }} />
        <p style={{ fontFamily: D.font, fontSize: "0.6rem", letterSpacing: "0.3em", textTransform: "uppercase", color: D.dim }}>Loading profile</p>
      </div>
    </div>
  );

  /* -- Error -- */
  if (error || !user) return (
    <div style={{ minHeight: "100vh", background: D.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontFamily: D.font, fontSize: "0.7rem", letterSpacing: "0.2em", color: D.red, textTransform: "uppercase", marginBottom: "1.5rem" }}>{error ?? "User not found"}</p>
        <button onClick={() => router.back()} style={{ background: "none", border: `1px solid ${D.border}`, cursor: "pointer", padding: "0.6rem 1.2rem", color: D.dim, fontFamily: D.font, fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>? Back</button>
      </div>
    </div>
  );

  const roleIcon = user.role === "super_admin" ? <Crown size={10} /> : user.role === "admin" ? <Shield size={10} /> : <User size={10} />;

  return (
    <div style={{ minHeight: "100vh", background: D.bg, color: D.text }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* -- Back -- */}
      <div style={{ marginBottom: "2.5rem" }}>
        <button onClick={() => router.back()}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "none", border: "none", cursor: "pointer", color: D.dim, fontFamily: D.font, fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", padding: 0, transition: "color 0.2s" }}
          onMouseEnter={e => (e.currentTarget.style.color = D.orange)}
          onMouseLeave={e => (e.currentTarget.style.color = D.dim)}>
          <ArrowLeft size={11} /> Back to users
        </button>
      </div>

      {/* -- Profile header -- */}
      <div style={{ background: D.panelB, border: `1px solid ${D.border}`, padding: "2rem", marginBottom: "1px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg,${accent}00,${accent},${accent}00)` }} />
        <div style={{ position: "absolute", top: "-30%", right: "-10%", width: "40%", height: "200%", background: `radial-gradient(ellipse, ${accent}10 0%, transparent 65%)`, pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "flex-start", gap: "2rem", flexWrap: "wrap" as const, position: "relative", zIndex: 1 }}>
          {/* Avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ width: "72px", height: "72px", background: `${accent}35`, border: `1px solid ${accent}88`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: D.font, fontSize: "1.1rem", fontWeight: 700, color: accent }}>{getInitials(user.name)}</span>
            </div>
            <div style={{ position: "absolute", bottom: "-4px", right: "-4px", width: "14px", height: "14px", background: user.emailVerified ? "#00FFAA" : "rgba(255,80,80,0.7)", border: `2px solid ${D.bg}`, borderRadius: "50%" }} />
          </div>

          {/* Info block */}
          <div style={{ flex: 1, minWidth: "200px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem", flexWrap: "wrap" as const }}>
              <h1 style={{ fontFamily: D.font, fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: D.text, margin: 0 }}>{user.name}</h1>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", background: `${accent}18`, border: `1px solid ${accent}44`, padding: "0.2rem 0.55rem", color: accent, fontFamily: D.font, fontSize: "0.65rem", letterSpacing: "0.15em", textTransform: "uppercase" as const }}>
                {roleIcon} {user.role.replace(/_/g, " ")}
              </span>
              {user.banned && (
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", padding: "0.2rem 0.55rem", color: "#FF5050", fontFamily: D.font, fontSize: "0.65rem", letterSpacing: "0.15em", textTransform: "uppercase" as const }}>
                  <XCircle size={9} /> Banned
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "1.25rem", marginTop: "0.75rem" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontFamily: D.mono, fontSize: "0.7rem", color: D.dim }}>
                <Mail size={11} color={D.dim} /> {user.email}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontFamily: D.mono, fontSize: "0.7rem", color: D.dim }}>
                <Calendar size={11} color={D.dim} /> Joined {fmtDate(user.createdAt)}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontFamily: D.mono, fontSize: "0.7rem", color: D.dim }}>
                <Hash size={11} color={D.dim} /> {user.id.slice(0, 16).toUpperCase()}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontFamily: D.font, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: user.emailVerified ? D.green : D.red }}>
                {user.emailVerified ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                {user.emailVerified ? "Verified" : "Unverified"}
              </span>
            </div>

            {/* -- Promote / Demote ? super_admin only, never for super_admin target -- */}
            {canManageRoles && user.role !== "super_admin" && (
              <div style={{ marginTop: "1.25rem" }}>
                <RoleButton
                  userId={user.id}
                  currentRole={user.role}
                  targetName={user.name}
                  isSuperAdmin={canManageRoles}
                  D={D}
                  onRoleChange={(newRole) => setUser((u) => u ? { ...u, role: newRole } : u)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* -- Stats -- */}
      <div style={{ display: "flex", gap: "1px", marginBottom: "2.5rem" }}>
        <StatCard label="Orders"    value={orders.length}           color={D.orange} D={D} />
        <StatCard label="Spent"     value={fmtCurrency(totalSpent)} color={D.cyan}   D={D}
          sub={orders.length > 0 ? `avg ${fmtCurrency(totalSpent / orders.length)}` : undefined} />
        <StatCard label="Reviews"   value={reviews.length}          color="#2f0350"  D={D}
          sub={avgRating !== null ? `avg ${avgRating.toFixed(1)} ?` : undefined} />
        <StatCard label="Addresses" value={addresses.length}        color={D.green}  D={D} />
      </div>

      {/* -- Orders -- */}
      <div style={{ marginBottom: "2.5rem" }}>
        <SectionHeader label="Order History" count={orders.length} D={D} />
        {orders.length === 0 ? (
          <div style={{ background: D.panelB, border: `1px solid ${D.border}`, padding: "3rem", textAlign: "center" }}>
            <ShoppingBag size={20} color={D.dim} style={{ margin: "0 auto 0.75rem", opacity: 0.35, display: "block" }} />
            <p style={{ fontFamily: D.font, fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: D.dim }}>No orders yet</p>
          </div>
        ) : (
          <div>{orders.map((o) => <OrderRow key={o.id} order={o} D={D} />)}</div>
        )}
      </div>

      {/* -- Reviews -- */}
      <div style={{ marginBottom: "2.5rem" }}>
        <SectionHeader label="Reviews" count={reviews.length} D={D} />
        {reviews.length === 0 ? (
          <div style={{ background: D.panelB, border: `1px solid ${D.border}`, padding: "3rem", textAlign: "center" }}>
            <Star size={20} color={D.dim} style={{ margin: "0 auto 0.75rem", opacity: 0.35, display: "block" }} />
            <p style={{ fontFamily: D.font, fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: D.dim }}>No reviews yet</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            {reviews.map((r) => (
              <div key={r.id} style={{ background: D.panelB, border: `1px solid ${D.border}`, padding: "1.25rem 1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: r.comment ? "0.6rem" : 0, flexWrap: "wrap" as const, gap: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                    <StarDisplay value={Number(r.rating)} />
                    {r.product?.name && (
                      <span style={{ fontFamily: D.font, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: D.dim }}>
                        {r.product.name}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontFamily: D.font, fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "uppercase" as const, padding: "0.15rem 0.5rem", border: `1px solid ${r.isApproved ? D.green + "44" : "#FFAA0044"}`, color: r.isApproved ? D.green : "#FFAA00", background: r.isApproved ? D.green + "08" : "rgba(255,170,0,0.06)" }}>
                      {r.isApproved ? "Approved" : "Pending"}
                    </span>
                    <span style={{ fontFamily: D.mono, fontSize: "0.62rem", color: D.dim }}>{fmtDate(r.createdAt)}</span>
                  </div>
                </div>
                {r.comment && (
                  <p style={{ fontFamily: D.font, fontSize: "0.75rem", lineHeight: 1.65, color: D.dim }}>{r.comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* -- Addresses -- */}
      {addresses.length > 0 && (
        <div style={{ marginBottom: "2.5rem" }}>
          <SectionHeader label="Addresses" count={addresses.length} D={D} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1px", background: D.border, border: `1px solid ${D.border}` }}>
            {addresses.map((a) => (
              <div key={a.id} style={{ background: D.panelB, padding: "1.25rem 1.5rem" }}>
                {a.isDefault && (
                  <span style={{ fontFamily: D.font, fontSize: "0.55rem", letterSpacing: "0.15em", textTransform: "uppercase" as const, color: D.orange, marginBottom: "0.6rem", display: "block" }}>Default</span>
                )}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <MapPin size={12} color={D.dim} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <p style={{ fontFamily: D.font, fontSize: "0.72rem", color: D.text, marginBottom: "0.2rem" }}>{a.fullName}</p>
                    <p style={{ fontFamily: D.mono, fontSize: "0.65rem", color: D.dim }}>{a.streetAddress}</p>
                    <p style={{ fontFamily: D.mono, fontSize: "0.65rem", color: D.dim }}>{a.city}, {a.state ? a.state+", " : ""}{a.postalCode}, {a.country}</p>
                    <p style={{ fontFamily: D.mono, fontSize: "0.65rem", color: D.dim }}>{a.phoneNumber}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
