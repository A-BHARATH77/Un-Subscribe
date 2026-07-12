'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface UserInfo {
  email: string;
  name: string | null;
  role: string;
}

interface LogRow {
  organization_name: string;
  result: string;
  created_at: string;
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function resultClass(r: string) {
  if (r === 'success')   return 'badge badge-success';
  if (r === 'error')     return 'badge badge-error';
  if (r === 'skipped')   return 'badge badge-skipped';
  if (r === 'not_found') return 'badge badge-notfound';
  return 'badge badge-default';
}

function resultEmoji(r: string) {
  if (r === 'success')   return '✅';
  if (r === 'error')     return '❌';
  if (r === 'skipped')   return '⏭️';
  if (r === 'not_found') return '🔍';
  return '•';
}

/* ─────────────────────────────────────────────────────────────────
   Inner component — uses useSearchParams (needs Suspense wrapper)
───────────────────────────────────────────────────────────────── */
function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [info, setInfo] = useState<UserInfo | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState('');

  useEffect(() => {
    // 1. Grab email from URL param (?_e=) placed there by Flask OAuth redirect
    const urlEmail = searchParams.get('_e');
    if (urlEmail) {
      sessionStorage.setItem('unsub_user', urlEmail);
      window.history.replaceState({}, '', '/dashboard'); // clean URL
    }

    // 2. Resolve email: URL param → sessionStorage → give up
    const email = urlEmail || sessionStorage.getItem('unsub_user') || '';
    if (!email) {
      router.push('/sign-in');
      return;
    }

    const qs = `?email=${encodeURIComponent(email)}`;

    // 3. Fetch user profile (validates email exists in DB)
    fetch(`/api/user/info${qs}`)
      .then(r => r.json())
      .then((data: UserInfo & { error?: string }) => {
        if (data.error) { router.push('/sign-in'); return; }
        setInfo(data);
      })
      .catch(() => router.push('/sign-in'));

    // 4. Fetch this user's unsubscribe history
    fetch(`/api/user/logs${qs}`)
      .then(r => r.json())
      .then((data: LogRow[] | { error: string }) => {
        if (!Array.isArray(data)) {
          setLogsError((data as { error: string }).error);
        } else {
          setLogs(data);
        }
        setLogsLoading(false);
      })
      .catch(e => { setLogsError(String(e)); setLogsLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const successCount = logs.filter(l => l.result === 'success').length;
  const errorCount   = logs.filter(l => l.result === 'error').length;
  const displayName  = info?.name || info?.email?.split('@')[0] || 'User';
  const initials     = displayName.charAt(0).toUpperCase();

  const style = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0d0f14; --surface: #161921; --surface2: #1e2130; --surface3: #242840;
      --border: rgba(255,255,255,0.07); --border2: rgba(255,255,255,0.04);
      --text: #e8eaf0; --text-muted: #7b849a; --text-dim: #4a526a;
      --accent: #5b8af5; --accent2: #a78bfa; --accent-soft: rgba(91,138,245,0.12);
      --green: #34d399; --yellow: #fbbf24; --red: #f87171;
      --glow: rgba(91,138,245,0.25);
    }

    html, body { height: 100%; font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); }

    .bg-canvas {
      position: fixed; inset: 0; z-index: 0;
      background:
        radial-gradient(ellipse 70% 55% at 15% 35%, rgba(91,138,245,0.11) 0%, transparent 65%),
        radial-gradient(ellipse 55% 45% at 85% 70%, rgba(167,139,250,0.09) 0%, transparent 65%),
        var(--bg);
    }
    .orb { position: fixed; border-radius: 50%; filter: blur(90px); animation: drift 9s ease-in-out infinite; pointer-events: none; z-index: 0; }
    .orb-1 { width: 420px; height: 420px; background: rgba(91,138,245,0.13); top: -130px; left: -100px; animation-delay: 0s; }
    .orb-2 { width: 320px; height: 320px; background: rgba(167,139,250,0.10); bottom: -80px; right: -60px; animation-delay: -5s; }
    @keyframes drift { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-22px) scale(1.04)} }
    .grid { position: fixed; inset: 0; z-index: 0; background-image: radial-gradient(circle,rgba(255,255,255,0.035) 1px,transparent 1px); background-size: 40px 40px; pointer-events: none; }

