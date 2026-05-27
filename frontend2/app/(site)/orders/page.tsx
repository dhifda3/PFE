"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, ArrowRight, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { ordersApi } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useTheme } from "@/components/ui/ThemeContext";

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  priceAtPurchase: number;
  variantId?: string;
}

interface Order {
  id: string;
  status: string;
  totalAmount: string;
  shippingAddress: string;
  paymentMethod: string;
  items: OrderItem[];
  createdAt: string;
  trackingNumber?: string;
  estimatedDeliveryDate?: string;
}

// ─── Theme tokens ─────────────────────────────────────────────────────────────

const TOKENS = {
  dark: {
    pageBg:        "#07050A",
    surfaceBg:     "rgba(255,255,255,0.025)",
    surfaceBorder: "rgba(255,255,255,0.06)",
    surfaceBorderOpen: "rgba(255,255,255,0.11)",
    cardInner:     "rgba(255,255,255,0.04)",
    accentOrange:  "#FF5F1F",
    accentCyan:    "#00FFFF",
    labelColor:    "rgba(255,255,255,0.25)",
    textPrimary:   "#FFFFFF",
    textSecondary: "rgba(255,255,255,0.55)",
    divider:       "rgba(255,255,255,0.05)",
    iconFaint:     "rgba(255,255,255,0.1)",
    heroOverlay:   "linear-gradient(to right, rgba(7,5,10,0.92), rgba(7,5,10,0.5) 60%, rgba(7,5,10,0.88))",
    emptyBorder:   "rgba(255,255,255,0.06)",
    btnBg:         "#FF5F1F",
    btnText:       "#000000",
    scanline:      "rgba(0,255,255,0.015)",
    glowOrg:       "rgba(255,95,31,0.12)",
    errorBg:       "rgba(255,95,31,0.08)",
    errorBorder:   "rgba(255,95,31,0.3)",
    errorText:     "#F89880",
    itemIconBg:    "rgba(255,95,31,0.08)",
    itemIconBorder:"rgba(255,95,31,0.15)",
  },
  light: {
    pageBg:        "#F0EBE3",
    surfaceBg:     "rgba(255,255,255,0.75)",
    surfaceBorder: "rgba(0,0,0,0.07)",
    surfaceBorderOpen: "rgba(0,0,0,0.14)",
    cardInner:     "rgba(0,0,0,0.03)",
    accentOrange:  "#E0521A",
    accentCyan:    "#0088AA",
    labelColor:    "rgba(0,0,0,0.35)",
    textPrimary:   "#0A0604",
    textSecondary: "rgba(0,0,0,0.5)",
    divider:       "rgba(0,0,0,0.06)",
    iconFaint:     "rgba(0,0,0,0.08)",
    heroOverlay:   "linear-gradient(to right, rgba(240,235,227,0.92), rgba(240,235,227,0.5) 60%, rgba(240,235,227,0.88))",
    emptyBorder:   "rgba(0,0,0,0.06)",
    btnBg:         "#E0521A",
    btnText:       "#FFFFFF",
    scanline:      "rgba(0,100,120,0.018)",
    glowOrg:       "rgba(224,82,26,0.08)",
    errorBg:       "rgba(224,82,26,0.06)",
    errorBorder:   "rgba(224,82,26,0.25)",
    errorText:     "#B03A14",
    itemIconBg:    "rgba(224,82,26,0.06)",
    itemIconBorder:"rgba(224,82,26,0.15)",
  },
};

// ─── Status styles (dark / light) ────────────────────────────────────────────

