import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import TemplateOverlay from '@/components/TemplateOverlay';

export default function Home() {
  return (
    <>
    <style dangerouslySetInnerHTML={{__html: `
      body, html { overflow: hidden !important; margin: 0 !important; padding: 0 !important; background: white !important; height: 100% !important; }
    `}} />
    <div className="page-wrapper" style={{ position: 'absolute', top: '6px', bottom: '6px', left: '6px', right: '6px', overflow: 'hidden', borderRadius: '20px', margin: 0 }}>
      <div className="db-clouds">
        <div className="css-cloud cloud-1"></div>
        <div className="css-cloud cloud-2"></div>
        <div className="css-cloud cloud-3"></div>
        <div className="css-cloud cloud-4"></div>
        <div className="css-cloud cloud-5"></div>
      </div>
      <Navbar />
      <main className="main-wrapper">
        <Hero />
      </main>
      <TemplateOverlay />
    </div>
    </>
  );
}

