import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import LogoMarquee from '@/components/LogoMarquee';
import About from '@/components/About';
import Services from '@/components/Services';
import Expertise from '@/components/Expertise';
import Testimonials from '@/components/Testimonials';
import Blog from '@/components/Blog';
import Cta from '@/components/Cta';
import Footer from '@/components/Footer';
import TemplateOverlay from '@/components/TemplateOverlay';

export default function Home() {
  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="main-wrapper">
        <Hero />
        <LogoMarquee />
        <About />
        <Services />
        <Expertise />
        <Testimonials />
        <Blog />
        <Cta />
      </main>
      <Footer />
      <TemplateOverlay />
    </div>
  );
}
