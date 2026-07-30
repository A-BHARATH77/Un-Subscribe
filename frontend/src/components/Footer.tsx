"use client";
import { useState } from "react";
// @ts-nocheck
export default function Footer() {
  const [modalContent, setModalContent] = useState<string | null>(null);

  const policies = {
    privacy: {
      title: 'Privacy Policy',
      content: (
        <>
          <p><strong>Last updated: August 2026</strong></p>
          <br />
          <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>1. Information We Collect</h4>
          <p>When you use Unsub Hero, we collect your email address and process your forwarded emails strictly for the purpose of unsubscribing you from unwanted services. We do not require OAuth access to your inbox.</p>
          <br />
          <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>2. How We Use Information</h4>
          <p>We use your forwarded emails to identify unsubscribe links or instructions and execute them on your behalf. Once processed, the contents of the forwarded emails are securely deleted.</p>
          <br />
          <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>3. Data Security</h4>
          <p>We implement strict security measures to protect your data. Your data is encrypted in transit and at rest. We never sell your data to third parties.</p>
        </>
      )
    },
    terms: {
      title: 'Terms of Use',
      content: (
        <>
          <p><strong>Last updated: August 2026</strong></p>
          <br />
          <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>1. Acceptance of Terms</h4>
          <p>By accessing and using Unsub Hero, you agree to be bound by these Terms of Use and our Privacy Policy.</p>
          <br />
          <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>2. Use of Service</h4>
          <p>You agree to use our service only for its intended purpose: unsubscribing from unwanted emails. You must not abuse the service or forward emails that you do not have permission to process.</p>
          <br />
          <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>3. Limitation of Liability</h4>
          <p>Unsub Hero is provided "as is". We are not responsible for any emails that fail to unsubscribe or any consequences of unsubscribing from critical services.</p>
        </>
      )
    },
    cookies: {
      title: 'Cookie Policy',
      content: (
        <>
          <p><strong>Last updated: August 2026</strong></p>
          <br />
          <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>1. What Are Cookies</h4>
          <p>Cookies are small text files stored on your device when you visit a website. They are widely used to make websites work or improve their efficiency.</p>
          <br />
          <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>2. How We Use Cookies</h4>
          <p>At Unsub Hero, we use strictly necessary cookies to manage user sessions and authenticate users. We do not use third-party tracking or advertising cookies.</p>
          <br />
          <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>3. Managing Cookies</h4>
          <p>You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to log in to our dashboard.</p>
        </>
      )
    }
  };

  return (
    <>
<footer animation="opacity" className="footer" suppressHydrationWarning>
<div className="padding-global is-footer" suppressHydrationWarning>
<div className="container-full" suppressHydrationWarning>
<div className="footer_wrap" suppressHydrationWarning>
<div className="footer_top" suppressHydrationWarning>
<div className="footer_content" suppressHydrationWarning>
<div className="footer_content-wrap" suppressHydrationWarning>
<a aria-current="page" className="w-inline-block w--current" href="/" suppressHydrationWarning style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: '#ffffff', fontWeight: 'bold', fontSize: '1.25rem', marginBottom: '16px' }}>
  <div style={{ width: '36px', height: '36px', background: '#1a1a1a', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
      <rect x="2" y="4" width="20" height="16" rx="3"/><polyline points="2,4 12,13 22,4"/>
    </svg>
  </div>
  Unsub Hero
</a>
<div suppressHydrationWarning>
                        Easily reclaim your inbox and your time with our simple, secure, and privacy-focused email forwarding unsubscribe service.
                      </div>
</div>
<div className="footer_content-wrap" suppressHydrationWarning>
<div suppressHydrationWarning>Get Productivity Tips</div>
<div className="form-block w-form" suppressHydrationWarning>
<form className="footer-form" data-name="Email Form" data-wf-element-id="d0f47cf0-bf82-d126-ac4e-db75935c933a" data-wf-page-id="6929c116366a14507fc84240" id="email-form" method="get" name="email-form" suppressHydrationWarning>
<input className="text-field w-input" data-name="Email" id="email" maxLength="256" name="email" placeholder="Enter your email" required="" type="email" suppressHydrationWarning /><button className="button-arrow" data-w-id="ecad309e-9ea3-e334-3ef6-1742a2add748" type="submit" suppressHydrationWarning>
<div className="button-arrow_wrap" suppressHydrationWarning>
<div className="button-arrow_text hide-mobile-portrait" suppressHydrationWarning>
<div className="text_button" suppressHydrationWarning>Submit</div>
</div>
<div className="button_container-arrow" suppressHydrationWarning>
<svg className="icon-1x1-main" fill="none" viewBox="0 0 20 20" width="100%" xmlns="http://www.w3.org/2000/svg" suppressHydrationWarning>
<path d="M13.0457 8.13128L5.8733 15.3037L4.69479 14.1252L11.8672 6.95277L5.54568 6.95277L5.54568 5.28636H14.7121V14.4528L13.0457 14.4528V8.13128Z" fill="currentColor" suppressHydrationWarning></path>
</svg>
</div>
<div className="button-arrow_bg" suppressHydrationWarning></div>
</div>
</button>
</form>
<div className="success-message w-form-done" suppressHydrationWarning>
<div suppressHydrationWarning>
                            Thank you! Your submission has been received!
                          </div>
</div>
<div className="error-message w-form-fail" suppressHydrationWarning>
<div suppressHydrationWarning>
                            Oops! Something went wrong while submitting the
                            form.
                          </div>
</div>
</div>
</div>
</div>
<div className="footer_right" suppressHydrationWarning>
<div className="footer_links" suppressHydrationWarning>
<a className="footer_link w-inline-block" href="/#about" suppressHydrationWarning><div suppressHydrationWarning>About Us</div></a><a className="footer_link w-inline-block" href="/#features" suppressHydrationWarning><div suppressHydrationWarning>Features</div></a><a className="footer_link w-inline-block" href="/#expertise" suppressHydrationWarning><div suppressHydrationWarning>Expertise</div></a>
</div>
<div className="footer_links" suppressHydrationWarning>
<a className="footer_link w-inline-block" href="/#testimonials" suppressHydrationWarning><div suppressHydrationWarning>Testimonials</div></a><a className="footer_link w-inline-block" href="/#blog" suppressHydrationWarning><div suppressHydrationWarning>Blog</div></a><a className="footer_link w-inline-block" href="/#get-started" suppressHydrationWarning><div suppressHydrationWarning>Get Started</div></a>
</div>

</div>
</div>
<div className="footer_bottom" suppressHydrationWarning>
<div className="footer_bottom-links" suppressHydrationWarning>
<button className="footer_bottom-link w-inline-block" onClick={() => setModalContent('privacy')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} suppressHydrationWarning><div className="text-sm" suppressHydrationWarning>Privacy Policy</div></button><button className="footer_bottom-link w-inline-block" onClick={() => setModalContent('terms')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} suppressHydrationWarning><div className="text-sm" suppressHydrationWarning>Terms of Use</div></button><button className="footer_bottom-link w-inline-block" onClick={() => setModalContent('cookies')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} suppressHydrationWarning><div className="text-sm" suppressHydrationWarning>Cookie Policy</div></button>
</div>
<div className="text-color-on-secondary" suppressHydrationWarning>
                    © 2026 Unsub Hero Inc. All rights reserved.
                  </div>
</div>
</div>
</div>
</div>
</footer>
      {modalContent && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            maxWidth: '650px',
            width: '100%',
            maxHeight: '85vh',
            overflowY: 'auto',
            position: 'relative',
            padding: '48px',
            color: '#0f172a',
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <button
              onClick={() => setModalContent(null)}
              style={{
                position: 'absolute',
                top: '24px',
                right: '24px',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '20px',
                lineHeight: 1,
                color: '#64748b',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
            >
              ✕
            </button>
            <h2 style={{ fontSize: '2.25rem', fontWeight: '800', marginBottom: '24px', color: '#0f172a', letterSpacing: '-0.02em' }}>
              {policies[modalContent as keyof typeof policies].title}
            </h2>
            <div style={{ fontSize: '1.05rem', lineHeight: '1.7', color: '#334155' }}>
              {policies[modalContent as keyof typeof policies].content}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
