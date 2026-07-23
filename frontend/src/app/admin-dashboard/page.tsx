'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';

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



const AVATAR_COLORS = ['av-0','av-1','av-2','av-3','av-4','av-5','av-6','av-7'];


function escHtml(str: string) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export default function AdminDashboardPage() {
  const router = useRouter();
  
  const [theme, setTheme] = useState('yellow');
  const [loaderData, setLoaderData] = useState<any>(null);
  const [refreshData, setRefreshData] = useState<any>(null);
  const [liveData, setLiveData] = useState<any>(null);
  const [showLoader, setShowLoader] = useState(true);
  const fullLoaderRef = useRef<HTMLDivElement>(null);
  const fullLottieContainerRef = useRef<HTMLDivElement>(null);
  
  // Admin stats state
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);

  // Inbox state
  const [emails, setEmails] = useState<Email[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contentTitle, setContentTitle] = useState('Unsub\'s Live');
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [showLiveView, setShowLiveView] = useState(false);

  const [autoStatus, setAutoStatus] = useState<AutoStatus | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<{ id: string; time: string; text: string; color: string }[]>([]);
  const [terminalQueue, setTerminalQueue] = useState<any[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  
  const processingEmailsRef = useRef<Set<string>>(new Set());
  const terminalProcessedSet = useRef<Set<string>>(new Set());
  const originalEmailsRef = useRef<Map<string, Email>>(new Map());

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  useEffect(() => {
    if (terminalQueue.length > 0 && !isProcessingQueue) {
      setIsProcessingQueue(true);
      const item = terminalQueue[0];
      
      const log = (text: string, color: string) => {
        setTerminalLogs(prev => [...prev.slice(-99), { id: Math.random().toString(), time: new Date().toLocaleTimeString(), text, color }]);
      };
      
      log(`Just received the mail from ${item.sender}`, '#e5e7eb');
      
      setTimeout(() => {
        log(`Processing the unsubscribing...`, '#93c5fd');
        setTimeout(() => {
          const color = item.status === 'success' ? '#4ade80' : (item.status === 'error' ? '#f87171' : '#facc15');
          log(`Result: ${item.status}`, color);
          
          processingEmailsRef.current.delete(item.msg_id);
          setRemovedIds(prev => new Set(prev).add(item.msg_id));
          
          setTerminalQueue(prev => prev.slice(1));
          setIsProcessingQueue(false);
          
        }, 500);
      }, 2000);
    }
  }, [terminalQueue, isProcessingQueue]);

  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const lastCycleRef = useRef(-1);
  const lastProcessedRef = useRef(-1);
  const nextRunRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshingRef = useRef(false);

  // ── Fetch emails ──
  const fetchEmails = useCallback((label = 'INBOX', query = 'is:unread', title = 'Unsub\'s Live') => {
    setLoading(true);
    fetch(`/api/emails?label=${label}&q=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then((data: Email[] | { error: string }) => {
        if ('error' in data) { router.push('/sign-in'); return; }
        const arr = data as Email[];
        arr.forEach(e => originalEmailsRef.current.set(e.id, e));
        setEmails(arr);
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
      .then((data: Email[]) => { 
        const newData = [...data];
        data.forEach(e => originalEmailsRef.current.set(e.id, e));
        
        processingEmailsRef.current.forEach(pid => {
          if (!newData.find(e => e.id === pid)) {
            const cached = originalEmailsRef.current.get(pid);
            if (cached) newData.push(cached);
          }
        });
        
        setEmails(newData); 
        setContentTitle('Unsub\'s Live'); 
      })
      .catch(() => {})
      .finally(() => { refreshingRef.current = false; });
  }, []);

  // Initial load
  useEffect(() => {
    const saved = localStorage.getItem('unsub_theme');
    if (saved) setTheme(saved);

    fetch('/loader.json').then(r => r.json()).then(setLoaderData).catch(console.error);
    fetch('/refresh.json').then(r => r.json()).then(setRefreshData).catch(console.error);
    fetch('/live.json').then(r => r.json()).then(setLiveData).catch(console.error);

    // Fetch admin data
    fetch('/api/admin/users').then(r => r.json()).then(d => { if(!d.error) setUsers(d); setUsersLoading(false); }).catch(()=>setUsersLoading(false));
    fetch('/api/admin/logs').then(r => r.json()).then(d => { if(!d.error) setLogs(d); setLogsLoading(false); }).catch(()=>setLogsLoading(false));

    // Fetch initial emails
    fetch('/api/emails?label=INBOX&q=is:unread')
      .then(r => r.json())
      .then((data: Email[] | { error: string }) => {
        if ('error' in data) { router.push('/sign-in'); return; }
        const arr = data as Email[];
        arr.forEach(e => originalEmailsRef.current.set(e.id, e));
        setEmails(arr);
        setLoading(false);
      })
      .catch(() => router.push('/sign-in'));

    // Fetch user profile
    fetch('/api/me')
      .then(r => r.json())
      .then((data: { email?: string; name?: string; error?: string }) => {
        if (data.email) setUserEmail(data.email);
        if (data.name) setUserName(data.name);
      })
      .catch(() => {});
  }, [router]);

  // ── Server auto-status polling ──
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
        
        if (data.last_results && data.last_results.length > 0) {
          const newItems: any[] = [];
          data.last_results.forEach(res => {
            if (!terminalProcessedSet.current.has(res.msg_id)) {
              terminalProcessedSet.current.add(res.msg_id);
              processingEmailsRef.current.add(res.msg_id);
              newItems.push(res);
            }
          });
          if (newItems.length > 0) {
            setTerminalQueue(prev => [...prev, ...newItems]);
          }
        }

        if (lastProcessedRef.current !== -1 && data.processed > lastProcessedRef.current) {
          silentRefresh();
        }

        lastCycleRef.current = data.cycle_count;
        lastProcessedRef.current = data.processed;
      })
      .catch(() => {});
  }, [silentRefresh]);

  useEffect(() => {
    updateServerAutoStatus();
    const interval = setInterval(updateServerAutoStatus, 10000);
    return () => { clearInterval(interval); if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, [updateServerAutoStatus]);

  // GSAP Loader Animation
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).gsap) return;
    const gsap = (window as any).gsap;
    
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.to(fullLoaderRef.current, {
          opacity: 0,
          duration: 0.8,
          ease: "power2.inOut",
          onComplete: () => setShowLoader(false)
        });
      }
    });

    tl.fromTo(fullLottieContainerRef.current,
      { x: '-100vw', opacity: 1 },
      { x: 0, duration: 1.2, ease: "back.out(1.2)" }
    )
    .to(fullLottieContainerRef.current, {
      x: '100vw',
      duration: 1.2,
      ease: "power2.in",
      delay: 3
    });
  }, []);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);



  function pillText() {
    if (!autoStatus) return 'Server Auto: checking…';
    if (!autoStatus.running) return 'Server Auto: OFF';
    const c = autoStatus.cycle_count > 0 ? ` · ${autoStatus.cycle_count} cycle${autoStatus.cycle_count !== 1 ? 's' : ''}` : '';
    const p = autoStatus.processed > 0 ? ` · ${autoStatus.processed} processed` : '';
    return `Server Auto: ON${c}${p}`;
  }

  const THEMES: Record<string, any> = {
    yellow: { bg1: '#fefce8', bg2: '#fde68a', bg3: '#fef9c3', l1: '#fffdf5', l2: '#fffbeb', l3: '#fef3c7', l4: '#fde68a', l5: '#fbbf24', bl1: 'rgba(254,252,232,0.3)', bl2: 'rgba(253,230,138,0.45)', primary: '#fbbf24', primarySub: '#f59e0b', primaryDark: '#d97706', primaryLight: 'rgba(251,191,36,0.18)', primaryHover: 'rgba(251,191,36,0.05)' },
    red: { bg1: '#fef2f2', bg2: '#fca5a5', bg3: '#fee2e2', l1: '#fffafa', l2: '#fef2f2', l3: '#fecaca', l4: '#fca5a5', l5: '#f87171', bl1: 'rgba(254,242,242,0.3)', bl2: 'rgba(252,165,165,0.45)', primary: '#f87171', primarySub: '#ef4444', primaryDark: '#dc2626', primaryLight: 'rgba(248,113,113,0.18)', primaryHover: 'rgba(248,113,113,0.05)' },
    green: { bg1: '#f0fdf4', bg2: '#86efac', bg3: '#dcfce7', l1: '#f7fcf8', l2: '#f0fdf4', l3: '#bbf7d0', l4: '#86efac', l5: '#4ade80', bl1: 'rgba(240,253,244,0.3)', bl2: 'rgba(134,239,172,0.45)', primary: '#4ade80', primarySub: '#22c55e', primaryDark: '#16a34a', primaryLight: 'rgba(74,222,128,0.18)', primaryHover: 'rgba(74,222,128,0.05)' },
    blue: { bg1: '#eff6ff', bg2: '#93c5fd', bg3: '#dbeafe', l1: '#f8faff', l2: '#eff6ff', l3: '#bfdbfe', l4: '#93c5fd', l5: '#60a5fa', bl1: 'rgba(239,246,255,0.3)', bl2: 'rgba(147,197,253,0.45)', primary: '#60a5fa', primarySub: '#3b82f6', primaryDark: '#2563eb', primaryLight: 'rgba(96,165,250,0.18)', primaryHover: 'rgba(96,165,250,0.05)' },
    violet: { bg1: '#f5f3ff', bg2: '#c4b5fd', bg3: '#ede9fe', l1: '#fcfbfe', l2: '#f5f3ff', l3: '#ddd6fe', l4: '#c4b5fd', l5: '#a78bfa', bl1: 'rgba(245,243,255,0.3)', bl2: 'rgba(196,181,253,0.45)', primary: '#a78bfa', primarySub: '#8b5cf6', primaryDark: '#7c3aed', primaryLight: 'rgba(167,139,250,0.18)', primaryHover: 'rgba(167,139,250,0.05)' }
  };
  const activeTheme = THEMES[theme] || THEMES.yellow;
  const initials = userEmail ? userEmail.charAt(0).toUpperCase() : 'A';


  return (
    <>
      {showLoader && (
        <div
          ref={fullLoaderRef}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          <div ref={fullLottieContainerRef} style={{ width: '400px', height: '400px' }}>
            {loaderData && <Lottie animationData={loaderData} loop={true} autoplay={true} />}
          </div>
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100vh; overflow-x: hidden !important; overflow-y: auto !important; font-family: 'Plus Jakarta Sans', sans-serif; }

        .db-root {
          --bg1: ${activeTheme.bg1};
          --bg2: ${activeTheme.bg2};
          --bg3: ${activeTheme.bg3};
          --l1: ${activeTheme.l1};
          --l2: ${activeTheme.l2};
          --l3: ${activeTheme.l3};
          --l4: ${activeTheme.l4};
          --l5: ${activeTheme.l5};
          --bl1: ${activeTheme.bl1};
          --bl2: ${activeTheme.bl2};
          --primary: ${activeTheme.primary};
          --primary-sub: ${activeTheme.primarySub};
          --primary-dark: ${activeTheme.primaryDark};
          --primary-light: ${activeTheme.primaryLight};
          --primary-hover: ${activeTheme.primaryHover};
          --primary-text: ${theme === 'yellow' ? '#1a1a1a' : '#fff'};
          --text: #1a1a1a;
          --text-muted: #555;
          --text-dim: #888;
          --surface: rgba(255,255,255,0.55);
          --surface2: rgba(255,255,255,0.7);
          --surface3: rgba(0,0,0,0.05);
          --border: rgba(255,255,255,0.8);
          --border2: rgba(0,0,0,0.06);

          min-height: 100vh;
          background:
            radial-gradient(ellipse 80% 55% at 90% 0%,   var(--bg2) 0%, transparent 55%),
            radial-gradient(ellipse 60% 65% at 100% 0%,  var(--bg1) 0%, transparent 50%),
            radial-gradient(ellipse 70% 50% at 5%  95%,  var(--bg3) 0%, transparent 60%),
            linear-gradient(155deg, var(--l1) 0%, var(--l2) 25%, var(--l3) 55%, var(--l4) 80%, var(--l5) 100%);
          position: relative;
          color: var(--text);
        }

        .db-bloom { position: fixed; pointer-events: none; z-index: 0; border-radius: 50%; }
        .db-bloom-1 {
          width: 900px; height: 700px; top: -200px; right: -180px;
          background: radial-gradient(ellipse, rgba(255,255,255,0.8) 0%, var(--bl1) 40%, transparent 70%); filter: blur(50px);
        }
        .db-bloom-2 {
          width: 600px; height: 500px; bottom: -120px; left: -80px;
          background: radial-gradient(ellipse, var(--bl2) 0%, var(--bg3) 50%, transparent 75%); filter: blur(60px);
          animation: blobDrift 18s ease-in-out infinite reverse;
        }
        .db-bloom-3 {
          width: 350px; height: 350px; top: 40%; left: 30%;
          background: radial-gradient(ellipse, var(--primary-light) 0%, transparent 70%); filter: blur(80px);
          animation: blobDrift 22s ease-in-out infinite;
        }
        @keyframes blobDrift { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-24px) scale(1.04); } }
        @keyframes pulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.85); } }

        .db-layout { position: relative; z-index: 1; display: flex; flex-direction: column; min-height: 100vh; }

        .db-nav {
          display: flex; align-items: center; justify-content: space-between; padding: 14px 40px;
          background: rgba(255,255,255,0.45); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
          border-bottom: 1px solid rgba(255,255,255,0.6); box-shadow: 0 4px 24px rgba(0,0,0,0.04);
          position: sticky; top: 0; z-index: 100;
        }
        .db-nav-logo { display: flex; align-items: center; gap: 10px; font-size: 1.05rem; font-weight: 600; color: #1a1a1a; letter-spacing: -0.03em; }
        .db-logo-icon { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .db-nav-right { display: flex; align-items: center; gap: 10px; }
        .db-btn-signout {
          padding: 7px 14px; background: #fff; border: 1px solid rgba(0,0,0,0.1); border-radius: 10px;
          font-size: 0.78rem; font-weight: 600; color: #555; cursor: pointer; text-decoration: none; transition: all 0.18s;
        }
        .db-btn-signout:hover { background: rgba(239,68,68,0.07); border-color: rgba(239,68,68,0.25); color: #dc2626; }

        .db-body {
          flex: 1; padding: 36px 40px 60px; max-width: 1440px; margin: 0 auto; width: 100%;
          display: flex; flex-direction: column; gap: 24px; align-items: stretch;
        }
        
        .db-card {
          background: var(--surface); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
          border: 1px solid var(--border); border-radius: 22px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9);
          overflow: hidden; transition: transform 0.25s, box-shadow 0.25s, background 0.25s;
        }
        .db-card:hover { transform: translateY(-3px); background: rgba(255,255,255,0.68); box-shadow: 0 10px 40px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.95); }
        
        .status-badge-container { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 30px 40px; }
        .status-title { font-size: 1.2rem; font-weight: 700; color: #1a1a1a; letter-spacing: -0.02em; }
        .status-pill {
          display: inline-flex; align-items: center; gap: 10px; padding: 12px 24px;
          background: var(--primary-light); border: 1.5px solid var(--primary); border-radius: 99px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.06); transition: all 0.3s;
        }
        .status-pill.idle { background: rgba(123,132,154,0.08); border-color: rgba(123,132,154,0.2); }
        .status-dot {
          width: 10px; height: 10px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981;
          animation: pulseDot 2s ease-in-out infinite;
        }
        .status-pill.idle .status-dot { background: var(--text-dim); box-shadow: none; animation: none; }
        .status-text { font-size: 1rem; font-weight: 800; color: #065f46; letter-spacing: 0.04em; }
        .db-card { background: var(--bg-card); border-radius: 20px; border: 1px solid var(--border); overflow: hidden; display: flex; flex-direction: column; }
        .glass-panel { background: rgba(255, 255, 255, 0.45); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px); border: 1px solid rgba(255, 255, 255, 0.4); box-shadow: 0 12px 40px rgba(0,0,0,0.04); border-radius: 20px; overflow: hidden; display: flex; flex-direction: column; }
        
        .content-header { padding: 20px 30px; border-bottom: 1px solid var(--border2); display: flex; align-items: center; justify-content: space-between; }
        .content-title { font-size: 1.2rem; font-weight: 700; letter-spacing: -0.01em; color: var(--text); }
        .content-count { font-size: 0.9rem; color: var(--text-muted); font-weight: 600; background: rgba(0,0,0,0.05); padding: 4px 12px; border-radius: 99px; }
        
        .email-list { flex: 1; min-height: 400px; overflow-y: auto; padding: 8px 0; position: relative; }
        .email-list::-webkit-scrollbar { width: 6px; }
        .email-list::-webkit-scrollbar-track { background: transparent; }
        .email-list::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 100px; }

        .email-item { display: grid; grid-template-columns: 48px 200px 1fr auto; align-items: center; gap: 16px; padding: 14px 30px; cursor: pointer; transition: all 0.15s; border-bottom: 1px solid var(--border2); text-decoration: none; color: inherit; position: relative; }
        .email-item:hover { background: rgba(255,255,255,0.7); }
        .email-item.unread { background: rgba(255,255,255,0.9); box-shadow: inset 3px 0 0 var(--primary); }
        .email-item.removed { opacity: 0; max-height: 0; overflow: hidden; padding: 0; border: none; transition: all 0.5s ease; }

        .avatar { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: #fff; flex-shrink: 0; }
        .av-0 { background: linear-gradient(135deg, #5b8af5, #a78bfa); }
        .av-1 { background: linear-gradient(135deg, #f472b6, #fb923c); }
        .av-2 { background: linear-gradient(135deg, #34d399, #06b6d4); }
        .av-3 { background: linear-gradient(135deg, #f59e0b, #ef4444); }
        .av-4 { background: linear-gradient(135deg, #8b5cf6, #ec4899); }
        .av-5 { background: linear-gradient(135deg, #10b981, #3b82f6); }
        .av-6 { background: linear-gradient(135deg, #f97316, #eab308); }
        .av-7 { background: linear-gradient(135deg, #06b6d4, #6366f1); }

        .email-sender { font-size: 0.95rem; font-weight: 500; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .email-item.unread .email-sender { color: var(--text); font-weight: 700; }
        .email-main { overflow: hidden; }
        .email-subject { font-size: 0.95rem; font-weight: 500; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .email-item.unread .email-subject { color: var(--text); font-weight: 700; }
        .email-snippet { font-size: 0.85rem; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 4px; }
        .email-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
        .email-date { font-size: 0.8rem; color: var(--text-dim); white-space: nowrap; }
        .email-item.unread .email-date { color: var(--primary-dark); font-weight: 700; }
        .star-btn { background: none; border: none; cursor: pointer; color: var(--text-dim); padding: 2px; transition: color 0.15s, transform 0.15s; line-height: 1; }
        .star-btn.starred { color: var(--primary); }
        .star-btn svg { width: 16px; height: 16px; }

        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; position: absolute; inset: 0; min-height: 200px; gap: 16px; color: var(--text-dim); transition: opacity 0.8s ease, visibility 0.8s ease; }
        .empty-state.visible { opacity: 1; visibility: visible; }
        .empty-state.hidden { opacity: 0; visibility: hidden; pointer-events: none; }
        .empty-state svg { width: 48px; height: 48px; opacity: 0.4; }
        .empty-state h3 { font-size: 1.1rem; font-weight: 600; color: var(--text-muted); }

        .email-items-container { display: flex; flex-direction: column; transition: opacity 0.8s ease, visibility 0.8s ease; }
        .email-items-container.visible { opacity: 1; visibility: visible; }
        .email-items-container.hidden { opacity: 0; visibility: hidden; pointer-events: none; }
        
        .loading { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 200px; gap: 16px; color: var(--text-muted); font-weight: 500; }
        .spinner { width: 36px; height: 36px; border: 3px solid rgba(0,0,0,0.1); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }


        
        .action-button { background: var(--primary); color: #fff; border: none; padding: 8px 18px; border-radius: 99px; font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px var(--primary-light); }
        .action-button:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .action-button:active { transform: translateY(1px); }

        .db-welcome h1 { font-size: 2.2rem; font-weight: 500; color: #1a1a1a; letter-spacing: -0.05em; line-height: 1.1; margin-left: -4px; }
        .db-welcome p { font-size: 0.88rem; color: #888; margin-top: 5px; font-weight: 400; }
        .db-settings-btn { position: fixed; bottom: 24px; left: 24px; width: 44px; height: 44px; border-radius: 12px; background: #fff; border: 1px solid rgba(0,0,0,0.09); box-shadow: 0 2px 12px rgba(0,0,0,0.07); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 1000; transition: all 0.2s; }
        .db-settings-btn:hover { background: #f7f7f7; transform: scale(1.05); box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .db-settings-btn svg { width: 20px; height: 20px; color: #444; }
        .db-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 9999; opacity: 0; pointer-events: none; transition: opacity 0.2s; }
        .db-overlay.open { opacity: 1; pointer-events: auto; }
        .db-overlay-card { background: #fff; border-radius: 20px; padding: 32px 24px; width: 90%; max-width: 320px; box-shadow: 0 16px 60px rgba(0,0,0,0.12); display: flex; flex-direction: column; align-items: center; gap: 10px; transform: translateY(16px); transition: transform 0.2s; position: relative; }
        .db-overlay.open .db-overlay-card { transform: translateY(0); }
        .db-overlay-close { position: absolute; top: 14px; right: 14px; background: rgba(0,0,0,0.05); border: none; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #888; transition: background 0.15s; }
        .db-overlay-close:hover { background: rgba(0,0,0,0.1); color: #111; }
        .db-theme-picker { display: flex; gap: 12px; margin-bottom: 10px; }
        .db-theme-btn { width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; transition: transform 0.2s; }
        .db-theme-btn:hover { transform: scale(1.1); }
        .db-theme-btn.active { border-color: #1a1a1a; box-shadow: 0 0 0 2px #fff inset; }
        .db-overlay-signout { width: 100%; padding: 11px; background: rgba(239, 68, 68, 0.07); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; font-weight: 700; font-size: 0.9rem; cursor: pointer; text-align: center; text-decoration: none; transition: all 0.15s; }
        .db-overlay-signout:hover { background: rgba(239, 68, 68, 0.14); }
      `}</style>

      <div className="db-root">
        <div className="db-bloom db-bloom-1" />
        <div className="db-bloom db-bloom-2" />
        <div className="db-bloom db-bloom-3" />

        <div className="db-layout">
          <nav className="db-nav">
            <div className="db-nav-logo">
              <div className="db-logo-icon" style={{ background: 'transparent' }}>
                <img src="/email.svg" alt="UnSub" style={{ width: '100%', height: '100%' }} />
              </div>
              UnSub Admin
            </div>
            <div className="db-nav-right">
              <button 
                className="action-button" 
                onClick={() => setShowLiveView(!showLiveView)}
                style={{ background: showLiveView ? '#dc2626' : 'var(--primary)' }}
              >
                {showLiveView ? 'Hide Live Stream' : 'Watch Live Stream'}
              </button>
            </div>
          </nav>

          <main className="db-body">
            
            {/* Welcome */}
            <div className="db-welcome">
              <h1>Welcome Admin, {userName || (userEmail ? userEmail.split('@')[0] : 'User')}</h1>
              <p>Here&apos;s your unsubscribe activity at a glance.</p>
            </div>

            <div className="db-grid" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '20px', width: '100%', minHeight: '500px' }}>
             <div className="glass-panel" style={{ gridColumn: '1 / 2', display: 'flex', flexDirection: 'column' }}>
               <div className="content-header">
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <h1 className="content-title" style={{ margin: 0 }}>{contentTitle}</h1>
                   {liveData && (
                     <div style={{ width: '49px', height: '49px' }}>
                       <Lottie animationData={liveData} loop={true} autoplay={true} />
                     </div>
                   )}
                 </div>
                 <span className="content-count">{emails.filter(e => !removedIds.has(e.id)).length} unread</span>
               </div>

               <div className="email-list">
                 {loading ? (
                   <div className="loading">
                     <div className="spinner"></div>
                     <span>Loading emails…</span>
                   </div>
                 ) : (
                   <>
                     <div className={`empty-state ${emails.filter(e => !removedIds.has(e.id)).length === 0 ? 'visible' : 'hidden'}`}>
                       {refreshData ? (
                         <div style={{ width: '120px', height: '120px' }}>
                           <Lottie animationData={refreshData} loop={true} autoplay={true} />
                         </div>
                       ) : (
                         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                           <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                           <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                         </svg>
                       )}
                       <h3>Your inbox is Empty</h3>
                     </div>
                     <div className={`email-items-container ${emails.length > 0 ? 'visible' : 'hidden'}`}>
                       {emails.map((email, i) => {
                         const isRemoved = removedIds.has(email.id);
                         return (
                           <a
                             key={email.id}
                             className={`email-item ${email.is_unread ? 'unread' : ''} ${isRemoved ? 'removed' : ''}`}
                             href={`/email/${email.id}`}
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
                       })}
                     </div>
                   </>
                  )}
                </div>
              </div>

              {/* Terminal UI */}
              <div className="db-card terminal-card" style={{ gridColumn: '2 / 3', background: 'rgba(28, 28, 30, 0.95)', backdropFilter: 'blur(10px)', color: '#10b981', fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '500px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                {/* Mac OS Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2d2d2d', padding: '10px 16px', borderBottom: '1px solid #1a1a1a', position: 'relative' }}>
                  <div style={{ display: 'flex', gap: '8px', position: 'absolute', left: '16px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56' }} />
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e' }} />
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27c93f' }} />
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#a1a1aa' }}>bash - admin@unsub</div>
                </div>
                {/* Terminal Body */}
                <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                  {terminalLogs.length === 0 ? (
                    <div style={{ color: '#52525b', fontStyle: 'italic', marginTop: '4px' }}>No data this session...</div>
                  ) : (
                    terminalLogs.map(log => (
                      <div key={log.id} style={{ color: log.color, lineHeight: 1.5 }}>
                        <span style={{ color: '#6b7280', marginRight: '8px' }}>[{log.time}]</span>
                        {log.text}
                      </div>
                    ))
                  )}
                  <div ref={terminalEndRef} />
                </div>
              </div>

             </div>

          </main>
        </div>
      </div>

      {/* Settings Button & Overlay */}
      <button className="db-settings-btn" onClick={() => setIsSettingsOpen(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
      </button>

      <div className={`db-overlay ${isSettingsOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setIsSettingsOpen(false); }}>
        <div className="db-overlay-card">
          <button className="db-overlay-close" onClick={() => setIsSettingsOpen(false)}>✕</button>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '20px', color: '#1a1a1a' }}>Settings</div>
          
          <div className="db-theme-picker">
            {['yellow', 'red', 'green', 'blue', 'violet'].map(t => (
              <button
                key={t}
                className={`db-theme-btn ${theme === t ? 'active' : ''}`}
                style={{ background: THEMES[t].primary }}
                onClick={() => { setTheme(t); localStorage.setItem('unsub_theme', t); }}
                title={t}
              />
            ))}
          </div>
          
          <a href="/logout" className="db-overlay-signout">Sign Out</a>
        </div>
      </div>


      <div className={`db-overlay ${showLiveView ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setShowLiveView(false); }}>
        <div className="db-overlay-card" style={{ maxWidth: '900px', width: '90%', padding: '24px' }}>
          <button className="db-overlay-close" onClick={() => setShowLiveView(false)}>✕</button>
          
          <div style={{ width: '100%', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a1a' }}>
              Live Browser Feed
              <div style={{ fontSize: '0.85rem', color: '#888', fontWeight: 500, marginTop: '4px' }}>Watching background unsubscribe process...</div>
            </div>
            <div className="status-dot" style={{ background: '#ef4444', boxShadow: '0 0 10px #ef4444' }}></div>
          </div>
          
          <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: '12px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', color: '#666', zIndex: 0, fontWeight: 600 }}>
              Waiting for active unsubscribe session...
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="http://localhost:5000/api/stream-browser" 
              alt="Live Browser Stream" 
              style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'relative', zIndex: 1 }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.opacity = '0';
              }}
              onLoad={(e) => {
                (e.target as HTMLImageElement).style.opacity = '1';
              }}
            />
          </div>
        </div>
      </div>

    </>
  );
}
