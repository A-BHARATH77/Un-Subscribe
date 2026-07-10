'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface EmailData {
  id: string;
  from: string;
  sender_name: string;
  initials: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  body: string;
  is_starred: boolean;
  user_email: string;
}

export default function EmailDetailPage() {
  const params = useParams();
  const router = useRouter();
  const msgId = params?.id as string;

  const [email, setEmail] = useState<EmailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unsubState, setUnsubState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [modal, setModal] = useState<{
    open: boolean;
    status: string;
    method?: string;
    reason?: string;
    url?: string;
    marked_read?: boolean;
    reply_sent?: boolean;
  } | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // ── Fetch email data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!msgId) return;
    fetch(`/api/email/${msgId}`)
      .then(r => r.json())
      .then((data: EmailData & { error?: string }) => {
        if (data.error) { router.push('/sign-in'); return; }
        setEmail(data);
        setLoading(false);
      })
      .catch(() => router.push('/sign-in'));
  }, [msgId, router]);

  // ── Inject body into iframe ───────────────────────────────────────────────
  useEffect(() => {
    if (!email || !frameRef.current) return;
    const frame = frameRef.current;
    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) return;

    // Capture as a definitely-non-null const so TypeScript doesn't
    // lose the narrowing inside the nested resizeFrame closure.
    const resolvedDoc: Document = doc;

    const fullHtml = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          font-size: 14px; line-height: 1.6; color: #222;
          margin: 0; padding: 28px 32px; background: #fff; word-break: break-word;
        }
        img { max-width: 100%; height: auto; }
        a { color: #1a73e8; }
        pre { white-space: pre-wrap; font-family: monospace; }
        table { max-width: 100%; }
      </style>
    </head><body>${email.body}</body></html>`;
    resolvedDoc.open(); resolvedDoc.write(fullHtml); resolvedDoc.close();

    function resizeFrame() {
      try {
        const h = resolvedDoc.body.scrollHeight;
        frame.style.height = Math.max(h + 40, 200) + 'px';
      } catch (_) {}
    }
    frame.addEventListener('load', resizeFrame);
    const t1 = setTimeout(resizeFrame, 300);
    const t2 = setTimeout(resizeFrame, 800);
    return () => { clearTimeout(t1); clearTimeout(t2); frame.removeEventListener('load', resizeFrame); };
  }, [email]);

  // ── Unsubscribe ───────────────────────────────────────────────────────────
  function triggerUnsub() {
    setUnsubState('loading');
    fetch(`/api/unsubscribe/${msgId}`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        setUnsubState('done');
        setModal({ open: true, ...data });
      })
      .catch(err => {
        setUnsubState('idle');
        setModal({ open: true, status: 'error', reason: 'Network error: ' + err.message });
      });
  }

  function closeModal() {
    setModal(null);
    if (unsubState !== 'done') setUnsubState('idle');
  }

  const userEmail = email?.user_email || '';
  const initials = userEmail ? userEmail.charAt(0).toUpperCase() : 'M';

  const style = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0d0f14; --sidebar: #11131a; --surface: #161921; --surface2: #1e2130; --surface3: #242840;
      --border: rgba(255,255,255,0.07); --border2: rgba(255,255,255,0.04);
      --text: #e8eaf0; --text-muted: #7b849a; --text-dim: #4a526a;
      --accent: #5b8af5; --accent2: #a78bfa; --accent-soft: rgba(91,138,245,0.12);
      --starred: #fbbf24; --glow: rgba(91,138,245,0.2); --red: #f87171;
    }
    html, body { height: 100%; font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); }
    .layout { display: grid; grid-template-columns: 260px 1fr; grid-template-rows: 60px 1fr; height: 100vh; }

    .header { grid-column: 1 / -1; background: var(--sidebar); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 20px 0 0; z-index: 100; }
    .header-logo { width: 260px; display: flex; align-items: center; gap: 10px; padding: 0 20px; flex-shrink: 0; }
    .logo-icon { width: 34px; height: 34px; background: linear-gradient(135deg, var(--accent), var(--accent2)); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .logo-icon svg { width: 18px; height: 18px; }
    .logo-name { font-weight: 700; font-size: 1.05rem; letter-spacing: -0.02em; }
    .header-actions { display: flex; align-items: center; gap: 10px; margin-right: 20px; }
    .btn-back { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; color: var(--text-muted); font-family: 'Inter', sans-serif; font-size: 0.83rem; cursor: pointer; text-decoration: none; transition: all 0.2s; }
    .btn-back:hover { color: var(--text); border-color: var(--accent); background: var(--accent-soft); }
    .btn-back svg { width: 15px; height: 15px; }
    .header-right { display: flex; align-items: center; gap: 12px; margin-left: auto; }
    .user-badge { display: flex; align-items: center; gap: 8px; padding: 6px 14px 6px 6px; background: var(--surface); border: 1px solid var(--border); border-radius: 100px; }
    .user-avatar { width: 28px; height: 28px; background: linear-gradient(135deg, var(--accent), var(--accent2)); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; color: #fff; }
    .user-email-text { font-size: 0.78rem; color: var(--text-muted); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .btn-logout { padding: 7px 14px; background: transparent; border: 1px solid var(--border); border-radius: 10px; color: var(--text-muted); font-family: 'Inter', sans-serif; font-size: 0.8rem; cursor: pointer; text-decoration: none; transition: all 0.2s; }
    .btn-logout:hover { border-color: var(--red); color: var(--red); background: rgba(248,113,113,0.07); }

    .sidebar { background: var(--sidebar); border-right: 1px solid var(--border); padding: 16px 12px; overflow-y: auto; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; cursor: pointer; transition: all 0.15s; color: var(--text-muted); font-size: 0.88rem; font-weight: 500; border: none; background: transparent; width: 100%; text-align: left; text-decoration: none; }
    .nav-item:hover { background: var(--surface); color: var(--text); }
    .nav-item.active { background: var(--accent-soft); color: var(--accent); }
    .nav-item svg { width: 16px; height: 16px; flex-shrink: 0; opacity: 0.8; }

    .email-detail { overflow-y: auto; background: var(--bg); }
    .email-detail::-webkit-scrollbar { width: 5px; }
    .email-detail::-webkit-scrollbar-track { background: transparent; }
    .email-detail::-webkit-scrollbar-thumb { background: var(--surface3); border-radius: 100px; }
    .email-container { max-width: 780px; margin: 0 auto; padding: 32px 24px 60px; }

    .email-subject-row { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 28px; }
    .email-subject-line { flex: 1; font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1.3; color: var(--text); }

    .email-card { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
    .email-card-header { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; gap: 14px; }
    .sender-avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent2)); display: flex; align-items: center; justify-content: center; font-size: 0.9rem; font-weight: 700; color: #fff; flex-shrink: 0; }
    .sender-info { flex: 1; }
    .sender-name { font-size: 0.95rem; font-weight: 600; color: var(--text); margin-bottom: 3px; }
    .sender-email-row { font-size: 0.78rem; color: var(--text-muted); }
    .email-recipients { font-size: 0.78rem; color: var(--text-dim); margin-top: 4px; }
    .email-recipients span { color: var(--text-muted); }
    .email-date-detail { font-size: 0.78rem; color: var(--text-dim); white-space: nowrap; flex-shrink: 0; }

    .email-body-wrap { padding: 0; background: #fff; min-height: 200px; }
    .email-body-frame { width: 100%; border: none; display: block; min-height: 400px; background: #fff; }

    .actions-bar { padding: 20px 24px; border-top: 1px solid var(--border); display: flex; gap: 10px; background: var(--surface); flex-wrap: wrap; }
    .btn-action { display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; color: var(--text-muted); font-family: 'Inter', sans-serif; font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: all 0.2s; }
    .btn-action:hover { background: var(--surface3); color: var(--text); border-color: rgba(255,255,255,0.12); }
    .btn-action svg { width: 15px; height: 15px; }
    .badge-starred { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3); border-radius: 100px; color: var(--starred); font-size: 0.75rem; font-weight: 500; }
    .badge-starred svg { width: 12px; height: 12px; }

    .btn-unsub { display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: linear-gradient(135deg, rgba(248,113,113,0.15), rgba(251,146,60,0.15)); border: 1px solid rgba(248,113,113,0.35); border-radius: 10px; color: #fca5a5; font-family: 'Inter', sans-serif; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-left: auto; }
    .btn-unsub:hover { background: linear-gradient(135deg, rgba(248,113,113,0.28), rgba(251,146,60,0.25)); border-color: rgba(248,113,113,0.6); color: #fff; box-shadow: 0 0 18px rgba(248,113,113,0.25); }
    .btn-unsub svg { width: 15px; height: 15px; }
    .btn-unsub:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-unsub.done { background: rgba(52,211,153,0.15); border-color: rgba(52,211,153,0.4); color: #34d399; }

    .unsub-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(6px); z-index: 1000; align-items: center; justify-content: center; }
    .unsub-overlay.active { display: flex; }
    .unsub-spinner-box { display: flex; flex-direction: column; align-items: center; gap: 18px; color: var(--text-muted); font-size: 0.95rem; }
    .unsub-spinner { width: 52px; height: 52px; border: 4px solid var(--surface3); border-top-color: #f87171; border-radius: 50%; animation: spin 0.9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .unsub-modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(6px); z-index: 1001; align-items: center; justify-content: center; }
    .unsub-modal.active { display: flex; }
    .unsub-modal-card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 36px 40px; max-width: 440px; width: 90%; text-align: center; box-shadow: 0 24px 64px rgba(0,0,0,0.5); animation: modalIn 0.25s ease; }
    @keyframes modalIn { from { opacity: 0; transform: scale(0.92) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    .modal-icon { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 28px; }
    .modal-icon.success { background: rgba(52,211,153,0.15); border: 1px solid rgba(52,211,153,0.3); }
    .modal-icon.skipped { background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.3); }
    .modal-icon.notfound { background: rgba(148,163,184,0.1); border: 1px solid rgba(148,163,184,0.2); }
    .modal-icon.error { background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.3); }
    .modal-title { font-size: 1.15rem; font-weight: 700; margin-bottom: 10px; letter-spacing: -0.01em; }
    .modal-reason { font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; margin-bottom: 8px; white-space: pre-line; }
    .modal-url { font-size: 0.73rem; color: var(--text-dim); word-break: break-all; margin-bottom: 24px; }
    .modal-url a { color: var(--accent); text-decoration: none; }
    .modal-url a:hover { text-decoration: underline; }
    .btn-modal-close { padding: 10px 28px; background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; color: var(--text-muted); font-family: 'Inter', sans-serif; font-size: 0.88rem; font-weight: 500; cursor: pointer; transition: all 0.2s; }
    .btn-modal-close:hover { background: var(--surface3); color: var(--text); }

    .page-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 16px; color: var(--text-muted); }
    .page-spinner { width: 36px; height: 36px; border: 3px solid var(--surface3); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
  `;

  // ── Modal helpers ─────────────────────────────────────────────────────────
  function getModalIconClass() {
    if (!modal) return '';
    switch (modal.status) {
      case 'success': return 'success';
      case 'skipped': return 'skipped';
      case 'not_found': return 'notfound';
      default: return 'error';
    }
  }
  function getModalIcon() {
    if (!modal) return '';
    switch (modal.status) {
      case 'success': return '✅';
      case 'skipped': return '⏭️';
      case 'not_found': return '🔍';
      default: return '❌';
    }
  }
  function getModalTitle() {
    if (!modal) return '';
    switch (modal.status) {
      case 'success': return modal.method === 'form' ? 'Unsubscribed via form!' : 'Successfully Unsubscribed!';
      case 'skipped': return 'Skipped — Login Required';
      case 'not_found': return 'No Unsubscribe Link Found';
      default: return 'Something went wrong';
    }
  }
  function getModalReason() {
    if (!modal) return '';
    let r = modal.reason || '';
    if (modal.marked_read) r += '\n📬 Email marked as read in Gmail.';
    if (modal.reply_sent) r += '\n📤 Reply sent to sender confirming unsubscribe.';
    return r;
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
                <rect x="2" y="4" width="20" height="16" rx="3"/>
                <polyline points="2,4 12,13 22,4"/>
              </svg>
            </div>
            <span className="logo-name">MailView</span>
          </div>

          <div className="header-actions">
            <a href="/inbox" className="btn-back" id="back-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Back to Inbox
            </a>
          </div>

          <div className="header-right">
            <div className="user-badge">
              <div className="user-avatar" id="user-av">{initials}</div>
              <span className="user-email-text">{userEmail}</span>
            </div>
            <a href="/logout" className="btn-logout">Sign out</a>
          </div>
        </header>

        {/* Sidebar */}
        <aside className="sidebar">
          <a className="nav-item active" href="/inbox">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
            </svg>
            Inbox
          </a>
          <a className="nav-item" href="/inbox">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Starred
          </a>
          <a className="nav-item" href="/inbox">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            Sent
          </a>
        </aside>

        {/* Email Detail */}
        <div className="email-detail">
          {loading || !email ? (
            <div className="page-loading">
              <div className="page-spinner"></div>
              <span>Loading email…</span>
            </div>
          ) : (
            <div className="email-container">
              {/* Subject */}
              <div className="email-subject-row">
                <h1 className="email-subject-line">{email.subject}</h1>
                {email.is_starred && (
                  <span className="badge-starred">
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    Starred
                  </span>
                )}
              </div>

              {/* Email card */}
              <div className="email-card">
                {/* Card header */}
                <div className="email-card-header">
                  <div className="sender-avatar">{email.initials}</div>
                  <div className="sender-info">
                    <div className="sender-name">{email.sender_name}</div>
                    <div className="sender-email-row">{email.from}</div>
                    <div className="email-recipients">
                      To: <span>{email.to || userEmail}</span>
                      {email.cc && <>&nbsp; CC: <span>{email.cc}</span></>}
                    </div>
                  </div>
                  <div className="email-date-detail">{email.date}</div>
                </div>

                {/* Body */}
                <div className="email-body-wrap">
                  <iframe
                    ref={frameRef}
                    id="email-frame"
                    className="email-body-frame"
                    sandbox="allow-same-origin"
                    title="Email Content"
                  />
                </div>

                {/* Actions */}
                <div className="actions-bar">
                  <button className="btn-action" onClick={() => router.push('/inbox')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
                    </svg>
                    Back to Inbox
                  </button>
                  <button className="btn-action">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>
                    </svg>
                    Forward
                  </button>
                  <button className="btn-action" onClick={() => window.print()}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9"/>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                      <rect x="6" y="14" width="12" height="8"/>
                    </svg>
                    Print
                  </button>

                  {/* Unsubscribe button */}
                  <button
                    className={`btn-unsub${unsubState === 'done' ? ' done' : ''}`}
                    id="unsub-btn"
                    onClick={triggerUnsub}
                    disabled={unsubState === 'loading' || unsubState === 'done'}
                  >
                    {unsubState === 'done' ? (
                      '✓ Done'
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                        Unsubscribe
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      <div className={`unsub-overlay${unsubState === 'loading' ? ' active' : ''}`} id="unsub-overlay">
        <div className="unsub-spinner-box">
          <div className="unsub-spinner"></div>
          <span>Finding unsubscribe link…</span>
        </div>
      </div>

      {/* Result Modal */}
      {modal?.open && (
        <div className="unsub-modal active" id="unsub-modal">
          <div className="unsub-modal-card">
            <div className={`modal-icon ${getModalIconClass()}`} id="modal-icon">{getModalIcon()}</div>
            <div className="modal-title" id="modal-title">{getModalTitle()}</div>
            <div className="modal-reason" id="modal-reason">{getModalReason()}</div>
            {modal.url && (
              <div className="modal-url" id="modal-url">
                <a href={modal.url} target="_blank" rel="noopener noreferrer">View unsubscribe page ↗</a>
              </div>
            )}
            <button className="btn-modal-close" onClick={closeModal}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
