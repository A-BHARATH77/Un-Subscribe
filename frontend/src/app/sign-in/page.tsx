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
      --bg: #0d0f14;
      --surface: #161921;
      --surface2: #1e2130;
      --border: rgba(255,255,255,0.07);
      --border-active: rgba(91,138,245,0.4);
      --text: #e8eaf0;
      --text-muted: #7b849a;
      --accent: #5b8af5;
      --accent2: #a78bfa;
      --glow: rgba(91,138,245,0.3);
      --error: #f87171;
      --warn: #fbbf24;
    }

    .signin-root {
      font-family: 'Inter', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      overflow: hidden;
      position: relative;
    }

    .bg-canvas {
      position: fixed; inset: 0; z-index: 0;
      background:
        radial-gradient(ellipse 80% 60% at 20% 40%, rgba(91,138,245,0.12) 0%, transparent 60%),
        radial-gradient(ellipse 60% 50% at 80% 70%, rgba(167,139,250,0.10) 0%, transparent 60%),
        var(--bg);
    }
    .orb { position: fixed; border-radius: 50%; filter: blur(80px); animation: float 8s ease-in-out infinite; pointer-events: none; z-index: 0; }
    .orb-1 { width: 400px; height: 400px; background: rgba(91,138,245,0.15); top: -100px; left: -100px; animation-delay: 0s; }
    .orb-2 { width: 350px; height: 350px; background: rgba(167,139,250,0.12); bottom: -80px; right: -80px; animation-delay: -3s; }
    .orb-3 { width: 250px; height: 250px; background: rgba(91,138,245,0.08); top: 50%; left: 60%; animation-delay: -5s; }
    @keyframes float { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-28px) scale(1.05)} }

    .grid-overlay { position: fixed; inset: 0; z-index: 0; background-image: radial-gradient(circle,rgba(255,255,255,.04) 1px,transparent 1px); background-size: 40px 40px; pointer-events: none; }

    .container { position: relative; z-index: 1; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; }

    /* ── Card ── */
    .card {
      background: rgba(22,25,33,.92);
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
      border: 1px solid var(--border);
      border-radius: 26px;
      padding: 46px 44px 40px;
      width: 440px;
      max-width: 95vw;
      box-shadow: 0 0 0 1px rgba(255,255,255,.04) inset, 0 32px 80px rgba(0,0,0,.55), 0 0 60px var(--glow);
      animation: cardIn .65s cubic-bezier(.22,1,.36,1);
    }
    @keyframes cardIn { from{opacity:0;transform:translateY(28px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }

    /* ── Logo ── */
    .logo { display:flex; align-items:center; gap:12px; margin-bottom:30px; }
    .logo-icon { width:44px; height:44px; background:linear-gradient(135deg,var(--accent),var(--accent2)); border-radius:12px; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 24px var(--glow); flex-shrink:0; }
    .logo-icon svg { width:22px; height:22px; }
    .logo-text { font-size:1.4rem; font-weight:700; letter-spacing:-.02em; }
    .logo-sub { font-size:.72rem; color:var(--text-muted); margin-top:2px; }

    /* ── Tabs ── */
    .tabs { display:flex; background:var(--surface2); border-radius:12px; padding:4px; margin-bottom:30px; gap:4px; }
    .tab-btn { flex:1; padding:10px 16px; border:none; border-radius:9px; font-family:'Inter',sans-serif; font-size:.875rem; font-weight:500; cursor:pointer; transition:all .2s; background:transparent; color:var(--text-muted); }
    .tab-btn.active { background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#fff; box-shadow:0 4px 16px var(--glow); }
    .tab-btn:not(.active):hover { color:var(--text); background:rgba(255,255,255,.04); }

    /* ── Tab header ── */
    .tab-header { margin-bottom:26px; }
    .tab-header h1 { font-size:1.5rem; font-weight:700; letter-spacing:-.03em; line-height:1.2; margin-bottom:8px; }
    .tab-header h1 span { background:linear-gradient(90deg,var(--accent),var(--accent2)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .tab-header p { color:var(--text-muted); font-size:.875rem; line-height:1.65; }

    /* ── Alert ── */
    .alert { display:flex; align-items:flex-start; gap:10px; padding:12px 14px; border-radius:10px; font-size:.84rem; line-height:1.5; margin-bottom:18px; animation:alertIn .3s ease; }
    @keyframes alertIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
    .alert-error { background:rgba(248,113,113,.1); border:1px solid rgba(248,113,113,.25); color:var(--error); }
    .alert svg { width:15px; height:15px; flex-shrink:0; margin-top:1px; }

    /* ── Feature list (sign-in tab) ── */
    .features { list-style:none; margin-bottom:26px; display:flex; flex-direction:column; gap:9px; }
    .features li { display:flex; align-items:center; gap:10px; font-size:.84rem; color:var(--text-muted); }
    .features li .dot { width:6px; height:6px; border-radius:50%; background:linear-gradient(135deg,var(--accent),var(--accent2)); flex-shrink:0; }

    /* ── Name input (signup only) ── */
    .form-group { margin-bottom:20px; }
    .form-label { display:block; font-size:.78rem; font-weight:500; color:var(--text-muted); margin-bottom:8px; letter-spacing:.02em; text-transform:uppercase; }
    .form-input { width:100%; padding:12px 16px; background:var(--surface2); border:1px solid var(--border); border-radius:10px; color:var(--text); font-family:'Inter',sans-serif; font-size:.9rem; outline:none; transition:border-color .2s, box-shadow .2s; }
    .form-input::placeholder { color:var(--text-muted); }
    .form-input:focus { border-color:var(--border-active); box-shadow:0 0 0 3px rgba(91,138,245,.12); }
    .form-hint { font-size:.75rem; color:var(--text-muted); margin-top:6px; }

    /* ── Google CTA button ── */
    .btn-google {
      display:flex; align-items:center; justify-content:center; gap:12px;
      width:100%; padding:14px 20px;
      background:linear-gradient(135deg,var(--accent) 0%,var(--accent2) 100%);
      border:none; border-radius:13px; color:#fff;
      font-family:'Inter',sans-serif; font-size:.95rem; font-weight:600;
      cursor:pointer; text-decoration:none;
      transition:all .25s ease;
      box-shadow:0 8px 28px var(--glow);
      position:relative; overflow:hidden;
    }
    .btn-google::before { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,.15),transparent); opacity:0; transition:opacity .25s; }
    .btn-google:hover::before { opacity:1; }
    .btn-google:hover { transform:translateY(-2px); box-shadow:0 12px 40px rgba(91,138,245,.5); }
    .btn-google:active { transform:translateY(0); }
    .btn-google svg { width:20px; height:20px; flex-shrink:0; }

    /* ── Google pill badge ── */
    .google-badge {
      display:inline-flex; align-items:center; gap:7px;
      background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1);
      border-radius:99px; padding:5px 12px;
      font-size:.75rem; color:var(--text-muted);
      margin-bottom:20px;
    }
    .google-badge svg { width:14px; height:14px; }

    /* ── Divider ── */
    .divider { display:flex; align-items:center; gap:12px; margin:22px 0; }
    .divider::before,.divider::after { content:''; flex:1; height:1px; background:var(--border); }
    .divider span { font-size:.75rem; color:var(--text-muted); }

    /* ── Privacy / switch hint ── */
    .privacy-note { text-align:center; font-size:.74rem; color:var(--text-muted); line-height:1.6; }
    .privacy-note span { color:var(--accent); }
    .switch-hint { text-align:center; font-size:.82rem; color:var(--text-muted); margin-top:18px; }
    .switch-hint button { background:none; border:none; color:var(--accent); font-size:.82rem; cursor:pointer; font-family:'Inter',sans-serif; font-weight:500; padding:0; text-decoration:underline; text-underline-offset:2px; }
    .switch-hint button:hover { color:var(--accent2); }
  `;

  const googleIcon = (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="rgba(255,255,255,0.9)"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="rgba(255,255,255,0.9)"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="rgba(255,255,255,0.9)"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="rgba(255,255,255,0.9)"/>
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
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <div className="signin-root">
        <div className="bg-canvas" />
        <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
        <div className="grid-overlay" />

        <div className="container">
          <div className="card">
            {/* Logo */}
            <div className="logo">
              <div className="logo-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="3"/><polyline points="2,4 12,13 22,4"/>
                </svg>
              </div>
              <div>
                <div className="logo-text">UnSub</div>
                <div className="logo-sub">Unsubscribe, beautifully</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs" role="tablist">
              <button id="tab-signin" role="tab" aria-selected={activeTab === 'signin'}
                className={`tab-btn${activeTab === 'signin' ? ' active' : ''}`}
                onClick={() => switchTab('signin')}>
                Sign In
              </button>
              <button id="tab-signup" role="tab" aria-selected={activeTab === 'signup'}
                className={`tab-btn${activeTab === 'signup' ? ' active' : ''}`}
                onClick={() => switchTab('signup')}>
                Create Account
              </button>
            </div>

            {/* ── SIGN IN TAB ── */}
            {activeTab === 'signin' && (
              <div role="tabpanel" aria-labelledby="tab-signin">
                <div className="tab-header">
                  <h1>Welcome <span>back</span></h1>
                  <p>Click the button below — Google will let you choose which account to sign in with.</p>
                </div>

                {pageError && (
                  <div className="alert alert-error">{errorIcon}{pageError}</div>
                )}

                <ul className="features">
                  <li><span className="dot" />Secure OAuth2 — no password stored</li>
                  <li><span className="dot" />Picks up your role automatically</li>
                  <li><span className="dot" />Admins open inbox · Users open dashboard</li>
                </ul>

                <a href="/authorize?mode=signin" className="btn-google" id="signin-btn">
                  {googleIcon}
                  Sign In with Google
                </a>

                <div className="switch-hint">
                  No account yet?{' '}
                  <button onClick={() => switchTab('signup')}>Create one</button>
                </div>
              </div>
            )}

            {/* ── CREATE ACCOUNT TAB ── */}
            {activeTab === 'signup' && (
              <div role="tabpanel" aria-labelledby="tab-signup">
                <div className="tab-header">
                  <h1>Create your <span>account</span></h1>
                  <p>Google will show the account picker — the email you choose will be registered.</p>
                </div>

                {pageError && (
                  <div className="alert alert-error">{errorIcon}{pageError}</div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="signup-name">Your name <span style={{color:'var(--text-muted)',fontWeight:400}}>(optional)</span></label>
                  <input
                    id="signup-name"
                    type="text"
                    className="form-input"
                    placeholder="John Doe"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoComplete="name"
                    autoFocus
                  />
                  <p className="form-hint">If provided, your name will be saved alongside your account.</p>
                </div>

                <a href={signupHref} className="btn-google" id="signup-btn">
                  {googleIcon}
                  Create Account &amp; Continue with Google
                </a>

                <div className="switch-hint">
                  Already have an account?{' '}
                  <button onClick={() => switchTab('signin')}>Sign in</button>
                </div>
              </div>
            )}

            <div className="divider"><span>secure · OAuth2 · no password stored</span></div>
            <p className="privacy-note">
              UnSub uses <span>read-only</span> Gmail API access.<br/>
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
