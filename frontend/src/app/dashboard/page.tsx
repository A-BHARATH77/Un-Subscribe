'use client';

export default function DashboardPage() {
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
      --glow: rgba(91,138,245,0.3);
    }

    .dash-root {
      font-family: 'Inter', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .bg-canvas {
      position: fixed; inset: 0; z-index: 0;
      background:
        radial-gradient(ellipse 80% 60% at 20% 40%, rgba(91,138,245,0.10) 0%, transparent 60%),
        radial-gradient(ellipse 60% 50% at 80% 70%, rgba(167,139,250,0.08) 0%, transparent 60%),
        var(--bg);
    }

    .orb {
      position: fixed; border-radius: 50%;
      filter: blur(80px);
      animation: float 8s ease-in-out infinite;
      pointer-events: none; z-index: 0;
    }
    .orb-1 { width: 400px; height: 400px; background: rgba(91,138,245,0.12); top: -120px; left: -100px; animation-delay: 0s; }
    .orb-2 { width: 300px; height: 300px; background: rgba(167,139,250,0.10); bottom: -80px; right: -60px; animation-delay: -4s; }

    @keyframes float {
      0%, 100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-20px) scale(1.04); }
    }

    .grid-overlay {
      position: fixed; inset: 0; z-index: 0;
      background-image: radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
    }

    /* ── Main content ── */
    .content {
      position: relative; z-index: 1;
      display: flex; flex-direction: column;
      align-items: center; gap: 24px;
      text-align: center;
      padding: 32px 24px;
      animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1);
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Badge */
    .role-badge {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 16px;
      background: rgba(91,138,245,0.12);
      border: 1px solid rgba(91,138,245,0.25);
      border-radius: 99px;
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent);
    }
    .role-badge .dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 8px var(--accent);
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.85); }
    }

    /* Heading */
    .dash-title {
      font-size: clamp(2.2rem, 6vw, 3.5rem);
      font-weight: 800;
      letter-spacing: -0.04em;
      line-height: 1.1;
    }
    .dash-title span {
      background: linear-gradient(90deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* Subtitle */
    .dash-sub {
      font-size: 1rem;
      color: var(--text-muted);
      line-height: 1.7;
      max-width: 400px;
    }

    /* Card */
    .info-card {
      background: rgba(22,25,33,0.85);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 28px 32px;
      display: flex;
      align-items: center;
      gap: 16px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 40px var(--glow);
      margin-top: 8px;
    }
    .info-icon {
      width: 48px; height: 48px; flex-shrink: 0;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 6px 20px var(--glow);
    }
    .info-icon svg { width: 24px; height: 24px; }
    .info-body { text-align: left; }
    .info-body strong { display: block; font-size: 0.95rem; font-weight: 600; margin-bottom: 4px; }
    .info-body p { font-size: 0.82rem; color: var(--text-muted); line-height: 1.5; }

    /* Sign out link */
    .signout-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 22px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: transparent;
      color: var(--text-muted);
      font-family: 'Inter', sans-serif;
      font-size: 0.875rem;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
      margin-top: 8px;
    }
    .signout-btn:hover {
      color: var(--text);
      border-color: rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.04);
    }
    .signout-btn svg { width: 16px; height: 16px; }
  `;

  return (
    <>
      <style>{style}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      <div className="dash-root">
        <div className="bg-canvas"></div>
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="grid-overlay"></div>

        <div className="content">
          <div className="role-badge">
            <span className="dot"></span>
            User
          </div>

          <h1 className="dash-title">
            User <span>Dashboard</span>
          </h1>

          <p className="dash-sub">
            You're signed in as a standard user. Contact your administrator if you need elevated access.
          </p>

          <div className="info-card">
            <div className="info-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div className="info-body">
              <strong>Standard Access</strong>
              <p>Your role is <em>user</em>. Admin features are not available for this account.</p>
            </div>
          </div>

          <a href="/logout" className="signout-btn" id="dashboard-signout">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </a>
        </div>
      </div>
    </>
  );
}
