import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function CookiePolicy() {
  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="main-wrapper" style={{ paddingTop: '120px', paddingBottom: '80px' }}>
        <div className="padding-global">
          <div className="container-large">
            <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '2rem' }}>Cookie Policy</h1>
            <div className="content" style={{ fontSize: '1.1rem', lineHeight: '1.8', color: 'var(--text-muted)' }}>
              <p>Last updated: August 2026</p>
              <h2 style={{ fontSize: '1.8rem', marginTop: '2rem', marginBottom: '1rem', color: 'var(--text)' }}>1. What Are Cookies</h2>
              <p>Cookies are small text files stored on your device when you visit a website. They are widely used to make websites work or improve their efficiency.</p>
              
              <h2 style={{ fontSize: '1.8rem', marginTop: '2rem', marginBottom: '1rem', color: 'var(--text)' }}>2. How We Use Cookies</h2>
              <p>At Unsub Hero, we use strictly necessary cookies to manage user sessions and authenticate users. We do not use third-party tracking or advertising cookies.</p>
              
              <h2 style={{ fontSize: '1.8rem', marginTop: '2rem', marginBottom: '1rem', color: 'var(--text)' }}>3. Managing Cookies</h2>
              <p>You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to log in to our dashboard.</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
