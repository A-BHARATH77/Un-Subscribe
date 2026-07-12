import re
import os

def style_to_object(match):
    style_str = match.group(1)
    if not style_str.strip():
        return 'style={{}}'
    
    parts = style_str.split(';')
    obj_parts = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if ':' not in part:
            continue
        key, value = part.split(':', 1)
        key = key.strip()
        value = value.strip()
        
        # Camel case key
        if key.startswith('-ms-'):
            key = 'ms-' + key[4:]
        if key.startswith('-webkit-'):
            key = 'Webkit-' + key[8:]
        if key.startswith('-moz-'):
            key = 'Moz-' + key[5:]
        
        parts_key = key.split('-')
        camel_key = parts_key[0] + ''.join(word.capitalize() for word in parts_key[1:])
        
        obj_parts.append(f"'{camel_key}': '{value}'")
        
    return 'style={{ ' + ', '.join(obj_parts) + ' }}'

def html_to_jsx(html):
    # Replacements
    html = re.sub(r'\bclass=', 'className=', html)
    html = re.sub(r'\bfor=', 'htmlFor=', html)
    html = re.sub(r'\btabindex=', 'tabIndex=', html)
    html = re.sub(r'\bcrossorigin=', 'crossOrigin=', html)
    html = re.sub(r'\bsrcset=', 'srcSet=', html)
    html = re.sub(r'\bviewbox=', 'viewBox=', html)
    html = re.sub(r'\bfill-rule=', 'fillRule=', html)
    html = re.sub(r'\bclip-rule=', 'clipRule=', html)
    html = re.sub(r'\bclip-path=', 'clipPath=', html)
    html = re.sub(r'\bstroke-width=', 'strokeWidth=', html)
    html = re.sub(r'\bstroke-linecap=', 'strokeLinecap=', html)
    html = re.sub(r'\bstroke-linejoin=', 'strokeLinejoin=', html)
    html = re.sub(r'\bxmlns:xlink=', 'xmlnsXlink=', html)
    html = re.sub(r'\bxml:space=', 'xmlSpace=', html)
    
    # Inline styles
    html = re.sub(r'style="([^"]*)"', style_to_object, html)
    
    # HTML comments -> JSX comments
    html = re.sub(r'<!--(.*?)-->', r'{/*\1*/}', html, flags=re.DOTALL)
    
    return html

def extract_between(text, start_tag, end_tag):
    start = text.find(start_tag)
    if start == -1: return ""
    end = text.find(end_tag, start)
    if end == -1: return ""
    return text[start:end+len(end_tag)]

with open('Aeline.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Extract Head stuff for layout
head = extract_between(content, '<head>', '</head>')
# Get the global styles block
global_styles = extract_between(content, '<div class="global-styles w-embed">', '</div>')
if global_styles:
    style_content_match = re.search(r'<style>(.*?)</style>', global_styles, flags=re.DOTALL)
    if style_content_match:
        with open('src/app/globals.css', 'a', encoding='utf-8') as f:
            f.write("\n" + style_content_match.group(1))

# Extract the body parts
body = extract_between(content, '<body', '</body>')

components_dir = 'src/components'
os.makedirs(components_dir, exist_ok=True)

def write_component(name, jsx_content):
    with open(f'{components_dir}/{name}.tsx', 'w', encoding='utf-8') as f:
        f.write(f"export default function {name}() {{\n  return (\n    <>\n{jsx_content}\n    </>\n  );\n}}\n")

import bs4
soup = bs4.BeautifulSoup(content, 'html.parser')

def get_html_and_jsx(node):
    if not node: return ""
    return html_to_jsx(str(node))

navbar = soup.find('div', class_='navbar')
write_component('Navbar', get_html_and_jsx(navbar))

hero = soup.find('section', class_='section_hero')
write_component('Hero', get_html_and_jsx(hero))

loop = soup.find('section', class_='section_loop')
write_component('LogoMarquee', get_html_and_jsx(loop))

about = soup.find('section', class_='section_about')
write_component('About', get_html_and_jsx(about))

services = soup.find('section', class_='section_services')
write_component('Services', get_html_and_jsx(services))

expertise = soup.find('section', class_='section_expertise')
write_component('Expertise', get_html_and_jsx(expertise))

testimonials = soup.find('section', class_='section_testimonials')
write_component('Testimonials', get_html_and_jsx(testimonials))

blog = soup.find('section', class_='section_blog')
write_component('Blog', get_html_and_jsx(blog))

cta = soup.find('section', class_='section_cta')
write_component('Cta', get_html_and_jsx(cta))

footer = soup.find('footer', class_='footer')
write_component('Footer', get_html_and_jsx(footer))

temlis = soup.find('div', class_='temlis_component')
write_component('TemplateOverlay', get_html_and_jsx(temlis))

# Now generate page.tsx
page_tsx = """import Navbar from '@/components/Navbar';
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
"""
with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(page_tsx)

print("Extraction complete.")