const STATUS = {
  dark: {
    pending:    { color: "#F89880", border: "rgba(255,95,31,0.35)",   bg: "rgba(255,95,31,0.1)" },
    confirmed:  { color: "#00FFFF", border: "rgba(0,255,255,0.3)",    bg: "rgba(0,255,255,0.07)" },
    processing: { color: "#00FFFF", border: "rgba(0,255,255,0.3)",    bg: "rgba(0,255,255,0.07)" },
    shipped:    { color: "#F89880", border: "rgba(255,95,31,0.3)",    bg: "rgba(255,95,31,0.07)" },
    delivered:  { color: "#00FFFF", border: "rgba(0,255,255,0.4)",    bg: "rgba(0,255,255,0.09)" },
    cancelled:  { color: "rgba(255,255,255,0.3)", border: "rgba(255,255,255,0.1)", bg: "rgba(255,255,255,0.03)" },
  },
  light: {
    pending:    { color: "#B83A10", border: "rgba(184,58,16,0.3)",    bg: "rgba(184,58,16,0.07)" },
    confirmed:  { color: "#006688", border: "rgba(0,102,136,0.3)",    bg: "rgba(0,102,136,0.07)" },
    processing: { color: "#006688", border: "rgba(0,102,136,0.3)",    bg: "rgba(0,102,136,0.07)" },
    shipped:    { color: "#B83A10", border: "rgba(184,58,16,0.3)",    bg: "rgba(184,58,16,0.06)" },
    delivered:  { color: "#006688", border: "rgba(0,102,136,0.4)",    bg: "rgba(0,102,136,0.09)" },
    cancelled:  { color: "rgba(0,0,0,0.3)",     border: "rgba(0,0,0,0.1)", bg: "rgba(0,0,0,0.03)" },
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const t  = isDark ? TOKENS.dark  : TOKENS.light;
  const st = isDark ? STATUS.dark  : STATUS.light;

  const { user, loading: authLoading, fetchMe } = useAuthStore();
  const [orders, setOrders]     = useState<Order[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => { fetchMe(); }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/auth/login?from=/orders"); return; }
    ordersApi.getAll()
      .then((res) => {
        const data = res.data?.data ?? res.data ?? [];
        setOrders(Array.isArray(data) ? data : []);
      })
      .catch(() => setError("Failed to load your orders."))
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: t.pageBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.35s",
      }}>
        <div style={{ textAlign: "center" }}>
          <Loader2 size={28} style={{ color: t.accentOrange, margin: "0 auto 1rem" }} className="animate-spin" />
          <p style={{
            fontFamily: "'Syncopate', sans-serif",
            fontSize: "0.45rem", letterSpacing: "0.3em",
            textTransform: "uppercase", color: t.labelColor,
          }}>Loading orders</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: t.pageBg,
      paddingTop: "70px",
      transition: "background 0.35s, color 0.35s",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Subtle scanline texture */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          ${t.scanline} 2px,
          ${t.scanline} 4px
        )`,
      }} />

      {/* Ambient glow */}
      <div style={{
        position: "fixed", top: "20vh", right: "-10vw",
        width: "500px", height: "500px",
        background: `radial-gradient(circle, ${t.glowOrg} 0%, transparent 70%)`,
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* Hero header */}
      <div style={{
        height: "28vh", position: "relative",
        background: "url('/images/hero-amber-front.jpg') center/cover no-repeat",
        display: "flex", alignItems: "center",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: t.heroOverlay,
        }} />
        {/* Corner accent lines */}
        <div style={{ position: "absolute", top: "1.5rem", left: "3.5rem", width: "32px", height: "32px",
          borderTop: `1px solid ${t.accentOrange}`, borderLeft: `1px solid ${t.accentOrange}`,
          opacity: 0.5 }} />
        <div style={{ position: "absolute", bottom: "1.5rem", right: "3.5rem", width: "32px", height: "32px",
          borderBottom: `1px solid ${t.accentCyan}`, borderRight: `1px solid ${t.accentCyan}`,
          opacity: 0.4 }} />

        <div style={{ position: "relative", zIndex: 1, padding: "0 4rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div style={{ width: "20px", height: "1px", background: t.accentOrange, opacity: 0.7 }} />
            <p style={{
              fontFamily: "'Syncopate', sans-serif",
              fontSize: "0.5rem", letterSpacing: "0.38em",
              textTransform: "uppercase", color: t.accentOrange, opacity: 0.8,
            }}>Account / History</p>
          </div>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
            fontWeight: 300, color: t.textPrimary, lineHeight: 1,
          }}>
            Order History
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem" }}>
            <div style={{ width: "6px", height: "6px", background: t.accentCyan, borderRadius: "50%", opacity: 0.8 }} />
            <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: "0.45rem", letterSpacing: "0.2em",
              textTransform: "uppercase", color: t.accentCyan, opacity: 0.6 }}>
              {orders.length} {orders.length === 1 ? "record" : "records"} found
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{
        maxWidth: "920px", margin: "0 auto",
        padding: "3rem 2rem",
        position: "relative", zIndex: 1,
      }}>

        {error && (
          <div style={{
            background: t.errorBg, border: `1px solid ${t.errorBorder}`,
            color: t.errorText,
            padding: "1rem 1.5rem", marginBottom: "2rem",
            fontFamily: "'Syncopate', sans-serif", fontSize: "0.55rem", letterSpacing: "0.1em",
          }}>
            ⚠ {error}
          </div>
        )}

        {orders.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "6rem 2rem",
            border: `1px solid ${t.emptyBorder}`,
            background: t.surfaceBg,
            position: "relative",
          }}>
            {/* Corner marks */}
            {[
              { top: "1rem", left: "1rem", borderTop: true, borderLeft: true },
              { top: "1rem", right: "1rem", borderTop: true, borderRight: true },
              { bottom: "1rem", left: "1rem", borderBottom: true, borderLeft: true },
              { bottom: "1rem", right: "1rem", borderBottom: true, borderRight: true },
            ].map((c, i) => (
              <div key={i} style={{
                position: "absolute",
                top: c.top, left: c.left, right: c.right, bottom: c.bottom,
                width: "20px", height: "20px",
                borderTop:    c.borderTop    ? `1px solid ${t.accentOrange}` : undefined,
                borderLeft:   c.borderLeft   ? `1px solid ${t.accentOrange}` : undefined,
                borderBottom: c.borderBottom ? `1px solid ${t.accentOrange}` : undefined,
                borderRight:  c.borderRight  ? `1px solid ${t.accentOrange}` : undefined,
                opacity: 0.4,
              }} />
            ))}

            <Package size={44} style={{ color: t.iconFaint, margin: "0 auto 2rem" }} />
            <p style={{
              fontFamily: "'Syncopate', sans-serif",
              fontSize: "0.45rem", letterSpacing: "0.3em",
              textTransform: "uppercase", color: t.labelColor, marginBottom: "1rem",
            }}>No records</p>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2.5rem", fontWeight: 300, color: t.textPrimary, marginBottom: "1rem",
            }}>
              No orders yet
            </h2>
            <p style={{ color: t.textSecondary, marginBottom: "2.5rem", fontSize: "0.85rem" }}>
              Your order history will appear here
            </p>
            <Link href="/products" style={{
              display: "inline-flex", alignItems: "center", gap: "0.75rem",
              background: t.btnBg, color: t.btnText, textDecoration: "none",
              fontFamily: "'Syncopate', sans-serif",
              fontSize: "0.55rem", letterSpacing: "0.2em",
              textTransform: "uppercase", padding: "1rem 2.5rem",
              transition: "opacity 0.2s",
            }}>
              Explore Products <ArrowRight size={13} />
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {orders.map((order, idx) => {
              const status   = order.status.toLowerCase();
              const badge    = st[status as keyof typeof st] ?? { color: t.textSecondary, border: t.divider, bg: "transparent" };
              const isOpen   = expanded === order.id;

              return (
                <div
                  key={order.id}
                  style={{
                    background: t.surfaceBg,
                    border: `1px solid ${isOpen ? t.surfaceBorderOpen : t.surfaceBorder}`,
                    transition: "border-color 0.3s, background 0.35s",
                    position: "relative",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {/* Left accent stripe */}
                  <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0, width: "2px",
                    background: isOpen
                      ? `linear-gradient(to bottom, ${t.accentOrange}, ${t.accentCyan})`
                      : "transparent",
                    transition: "background 0.4s",
                  }} />

                  {/* Index label */}
                  <div style={{
                    position: "absolute", top: "1.4rem", right: "3.5rem",
                    fontFamily: "'Syncopate', sans-serif",
                    fontSize: "0.4rem", letterSpacing: "0.15em",
                    color: t.labelColor, opacity: 0.5,
                  }}>
                    {String(idx + 1).padStart(2, "0")}
                  </div>

                  {/* Order header row */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : order.id)}
                    style={{
                      width: "100%", background: "none", border: "none",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "1.5rem 2rem", cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <div style={{
                      display: "flex", alignItems: "center",
                      gap: "2.5rem", flexWrap: "wrap",
                    }}>

                      {/* Order ID */}
                      <div>
                        <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: "0.45rem",
                          letterSpacing: "0.22em", textTransform: "uppercase",
                          color: t.labelColor, marginBottom: "0.4rem" }}>Order</p>
                        <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: "0.6rem",
                          color: t.accentCyan, letterSpacing: "0.06em" }}>
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>

                      {/* Date */}
                      <div>
                        <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: "0.45rem",
                          letterSpacing: "0.22em", textTransform: "uppercase",
                          color: t.labelColor, marginBottom: "0.4rem" }}>Date</p>
                        <p style={{ fontSize: "0.82rem", color: t.textPrimary, fontWeight: 300 }}>
                          {new Date(order.createdAt).toLocaleDateString("en-US", {
                            year: "numeric", month: "short", day: "numeric",
                          })}
                        </p>
                      </div>

                      {/* Items */}
                      <div>
                        <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: "0.45rem",
                          letterSpacing: "0.22em", textTransform: "uppercase",
                          color: t.labelColor, marginBottom: "0.4rem" }}>Items</p>
                        <p style={{ fontSize: "0.82rem", color: t.textPrimary }}>
                          {order.items?.length ?? 0}
                        </p>
                      </div>

                      {/* Total */}
                      <div>
                        <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: "0.45rem",
                          letterSpacing: "0.22em", textTransform: "uppercase",
                          color: t.labelColor, marginBottom: "0.4rem" }}>Total</p>
                        <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: "0.7rem",
                          color: t.accentOrange }}>
                          {Number(order.totalAmount).toFixed(2)} DT
                        </p>
                      </div>

                      {/* Status badge */}
                      <span style={{
                        fontFamily: "'Syncopate', sans-serif",
                        fontSize: "0.45rem", letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        background: badge.bg,
                        padding: "0.28rem 0.8rem",
                        transition: "all 0.3s",
                      }}>
                        {order.status}
                      </span>
                    </div>

                    <div style={{ color: t.labelColor, flexShrink: 0, marginLeft: "1rem" }}>
                      {isOpen
                        ? <ChevronUp  size={15} style={{ color: t.accentCyan }} />
                        : <ChevronDown size={15} />}
                    </div>
                  </button>

                  {/* ── Expanded detail ────────────────────────────────── */}
                  {isOpen && (
                    <div style={{
                      padding: "0 2rem 2rem",
                      borderTop: `1px solid ${t.divider}`,
                    }}>

                      {/* Items list */}
                      <div style={{ marginTop: "2rem", marginBottom: "2rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
                          <div style={{ width: "16px", height: "1px", background: t.accentOrange, opacity: 0.5 }} />
                          <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: "0.45rem",
                            letterSpacing: "0.22em", textTransform: "uppercase", color: t.labelColor }}>
                            Items ordered
                          </p>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                          {order.items?.map((item, i) => (
                            <div key={i} style={{
                              display: "flex", alignItems: "center",
                              justifyContent: "space-between",
                              padding: "0.75rem 1rem",
                              background: t.cardInner,
                              border: `1px solid ${t.divider}`,
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                                <div style={{
                                  width: "44px", height: "44px",
                                  background: t.itemIconBg,
                                  border: `1px solid ${t.itemIconBorder}`,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  flexShrink: 0,
                                }}>
                                  <span style={{ color: t.accentOrange, opacity: 0.5, fontSize: "0.9rem" }}>✦</span>
                                </div>
                                <div>
                                  <p style={{ fontFamily: "'Cormorant Garamond', serif",
                                    fontSize: "0.95rem", color: t.textPrimary, marginBottom: "0.2rem" }}>
                                    {item.productName}
                                  </p>
                                  <p style={{ fontFamily: "'Syncopate', sans-serif",
                                    fontSize: "0.45rem", letterSpacing: "0.1em",
                                    color: t.textSecondary }}>
                                    Qty: {item.quantity} × {Number(item.priceAtPurchase).toFixed(2)} DT
                                  </p>
                                </div>
                              </div>
                              <p style={{ fontFamily: "'Syncopate', sans-serif",
                                fontSize: "0.68rem", color: t.textPrimary, flexShrink: 0 }}>
                                {(item.quantity * Number(item.priceAtPurchase)).toFixed(2)} DT
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Meta grid */}
                      <div style={{
                        display: "grid", gridTemplateColumns: "1fr 1fr",
                        gap: "2rem",
                        paddingTop: "1.5rem",
                        borderTop: `1px solid ${t.divider}`,
                      }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                            <div style={{ width: "10px", height: "1px", background: t.accentCyan, opacity: 0.5 }} />
                            <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: "0.45rem",
                              letterSpacing: "0.22em", textTransform: "uppercase", color: t.labelColor }}>
                              Shipping to
                            </p>
                          </div>
                          <p style={{ fontSize: "0.82rem", color: t.textSecondary, lineHeight: 1.6 }}>
                            {order.shippingAddress}
                          </p>
                        </div>

                        {order.trackingNumber ? (
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                              <div style={{ width: "10px", height: "1px", background: t.accentCyan, opacity: 0.5 }} />
                              <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: "0.45rem",
                                letterSpacing: "0.22em", textTransform: "uppercase", color: t.labelColor }}>
                                Tracking
                              </p>
                            </div>
                            <p style={{ color: t.accentCyan, fontFamily: "'Syncopate', sans-serif",
                              letterSpacing: "0.05em", fontSize: "0.6rem" }}>
                              {order.trackingNumber}
                            </p>
                            {order.estimatedDeliveryDate && (
                              <p style={{ fontFamily: "'Syncopate', sans-serif",
                                fontSize: "0.45rem", letterSpacing: "0.1em",
                                color: t.labelColor, marginTop: "0.5rem" }}>
                                Est. {new Date(order.estimatedDeliveryDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                              <div style={{ width: "10px", height: "1px", background: t.accentCyan, opacity: 0.5 }} />
                              <p style={{ fontFamily: "'Syncopate', sans-serif", fontSize: "0.45rem",
                                letterSpacing: "0.22em", textTransform: "uppercase", color: t.labelColor }}>
                                Payment
                              </p>
                            </div>
                            <p style={{ fontSize: "0.82rem", color: t.textSecondary }}>
                              {order.paymentMethod}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
