
// Project 5 Part A — script.js
// - Firefly background on #sky
// - Scroll progress bar in header
// - Mobile nav toggle
// - Hero title character animation
// - Reveal-on-scroll for content blocks

(function () {
  const doc = document;
  const root = doc.documentElement;

  function onReady(fn) {
    if (doc.readyState === "loading") {
      doc.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  // ------------------------------------------------------------
  // Firefly renderer on the #sky canvas
  // ------------------------------------------------------------

  function createStarfieldRenderer(ctx, opts = {}) {
    // Firefly-style "starfield" (southern night with fireflies)
    const TWO_PI = Math.PI * 2;
    const rand = (a, b) => Math.random() * (b - a) + a;

    let DPR = 1;
    let W = 0, H = 0;
    let t = 0;

    const fireflies = [];
    const mobile = !!opts.mobile;
    const reduceMotion = !!opts.reduceMotion;

    function baseGradient() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      // Deep blue overhead, warmer near the ground
      g.addColorStop(0.0, "#020516");
      g.addColorStop(0.4, "#020814");
      g.addColorStop(0.75, "#050710");
      g.addColorStop(1.0, "#120707"); // faint warm horizon
      return g;
    }

    function spawnFireflies() {
      fireflies.length = 0;
      const area = W * H;
      const baseCount = mobile ? 45 : 75;
      const density = area / (9000 * (mobile ? 1.3 : 1.0));
      const count = Math.max(25, Math.round(Math.min(baseCount * density / 80, 140)));

      for (let i = 0; i < count; i++) {
        const yBandTop = H * 0.45;
        const yBandBottom = H * 0.95;
        fireflies.push({
          x: rand(0, W),
          y: rand(yBandTop, yBandBottom),
          r: rand(1.2, 2.4),
          phase: rand(0, Math.PI * 2),
          speed: rand(0.3, 0.75),
          drift: rand(4, 10),
          hue: rand(68, 95),   // yellow-green
          sat: rand(70, 95),   // saturated glow
        });
      }
    }

    function resize(widthCss, heightCss, dprOverride) {
      W = widthCss;
      H = heightCss;
      DPR = dprOverride || window.devicePixelRatio || 1;

      ctx.canvas.width = Math.max(1, Math.floor(W * DPR));
      ctx.canvas.height = Math.max(1, Math.floor(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      spawnFireflies();
    }

    function drawFireflies(scrollCssPx) {
      const scrollFactor = scrollCssPx * 0.02;

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (let i = 0; i < fireflies.length; i++) {
        const f = fireflies[i];
        const localT = t * f.speed + f.phase;

        // horizontal drift + small sway with scroll
        const sway = Math.sin(localT * 0.9) * f.drift;
        const bob = Math.sin(localT * 0.7) * 3;
        const x = (f.x + sway + scrollFactor) % W;
        const y = f.y + bob;

        // twinkle factor
        const twinkle = 0.55 + 0.45 * Math.sin(localT * 1.3);
        const r = f.r * (mobile ? 1.1 : 1.6) * twinkle;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
        gradient.addColorStop(0.0, `hsla(${f.hue}, ${f.sat}%, 75%, 0.95)`);
        gradient.addColorStop(0.35, `hsla(${f.hue}, ${f.sat}%, 70%, 0.5)`);
        gradient.addColorStop(1.0, `hsla(${f.hue}, ${f.sat}%, 45%, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, r * 5, 0, TWO_PI);
        ctx.fill();
      }

      ctx.restore();
    }

    function step(dt, scrollCssPx) {
      t += reduceMotion ? 0 : dt;

      // background sky
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = baseGradient();
      ctx.fillRect(0, 0, W, H);

      // very subtle distant stars
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "rgba(230, 240, 255, 0.9)";
      const starCount = mobile ? 25 : 40;
      for (let i = 0; i < starCount; i++) {
        const sx = (i * 97 + Math.floor(t * 10)) % W;
        const sy = (i * 53) % Math.floor(H * 0.55);
        ctx.fillRect(sx, sy, 1, 1);
      }
      ctx.restore();

      // fireflies near the “ground”
      drawFireflies(scrollCssPx);
    }

    return { resize, step };
  }

  function initSky() {
    const canvas = doc.getElementById("sky");
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mobile = window.matchMedia("(max-width: 800px)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = createStarfieldRenderer(ctx, { mobile, reduceMotion });

    function doResize() {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || window.innerWidth || 1;
      const height = rect.height || window.innerHeight || 1;
      renderer.resize(width, height);
    }

    window.addEventListener("resize", doResize);
    doResize();

    let lastTime = null;
    function loop(now) {
      if (lastTime == null) lastTime = now;
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const scrollY = root.scrollTop || window.scrollY || 0;
      renderer.step(dt, scrollY);

      window.requestAnimationFrame(loop);
    }

    window.requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------
  // Scroll progress bar
  // ------------------------------------------------------------

  function initScrollProgress() {
    const bar = doc.querySelector(".progress .bar");
    if (!bar) return;

    function update() {
      const scrollTop = root.scrollTop || doc.body.scrollTop || 0;
      const scrollHeight = root.scrollHeight || doc.body.scrollHeight || 1;
      const clientHeight = root.clientHeight || window.innerHeight || 1;
      const max = Math.max(scrollHeight - clientHeight, 1);
      const ratio = Math.min(Math.max(scrollTop / max, 0), 1);
      bar.style.transform = `scaleX(${ratio})`;
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  // ------------------------------------------------------------
  // Mark scrolling state to adjust header blur
  // ------------------------------------------------------------

  function initScrollingState() {
    let scrollTimer = null;

    function onScroll() {
      root.classList.add("scrolling");
      if (scrollTimer !== null) {
        window.clearTimeout(scrollTimer);
      }
      scrollTimer = window.setTimeout(() => {
        root.classList.remove("scrolling");
        scrollTimer = null;
      }, 150);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // ------------------------------------------------------------
  // Mobile nav toggle
  // ------------------------------------------------------------

  function initNavToggle() {
    const menuBtn = doc.getElementById("menu-btn");
    const nav = doc.querySelector(".nav");
    if (!menuBtn || !nav) return;

    function setOpen(open) {
      nav.classList.toggle("open", open);
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }

    menuBtn.addEventListener("click", () => {
      const isOpen = nav.classList.contains("open");
      setOpen(!isOpen);
    });

    nav.addEventListener("click", (evt) => {
      if (evt.target instanceof HTMLElement && evt.target.tagName === "A") {
        setOpen(false);
      }
    });
  }

  // ------------------------------------------------------------
  // Split hero title into animated characters
  // ------------------------------------------------------------

  function initSplitChars() {
    const splitTargets = doc.querySelectorAll("[data-split='chars']");
    splitTargets.forEach((el) => {
      const text = el.textContent || "";
      el.textContent = "";
      const frag = doc.createDocumentFragment();
      Array.from(text).forEach((ch, idx) => {
        const span = doc.createElement("span");
        span.className = "char";
        span.style.setProperty("--i", String(idx));
        span.textContent = ch;
        frag.appendChild(span);
      });
      el.appendChild(frag);
    });
  }

  // ------------------------------------------------------------
  // Reveal-on-scroll for content blocks
  // ------------------------------------------------------------

  function initRevealOnScroll() {
    const revealEls = Array.from(doc.querySelectorAll("[data-reveal]"));
    const lineEls = Array.from(doc.querySelectorAll("[data-reveal-line]"));

    if (!revealEls.length && !lineEls.length) return;

    const obsOptions = {
      root: null,
      rootMargin: "0px 0px -20% 0px",
      threshold: 0.1,
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const target = entry.target;
        if (target.hasAttribute("data-reveal")) {
          target.classList.add("in");
        }
        if (target.hasAttribute("data-reveal-line")) {
          target.classList.add("in");
        }
        observer.unobserve(target);
      }
    }, obsOptions);

    revealEls.forEach((el) => observer.observe(el));
    lineEls.forEach((el) => observer.observe(el));
  }

  // ------------------------------------------------------------
  // Init all
  // ------------------------------------------------------------

  onReady(() => {
    initSky();
    initScrollProgress();
    initScrollingState();
    initNavToggle();
    initSplitChars();
    initRevealOnScroll();
  });
})();
