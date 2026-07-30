// @ts-nocheck
"use client";
import { useState } from "react";

export default function Navbar() {
  const [copied, setCopied] = useState(false);

  return (
    <>
<div className="navbar w-nav" data-animation="default" data-collapse="medium" data-duration="500" data-easing="ease-out" data-easing2="ease-in-back" data-no-scroll="1" data-w-id="9edf84aa-1c78-d247-2c17-fa546717f184" data-wf--navbar--variant="base" role="banner" suppressHydrationWarning>
<div className="padding-global is-navbar" suppressHydrationWarning>
<div className="container-large" suppressHydrationWarning>
<div className="navbar_content" suppressHydrationWarning>
<a animation="hero" aria-current="page" className="navbar_logo-link w-inline-block w--current" href="/" suppressHydrationWarning>
  <div className="navbar_logo" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', whiteSpace: 'nowrap', fontFamily: '"Plus Jakarta Sans", sans-serif', letterSpacing: '-0.02em' }} suppressHydrationWarning>UNSUB HERO</div>
</a>
<div className="nav_wrap" suppressHydrationWarning>
<nav className="nav_mobile w-nav-menu" role="navigation" suppressHydrationWarning>
<div className="navbar_list" suppressHydrationWarning>
<a animation="hero" className="nav_links w-nav-link" href="/" suppressHydrationWarning>Home</a>
<a animation="hero" className="nav_links w-nav-link" href="#features" suppressHydrationWarning>Features</a>
<a animation="hero" className="nav_links w-nav-link" href="#pricing" suppressHydrationWarning>Pricing</a>
<a animation="hero" className="nav_links w-nav-link" href="#about" suppressHydrationWarning>About Us</a>
</div>
</nav>
</div>
<div className="nav_buttons-wrap" suppressHydrationWarning>
<div animation="hero" className="login-wrap hide-mobile-landscape" suppressHydrationWarning>
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
      transition: 'all 0.2s'
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
<div className="menu-button w-nav-button" suppressHydrationWarning>
<div className="nav-button_component" suppressHydrationWarning>
<div className="nav-button_line is-first" suppressHydrationWarning></div>
<div className="nav-button_line is-second" suppressHydrationWarning></div>
<div className="nav-button_line is-third" suppressHydrationWarning></div>
</div>
</div>
</div>
</div>
</div>
</div>
</div>
    </>
  );
}