    .page { position: relative; z-index: 1; min-height: 100vh; display: flex; flex-direction: column; }

    /* Top bar */
    .topbar { display: flex; align-items: center; justify-content: space-between; padding: 14px 32px; background: rgba(17,19,26,0.85); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 100; }
    .topbar-logo { display: flex; align-items: center; gap: 10px; }
    .logo-icon { width: 32px; height: 32px; background: linear-gradient(135deg, var(--accent), var(--accent2)); border-radius: 9px; display: flex; align-items: center; justify-content: center; }
    .logo-icon svg { width: 17px; height: 17px; }
    .logo-name { font-weight: 700; font-size: 1rem; letter-spacing: -0.02em; }
    .topbar-right { display: flex; align-items: center; gap: 10px; }
    .user-pill { display: flex; align-items: center; gap: 8px; padding: 5px 12px 5px 6px; background: var(--surface); border: 1px solid var(--border); border-radius: 99px; }
    .user-avatar { width: 26px; height: 26px; background: linear-gradient(135deg, var(--accent), var(--accent2)); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.68rem; font-weight: 700; color: #fff; }
    .user-email-text { font-size: 0.77rem; color: var(--text-muted); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .btn-signout { padding: 6px 14px; background: transparent; border: 1px solid rgba(248,113,113,0.3); border-radius: 8px; color: var(--red); font-family: 'Inter', sans-serif; font-size: 0.8rem; cursor: pointer; text-decoration: none; transition: all 0.2s; }
    .btn-signout:hover { background: rgba(248,113,113,0.08); border-color: rgba(248,113,113,0.55); }

    /* Body */
    .body { flex: 1; padding: 36px 32px 60px; max-width: 880px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 28px; }

    /* Hero */
    .hero { display: flex; align-items: center; gap: 20px; }
    .hero-avatar { width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent2)); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; color: #fff; box-shadow: 0 8px 28px var(--glow); flex-shrink: 0; }
    .hero-text h1 { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.03em; }
    .hero-text h1 span { background: linear-gradient(90deg, var(--accent), var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero-text p { font-size: 0.85rem; color: var(--text-muted); margin-top: 4px; }
    .role-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; background: var(--accent-soft); border: 1px solid rgba(91,138,245,0.25); border-radius: 99px; font-size: 0.7rem; font-weight: 600; color: var(--accent); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 6px; }
    .role-chip .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: pulse 2s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.55;transform:scale(0.8)} }

