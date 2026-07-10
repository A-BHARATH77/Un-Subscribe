'use client';

import { useEffect, useRef } from 'react';

export default function SignInPage() {
  const style = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0d0f14;
      --surface: #161921;
      --surface2: #1e2130;
      --border: rgba(255,255,255,0.07);
      --text: #e8eaf0;
      --text-muted: #7b849a;
      --accent: #5b8af5;
      --accent2: #a78bfa;
      --glow: rgba(91, 138, 245, 0.3);
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
      position: fixed;
      inset: 0;
      z-index: 0;
      background:
        radial-gradient(ellipse 80% 60% at 20% 40%, rgba(91,138,245,0.12) 0%, transparent 60%),
        radial-gradient(ellipse 60% 50% at 80% 70%, rgba(167,139,250,0.10) 0%, transparent 60%),
        var(--bg);
    }

    .orb {
      position: fixed;
      border-radius: 50%;
      filter: blur(80px);
      animation: float 8s ease-in-out infinite;
      pointer-events: none;
      z-index: 0;
    }
    .orb-1 { width: 400px; height: 400px; background: rgba(91,138,245,0.15); top: -100px; left: -100px; animation-delay: 0s; }
    .orb-2 { width: 350px; height: 350px; background: rgba(167,139,250,0.12); bottom: -80px; right: -80px; animation-delay: -3s; }
    .orb-3 { width: 250px; height: 250px; background: rgba(91,138,245,0.08); top: 50%; left: 60%; animation-delay: -5s; }

    @keyframes float {
      0%, 100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-30px) scale(1.05); }
    }

    .grid-overlay {
      position: fixed;
      inset: 0;
      z-index: 0;
      background-image: radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
    }

    .container {
      position: relative;
      z-index: 1;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .card {
      background: rgba(22, 25, 33, 0.85);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 52px 48px 44px;
      width: 420px;
      max-width: 95vw;
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.04) inset,
        0 32px 80px rgba(0,0,0,0.5),
        0 0 60px var(--glow);
      animation: cardIn 0.7s cubic-bezier(0.22,1,0.36,1);
    }

    @keyframes cardIn {
      from { opacity: 0; transform: translateY(32px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 36px;
    }
    .logo-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px var(--glow);
      flex-shrink: 0;
    }
    .logo-icon svg { width: 26px; height: 26px; }
    .logo-text { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
    .logo-sub { font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; font-weight: 400; }

    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.2;
      margin-bottom: 10px;
    }
    h1 span {
      background: linear-gradient(90deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 0.9rem;
      line-height: 1.6;
      margin-bottom: 36px;
    }

    .features {
      list-style: none;
      margin-bottom: 36px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .features li {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    .features li .dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      flex-shrink: 0;
    }

    .btn-google {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      padding: 14px 20px;
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%);
      border: none;
      border-radius: 14px;
      color: #fff;
      font-family: 'Inter', sans-serif;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.25s ease;
      box-shadow: 0 8px 32px var(--glow);
      position: relative;
      overflow: hidden;
    }
    .btn-google::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent);
      opacity: 0;
      transition: opacity 0.25s;
    }
    .btn-google:hover::before { opacity: 1; }
    .btn-google:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 40px rgba(91,138,245,0.5);
    }
    .btn-google:active { transform: translateY(0); }
    .btn-google svg { width: 20px; height: 20px; flex-shrink: 0; }

    .divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 24px 0;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border);
    }
    .divider span { font-size: 0.75rem; color: var(--text-muted); }

    .privacy-note {
      text-align: center;
      font-size: 0.75rem;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .privacy-note span { color: var(--accent); }
  `;

  return (
    <>
      <style>{style}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <div className="signin-root">
        <div className="bg-canvas"></div>
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        <div className="grid-overlay"></div>

        <div className="container">
          <div className="card">
            <div className="logo">
              <div className="logo-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="3"/>
                  <polyline points="2,4 12,13 22,4"/>
                </svg>
              </div>
              <div>
                <div className="logo-text">MailView</div>
                <div className="logo-sub">Your Gmail, beautifully rendered</div>
              </div>
            </div>

            <h1>View your <span>Gmail Inbox</span> beautifully</h1>
            <p className="subtitle">Connect your Google account to access and browse your emails in a clean, modern interface.</p>

            <ul className="features">
              <li><span className="dot"></span>Read-only access — your emails stay safe</li>
              <li><span className="dot"></span>Beautiful threaded inbox view</li>
              <li><span className="dot"></span>Fast search &amp; label filtering</li>
              <li><span className="dot"></span>Secure OAuth2 — no password needed</li>
            </ul>

            <a href="/authorize" className="btn-google" id="signin-btn">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="rgba(255,255,255,0.9)"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="rgba(255,255,255,0.9)"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="rgba(255,255,255,0.9)"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="rgba(255,255,255,0.9)"/>
              </svg>
              Continue with Google
            </a>

            <div className="divider"><span>secure connection</span></div>

            <p className="privacy-note">
              MailView uses <span>read-only</span> Gmail API access.<br/>
              Your credentials are never stored on our servers.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
