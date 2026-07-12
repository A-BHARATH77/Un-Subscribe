'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'admin';
  created_at: string;
}

interface LogRow {
  id?: string | number;
  organization_name: string;
  sender_email: string;
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

export default function AdminDashboardPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [logsError, setLogsError] = useState('');
  const [tab, setTab] = useState<'users' | 'logs'>('users');

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then((data: UserRow[] | { error: string }) => {
        if ('error' in data) { setUsersError((data as {error:string}).error); }
        else setUsers(data as UserRow[]);
        setUsersLoading(false);
      })
      .catch(e => { setUsersError(String(e)); setUsersLoading(false); });

    fetch('/api/admin/logs')
      .then(r => r.json())
      .then((data: LogRow[] | { error: string }) => {
        if ('error' in data) { setLogsError((data as {error:string}).error); }
        else setLogs(data as LogRow[]);
        setLogsLoading(false);
      })
      .catch(e => { setLogsError(String(e)); setLogsLoading(false); });
  }, []);

  // Summary stats
  const totalUsers = users.length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const userCount  = users.filter(u => u.role === 'user').length;
  const totalLogs  = logs.length;
  const successLogs = logs.filter(l => l.result === 'success').length;
  const errorLogs   = logs.filter(l => l.result === 'error').length;

  const style = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0d0f14;
      --sidebar: #11131a;
      --surface: #161921;
      --surface2: #1e2130;
      --surface3: #242840;
      --border: rgba(255,255,255,0.07);
      --border2: rgba(255,255,255,0.04);
      --text: #e8eaf0;
      --text-muted: #7b849a;
      --text-dim: #4a526a;
      --accent: #5b8af5;
      --accent2: #a78bfa;
      --accent-soft: rgba(91,138,245,0.12);
      --green: #34d399;
      --yellow: #fbbf24;
      --red: #f87171;
      --glow: rgba(91,138,245,0.2);
    }

    html, body { height: 100%; font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); }
    .layout { display: grid; grid-template-columns: 240px 1fr; grid-template-rows: 60px 1fr; height: 100vh; }

    /* ── Header ── */
    .header { grid-column: 1 / -1; background: var(--sidebar); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 24px 0 0; z-index: 100; }
    .header-logo { width: 240px; display: flex; align-items: center; gap: 10px; padding: 0 20px; flex-shrink: 0; }
    .logo-icon { width: 34px; height: 34px; background: linear-gradient(135deg, var(--accent), var(--accent2)); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .logo-icon svg { width: 18px; height: 18px; }
    .logo-name { font-weight: 700; font-size: 1.05rem; letter-spacing: -0.02em; }
    .header-right { display: flex; align-items: center; gap: 10px; margin-left: auto; }
    .badge-admin { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; background: rgba(91,138,245,0.12); border: 1px solid rgba(91,138,245,0.3); border-radius: 99px; font-size: 0.73rem; font-weight: 600; color: var(--accent); letter-spacing: 0.04em; text-transform: uppercase; }
    .btn-nav { padding: 7px 16px; background: transparent; border: 1px solid var(--border); border-radius: 9px; color: var(--text-muted); font-family: 'Inter', sans-serif; font-size: 0.82rem; cursor: pointer; text-decoration: none; transition: all 0.2s; }
    .btn-nav:hover { color: var(--text); border-color: rgba(255,255,255,0.15); background: var(--surface); }

    /* ── Sidebar ── */
    .sidebar { background: var(--sidebar); border-right: 1px solid var(--border); padding: 16px 12px; display: flex; flex-direction: column; gap: 4px; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; cursor: pointer; transition: all 0.15s; color: var(--text-muted); font-size: 0.88rem; font-weight: 500; border: none; background: transparent; width: 100%; text-align: left; text-decoration: none; }
    .nav-item:hover { background: var(--surface); color: var(--text); }
    .nav-item.active { background: var(--accent-soft); color: var(--accent); }
    .nav-item svg { width: 16px; height: 16px; flex-shrink: 0; }

    /* ── Main ── */
    .main { overflow-y: auto; padding: 28px 32px; display: flex; flex-direction: column; gap: 28px; }
    .main::-webkit-scrollbar { width: 5px; }
    .main::-webkit-scrollbar-thumb { background: var(--surface3); border-radius: 100px; }

    /* ── Page title ── */
    .page-title { font-size: 1.55rem; font-weight: 800; letter-spacing: -0.03em; }
    .page-title span { background: linear-gradient(90deg, var(--accent), var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .page-sub { font-size: 0.85rem; color: var(--text-muted); margin-top: 4px; }

    /* ── Stats grid ── */
    .stats-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; }
    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px 16px; display: flex; flex-direction: column; gap: 6px; transition: border-color 0.2s; }
    .stat-card:hover { border-color: rgba(91,138,245,0.25); }
    .stat-label { font-size: 0.72rem; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.06em; }
    .stat-val { font-size: 1.8rem; font-weight: 800; letter-spacing: -0.03em; }
    .stat-val.accent { color: var(--accent); }
    .stat-val.green  { color: var(--green); }
    .stat-val.yellow { color: var(--yellow); }
    .stat-val.red    { color: var(--red); }

    /* ── Section ── */
    .section { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; overflow: hidden; }
    .section-header { padding: 18px 22px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
    .section-title { font-size: 0.95rem; font-weight: 700; letter-spacing: -0.01em; }
    .section-count { font-size: 0.78rem; color: var(--text-muted); background: var(--surface2); border: 1px solid var(--border); padding: 3px 10px; border-radius: 99px; }

    /* ── Tabs ── */
    .tab-bar { display: flex; gap: 4px; background: var(--surface2); border-radius: 10px; padding: 4px; width: fit-content; }
    .tab-btn { padding: 8px 20px; border: none; border-radius: 7px; font-family: 'Inter', sans-serif; font-size: 0.85rem; font-weight: 500; cursor: pointer; background: transparent; color: var(--text-muted); transition: all 0.2s; }
    .tab-btn.active { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #fff; box-shadow: 0 3px 12px var(--glow); }
    .tab-btn:not(.active):hover { color: var(--text); background: rgba(255,255,255,0.04); }

    /* ── Table ── */
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
    thead tr { background: var(--surface2); }
    th { padding: 11px 16px; text-align: left; font-size: 0.72rem; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; border-bottom: 1px solid var(--border); }
    td { padding: 12px 16px; border-bottom: 1px solid var(--border2); color: var(--text-muted); vertical-align: middle; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover td { background: rgba(255,255,255,0.02); }
    .cell-email { color: var(--text); font-weight: 500; }
    .cell-name  { color: var(--text); }
    .cell-dim   { color: var(--text-dim); font-size: 0.78rem; }

    /* ── Role badge ── */
    .role-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 99px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .role-admin { background: rgba(91,138,245,0.15); border: 1px solid rgba(91,138,245,0.3); color: var(--accent); }
    .role-user  { background: rgba(74,82,106,0.25); border: 1px solid rgba(74,82,106,0.4); color: var(--text-muted); }

    /* ── Result badge ── */
    .result-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 99px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
    .result-success   { background: rgba(52,211,153,0.12); border: 1px solid rgba(52,211,153,0.3); color: var(--green); }
    .result-error     { background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.3); color: var(--red); }
    .result-skipped   { background: rgba(251,191,36,0.1);  border: 1px solid rgba(251,191,36,0.3);  color: var(--yellow); }
    .result-not_found { background: rgba(74,82,106,0.2);   border: 1px solid rgba(74,82,106,0.35);  color: var(--text-muted); }
    .result-default   { background: rgba(74,82,106,0.2);   border: 1px solid rgba(74,82,106,0.35);  color: var(--text-dim); }

    /* ── Loading / Error ── */
    .tbl-loading { padding: 40px; text-align: center; color: var(--text-dim); font-size: 0.88rem; }
    .tbl-error   { padding: 24px; text-align: center; color: var(--red); font-size: 0.84rem; background: rgba(248,113,113,0.06); }
    .tbl-empty   { padding: 40px; text-align: center; color: var(--text-dim); font-size: 0.88rem; }
    .mini-spin { width: 20px; height: 20px; border: 2px solid var(--surface3); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; vertical-align: middle; margin-right: 8px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;

  function resultBadgeClass(r: string) {
    if (r === 'success')   return 'result-badge result-success';
    if (r === 'error')     return 'result-badge result-error';
    if (r === 'skipped')   return 'result-badge result-skipped';
    if (r === 'not_found') return 'result-badge result-not_found';
    return 'result-badge result-default';
  }

  return (
    <>
      <style>{style}</style>

      <div className="layout">
        {/* Header */}
        <header className="header">
          <div className="header-logo">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="3"/><polyline points="2,4 12,13 22,4"/>
              </svg>
            </div>
            <span className="logo-name">UnSub</span>
          </div>
          <div className="header-right">
            <span className="badge-admin">⚙ Admin</span>
            <a href="/inbox" className="btn-nav">Inbox</a>
            <a href="/logout" className="btn-nav" style={{color:'var(--red)', borderColor:'rgba(248,113,113,0.3)'}}>Sign Out</a>
          </div>
        </header>

        {/* Sidebar */}
        <aside className="sidebar">
          <a href="/inbox" className="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
            </svg>
            Inbox
          </a>
          <a href="/admin-dashboard" className="nav-item active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            Dashboard
          </a>
        </aside>

        {/* Main */}
        <main className="main">
          <div>
            <h1 className="page-title">Admin <span>Dashboard</span></h1>
            <p className="page-sub">Registered users and unsubscribe activity at a glance.</p>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Users</div>
              <div className="stat-val accent">{usersLoading ? '—' : totalUsers}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Admins</div>
              <div className="stat-val" style={{color:'var(--accent2)'}}>{usersLoading ? '—' : adminCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Regular Users</div>
              <div className="stat-val">{usersLoading ? '—' : userCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Logs</div>
              <div className="stat-val accent">{logsLoading ? '—' : totalLogs}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Successful</div>
              <div className="stat-val green">{logsLoading ? '—' : successLogs}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Errors</div>
              <div className="stat-val red">{logsLoading ? '—' : errorLogs}</div>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="tab-bar">
            <button className={`tab-btn${tab === 'users' ? ' active' : ''}`} onClick={() => setTab('users')}>
              Users ({totalUsers})
            </button>
            <button className={`tab-btn${tab === 'logs' ? ' active' : ''}`} onClick={() => setTab('logs')}>
              Unsubscribe Logs ({totalLogs})
            </button>
          </div>

          {/* Users table */}
          {tab === 'users' && (
            <div className="section">
              <div className="section-header">
                <span className="section-title">Registered Users</span>
                <span className="section-count">{totalUsers} total</span>
              </div>
              <div className="table-wrap">
                {usersLoading ? (
                  <div className="tbl-loading"><span className="mini-spin" />Loading users…</div>
                ) : usersError ? (
                  <div className="tbl-error">⚠ {usersError}</div>
                ) : users.length === 0 ? (
                  <div className="tbl-empty">No users found.</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={u.id}>
                          <td className="cell-dim">{i + 1}</td>
                          <td className="cell-email">{u.email}</td>
                          <td className="cell-name">{u.name || <span style={{color:'var(--text-dim)'}}>—</span>}</td>
                          <td>
                            <span className={`role-badge ${u.role === 'admin' ? 'role-admin' : 'role-user'}`}>
                              {u.role === 'admin' ? '⚙ Admin' : '● User'}
                            </span>
                          </td>
                          <td className="cell-dim">{fmtDate(u.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Logs table */}
          {tab === 'logs' && (
            <div className="section">
              <div className="section-header">
                <span className="section-title">Unsubscribe Logs</span>
                <span className="section-count">{totalLogs} entries</span>
              </div>
              <div className="table-wrap">
                {logsLoading ? (
                  <div className="tbl-loading"><span className="mini-spin" />Loading logs…</div>
                ) : logsError ? (
                  <div className="tbl-error">⚠ {logsError}</div>
                ) : logs.length === 0 ? (
                  <div className="tbl-empty">No logs yet. Unsubscribe actions will appear here.</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Organisation</th>
                        <th>Sender Email</th>
                        <th>Result</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((l, i) => (
                        <tr key={l.id ?? i}>
                          <td className="cell-dim">{i + 1}</td>
                          <td className="cell-name">{l.organization_name || '—'}</td>
                          <td className="cell-email">{l.sender_email || '—'}</td>
                          <td>
                            <span className={resultBadgeClass(l.result)}>{l.result}</span>
                          </td>
                          <td className="cell-dim">{fmtDate(l.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
