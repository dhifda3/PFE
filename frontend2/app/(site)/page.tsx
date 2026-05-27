"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Loader2, ShoppingBag, ChevronDown } from "lucide-react";
import { productsApi, categoriesApi, cartApi } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useSignal } from "@/hooks/useSignal";
import RecommendedProducts from "@/components/site/RecommendedProducts";

// --- Hero images --------------------------------------------------------------
const HERO_SLIDES: { img: string; tagline: string }[] = [
  { img: "/images/hero-amber-front.jpg", tagline: "Rituals for Every Skin"               },
  { img: "/images/hero-amber-side.jpg",  tagline: "Where Light Meets Skin"               },
  { img: "/images/hero-cyan-close.jpg",  tagline: "Born from Nature, Refined by Science" },
  { img: "/images/hero-cyan-dark.jpg",   tagline: "Your Skin, Your Story"                },
];

const SLIDE_DURATION = 5500;
const FADE_MS        = 1500;

// --- Cinematic Hero -----------------------------------------------------------
function HeroSlideshow() {
  const [idx, setIdx]         = useState(0);
  const [textKey, setTextKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback(() => {
    setIdx(prev => (prev + 1) % HERO_SLIDES.length);
    setTextKey(k => k + 1);
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(advance, SLIDE_DURATION);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [advance]);

  const goTo = (i: number) => {
    if (i === idx) return;
    setIdx(i);
    setTextKey(k => k + 1);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(advance, SLIDE_DURATION);
  };

  return (
    <div style={{ position: "relative", height: "100vh", overflow: "hidden" }}>
      {HERO_SLIDES.map((slide, i) => {
        const isActive = i === idx;
        return (
          <div key={slide.img} style={{
            position: "absolute", inset: 0,
            opacity: isActive ? 1 : 0,
            transition: `opacity ${FADE_MS}ms ease-in-out`,
            zIndex: isActive ? 1 : 0,
          }}>
            <div
              key={isActive ? `active-${idx}` : `idle-${i}`}
              className={`hero-kb-${i % 4}`}
              style={{
                position: "absolute", inset: "-6%",
                backgroundImage: `url(${slide.img})`,
                backgroundSize: "cover", backgroundPosition: "center",
                willChange: "transform",
              }}
            />
          </div>
        );
      })}

      <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(7,5,10,0.55) 0%, transparent 28%)" }} />
      <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none", background: "linear-gradient(to top, var(--bg-primary) 0%, rgba(7,5,10,0.7) 22%, transparent 55%)" }} />
      <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none", background: "radial-gradient(ellipse 120% 100% at 50% 50%, transparent 45%, rgba(7,5,10,0.45) 100%)" }} />
      <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none", background: "rgba(7,5,10,0.28)" }} />

      <div style={{
        position: "absolute", inset: 0, zIndex: 10,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "70px 2rem 80px", textAlign: "center",
      }}>
        <p key={`eyebrow-${textKey}`} className="hero-text-in" style={{
          fontFamily: "var(--font-label)", fontSize: "0.58rem", letterSpacing: "0.5em",
          textTransform: "uppercase", color: "var(--amber-soft)", opacity: 0,
          marginBottom: "1.5rem", animationDelay: "0.1s",
        }}>
          LUM<span style={{ color: "var(--cyan)" }}>I</span>NA -- Skin Rituals
        </p>
        <h1 key={`h1-${textKey}`} className="hero-text-in" style={{
          fontFamily: "var(--font-display)", fontStyle: "italic",
          fontSize: "clamp(3.8rem, 9vw, 9rem)", fontWeight: 300,
          color: "#fff", lineHeight: 0.95, letterSpacing: "-0.01em",
          opacity: 0, animationDelay: "0.25s",
          textShadow: "0 2px 40px rgba(0,0,0,0.5)", marginBottom: "1.4rem",
        }}>
          The Collection
        </h1>
        <p key={`tag-${textKey}`} className="hero-text-in" style={{
          fontFamily: "var(--font-display)", fontSize: "clamp(0.9rem, 2.2vw, 1.4rem)",
          fontWeight: 300, fontStyle: "italic",
          color: "rgba(255,243,232,0.65)", letterSpacing: "0.04em",
          opacity: 0, animationDelay: "0.45s", marginBottom: "2.5rem",
        }}>
          {HERO_SLIDES[idx].tagline}
        </p>
        <div key={`cta-${textKey}`} className="hero-text-in" style={{ opacity: 0, animationDelay: "0.65s", display: "flex", gap: "1rem" }}>
          <Link href="/" style={{
            fontFamily: "var(--font-label)", fontSize: "0.6rem", letterSpacing: "0.25em",
            textTransform: "uppercase", padding: "0.85rem 2.2rem",
            background: "var(--amber)", color: "#000", textDecoration: "none",
            display: "inline-block", transition: "background 0.2s, transform 0.2s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--amber-soft)"; (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--amber)"; (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)"; }}>
            Explore
          </Link>
          <Link href="/auth/login" style={{
            fontFamily: "var(--font-label)", fontSize: "0.6rem", letterSpacing: "0.25em",
            textTransform: "uppercase", padding: "0.85rem 2.2rem",
            background: "transparent", border: "1px solid rgba(255,243,232,0.3)",
            color: "rgba(255,243,232,0.7)", textDecoration: "none",
            display: "inline-block", transition: "border-color 0.2s, color 0.2s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--cyan)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--cyan)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,243,232,0.3)"; (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,243,232,0.7)"; }}>
            Sign In
          </Link>
        </div>
      </div>

      <div style={{
        position: "absolute", bottom: "2.5rem", left: "50%",
        transform: "translateX(-50%)", zIndex: 10,
        display: "flex", gap: "0.5rem", alignItems: "center",
      }}>
        {HERO_SLIDES.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} aria-label={`Slide ${i + 1}`} style={{
            width: i === idx ? "1.8rem" : "0.4rem", height: "0.4rem",
            borderRadius: "999px",
            background: i === idx ? "var(--amber)" : "rgba(255,255,255,0.3)",
            border: "none", cursor: "pointer", padding: 0,
            transition: "all 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
            boxShadow: i === idx ? "0 0 8px var(--amber)" : "none",
          }} />
        ))}
      </div>

      <div style={{
        position: "absolute", bottom: "2.4rem", right: "2rem", zIndex: 10,
        display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem",
      }}>
        <span style={{ fontFamily: "var(--font-label)", fontSize: "0.38rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,243,232,0.3)" }}>Scroll</span>
        <div className="hero-scroll-bounce">
          <ChevronDown size={14} style={{ color: "rgba(255,243,232,0.3)" }} />
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "2px", zIndex: 10, background: "rgba(255,255,255,0.06)" }}>
        <div key={`bar-${idx}`} className="hero-progress-bar" style={{
          height: "100%",
          background: "linear-gradient(90deg, var(--amber), var(--cyan))",
          animationDuration: `${SLIDE_DURATION}ms`,
        }} />
      </div>
    </div>
  );
}

