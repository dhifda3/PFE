"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShoppingBag } from "lucide-react";
import { productsApi, categoriesApi, cartApi } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useSignal } from "@/hooks/useSignal";

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

function VioletGradientBG() {
  return (
    <>
      <style>{`
        @keyframes orbFloat1 {
          0% { transform: translate(0,0) scale(1); }
          25% { transform: translate(80px,-60px) scale(1.25); }
          50% { transform: translate(-50px,70px) scale(0.9); }
          75% { transform: translate(60px,40px) scale(1.15); }
          100% { transform: translate(0,0) scale(1); }
        }

        @keyframes orbFloat2 {
          0% { transform: translate(0,0) scale(1); }
          50% { transform: translate(-90px,80px) scale(1.35); }
          100% { transform: translate(0,0) scale(1); }
        }

        @keyframes orbFloat3 {
          0% { transform: translate(0,0) scale(1); }
          50% { transform: translate(100px,-70px) scale(1.2); }
          100% { transform: translate(0,0) scale(1); }
        }

        @keyframes pulse {
          0% { opacity: 0.7; }
          50% { opacity: 1; }
          100% { opacity: 0.7; }
        }
      `}</style>

      {/* MAIN BACK LIGHT */}
      <div
        style={{
          position: "absolute",
          inset: "-20%",
          background:
            "radial-gradient(circle at center, rgba(168,85,247,0.30) 0%, rgba(139,92,246,0.18) 30%, rgba(255,255,255,0.12) 50%, transparent 75%)",
          filter: "blur(120px)",
          animation: "pulse 8s ease-in-out infinite",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* STRONG PURPLE */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          right: "-10%",
          width: "800px",
          height: "800px",
          borderRadius: "9999px",
          background:
            "radial-gradient(circle, rgba(147,51,234,0.55) 0%, rgba(168,85,247,0.40) 35%, rgba(196,181,253,0.20) 55%, transparent 75%)",
          filter: "blur(110px)",
          animation: "orbFloat1 14s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      {/* BLUE VIOLET */}
      <div
        style={{
          position: "absolute",
          bottom: "-20%",
          left: "-10%",
          width: "900px",
          height: "900px",
          borderRadius: "9999px",
          background:
            "radial-gradient(circle, rgba(99,102,241,0.50) 0%, rgba(129,140,248,0.32) 40%, rgba(224,231,255,0.15) 60%, transparent 80%)",
          filter: "blur(120px)",
          animation: "orbFloat2 18s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      {/* HOT MAGENTA */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "20%",
          width: "600px",
          height: "600px",
          borderRadius: "9999px",
          background:
            "radial-gradient(circle, rgba(236,72,153,0.42) 0%, rgba(217,70,239,0.28) 40%, rgba(255,255,255,0.12) 60%, transparent 80%)",
          filter: "blur(100px)",
          animation: "orbFloat3 12s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      {/* EXTRA WHITE GLOW FOR LIGHT MODE */}
      <div
        style={{
          position: "absolute",
          top: "15%",
          right: "20%",
          width: "500px",
          height: "500px",
          borderRadius: "9999px",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.18) 35%, transparent 75%)",
          filter: "blur(90px)",
          animation: "pulse 6s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
    </>
  );
}

export default function ProductsPage() {
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
        (c) => c.slug?.toLowerCase() === cat.toLowerCase() ||
               c.name?.toLowerCase() === cat.toLowerCase()
      );
      if (matched) setActiveCategory(matched.name);
    }
  }, [searchParams, categories]);

  const filtered = products
    .filter((p) => p.isActive)
    .filter((p) => activeCategory === "All" ||
      categories.find((c) => c.name === activeCategory)?.id === p.categoryId)
    .filter((p) => !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "Price: Low to High") return Number(a.price ?? 0) - Number(b.price ?? 0);
      if (sort === "Price: High to Low") return Number(b.price ?? 0) - Number(a.price ?? 0);
      if (sort === "Best Rated")         return Number(b.averageRating) - Number(a.averageRating);
      return 0;
    });

  if (loading) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg-primary)" }}>
        <Loader2 size={32} style={{ color:"var(--amber)" }} className="animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg-primary)", paddingTop:"70px" }}>

      {/* ── Hero header ── */}
<div
  style={{
    height: "40vh",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  }}
