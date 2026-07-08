import re

with open('src/components/TemplateOverlay.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to extract the JS from the two script tags.
gsap_match = re.search(r'<script dangerouslySetInnerHTML={{ __html: `\s*\(\s*function\(\)\s*\{(.*?)\}\)\(\);\s*` }}></script>', content, re.DOTALL)
swiper_match = re.search(r'<script dangerouslySetInnerHTML={{ __html: `\s*(setTimeout.*?)\s*` }}></script>', content, re.DOTALL)

gsap_code = gsap_match.group(1) if gsap_match else ''
swiper_code = swiper_match.group(1) if swiper_match else ''

# Fix the python regex escaping artifacts in the extracted code
gsap_code = gsap_code.replace('\\$', '$')
swiper_code = swiper_code.replace('\\$', '$')

new_content = f'''// @ts-nocheck
"use client";
import {{ useEffect }} from 'react';
import Script from 'next/script';

export default function TemplateOverlay() {{
  useEffect(() => {{
    // Wait for GSAP and ScrollTrigger to be ready
    if (typeof window !== "undefined" && window.gsap && window.ScrollTrigger) {{
      {gsap_code}
      {swiper_code}
    }}
  }}, []);

  return (
    <div className="temlis_component" suppressHydrationWarning>
      <div suppressHydrationWarning>
        <div className="load w-embed w-script" suppressHydrationWarning>
          <style dangerouslySetInnerHTML={{{{ __html: `
            [data-anim] {{
              visibility: hidden;
            }}
          ` }}}} suppressHydrationWarning></style>
          <Script src="https://cdn.jsdelivr.net/npm/@finsweet/attributes-numbercount@1/numbercount.js" strategy="lazyOnload" />
        </div>
        <div className="marquee-embed w-embed" suppressHydrationWarning>
          <style dangerouslySetInnerHTML={{{{ __html: `
            @keyframes scroll {{
              from {{ transform: translateX(0); }}
              to {{ transform: translateX(calc(-200% - (var(--gap) * 2))); }}
            }}
            .scroll {{ --gap: 1.5rem; animation: scroll 120s linear infinite; }}
            .reverse {{ animation-direction: reverse; }}
            .marquee-image {{ -webkit-transform: translateZ(0); }}
            @media screen and (max-width: 991px) {{ .scroll {{ --gap: 1rem; }} }}
            @media screen and (max-width: 767px) {{ .scroll {{ --gap: 0.75rem; }} }}
          ` }}}} suppressHydrationWarning></style>
        </div>
      </div>
    </div>
  );
}}
'''

with open('src/components/TemplateOverlay.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Refactored TemplateOverlay.tsx')
