"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { productsApi, cartApi, wishlistApi } from "@/lib/api";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useSignal } from "@/hooks/useSignal";
import { useTheme } from "@/components/ui/ThemeContext";
import { Loader2, ShoppingBag, Heart, ArrowLeft, Star } from "lucide-react";

/* ── Animated gradient orb background ──────────────────────────────────── */
function AnimatedGradientBG({ isDark }: { isDark: boolean }) {
  return (
    <>
      <style>{`
        @keyframes pd-orb1 {
          0%   { transform: translate(0%, 0%)   scale(1); }
          33%  { transform: translate(8%, -12%) scale(1.15); }
          66%  { transform: translate(-6%, 10%) scale(0.9); }
          100% { transform: translate(0%, 0%)   scale(1); }
        }
        @keyframes pd-orb2 {
          0%   { transform: translate(0%, 0%)   scale(1); }
          33%  { transform: translate(-10%, 8%) scale(1.2); }
          66%  { transform: translate(7%, -9%)  scale(0.85); }
          100% { transform: translate(0%, 0%)   scale(1); }
        }
        @keyframes pd-orb3 {
          0%   { transform: translate(0%, 0%)   scale(1); }
          50%  { transform: translate(12%, 6%)  scale(1.1); }
          100% { transform: translate(0%, 0%)   scale(1); }
        }
        @keyframes pd-fade-in {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pd-img-in {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        .pd-animate     { animation: pd-fade-in 0.55s ease both; }
        .pd-animate-img { animation: pd-img-in  0.6s  ease both; }
        .pd-delay-1 { animation-delay: 0.08s; }
        .pd-delay-2 { animation-delay: 0.16s; }
        .pd-delay-3 { animation-delay: 0.24s; }
        .pd-delay-4 { animation-delay: 0.32s; }
        .pd-delay-5 { animation-delay: 0.40s; }
        .star-btn { background: none; border: none; padding: 2px; cursor: pointer; transition: transform 0.15s; }
        .star-btn:hover { transform: scale(1.2); }
      `}</style>

      <div style={{ position:'fixed', top:'-18%', right:'-18%', width:'60%', height:'60%',
        background: isDark
          ? 'radial-gradient(ellipse, rgba(255,95,31,0.18) 0%, rgba(255,140,0,0.08) 45%, transparent 70%)'
          : 'radial-gradient(ellipse, rgba(255,95,31,0.12) 0%, rgba(255,140,0,0.05) 45%, transparent 70%)',
        filter:'blur(60px)', animation:'pd-orb1 16s ease-in-out infinite', pointerEvents:'none', zIndex:0 }} />

      <div style={{ position:'fixed', bottom:'-15%', left:'-15%', width:'55%', height:'55%',
        background: isDark
          ? 'radial-gradient(ellipse, rgba(0,170,255,0.18) 0%, rgba(0,120,220,0.08) 45%, transparent 72%)'
          : 'radial-gradient(ellipse, rgba(0,150,255,0.45) 0%, rgba(0,100,220,0.22) 45%, transparent 72%)',
        filter:'blur(60px)', animation:'pd-orb2 20s ease-in-out infinite', pointerEvents:'none', zIndex:0 }} />

      <div style={{ position:'fixed', top:'45%', right:'20%', width:'35%', height:'35%',
        background: isDark
          ? 'radial-gradient(ellipse, rgba(255,180,50,0.07) 0%, transparent 65%)'
          : 'radial-gradient(ellipse, rgba(255,160,30,0.06) 0%, transparent 65%)',
        filter:'blur(50px)', animation:'pd-orb3 25s ease-in-out infinite', pointerEvents:'none', zIndex:0 }} />
    </>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span style={{
      fontFamily:"'Syncopate', sans-serif", fontSize:'0.45rem',
      letterSpacing:'0.18em', textTransform:'uppercase',
      color:'var(--ap-text-faint)', border:'1px solid var(--ap-divider)',
      padding:'0.35rem 0.75rem', display:'inline-block',
    }}>
      {label}
    </span>
  );
}

