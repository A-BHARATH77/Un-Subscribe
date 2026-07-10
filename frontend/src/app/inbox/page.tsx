'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Email {
  id: string;
  from: string;
  sender_name: string;
  initials: string;
  subject: string;
  date: string;
  snippet: string;
  is_unread: boolean;
  is_starred: boolean;
}

interface AutoStatus {
  running: boolean;
  last_run: string | null;
  next_run: string | null;
  cycle_count: number;
  processed: number;
  last_results: { msg_id: string; sender: string; subject: string; status: string }[];
}

interface DrawerRow {
  msg_id: string;
  sender: string;
  subject: string;
  status: 'processing' | 'success' | 'skipped' | 'not_found' | 'error';
  icon: string;
  label: string;
}

const AVATAR_COLORS = ['av-0','av-1','av-2','av-3','av-4','av-5','av-6','av-7'];
const STATUS_ICONS: Record<string, string> = { processing:'⏳', success:'✅', skipped:'⏭️', not_found:'🔍', error:'❌', ai:'🤖' };
const STATUS_LABELS: Record<string, string> = { processing:'Processing…', success:'Unsubscribed', skipped:'Skipped', not_found:'No link', error:'Error', ai:'AI Unsubscribed' };

function escHtml(str: string) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export default function InboxPage() {
  const router = useRouter();
  const [emails, setEmails] = useState<Email[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [contentTitle, setContentTitle] = useState('Unread');
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRows, setDrawerRows] = useState<DrawerRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<{ success: number; skipped: number; not_found: number; errors: number } | null>(null);
  const [autoStatus, setAutoStatus] = useState<AutoStatus | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const lastCycleRef = useRef(-1);
  const nextRunRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshingRef = useRef(false);
  const drawerRowsRef = useRef<DrawerRow[]>([]);
  drawerRowsRef.current = drawerRows;

  // ── Fetch emails ──────────────────────────────────────────────────────────
  const fetchEmails = useCallback((label = 'INBOX', query = 'is:unread', title = 'Unread') => {
    setLoading(true);
    fetch(`/api/emails?label=${label}&q=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then((data: Email[] | { error: string }) => {
        if ('error' in data) { router.push('/sign-in'); return; }
        setEmails(data as Email[]);
        setContentTitle(title);
        setLoading(false);
      })
      .catch(() => { router.push('/sign-in'); });
  }, [router]);

  // Silent refresh
  const silentRefresh = useCallback(() => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    fetch('/api/emails?label=INBOX&q=is:unread')
      .then(r => r.json())
      .then((data: Email[]) => { setEmails(data); setContentTitle('Unread'); })
      .catch(() => {})
      .finally(() => { refreshingRef.current = false; });
  }, []);

  // Initial load + user email
  useEffect(() => {
    // Fetch emails
    fetch('/api/emails?label=INBOX&q=is:unread')
      .then(r => r.json())
      .then((data: Email[] | { error: string }) => {
        if ('error' in data) { router.push('/sign-in'); return; }
        setEmails(data as Email[]);
        setLoading(false);
      })
      .catch(() => router.push('/sign-in'));

    // Fetch user profile
    fetch('/api/me')
      .then(r => r.json())
      .then((data: { email?: string; error?: string }) => {
        if (data.email) setUserEmail(data.email);
      })
      .catch(() => {});
  }, [router]);

  // ── Server auto-status polling ────────────────────────────────────────────
  const updateServerAutoStatus = useCallback(() => {
    fetch('/api/auto-status')
      .then(r => r.json())
      .then((data: AutoStatus) => {
        setAutoStatus(data);

        if (data.running && data.next_run && data.next_run !== nextRunRef.current) {
          nextRunRef.current = data.next_run;
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
          const msUntil = Math.max(0, new Date(data.next_run).getTime() - Date.now());
          refreshTimerRef.current = setTimeout(() => {
            refreshTimerRef.current = null;
            silentRefresh();
          }, msUntil + 1000);
        }

        if (lastCycleRef.current !== -1 &&
            data.cycle_count > lastCycleRef.current &&
            data.last_results && data.last_results.length > 0) {
          silentRefresh();
        }

        lastCycleRef.current = data.cycle_count;
      })
      .catch(() => {});
  }, [silentRefresh]);

  useEffect(() => {
    updateServerAutoStatus();
    const interval = setInterval(updateServerAutoStatus, 15000);
    return () => { clearInterval(interval); if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, [updateServerAutoStatus]);

  // ── Close avatar dropdown on outside click ────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // ── Drawer helpers ────────────────────────────────────────────────────────
  function openDrawer() {
    setDrawerOpen(true);
    setDrawerRows([]);
    setSummary(null);
    setProgress({ done: 0, total: 0 });
  }
  function closeDrawer() { setDrawerOpen(false); }

  function updateProgress(done: number, total: number) {
    setProgress({ done, total });
  }

  function updateDrawerRow(msgId: string, status: string, reason?: string) {
    setDrawerRows(prev => prev.map(r =>
      r.msg_id === msgId
        ? { ...r, status: status as DrawerRow['status'], icon: STATUS_ICONS[status] || '❓', label: STATUS_LABELS[status] || status }
        : r
    ));

    if (status === 'success') {
      setTimeout(() => {
        setRemovedIds(prev => new Set([...prev, msgId]));
      }, 3000);
    }
  }

  // ── Run unsubscribe all ───────────────────────────────────────────────────
  async function runUnsubAll() {
    // Fetch current unread IDs
    const res = await fetch('/api/unread-ids');
    const data = await res.json();
    const ids: string[] = data.ids || [];
    if (!ids.length) return;

    openDrawer();
    const total = ids.length;

    // Prime the drawer rows with a processing state
    setDrawerRows(ids.map(id => {
      const email = emails.find(e => e.id === id);
      return {
        msg_id: id,
        sender: email?.sender_name || '(unknown)',
        subject: email?.subject || '(unknown)',
        status: 'processing',
        icon: STATUS_ICONS.processing,
        label: STATUS_LABELS.processing,
      };
    }));

    const sse = new EventSource(`/api/unsubscribe/all?ids=${ids.join(',')}`);
    let done = 0;

    sse.onmessage = (e) => {
      const evt = JSON.parse(e.data);
      if (evt.type === 'processing') {
        // Update row with real sender/subject from SSE
        setDrawerRows(prev => prev.map(r =>
          r.msg_id === evt.msg_id
            ? { ...r, sender: evt.sender, subject: evt.subject, status: 'processing', icon: STATUS_ICONS.processing, label: STATUS_LABELS.processing }
            : r
        ));
      } else if (evt.type === 'result') {
        done++;
        updateProgress(done, total);
        updateDrawerRow(evt.msg_id, evt.status, evt.reason);
      } else if (evt.type === 'done') {
        sse.close();
        setSummary({ success: evt.success, skipped: evt.skipped, not_found: evt.not_found, errors: evt.errors });
        silentRefresh();
      }
    };

    sse.onerror = () => { sse.close(); };
  }

  // ── Pill text ─────────────────────────────────────────────────────────────
  function pillText() {
    if (!autoStatus) return 'Server Auto: checking…';
    if (!autoStatus.running) return 'Server Auto: OFF';
    const c = autoStatus.cycle_count > 0 ? ` · ${autoStatus.cycle_count} cycle${autoStatus.cycle_count !== 1 ? 's' : ''}` : '';
    const p = autoStatus.processed > 0 ? ` · ${autoStatus.processed} processed` : '';
    return `Server Auto: ON${c}${p}`;
  }

  const initials = userEmail ? userEmail.charAt(0).toUpperCase() : 'M';
  const unreadCount = emails.filter(e => e.is_unread).length;
  const progressPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  const style = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
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
      --unread: #c8d8ff;
      --starred: #fbbf24;
      --glow: rgba(91,138,245,0.2);
      --red: #f87171;
    }

    html, body { height: 100%; font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); overflow: hidden; }

    .layout { display: grid; grid-template-columns: 260px 1fr; grid-template-rows: 60px 1fr; height: 100vh; }

    .header { grid-column: 1 / -1; background: var(--sidebar); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 20px 0 0; z-index: 100; }
    .header-logo { width: 260px; display: flex; align-items: center; gap: 10px; padding: 0 20px; flex-shrink: 0; }
    .header-logo .logo-icon { width: 34px; height: 34px; background: linear-gradient(135deg, var(--accent), var(--accent2)); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .header-logo .logo-icon svg { width: 18px; height: 18px; }
    .header-logo .logo-name { font-weight: 700; font-size: 1.05rem; letter-spacing: -0.02em; }
    .header-right { display: flex; align-items: center; margin-left: auto; padding-right: 4px; }

    .avatar-menu { position: relative; }
    .avatar-btn { width: 36px; height: 36px; background: linear-gradient(135deg, var(--accent), var(--accent2)); border-radius: 50%; border: 2px solid transparent; display: flex; align-items: center; justify-content: center; font-size: 0.78rem; font-weight: 700; color: #fff; cursor: pointer; transition: box-shadow 0.2s, border-color 0.2s; outline: none; }
    .avatar-btn:hover, .avatar-btn:focus { box-shadow: 0 0 0 3px var(--accent-soft); border-color: var(--accent); }
    .avatar-dropdown { display: none; position: absolute; right: 0; top: calc(100% + 10px); min-width: 220px; background: var(--surface2); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,0.45); padding: 8px; z-index: 500; animation: dropIn 0.18s ease; }
    @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
    .avatar-dropdown.open { display: block; }
    .dropdown-account { padding: 10px 12px 12px; border-bottom: 1px solid var(--border); margin-bottom: 6px; }
    .dropdown-label { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); margin-bottom: 4px; }
    .dropdown-email { font-size: 0.82rem; color: var(--text); word-break: break-all; }
    .dropdown-signout { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 12px; border-radius: 8px; background: transparent; border: none; color: var(--red); font-family: 'Inter', sans-serif; font-size: 0.84rem; font-weight: 500; cursor: pointer; text-decoration: none; transition: background 0.15s; }
    .dropdown-signout:hover { background: rgba(248,113,113,0.1); }
    .dropdown-signout svg { width: 14px; height: 14px; flex-shrink: 0; }

    .sidebar { background: var(--sidebar); border-right: 1px solid var(--border); padding: 16px 12px; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; cursor: pointer; transition: all 0.15s; color: var(--text-muted); font-size: 0.88rem; font-weight: 500; border: none; background: transparent; width: 100%; text-align: left; }
    .nav-item:hover { background: var(--surface); color: var(--text); }
    .nav-item.active { background: var(--accent-soft); color: var(--accent); }
    .nav-item svg { width: 16px; height: 16px; flex-shrink: 0; opacity: 0.8; }
    .nav-item.active svg { opacity: 1; }
    .nav-badge { margin-left: auto; background: var(--accent); color: #fff; font-size: 0.65rem; font-weight: 700; padding: 2px 7px; border-radius: 100px; min-width: 20px; text-align: center; }

    .content { display: flex; flex-direction: column; overflow: hidden; background: var(--bg); }
    .content-header { padding: 18px 24px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 16px; background: var(--surface); }
    .content-title { font-size: 1rem; font-weight: 600; letter-spacing: -0.01em; }
    .content-count { font-size: 0.8rem; color: var(--text-muted); }

    .email-list { flex: 1; overflow-y: auto; padding: 8px 0; }
    .email-list::-webkit-scrollbar { width: 5px; }
    .email-list::-webkit-scrollbar-track { background: transparent; }
    .email-list::-webkit-scrollbar-thumb { background: var(--surface3); border-radius: 100px; }

    .email-item { display: grid; grid-template-columns: 48px 200px 1fr auto; align-items: center; gap: 12px; padding: 12px 20px; cursor: pointer; transition: all 0.15s; border-bottom: 1px solid var(--border2); text-decoration: none; color: inherit; position: relative; }
    .email-item:hover { background: var(--surface); }
    .email-item.unread { background: rgba(91,138,245,0.04); }
    .email-item.unread:hover { background: var(--surface); }
    .email-item.unread::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: linear-gradient(180deg, var(--accent), var(--accent2)); border-radius: 0 2px 2px 0; }
    .email-item.removed { opacity: 0; max-height: 0; overflow: hidden; padding: 0; transition: all 0.5s ease; }

    .avatar { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: #fff; flex-shrink: 0; }
    .av-0 { background: linear-gradient(135deg, #5b8af5, #a78bfa); }
    .av-1 { background: linear-gradient(135deg, #f472b6, #fb923c); }
    .av-2 { background: linear-gradient(135deg, #34d399, #06b6d4); }
    .av-3 { background: linear-gradient(135deg, #f59e0b, #ef4444); }
    .av-4 { background: linear-gradient(135deg, #8b5cf6, #ec4899); }
    .av-5 { background: linear-gradient(135deg, #10b981, #3b82f6); }
    .av-6 { background: linear-gradient(135deg, #f97316, #eab308); }
    .av-7 { background: linear-gradient(135deg, #06b6d4, #6366f1); }

    .email-sender { font-size: 0.88rem; font-weight: 500; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .email-item.unread .email-sender { color: var(--unread); font-weight: 600; }
    .email-main { overflow: hidden; }
    .email-subject { font-size: 0.88rem; font-weight: 500; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .email-item.unread .email-subject { color: var(--text); font-weight: 600; }
    .email-snippet { font-size: 0.8rem; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
    .email-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
    .email-date { font-size: 0.78rem; color: var(--text-dim); white-space: nowrap; }
    .email-item.unread .email-date { color: var(--accent); font-weight: 600; }
    .star-btn { background: none; border: none; cursor: pointer; color: var(--text-dim); padding: 2px; transition: color 0.15s, transform 0.15s; line-height: 1; }
    .star-btn.starred { color: var(--starred); }
    .star-btn svg { width: 14px; height: 14px; }

    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 16px; color: var(--text-dim); }
    .empty-state svg { width: 64px; height: 64px; opacity: 0.3; }
    .empty-state h3 { font-size: 1rem; font-weight: 500; color: var(--text-muted); }
    .empty-state p { font-size: 0.85rem; }

    .loading { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 16px; color: var(--text-muted); }
    .spinner { width: 36px; height: 36px; border: 3px solid var(--surface3); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .server-auto-pill { display: flex; align-items: center; gap: 6px; padding: 5px 12px; background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.25); border-radius: 100px; font-size: 0.75rem; font-weight: 600; color: #34d399; white-space: nowrap; cursor: default; transition: all 0.3s; }
    .server-auto-pill.idle { background: rgba(123,132,154,0.08); border-color: rgba(123,132,154,0.2); color: var(--text-muted); }
    .server-auto-dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; animation: pulse-dot 1.8s ease-in-out infinite; flex-shrink: 0; }
    .server-auto-pill.idle .server-auto-dot { background: var(--text-dim); animation: none; }
    @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.5;transform:scale(0.8);} }

    .unsub-drawer-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 200; }
    .unsub-drawer-overlay.active { display: block; }
    .unsub-drawer { position: fixed; right: 0; top: 0; bottom: 0; width: 460px; max-width: 95vw; background: var(--surface); border-left: 1px solid var(--border); z-index: 300; display: flex; flex-direction: column; transform: translateX(110%); transition: transform 0.35s cubic-bezier(0.4,0,0.2,1); box-shadow: -16px 0 48px rgba(0,0,0,0.4); }
    .unsub-drawer.open { transform: translateX(0); }
    .drawer-header { padding: 20px 22px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
    .drawer-title { font-size: 1rem; font-weight: 700; letter-spacing: -0.01em; flex: 1; }
    .drawer-close { width: 30px; height: 30px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface2); color: var(--text-muted); font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
    .drawer-close:hover { border-color: var(--red); color: var(--red); }
    .drawer-progress-bar-wrap { padding: 14px 22px 0; flex-shrink: 0; }
    .drawer-progress-info { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px; }
    .progress-track { height: 5px; background: var(--surface3); border-radius: 100px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #f87171, #fb923c); border-radius: 100px; transition: width 0.4s ease; }
    .drawer-list { flex: 1; overflow-y: auto; padding: 12px 8px; }
    .drawer-list::-webkit-scrollbar { width: 4px; }
    .drawer-list::-webkit-scrollbar-thumb { background: var(--surface3); border-radius: 100px; }
    .drawer-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; transition: background 0.15s; font-size: 0.83rem; }
    .drawer-row:hover { background: var(--surface2); }
    .drawer-row-icon { font-size: 1.1rem; flex-shrink: 0; width: 22px; text-align: center; }
    .drawer-row-info { flex: 1; overflow: hidden; }
    .drawer-row-sender { font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .drawer-row-subject { font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .drawer-row-status { font-size: 0.72rem; padding: 2px 8px; border-radius: 100px; white-space: nowrap; flex-shrink: 0; }
    .status-processing { background: rgba(91,138,245,0.15); color: var(--accent); }
    .status-success { background: rgba(52,211,153,0.13); color: #34d399; }
    .status-skipped { background: rgba(251,191,36,0.12); color: #fbbf24; }
    .status-not_found { background: rgba(148,163,184,0.1); color: var(--text-muted); }
    .status-error { background: rgba(248,113,113,0.12); color: #f87171; }
    .drawer-summary { padding: 18px 22px; border-top: 1px solid var(--border); flex-shrink: 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
    .summary-cell { background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 10px 8px; text-align: center; }
    .summary-num { font-size: 1.3rem; font-weight: 700; margin-bottom: 2px; }
    .summary-label { font-size: 0.68rem; color: var(--text-muted); }
    .s-success { color: #34d399; }
    .s-skipped { color: #fbbf24; }
    .s-notfound { color: var(--text-muted); }
    .s-error { color: #f87171; }
    .btn-drawer-close-bottom { width: 100%; padding: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; color: var(--text-muted); font-family: 'Inter', sans-serif; font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: all 0.2s; }
    .btn-drawer-close-bottom:hover { background: var(--surface3); color: var(--text); }

    .done-badge { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-size: 0.7rem; font-weight: 600; color: #34d399; background: rgba(52,211,153,0.12); border: 1px solid rgba(52,211,153,0.3); border-radius: 100px; padding: 2px 10px; pointer-events: none; }
  `;

  return (
    <>
      <style>{style}</style>
      <div className="layout">
        {/* Header */}
        <header className="header">
          <div className="header-logo">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="3"/>
                <polyline points="2,4 12,13 22,4"/>
              </svg>
            </div>
            <span className="logo-name">MailView</span>
          </div>

          <div className="header-right">
            <div className="avatar-menu" id="avatar-menu" ref={avatarMenuRef}>
              <button
                className="avatar-btn"
                id="avatar-btn"
                onClick={() => setAvatarOpen(o => !o)}
                aria-haspopup="true"
                aria-expanded={avatarOpen}
              >{initials}</button>
              <div className={`avatar-dropdown${avatarOpen ? ' open' : ''}`} id="avatar-dropdown" role="menu">
                <div className="dropdown-account">
                  <div className="dropdown-label">Signed in as</div>
                  <div className="dropdown-email" id="dropdown-email-text">{userEmail || '—'}</div>
                </div>
                <a href="/logout" className="dropdown-signout" id="logout-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign out
                </a>
              </div>
            </div>
          </div>
        </header>

        {/* Sidebar */}
        <aside className="sidebar">
          <button className="nav-item active" id="nav-inbox" onClick={() => fetchEmails('INBOX', 'is:unread', 'Unread')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
            </svg>
            Unread
            {emails.filter(e => e.is_unread && !removedIds.has(e.id)).length > 0 && (
              <span className="nav-badge">{emails.filter(e => e.is_unread && !removedIds.has(e.id)).length}</span>
            )}
          </button>
        </aside>

        {/* Main Content */}
        <main className="content">
          <div className="content-header">
            <h1 className="content-title" id="content-title">{contentTitle}</h1>
            <span className="content-count" id="content-count">{emails.length} unread</span>

            <div
              className={`server-auto-pill${(!autoStatus || !autoStatus.running) ? ' idle' : ''}`}
              id="server-auto-pill"
              title="Server-side background auto-unsubscribe status"
            >
              <span className="server-auto-dot"></span>
              <span id="server-auto-label">{pillText()}</span>
            </div>
          </div>

          <div className="email-list" id="email-list">
            {loading ? (
              <div className="loading">
                <div className="spinner"></div>
                <span>Loading emails…</span>
              </div>
            ) : emails.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                  <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                </svg>
                <h3>No emails found</h3>
                <p>Your inbox is empty or no emails matched.</p>
              </div>
            ) : (
              emails.map((email, i) => {
                const isRemoved = removedIds.has(email.id);
                return (
                  <a
                    key={email.id}
                    className={`email-item${email.is_unread ? ' unread' : ''}${isRemoved ? ' removed' : ''}`}
                    href={`/email/${email.id}`}
                    id={`email-${email.id}`}
                    style={isRemoved ? { opacity: 0.35 } : {}}
                  >
                    <div className={`avatar ${AVATAR_COLORS[i % 8]}`}>{email.initials}</div>
                    <span className="email-sender">{email.sender_name}</span>
                    <div className="email-main">
                      <div className="email-subject">{email.subject}</div>
                      <div className="email-snippet">{email.snippet}</div>
                    </div>
                    <div className="email-meta">
                      <span className="email-date">{email.date}</span>
                      {email.is_starred && (
                        <span className="star-btn starred">
                          <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                        </span>
                      )}
                      {isRemoved && <span className="done-badge">✔ Unsubscribed</span>}
                    </div>
                  </a>
                );
              })
            )}
          </div>
        </main>
      </div>

      {/* Drawer Overlay */}
      <div className={`unsub-drawer-overlay${drawerOpen ? ' active' : ''}`} id="drawer-overlay" onClick={closeDrawer}></div>

      {/* Unsub All Progress Drawer */}
      <div className={`unsub-drawer${drawerOpen ? ' open' : ''}`} id="unsub-drawer">
        <div className="drawer-header">
          <div className="drawer-title">🚫 Unsubscribe All</div>
          <button className="drawer-close" onClick={closeDrawer} title="Close">✕</button>
        </div>

        <div className="drawer-progress-bar-wrap">
          <div className="drawer-progress-info">
            <span id="drawer-progress-text">
              {progress.total > 0 ? `Processing ${progress.done} of ${progress.total}` : 'Ready'}
            </span>
            <span id="drawer-progress-pct">{progressPct}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" id="progress-fill" style={{ width: `${progressPct}%` }}></div>
          </div>
        </div>

        <div className="drawer-list" id="drawer-list">
          {drawerRows.map(row => (
            <div key={row.msg_id} className="drawer-row" id={`drow-${row.msg_id}`}>
              <div className="drawer-row-icon">{row.icon}</div>
              <div className="drawer-row-info">
                <div className="drawer-row-sender">{row.sender}</div>
                <div className="drawer-row-subject">{row.subject}</div>
              </div>
              <span className={`drawer-row-status status-${row.status}`}>{row.label}</span>
            </div>
          ))}
        </div>

        {summary && (
          <div className="drawer-summary" id="drawer-summary">
            <div className="summary-grid">
              <div className="summary-cell">
                <div className="summary-num s-success" id="sum-success">{summary.success}</div>
                <div className="summary-label">Unsubscribed</div>
              </div>
              <div className="summary-cell">
                <div className="summary-num s-skipped" id="sum-skipped">{summary.skipped}</div>
                <div className="summary-label">Skipped</div>
              </div>
              <div className="summary-cell">
                <div className="summary-num s-notfound" id="sum-notfound">{summary.not_found}</div>
                <div className="summary-label">No Link</div>
              </div>
              <div className="summary-cell">
                <div className="summary-num s-error" id="sum-error">{summary.errors}</div>
                <div className="summary-label">Errors</div>
              </div>
            </div>
            <button className="btn-drawer-close-bottom" onClick={closeDrawer}>Close</button>
          </div>
        )}
      </div>
    </>
  );
}
