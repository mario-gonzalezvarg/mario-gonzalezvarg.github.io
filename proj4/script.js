
(() => {
  // ---------- Basic UI ----------
  const canvas  = document.getElementById('sky');
  const ctx     = canvas.getContext('2d', { alpha: true });
  const bar     = document.querySelector('.progress .bar');
  const menuBtn = document.getElementById('menu-btn');
  const nav     = document.getElementById('nav');
  const scrollEl = document.scrollingElement || document.documentElement;

  // Progress bar (rAF-throttled)
  function updateProgressNow() {
    const st = scrollEl.scrollTop;
    const h  = scrollEl.scrollHeight - scrollEl.clientHeight;
    if (bar) bar.style.width = (h > 0 ? (st / h) * 100 : 0).toFixed(2) + '%';
  }
  let progRAF = 0;
  addEventListener('scroll', () => {
    if (progRAF) return;
    progRAF = requestAnimationFrame(() => { updateProgressNow(); progRAF = 0; });
  }, { passive: true });
  updateProgressNow();

  // Mobile menu
  if (menuBtn && nav) {
    const toggle = () => {
      const open = !nav.classList.contains('open');
      nav.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
    };
    menuBtn.addEventListener('click', toggle);
    nav.addEventListener('click', e => { if (e.target.matches('a')) toggle(); });
  }

  // Split headings into characters (optional)
  document.querySelectorAll('[data-split="chars"]').forEach(el => {
    const t = el.textContent; el.textContent = '';
    let i = 0;
    for (const ch of t) {
      const s = document.createElement('span');
      s.className = 'char';
      s.style.setProperty('--i', i++);
      s.textContent = ch;
      el.appendChild(s);
    }
  });

  // Add/remove a class while actively scrolling (lets CSS disable heavy effects)
  let scrollTimer;
  addEventListener('scroll', () => {
    document.documentElement.classList.add('scrolling');
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => document.documentElement.classList.remove('scrolling'), 120);
  }, { passive: true });

  // ---------- Device profile ----------
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile      = matchMedia('(max-width: 640px), (pointer: coarse)').matches;
  const lowHW        = (navigator.deviceMemory && navigator.deviceMemory <= 4)
                    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const saveData     = navigator.connection?.saveData;
  const MOBILE_LOW   = !!(isMobile || lowHW || saveData);

  // ---------- Starfield core ----------
  function createStarfieldRenderer(ctx, opts = {}) {
    const TWO = Math.PI * 2;
    const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
    const rand  = (a,b)=>Math.random()*(b-a)+a;
    const pickHue = () => Math.random() < 0.85 ? rand(210,258) : rand(35,55);
    const pickSat = () => rand(12,42);

    const mobile = !!opts.mobile;
    const reduce = !!opts.reduceMotion;

    const CFG = {
      dprMax:   mobile ? .75    : 1,
      parallax: { far: mobile ? 0.008 : 0.015, mid: mobile ? 0.12 : 0.16, near: mobile ? 0.60 : 0.64},
      twinkle:  { mid: mobile ? 0.10  : 0.20,  near: mobile ? 0.15 : 0.30 },
      jwstRatio: mobile ? 0.06 : 0.10,
      tile:     { dust: mobile ? 512 : 640, mid: mobile ? 768 : 1024, near: 48},
      perMP:    { mid:  mobile ? 90  : 180,  near: mobile ? 40 : 90},
      dustPerTile: mobile ? 1100 : 2400,
      driftX:   mobile ? 0.002 : 0.009,
      useGrain: !mobile
    };

    let DPR = 1, W = 0, H = 0, t = 0;
    let dustPat = null, dustW = 0, dustH = 0;
    let MID = null, NEAR = null;
    let GRAIN = null, grainW = 0, grainH = 0;

    function makeTile(px) {
      const w = Math.round(px * DPR), h = Math.round(px * DPR);
      // Prefer OffscreenCanvas when available (even on main thread) to avoid DOM overhead
      if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
      const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
    }

    function softStar(dc, x, y, r, h, s, a) {
      const g = dc.createRadialGradient(x,y,0,x,y,r*3);
      g.addColorStop(0, `hsla(${h},${s}%,96%,${a})`);
      g.addColorStop(0.5,`hsla(${h},${s}%,78%,${a*0.75})`);
      g.addColorStop(1, `rgba(255,255,255,0)`);
      dc.fillStyle = g; dc.beginPath(); dc.arc(x,y,r*3,0,TWO); dc.fill();
    }
    function jwstStar(dc, x, y, r, h, s, a, rot) {
      softStar(dc, x, y, r*1.2, h, s+10, a);
      const len = r*10, thick = Math.max(1*DPR, Math.min(2.6*DPR, r*0.55));
      dc.save(); dc.translate(x,y); dc.rotate(rot);
      for (let k=0;k<3;k++){
        const g1 = dc.createLinearGradient(0,0,len,0);
        g1.addColorStop(0,`hsla(${h},70%,95%,${a*0.85})`);
        g1.addColorStop(1,`hsla(${h},70%,70%,0)`);
        dc.strokeStyle=g1; dc.lineWidth=thick; dc.lineCap='round';
        dc.beginPath(); dc.moveTo(0,0); dc.lineTo(len,0); dc.stroke();

        const g2 = dc.createLinearGradient(0,0,-len,0);
        g2.addColorStop(0,`hsla(${h},70%,95%,${a*0.85})`);
        g2.addColorStop(1,`hsla(${h},70%,70%,0)`);
        dc.strokeStyle=g2; dc.beginPath(); dc.moveTo(0,0); dc.lineTo(-len,0); dc.stroke();
        dc.rotate(Math.PI/3);
      }
      dc.restore();
    }

    function buildDust() {
      const c = makeTile(CFG.tile.dust), d = c.getContext('2d');
      d.clearRect(0,0,c.width,c.height);
      for (let i=0;i<CFG.dustPerTile;i++){
        const x = Math.random()*c.width, y = Math.random()*c.height;
        const r = (Math.random()<0.9?rand(0.25,0.55):rand(0.55,1.1))*DPR;
        const a = rand(0.04,0.22), h = pickHue(), s = rand(8,22);
        const g = d.createRadialGradient(x,y,0,x,y,r*3);
        g.addColorStop(0,`hsla(${h},${s}%,92%,${a})`);
        g.addColorStop(1,`rgba(255,255,255,0)`);
        d.fillStyle=g; d.beginPath(); d.arc(x,y,r*3,0,Math.PI*2); d.fill();
      }
      dustPat = ctx.createPattern(c, 'repeat'); dustW = c.width; dustH = c.height;
    }

    function buildLayer(name) {
      const size = CFG.tile[name];
      const c0 = makeTile(size), c1 = makeTile(size), c2 = makeTile(size);
      const d0 = c0.getContext('2d'), d1 = c1.getContext('2d'), d2 = c2.getContext('2d');

      const mp = (c0.width/DPR)*(c0.height/DPR)/1e6;
      const count = Math.round(CFG.perMP[name] * mp);

      for (let i=0;i<count;i++){
        const x = Math.random()*c0.width, y = Math.random()*c0.height;
        const hue = pickHue(), sat = pickSat();
        const jwst = Math.random() < CFG.jwstRatio;
        const r = (name==='near' ? rand(1.1,3.6) : rand(0.8,2.4)) * DPR;
        const base = rand(0.25,0.9), amp = (name==='near'?rand(0.06,0.28):rand(0.04,0.18));
        const phi = Math.random()*Math.PI*2, rot = Math.random()*Math.PI*2;

        const a0 = clamp(base + amp*Math.cos(phi + 0*2*Math.PI/3), 0, 1);
        const a1 = clamp(base + amp*Math.cos(phi + 1*2*Math.PI/3), 0, 1);
        const a2 = clamp(base + amp*Math.cos(phi + 2*2*Math.PI/3), 0, 1);

        if (jwst){ jwstStar(d0,x,y,r,hue,sat,a0,rot); jwstStar(d1,x,y,r,hue,sat,a1,rot); jwstStar(d2,x,y,r,hue,sat,a2,rot); }
        else     { softStar(d0,x,y,r,hue,sat,a0);      softStar(d1,x,y,r,hue,sat,a1);      softStar(d2,x,y,r,hue,sat,a2); }
      }
      return {
        frames: [ctx.createPattern(c0,'repeat'), ctx.createPattern(c1,'repeat'), ctx.createPattern(c2,'repeat')],
        w: c0.width, h: c0.height
      };
    }

    function buildGrain() {
      if (!CFG.useGrain) { GRAIN = null; return; }
      const c = makeTile(256), d = c.getContext('2d');
      const img = d.createImageData(c.width, c.height);
      for (let i=0;i<img.data.length;i+=4){
        const n = (Math.random()*255)|0;
        img.data[i] = img.data[i+1] = img.data[i+2] = n;
        img.data[i+3] = 24;
      }
      d.putImageData(img, 0, 0);
      GRAIN = ctx.createPattern(c, 'repeat'); grainW = c.width; grainH = c.height;
    }

    function buildAll(){ buildDust(); MID = buildLayer('mid'); NEAR = buildLayer('near'); buildGrain(); }

    function drawLayer(L, parallax, twinkleSpeed, timeSec, scrollCssPx) {
      const scrollPx = scrollCssPx * DPR;
      const offY = Math.round(-scrollPx * parallax);
      const offX = Math.round((timeSec * CFG.driftX * (W/DPR)) * DPR);

      // 3-frame twinkle blend
      const ang = timeSec * 2*Math.PI * twinkleSpeed;
      let w0 = Math.max(0, Math.sin(ang) + 1);
      let w1 = Math.max(0, Math.sin(ang + 2*Math.PI/3) + 1);
      let w2 = Math.max(0, Math.sin(ang + 4*Math.PI/3) + 1);
      const sum = w0 + w1 + w2 || 1; w0/=sum; w1/=sum; w2/=sum;

      ctx.save();
      ctx.translate(offX % L.w, offY % L.h);
      ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=w0; ctx.fillStyle=L.frames[0]; ctx.fillRect(-L.w,-L.h, W+L.w*2, H+L.h*2);
      ctx.globalAlpha=w1; ctx.fillStyle=L.frames[1]; ctx.fillRect(-L.w,-L.h, W+L.w*2, H+L.h*2);
      ctx.globalAlpha=w2; ctx.fillStyle=L.frames[2]; ctx.fillRect(-L.w,-L.h, W+L.w*2, H+L.h*2);
      ctx.restore();
      ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
    }

    class Meteor{
      constructor(x,y,a,speed,len,lifeMs,hue){
        this.x=x; this.y=y; this.a=a;
        this.vx=Math.cos(a)*speed; this.vy=Math.sin(a)*speed;
        this.len=len; this.h=hue; this.life=0; this.max=lifeMs;
        this.thick=Math.max(1*DPR,1.6*DPR); this.alive=true;
      }
      step(dt){ this.x+=this.vx*dt; this.y+=this.vy*dt; this.life+=dt*1000; if(this.life>this.max) this.alive=false; }
      draw(){
        const alpha = 1 - (this.life/this.max);
        ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.a);
        const g = ctx.createLinearGradient(0,0,-this.len,0);
        g.addColorStop(0,`hsla(${this.h},60%,95%,${0.85*alpha})`);
        g.addColorStop(1,`hsla(${this.h},80%,60%,0)`);
        ctx.strokeStyle=g; ctx.lineWidth=this.thick; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-this.len,0); ctx.stroke();
        ctx.restore();
      }
    }
    let meteors = [];

    function baseGradient(){
      const g = ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'#060a14'); g.addColorStop(0.5,'#050812'); g.addColorStop(1,'#03050a');
      return g;
    }

    function step(dt, scrollCssPx) {
      t += reduce ? 0 : dt;

      // background
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle = baseGradient(); ctx.fillRect(0,0,W,H);

      // Far dust
      if (dustPat){
        const scrollPx = scrollCssPx * DPR;
        const offY = Math.round(-scrollPx * CFG.parallax.far);
        const offX = Math.round((t * CFG.driftX * (W/DPR)) * DPR);
        ctx.save(); ctx.translate(offX % dustW, offY % dustH);
        ctx.fillStyle = dustPat; ctx.fillRect(-dustW,-dustH, W+dustW*2, H+dustH*2);
        ctx.restore();
      }

      // Star layers
      drawLayer(MID,  CFG.parallax.mid,  CFG.twinkle.mid,  t, scrollCssPx);
      drawLayer(NEAR, CFG.parallax.near, CFG.twinkle.near, t, scrollCssPx);

      // Meteors (user-triggered)
      for (const m of meteors){ m.step(dt); m.draw(); }
      meteors = meteors.filter(m => m.alive);

      // Vignette
      const vg = ctx.createRadialGradient(W/2,H/2, Math.min(W,H)*0.1, W/2,H/2, Math.max(W,H)*0.8);
      vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.35)');
      ctx.fillStyle = vg; ctx.fillRect(0,0,W,H);

      // Grain (desktop only)
      if (CFG.useGrain && GRAIN){
        ctx.globalCompositeOperation='soft-light'; ctx.globalAlpha=0.12;
        ctx.fillStyle=GRAIN; ctx.fillRect(-grainW,-grainH, W+grainW*2, H+grainH*2);
        ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
      }
    }

    function resize(cssW, cssH, dpr){
      DPR = Math.min(CFG.dprMax, dpr || 1);
      ctx.canvas.width  = Math.round(cssW * DPR);
      ctx.canvas.height = Math.round(cssH * DPR);
      W = ctx.canvas.width; H = ctx.canvas.height;
      buildAll();
    }

    function spawnMeteorCss(cx, cy){
      const x = cx * DPR, y = cy * DPR;
      const targetX = (x < W/2) ? (W + 200) : (-200);
      const targetY = (y < H/2) ? (H + 200) : (-200);
      const dx = targetX-x, dy = targetY-y;
      const dist = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const time = 0.9; // seconds
      const speed = dist / time;
      const len = Math.min(0.35 * dist, 320*DPR);
      const lifeMs = (time*1000) + 200;
      meteors.push(new Meteor(x,y,ang,speed,len,lifeMs,pickHue()));
    }

    return { resize, step, spawnMeteorCss };
  }

  // ---------- Bootstrap ----------
  const renderer = createStarfieldRenderer(ctx, {
    reduceMotion: reducedMotion,
    mobile: MOBILE_LOW
  });

  function resize() {
    renderer.resize(innerWidth, innerHeight, devicePixelRatio);
    canvas.style.width  = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
  }
  addEventListener('resize', resize);
  resize();

  let scrollY = scrollEl.scrollTop;
  addEventListener('scroll', () => { scrollY = scrollEl.scrollTop; }, { passive: true });
  addEventListener('pointerdown', e => renderer.spawnMeteorCss(e.clientX, e.clientY));

  // Animation loop with FPS cap on mobile/low devices
  let last = performance.now();
  let lastDraw = last;
  const frameBudget = MOBILE_LOW ? (1000/30) : (1000/60);
  let paused = document.hidden;

  document.addEventListener('visibilitychange', () => {
    paused = document.hidden;
    if (!paused) { last = lastDraw = performance.now(); requestAnimationFrame(frame); }
  });

  function frame(now){
    if (paused) { return; }
    const dt = Math.min((now - last)/1000, MOBILE_LOW ? 0.05 : 0.09);
    if (now - lastDraw >= frameBudget) {
      renderer.step(dt, scrollY);    // snap to scroll; no easing
      lastDraw = now;
    }
    last = now;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