// --- Full-collection section gradient orbs ------------------------------------
function CollectionGradientBG() {
  return (
    <div className="col-orbs-layer">
      <div className="col-orb col-orb-1" />
      <div className="col-orb col-orb-2" />
      <div className="col-orb col-orb-3" />
      <div className="col-orb col-orb-4" />
      <div className="col-orb col-orb-5" />
      <div className="col-orb col-orb-6" />
      <div className="col-orb col-orb-7" />
      <div className="col-orb col-orb-8" />
    </div>
  );
}

// --- Types --------------------------------------------------------------------
interface Product {
  id: string;
  name: string;
  brand: string;
  price: string | null;
  images: string[];
  categoryId: string;
  isActive: boolean;
  hasVariants: boolean;
  skinType: string[];
  averageRating: string;
  reviewCount: number;
  variants?: any[];
}

const SORT_OPTIONS = ["Newest", "Price: Low to High", "Price: High to Low", "Best Rated"] as const;

// --- Page ---------------------------------------------------------------------
export default function HomePage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user }     = useAuthStore();
  const { track }    = useSignal();

  const [products, setProducts]             = useState<Product[]>([]);
  const [categories, setCategories]         = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch]                 = useState("");
  const [sort, setSort]                     = useState<typeof SORT_OPTIONS[number]>("Newest");

  useEffect(() => {
    Promise.all([productsApi.getAll(), categoriesApi.getAll()])
      .then(([pRes, cRes]) => {
        const prods = pRes.data?.data ?? pRes.data ?? [];
        const cats  = cRes.data?.data ?? cRes.data ?? [];
        setProducts(Array.isArray(prods) ? prods : []);
        setCategories(Array.isArray(cats) ? cats : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat) {
      const matched = categories.find(
        (c) =>
          c.slug?.toLowerCase() === cat.toLowerCase() ||
          c.name?.toLowerCase() === cat.toLowerCase()
      );
      if (matched) setActiveCategory(matched.name);
    }
  }, [searchParams, categories]);

  const filtered = products
    .filter((p) => p.isActive)
    .filter((p) => activeCategory === "All" || categories.find((c) => c.name === activeCategory)?.id === p.categoryId)
    .filter((p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === "Price: Low to High") return Number(a.price ?? 0) - Number(b.price ?? 0);
      if (sort === "Price: High to Low") return Number(b.price ?? 0) - Number(a.price ?? 0);
      if (sort === "Best Rated")         return Number(b.averageRating) - Number(a.averageRating);
      return 0;
    });

  const row1     = filtered.filter((_, i) => i % 2 === 0);
  const row2     = filtered.filter((_, i) => i % 2 === 1);
  const doubled1 = [...row1, ...row1];
  const doubled2 = [...row2, ...row2];

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} style={{ color: "var(--amber)" }} className="animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>

      {/* -- Cinematic hero -- */}
      <HeroSlideshow />

      {/* -- Recommended products -- */}
      <div style={{ paddingTop: "3rem" }}>
        <RecommendedProducts />
      </div>

      {/* ----------------------------------------------------------------------
          Full Collection section
      ---------------------------------------------------------------------- */}
      <div style={{ position: "relative", overflow: "hidden" }}>

        <CollectionGradientBG />

        <div style={{ position: "relative", zIndex: 1 }}>

          {/* Section header */}
          <div style={{ textAlign: "center", padding: "4rem 2rem 2.5rem" }}>
            <p style={{
              fontFamily: "var(--font-label)", fontSize: "0.6rem", letterSpacing: "0.4em",
              textTransform: "uppercase", color: "var(--amber-soft)",
              marginBottom: "1rem", opacity: 0.85,
            }}>
              The Collection
            </p>
            <h2 style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 4vw, 3.5rem)",
              fontWeight: 300, color: "var(--text-primary)",
              margin: "0 0 0.6rem", letterSpacing: "0.05em",
            }}>
              All Products
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", letterSpacing: "0.05em" }}>
              {filtered.length} product{filtered.length !== 1 ? "s" : ""} -- hover to pause
            </p>
          </div>

          {/* Controls row */}
          <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 2rem 2.5rem" }}>
            <div style={{
              display: "flex", flexWrap: "wrap",
              alignItems: "center", justifyContent: "space-between",
              gap: "1.5rem",
            }}>
              {/* Category pills */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {["All", ...categories.map((c) => c.name)].map((cat) => {
                  const isActive = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      style={{
                        fontFamily: "var(--font-label)", fontSize: "0.55rem", letterSpacing: "0.15em",
                        textTransform: "uppercase", padding: "0.5rem 1.2rem",
                        border: `1px solid ${isActive ? "var(--amber)" : "var(--border)"}`,
                        background: isActive ? "var(--amber-honey)" : "transparent",
                        color: isActive ? "var(--amber)" : "var(--text-secondary)",
                        cursor: "pointer", transition: "all 0.3s", borderRadius: "999px",
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Search + Sort */}
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <input
                  type="text" placeholder="Search..." value={search}
                  onChange={(e) => { setSearch(e.target.value); if (e.target.value) track("search", undefined, e.target.value); }}
                  style={{
                    background: "var(--input-bg)", border: "1px solid var(--input-border)",
                    color: "var(--text-primary)", fontSize: "0.85rem",
                    padding: "0.7rem 1rem", width: "180px",
                    outline: "none", fontFamily: "var(--font-body)",
                  }}
                />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as typeof SORT_OPTIONS[number])}
                  style={{
                    background: "var(--input-bg)", border: "1px solid var(--input-border)",
                    color: "var(--text-secondary)", fontSize: "0.75rem",
                    padding: "0.7rem 1rem", cursor: "pointer",
                    outline: "none", fontFamily: "var(--font-label)", letterSpacing: "0.05em",
                  }}
                >
                  {SORT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Product marquee rows */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "6rem 0" }}>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "2.5rem", fontWeight: 300, color: "var(--text-primary)", marginBottom: "1rem" }}>
                No products found
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Try adjusting your filters</p>
            </div>
          ) : (
            <div style={{ paddingBottom: "5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {doubled1.length > 0 && (
                <div className="marquee-container">
                  <div className="marquee-track">
                    {doubled1.map((product, i) => (
                      <div key={`r1-${product.id}-${i}`} className="marquee-card">
                        <ProductCard product={product} user={user} router={router} track={track} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {doubled2.length > 0 && (
                <div className="marquee-container">
                  <div className="marquee-track" style={{ animation: "marqueeScrollReverse 38s linear infinite" }}>
                    {doubled2.map((product, i) => (
                      <div key={`r2-${product.id}-${i}`} className="marquee-card">
                        <ProductCard product={product} user={user} router={router} track={track} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

    </div>
  );
}

// --- Product Card -------------------------------------------------------------
function ProductCard({
  product, user, router, track,
}: {
  product: Product;
  user: any;
  router: any;
  track: any;
}) {
  const cardRef    = useRef<HTMLDivElement>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const glowRef    = useRef<HTMLDivElement>(null);
  const rafRef     = useRef<number>(0);
  const mx         = useRef(0.5);
  const my         = useRef(0.5);
  const tx         = useRef(0.5);
  const ty         = useRef(0.5);
  const inside     = useRef(false);

  const [adding, setAdding] = useState(false);
  const [added,  setAdded]  = useState(false);

  useEffect(() => {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const tick = () => {
      mx.current = lerp(mx.current, tx.current, 0.1);
      my.current = lerp(my.current, ty.current, 0.1);
      const dx = mx.current - 0.5;
      const dy = my.current - 0.5;
      const sc = inside.current ? 1.03 : 1.0;
      if (cardRef.current)
        cardRef.current.style.transform = `rotateX(${-dy * 16}deg) rotateY(${dx * 20}deg) scale(${sc})`;
      if (imgWrapRef.current)
        imgWrapRef.current.style.transform = `translate(${dx * 10}px, ${dy * 8}px)`;
      if (glowRef.current) {
        const gx = 46 + dx * 22;
        const gy = 38 + dy * 18;
        glowRef.current.style.background = `radial-gradient(ellipse 42% 36% at ${gx}% ${gy}%, rgba(255,200,120,0.14) 0%, transparent 72%)`;
        glowRef.current.style.opacity = inside.current ? "1" : "0";
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const displayPrice = product.price ? `${Number(product.price).toFixed(2)} TND` : "See options";

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { router.push("/auth/login?from=/"); return; }
    if (product.hasVariants) { router.push(`/products/${product.id}`); return; }
    setAdding(true);
    try {
      const v = product.variants?.[0];
      await cartApi.add(v?.id ?? product.id, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch {
      router.push(`/products/${product.id}`);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div style={{ perspective: "900px" }}>
      <Link href={`/products/${product.id}`} style={{ textDecoration: "none" }} onClick={() => track("view", product.id)}>
        <div
          ref={cardRef}
          className="crystal-card"
          style={{ transformStyle: "preserve-3d", transition: "transform 0.1s ease-out" }}
          onMouseEnter={(e) => {
            inside.current = true;
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            tx.current = (e.clientX - r.left) / r.width;
            ty.current = (e.clientY - r.top)  / r.height;
          }}
          onMouseMove={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            tx.current = (e.clientX - r.left) / r.width;
            ty.current = (e.clientY - r.top)  / r.height;
          }}
          onMouseLeave={() => { inside.current = false; tx.current = 0.5; ty.current = 0.5; }}
        >
          <div style={{ aspectRatio: "1", overflow: "hidden", background: "var(--bg-secondary)", position: "relative" }}>
            <div ref={imgWrapRef} style={{ width: "110%", height: "110%", marginLeft: "-5%", marginTop: "-5%" }}>
              {product.images?.[0] ? (
                <img src={product.images[0]} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, var(--amber-honey), transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "2.5rem", opacity: 0.3 }}>??</span>
                </div>
              )}
            </div>
            <div ref={glowRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0, transition: "opacity 0.35s" }} />
            {product.skinType?.length > 0 && (
              <div style={{ position: "absolute", top: "0.75rem", left: "0.75rem", display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                {product.skinType.slice(0, 2).map((st) => (
                  <span key={st} style={{ fontFamily: "var(--font-label)", fontSize: "0.5rem", letterSpacing: "0.08em", textTransform: "uppercase", background: "rgba(7,5,10,0.8)", color: "rgba(255,255,255,0.6)", padding: "0.25rem 0.5rem", backdropFilter: "blur(4px)" }}>{st}</span>
                ))}
              </div>
            )}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0.75rem", opacity: inside.current ? 1 : 0, transition: "all 0.3s ease" }}>
              <button onClick={handleAddToCart} disabled={adding} style={{ width: "100%", fontFamily: "var(--font-label)", fontSize: "0.55rem", letterSpacing: "0.15em", textTransform: "uppercase", padding: "0.7rem", background: added ? "rgba(35,213,213,0.9)" : "rgba(255,95,31,0.9)", color: "#000", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", transition: "all 0.3s" }}>
                <ShoppingBag size={12} />
                {adding ? "Adding..." : added ? "Added ?" : product.hasVariants ? "Select Options" : "Add to Cart"}
              </button>
            </div>
          </div>

          <div className="crystal-card__depth" />

          <div style={{ padding: "1rem 1.2rem 1.4rem", position: "relative", zIndex: 3 }}>
            <p style={{ fontFamily: "var(--font-label)", fontSize: "0.52rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--amber-soft)", marginBottom: "0.35rem" }}>{product.brand}</p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 400, color: "var(--text-primary)", marginBottom: "0.6rem", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name}</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontFamily: "var(--font-label)", fontSize: "0.72rem", color: "var(--text-primary)", letterSpacing: "0.05em" }}>{displayPrice}</p>
              {Number(product.averageRating) > 0 && (
                <p style={{ fontSize: "0.72rem", color: "var(--amber)", letterSpacing: "0.03em" }}>? {Number(product.averageRating).toFixed(1)}</p>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
