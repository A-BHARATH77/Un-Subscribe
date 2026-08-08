// @ts-nocheck
"use client";
import { useState, useEffect, useRef } from "react";
import gsap from "gsap";

export default function Hero() {
  const [copied, setCopied] = useState(false);
  const cloudRef = useRef(null);

  useEffect(() => {
    // We wait for the component to mount, then start the animation.
    // Using string values for vw ensures it works safely with Next.js SSR.
    let ctx = gsap.context(() => {
      gsap.fromTo(
        cloudRef.current,
        { x: "100vw" },
        {
          x: "-100vw",
          ease: "none",
          duration: 25,
          repeat: -1,
        }
      );
    });
    return () => ctx.revert(); // Cleanup on unmount
  }, []);

  return (
    <>
<section className="section_hero" data-anim="hero" suppressHydrationWarning style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
<div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, overflow: 'hidden' }}>
  <img 
    ref={cloudRef}
    src="/clouds.png" 
    alt="" 
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      height: '100%',
      width: 'auto',
      minWidth: '100vw',
      objectFit: 'cover',
      opacity: 0.8,
      display: 'block'
    }}
  />
</div>
<div animation="wrap" className="hero_wrap" suppressHydrationWarning style={{ marginTop: '-60px', position: 'relative', zIndex: 10 }}>
<div className="padding-global is-hero" suppressHydrationWarning>
<div className="vertical-center" suppressHydrationWarning>
<h1 className="text-align-center" hero-text="" suppressHydrationWarning>
                  Forward and<br/><span className="opacity-73" suppressHydrationWarning>forget.</span>
</h1>
<div className="spacer-medium" suppressHydrationWarning></div>
<div className="max-width-medium" suppressHydrationWarning>
<div className="text-base text-color-on-primary text-align-center" hero-text="" suppressHydrationWarning>
                    You forward an email, and that sender is permanently killed from your inbox. No dashboards to manage, no apps to install, and absolutely no granting third-party OAuth access.
                  </div>
</div>
<div className="spacer-huge" suppressHydrationWarning></div>
<div className="button_wrapper is-hero" style={{ justifyContent: 'center' }} suppressHydrationWarning>
  <button 
    onClick={() => {
      navigator.clipboard.writeText('Unsubscribe@unsubhero.com');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: '#1a1a1a',
      color: '#fff',
      padding: '10px 16px',
      borderRadius: '8px',
      border: '1px solid #333',
      cursor: 'pointer',
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '0.9rem',
      fontWeight: '600',
      transition: 'all 0.2s',
      margin: '0 auto'
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = '#333'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = '#1a1a1a'; }}
  >
    <span>Unsubscribe@unsubhero.com</span>
    {copied ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    ) : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    )}
  </button>
</div>
</div>
</div>
</div>
<div className="spacer" suppressHydrationWarning>
<div className="spacer-desktop" style={{ 'height': '4rem' }} suppressHydrationWarning></div>
<div className="spacer-tablet" style={{ 'height': '5rem' }} suppressHydrationWarning></div>
<div className="spacer-mobile" style={{ 'height': '5rem' }} suppressHydrationWarning></div>
</div>
<div animation="visual" className="_3d" suppressHydrationWarning>
<div className="wrap" suppressHydrationWarning>
<div className="group first" suppressHydrationWarning>
<div className="img3d" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007e9793bec9aef0bae6_card.avif" suppressHydrationWarning />
</div>
<div className="img3d is-first" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007db9ab99a268357410_card-3.avif" suppressHydrationWarning />
</div>
<div className="img3d is-second" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007d21f950db130e28c9_card-6.avif" suppressHydrationWarning />
</div>
<div className="img3d is-third" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007e9793bec9aef0bae6_card.avif" suppressHydrationWarning />
</div>
<div className="img3d is-fourth" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007db9ab99a268357410_card-3.avif" suppressHydrationWarning />
</div>
<div className="img3d is-fifth" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007d21f950db130e28c9_card-6.avif" suppressHydrationWarning />
</div>
<div className="img3d is-fifth" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007e9793bec9aef0bae6_card.avif" suppressHydrationWarning />
</div>
<div className="img3d is-six" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007db9ab99a268357410_card-3.avif" suppressHydrationWarning />
</div>
<div className="img3d is-seven" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007d21f950db130e28c9_card-6.avif" suppressHydrationWarning />
</div>
</div>
<div className="group second" suppressHydrationWarning>
<div className="img3d" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007eb87553c5aa32934f_card-1.avif" suppressHydrationWarning />
</div>
<div className="img3d is-first" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007e27ef20e6e3edd02e_card-4.avif" suppressHydrationWarning />
</div>
<div className="img3d is-second" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007e9468539ba66cdd61_card-7.avif" suppressHydrationWarning />
</div>
<div className="img3d is-third" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007eb87553c5aa32934f_card-1.avif" suppressHydrationWarning />
</div>
<div className="img3d is-fourth" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007e27ef20e6e3edd02e_card-4.avif" suppressHydrationWarning />
</div>
<div className="img3d is-fifth" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007e9468539ba66cdd61_card-7.avif" suppressHydrationWarning />
</div>
<div className="img3d is-fifth" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007eb87553c5aa32934f_card-1.avif" suppressHydrationWarning />
</div>
<div className="img3d is-six" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007e27ef20e6e3edd02e_card-4.avif" suppressHydrationWarning />
</div>
<div className="img3d is-seven" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007e9468539ba66cdd61_card-7.avif" suppressHydrationWarning />
</div>
</div>
<div className="group third" suppressHydrationWarning>
<div className="img3d" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007dd38878bbefc784aa_card-8.avif" suppressHydrationWarning />
</div>
<div className="img3d is-first" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007d920bdd6882dc8eb7_card-2.avif" suppressHydrationWarning />
</div>
<div className="img3d is-second" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007d1354bb8698409c38_card-5.avif" suppressHydrationWarning />
</div>
<div className="img3d is-third" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007dd38878bbefc784aa_card-8.avif" suppressHydrationWarning />
</div>
<div className="img3d is-fourth" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007d920bdd6882dc8eb7_card-2.avif" suppressHydrationWarning />
</div>
<div className="img3d is-fifth" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007d1354bb8698409c38_card-5.avif" suppressHydrationWarning />
</div>
<div className="img3d is-fifth" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007dd38878bbefc784aa_card-8.avif" suppressHydrationWarning />
</div>
<div className="img3d is-six" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007d920bdd6882dc8eb7_card-2.avif" suppressHydrationWarning />
</div>
<div className="img3d is-seven" suppressHydrationWarning>
<img alt="" className="image3d" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007d1354bb8698409c38_card-5.avif" suppressHydrationWarning />
</div>
</div>
</div>
</div>
<img alt="" className="img is-hero" hero-bg="" loading="lazy" src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/6929d3408e9ff6a515b9eee8_ai-hero%20(1).avif" suppressHydrationWarning />
<div className="_3d_spacer" suppressHydrationWarning></div>

</section>
    </>
  );
}