/* ── Star row (interactive or display) ─────────────────────────────────── */
function StarRow({
  value, max = 5, size = 14, interactive = false, onChange,
}: {
  value: number; max?: number; size?: number;
  interactive?: boolean; onChange?: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display:'flex', gap:'2px' }}>
      {Array.from({ length: max }, (_, i) => i + 1).map((s) => {
        const filled = s <= (interactive ? (hovered || value) : value);
        return (
          <button
            key={s}
            className={interactive ? "star-btn" : undefined}
            style={{ background:'none', border:'none', padding:'2px',
              cursor: interactive ? 'pointer' : 'default',
              transition: interactive ? 'transform 0.15s' : undefined }}
            onClick={() => interactive && onChange?.(s)}
            onMouseEnter={() => interactive && setHovered(s)}
            onMouseLeave={() => interactive && setHovered(0)}
            type="button"
          >
            <Star size={size} style={{
              fill:  filled ? '#FF5F1F' : 'transparent',
              color: filled ? '#FF5F1F' : 'var(--ap-divider)',
              transition:'fill 0.15s, color 0.15s',
            }} />
          </button>
        );
      })}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */
export default function ProductDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();
  const { track } = useSignal();
  const { theme } = useTheme();
  const isDark    = theme === "dark";
  const { user }  = useAuthStore();

  const [product, setProduct]                   = useState<any>(null);
  const [variants, setVariants]                 = useState<any[]>([]);
  const [selectedVariant, setSelectedVariant]   = useState<any>(null);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState<string | null>(null);
  const [adding, setAdding]                     = useState(false);
  const [added, setAdded]                       = useState(false);
  const [wishlisting, setWishlisting]           = useState(false);
  const [wishlisted, setWishlisted]             = useState(false);
  const [imgLoaded, setImgLoaded]               = useState(false);
  const [activeImg, setActiveImg]               = useState(0);

  /* reviews */
  const [reviews, setReviews]       = useState<any[]>([]);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitDone, setSubmitDone] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      productsApi.getById(id),
      productsApi.getVariants(id).catch(() => ({ data: { data: [] } })),
      api.get(`/api/reviews/product/${id}`).catch(() => ({ data: { data: [] } })),
    ])
      .then(([pRes, vRes, rRes]) => {
        const p = pRes.data?.data ?? pRes.data;
        const v = vRes.data?.data ?? vRes.data ?? [];
        const r = rRes.data?.data ?? rRes.data ?? [];
        setProduct(p);
        setVariants(Array.isArray(v) ? v : []);
        setSelectedVariant(Array.isArray(v) ? v.find((x: any) => x.isDefault) ?? v[0] ?? null : null);
        setReviews(Array.isArray(r) ? r.filter((rv: any) => rv.isApproved !== false) : []);
        track("view", id);
      })
      .catch((err) => setError(err?.response?.data?.error ?? "Product not found"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = async () => {
    if (!product) return;
    setAdding(true);
    try {
      await cartApi.add(product.id, 1, selectedVariant?.id);
      track("cart", id);
      setAdded(true);
      setTimeout(() => setAdded(false), 2200);
    } catch (err: any) {
      if (err?.response?.status === 401) router.push("/auth/login");
    } finally {
      setAdding(false);
    }
  };

  const handleWishlist = async () => {
    if (!product) return;
    setWishlisting(true);
    try {
      if (wishlisted) {
        await wishlistApi.remove(product.id);
        setWishlisted(false);
      } else {
        await wishlistApi.add(product.id);
        track("wishlist", id);
        setWishlisted(true);
      }
    } catch (err: any) {
      if (err?.response?.status === 401) router.push("/auth/login");
    } finally {
      setWishlisting(false);
    }
  };

  const handleSubmitReview = async () => {
    if (reviewRating === 0) { setSubmitError("Please select a star rating."); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      await api.post("/api/reviews", {
        productId: id,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      /* refresh reviews */
      const rRes = await api.get(`/api/reviews/product/${id}`);
      const r = rRes.data?.data ?? rRes.data ?? [];
      setReviews(Array.isArray(r) ? r.filter((rv: any) => rv.isApproved !== false) : []);
      setSubmitDone(true);
      setReviewRating(0);
      setReviewComment("");
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message ?? "Could not submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── already reviewed by this user? ── */
  const alreadyReviewed = user && reviews.some((r) => r.userId === user.id);

  /* ── loading / error ── */
  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--ap-bg)' }}>
      <AnimatedGradientBG isDark={isDark} />
      <div style={{ textAlign:'center', position:'relative', zIndex:1 }}>
        <Loader2 size={28} style={{ color:'#FF5F1F', animation:'spin 1s linear infinite', margin:'0 auto 1rem' }} />
        <p style={{ fontFamily:"'Syncopate', sans-serif", fontSize:'0.5rem', letterSpacing:'0.3em', textTransform:'uppercase', color:'var(--ap-text-muted)' }}>
          Loading
        </p>
      </div>
    </div>
  );

  if (error || !product) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--ap-bg)' }}>
      <AnimatedGradientBG isDark={isDark} />
      <div style={{ textAlign:'center', position:'relative', zIndex:1 }}>
        <p style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:'2.5rem', fontWeight:300, color:'var(--ap-text)', marginBottom:'1rem' }}>
          {error ?? "Product not found"}
        </p>
        <button onClick={() => router.back()} style={{ fontFamily:"'Syncopate', sans-serif", fontSize:'0.55rem', letterSpacing:'0.2em', textTransform:'uppercase', color:'#FF5F1F', background:'none', border:'none', cursor:'pointer' }}>
          ← Go back
        </button>
      </div>
    </div>
  );

  const price  = selectedVariant?.price ?? product.price ?? "-";
  const images: string[] = product.images ?? [];
  const image  = images[activeImg] ?? images[0];
  const rating = product.avgRating ?? product.rating ?? null;

  /* aggregate from loaded reviews if no server rating */
  const displayRating = rating ?? (reviews.length
    ? (reviews.reduce((s: number, r: any) => s + Number(r.rating), 0) / reviews.length)
    : null);

  return (
    <div style={{ minHeight:'100vh', background:'var(--ap-bg)', position:'relative', overflow:'hidden' }}>
      <AnimatedGradientBG isDark={isDark} />

      <div style={{ position:'relative', zIndex:1, maxWidth:'1200px', margin:'0 auto', padding:'2.5rem 2rem 5rem' }}>

        {/* Back */}
        <button onClick={() => router.back()} className="pd-animate"
          style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:'none', border:'none', cursor:'pointer', fontFamily:"'Syncopate', sans-serif", fontSize:'0.5rem', letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--ap-text-muted)', marginBottom:'3.5rem', padding:0, transition:'color 0.3s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#FF5F1F')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--ap-text-muted)')}>
          <ArrowLeft size={12} /> Back
        </button>

        {/* Main grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6rem', alignItems:'start' }} className="product-grid">
          <style>{`
            @media (max-width: 768px) {
              .product-grid { grid-template-columns: 1fr !important; gap: 3rem !important; }
              .thumb-row { display: none !important; }
            }
          `}</style>

          {/* ── Left: image ── */}
          <div className="pd-animate-img">
            <div style={{ aspectRatio:'3/4', background:'var(--ap-input-bg)', overflow:'hidden', position:'relative' }}>
              {image ? (
                <img src={image} alt={product.name} onLoad={() => setImgLoaded(true)}
                  style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform 0.6s ease', opacity: imgLoaded ? 1 : 0, transitionProperty:'transform, opacity' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
              ) : (
                <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Syncopate', sans-serif", fontSize:'0.5rem', letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--ap-text-faint)' }}>
                  No image
                </div>
              )}
              {product.category?.name && (
                <div style={{ position:'absolute', top:'1.25rem', left:'1.25rem', background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)', backdropFilter:'blur(8px)', padding:'0.4rem 0.85rem', fontFamily:"'Syncopate', sans-serif", fontSize:'0.45rem', letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--ap-text-muted)' }}>
                  {product.category.name}
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="thumb-row" style={{ display:'flex', gap:'0.75rem', marginTop:'0.75rem' }}>
                {images.map((img, i) => (
                  <button key={i} onClick={() => setActiveImg(i)} style={{ width:'72px', height:'72px', flexShrink:0, border:`1px solid ${activeImg === i ? '#FF5F1F' : 'var(--ap-divider)'}`, padding:0, background:'none', cursor:'pointer', overflow:'hidden', transition:'border-color 0.3s' }}>
                    <img src={img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: info ── */}
          <div>
            <p className="pd-animate pd-delay-1" style={{ fontFamily:"'Syncopate', sans-serif", fontSize:'0.5rem', letterSpacing:'0.3em', textTransform:'uppercase', color:'var(--ap-accent)', marginBottom:'0.85rem', opacity:0.9 }}>
              {product.brand ?? "LUMINA"}
            </p>

            <h1 className="pd-animate pd-delay-1" style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:'clamp(2.2rem,4vw,3.5rem)', fontWeight:300, lineHeight:1.1, color:'var(--ap-text)', marginBottom:'1rem' }}>
              {product.name}
            </h1>

            {/* Rating display */}
            {displayRating !== null && (
              <div className="pd-animate pd-delay-2" style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1.5rem' }}>
                <StarRow value={Math.round(Number(displayRating))} size={13} />
                <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:'0.8rem', color:'var(--ap-text-muted)' }}>
                  {Number(displayRating).toFixed(1)}
                  {reviews.length > 0 && (
                    <span style={{ marginLeft:'4px' }}>({reviews.length})</span>
                  )}
                </span>
              </div>
            )}

            {/* Price */}
            <p className="pd-animate pd-delay-2" style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:'2.2rem', fontWeight:400, color:'var(--ap-text)', marginBottom:'1.75rem', letterSpacing:'-0.01em' }}>
              {price} DT
            </p>

            <div className="pd-animate pd-delay-2" style={{ height:'1px', background:'var(--ap-divider)', marginBottom:'1.75rem' }} />

            {/* Description */}
            <p className="pd-animate pd-delay-3" style={{ fontFamily:"'DM Sans', sans-serif", fontSize:'0.9rem', lineHeight:1.75, color:'var(--ap-text-muted)', marginBottom:'2rem' }}>
              {product.description}
            </p>

            {/* Variants */}
            {variants.length > 0 && (
              <div className="pd-animate pd-delay-3" style={{ marginBottom:'2rem' }}>
                <p style={{ fontFamily:"'Syncopate', sans-serif", fontSize:'0.5rem', letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--ap-text-muted)', marginBottom:'0.85rem' }}>
                  Select variant
                </p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'0.6rem' }}>
                  {variants.map((v: any) => {
                    const isSel = selectedVariant?.id === v.id;
                    return (
                      <button key={v.id} onClick={() => setSelectedVariant(v)} style={{ padding:'0.6rem 1.1rem', border:`1px solid ${isSel ? '#FF5F1F' : 'var(--ap-divider)'}`, background: isSel ? 'rgba(255,95,31,0.08)' : 'transparent', color: isSel ? '#FF5F1F' : 'var(--ap-text-muted)', fontFamily:"'DM Sans', sans-serif", fontSize:'0.8rem', cursor:'pointer', transition:'all 0.25s', outline:'none' }}
                        onMouseEnter={e => { if (!isSel) { e.currentTarget.style.borderColor = 'var(--ap-text-muted)'; e.currentTarget.style.color = 'var(--ap-text)'; } }}
                        onMouseLeave={e => { if (!isSel) { e.currentTarget.style.borderColor = 'var(--ap-divider)'; e.currentTarget.style.color = 'var(--ap-text-muted)'; } }}>
                        {v.name}{v.price ? ` — ${v.price} DT` : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CTA row */}
            <div className="pd-animate pd-delay-4" style={{ display:'flex', gap:'0.75rem', marginBottom:'2rem' }}>
              <button onClick={handleAddToCart} disabled={adding}
                style={{ flex:1, background: added ? 'rgba(255,95,31,0.15)' : '#FF5F1F', border: added ? '1px solid rgba(255,95,31,0.5)' : '1px solid #FF5F1F', color: added ? '#FF5F1F' : '#fff', fontFamily:"'Syncopate', sans-serif", fontSize:'0.58rem', letterSpacing:'0.2em', textTransform:'uppercase', padding:'1.1rem 1.5rem', cursor: adding ? 'not-allowed' : 'pointer', opacity: adding ? 0.7 : 1, transition:'all 0.3s', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.6rem' }}
                onMouseEnter={e => { if (!adding && !added) e.currentTarget.style.boxShadow = '0 0 40px rgba(255,95,31,0.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}>
                {adding ? <Loader2 size={14} style={{ animation:'spin 1s linear infinite' }} /> : <ShoppingBag size={14} />}
                {adding ? "Adding…" : added ? "Added to cart" : "Add to cart"}
              </button>

              {/* Heart — only for logged-in users */}
              {user && (
                <button onClick={handleWishlist} disabled={wishlisting}
                  style={{ width:'56px', flexShrink:0, background: wishlisted ? 'rgba(255,95,31,0.08)' : 'transparent', border:`1px solid ${wishlisted ? 'rgba(255,95,31,0.5)' : 'var(--ap-divider)'}`, color: wishlisted ? '#FF5F1F' : 'var(--ap-text-muted)', cursor: wishlisting ? 'not-allowed' : 'pointer', opacity: wishlisting ? 0.6 : 1, transition:'all 0.3s', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}
                  onMouseEnter={e => { if (!wishlisting) { e.currentTarget.style.borderColor = 'rgba(255,95,31,0.5)'; e.currentTarget.style.color = '#FF5F1F'; } }}
                  onMouseLeave={e => { if (!wishlisted) { e.currentTarget.style.borderColor = 'var(--ap-divider)'; e.currentTarget.style.color = 'var(--ap-text-muted)'; } }}>
                  <Heart size={16} style={{ fill: wishlisted ? '#FF5F1F' : 'transparent' }} />
                </button>
              )}
            </div>

            {/* Tags */}
            <div className="pd-animate pd-delay-5" style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem' }}>
              {["Free shipping", "30-day returns", "Dermatologist tested"].map(t => <Tag key={t} label={t} />)}
            </div>

            {product.sku && (
              <p className="pd-animate pd-delay-5" style={{ fontFamily:"'Syncopate', sans-serif", fontSize:'0.45rem', letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--ap-text-faint)', marginTop:'2rem' }}>
                SKU: {product.sku}
              </p>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════
            Reviews section
        ════════════════════════════════════════ */}
        <div style={{ marginTop:'5rem' }}>
          <div style={{ height:'1px', background:'var(--ap-divider)', marginBottom:'3rem' }} />

          <p style={{ fontFamily:"'Syncopate', sans-serif", fontSize:'0.55rem', letterSpacing:'0.3em', textTransform:'uppercase', color:'var(--ap-text-muted)', marginBottom:'0.75rem' }}>
            Reviews
          </p>
          <h2 style={{ fontFamily:"'Cormorant Garamond', serif", fontSize:'2.2rem', fontWeight:300, color:'var(--ap-text)', marginBottom:'2.5rem' }}>
            What customers say
          </h2>

          {/* ── Write a review (logged-in only) ── */}
          {user && !alreadyReviewed && (
            <div style={{ background:'var(--ap-input-bg)', border:'1px solid var(--ap-divider)', padding:'2rem', marginBottom:'2.5rem' }}>
              <p style={{ fontFamily:"'Syncopate', sans-serif", fontSize:'0.5rem', letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--ap-accent)', marginBottom:'1.25rem' }}>
                Leave a review
              </p>

              {/* Star picker */}
              <div style={{ marginBottom:'1.25rem' }}>
                <p style={{ fontFamily:"'Syncopate', sans-serif", fontSize:'0.45rem', letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--ap-text-muted)', marginBottom:'0.6rem' }}>
                  Your rating
                </p>
                <StarRow value={reviewRating} size={22} interactive onChange={setReviewRating} />
              </div>

              {/* Comment */}
              <div style={{ marginBottom:'1.25rem' }}>
                <p style={{ fontFamily:"'Syncopate', sans-serif", fontSize:'0.45rem', letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--ap-text-muted)', marginBottom:'0.6rem' }}>
                  Comment (optional)
                </p>
                <textarea
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  rows={4}
                  placeholder="Share your experience…"
                  style={{ width:'100%', background:'transparent', border:'1px solid var(--ap-divider)', color:'var(--ap-text)', fontFamily:"'DM Sans', sans-serif", fontSize:'0.9rem', padding:'0.9rem 1rem', outline:'none', resize:'vertical', lineHeight:1.6 }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--ap-accent)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--ap-divider)')}
                />
              </div>

              {submitError && (
                <p style={{ fontSize:'0.8rem', color:'#F89880', marginBottom:'1rem' }}>{submitError}</p>
              )}
              {submitDone && (
                <p style={{ fontSize:'0.8rem', color:'var(--ap-accent)', marginBottom:'1rem' }}>Review submitted — thank you!</p>
              )}

              <button onClick={handleSubmitReview} disabled={submitting}
                style={{ background:'#FF5F1F', border:'none', color:'#fff', fontFamily:"'Syncopate', sans-serif", fontSize:'0.55rem', letterSpacing:'0.2em', textTransform:'uppercase', padding:'0.9rem 2rem', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, transition:'all 0.3s', display:'flex', alignItems:'center', gap:'0.5rem' }}
                onMouseEnter={e => { if (!submitting) e.currentTarget.style.boxShadow = '0 0 30px rgba(255,95,31,0.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}>
                {submitting && <Loader2 size={13} style={{ animation:'spin 1s linear infinite' }} />}
                {submitting ? "Submitting…" : "Submit Review"}
              </button>
            </div>
          )}

          {user && alreadyReviewed && (
            <div style={{ border:'1px solid var(--ap-divider)', padding:'1.25rem 1.5rem', marginBottom:'2.5rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <Star size={14} style={{ fill:'#FF5F1F', color:'#FF5F1F' }} />
              <p style={{ fontFamily:"'Syncopate', sans-serif", fontSize:'0.45rem', letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--ap-text-muted)' }}>
                You've already reviewed this product
              </p>
            </div>
          )}

          {!user && (
            <div style={{ border:'1px solid var(--ap-divider)', padding:'1.25rem 1.5rem', marginBottom:'2.5rem' }}>
              <p style={{ fontFamily:"'DM Sans', sans-serif", fontSize:'0.85rem', color:'var(--ap-text-muted)' }}>
                <button onClick={() => router.push(`/auth/login?from=/products/${id}`)}
                  style={{ background:'none', border:'none', color:'#FF5F1F', cursor:'pointer', fontFamily:"inherit", fontSize:'inherit', padding:0, textDecoration:'underline' }}>
                  Sign in
                </button>
                {" "}to leave a review.
              </p>
            </div>
          )}

          {/* ── Review list ── */}
          {reviews.length === 0 ? (
            <p style={{ fontFamily:"'DM Sans', sans-serif", fontSize:'0.9rem', color:'var(--ap-text-faint)', padding:'2rem 0' }}>
              No reviews yet — be the first.
            </p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
              {reviews.map((r: any) => (
                <div key={r.id} style={{ borderBottom:'1px solid var(--ap-divider)', paddingBottom:'1.5rem' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.6rem' }}>
                    <StarRow value={Number(r.rating)} size={13} />
                    <span style={{ fontFamily:"'Syncopate', sans-serif", fontSize:'0.42rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--ap-text-faint)' }}>
                      {new Date(r.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}
                    </span>
                  </div>
                  {r.comment && (
                    <p style={{ fontFamily:"'DM Sans', sans-serif", fontSize:'0.9rem', lineHeight:1.7, color:'var(--ap-text-muted)' }}>
                      {r.comment}
                    </p>
                  )}
                  {r.isVerifiedPurchase && (
                    <p style={{ fontFamily:"'Syncopate', sans-serif", fontSize:'0.4rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--ap-accent)', marginTop:'0.5rem', opacity:0.7 }}>
                      Verified purchase
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}