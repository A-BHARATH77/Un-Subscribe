'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

type Tab = 'signin' | 'signup';

const ERROR_MESSAGES: Record<string, string> = {
  no_account:     'No account found for that Google address. Please create an account first.',
  already_exists: 'An account with that Google address already exists. Please sign in instead.',
  profile_error:  'Could not retrieve your Google profile. Please try again.',
};

function SignInContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('signin');
  const [name, setName] = useState('');

  // Read ?error= from the URL (set by Flask callback on failure)
  const urlError = searchParams.get('error') ?? '';
  const [pageError, setPageError] = useState(ERROR_MESSAGES[urlError] ?? '');

  // If the URL says already_exists, auto-switch to signin tab
  useEffect(() => {
    if (urlError === 'already_exists') setActiveTab('signin');
    if (urlError === 'no_account')     setActiveTab('signup');
  }, [urlError]);

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setPageError('');
    setName('');
    // Remove error param from URL without a reload
    window.history.replaceState({}, '', '/sign-in');
  };

  // Build the /authorize URL for signup (passes optional name)
  const signupHref = `/authorize?mode=signup${name.trim() ? `&name=${encodeURIComponent(name.trim())}` : ''}`;

  const style = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #ffffff;
      --surface: #ffffff;
      --border: #e2e8f0;
      --border-active: #8abce4;
      --text: #0f172a;
      --text-muted: #64748b;
      --accent: #438fcb;
      --accent-dark: #296b9e;
      --error: #ef4444;
      --btn-bg: #1a1a1a;
      --btn-hover: #333333;
    }

    .signin-root {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      padding: 16px;
      gap: 16px;
    }

    /* ── Left Panel ── */
    .left-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 40px;
      position: relative;
    }

    .form-container {
      width: 100%;
      max-width: 380px;
    }

    /* ── Logo ── */
    .logo { display:flex; align-items:center; gap:12px; margin-bottom:40px; }
    .logo-icon { 
      width:48px; height:48px; 
      background: var(--btn-bg); 
      border-radius:12px; 
      display:flex; align-items:center; justify-content:center; 
      color: white;
    }
    .logo-icon svg { width:24px; height:24px; }

    /* ── Headers ── */
    .tab-header { margin-bottom:32px; }
    .tab-header h1 { font-size:2rem; font-weight:700; letter-spacing:-.03em; line-height:1.2; margin-bottom:8px; color: var(--text); }
    .tab-header p { color:var(--text-muted); font-size:0.95rem; line-height:1.5; }

    /* ── Form elements ── */
    .form-group { margin-bottom:24px; }
    .form-label { display:block; font-size:0.85rem; font-weight:600; color:var(--text); margin-bottom:8px; }
    .form-input { 
      width:100%; padding:14px 16px; 
      background:#fff; border:1px solid var(--border); 
      border-radius:10px; color:var(--text); 
      font-family:'Plus Jakarta Sans',sans-serif; font-size:0.95rem; 
      outline:none; transition:all 0.2s; 
    }
    .form-input::placeholder { color:#94a3b8; }
    .form-input:focus { border-color:var(--border-active); box-shadow:0 0 0 4px rgba(67, 143, 203, 0.15); }

    /* ── Buttons ── */
    .btn-main {
      display:flex; align-items:center; justify-content:center; gap:12px;
      width:100%; padding:14px 20px;
      background: var(--btn-bg);
      border:none; border-radius:10px; color:#fff;
      font-family:'Plus Jakarta Sans',sans-serif; font-size:0.95rem; font-weight:600;
      cursor:pointer; text-decoration:none;
      transition:all 0.2s ease;
    }
    .btn-main:hover:not(.disabled) { background: var(--btn-hover); }
    .btn-main.disabled { opacity:0.6; cursor:not-allowed; }
    .btn-main svg { width:20px; height:20px; flex-shrink:0; fill: white; }

    .switch-hint { text-align:center; font-size:0.9rem; color:var(--text-muted); margin-top:24px; }
    .switch-hint button { 
      background:none; border:none; color:var(--text); font-size:0.9rem; 
      cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; font-weight:700; 
      padding:0; text-decoration:none; margin-left:4px;
    }
    .switch-hint button:hover { text-decoration:underline; }

    /* ── Right Panel ── */
    .right-panel {
      flex: 1.2;
      display: none;
      border-radius: 24px;
      background: 
        radial-gradient(circle at 10% 90%, #438fcb 0%, transparent 40%),
        radial-gradient(circle at 90% 10%, #7eb3df 0%, transparent 40%),
        radial-gradient(circle at 50% 50%, #e0f2fe 0%, #a2cff0 50%, #76b1e0 100%);
      background-color: #8abce4;
      position: relative;
      overflow: hidden;
      align-items: center;
      justify-content: center;
      padding: 60px;
    }
    @media (min-width: 900px) {
      .right-panel { display: flex; }
    }

    /* ── Moving Clouds ── */
    .db-clouds {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: 0;
    }
    .css-cloud {
      position: absolute;
      background: #fff;
      border-radius: 200px;
      opacity: 0.7;
      filter: blur(14px);
    }
    .css-cloud::before, .css-cloud::after {
      content: '';
      position: absolute;
      background: #fff;
      border-radius: 50%;
    }
    .css-cloud::before {
      width: 50%; height: 150%;
      top: -70%; left: 15%;
    }
    .css-cloud::after {
      width: 40%; height: 120%;
      top: -50%; right: 15%;
    }
    .cloud-1 { width: 400px; height: 120px; top: 15%; left: -400px; opacity: 0.8; animation: floatCloud 50s linear infinite; }
    .cloud-2 { width: 550px; height: 160px; top: 45%; left: -600px; opacity: 0.6; animation: floatCloud 75s linear infinite 15s; }
    .cloud-3 { width: 350px; height: 100px; top: 75%; left: -400px; opacity: 0.7; animation: floatCloud 40s linear infinite 5s; }
    .cloud-4 { width: 600px; height: 180px; top: 5%; left: -600px; opacity: 0.45; animation: floatCloud 90s linear infinite 30s; }
    .cloud-5 { width: 450px; height: 140px; top: 60%; left: -500px; opacity: 0.65; animation: floatCloud 65s linear infinite 25s; }

    @keyframes floatCloud {
      0% { transform: translateX(0) scale(1); }
      50% { transform: translateX(50vw) scale(1.05); }
      100% { transform: translateX(calc(100vw + 1000px)) scale(1); }
    }

    /* ── Right Panel Content ── */
    .right-content {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .right-text {
      font-size: 4rem;
      font-weight: 500;
      color: #1a1a1a;
      line-height: 1.1;
      letter-spacing: -0.04em;
      max-width: 500px;
    }
    .right-text i {
      font-style: italic;
      font-weight: 400;
    }
    
    .landing-images {
      margin-top: 60px;
      position: relative;
      width: 100%;
      height: 350px;
    }
    .floating-img {
      position: absolute;
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.15);
      width: 260px;
      transition: all 0.3s ease;
      background: white;
      object-fit: cover;
    }
    .floating-img:hover {
      z-index: 10;
    }
    .img-1 {
      top: 20px;
      left: 20px;
      transform: rotate(-6deg);
      z-index: 2;
    }
    .img-1:hover {
      transform: rotate(0deg) translateY(-10px) scale(1.05);
    }
    .img-2 {
      top: 60px;
      left: 140px;
      transform: rotate(8deg);
      z-index: 1;
    }
    .img-2:hover {
      transform: rotate(0deg) translateY(-10px) scale(1.05);
    }

    /* ── Alerts ── */
    .alert { display:flex; align-items:flex-start; gap:10px; padding:12px 14px; border-radius:10px; font-size:0.85rem; line-height:1.5; margin-bottom:20px; }
    .alert-error { background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); color:var(--error); }
    .alert svg { width:16px; height:16px; flex-shrink:0; margin-top:2px; }

    /* ── Right Bottom Text ── */
    .right-bottom-text {
      position: absolute;
      bottom: 40px;
      right: 40px;
      text-align: right;
      max-width: 320px;
      z-index: 10;
    }
    .right-bottom-text .divider {
      display: flex; align-items: center; gap: 12px; margin-bottom: 12px; justify-content: flex-end;
    }
    .right-bottom-text .divider::before {
      content: ''; flex: 1; height: 1px; background: rgba(0,0,0,0.1);
    }
    .right-bottom-text .divider span {
      font-size: 0.75rem; color: rgba(0,0,0,0.5); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
    }
    .right-bottom-text .privacy-note {
      font-size: 0.85rem; color: rgba(0,0,0,0.65); line-height: 1.6;
    }
    .right-bottom-text .privacy-note strong {
      color: #1a1a1a; font-weight: 700;
    }
  `;

  const googleIcon = (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"/>
    </svg>
  );

  const errorIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );

  return (
    <>
      <style>{style}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <div className="signin-root">
        
        {/* Left Panel - Form */}
        <div className="left-panel">
          <div className="form-container">
            <div className="logo">
              <div className="logo-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="3"/><polyline points="2,4 12,13 22,4"/>
                </svg>
              </div>
            </div>

            {activeTab === 'signin' ? (
              <>
                <div className="tab-header">
                  <h1>Get Started</h1>
                  <p>Welcome to UnSub - Let's log into your account</p>
                </div>

                {pageError && (
                  <div className="alert alert-error">{errorIcon}{pageError}</div>
                )}

                <a href="/authorize?mode=signin" className="btn-main" id="signin-btn">
                  {googleIcon}
                  Sign In with Google
                </a>

                <div className="switch-hint">
                  Don't have an account? <button onClick={() => switchTab('signup')}>Sign up</button>
                </div>
              </>
            ) : (
              <>
                <div className="tab-header">
                  <h1>Get Started</h1>
                  <p>Welcome to UnSub - Let's create your account</p>
                </div>

                {pageError && (
                  <div className="alert alert-error">{errorIcon}{pageError}</div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="signup-name">Your Name</label>
                  <input
                    id="signup-name"
                    type="text"
                    className="form-input"
                    placeholder="John Doe"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoComplete="name"
                    required
                    autoFocus
                  />
                </div>

                <a
                  href={name.trim() ? signupHref : undefined}
                  className={`btn-main${name.trim() ? '' : ' disabled'}`}
                  id="signup-btn"
                  aria-disabled={!name.trim()}
                  tabIndex={name.trim() ? 0 : -1}
                >
                  {googleIcon}
                  Sign Up with Google
                </a>

                <div className="switch-hint">
                  Already have an account? <button onClick={() => switchTab('signin')}>Log in</button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Panel - Visual */}
        <div className="right-panel">
          <div className="db-clouds">
            <div className="css-cloud cloud-1"></div>
            <div className="css-cloud cloud-2"></div>
            <div className="css-cloud cloud-3"></div>
            <div className="css-cloud cloud-4"></div>
            <div className="css-cloud cloud-5"></div>
          </div>
          
          <div className="right-content">
            <div className="right-text">
              Forward<br/>
              and forget .
            </div>
            
            <div className="landing-images">
              <img src="https://cdn.prod.website-files.com/6929c116366a14507fc84252/6961fe8f17d6448d5348850c_service-img.webp" alt="Landing Graphic 1" className="floating-img img-1" />
              <img src="https://cdn.prod.website-files.com/6929c116366a14507fc8424d/69a5007e9793bec9aef0bae6_card.avif" alt="Landing Graphic 2" className="floating-img img-2" />
            </div>
          </div>

          <div className="right-bottom-text">
            <div className="divider"><span>secure · OAuth2 · no password stored</span></div>
            <p className="privacy-note">
              UnSub uses <strong>read-only</strong> Gmail API access.<br/>
              Role access is managed by your administrator.
            </p>
          </div>
        </div>

      </div>
    </>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  );
}
