/* ─────────────────────────────────────────────────────────────
   01 · NEON JOUST — live physics preview.

   This is NOT the game. It is an ambient reproduction of the
   game's three rules, so the section shows the thing it describes:
     1. perpetual energy walls (restitution 1.0, zero friction)
     2. damage injects momentum
     3. lance clash -> hit-stop -> bounce apart + spin inversion

   Constants are taken from the real build.
   ───────────────────────────────────────────────────────────── */

const MAX_SPEED = 12;
const BASE_SPEED = 3.6;
const ANG_SPEED = 0.075;
const WEAPON_LEN = 82;
const BALL_R = 24;
const DMG = 12;
const HITSTOP_MIN = 4, HITSTOP_MAX = 6;

export function initJoust({ reduced }) {
  const canvas = document.getElementById('jo-canvas');
  const toggle = document.getElementById('jo-toggle');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // The hit flash is the one thing worth letting out of the canvas: the
  // cabinet around the arena lights with it. Quantised to tenths so a
  // decaying flash is a handful of style writes, not one per frame.
  const arena = canvas.closest('.jo-arena');
  let litAt = -1;
  function spill() {
    if (!arena) return;
    const q = Math.round(Math.min(1, Math.max(0, flash)) * 10) / 10;
    if (q === litAt) return;
    litAt = q;
    arena.style.setProperty('--clash', String(q));
  }

  let balls, particles, hitStop, clashCooldown, flash;

  function makeBall(x, y, dir, color) {
    return {
      x, y,
      vx: Math.cos(dir) * BASE_SPEED,
      vy: Math.sin(dir) * BASE_SPEED,
      ang: dir,
      angVel: ANG_SPEED * (Math.random() < 0.5 ? 1 : -1),
      hp: 100,
      color,
      trail: [],
    };
  }

  function reset() {
    balls = [
      makeBall(W * 0.26, H * 0.5, -0.6, '#5fa8ff'),
      makeBall(W * 0.74, H * 0.5, Math.PI + 0.6, '#ff5f7a'),
    ];
    particles = [];
    hitStop = 0;
    clashCooldown = 0;
    flash = 0;
  }
  reset();

  const tip = (b) => ({
    x: b.x + Math.cos(b.ang) * WEAPON_LEN,
    y: b.y + Math.sin(b.ang) * WEAPON_LEN,
  });

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 5;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color });
    }
  }

  function step() {
    if (hitStop > 0) { hitStop--; return; }
    if (clashCooldown > 0) clashCooldown--;
    if (flash > 0) flash *= 0.84;

    for (const b of balls) {
      b.x += b.vx;
      b.y += b.vy;
      b.ang += b.angVel;

      // Rule 1 — perpetual energy walls. Reflect, never damp.
      if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); }
      if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); }
      if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); }
      if (b.y > H - BALL_R) { b.y = H - BALL_R; b.vy = -Math.abs(b.vy); }

      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 16) b.trail.shift();
    }

    const [a, c] = balls;
    const ta = tip(a), tc = tip(c);

    // Rule 3 — lance on lance.
    const dtx = ta.x - tc.x, dty = ta.y - tc.y;
    if (clashCooldown === 0 && dtx * dtx + dty * dty < 26 * 26) {
      hitStop = HITSTOP_MIN + Math.floor(Math.random() * (HITSTOP_MAX - HITSTOP_MIN + 1));
      clashCooldown = 22;
      flash = 1;

      a.angVel *= -1;
      c.angVel *= -1;

      let nx = a.x - c.x, ny = a.y - c.y;
      const d = Math.hypot(nx, ny) || 1;
      nx /= d; ny /= d;
      const push = 2.1;
      a.vx += nx * push; a.vy += ny * push;
      c.vx -= nx * push; c.vy -= ny * push;

      burst((ta.x + tc.x) / 2, (ta.y + tc.y) / 2, '#ffffff', 22);
    }

    // Rule 2 — a lance in a body injects momentum into the victim.
    hit(a, c, tip(a));
    hit(c, a, tip(c));

    // Bodies never overlap.
    let nx = a.x - c.x, ny = a.y - c.y;
    const d = Math.hypot(nx, ny) || 1;
    if (d < BALL_R * 2) {
      nx /= d; ny /= d;
      const o = (BALL_R * 2 - d) / 2;
      a.x += nx * o; a.y += ny * o;
      c.x -= nx * o; c.y -= ny * o;
      const rvx = a.vx - c.vx, rvy = a.vy - c.vy;
      const dot = rvx * nx + rvy * ny;
      if (dot < 0) {
        a.vx -= dot * nx; a.vy -= dot * ny;
        c.vx += dot * nx; c.vy += dot * ny;
      }
    }

    for (const b of balls) {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > MAX_SPEED) { b.vx = (b.vx / sp) * MAX_SPEED; b.vy = (b.vy / sp) * MAX_SPEED; }
      if (sp < BASE_SPEED * 0.6) { const k = (BASE_SPEED * 0.6) / (sp || 1); b.vx *= k; b.vy *= k; }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.94; p.vy *= 0.94;
      p.life -= 0.035;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (balls.some((b) => b.hp <= 0)) {
      burst(W / 2, H / 2, '#ffffff', 40);
      setTimeout(reset, 520);
      balls.forEach((b) => { b.hp = 100; });
    }
  }

  function hit(attacker, victim, t) {
    if (clashCooldown > 0) return;
    const dx = t.x - victim.x, dy = t.y - victim.y;
    if (dx * dx + dy * dy > BALL_R * BALL_R) return;

    victim.hp -= DMG;
    clashCooldown = 18;
    flash = 0.7;

    // Damage boosts the victim's velocity — the losing fighter is the fastest.
    const d = Math.hypot(dx, dy) || 1;
    victim.vx += (dx / d) * 2.6;
    victim.vy += (dy / d) * 2.6;
    attacker.angVel *= -1;

    burst(t.x, t.y, victim.color, 16);
  }

  function draw() {
    spill();
    ctx.clearRect(0, 0, W, H);

    if (flash > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.1})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(95,168,255,0.10)';
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    for (const b of balls) {
      // trail
      ctx.lineWidth = 2;
      for (let i = 1; i < b.trail.length; i++) {
        ctx.globalAlpha = (i / b.trail.length) * 0.28;
        ctx.strokeStyle = b.color;
        ctx.beginPath();
        ctx.moveTo(b.trail[i - 1].x, b.trail[i - 1].y);
        ctx.lineTo(b.trail[i].x, b.trail[i].y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // body
      ctx.save();
      ctx.shadowBlur = 26;
      ctx.shadowColor = b.color;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      ctx.stroke();

      // hp as an arc around the body
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_R + 7, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * b.hp) / 100);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // lance
      const t = tip(b);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(b.x + Math.cos(b.ang) * BALL_R, b.y + Math.sin(b.ang) * BALL_R);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  /* ── run loop: only while on screen, and only when not paused ── */

  let running = false, onScreen = false, wanted = !reduced, raf = 0;

  function frame() {
    if (!running) return;
    step();
    draw();
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    const should = wanted && onScreen;
    if (should === running) return;
    running = should;
    if (running) { raf = requestAnimationFrame(frame); return; }
    cancelAnimationFrame(raf);
    // A paused arena must not be left glowing from its last clash.
    flash = 0;
    spill();
  }

  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); },
    { threshold: 0.05 }).observe(canvas);

  toggle?.addEventListener('click', () => {
    wanted = !wanted;
    toggle.textContent = wanted ? 'pause' : 'play';
    toggle.setAttribute('aria-pressed', String(wanted));
    sync();
  });

  if (reduced) {
    wanted = false;
    if (toggle) { toggle.textContent = 'play'; toggle.setAttribute('aria-pressed', 'false'); }
  }

  draw(); // paint one frame immediately so the arena is never blank
}
