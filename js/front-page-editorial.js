/**
 * front-page-editorial.js
 * - GSAP (Core + ScrollTrigger) 前提
 * - トップページのみで読み込み（functions.php側で制御）
 */

(() => {
  const root = document.documentElement;
  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

  // 依存が無い / 取得できない場合は静的表示で終了
  if (!window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);

  const qs = (sel, base = document) => base.querySelector(sel);
  const qsa = (sel, base = document) => Array.from(base.querySelectorAll(sel));

  // -----------------------------
  // Split text (1文字ずつ span化)
  // -----------------------------
  function splitChars(el) {
    if (!el || el.dataset.splitted === "1") return;
    const text = el.textContent ?? "";
    const frag = document.createDocumentFragment();
    el.textContent = "";

    Array.from(text).forEach((ch) => {
      const span = document.createElement("span");
      span.className = "ed-char";
      // 空白は幅を保持
      span.innerHTML = ch === " " ? "&nbsp;" : ch;
      frag.appendChild(span);
    });

    el.appendChild(frag);
    el.dataset.splitted = "1";
  }

  // -----------------------------
  // Hero: タイトルを一文字ずつ表示
  // -----------------------------
  function heroIntro() {
    const title = qs("[data-split='chars']");
    if (!title) return;

    splitChars(title);
    const chars = qsa(".ed-char", title);

    if (prefersReduced) {
      gsap.set(chars, { opacity: 1, yPercent: 0 });
      return;
    }

    gsap.set(chars, { opacity: 0, yPercent: 110, rotate: 1.5, transformOrigin: "50% 100%" });
    gsap.to(chars, {
      opacity: 1,
      yPercent: 0,
      rotate: 0,
      duration: 1.15,
      ease: "power3.out",
      stagger: 0.03,
      delay: 0.08,
    });

    // Kinetic typography（スクロールで字間がふわっと締まる）
    gsap.to(title, {
      letterSpacing: "0.01em",
      ease: "none",
      scrollTrigger: {
        trigger: ".ed-cover",
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });
  }

  // -----------------------------
  // Hero: Parallax
  // -----------------------------
  function heroParallax() {
    const img = qs(".ed-cover__image");
    if (!img || prefersReduced) return;

    const speed = parseFloat(img.getAttribute("data-parallax") || "0.16");
    gsap.to(img, {
      yPercent: Math.max(6, Math.min(18, speed * 100)),
      ease: "none",
      scrollTrigger: {
        trigger: ".ed-cover",
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });
  }

  // -----------------------------
  // Counter: 店舗数
  // -----------------------------
  function shopCounter() {
    const counter = qs("#shopCounter");
    if (!counter) return;

    const target = parseInt(counter.getAttribute("data-target") || "0", 10);
    if (!Number.isFinite(target) || target <= 0) return;

    if (prefersReduced) {
      counter.textContent = target.toLocaleString();
      return;
    }

    const state = { v: 0 };
    ScrollTrigger.create({
      trigger: counter,
      start: "top 85%",
      once: true,
      onEnter: () => {
        gsap.to(state, {
          v: target,
          duration: 1.6,
          ease: "power2.out",
          onUpdate: () => {
            counter.textContent = Math.floor(state.v).toLocaleString();
          },
        });
      },
    });
  }

  // -----------------------------
  // Bento/Grid: reveal + image micro zoom
  // -----------------------------
  function gridReveal() {
    const cards = qsa(".mep-feature-card, .sooon-media-card, .p-areaFeature__item");
    if (!cards.length) return;

    cards.forEach((card) => {
      const img = card.querySelector("img");

      if (prefersReduced) {
        gsap.set(card, { opacity: 1, y: 0, skewY: 0 });
        if (img) gsap.set(img, { scale: 1 });
        return;
      }

      gsap.fromTo(
        card,
        { opacity: 0, y: 42, skewY: 3 },
        {
          opacity: 1,
          y: 0,
          skewY: 0,
          duration: 1.0,
          ease: "power3.out",
          scrollTrigger: {
            trigger: card,
            start: "top 88%",
            end: "top 60%",
            toggleActions: "play none none reverse",
          },
        }
      );

      if (img) {
        gsap.fromTo(
          img,
          { scale: 1.08 },
          {
            scale: 1,
            duration: 1.25,
            ease: "power3.out",
            scrollTrigger: {
              trigger: card,
              start: "top 88%",
              toggleActions: "play none none reverse",
            },
          }
        );
      }
    });
  }

  // -----------------------------
  // Init
  // -----------------------------
  function init() {
    root.classList.add("ed-js");
    heroIntro();
    heroParallax();
    shopCounter();
    gridReveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

