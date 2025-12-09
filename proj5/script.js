(() => {
  const scrollEl = document.scrollingElement || document.documentElement;

  initProgressBar(scrollEl);
  initMobileMenu();
  initCharSplit();
  initScrollStateClass();

  const skyCanvas = document.getElementById('sky');
  if (skyCanvas && skyCanvas.getContext) {
    initStarfield(skyCanvas, scrollEl);
  }


  // ------------------------------
  // Progress bar
  // ------------------------------
  function initProgressBar(scrollTarget) {
    const bar = document.querySelector('.progress .bar');
    if (!bar) return;

    function updateProgress() {
      const scrollTop = scrollTarget.scrollTop;
      const maxScroll = scrollTarget.scrollHeight - scrollTarget.clientHeight;
      const ratio = maxScroll > 0 ? scrollTop / maxScroll : 0;
      bar.style.width = (ratio * 100).toFixed(2) + '%';
    }

    let rafId = 0;
    window.addEventListener(
      'scroll',
      () => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          updateProgress();
        });
      },
      { passive: true }
    );

    updateProgress();
  }

  // ------------------------------
  // Mobile menu
  // ------------------------------
  function initMobileMenu() {
    const menuBtn = document.getElementById('menu-btn');
    const nav = document.getElementById('nav');
    if (!menuBtn || !nav) return;

    const toggle = () => {
      const open = !nav.classList.contains('open');
      nav.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
    };

    menuBtn.addEventListener('click', toggle);
    nav.addEventListener('click', event => {
      if (event.target.matches('a')) toggle();
    });
  }

  // ------------------------------
  // Character splitting for headings
  // ------------------------------
  function initCharSplit() {
    document.querySelectorAll('[data-split="chars"]').forEach(element => {
      const text = element.textContent || '';
      element.textContent = '';
      let i = 0;
      for (const ch of text) {
        const span = document.createElement('span');
        span.className = 'char';
        span.style.setProperty('--i', String(i++));
        span.textContent = ch;
        element.appendChild(span);
      }
    });
  }

  // ------------------------------
  // Scroll state helper
  // ------------------------------
  function initScrollStateClass() {
    let timerId;
    window.addEventListener(
      'scroll',
      () => {
        document.documentElement.classList.add('scrolling');
        clearTimeout(timerId);
        timerId = setTimeout(() => {
          document.documentElement.classList.remove('scrolling');
        }, 120);
      },
      { passive: true }
    );
  }

  // ------------------------------
  // Starfield
  // ------------------------------
  function initStarfield(canvas, scrollTarget) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const supportsMatchMedia = typeof window.matchMedia === 'function';

    const reducedMotion =
      supportsMatchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const isMobile =
      supportsMatchMedia &&
      window.matchMedia('(max-width: 640px), (pointer: coarse)').matches;

    const lowHW =
      (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

    const saveData = navigator.connection && navigator.connection.saveData;
    const lowPower = !!(isMobile || lowHW || saveData);

    const MAX_FPS = reducedMotion || lowPower ? 30 : 60;
    const FRAME_BUDGET = 1000 / MAX_FPS;
    const STAR_COUNT = lowPower ? 180 : 320;
    const METEOR_BASE_SPEED = lowPower ? 700 : 950;

    const state = {
      width: 0,
      height: 0,
      dpr: window.devicePixelRatio || 1,
      stars: [],
      meteors: [],
      lastTime: performance.now(),
      lastDraw: performance.now(),
      scrollY: scrollTarget.scrollTop,
      paused: document.hidden
    };

    class Star {
      constructor(width, height) {
        this.reset(width, height);
      }

      reset(width, height) {
        this.depth = Math.random(); // 0 far, 1 near
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.baseRadius = 0.5 + this.depth * 1.8;
        this.baseAlpha = 0.25 + this.depth * 0.5;
        this.twinkleAmp = 0.15 + Math.random() * 0.25;
        this.twinkleSpeed = 0.3 + Math.random() * 0.7;
        this.twinklePhase = Math.random() * Math.PI * 2;

        // Mostly cool hues, some warm
        const cool = Math.random() < 0.85;
        this.h = cool
          ? 210 + Math.random() * 40
          : 35 + Math.random() * 20;
        this.s = 18 + Math.random() * 40;
        this.l = 60 + this.depth * 20;
      }

      draw(ctx, time, scrollY, state) {
        const parallax = 0.02 + this.depth * 0.12;
        const drift = 0.004 + this.depth * 0.012;

        const offsetX = (time * drift * state.width) % state.width;
        const offsetY = -scrollY * parallax;

        let x = this.x + offsetX;
        let y = this.y + offsetY;

        // Wrap around edges
        x = (x + state.width) % state.width;
        y = (y + state.height) % state.height;

        const twinkle = Math.sin(time * this.twinkleSpeed + this.twinklePhase);
        const alpha = Math.max(0, this.baseAlpha + this.twinkleAmp * twinkle);
        const radius = this.baseRadius * state.dpr;

        ctx.beginPath();
        ctx.fillStyle = `hsla(${this.h}, ${this.s}%, ${this.l}%, ${alpha.toFixed(
          3
        )})`;
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    class Meteor {
      constructor(x, y, angle, speed, maxLifeMs, dpr) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 0;
        this.maxLife = maxLifeMs;
        this.length = 220 * dpr;
        this.h = 40 + Math.random() * 30;
        this.thickness = Math.max(1.5 * dpr, 2.0 * dpr);
      }

      step(dt) {
        this.life += dt * 1000;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
      }

      get alive() {
        return this.life < this.maxLife;
      }

      draw(ctx) {
        const t = this.life / this.maxLife;
        const alpha = 1 - t;
        if (alpha <= 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        const gradient = ctx.createLinearGradient(0, 0, -this.length, 0);
        gradient.addColorStop(
          0,
          `hsla(${this.h}, 70%, 98%, ${0.9 * alpha})`
        );
        gradient.addColorStop(1, `hsla(${this.h}, 80%, 60%, 0)`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = this.thickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-this.length, 0);
        ctx.stroke();

        ctx.restore();
      }
    }

    function buildStars() {
      state.stars = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        state.stars.push(new Star(state.width, state.height));
      }
    }

    function resize() {
      const cssWidth = window.innerWidth;
      const cssHeight = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5);

      state.dpr = dpr;
      state.width = Math.round(cssWidth * dpr);
      state.height = Math.round(cssHeight * dpr);

      canvas.width = state.width;
      canvas.height = state.height;
      canvas.style.width = cssWidth + 'px';
      canvas.style.height = cssHeight + 'px';

      buildStars();
    }

    let resizeRaf = 0;
    window.addEventListener('resize', () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resize();
        resizeRaf = 0;
      });
    });
    resize();

    window.addEventListener(
      'scroll',
      () => {
        state.scrollY = scrollTarget.scrollTop;
      },
      { passive: true }
    );

    window.addEventListener('pointerdown', event => {
      if (event.button && event.button !== 0) return;
      spawnMeteor(event.clientX, event.clientY);
    });

    function spawnMeteor(clientX, clientY) {
      const x = clientX * state.dpr;
      const y = clientY * state.dpr;

      const targetX =
        x < state.width / 2
          ? state.width + 200 * state.dpr
          : -200 * state.dpr;
      const targetY =
        y < state.height / 2
          ? state.height + 200 * state.dpr
          : -200 * state.dpr;

      const dx = targetX - x;
      const dy = targetY - y;
      const distance = Math.hypot(dx, dy) || 1;
      const angle = Math.atan2(dy, dx);

      const travelSeconds = distance / METEOR_BASE_SPEED;
      const lifeMs = travelSeconds * 1000 + 200;

      state.meteors.push(
        new Meteor(
          x,
          y,
          angle,
          METEOR_BASE_SPEED * state.dpr,
          lifeMs,
          state.dpr
        )
      );
    }

    function drawBackground() {
      const g = ctx.createLinearGradient(0, 0, 0, state.height);
      g.addColorStop(0, '#060a14');
      g.addColorStop(0.5, '#050812');
      g.addColorStop(1, '#020309');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, state.width, state.height);
    }

    function drawVignette() {
      const radiusInner = Math.min(state.width, state.height) * 0.2;
      const radiusOuter = Math.max(state.width, state.height) * 0.85;
      const vignette = ctx.createRadialGradient(
        state.width / 2,
        state.height / 2,
        radiusInner,
        state.width / 2,
        state.height / 2,
        radiusOuter
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, state.width, state.height);
    }

    function step(dt) {
      const time = performance.now() / 1000;

      for (const star of state.stars) {
        star.draw(ctx, time, state.scrollY, state);
      }

      for (const meteor of state.meteors) {
        meteor.step(dt);
        meteor.draw(ctx);
      }

      state.meteors = state.meteors.filter(m => m.alive);
    }

    function frame(now) {
      if (state.paused && !state.meteors.length) {
        state.lastTime = now;
        state.lastDraw = now;
        requestAnimationFrame(frame);
        return;
      }

      const deltaMs = now - state.lastTime;
      const dt = Math.min(deltaMs / 1000, 0.1);

      if (now - state.lastDraw >= FRAME_BUDGET) {
        ctx.clearRect(0, 0, state.width, state.height);
        drawBackground();
        step(dt);
        drawVignette();
        state.lastDraw = now;
      }

      state.lastTime = now;
      requestAnimationFrame(frame);
    }

    document.addEventListener('visibilitychange', () => {
      state.paused = document.hidden;
    });

    requestAnimationFrame(frame);
  }
  const beltTrackStates = [];

  document.querySelectorAll('.iteration-belt__track').forEach(track => {
    // Turn off any CSS animation so JS fully controls movement
    track.style.animation = 'none';

    // Only clone once
    if (track.dataset.cloned === 'true') return;
    track.dataset.cloned = 'true';

    const items = Array.from(track.children);
    items.forEach(item => {
      const clone = item.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true'); // don't double-announce
      track.appendChild(clone);
    });

    // One logical loop = width of original sequence
    const loopWidth = track.scrollWidth / 2;

    // Look up speed on the parent .iteration-belt (data-belt-speed)
    const belt = track.closest('.iteration-belt');
    let speed = 24; // default px/s

    if (belt && belt.dataset.beltSpeed) {
      const parsed = parseFloat(belt.dataset.beltSpeed);
      if (!Number.isNaN(parsed) && parsed > 0) {
        speed = parsed;
      }
    }

    beltTrackStates.push({
      track,
      loopWidth,
      x: 0,          // current offset in px
      v: speed,      // constant speed in px/s, from HTML or default
      running: true  // controlled by Pause buttons
    });
  });


  // 2) Hook up Pause/Play buttons per belt
  document.querySelectorAll('.iteration-belt').forEach(belt => {
    const toggle = belt.querySelector('.iteration-belt__toggle');
    if (!toggle) return;

    // Init label / state
    toggle.textContent = 'Pause';
    toggle.setAttribute('aria-pressed', 'false');

    toggle.addEventListener('click', () => {
      const pressed = toggle.getAttribute('aria-pressed') === 'true';
      const nowPressed = !pressed;          // true = user wants it paused
      toggle.setAttribute('aria-pressed', String(nowPressed));
      toggle.textContent = nowPressed ? 'Play' : 'Pause';

      const shouldRun = !nowPressed;

      // Flip running flag for all tracks inside this belt
      belt.querySelectorAll('.iteration-belt__track').forEach(track => {
        const state = beltTrackStates.find(s => s.track === track);
        if (state) state.running = shouldRun;
      });
    });
  });

  // 3) Global animation loop at constant speed
  let lastTime = performance.now();

  function step(now) {
    const dt = (now - lastTime) / 1000; // seconds
    lastTime = now;

    beltTrackStates.forEach(state => {
      if (!state.running) return;

      // x(t+dt) = x(t) + v * dt
      state.x += state.v * dt;

      // Wrap so we stay within [0, loopWidth)
      if (state.x >= state.loopWidth) {
        state.x -= state.loopWidth * Math.floor(state.x / state.loopWidth);
      }

      state.track.style.transform = `translateX(${-state.x}px)`;
    });

    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);

    // ------------------------------
  // Sync all GIFs inside iteration belts
  // ------------------------------
  function syncAllBeltGifs() {
    // Every GIF inside any belt track (original + cloned items)
    const gifs = document.querySelectorAll(
      '.iteration-belt__track img.iteration-belt__image[src$=".gif"]'
    );
    if (!gifs.length) return;

    // One shared timestamp so cache + restart time is identical
    const stamp = Date.now();

    gifs.forEach(img => {
      // Remember the base src (without any old query string)
      const base =
        (img.dataset.baseSrc || img.src).split('?')[0];

      img.dataset.baseSrc = base;
      // Setting src with the same cache-buster on all of them
      // forces them to restart from frame 0 together.
      img.src = `${base}?t=${stamp}`;
    });
  }

  // After all images + belts are ready, restart all GIFs in sync
  window.addEventListener('load', () => {
    syncAllBeltGifs();
  });

})();