    /* Stats */
    .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px 16px; display: flex; flex-direction: column; gap: 5px; transition: border-color 0.2s; }
    .stat-card:hover { border-color: rgba(91,138,245,0.2); }
    .stat-label { font-size: 0.7rem; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.06em; }
    .stat-val { font-size: 1.9rem; font-weight: 800; letter-spacing: -0.03em; }
    .val-total { color: var(--accent); }
    .val-green { color: var(--green); }
    .val-red   { color: var(--red); }

    /* Table section */
    .section { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; overflow: hidden; }
    .section-header { padding: 18px 22px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
    .section-title { font-size: 0.95rem; font-weight: 700; }
    .section-count { font-size: 0.75rem; color: var(--text-muted); background: var(--surface2); border: 1px solid var(--border); padding: 3px 10px; border-radius: 99px; }

    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
    thead tr { background: var(--surface2); }
    th { padding: 10px 16px; text-align: left; font-size: 0.7rem; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid var(--border); white-space: nowrap; }
    td { padding: 12px 16px; border-bottom: 1px solid var(--border2); color: var(--text-muted); vertical-align: middle; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover td { background: rgba(255,255,255,0.018); }
    .cell-org { color: var(--text); font-weight: 500; }
    .cell-dim  { color: var(--text-dim); font-size: 0.78rem; }

    /* Badges */
    .badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 99px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .badge-success  { background: rgba(52,211,153,0.12); border: 1px solid rgba(52,211,153,0.3);  color: var(--green); }
    .badge-error    { background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.3); color: var(--red); }
    .badge-skipped  { background: rgba(251,191,36,0.1);   border: 1px solid rgba(251,191,36,0.3);  color: var(--yellow); }
    .badge-notfound { background: rgba(74,82,106,0.2);    border: 1px solid rgba(74,82,106,0.35);  color: var(--text-muted); }
    .badge-default  { background: rgba(74,82,106,0.2);    border: 1px solid rgba(74,82,106,0.3);   color: var(--text-dim); }

    /* States */
    .tbl-loading { padding: 48px; text-align: center; color: var(--text-dim); font-size: 0.88rem; }
    .tbl-error   { padding: 24px; text-align: center; color: var(--red); font-size: 0.84rem; background: rgba(248,113,113,0.05); }
    .tbl-empty   { padding: 52px 24px; text-align: center; color: var(--text-dim); }
    .tbl-empty-icon { font-size: 2.5rem; margin-bottom: 12px; }
    .tbl-empty-msg  { font-size: 0.9rem; font-weight: 500; color: var(--text-muted); margin-bottom: 4px; }
    .tbl-empty-sub  { font-size: 0.8rem; }
    .mini-spin { width: 18px; height: 18px; border: 2px solid var(--surface3); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; vertical-align: middle; margin-right: 8px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;

  return (
    <>
      <style>{style}</style>

      <div className="bg-canvas" />
      <div className="orb orb-1" /><div className="orb orb-2" />
      <div className="grid" />

      <div className="page">
        {/* Top bar */}
        <header className="topbar">
          <div className="topbar-logo">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="3"/><polyline points="2,4 12,13 22,4"/>
              </svg>
            </div>
            <span className="logo-name">UnSub</span>
          </div>
          <div className="topbar-right">
            {info && (
              <div className="user-pill">
                <div className="user-avatar">{initials}</div>
                <span className="user-email-text">{info.email}</span>
              </div>
            )}
            <a href="/logout" className="btn-signout" id="dashboard-signout">Sign Out</a>
          </div>
        </header>

        {/* Body */}
        <main className="body">
          {/* Hero */}
          <div className="hero">
            <div className="hero-avatar">{initials}</div>
            <div className="hero-text">
              <h1>Welcome, <span>{displayName}</span></h1>
              <p>{info?.email || '—'}</p>
              <div className="role-chip"><span className="dot" /> User</div>
            </div>
          </div>

          {/* Stats */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-label">Emails Forwarded</div>
              <div className="stat-val val-total">{logsLoading ? '—' : logs.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Unsubscribed</div>
              <div className="stat-val val-green">{logsLoading ? '—' : successCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Errors</div>
              <div className="stat-val val-red">{logsLoading ? '—' : errorCount}</div>
            </div>
          </div>

          {/* Logs table */}
          <div className="section">
            <div className="section-header">
              <span className="section-title">📬 My Forwarded Emails</span>
              {!logsLoading && !logsError && (
                <span className="section-count">{logs.length} entries</span>
              )}
            </div>

            <div className="table-wrap">
              {logsLoading ? (
                <div className="tbl-loading"><span className="mini-spin" />Loading your activity…</div>
              ) : logsError ? (
                <div className="tbl-error">⚠ {logsError}</div>
              ) : logs.length === 0 ? (
                <div className="tbl-empty">
                  <div className="tbl-empty-icon">📭</div>
                  <div className="tbl-empty-msg">No activity yet</div>
                  <div className="tbl-empty-sub">Forward subscription emails to the admin and they will appear here.</div>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Organisation</th>
                      <th>Result</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l, i) => (
                      <tr key={i}>
                        <td className="cell-dim">{i + 1}</td>
                        <td className="cell-org">{l.organization_name || '—'}</td>
                        <td>
                          <span className={resultClass(l.result)}>
                            {resultEmoji(l.result)} {l.result}
                          </span>
                        </td>
                        <td className="cell-dim">{fmtDate(l.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

/* Suspense wrapper required by useSearchParams in Next.js */
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