>
  {/* MOVING IMAGE BACKGROUND */}
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundImage: "url('/images/violet.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      transform: "scale(1.1)",
      animation: "slowMove 20s ease-in-out infinite",
      filter: "saturate(1.2) contrast(1.1)",
    }}
  />

  {/* GLASS OVERLAY (this gives 3D feeling) */}
  <div
    style={{
      position: "absolute",
      inset: 0,
      background:
        "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
    }}
  />

  {/* DARK DEPTH LAYER */}
  <div
    style={{
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.65) 100%)",
    }}
  />

  {/* TEXT FLOAT (gives 3D depth feel) */}
  <div
    style={{
      position: "relative",
      zIndex: 2,
      textAlign: "center",
      transform: "translateZ(40px)",
      textShadow: "0 10px 40px rgba(0,0,0,0.6)",
    }}
  >
    <p style={{
      fontFamily:"var(--font-label)",
      fontSize:"0.6rem",
      letterSpacing:"0.4em",
      color:"var(--amber-soft)",
      marginBottom:"1rem"
    }}>
      The Collection
    </p>

    <h1 style={{
      fontFamily:"var(--font-display)",
      fontStyle:"italic",
      fontSize:"clamp(3rem,7vw,6rem)",
      fontWeight:300,
      color:"#fff",
    }}>
      {activeCategory === "All"
        ? "Best Sellers"
        : `Best Sellers — ${activeCategory}`}
    </h1>
  </div>

  {/* ANIMATION */}
  <style>{`
    @keyframes slowMove {
      0% { transform: scale(1.1) translate(0px, 0px); }
      50% { transform: scale(1.15) translate(-15px, 10px); }
      100% { transform: scale(1.1) translate(0px, 0px); }
    }
  `}</style>
