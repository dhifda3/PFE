"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "appear" | "grow" | "dive" | "done";

const STRIPE_PX = 2;
const COLORS = [
  "#00D4DC","#FF6B00","#C4622D","#00BFC9","#E05500",
  "#8B3A00","#5ECDD4","#FF8030","#007A82","#D95F00",
  "#00D4DC","#FF6B00","#AA4A1A","#009FA8","#FF7020",
  "#6B2D00","#00C4CC","#FF6B00","#C4622D","#00D4DC",
  "#FF6B00","#C4622D","#00BFC9","#E05500","#8B3A00",
];
const stops: string[] = [];
COLORS.forEach((c, i) => {
  stops.push(`${c} ${i * STRIPE_PX}px`, `${c} ${(i + 1) * STRIPE_PX}px`);
});
const BARCODE      = `repeating-linear-gradient(90deg,${stops.join(",")})`;
const STRIPE_TOTAL = COLORS.length * STRIPE_PX;

export default function IntroAnimation({ onComplete }: { onComplete?: () => void }) {
  const [phase,   setPhase]   = useState<Phase>("idle");
  const [iOrigin, setIOrigin] = useState("59%");

  const wordRef = useRef<HTMLDivElement>(null);
  const iRef    = useRef<HTMLSpanElement>(null);

  /**
   * Measure the exact pixel centre of the "I" inside the word using
   * offsetLeft / offsetWidth — these are pure layout values and are
   * completely unaffected by any CSS transform applied to the element
   * or its ancestors, unlike getBoundingClientRect().
   *
   * Requires position:relative on .li-word so the spans' offsetParent
   * resolves to the word container (not a higher ancestor).
   */
  useEffect(() => {
    const measure = () => {
      if (!wordRef.current || !iRef.current) return;
      const wWidth = wordRef.current.offsetWidth;
      if (wWidth === 0) return;
      // offsetLeft is relative to offsetParent (.li-word, which is position:relative)
      const cx = iRef.current.offsetLeft + iRef.current.offsetWidth / 2;
      setIOrigin(`${(cx / wWidth) * 100}%`);
    };

    measure();
    document.fonts.ready.then(measure);
  }, []);

  /* ── all phase delays ÷ 2.5 from previous version ── */
  useEffect(() => {
    const t = [
      setTimeout(() => setPhase("appear"),   40),
      setTimeout(() => setPhase("grow"),    280),
      setTimeout(() => setPhase("dive"),    840),
      setTimeout(() => { setPhase("done"); onComplete?.(); }, 1760),
    ];
    return () => t.forEach(clearTimeout);
  }, [onComplete]);

  if (phase === "done") return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@700&display=swap');

        .li {
          position:fixed; inset:0; z-index:9999;
          background:#000;
          display:flex; align-items:center; justify-content:center;
          overflow:hidden;
          perspective:1200px;
        }

        /* ── BEAMS: dark until you're close enough inside ── */
        .li-beams {
          position:absolute; inset:0;
          background-image:var(--barcode);
          background-size:${STRIPE_TOTAL}px 100%;
          transform-origin:var(--iox) center;
          pointer-events:none; z-index:2;
          opacity:0; filter:brightness(0);
          will-change:transform,opacity,filter;
        }

        /* beamDive ÷ 2.5 → 0.92s */
        .li.dive .li-beams {
          animation:beamDive .92s cubic-bezier(.3,0,1,1) forwards;
        }
        @keyframes beamDive {
          0%   { transform:scale(1)  translateZ(0);     opacity:0;    filter:brightness(0);   }
          35%  { transform:scale(3)  translateZ(0);     opacity:0.04; filter:brightness(0.04);}
          /* THRESHOLD — colour BLOOMS */
          55%  { transform:scale(7)  translateZ(300px); opacity:1;    filter:brightness(2.8); }
          72%  { transform:scale(14) translateZ(700px); opacity:0.85; filter:brightness(1.2); }
          100% { transform:scale(30) translateZ(1400px);opacity:0;    filter:brightness(0.4); }
        }

        /* vignette centred on the I, appears on dive */
        .li-vignette {
          position:absolute; inset:0;
          background:radial-gradient(ellipse 60% 55% at var(--iox) 50%,
            transparent 30%,#000 100%);
          pointer-events:none; z-index:6;
          opacity:0; transition:opacity .24s ease;
        }
        .li.dive .li-vignette { opacity:1; }

        /* ── LOGO ── */
        .li-logo {
          position:relative; z-index:10; text-align:center;
          mix-blend-mode:screen;
        }

        .li-word {
          font-family:'Syncopate',sans-serif;
          font-weight:700;
          font-size:clamp(3rem,10vw,7.5rem);
          letter-spacing:.5em; text-indent:.5em;
          color:#fff;
          display:flex; white-space:nowrap;
          opacity:0;
          /* position:relative makes .li-word the offsetParent for its
             child spans, so offsetLeft measurements are word-relative */
          position:relative;
          will-change:transform,text-shadow;
        }

        /* appear – tiny */
        .li.appear .li-word {
          transition:opacity .14s ease, transform .24s cubic-bezier(.2,.8,.3,1);
          opacity:1; transform:scale(0.20);
        }

        /* grow ÷ 2.5 → 0.56s, pivots from I */
        .li.grow .li-word {
          opacity:1;
          animation:wordGrow .56s cubic-bezier(.1,.55,.15,1) forwards;
        }
        @keyframes wordGrow {
          0%   {
            transform:scale(0.20);
            text-shadow:0 0 20px #00D4DC66;
          }
          35%  {
            transform:scale(0.6);
            text-shadow:
              0 0 40px #00D4DC,
              0 0 20px #00D4DCAA,
              0 0 90px #FF6B0077;
          }
          100% {
            transform:scale(1.55);
            text-shadow:
              0 0 70px #00D4DC,
              0 0 45px #00D4DCEE,
              0 0 160px #FF6B00CC,
              0 0 280px #C4622D88;
          }
        }

        /* dive ÷ 2.5 → 0.92s, slow then ROCKETS */
        .li.dive .li-word {
          opacity:1;
          animation:wordDive .92s cubic-bezier(.25,0,1,.95) forwards;
        }
        @keyframes wordDive {
          0%   { transform:scale(1.55); opacity:1; }
          20%  { transform:scale(2.2);  opacity:1; }
          55%  { transform:scale(7);    opacity:.9; }
          75%  { transform:scale(16);   opacity:.5; }
          100% { transform:scale(32);   opacity:0; }
        }

        /* ── letter stagger ÷ 2.5 ── */
        .li-letter {
          display:inline-block;
          opacity:0; transform:translateY(12px);
        }
        .li.appear .li-letter,
        .li.grow   .li-letter,
        .li.dive   .li-letter {
          animation:letterIn .18s cubic-bezier(.2,.8,.4,1) forwards;
        }
        @keyframes letterIn {
          to { opacity:1; transform:translateY(0); }
        }

        /* the I glows cyan — marks the origin visually */
        .li-i {
          color:#fff;
        }
        .li.grow .li-i,
        .li.dive .li-i {
          text-shadow:
            0 0 30px #00D4DC,
            0 0 60px #00D4DCCC !important;
        }

        /* ── bar ÷ 2.5 ── */
        .li-bar {
          height:2px; width:0;
          margin:14px auto 0;
          background:linear-gradient(90deg,#8B3A00,#FF6B00,#00D4DC);
          border-radius:2px; box-shadow:none;
          transition:width .4s cubic-bezier(.4,0,.2,1) .12s,
                     box-shadow .4s ease .12s;
        }
        .li.appear .li-bar,
        .li.grow   .li-bar,
        .li.dive   .li-bar {
          width:115%;
          box-shadow:0 0 26px #00D4DCAA,0 0 14px #FF6B0088;
        }

        /* ── shell fade ÷ 2.5 → 0.44s at 0.76s ── */
        .li.dive {
          animation:shellFade .44s cubic-bezier(.7,0,1,1) .76s forwards;
        }
        @keyframes shellFade {
          to { opacity:0; pointer-events:none; }
        }

        /* scanlines */
        .li-scan {
          position:absolute; inset:0; pointer-events:none; z-index:20;
          background:repeating-linear-gradient(
            0deg,transparent,transparent 3px,
            rgba(0,0,0,.05) 3px,rgba(0,0,0,.05) 4px);
        }
      `}</style>

      <div
        className={`li ${phase}`}
        style={{ "--iox": iOrigin, "--barcode": BARCODE } as React.CSSProperties}
      >
        <div className="li-scan" />
        <div className="li-beams" />
        <div className="li-vignette" />

        <div className="li-logo">
          <div
            className="li-word"
            ref={wordRef}
            style={{ transformOrigin: `${iOrigin} 50%` }}
            aria-label="LUMINA"
          >
            {/* LUM */}
            {["L","U","M"].map((ch, i) => (
              <span
                key={ch + i}
                className="li-letter"
                style={{ animationDelay: `${i * 26 + 10}ms` }}
              >{ch}</span>
            ))}

            {/* I — the scale pivot letter */}
            <span
              ref={iRef}
              className="li-letter li-i"
              style={{ animationDelay: `${3 * 26 + 10}ms` }}
            >I</span>

            {/* NA */}
            {["N","A"].map((ch, i) => (
              <span
                key={ch + i}
                className="li-letter"
                style={{ animationDelay: `${(i + 4) * 26 + 10}ms` }}
              >{ch}</span>
            ))}
          </div>
          <div className="li-bar" />
        </div>
      </div>
    </>
  );
}