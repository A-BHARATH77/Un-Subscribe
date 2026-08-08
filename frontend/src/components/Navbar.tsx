// @ts-nocheck
"use client";
export default function Navbar() {

  return (
    <>
<div className="navbar w-nav" data-animation="default" data-collapse="medium" data-duration="500" data-easing="ease-out" data-easing2="ease-in-back" data-no-scroll="1" data-w-id="9edf84aa-1c78-d247-2c17-fa546717f184" data-wf--navbar--variant="base" role="banner" suppressHydrationWarning>
<div className="padding-global is-navbar" suppressHydrationWarning>
<div className="container-large" suppressHydrationWarning>
<div className="navbar_content" suppressHydrationWarning>
<a animation="hero" aria-current="page" className="navbar_logo-link w-inline-block w--current" href="/" suppressHydrationWarning>
  <div className="navbar_logo" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', whiteSpace: 'nowrap', fontFamily: '"Plus Jakarta Sans", sans-serif', letterSpacing: '-0.02em' }} suppressHydrationWarning>UNSUB HERO</div>
</a>
<div className="nav_buttons-wrap" suppressHydrationWarning>
<div animation="hero" className="login-wrap hide-mobile-landscape" suppressHydrationWarning>
<a 
  href="/sign-in" 
  style={{
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1a1a1a',
    color: '#fff',
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid #333',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    fontSize: '0.9rem',
    fontWeight: '600',
    textDecoration: 'none',
    transition: 'all 0.2s',
    minWidth: '100px',
    textAlign: 'center'
  }}
  onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
  onMouseLeave={(e) => e.currentTarget.style.background = '#1a1a1a'}
>
  Sign up
</a>
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
