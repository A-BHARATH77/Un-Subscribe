// @ts-nocheck
"use client";
import { useEffect } from 'react';
import Script from 'next/script';

export default function TemplateOverlay() {
  useEffect(() => {
    let checkInterval = setInterval(() => {
      if (window.gsap && window.ScrollTrigger && window.$ && window.Swiper) {
        clearInterval(checkInterval);
        
              /* Reduced motion */
              if (
                window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ) {
                window.gsap.set("[data-anim]", { visibility: "visible" });
                return;
              }
              window.gsap.set("[data-anim]", { visibility: "visible" });

              /* Smart trigger: load si visible, ScrollTrigger si below fold */
              function smartPlay(el, tl, delay) {
                var rect = el.getBoundingClientRect();
                if (rect.top < window.innerHeight * 0.85) {
                  tl.delay(delay || 0.3).play();
                } else {
                  window.ScrollTrigger.create({
                    trigger: el,
                    start: "top 85%",
                    onEnter: function () {
                      tl.play();
                    },
                  });
                }
              }

              /* ========== 1. CARD REVEAL ========== */
              document
                .querySelectorAll('[data-anim="card-reveal"]')
                .forEach(function (c) {
                  var tl = window.gsap.timeline({ paused: true });

                  tl.from(c, {
                    autoAlpha: 0,
                    scale: 0.92,
                    duration: 0.55,
                    ease: "power3.out",
                  });

                  /* fade-up labels */
                  var labels = c.querySelectorAll('[data-anim="fade-up"]');
                  if (labels.length) {
                    tl.from(
                      labels,
                      {
                        autoAlpha: 0,
                        y: 10,
                        duration: 0.4,
                        stagger: 0.1,
                        ease: "power2.out",
                      },
                      "-=0.4",
                    );
                  }

                  /* progress bars */
                  var bars = c.querySelectorAll('[data-anim="progress"]');
                  bars.forEach(function (b) {
                    var f = b.firstElementChild;
                    if (f) {
                      var w = f.style.width || "49%";
                      window.gsap.set(f, { width: "0%" });
                      tl.to(
                        f,
                        { width: w, duration: 0.9, ease: "power2.inOut" },
                        "-=0.15",
                      );
                    }
                  });

                  /* stagger rows */
                  var rows = c.querySelectorAll('[data-anim="stagger-rows"]');
                  rows.forEach(function (r) {
                    tl.from(
                      r.children,
                      {
                        autoAlpha: 0,
                        x: 20,
                        duration: 0.4,
                        stagger: 0.1,
                        ease: "power2.out",
                      },
                      "-=0.35",
                    );
                  });

                  /* bar chart grow */
                  var barChart = c.querySelector('[data-anim="bar-grow"]');
                  if (barChart) {
                    var barEls = barChart.querySelectorAll(".bcard_bar");
                    barEls.forEach(function (bar) {
                      window.gsap.set(bar, {
                        scaleY: 0,
                        transformOrigin: "bottom center",
                      });
                    });
                    var yearLabels =
                      barChart.querySelectorAll(".bcard_text-year");
                    tl.from(
                      yearLabels,
                      {
                        autoAlpha: 0,
                        y: 6,
                        duration: 0.25,
                        stagger: 0.05,
                        ease: "power2.out",
                      },
                      "-=0.3",
                    );
                    tl.to(
                      barEls,
                      {
                        scaleY: 1,
                        duration: 0.6,
                        stagger: 0.09,
                        ease: "back.out(1.4)",
                      },
                      "-=0.1",
                    );
                  }

                  /* stagger text */
                  var staggerTexts = c.querySelectorAll(
                    '[data-anim="stagger-text"]',
                  );
                  staggerTexts.forEach(function (st) {
                    tl.from(
                      st.children,
                      {
                        autoAlpha: 0,
                        y: 12,
                        duration: 0.35,
                        stagger: 0.09,
                        ease: "power2.out",
                      },
                      "-=0.35",
                    );
                  });

                  smartPlay(c, tl, 0.3);
                });

              /* ========== 2. ORBIT REVEAL ========== */
              document
                .querySelectorAll('[data-anim="orbit-reveal"]')
                .forEach(function (o) {
                  var tl = window.gsap.timeline({ paused: true });
                  var rings = o.querySelectorAll(".ocard_ring");

                  tl.from(o, { autoAlpha: 0, duration: 0.25 });
                  tl.from(
                    rings,
                    {
                      scale: 0,
                      autoAlpha: 0,
                      duration: 0.45,
                      ease: "back.out(2)",
                    },
                    "-=0.15",
                  );

                  var center = o.querySelector('[data-anim="fade-up"]');
                  if (center) {
                    tl.from(
                      center,
                      {
                        scale: 0,
                        autoAlpha: 0,
                        duration: 0.45,
                        ease: "back.out(2)",
                      },
                      "-=0.4",
                    );
                  }

                  var pills = o.querySelectorAll('[data-anim="pill-float"]');
                  pills.forEach(function (pill) {
                    tl.from(
                      pill,
                      {
                        autoAlpha: 0,
                        scale: 0.7,
                        duration: 0.5,
                        ease: "back.out(1.5)",
                      },
                      "-=0.35",
                    );
                  });

                  /* Continuous orbit after reveal */
                  tl.call(function () {
                    var oRect = o.getBoundingClientRect();
                    var cx = oRect.left + oRect.width / 2;
                    var cy = oRect.top + oRect.height / 2;
                    var durations = [50, 60, 45];
                    pills.forEach(function (pill, i) {
                      var pRect = pill.getBoundingClientRect();
                      var px = pRect.left + pRect.width / 2;
                      var py = pRect.top + pRect.height / 2;
                      var dx = px - cx,
                        dy = py - cy;
                      var radius = Math.sqrt(dx * dx + dy * dy);
                      var startAngle = Math.atan2(dy, dx);
                      var origX = Math.cos(startAngle) * radius;
                      var origY = Math.sin(startAngle) * radius;
                      var speed = (2 * Math.PI) / (durations[i] || 50);
                      var angle = startAngle;
                      window.gsap.ticker.add(function () {
                        angle += (speed * window.gsap.ticker.deltaRatio(60)) / 60;
                        window.gsap.set(pill, {
                          x: Math.cos(angle) * radius - origX,
                          y: Math.sin(angle) * radius - origY,
                        });
                      });
                    });
                  });

                  smartPlay(o, tl, 0.3);
                });

              /* ========== 3. STANDALONE FADE-UP ========== */
              document
                .querySelectorAll('[data-anim="fade-up"]')
                .forEach(function (el) {
                  if (
                    el.closest('[data-anim="card-reveal"]') ||
                    el.closest('[data-anim="orbit-reveal"]')
                  )
                    return;
                  var tl = window.gsap.timeline({ paused: true });
                  tl.from(el, {
                    autoAlpha: 0,
                    y: 40,
                    duration: 0.7,
                    ease: "power2.out",
                  });
                  smartPlay(el, tl, 0.2);
                });

              /* ========== 4. MARQUEE ========== */
              function initMarquee(selector, direction, speed) {
                document.querySelectorAll(selector).forEach(function (row) {
                  var items = window.gsap.utils.toArray(row.children);
                  if (!items.length) return;
                  var half = items.length / 2;
                  var totalWidth = 0;
                  for (var i = 0; i < half; i++) {
                    totalWidth +=
                      items[i].offsetWidth +
                      parseFloat(getComputedStyle(row).gap || 0);
                  }
                  var duration = totalWidth / speed;
                  if (direction === "left") {
                    window.gsap.set(row, { x: 0 });
                    window.gsap.to(row, {
                      x: -totalWidth,
                      duration: duration,
                      ease: "none",
                      repeat: -1,
                      modifiers: {
                        x: window.gsap.utils.unitize(function (x) {
                          return parseFloat(x) % totalWidth;
                        }),
                      },
                    });
                  } else {
                    window.gsap.set(row, { x: -totalWidth });
                    window.gsap.to(row, {
                      x: 0,
                      duration: duration,
                      ease: "none",
                      repeat: -1,
                      modifiers: {
                        x: window.gsap.utils.unitize(function (x) {
                          return (
                            -totalWidth +
                            ((parseFloat(x) + totalWidth) % totalWidth)
                          );
                        }),
                      },
                    });
                  }
                });
              }
              initMarquee('[data-anim="marquee-right"]', "left", 35);
              initMarquee('[data-anim="marquee-left"]', "right", 35);
            
      setTimeout(() => {
                window.$(".section_testimonials").each(function () {
                  const $section = window.$(this);

                  const swiper = new window.Swiper($section.find(".swiper")[0], {
                    speed: 700,
                    loop: false,
                    slidesPerView: 1, // Por defecto: móvil portrait
                    spaceBetween: 16, // Landscape y móviles

                    mousewheel: { forceToAxis: true },
                    keyboard: { enabled: true, onlyInViewport: true },

                    breakpoints: {
                      // Tablet (y landscape)
                      768: {
                        slidesPerView: 2,
                        spaceBetween: 24,
                      }, // Desktop
                      992: {
                        slidesPerView: 3,
                        spaceBetween: 24,
                      },
                    },
                  }); // Flechas personalizadas

                  $section.find(".slide_prev").on("click", function () {
                    swiper.slidePrev();
                  });

                  $section.find(".slide_next").on("click", function () {
                    swiper.slideNext();
                  });
                });
              }, 1000); // Espera 1 segundo antes de inicializar
      }
    }, 100);

    return () => clearInterval(checkInterval);
  }, []);

  return (
    <div className="temlis_component" suppressHydrationWarning>
      <div suppressHydrationWarning>
        <div className="load w-embed w-script" suppressHydrationWarning>
          <style dangerouslySetInnerHTML={{ __html: `
            [data-anim] {
              visibility: hidden;
            }
          ` }} suppressHydrationWarning></style>
          <Script src="https://cdn.jsdelivr.net/npm/@finsweet/attributes-numbercount@1/numbercount.js" strategy="lazyOnload" />
        </div>
        <div className="marquee-embed w-embed" suppressHydrationWarning>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes scroll {
              from { transform: translateX(0); }
              to { transform: translateX(calc(-200% - (var(--gap) * 2))); }
            }
            .scroll { --gap: 1.5rem; animation: scroll 120s linear infinite; }
            .reverse { animation-direction: reverse; }
            .marquee-image { -webkit-transform: translateZ(0); }
            @media screen and (max-width: 991px) { .scroll { --gap: 1rem; } }
            @media screen and (max-width: 767px) { .scroll { --gap: 0.75rem; } }
          ` }} suppressHydrationWarning></style>
        </div>
      </div>
    </div>
  );
}
