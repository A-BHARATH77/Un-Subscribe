import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function PrivacyPolicy() {
  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="main-wrapper" style={{ paddingTop: '120px', paddingBottom: '80px' }}>
        <div className="padding-global">
          <div className="container-large">
            <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '2rem' }}>Privacy Policy</h1>
            <div className="content" style={{ fontSize: '1.1rem', lineHeight: '1.8', color: 'var(--text-muted)' }}>
              <p>Last updated: August 2026</p>
              <h2 style={{ fontSize: '1.8rem', marginTop: '2rem', marginBottom: '1rem', color: 'var(--text)' }}>1. Information We Collect</h2>
              <p>When you use Unsub Hero, we collect your email address and process your forwarded emails strictly for the purpose of unsubscribing you from unwanted services. We do not require OAuth access to your inbox.</p>
              
              <h2 style={{ fontSize: '1.8rem', marginTop: '2rem', marginBottom: '1rem', color: 'var(--text)' }}>2. How We Use Information</h2>
              <p>We use your forwarded emails to identify unsubscribe links or instructions and execute them on your behalf. Once processed, the contents of the forwarded emails are securely deleted.</p>
              
              <h2 style={{ fontSize: '1.8rem', marginTop: '2rem', marginBottom: '1rem', color: 'var(--text)' }}>3. Data Security</h2>
              <p>We implement strict security measures to protect your data. Your data is encrypted in transit and at rest. We never sell your data to third parties.</p>
              
              <h2 style={{ fontSize: '1.8rem', marginTop: '2rem', marginBottom: '1rem', color: 'var(--text)' }}>4. Contact Us</h2>
              <p>If you have any questions about our Privacy Policy, please contact us at support@unsubhero.com.</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
