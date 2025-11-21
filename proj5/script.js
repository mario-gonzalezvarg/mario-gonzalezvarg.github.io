// script.js



const canvas = document.getElementById("firefly-canvas");
const ctx = canvas.getContext("2d");

let width = 0;
let height = 0;
let dpr = window.devicePixelRatio || 1;

let fireflies = [];
let dustMotes = [];
let lastTime = 0;

// subtle "camera sway" to make the scene feel alive
let globalOffset = 0;
let globalSpeed = 5; // pixels per second

function resize() {
  dpr = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;

  canvas.width = width * dpr;
  canvas.height = height * dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* -------------------- Dust motes (background layer) -------------------- */

class DustMote {
  constructor(fromAnywhere = true) {
    this.reset(fromAnywhere);
  }

  reset(fromAnywhere = true) {
    this.x = Math.random() * width;
    if (fromAnywhere) {
      this.y = Math.random() * height;
    } else {
      // respawn near bottom, drift upward
      this.y = height + 20 + Math.random() * (height * 0.2);
    }

    this.radius = 0.4 + Math.random() * 0.9;
    this.speed = 4 + Math.random() * 12; // vertical speed
    this.horizontalDrift = (Math.random() - 0.5) * 6;

    this.alpha = 0.04 + Math.random() * 0.06;
    this.t = Math.random() * Math.PI * 2;
    this.swingAmp = 4 + Math.random() * 10;
  }

  update(dt) {
    this.t += dt;

    // very slow upward drift, like warm air carrying dust
    this.y -= this.speed * dt;

    // small horizontal sway
    this.x +=
      Math.sin(this.t * 0.6) * this.swingAmp * dt +
      (this.horizontalDrift * 0.12) * dt;

    // wrap horizontally
    const margin = 20;
    if (this.x < -margin) this.x = width + margin;
    if (this.x > width + margin) this.x = -margin;

    // if out of view at top, respawn at bottom
    if (this.y + this.radius < -20) {
      this.reset(false);
    }
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(240, 248, 255, ${this.alpha})`; // very subtle cool white
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* -------------------- Fireflies (main layer) -------------------- */

class Firefly {
  constructor(layerDepth) {
    this.depth = layerDepth; // 0.5 (far) .. 1.4 (near)
    this.reset(true);
  }

  reset(randomY = false) {
    this.x = Math.random() * width;

    const baseMin = height * 0.35;
    const baseMax = height * 0.95;
    this.y = randomY
      ? baseMin + Math.random() * (baseMax - baseMin)
      : baseMin +
        (Math.random() * 0.4 - 0.2) * (baseMax - baseMin);

    this.speed = (16 + Math.random() * 22) * this.depth;

    // movement steering
    this.direction = Math.random() * Math.PI * 2;
    this.targetDirection = this.direction;
    this.retargetTimer = 0;
    this.retargetEvery = 1.5 + Math.random() * 3.5;

    this.radius = (1.0 + Math.random() * 1.6) * (2 - this.depth);

    // flashing parameters (trains of flashes)
    this.flashPeriod = 3 + Math.random() * 5; // full cycle
    this.flashCount = 2 + Math.floor(Math.random() * 3); // 2–4 flashes per train
    this.flashDuration = 0.18 + Math.random() * 0.12;
    this.flashInterval = 0.28 + Math.random() * 0.14;
    this.t = Math.random() * this.flashPeriod;

    // hue around warm yellow-green
    this.hue = 50 + Math.random() * 15;
  }

  update(dt) {
    this.t += dt;

    // occasionally change where it wants to go
    this.retargetTimer += dt;
    if (this.retargetTimer > this.retargetEvery) {
      this.targetDirection += (Math.random() - 0.5) * Math.PI * 0.8;
      this.retargetEvery = 1.5 + Math.random() * 3.5;
      this.retargetTimer = 0;
    }

    // gently steer toward targetDirection
    const angleDiff = Math.atan2(
      Math.sin(this.targetDirection - this.direction),
      Math.cos(this.targetDirection - this.direction)
    );
    this.direction += angleDiff * 0.9 * dt;

    // bias to stay in a horizontal band
    const preferredBandCenter = height * 0.7;
    const bandStrength = (this.y - preferredBandCenter) / height;
    const verticalBias = -bandStrength * 0.3;

    const vx = Math.cos(this.direction) * this.speed;
    const vy = (Math.sin(this.direction) + verticalBias) * this.speed * 0.4;

    this.x += vx * dt;
    this.y += vy * dt;

    // soft horizontal wrap
    const margin = 60;
    if (this.x < -margin) this.x = width + margin;
    if (this.x > width + margin) this.x = -margin;

    // soft vertical constraint
    const minY = height * 0.25;
    const maxY = height * 0.98;
    if (this.y < minY) {
      this.y = minY + (minY - this.y) * 0.45;
      this.targetDirection += Math.PI * 0.4;
    }
    if (this.y > maxY) {
      this.y = maxY - (this.y - maxY) * 0.45;
      this.targetDirection -= Math.PI * 0.4;
    }

    // occasionally re-randomize flash pattern
    if (Math.random() < 0.0015) {
      this.flashPeriod = 3 + Math.random() * 5;
      this.flashCount = 2 + Math.floor(Math.random() * 3);
      this.flashDuration = 0.18 + Math.random() * 0.12;
      this.flashInterval = 0.28 + Math.random() * 0.14;
    }
  }

  brightness() {
    // trains of short flashes with long dark gaps
    const totalTrainTime =
      this.flashCount * (this.flashDuration + this.flashInterval);

    const phase = this.t % this.flashPeriod;

    if (phase > totalTrainTime) {
      // dark between trains
      return 0.05 * Math.random();
    }

    const perFlash = this.flashDuration + this.flashInterval;
    const flashIndex = Math.floor(phase / perFlash);
    const within = phase - flashIndex * perFlash;

    if (within > this.flashDuration) {
      // gap inside a train
      return 0.02 * Math.random();
    }

    // active flash: quick rise, slower decay
    const n = within / this.flashDuration; // 0..1
    const up = Math.min(1, n * 3.2);
    const down = Math.pow(1 - n, 1.6);
    const base = Math.min(up, down);

    return 0.6 + 0.4 * base;
  }

  draw(ctx) {
    const b = this.brightness();
    if (b <= 0.002) return;

    const coreRadius = this.radius;
    const glowRadius = coreRadius * 14 * this.depth;

    const x = this.x;
    const y = this.y;

    const alphaGlow = 0.5 * b;
    const alphaCore = 0.75 + 0.25 * b;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    gradient.addColorStop(0, `hsla(${this.hue}, 100%, 78%, ${alphaGlow})`);
    gradient.addColorStop(
      0.4,
      `hsla(${this.hue}, 100%, 64%, ${alphaGlow * 0.6})`
    );
    gradient.addColorStop(1, `hsla(${this.hue}, 100%, 50%, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(
      x - glowRadius,
      y - glowRadius,
      glowRadius * 2,
      glowRadius * 2
    );

    ctx.beginPath();
    ctx.fillStyle = `hsla(${this.hue}, 100%, 88%, ${alphaCore})`;
    ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* -------------------- Init helpers -------------------- */

function initDustMotes() {
  dustMotes = [];

  // slightly scale count with viewport area
  const baseCount = 40;
  const extra = Math.floor((width * height) / 150000);
  const count = baseCount + extra;

  for (let i = 0; i < count; i++) {
    dustMotes.push(new DustMote(true));
  }
}

function initFireflies() {
  fireflies = [];

  // far: more, dimmer; near: fewer, larger/brighter
  const layers = [
    { depth: 0.5, count: 28 },
    { depth: 0.9, count: 22 },
    { depth: 1.4, count: 14 },
  ];

  layers.forEach((layer) => {
    for (let i = 0; i < layer.count; i++) {
      fireflies.push(new Firefly(layer.depth));
    }
  });
}

/* -------------------- Main loop -------------------- */

function drawFrame(timestamp) {
  if (!lastTime) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  if (dt > 0.05) dt = 0.05;

  // slow sway
  globalOffset += globalSpeed * dt;
  if (globalOffset > 20 || globalOffset < -20) {
    globalSpeed *= -1;
  }

  ctx.save();
  ctx.translate(0, globalOffset * 0.03);

  // semi-transparent clear for trails
  ctx.fillStyle = "rgba(5, 7, 18, 0.35)";
  ctx.fillRect(0, 0, width, height);

  // background dust first
  for (const mote of dustMotes) {
    mote.update(dt);
    mote.draw(ctx);
  }

  // fireflies on top
  for (const f of fireflies) {
    f.update(dt);
    f.draw(ctx);
  }

  ctx.restore();

  requestAnimationFrame(drawFrame);
}

// setup
resize();
initDustMotes();
initFireflies();
requestAnimationFrame(drawFrame);

window.addEventListener("resize", () => {
  resize();
  initDustMotes();
  initFireflies();
});
