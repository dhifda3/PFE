"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, ArrowRight, X, ShoppingBag, Loader2, Trash2 } from "lucide-react";
import { wishlistApi, cartApi } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";

interface WishlistItem {
  productId: string;
  productName?: string;
  name?: string;
  price?: number;
  imageUrl?: string;
}

export default function WishlistPage() {
  const { user, loading: authLoading, fetchMe } = useAuthStore();
  const [items, setItems]                       = useState<WishlistItem[]>([]);
  const [wishlistLoading, setWishlistLoading]   = useState(true);
  const [error, setError]                       = useState<string | null>(null);
  const [addingToCart, setAddingToCart]         = useState<string | null>(null);
  const [removingItem, setRemovingItem]         = useState<string | null>(null);
  const [feedback, setFeedback]                 = useState<{ id: string; msg: string } | null>(null);

  useEffect(() => { fetchMe(); }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setWishlistLoading(false); return; }
    setWishlistLoading(true);
    wishlistApi
      .get()
      .then((res) => {
        const raw = res.data?.data?.items ?? res.data?.items ?? res.data?.data ?? [];
        setItems(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setError("Failed to load your wishlist."))
      .finally(() => setWishlistLoading(false));
  }, [user, authLoading]);

  const showFeedback = (id: string, msg: string) => {
    setFeedback({ id, msg });
    setTimeout(() => setFeedback(null), 2000);
  };

  const removeItem = async (productId: string) => {
    setRemovingItem(productId);
    setItems((prev) => prev.filter((i) => i.productId !== productId));
    try {
      await wishlistApi.remove(productId);
    } catch {
      const res = await wishlistApi.get();
      const raw = res.data?.data?.items ?? res.data?.items ?? res.data?.data ?? [];
      setItems(Array.isArray(raw) ? raw : []);
    } finally {
      setRemovingItem(null);
    }
  };

  const moveToCart = async (productId: string) => {
    setAddingToCart(productId);
    try {
      await cartApi.add(productId, 1);
      await wishlistApi.remove(productId);
      setItems((prev) => prev.filter((i) => i.productId !== productId));
      showFeedback(productId, "Moved to bag!");
    } catch {
      showFeedback(productId, "Could not add to bag.");
    } finally {
      setAddingToCart(null);
    }
  };

  /* -- Shared empty/guest shell ------------------------------------------- */
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", paddingTop: "70px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "3.5rem 2rem" }}>
        {children}
      </div>
    </div>
  );

  /* -- Loading ------------------------------------------------------------ */
  if (authLoading || wishlistLoading) {
    return (
      <Shell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--amber)" }} />
        </div>
      </Shell>
    );
  }

  /* -- Not logged in ------------------------------------------------------ */
  if (!user) {
    return (
      <Shell>
        <div style={{ marginBottom: "3rem" }}>
          <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>Your Wishlist</p>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: "clamp(2rem,5vw,3.5rem)",
            fontWeight: 300, color: "var(--text-primary)",
          }}>
            0 Items
          </h1>
        </div>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "6rem 2rem",
          border: "1px solid var(--border)", background: "var(--bg-card)",
        }}>
          <Heart size={48} style={{ color: "var(--border-hover)", marginBottom: "1.5rem" }} />
          <h2 style={{
            fontFamily: "var(--font-display)", fontSize: "2rem",
            fontWeight: 300, color: "var(--text-primary)", marginBottom: "0.75rem",
          }}>
            Sign in to see your wishlist
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "2rem" }}>
            Save your favourite products and access them anytime.
          </p>
          <Link href="/auth/login?from=/wishlist" className="btn btn-primary">
            SIGN IN <ArrowRight size={14} style={{ marginLeft: "0.5rem" }} />
          </Link>
        </div>
      </Shell>
    );
  }

  /* -- Error -------------------------------------------------------------- */
  if (error) {
    return (
      <Shell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <p style={{ color: "var(--amber)", fontFamily: "var(--font-body)" }}>{error}</p>
        </div>
      </Shell>
    );
  }

  /* -- Empty wishlist ----------------------------------------------------- */
  if (items.length === 0) {
    return (
      <Shell>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "60vh", textAlign: "center",
        }}>
          <Heart size={56} style={{ color: "var(--border)", marginBottom: "1.5rem" }} />
          <h2 style={{
            fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem,4vw,3rem)",
            fontWeight: 300, color: "var(--text-primary)", marginBottom: "0.75rem",
          }}>
            Your wishlist is empty
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "2.5rem" }}>
            Browse our collection and save the products you love.
          </p>
          <Link href="/products" className="btn btn-primary">
            EXPLORE PRODUCTS <ArrowRight size={14} style={{ marginLeft: "0.5rem" }} />
          </Link>
        </div>
      </Shell>
    );
  }

  /* -- Wishlist with items ------------------------------------------------ */
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", paddingTop: "70px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "3.5rem 2rem" }}>

        {/* Header */}
        <div style={{ marginBottom: "3rem" }}>
          <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>Your Wishlist</p>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: "clamp(2rem,5vw,3.5rem)",
            fontWeight: 300, color: "var(--text-primary)",
          }}>
            {items.length} Item{items.length !== 1 ? "s" : ""}
          </h1>
        </div>

        {/* Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "1.5rem",
        }}>
          {items.map((item) => {
            const id    = item.productId;
            const name  = item.productName ?? item.name ?? id;
            const price = item.price;
            const isFeedback = feedback?.id === id;

            return (
              <div
                key={id}
                className="product-card crystal-card"
                style={{ display: "flex", flexDirection: "column", position: "relative" }}
              >
                {/* crystal depth layer */}
                <div className="crystal-card__depth" />

                {/* Corner remove button */}
                <button
                  onClick={() => removeItem(id)}
                  disabled={removingItem === id}
                  title="Remove"
                  style={{
                    position: "absolute", top: "0.75rem", right: "0.75rem", zIndex: 10,
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--text-muted)", transition: "color 0.2s",
                    display: "flex", alignItems: "center",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--amber)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  {removingItem === id
                    ? <Loader2 size={15} className="animate-spin" />
                    : <X size={15} />}
                </button>

                {/* Image */}
                <Link href={`/products/${id}`} style={{ display: "block", position: "relative", zIndex: 1 }}>
                  <div style={{
                    width: "100%", height: "220px",
                    background: "var(--bg-secondary)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden", position: "relative",
                  }}>
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={name}
                        style={{ width: "100%", height: "100%", objectFit: "cover",
                          transition: "transform 0.5s var(--ease-expo)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                      />
                    ) : (
                      <>
                        {/* placeholder vial shapes */}
                        <div style={{
                          width: 38, height: 72, borderRadius: 3,
                          background: "rgba(255,160,60,0.15)",
                          position: "absolute", transform: "rotate(-4deg)",
                          border: "1px solid var(--border)",
                        }} />
                        <div style={{
                          width: 28, height: 58, borderRadius: 3,
                          background: "rgba(0,255,255,0.08)",
                          position: "absolute", transform: "rotate(2deg)",
                          border: "1px solid var(--border)",
                        }} />
                        <Heart size={20} style={{ color: "var(--text-muted)", position: "relative", zIndex: 1 }} />
                      </>
                    )}

                    {/* hover overlay */}
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "rgba(0,0,0,0.45)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      opacity: 0, transition: "opacity 0.3s",
                      zIndex: 2,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                    >
                      <span style={{
                        fontFamily: "var(--font-label)", fontSize: "0.55rem",
                        letterSpacing: "0.25em", textTransform: "uppercase",
                        color: "var(--text-primary)", background: "var(--bg-card)",
                        border: "1px solid var(--border)", padding: "0.5rem 1.2rem",
                      }}>
                        VIEW PRODUCT
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Info */}
                <div style={{
                  display: "flex", flexDirection: "column", gap: "0.75rem",
                  padding: "1.25rem", flex: 1, position: "relative", zIndex: 1,
                }}>
                  <div>
                    <h3 style={{
                      fontFamily: "var(--font-display)", fontWeight: 300,
                      fontSize: "1.2rem", color: "var(--text-primary)", lineHeight: 1.3,
                    }}>
                      {name}
                    </h3>
                    {price !== undefined && (
                      <p style={{
                        fontSize: "0.85rem", color: "var(--text-secondary)",
                        marginTop: "0.3rem", fontFamily: "var(--font-body)",
                      }}>
                        {price.toFixed(2)} DT
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {isFeedback ? (
                      <div style={{
                        width: "100%", padding: "0.75rem", textAlign: "center",
                        fontFamily: "var(--font-label)", fontSize: "0.55rem",
                        letterSpacing: "0.2em", textTransform: "uppercase",
                        background: "rgba(0,255,255,0.1)", color: "var(--cyan)",
                        border: "1px solid rgba(0,255,255,0.2)",
                      }}>
                        {feedback!.msg.toUpperCase()}
                      </div>
                    ) : (
                      <button
                        onClick={() => moveToCart(id)}
                        disabled={addingToCart === id}
                        className="btn btn-primary"
                        style={{ width: "100%", justifyContent: "center", gap: "0.5rem" }}
                      >
                        {addingToCart === id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <><ShoppingBag size={13} /> ADD TO BAG</>}
                      </button>
                    )}

                    <button
                      onClick={() => removeItem(id)}
                      disabled={removingItem === id}
                      className="btn btn-outline-amber"
                      style={{ width: "100%", justifyContent: "center", gap: "0.4rem",
                        fontSize: "0.55rem", padding: "0.65rem 1rem" }}
                    >
                      <Trash2 size={11} /> REMOVE
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer bar */}
        <div style={{
          marginTop: "4rem", display: "flex", alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid var(--border)", paddingTop: "2.5rem",
        }}>
          <Link
            href="/products"
            style={{
              fontFamily: "var(--font-label)", fontSize: "0.55rem",
              letterSpacing: "0.25em", textTransform: "uppercase",
              color: "var(--text-secondary)", textDecoration: "none",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--cyan)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            ? CONTINUE SHOPPING
          </Link>

          <Link href="/cart" className="btn btn-primary" style={{ gap: "0.6rem" }}>
            VIEW BAG <ArrowRight size={14} />
          </Link>
        </div>

      </div>
    </div>
  );
}
