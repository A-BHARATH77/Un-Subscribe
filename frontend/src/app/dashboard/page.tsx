'use client';

import { useEffect, useState, useRef, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Lenis from 'lenis';
import Lottie from 'lottie-react';

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

function hexToRgba(hex: string, alpha: number) {
  if (!hex || !hex.startsWith('#')) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ─────────────────────────────────────────────────────────────────
   Inner component — uses useSearchParams (needs Suspense wrapper)
───────────────────────────────────────────────────────────────── */
function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [info, setInfo] = useState<UserInfo | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [globalLogs, setGlobalLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState('yellow');
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [chartFilter, setChartFilter] = useState<'hourly'|'day'|'week'|'month'>('day');
  const [hoveredPoint, setHoveredPoint] = useState<{x: number, y: number, display: string, count: number} | null>(null);
  const [hoveredBar, setHoveredBar] = useState<{result: string, count: number, x: number, y: number, w: number} | null>(null);
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);

  // Chat state
  interface ChatMsg { id: string; from: 'hero' | 'user'; text: string; }
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const emailRef = useRef<string>('');

  const [isPhoneOpen, setIsPhoneOpen] = useState(false);
  const [hasNewChat, setHasNewChat] = useState(false);
  const prevMsgsLength = useRef(0);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (isInitialLoad.current && chatMsgs.length > 0) {
      isInitialLoad.current = false;
      prevMsgsLength.current = chatMsgs.length;
      return;
    }
    if (chatMsgs.length > prevMsgsLength.current) {
      if (!isPhoneOpen) {
        setHasNewChat(true);
      }
    }
    prevMsgsLength.current = chatMsgs.length;
  }, [chatMsgs, isPhoneOpen]);

  useEffect(() => {
    if (isPhoneOpen) {
      setHasNewChat(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isPhoneOpen]);

  function logToHeroMsg(log: LogRow): ChatMsg {
    const org = log.organization_name || 'that sender';
    const r = (log.result || '').toLowerCase();
    let text = '';
    if (r === 'success') {
      text = `Hey! Just received your mail — I've successfully unsubscribed you from ${org}. You're all set! ✅`;
    } else if (r.includes('review') || r === 'needs_review') {
      text = `Hey! Just received your mail from ${org}. This one needs a manual review — I couldn't auto-unsubscribe. Please check it yourself. 🔍`;
    } else if (r === 'error') {
      text = `Hey! Got your mail from ${org}, but ran into an error while trying to unsubscribe. You may need to do it manually. ⚠️`;
    } else if (r === 'skipped') {
      text = `Hey! Received a mail from ${org}, but it didn't look like a subscription email — skipped it. ⏭️`;
    } else if (r === 'not_found') {
      text = `Hey! Just processed a mail from ${org}, but I couldn't find an unsubscribe link. You might need to check this one manually. 🧐`;
    } else {
      text = `Hey! Just processed a mail from ${org} (result: ${log.result}). Let me know if you need help!`;
    }
    return { id: log.created_at + org + '_hero', from: 'hero', text };
  }

  function logToUserReply(log: LogRow): ChatMsg {
    const org = log.organization_name || 'that sender';
    const r = (log.result || '').toLowerCase();
    let text = '';
    if (r === 'success') {
      text = `Great, thanks for handling ${org}! 🙌`;
    } else if (r.includes('review') || r === 'needs_review') {
      text = `Okay, I'll take a look at ${org} manually. Thanks for the heads up!`;
    } else if (r === 'error') {
      text = `Got it, I'll unsubscribe from ${org} myself. Thanks anyway!`;
    } else if (r === 'skipped') {
      text = `No worries, that one from ${org} can be ignored then.`;
    } else if (r === 'not_found') {
      text = `Ah got it, I'll review ${org} manually. Thanks for letting me know!`;
    } else {
      text = `Okay, noted. Thanks!`;
    }
    return { id: log.created_at + org + '_user', from: 'user', text };
  }

  // Shows hero typing → hero message → instant user reply
  // If isFirst is true (seeding), skip delays and just show messages instantly
  async function addNewChatMsg(log: LogRow, instant = false) {
    if (instant) {
      setChatMsgs(prev => [...prev, logToHeroMsg(log), logToUserReply(log)]);
      return;
    }
    // Hero typing for 5s then message
    setIsTyping(true);
    await new Promise(res => setTimeout(res, 5000));
    setIsTyping(false);
    setChatMsgs(prev => [...prev, logToHeroMsg(log)]);
    // Instant user reply (slight delay for realism)
    await new Promise(res => setTimeout(res, 1200));
    setChatMsgs(prev => [...prev, logToUserReply(log)]);
  }

  useEffect(() => {
    const saved = localStorage.getItem('unsub_theme');
    if (saved) setTheme(saved);
  }, []);

  const changeTheme = (t: string) => {
    setTheme(t);
    localStorage.setItem('unsub_theme', t);
  };

  const THEMES: Record<string, any> = {
    yellow: {
      bg1: '#fefce8', bg2: '#fde68a', bg3: '#fef9c3',
      l1: '#fffdf5', l2: '#fffbeb', l3: '#fef3c7', l4: '#fde68a', l5: '#fbbf24',
      bl1: 'rgba(254,252,232,0.3)', bl2: 'rgba(253,230,138,0.45)',
      primary: '#fbbf24', primarySub: '#f59e0b', primaryDark: '#d97706',
      primaryLight: 'rgba(251,191,36,0.18)', primaryHover: 'rgba(251,191,36,0.05)'
    },
    red: {
      bg1: '#fef2f2', bg2: '#fca5a5', bg3: '#fee2e2',
      l1: '#fffafa', l2: '#fef2f2', l3: '#fecaca', l4: '#fca5a5', l5: '#f87171',
      bl1: 'rgba(254,242,242,0.3)', bl2: 'rgba(252,165,165,0.45)',
      primary: '#f87171', primarySub: '#ef4444', primaryDark: '#dc2626',
      primaryLight: 'rgba(248,113,113,0.18)', primaryHover: 'rgba(248,113,113,0.05)'
    },
    green: {
      bg1: '#f0fdf4', bg2: '#86efac', bg3: '#dcfce7',
      l1: '#f7fcf8', l2: '#f0fdf4', l3: '#bbf7d0', l4: '#86efac', l5: '#4ade80',
      bl1: 'rgba(240,253,244,0.3)', bl2: 'rgba(134,239,172,0.45)',
      primary: '#4ade80', primarySub: '#22c55e', primaryDark: '#16a34a',
      primaryLight: 'rgba(74,222,128,0.18)', primaryHover: 'rgba(74,222,128,0.05)'
    },
    blue: {
      bg1: '#eff6ff', bg2: '#93c5fd', bg3: '#dbeafe',
      l1: '#f8faff', l2: '#eff6ff', l3: '#bfdbfe', l4: '#93c5fd', l5: '#60a5fa',
      bl1: 'rgba(239,246,255,0.3)', bl2: 'rgba(147,197,253,0.45)',
      primary: '#60a5fa', primarySub: '#3b82f6', primaryDark: '#2563eb',
      primaryLight: 'rgba(96,165,250,0.18)', primaryHover: 'rgba(96,165,250,0.05)'
    },
    violet: {
      bg1: '#f5f3ff', bg2: '#c4b5fd', bg3: '#ede9fe',
      l1: '#fcfbfe', l2: '#f5f3ff', l3: '#ddd6fe', l4: '#c4b5fd', l5: '#a78bfa',
      bl1: 'rgba(245,243,255,0.3)', bl2: 'rgba(196,181,253,0.45)',
      primary: '#a78bfa', primarySub: '#8b5cf6', primaryDark: '#7c3aed',
      primaryLight: 'rgba(167,139,250,0.18)', primaryHover: 'rgba(167,139,250,0.05)'
    }
  };
  const activeTheme = THEMES[theme] || THEMES.yellow;

  useEffect(() => {
    const urlEmail = searchParams.get('_e');
    if (urlEmail) {
      sessionStorage.setItem('unsub_user', urlEmail);
      window.history.replaceState({}, '', '/dashboard');
    }

    const email = urlEmail || sessionStorage.getItem('unsub_user') || '';
    if (!email) { router.push('/sign-in'); return; }
    emailRef.current = email;

    const qs = `?email=${encodeURIComponent(email)}`;

    fetch(`/api/user/info${qs}`)
      .then(r => r.json())
      .then((data: UserInfo & { error?: string }) => {
        if (data.error) { router.push('/sign-in'); return; }
        setInfo(data);
      })
      .catch(() => router.push('/sign-in'));

    // Initial load: fetch logs, seed last 3 as chat history, set up polling
    const fetchLogs = async (isFirst = false) => {
      try {
        const [r, globalR] = await Promise.all([
          fetch(`/api/user/logs${qs}`),
          fetch(`/api/admin/logs`)
        ]);
        const data: LogRow[] | { error: string } = await r.json();
        const globalData: LogRow[] | { error: string } = await globalR.json();
        if (Array.isArray(globalData)) {
          setGlobalLogs(globalData);
        }

        if (!Array.isArray(data)) {
          if (isFirst) { setLogsError((data as { error: string }).error); setLogsLoading(false); }
          return;
        }
        setLogs(data);
        if (isFirst) {
          setLogsLoading(false);
          // Seed last 3 entries instantly as chat history (oldest → newest)
          const seed = [...data].reverse().slice(-3);
          // Mark ALL fetched logs as known so we don't accidentally print older logs during polling
          data.forEach(log => {
            const id = log.created_at + (log.organization_name || '');
            knownIdsRef.current.add(id);
          });
          // Use instant mode: no typing delay, just seed the messages
          const seedMsgs: ChatMsg[] = [];
          seed.forEach(log => {
            seedMsgs.push(logToHeroMsg(log));
            seedMsgs.push(logToUserReply(log));
          });
          setChatMsgs(seedMsgs);
        } else {
          // Polling: find new entries not yet known
          const newEntries: LogRow[] = [];
          for (const log of data) {
            const id = log.created_at + (log.organization_name || '');
            if (!knownIdsRef.current.has(id)) {
              knownIdsRef.current.add(id);
              newEntries.push(log);
            }
          }
          if (newEntries.length > 0) {
            setLogs(data); // Update logs state to automatically reload charts and dashboard stats
          }
          // Show new messages one by one — each one waits for the previous
          // hero msg + user reply + 1 min gap before the next hero starts typing
          const entriesReversed = [...newEntries].reverse();
          for (let i = 0; i < entriesReversed.length; i++) {
            await addNewChatMsg(entriesReversed[i]); // includes 5s typing + msg + instant user reply
            if (i < entriesReversed.length - 1) {
              await new Promise(res => setTimeout(res, 60_000)); // wait 1 min between different emails
            }
          }
        }
      } catch (e) {
        if (isFirst) { setLogsError(String(e)); setLogsLoading(false); }
      }
    };

    const fetchUnread = async () => {
      try {
        const r = await fetch('/api/unread-ids');
        const data = await r.json();
        if (data && data.ids) setUnreadCount(data.ids.length);
      } catch (e) {}
    };

    fetchLogs(true);
    fetchUnread();
    const interval = setInterval(() => {
      fetchLogs(false);
      fetchUnread();
    }, 60_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottom whenever chat messages or typing state changes
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMsgs, isTyping]);

  const successCount = logs.filter(l => l.result === 'success').length;
  const errorCount   = logs.filter(l => l.result === 'error').length;
  const skippedCount = logs.filter(l => l.result === 'skipped').length;
  const displayName  = info?.name || info?.email?.split('@')[0] || 'User';
  const initials     = displayName.slice(0, 2).toUpperCase();

  // Calculate time required (4 mins per unread email)
  const totalMinutesSaved = unreadCount * 4;
  const hoursSaved = Math.floor(totalMinutesSaved / 60);
  const minutesSaved = totalMinutesSaved % 60;
  const hh = String(hoursSaved).padStart(2, '0');
  const mm = String(minutesSaved).padStart(2, '0');
  const unsubStr = String(unreadCount).padStart(2, '0');

  const streaksByDay: Record<string, number> = {};
  logs.forEach(l => {
    if (l.created_at) {
      const day = l.created_at.split('T')[0];
      streaksByDay[day] = (streaksByDay[day] || 0) + 1;
    }
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const streakCount = streaksByDay[todayStr] || 0;
  
  const historicalMax = Math.max(0, ...Object.values(streaksByDay));
  const maxStreak = Math.max(historicalMax, 10); // Baseline of 10 to avoid needle jumping on day 1
  const clampedStreak = Math.min(streakCount, maxStreak);
  const needleAngle = -90 + (clampedStreak / maxStreak) * 180;
  
  const arcLength = 83.7758;
  const getFill = (min: number, max: number) => {
    if (needleAngle <= min) return 0;
    if (needleAngle >= max) return arcLength;
    return ((needleAngle - min) / (max - min)) * arcLength;
  };
  const lowFill = getFill(-90, -30);
  const medFill = getFill(-30, 30);
  const highFill = getFill(30, 90);

  // Chart Data Preparation
  const chartData: { date: string, display: string, count: number }[] = [];
  
  if (chartFilter === 'hourly') {
    const countsByHour: Record<string, number> = {};
    logs.forEach(l => {
      if (l.created_at) {
        const hourKey = l.created_at.substring(0, 13);
        countsByHour[hourKey] = (countsByHour[hourKey] || 0) + 1;
      }
    });
    for (let i = 23; i >= 0; i--) {
      const d = new Date();
      d.setHours(d.getHours() - i);
      const hourKey = d.toISOString().substring(0, 13);
      const displayStr = d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
      chartData.push({ date: hourKey, display: displayStr, count: countsByHour[hourKey] || 0 });
    }
  } else if (chartFilter === 'day') {
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const displayStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      chartData.push({ date: dateStr, display: displayStr, count: streaksByDay[dateStr] || 0 });
    }
  } else if (chartFilter === 'week') {
    for (let i = 11; i >= 0; i--) {
      const dEnd = new Date();
      dEnd.setDate(dEnd.getDate() - (i * 7));
      const dStart = new Date(dEnd);
      dStart.setDate(dStart.getDate() - 6);
      
      let count = 0;
      for (let j = 0; j < 7; j++) {
        const d = new Date(dStart);
        d.setDate(d.getDate() + j);
        const dateStr = d.toISOString().split('T')[0];
        count += streaksByDay[dateStr] || 0;
      }
      const displayStr = dStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' - ' + dEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      chartData.push({ date: `week-${i}`, display: displayStr, count });
    }
  } else if (chartFilter === 'month') {
    const countsByMonth: Record<string, number> = {};
    logs.forEach(l => {
      if (l.created_at) {
        const monthKey = l.created_at.substring(0, 7);
        countsByMonth[monthKey] = (countsByMonth[monthKey] || 0) + 1;
      }
    });
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = d.toISOString().substring(0, 7);
      const displayStr = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      chartData.push({ date: monthKey, display: displayStr, count: countsByMonth[monthKey] || 0 });
    }
  }
  const chartWidth = 800;
  const chartHeight = 350;
  const paddingX = 40;
  const paddingY = 40;
  const chartMaxCount = Math.max(5, ...chartData.map(d => d.count));

  const chartPoints = chartData.map((d, i) => {
    const x = paddingX + (i * (chartWidth - 2 * paddingX) / (chartData.length - 1));
    const y = chartHeight - paddingY - (d.count / chartMaxCount) * (chartHeight - 2 * paddingY);
    return { x, y, display: d.display, count: d.count };
  });
  const pointsStr = chartPoints.map(p => `${p.x},${p.y}`).join(' ');
  const areaPoints = `${paddingX},${chartHeight - paddingY} ${pointsStr} ${chartWidth - paddingX},${chartHeight - paddingY}`;

  // Bar Chart Data Preparation
  const resultsCount: Record<string, number> = {};
  logs.forEach(l => {
    const r = (l.result || 'unknown').toUpperCase();
    resultsCount[r] = (resultsCount[r] || 0) + 1;
  });
  const barChartData = Object.keys(resultsCount).map(key => ({
    result: key,
    count: resultsCount[key]
  })).sort((a, b) => b.count - a.count);
  
  const barMaxCount = Math.max(5, ...barChartData.map(d => d.count));
  const barWidth = barChartData.length ? ((chartWidth - 2 * paddingX) / barChartData.length) * 0.2 : 0;
  const barSpacing = barChartData.length ? (chartWidth - 2 * paddingX) / barChartData.length : 0;

  // Bubble Data Preparation
  const orgCounts: Record<string, number> = {};
  logs.forEach(l => {
    const org = l.organization_name || 'Unknown';
    orgCounts[org] = (orgCounts[org] || 0) + 1;
  });
  const bubbleData = Object.keys(orgCounts).map(org => ({ org, count: orgCounts[org] })).sort((a, b) => b.count - a.count);
  const bubbleMaxCount = bubbleData.length > 0 ? bubbleData[0].count : 1;

  // 3D Pie Chart Data
  const topPieBubbles = bubbleData;
  const totalPieCount = topPieBubbles.reduce((acc, curr) => acc + curr.count, 0);
  let currentPieAngle = 0;
  const pieColors = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#eab308', '#f43f5e', '#84cc16', '#14b8a6', '#6366f1'];
  const pieSlices = topPieBubbles.map((b, idx) => {
    const sliceAngle = (b.count / totalPieCount) * 2 * Math.PI;
    const startAngle = currentPieAngle;
    const endAngle = currentPieAngle + sliceAngle;
    currentPieAngle = endAngle;

    const radius = 160;
    const adjustedStart = startAngle - Math.PI / 2;
    const adjustedEnd = endAngle - Math.PI / 2;
    const startX = Math.cos(adjustedStart) * radius;
    const startY = Math.sin(adjustedStart) * radius;
    const endX = Math.cos(adjustedEnd) * radius;
    const endY = Math.sin(adjustedEnd) * radius;
    const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
    
    const pathData = topPieBubbles.length === 1 
      ? `M -${radius} 0 A ${radius} ${radius} 0 1 1 ${radius} 0 A ${radius} ${radius} 0 1 1 -${radius} 0`
      : `M 0 0 L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;

    const midAngle = adjustedStart + sliceAngle / 2;
    const labelRadius = 220; 
    const labelX = Math.cos(midAngle) * labelRadius;
    const labelY = Math.sin(midAngle) * labelRadius;

    const isHovered = hoveredSlice === idx;
    const pullOutDistance = isHovered ? 20 : 0;
    const pullOutX = Math.cos(midAngle) * pullOutDistance;
    const pullOutY = Math.sin(midAngle) * pullOutDistance;
    const percentage = Math.round((b.count / totalPieCount) * 100);

    return { ...b, pathData, color: pieColors[idx % pieColors.length], labelX, labelY, pullOutX, pullOutY, isHovered, percentage };
  });

  const contributionData = useMemo(() => {
    if (!logs.length) return [];
    const globalCounts: Record<string, number> = {};
    if (globalLogs.length > 0) {
      globalLogs.forEach(l => {
        const org = l.organization_name || 'Unknown';
        globalCounts[org] = (globalCounts[org] || 0) + 1;
      });
    }
    return bubbleData.slice(0, 5).map(b => {
      const globalCount = globalCounts[b.org] || b.count;
      const percentage = Math.round((b.count / globalCount) * 100);
      return { org: b.org, count: b.count, globalCount, percentage };
    });
  }, [logs, globalLogs, bubbleData]);

  // Smooth Scroll
  useEffect(() => {
    const lenis = new Lenis({
      autoRaf: true,
      duration: 1.2,
    });
    
    const ro = new ResizeObserver(() => {
      lenis.resize();
    });
    ro.observe(document.body);

    return () => {
      ro.disconnect();
      lenis.destroy();
    };
  }, []);

  const [showLoader, setShowLoader] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);
  const lottieContainerRef = useRef<HTMLDivElement>(null);
  const [lottieData, setLottieData] = useState<any>(null);
  const [fireData, setFireData] = useState<any>(null);
  const [clockData, setClockData] = useState<any>(null);
  const [searchData, setSearchData] = useState<any>(null);
  const [checkMarkData, setCheckMarkData] = useState<any>(null);
  const [chatBotData, setChatBotData] = useState<any>(null);

  // Fetch Lottie JSON
  useEffect(() => {
    fetch('/loader.json').then(r => r.json()).then(setLottieData).catch(console.error);
    fetch('/Grey%20Fire.json').then(r => r.json()).then(setFireData).catch(console.error);
    fetch('/Clock%20analog%2024%20hours%20outline.json').then(r => r.json()).then(setClockData).catch(console.error);
    fetch('/Search.json').then(r => r.json()).then(setSearchData).catch(console.error);
    fetch('/TmL7dOCqfG.json').then(r => r.json()).then(setCheckMarkData).catch(console.error);
    fetch('/Chat%20bot%20animation.json').then(r => r.json()).then(setChatBotData).catch(console.error);
  }, []);

  // GSAP Loader Animation
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).gsap) return;
    const gsap = (window as any).gsap;
    
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.to(loaderRef.current, {
          opacity: 0,
          duration: 0.8,
          ease: "power2.inOut",
          onComplete: () => setShowLoader(false)
        });
      }
    });

    tl.fromTo(lottieContainerRef.current,
      { x: '-100vw', opacity: 1 },
      { x: 0, duration: 1.2, ease: "back.out(1.2)" }
    )
    .to(lottieContainerRef.current, {
      x: '100vw',
      duration: 1.2,
      ease: "power2.in",
      delay: 5
    });
  }, []);

  return (
    <>
      {showLoader && (
        <div
          ref={loaderRef}
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
          <div ref={lottieContainerRef} style={{ width: '400px', height: '400px' }}>
            {lottieData && <Lottie animationData={lottieData} loop={true} autoplay={true} />}
          </div>
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: auto !important; min-height: 100% !important; overflow-x: hidden !important; font-family: 'Plus Jakarta Sans', sans-serif; }

        /* ── Dynamic Theme Variables ── */
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

          min-height: 100vh;
          background:
            radial-gradient(ellipse 80% 55% at 90% 0%,   var(--bg2) 0%, transparent 55%),
            radial-gradient(ellipse 60% 65% at 100% 0%,  var(--bg1) 0%, transparent 50%),
            radial-gradient(ellipse 70% 50% at 5%  95%,  var(--bg3) 0%, transparent 60%),
            linear-gradient(155deg, var(--l1) 0%, var(--l2) 25%, var(--l3) 55%, var(--l4) 80%, var(--l5) 100%);
          position: relative;
        }

        /* Warm ambient blooms */
        .db-bloom { position: fixed; pointer-events: none; z-index: 0; border-radius: 50%; }
        .db-bloom-1 {
          width: 900px; height: 700px;
          top: -200px; right: -180px;
          background: radial-gradient(ellipse, rgba(255,255,255,0.8) 0%, var(--bl1) 40%, transparent 70%);
          filter: blur(50px);
        }
        .db-bloom-2 {
          width: 600px; height: 500px;
          bottom: -120px; left: -80px;
          background: radial-gradient(ellipse, var(--bl2) 0%, var(--bg3) 50%, transparent 75%);
          filter: blur(60px);
          animation: blobDrift 18s ease-in-out infinite reverse;
        }
        .db-bloom-3 {
          width: 350px; height: 350px;
          top: 40%; left: 30%;
          background: radial-gradient(ellipse, var(--primary-light) 0%, transparent 70%);
          filter: blur(80px);
          animation: blobDrift 22s ease-in-out infinite;
        }
        @keyframes blobDrift {
          0%,100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-24px) scale(1.04); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.85); }
        }

        /* ── Layout ── */
        .db-layout {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }

        /* ── Top Nav ── */
        .db-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 40px;
          background: rgba(255,255,255,0.45);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          border-bottom: 1px solid rgba(255,255,255,0.6);
          box-shadow: 0 4px 24px rgba(0,0,0,0.04);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .db-nav-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1.05rem;
          font-weight: 800;
          color: #1a1a1a;
          letter-spacing: -0.03em;
        }
        .db-logo-icon {
          width: 34px; height: 34px;
          background: #1a1a1a;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .db-logo-icon svg { width: 16px; height: 16px; }

        .db-nav-links {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .db-nav-link {
          padding: 7px 16px;
          border-radius: 99px;
          font-size: 0.82rem;
          font-weight: 500;
          color: #666;
          text-decoration: none;
          transition: all 0.18s;
        }
        .db-nav-link:hover { background: rgba(0,0,0,0.05); color: #111; }
        .db-nav-link.active {
          background: #1a1a1a;
          color: #fff;
          font-weight: 600;
        }

        .db-nav-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .db-user-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 5px 12px 5px 5px;
          background: #fff;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 99px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .db-user-avatar {
          width: 26px; height: 26px;
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.65rem; font-weight: 800; color: var(--primary-text);
        }
        .db-user-email {
          font-size: 0.78rem;
          font-weight: 500;
          color: #444;
          max-width: 160px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .db-btn-signout {
          padding: 7px 14px;
          background: #fff;
          border: 1px solid rgba(0,0,0,0.1);
          border-radius: 10px;
          font-size: 0.78rem;
          font-weight: 600;
          color: #555;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.18s;
        }
        .db-btn-signout:hover {
          background: rgba(239,68,68,0.07);
          border-color: rgba(239,68,68,0.25);
          color: #dc2626;
        }

        /* ── Main body ── */
        .db-body {
          flex: 1;
          padding: 36px 40px 60px;
          max-width: 1440px;
          margin: 0 auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* ── Welcome header ── */
        .db-welcome h1 {
          font-size: 2.6rem;
          font-weight: 500;
          color: #1a1a1a;
          letter-spacing: -0.05em;
          line-height: 1.1;
          margin-left: -4px;
        }
        .db-welcome p {
          font-size: 0.88rem;
          color: #888;
          margin-top: 5px;
          font-weight: 400;
        }

        /* ── Grid layout for cards ── */
        .db-grid {
          display: grid;
          grid-template-columns: minmax(0, 360px) minmax(0, 360px);
          justify-content: center;
          gap: 20px;
        }

        .db-charts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          width: 100%;
        }

        /* ── Glassmorphism Card base ── */
        .db-card {
          background: rgba(255,255,255,0.55);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          border: 1px solid rgba(255,255,255,0.8);
          border-radius: 22px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9);
          overflow: hidden;
          transition: transform 0.25s, box-shadow 0.25s, background 0.25s;
        }
        .db-card:hover {
          transform: translateY(-3px);
          background: rgba(255,255,255,0.68);
          box-shadow: 0 10px 40px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.95);
        }

        /* ── Time Saved card (col 1, row 1) ── */
        .db-clock-card {
          grid-column: 1;
          grid-row: 1;
          padding: 28px 24px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          gap: 10px;
          text-align: left;
          position: relative;
        }
        .db-unread-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 14px;
          background: var(--primary-light);
          border: 1.5px solid var(--primary);
          border-radius: 99px;
          font-size: 0.78rem;
          font-weight: 700;
          color: #333;
          margin-bottom: 4px;
        }
        .db-unread-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: var(--primary-dark);
          animation: pulseDot 2s ease-in-out infinite;
        }
        .db-clock-title {
          font-size: 1.1rem;
          font-weight: 500;
          color: #1a1a1a;
          letter-spacing: 0;
        }
        .db-clock-display {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
        }
        .db-flip-box {
          position: relative;
          width: 100px;
          height: 84px;
          background: #111;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        /* Flip clock horizontal split line */
        .db-flip-box::after {
          content: "";
          position: absolute;
          top: 50%;
          left: 0;
          width: 100%;
          height: 1.5px;
          background: rgba(255,255,255,0.08);
          transform: translateY(-50%);
          z-index: 2;
        }
        .db-flip-label {
          position: absolute;
          top: 7px;
          left: 10px;
          font-family: 'Inter', sans-serif;
          font-size: 0.55rem;
          font-weight: 800;
          color: #666;
          letter-spacing: 0.07em;
          z-index: 3;
        }
        .db-clock-digit {
          font-family: 'Inter', sans-serif;
          font-size: 3rem;
          font-weight: 700;
          color: #fff;
          line-height: 1;
          letter-spacing: -0.04em;
          z-index: 1;
        }
        .db-clock-subtitle {
          font-size: 0.72rem;
          color: #aaa;
          line-height: 1.5;
          padding: 0 8px;
          font-weight: 400;
        }

        /* ── Activity / Progress card (col 2, row 1) ── */
        .db-activity-card {
          grid-column: 2;
          grid-row: 1;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          position: relative;
        }
        .db-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .db-card-title {
          font-size: 0.9rem;
          font-weight: 700;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .db-card-arrow {
          width: 28px; height: 28px;
          border-radius: 8px;
          background: rgba(0,0,0,0.04);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background 0.15s;
        }
        .db-card-arrow:hover { background: rgba(0,0,0,0.08); }
        .db-activity-big-num {
          font-size: 2.8rem;
          font-weight: 900;
          color: #111;
          letter-spacing: -0.05em;
          line-height: 1;
        }
        .db-activity-big-sub {
          font-size: 0.78rem;
          color: #aaa;
          margin-left: 4px;
          font-weight: 400;
        }

        /* Speedometer */
        .db-speedometer-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          padding-top: 12px;
        }
        .db-speedometer-svg {
          width: 100%;
          max-width: 220px;
          overflow: visible;
        }
        .db-speedometer-label {
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .db-speedometer-text {
          font-size: 0.7rem;
          color: #bbb;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        /* ── Time / Quick Stats card (col 3, row 1) ── */
        .db-quick-card {
          grid-column: 3;
          grid-row: 1;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .db-timer-display {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          gap: 6px;
        }
        .db-timer-ring {
          width: 96px; height: 96px;
          border-radius: 50%;
          border: 7px solid rgba(255,255,255,0.35);
          border-top-color: var(--primary-dark);
          box-shadow: 0 0 0 1px rgba(0,0,0,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: ringRotate 4s linear infinite;
          position: relative;
        }
        @keyframes ringRotate { to { transform: rotate(360deg); } }
        .db-timer-inner {
          animation: ringRotate 4s linear infinite reverse;
          font-size: 1.3rem;
          font-weight: 800;
          color: #111;
          letter-spacing: -0.04em;
        }
        .db-timer-sub {
          font-size: 0.7rem;
          color: #bbb;
          font-weight: 500;
        }

        /* ── Full Screen Chat Overlay ── */
        .db-phone-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(0, 0, 0, 0.18);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: flex-end;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.35s;
        }
        .db-phone-overlay.open {
          opacity: 1;
          pointer-events: auto;
        }
        .db-phone-toggle-btn {
          position: fixed;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          z-index: 110;
          background: var(--primary);
          color: var(--primary-text);
          border: none;
          border-radius: 10px 0 0 10px;
          padding: 14px 10px;
          cursor: pointer;
          box-shadow: -3px 0 16px rgba(0,0,0,0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .db-phone-toggle-btn.open {
          transform: translateY(-50%) translateX(100%);
          opacity: 0;
          pointer-events: none;
        }
        .db-phone-badge {
          position: absolute;
          top: -4px;
          left: -4px;
          width: 11px;
          height: 11px;
          background: #ef4444;
          border-radius: 50%;
          border: 2px solid #fff;
        }
        
        /* ── Chat Container ── */
        .db-phone-mockup {
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(0,0,0,0.07);
          border-right: none;
          box-shadow: -8px 0 40px rgba(0,0,0,0.08);
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 460px;
          height: 94vh;
          border-radius: 20px 0 0 20px;
          position: relative;
          opacity: 0;
          transform: translateX(40px);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .db-phone-overlay.open .db-phone-mockup {
          opacity: 1;
          transform: translateX(0);
        }
        .db-phone-header {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          z-index: 10;
          background: rgba(255,255,255,0.9);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          padding: 20px 20px 14px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 20px 0 0 0;
        }
        .db-phone-close-btn {
          background: rgba(0,0,0,0.05);
          border: none;
          border-radius: 50%;
          width: 30px; height: 30px;
          cursor: pointer;
          color: #555;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }
        .db-phone-close-btn:hover { background: rgba(0,0,0,0.1); }
        .db-phone-avatar {
          width: 32px; height: 32px;
          border-radius: 50%;
          background: var(--primary);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.75rem; color: var(--primary-text); font-weight: 800;
        }
        .db-phone-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: #1a1a1a;
          line-height: 1.1;
        }
        .db-phone-status {
          font-size: 0.65rem;
          color: #10b981;
          font-weight: 500;
        }
        .db-phone-body {
          flex: 1;
          padding: 80px 16px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
          scrollbar-width: none;
        }
        .db-phone-body::-webkit-scrollbar { display: none; }
        .db-msg {
          max-width: 82%;
          padding: 10px 14px;
          border-radius: 16px;
          font-size: 0.8rem;
          line-height: 1.4;
        }
        .db-msg-in {
          align-self: flex-start;
          background: #fff;
          color: #333;
          border-bottom-left-radius: 4px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          border: 1px solid rgba(0,0,0,0.05);
        }
        .db-msg-out {
          align-self: flex-end;
          background: var(--primary);
          color: var(--primary-text);
          border-bottom-right-radius: 4px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        /* ── Phone loading overlay ── */
        .db-phone-loader {
          position: absolute;
          inset: 0;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 20px;
          transition: opacity 0.7s ease, visibility 0.7s ease;
        }
        .db-phone-loader.hidden {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }
        .db-phone-loader-ring {
          width: 40px; height: 40px;
          border-radius: 50%;
          border: 3px solid rgba(0,0,0,0.06);
          border-top-color: var(--primary);
          animation: dbSpin 0.8s linear infinite;
        }
        .db-phone-loader-pulse {
          width: 72px; height: 6px;
          border-radius: 99px;
          background: linear-gradient(90deg, var(--primary-light), var(--primary), var(--primary-light));
          background-size: 200% 100%;
          animation: shimmerPulse 1.4s ease-in-out infinite;
        }
        @keyframes shimmerPulse {
          0%   { background-position: -100% 0; }
          100% { background-position: 200% 0; }
        }
        .db-phone-loader-text {
          font-size: 0.72rem;
          font-weight: 600;
          color: #bbb;
          letter-spacing: 0.04em;
        }
        .db-typing {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 10px 14px;
        }
        .db-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #ccc;
          display: inline-block;
          animation: dotBounce 1.2s ease-in-out infinite;
        }
        .db-dot:nth-child(2) { animation-delay: 0.2s; }
        .db-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40%            { transform: translateY(-5px); opacity: 1; }
        }
        .db-phone-footer {
          padding: 12px 16px;
          border-top: 1px solid rgba(0,0,0,0.05);
        }
        .db-phone-input {
          height: 38px;
          border-radius: 99px;
          background: rgba(0,0,0,0.04);
          border: 1px solid rgba(0,0,0,0.06);
          display: flex;
          align-items: center;
          padding: 0 16px;
          font-size: 0.75rem;
          color: #bbb;
        }

        /* ── 3D Pie Chart Container ── */
        .db-pie-container {
          position: relative;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 0;
          perspective: 1600px;
        }

        /* ── Activity Chart ── */
        .db-chart-card {
          grid-column: span 1;
          display: flex;
          flex-direction: column;
        }
        .db-chart-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 22px 14px;
          border-bottom: 1px solid rgba(0,0,0,0.05);
        }
        .db-chart-title {
          font-size: 1.1rem;
          font-weight: 500;
          color: #1a1a1a;
        }
        .db-chart-filters {
          display: flex;
          gap: 2px;
          background: rgba(0,0,0,0.04);
          padding: 3px;
          border-radius: 99px;
        }
        .db-chart-filter-btn {
          background: transparent;
          border: none;
          padding: 4px 11px;
          font-size: 0.7rem;
          font-weight: 600;
          color: #888;
          border-radius: 99px;
          cursor: pointer;
          transition: all 0.18s;
        }
        .db-chart-filter-btn:hover { color: #333; }
        .db-chart-filter-btn.active {
          background: #fff;
          color: #111;
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }
        .db-chart-wrap { 
          padding: 16px 10px;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .db-chart-svg {
          width: 100%;
          height: auto;
          max-height: 280px;
          overflow: visible;
        }
        .chart-grid { stroke: #f4f4f4; stroke-dasharray: 4; stroke-width: 1; }
        .chart-line { fill: none; stroke: var(--primary-dark); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
        .chart-area { fill: url(#chartGradient); }
        .chart-point { fill: #fff; stroke: var(--primary-dark); stroke-width: 2; transition: r 0.2s; cursor: pointer; }
        .chart-point:hover { r: 6; }
        .chart-label { font-size: 11px; fill: #444; text-anchor: middle; font-weight: 600; }
        .chart-y-label { font-size: 11px; fill: #444; text-anchor: end; font-weight: 600; alignment-baseline: middle; }

        /* Result badges */
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 99px;
          font-size: 0.67rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .badge-success  { background: rgba(16,185,129,0.1);  border: 1px solid rgba(16,185,129,0.2);  color: #059669; }
        .badge-error    { background: rgba(239,68,68,0.08);  border: 1px solid rgba(239,68,68,0.18);  color: #dc2626; }
        .badge-skipped  { background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.25); color: #d97706; }
        .badge-notfound { background: rgba(107,114,128,0.08); border: 1px solid rgba(107,114,128,0.15); color: #6b7280; }
        .badge-default  { background: rgba(107,114,128,0.06); border: 1px solid rgba(107,114,128,0.12); color: #9ca3af; }

        /* States */
        .db-state-box { padding: 48px 24px; text-align: center; }
        .db-state-icon { font-size: 2.4rem; margin-bottom: 10px; }
        .db-state-msg { font-size: 0.88rem; font-weight: 600; color: #555; margin-bottom: 4px; }
        .db-state-sub { font-size: 0.78rem; color: #bbb; }
        .db-spin {
          width: 18px; height: 18px;
          border: 2px solid rgba(0,0,0,0.07);
          border-top-color: var(--primary-dark);
          border-radius: 50%;
          animation: dbSpin 0.7s linear infinite;
          display: inline-block;
          vertical-align: middle;
          margin-right: 6px;
        }
        @keyframes dbSpin { to { transform: rotate(360deg); } }
        
        /* ── Settings Button & Overlay ── */
        .db-settings-btn {
          position: fixed;
          bottom: 24px;
          left: 24px;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #fff;
          border: 1px solid rgba(0,0,0,0.09);
          box-shadow: 0 2px 12px rgba(0,0,0,0.07);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 1000;
          transition: all 0.2s;
        }
        .db-settings-btn:hover {
          background: #f7f7f7;
          transform: scale(1.05);
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .db-settings-btn svg { width: 20px; height: 20px; color: #444; }

        .db-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.3);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          opacity: 0; pointer-events: none;
          transition: opacity 0.2s;
        }
        .db-overlay.open {
          opacity: 1; pointer-events: auto;
        }
        .db-overlay-card {
          background: #fff;
          border-radius: 20px;
          padding: 32px 24px;
          width: 90%;
          max-width: 320px;
          box-shadow: 0 16px 60px rgba(0,0,0,0.12);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          transform: translateY(16px);
          transition: transform 0.2s;
          position: relative;
        }
        .db-overlay.open .db-overlay-card {
          transform: translateY(0);
        }
        .db-overlay-close {
          position: absolute;
          top: 14px;
          right: 14px;
          background: rgba(0,0,0,0.05);
          border: none;
          border-radius: 50%;
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          color: #888;
          transition: background 0.15s;
        }
        .db-overlay-close:hover { background: rgba(0,0,0,0.1); color: #111; }
        
        .db-theme-picker {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          margin: 4px 0 14px;
          width: 100%;
        }
        .db-theme-label {
          font-size: 0.7rem;
          font-weight: 700;
          color: #bbb;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .db-theme-options {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .db-theme-dot {
          width: 24px; height: 24px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .db-theme-dot:hover { transform: scale(1.18); }
        .db-theme-dot.active {
          transform: scale(1.18);
          box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--primary);
        }

        .db-overlay-avatar {
          width: 68px; height: 68px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          display: flex; align-items: center; justify-content: center;
          font-size: 1.6rem; font-weight: 800; color: var(--primary-text);
          margin-bottom: 6px;
        }
        .db-overlay-name {
          font-size: 1.1rem;
          font-weight: 800;
          color: #111;
          margin: 0;
        }
        .db-overlay-email {
          font-size: 0.82rem;
          color: #aaa;
          margin-bottom: 10px;
        }
        .db-overlay-signout {
          width: 100%;
          padding: 11px;
          background: rgba(239, 68, 68, 0.07);
          color: #dc2626;
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          text-align: center;
          text-decoration: none;
          transition: all 0.15s;
        }
        .db-overlay-signout:hover {
          background: rgba(239, 68, 68, 0.14);
        }

        /* ── Mobile Responsive ── */
        @media (max-width: 1000px) {
          .db-grid {
            grid-template-columns: 1fr;
            grid-template-rows: auto;
          }
          .db-right-panel {
            grid-column: 1;
            grid-row: auto;
          }
          .db-phone-mockup { height: 500px; }
          .db-body { padding: 24px 20px 40px; }
          .db-nav { padding: 14px 20px; }
        }
      `}</style>

      <div className="db-root">
        <div className="db-bloom db-bloom-1" />
        <div className="db-bloom db-bloom-2" />
        <div className="db-bloom db-bloom-3" />

        <div className="db-layout">

          {/* ── Top Nav ── */}
          <nav className="db-nav">
            <div className="db-nav-logo">
              <div className="db-logo-icon" style={{ background: 'transparent' }}>
                <img src="/email.svg" alt="UnSub" style={{ width: '100%', height: '100%' }} />
              </div>
              UnSub
            </div>
            {/* The Dashboard link and Right side user controls have been moved/removed as requested */}
          </nav>

          {/* ── Body ── */}
          <main className="db-body">

            {/* Welcome */}
            <div className="db-welcome">
              <h1>Welcome in, {displayName}</h1>
              <p>Here&apos;s your unsubscribe activity at a glance.</p>
            </div>

            {/* ── Card Grid ── */}
            <div className="db-grid">

              {/* Time Saved Clock Card */}
              <div className="db-card db-clock-card">
                <div style={{ position: 'absolute', top: '24px', right: '24px', width: '50px', height: '50px', filter: 'invert(0.8)' }}>
                  {clockData && <Lottie animationData={clockData} loop={true} autoplay={true} />}
                </div>
                <div className="db-unread-pill">
                  <span className="db-unread-dot" />
                  {unreadCount} Unread {unreadCount === 1 ? 'Email' : 'Emails'}
                </div>
                
                <div className="db-clock-title">Estimated Time</div>
                <div className="db-clock-display">
                  <div className="db-flip-box">
                    <span className="db-flip-label">HR</span>
                    <span className="db-clock-digit">{hh}</span>
                  </div>
                  <div className="db-flip-box">
                    <span className="db-flip-label">MIN</span>
                    <span className="db-clock-digit">{mm}</span>
                  </div>
                </div>
                <div className="db-clock-subtitle">Approx. time to manually unsubscribe (4m each)</div>
              </div>

              {/* Activity / Progress card */}
              <div className="db-card db-activity-card">
                <div style={{ position: 'absolute', top: '16px', right: '16px', width: '60px', height: '60px' }}>
                  {fireData && <Lottie animationData={fireData} loop={true} autoplay={true} />}
                </div>
                <div className="db-card-header">
                  <span className="db-card-title" style={{ fontSize: '1.1rem', fontWeight: 500, color: '#1a1a1a', textTransform: 'none' }}>Streak</span>
                </div>
                <div>
                  <span className="db-activity-big-num">{logsLoading ? '—' : streakCount}</span>
                  <span className="db-activity-big-sub">Unsubscribed today</span>
                </div>
                {/* Speedometer */}
                <div className="db-speedometer-container">
                  <svg viewBox="0 12 200 105" className="db-speedometer-svg">
                    {/* Background (Dull) */}
                    <path d="M 20 100 A 80 80 0 0 1 30.72 60" fill="none" stroke="#fca5a5" strokeWidth="16" />
                    <path d="M 30.72 60 A 80 80 0 0 1 169.28 60" fill="none" stroke="#fde047" strokeWidth="16" />
                    <path d="M 169.28 60 A 80 80 0 0 1 180 100" fill="none" stroke="#86efac" strokeWidth="16" />

                    {/* Foreground (Vibrant), dynamically drawn left of needle */}
                    <path d="M 20 100 A 80 80 0 0 1 30.72 60" fill="none" stroke="#ef4444" strokeWidth="16" strokeDasharray={`${lowFill} ${arcLength}`} />
                    <path d="M 30.72 60 A 80 80 0 0 1 169.28 60" fill="none" stroke="#eab308" strokeWidth="16" strokeDasharray={`${medFill} ${arcLength}`} />
                    <path d="M 169.28 60 A 80 80 0 0 1 180 100" fill="none" stroke="#22c55e" strokeWidth="16" strokeDasharray={`${highFill} ${arcLength}`} />
                    
                    <text x="25" y="115" fontSize="10" fill="#888" fontWeight="bold">LOW</text>
                    <text x="100" y="45" fontSize="10" fill="#888" fontWeight="bold" textAnchor="middle">MED</text>
                    <text x="175" y="115" fontSize="10" fill="#888" fontWeight="bold" textAnchor="end">HIGH</text>

                    {/* Needle */}
                    <g transform={`rotate(${needleAngle} 100 100)`} style={{ transition: 'transform 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                      <polygon points="96,100 104,100 100,25" fill="#1a1a1a" />
                      <circle cx="100" cy="100" r="8" fill="#1a1a1a" />
                      <circle cx="100" cy="100" r="3" fill="#fff" />
                    </g>
                  </svg>
                  <div className="db-speedometer-label">
                    <span className="db-speedometer-text">Today's Streak</span>
                  </div>
                </div>
              </div>



              {/* Right panel moved to overlay */}
            </div>

            <div className="db-charts-grid">
              {/* Full-width Line Chart */}
              <div className="db-card db-chart-card">
                <div className="db-chart-header">
                  <span className="db-chart-title">Mails Sent</span>
                  <div className="db-chart-filters">
                    {(['hourly', 'day', 'week', 'month'] as const).map(f => (
                      <button 
                        key={f}
                        className={`db-chart-filter-btn ${chartFilter === f ? 'active' : ''}`}
                        onClick={() => setChartFilter(f)}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="db-chart-wrap">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="db-chart-svg">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Y-Axis Grid Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                      const y = paddingY + ratio * (chartHeight - 2 * paddingY);
                      const val = Math.round(chartMaxCount * (1 - ratio));
                      return (
                        <g key={`grid-${idx}`}>
                          <line x1={paddingX} y1={y} x2={chartWidth - paddingX} y2={y} className="chart-grid" />
                          <text x={paddingX - 10} y={y} className="chart-y-label">{val}</text>
                        </g>
                      );
                    })}

                    {/* Area under the line */}
                    <polygon points={areaPoints} className="chart-area" />
                    
                    {/* The Line */}
                    <polyline points={pointsStr} className="chart-line" />

                    {/* Data Points and X-Axis Labels */}
                    {chartPoints.map((p, i) => {
                      const labelStep = chartData.length > 15 ? Math.ceil(chartData.length / 8) : 2;
                      return (
                        <g key={`pt-${i}`}>
                          <circle 
                            cx={p.x} cy={p.y} r="4.5" 
                            className="chart-point"
                            onMouseEnter={() => setHoveredPoint(p)}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                          {i % labelStep === 0 && (
                            <text x={p.x} y={chartHeight - paddingY + 24} className="chart-label">{p.display}</text>
                          )}
                        </g>
                      );
                    })}

                    {/* Custom Tooltip */}
                    {hoveredPoint && (
                      <g className="chart-tooltip-group" style={{ pointerEvents: 'none' }}>
                        <rect 
                          x={hoveredPoint.x - 50} 
                          y={hoveredPoint.y - 45} 
                          width="100" 
                          height="35" 
                          rx="6" 
                          fill="#1a1a1a" 
                        />
                        <polygon 
                          points={`${hoveredPoint.x - 6},${hoveredPoint.y - 10} ${hoveredPoint.x + 6},${hoveredPoint.y - 10} ${hoveredPoint.x},${hoveredPoint.y - 4}`} 
                          fill="#1a1a1a" 
                        />
                        <text x={hoveredPoint.x} y={hoveredPoint.y - 28} fill="#fff" fontSize="12" fontWeight="700" textAnchor="middle">
                          {hoveredPoint.count} emails
                        </text>
                        <text x={hoveredPoint.x} y={hoveredPoint.y - 15} fill="#aaa" fontSize="9" fontWeight="500" textAnchor="middle">
                          {hoveredPoint.display}
                        </text>
                      </g>
                    )}
                  </svg>
                </div>
              </div>


              {/* Full-width Bar Chart */}
              <div className="db-card db-chart-card">
                <div className="db-chart-header">
                  <span className="db-chart-title">Results Breakdown</span>
                  <div style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {searchData && <Lottie style={{ transform: 'scale(2.0)', transformOrigin: 'center' }} animationData={searchData} loop={true} autoplay={true} />}
                  </div>
                </div>
                <div className="db-chart-wrap">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="db-chart-svg">
                    {/* Y-Axis Grid Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                      const y = paddingY + ratio * (chartHeight - 2 * paddingY);
                      const val = Math.round(barMaxCount * (1 - ratio));
                      return (
                        <g key={`grid-${idx}`}>
                          <line x1={paddingX} y1={y} x2={chartWidth - paddingX} y2={y} className="chart-grid" />
                          <text x={paddingX - 10} y={y} className="chart-y-label">{val}</text>
                        </g>
                      );
                    })}

                    {/* Bars and X-Axis Labels */}
                    {barChartData.map((d, i) => {
                      const xCenter = paddingX + (i + 0.5) * barSpacing;
                      const x = xCenter - barWidth / 2;
                      const barH = (d.count / barMaxCount) * (chartHeight - 2 * paddingY);
                      const y = chartHeight - paddingY - barH;
                      const color = d.result === 'SUCCESS' ? '#22c55e' : 
                                    d.result === 'ERROR' ? '#ef4444' : 
                                    d.result === 'SKIPPED' ? '#eab308' : '#888';
                      return (
                        <g key={`bar-${i}`}>
                          <rect 
                            x={x} y={y} width={barWidth} height={barH} 
                            fill={color} rx="4"
                            style={{ transition: 'all 0.2s', cursor: 'pointer' }}
                            onMouseEnter={() => setHoveredBar({ result: d.result, count: d.count, x: xCenter, y, w: barWidth })}
                            onMouseLeave={() => setHoveredBar(null)}
                          />
                          <text x={xCenter} y={chartHeight - paddingY + 24} className="chart-label">{d.result}</text>
                        </g>
                      );
                    })}

                    {/* Custom Tooltip */}
                    {hoveredBar && (
                      <g className="chart-tooltip-group" style={{ pointerEvents: 'none' }}>
                        <rect 
                          x={hoveredBar.x - 50} 
                          y={hoveredBar.y - 45} 
                          width="100" 
                          height="35" 
                          rx="6" 
                          fill="#1a1a1a" 
                        />
                        <polygon 
                          points={`${hoveredBar.x - 6},${hoveredBar.y - 10} ${hoveredBar.x + 6},${hoveredBar.y - 10} ${hoveredBar.x},${hoveredBar.y - 4}`} 
                          fill="#1a1a1a" 
                        />
                        <text x={hoveredBar.x} y={hoveredBar.y - 28} fill="#fff" fontSize="12" fontWeight="700" textAnchor="middle">
                          {hoveredBar.count} emails
                        </text>
                        <text x={hoveredBar.x} y={hoveredBar.y - 15} fill="#aaa" fontSize="9" fontWeight="500" textAnchor="middle">
                          {hoveredBar.result}
                        </text>
                      </g>
                    )}
                  </svg>
                </div>
              </div>

            </div>

            {/* ── 3D Pie & Contribution Section ── */}
            {bubbleData.length > 0 && (
              <div style={{ display: 'flex', gap: '24px', marginTop: '24px', alignItems: 'stretch' }}>
                {/* 3D Pie Chart */}
                <div 
                  className="db-pie-container"
                  style={{ flex: '2.5', marginTop: 0 }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', padding: '20px 24px', fontSize: '1.1rem', fontWeight: 500, color: '#1a1a1a', zIndex: 10 }}>
                    Hall Of Unsub
                  </div>
                  
                  {/* The 3D wrapper for just the SVG slices */}
                  <div 
                    style={{ 
                      position: 'relative', 
                      width: '400px', height: '400px', 
                      transformStyle: 'preserve-3d',
                      transform: 'rotateX(60deg) rotateZ(-25deg)',
                      transition: 'transform 0.5s ease',
                      marginTop: '20px'
                    }}
                  >
                    {/* Stacked layers for 3D thickness (30 layers) */}
                    {Array.from({ length: 30 }).map((_, i) => {
                      const isTop = i === 29;
                      return (
                        <svg 
                          key={i}
                          viewBox="-240 -240 480 480"
                          style={{ 
                            position: 'absolute', inset: -40, overflow: 'visible',
                            transform: `translateZ(${i * 1.5}px)`,
                            filter: isTop ? 'drop-shadow(0 20px 30px rgba(0,0,0,0.3))' : 'brightness(0.6)'
                          }}
                        >
                          {pieSlices.map((slice, j) => (
                            <path 
                              key={j} 
                              d={slice.pathData} 
                              fill={slice.color} 
                              stroke={isTop ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.05)'} 
                              strokeWidth={isTop ? 1.5 : 1} 
                              style={{
                                transform: `translate(${slice.pullOutX}px, ${slice.pullOutY}px)`,
                                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                cursor: 'pointer',
                                pointerEvents: isTop ? 'auto' : 'none'
                              }}
                              onMouseEnter={() => setHoveredSlice(j)}
                              onMouseLeave={() => setHoveredSlice(null)}
                            />
                          ))}
                        </svg>
                      );
                    })}
                  </div>

                  {/* 2D Projected HTML Labels for perfect clarity */}
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '400px', height: '400px', pointerEvents: 'none', marginTop: '20px' }}>
                    {pieSlices.map((slice, j) => {
                      const rawX = slice.labelX + slice.pullOutX;
                      const rawY = slice.labelY + slice.pullOutY;
                      
                      // Project 3D rotated coords to 2D
                      const angleZ = -25 * Math.PI / 180;
                      const cosZ = Math.cos(angleZ);
                      const sinZ = Math.sin(angleZ);
                      
                      const x1 = rawX * cosZ - rawY * sinZ;
                      const y1 = rawX * sinZ + rawY * cosZ;
                      
                      const zOffset = 50; // equivalent to translateZ(50px)
                      const sinX = Math.sin(60 * Math.PI / 180);
                      
                      const px = 200 + x1;
                      const py = 200 + (y1 * 0.5) - (zOffset * sinX);
                      
                      return (
                        <div key={`html-label-${j}`} style={{ 
                          position: 'absolute', 
                          left: px, top: py, 
                          transform: `translate(-50%, -50%) scale(${slice.isHovered ? 1.15 : 1})`,
                          pointerEvents: 'none',
                          textAlign: 'center',
                          background: slice.isHovered ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.7)',
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                          padding: slice.isHovered ? '8px 16px' : '6px 12px',
                          borderRadius: '12px',
                          boxShadow: slice.isHovered ? '0 12px 32px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.08)',
                          border: slice.isHovered ? `2px solid ${slice.color}` : '1px solid rgba(255,255,255,0.9)',
                          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                          zIndex: slice.isHovered ? 100 : 1,
                          opacity: (hoveredSlice !== null && !slice.isHovered) ? 0.3 : 1
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: slice.color, lineHeight: 1 }}>{slice.count}</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#111', background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{slice.percentage}%</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#555', marginTop: '4px', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slice.org}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div 
                  className="db-card" 
                  style={{
                    position: 'relative',
                    flex: '1', 
                    minWidth: '280px',
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '16px',
                    background: 'rgba(255,255,255,0.7)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderRadius: '20px',
                    padding: '24px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
                    border: '1px solid rgba(255,255,255,0.8)'
                  }}
                >
                  <div className="db-card-header" style={{ marginBottom: '16px' }}>
                    <h3 className="db-card-title" style={{ fontSize: '1.1rem', fontWeight: 500, color: '#1a1a1a', textTransform: 'none' }}>Your Contribution</h3>
                    <div style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {checkMarkData && <Lottie style={{ transform: 'scale(2.4)', transformOrigin: 'center' }} animationData={checkMarkData} loop={true} autoplay={true} />}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto' }}>
                    {contributionData.map((d) => (
                      <div key={d.org} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#1a1a1a', fontSize: '0.9rem', maxWidth: '70%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.org}</span>
                          <span style={{ fontWeight: 800, color: activeTheme.primary }}>{d.percentage}%</span>
                        </div>
                        <div style={{ position: 'relative', height: '10px', background: 'rgba(0,0,0,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ 
                            position: 'absolute', 
                            top: 0, left: 0, bottom: 0, 
                            width: `${d.percentage}%`, 
                            background: `linear-gradient(90deg, ${activeTheme.primaryLight}, ${activeTheme.primary})`,
                            borderRadius: '99px'
                          }} />
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#666', textAlign: 'right', fontWeight: 600 }}>
                          {d.count} / {d.globalCount} unsubs globally
                        </div>
                      </div>
                    ))}
                    {contributionData.length === 0 && (
                       <div style={{ color: '#888', fontSize: '0.8rem', textAlign: 'center', marginTop: '20px', fontWeight: 500 }}>No contribution data yet.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </main>

          {/* ── Phone Chat Overlay ── */}
          <button 
            className={`db-phone-toggle-btn ${isPhoneOpen ? 'open' : ''}`}
            onClick={() => setIsPhoneOpen(!isPhoneOpen)}
          >
            {hasNewChat && <span className="db-phone-badge" />}
            <div style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {chatBotData && <Lottie style={{ transform: 'scale(1.5)', transformOrigin: 'center' }} animationData={chatBotData} loop={true} autoplay={true} />}
            </div>
          </button>

          <div className={`db-phone-overlay ${isPhoneOpen ? 'open' : ''}`}>
            <div className="db-phone-mockup">
              {/* Loading overlay — fades out once data is ready */}
              <div className={`db-phone-loader ${logsLoading ? '' : 'hidden'}`}>
                <div className="db-phone-loader-ring" />
                <div className="db-phone-loader-pulse" />
                <span className="db-phone-loader-text">Loading messages…</span>
              </div>

              <div className="db-phone-header">
                <div className="db-phone-avatar" style={{ background: 'transparent' }}>
                  <img src="/email.svg" alt="Unsub Hero" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                </div>
                <div>
                  <div className="db-phone-title">Unsub Hero</div>
                  <div className="db-phone-status">Online</div>
                </div>
                <button className="db-phone-close-btn" style={{ marginLeft: 'auto' }} onClick={() => setIsPhoneOpen(false)}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              
              <div className="db-phone-body">
                {!logsLoading && chatMsgs.length === 0 && !isTyping ? (
                  <div className="db-msg db-msg-in">Hey {displayName}! 👋 I'm watching your inbox. Forward any subscription email to the admin and I'll handle the unsubscribing for you!</div>
                ) : (
                  chatMsgs.map((m) => (
                    <div key={m.id} className={`db-msg ${m.from === 'hero' ? 'db-msg-in' : 'db-msg-out'}`}>
                      {m.text}
                    </div>
                  ))
                )}
                {isTyping && (
                  <div className="db-msg db-msg-in db-typing">
                    <span className="db-dot"/><span className="db-dot"/><span className="db-dot"/>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>
              
              <div className="db-phone-footer">
                <div className="db-phone-input">Message...</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Settings Button ── */}
        <button className="db-settings-btn" onClick={() => setIsSettingsOpen(true)} title="Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>

        {/* ── Settings Overlay ── */}
        <div className={`db-overlay ${isSettingsOpen ? 'open' : ''}`} onClick={(e) => {
          if (e.target === e.currentTarget) setIsSettingsOpen(false);
        }}>
          <div className="db-overlay-card">
            <button className="db-overlay-close" onClick={() => setIsSettingsOpen(false)}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div className="db-overlay-avatar">{initials}</div>
            <h2 className="db-overlay-name">{displayName}</h2>
            <p className="db-overlay-email">{info?.email || '—'}</p>

            <div className="db-theme-picker">
              <span className="db-theme-label">Theme Color</span>
              <div className="db-theme-options">
                <button className={`db-theme-dot ${theme === 'yellow' ? 'active' : ''}`} style={{background: '#fbbf24'}} onClick={() => changeTheme('yellow')} title="Yellow"></button>
                <button className={`db-theme-dot ${theme === 'red' ? 'active' : ''}`} style={{background: '#f87171'}} onClick={() => changeTheme('red')} title="Red"></button>
                <button className={`db-theme-dot ${theme === 'green' ? 'active' : ''}`} style={{background: '#4ade80'}} onClick={() => changeTheme('green')} title="Green"></button>
                <button className={`db-theme-dot ${theme === 'blue' ? 'active' : ''}`} style={{background: '#60a5fa'}} onClick={() => changeTheme('blue')} title="Blue"></button>
                <button className={`db-theme-dot ${theme === 'violet' ? 'active' : ''}`} style={{background: '#a78bfa'}} onClick={() => changeTheme('violet')} title="Violet"></button>
              </div>
            </div>

            <a href="/logout" className="db-overlay-signout" id="dashboard-signout">Sign Out</a>
          </div>
        </div>

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
