import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function TermsOfUse() {
  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="main-wrapper" style={{ paddingTop: '120px', paddingBottom: '80px' }}>
        <div className="padding-global">
          <div className="container-large">
            <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '2rem' }}>Terms of Use</h1>
            <div className="content" style={{ fontSize: '1.1rem', lineHeight: '1.8', color: 'var(--text-muted)' }}>
              <p>Last updated: August 2026</p>
              <h2 style={{ fontSize: '1.8rem', marginTop: '2rem', marginBottom: '1rem', color: 'var(--text)' }}>1. Acceptance of Terms</h2>
              <p>By accessing and using Unsub Hero, you agree to be bound by these Terms of Use and our Privacy Policy.</p>
              
              <h2 style={{ fontSize: '1.8rem', marginTop: '2rem', marginBottom: '1rem', color: 'var(--text)' }}>2. Use of Service</h2>
              <p>You agree to use our service only for its intended purpose: unsubscribing from unwanted emails. You must not abuse the service or forward emails that you do not have permission to process.</p>
              
              <h2 style={{ fontSize: '1.8rem', marginTop: '2rem', marginBottom: '1rem', color: 'var(--text)' }}>3. Limitation of Liability</h2>
              <p>Unsub Hero is provided "as is". We are not responsible for any emails that fail to unsubscribe or any consequences of unsubscribing from critical services.</p>
              
              <h2 style={{ fontSize: '1.8rem', marginTop: '2rem', marginBottom: '1rem', color: 'var(--text)' }}>4. Changes to Terms</h2>
              <p>We reserve the right to modify these terms at any time. We will notify users of significant changes.</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