</div>
      {/* ── Body ── */}
      <div style={{ position:"relative", overflow:"hidden" }}>
        <VioletGradientBG />

        <div style={{ position:"relative", zIndex:1, maxWidth:"1400px", margin:"0 auto", padding:"3rem 2rem" }}>

          {/* Count */}
          <p style={{
            fontFamily:"var(--font-label)", fontSize:"0.55rem",
            letterSpacing:"0.2em", color:"var(--text-muted)", marginBottom:"2rem",
          }}>
            {filtered.length} PRODUCT{filtered.length !== 1 ? "S" : ""}
          </p>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"6rem 0" }}>
              <p style={{ fontFamily:"var(--font-display)", fontSize:"2.5rem", fontWeight:300, color:"var(--text-primary)", marginBottom:"1rem" }}>
                No products found
              </p>
              <p style={{ color:"var(--text-muted)", fontSize:"0.9rem" }}>
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <div style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))",
              gap:"1.5rem",
            }}>
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} user={user} router={router} track={track} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Product Card ── */
function ProductCard({ product, user, router, track }: {
  product: Product; user: any; router: any; track: any;
}) {
  const cardRef    = useRef<HTMLDivElement>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const glowRef    = useRef<HTMLDivElement>(null);
  const rafRef     = useRef<number>(0);
  const mx = useRef(0.5); const my = useRef(0.5);
  const tx = useRef(0.5); const ty = useRef(0.5);
  const inside = useRef(false);

  const [adding, setAdding] = useState(false);
  const [added,  setAdded]  = useState(false);

  const selectedVariant = product.variants?.[0];
  const displayPrice    = product.price ? `${Number(product.price).toFixed(2)} TND` : "See options";

  /* magnetic tilt */
  useEffect(() => {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const tick = () => {
      mx.current = lerp(mx.current, tx.current, 0.1);
      my.current = lerp(my.current, ty.current, 0.1);
      const dx = mx.current - 0.5;
      const dy = my.current - 0.5;
      if (cardRef.current)
        cardRef.current.style.transform = `rotateX(${-dy * 16}deg) rotateY(${dx * 20}deg) scale(${inside.current ? 1.03 : 1})`;
      if (imgWrapRef.current)
        imgWrapRef.current.style.transform = `translate(${dx * 10}px, ${dy * 8}px)`;
      if (glowRef.current) {
        glowRef.current.style.background = `radial-gradient(ellipse 42% 36% at ${46 + dx * 22}% ${38 + dy * 18}%, rgba(200,150,255,0.14) 0%, transparent 72%)`;
        glowRef.current.style.opacity = inside.current ? "1" : "0";
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { router.push("/auth/login?from=/products"); return; }
    if (product.hasVariants) { router.push(`/products/${product.id}`); return; }
    setAdding(true);
    try {
      await cartApi.add(selectedVariant?.id ?? product.id, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch {
      router.push(`/products/${product.id}`);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div style={{ perspective:"900px" }}>
      <Link href={`/products/${product.id}`} style={{ textDecoration:"none" }} onClick={() => track("view", product.id)}>
        <div
          ref={cardRef}
          className="crystal-card"
          style={{ transformStyle:"preserve-3d", transition:"transform 0.1s ease-out" }}
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
          {/* Image */}
          <div style={{ aspectRatio:"1", overflow:"hidden", background:"var(--bg-secondary)", position:"relative" }}>
            <div ref={imgWrapRef} style={{ width:"110%", height:"110%", marginLeft:"-5%", marginTop:"-5%" }}>
              {product.images?.[0] ? (
                <img src={product.images[0]} alt={product.name}
                  style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
              ) : (
                <div style={{ width:"100%", height:"100%", background:"linear-gradient(135deg, var(--amber-honey), transparent)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:"2.5rem", opacity:0.3 }}>🧴</span>
                </div>
              )}
            </div>

            {/* Glow overlay */}
            <div ref={glowRef} style={{ position:"absolute", inset:0, pointerEvents:"none", opacity:0, transition:"opacity 0.35s" }} />

            {/* Skin type tags */}
            {product.skinType?.length > 0 && (
              <div style={{ position:"absolute", top:"0.75rem", left:"0.75rem", display:"flex", gap:"0.3rem", flexWrap:"wrap" }}>
                {product.skinType.slice(0, 2).map((st) => (
                  <span key={st} style={{
                    fontFamily:"var(--font-label)", fontSize:"0.5rem", letterSpacing:"0.08em",
                    textTransform:"uppercase", background:"rgba(7,5,10,0.8)",
                    color:"rgba(255,255,255,0.6)", padding:"0.25rem 0.5rem", backdropFilter:"blur(4px)",
                  }}>{st}</span>
                ))}
              </div>
            )}

            {/* Add to cart — appears on hover */}
            <div style={{
              position:"absolute", bottom:0, left:0, right:0, padding:"0.75rem",
              opacity: inside.current ? 1 : 0,
              transform: inside.current ? "translateY(0)" : "translateY(8px)",
              transition:"all 0.3s ease",
            }}>
              <button
                onClick={handleAddToCart} disabled={adding}
                style={{
                  width:"100%", fontFamily:"var(--font-label)", fontSize:"0.55rem",
                  letterSpacing:"0.15em", textTransform:"uppercase", padding:"0.7rem",
                  background: added ? "rgba(35,213,213,0.9)" : "rgba(255,95,31,0.9)",
                  color:"#000", border:"none", cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  gap:"0.5rem", transition:"all 0.3s",
                }}
              >
                <ShoppingBag size={12} />
                {adding ? "Adding…" : added ? "Added ✓" : product.hasVariants ? "Select Options" : "Add to Cart"}
              </button>
            </div>
          </div>

          <div className="crystal-card__depth" />

          {/* Info */}
          <div style={{ padding:"1rem 1.2rem 1.4rem", position:"relative", zIndex:3 }}>
            <p style={{ fontFamily:"var(--font-label)", fontSize:"0.52rem", letterSpacing:"0.15em", textTransform:"uppercase", color:"var(--amber-soft)", marginBottom:"0.35rem" }}>
              {product.brand}
            </p>
            <p style={{ fontFamily:"var(--font-display)", fontSize:"1.1rem", fontWeight:400, color:"var(--text-primary)", marginBottom:"0.6rem", lineHeight:1.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {product.name}
            </p>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <p style={{ fontFamily:"var(--font-label)", fontSize:"0.72rem", color:"var(--text-primary)", letterSpacing:"0.05em" }}>
                {displayPrice}
              </p>
              {Number(product.averageRating) > 0 && (
                <p style={{ fontSize:"0.72rem", color:"var(--amber)", letterSpacing:"0.03em" }}>
                  ★ {Number(product.averageRating).toFixed(1)}
                  <span style={{ color:"var(--text-muted)", marginLeft:"3px", fontSize:"0.65rem" }}>
                    ({product.reviewCount})
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}