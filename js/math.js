/* ─────────────────────────────────────────────────────────────
   04 · MATH — the section is empty; this is the prototype of what
   it will be made of.

   Symbols behave like loose chalk pieces on a slate:
     · drag and release  -> thrown, carrying the pointer's momentum
     · alt-drag / dblclick on a free symbol -> copied
     · two symbols left touching at rest -> welded into an expression
     · dblclick a welded symbol -> broken back out

   Motion is frictional and weightless rather than gravitational:
   an expression that has been assembled should stay where it was
   put, which is how working on a board actually feels.
   ───────────────────────────────────────────────────────────── */

const START = [
  { ch: '∑', kind: '' },
  { ch: '∫', kind: '' },
  { ch: '√', kind: '' },
  { ch: 'π', kind: '' },
  { ch: '∞', kind: '' },
  { ch: 'θ', kind: '' },
  { ch: 'x', kind: '' },
  { ch: 'n', kind: '' },
  { ch: '+', kind: 'op' },
  { ch: '−', kind: 'op' },
  { ch: '×', kind: 'op' },
  { ch: '=', kind: 'op' },
  { ch: '≤', kind: 'op' },
  { ch: '2', kind: 'num' },
  { ch: '7', kind: 'num' },
];

const DRAG = 0.972;        // per-frame velocity retention
const BOUNCE = 0.52;       // wall restitution
const SNAP_GAP = 3;        // px left between welded glyphs
const SNAP_DIST = 20;      // px of horizontal reach for a weld
const SNAP_SPEED = 0.9;    // both bodies must be slower than this
const MAX_SYMS = 40;

export function initMath({ reduced }) {
  const board = document.getElementById('ma-board');
  const readout = document.getElementById('ma-read');
  const resetBtn = document.getElementById('ma-reset');
  if (!board) return;

  /** @type {{el:HTMLElement,x:number,y:number,w:number,h:number,gid:number,ch:string}[]} */
  let syms = [];
  /** @type {Map<number,{vx:number,vy:number}>} */
  const bodies = new Map();
  let nextGid = 1;
  let W = 0, H = 0;

  const measure = () => { const r = board.getBoundingClientRect(); W = r.width; H = r.height; };
  measure();

  /* ───────────────  creating symbols  ─────────────── */

  function spawn(ch, kind, x, y, pop = false) {
    if (syms.length >= MAX_SYMS) return null;
    const el = document.createElement('div');
    el.className = `ma-sym ${kind}`.trim();
    el.textContent = ch;
    if (pop) el.classList.add('pop');
    board.appendChild(el);

    const s = { el, x, y, w: el.offsetWidth, h: el.offsetHeight, gid: nextGid++, ch };
    bodies.set(s.gid, { vx: 0, vy: 0 });
    syms.push(s);
    place(s);
    return s;
  }

  const place = (s) => { s.el.style.transform = `translate(${s.x}px, ${s.y}px)`; };

  function build() {
    syms.forEach((s) => s.el.remove());
    syms = [];
    bodies.clear();
    measure();

    // Laid out along the lower third like chalk left on the ledge.
    const cols = Math.min(START.length, Math.max(5, Math.floor(W / 78)));
    const rows = Math.ceil(START.length / cols);
    const padX = 34, padY = 26;
    const cellW = (W - padX * 2) / cols;

    START.forEach((d, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const x = padX + c * cellW + cellW * 0.5 - 23 + (Math.random() * 14 - 7);
      const y = H - padY - (rows - r) * 62 + (Math.random() * 10 - 5);
      spawn(d.ch, d.kind, Math.max(4, Math.min(W - 54, x)), Math.max(56, Math.min(H - 58, y)));
    });
    render();
  }

  /**
   * The board writes itself the first time you reach it: each piece
   * arrives dusty and out of focus, and with enough momentum left in it
   * to slide a little before settling. The same thing happens on reset,
   * because putting the chalk back is also an act.
   */
  function toss() {
    syms.forEach((s, i) => {
      s.el.style.animationDelay = `${i * 36}ms`;
      s.el.classList.add('chalk-in');
      const v = bodies.get(s.gid);
      if (!v) return;
      v.vx = (Math.random() - 0.5) * 5.5;
      v.vy = -1.4 - Math.random() * 2.6;
    });
  }

  /* ───────────────  groups  ─────────────── */

  const members = (gid) => syms.filter((s) => s.gid === gid);

  function mergeGroups(keep, drop) {
    if (keep === drop) return;
    const a = bodies.get(keep), b = bodies.get(drop);
    members(drop).forEach((s) => { s.gid = keep; });
    if (a && b) { a.vx = (a.vx + b.vx) / 2; a.vy = (a.vy + b.vy) / 2; }
    bodies.delete(drop);
    members(keep).forEach((s) => {
      s.el.classList.add('welded');
      s.el.classList.remove('fused');
      void s.el.offsetWidth;          // replay the flare on every new weld
      s.el.classList.add('fused');
    });
  }

  function detach(s) {
    const old = s.gid;
    s.gid = nextGid++;
    bodies.set(s.gid, { vx: (Math.random() - 0.5) * 5, vy: -2 - Math.random() * 2 });
    s.el.classList.remove('welded', 'fused');
    const rest = members(old);
    if (rest.length < 2) rest.forEach((o) => o.el.classList.remove('welded'));
  }

  /* ───────────────  physics  ─────────────── */

  function translateGroup(gid, dx, dy) {
    for (const s of members(gid)) { s.x += dx; s.y += dy; place(s); }
  }

  function groupBox(gid) {
    const m = members(gid);
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const s of m) {
      l = Math.min(l, s.x); t = Math.min(t, s.y);
      r = Math.max(r, s.x + s.w); b = Math.max(b, s.y + s.h);
    }
    return { l, t, r, b };
  }

  function integrate() {
    for (const [gid, v] of bodies) {
      if (gid === dragGid) continue;
      if (Math.abs(v.vx) < 0.02 && Math.abs(v.vy) < 0.02) { v.vx = 0; v.vy = 0; continue; }

      translateGroup(gid, v.vx, v.vy);
      v.vx *= DRAG; v.vy *= DRAG;

      const box = groupBox(gid);
      if (box.l < 0)   { translateGroup(gid, -box.l, 0);      v.vx = Math.abs(v.vx) * BOUNCE; }
      if (box.r > W)   { translateGroup(gid, W - box.r, 0);   v.vx = -Math.abs(v.vx) * BOUNCE; }
      if (box.t < 0)   { translateGroup(gid, 0, -box.t);      v.vy = Math.abs(v.vy) * BOUNCE; }
      if (box.b > H)   { translateGroup(gid, 0, H - box.b);   v.vy = -Math.abs(v.vy) * BOUNCE; }
    }
  }

  const speed = (gid) => { const v = bodies.get(gid); return v ? Math.hypot(v.vx, v.vy) : 0; };

  function tryWeld() {
    for (let i = 0; i < syms.length; i++) {
      for (let j = i + 1; j < syms.length; j++) {
        const a = syms[i], b = syms[j];
        if (a.gid === b.gid) continue;
        if (a.gid === dragGid || b.gid === dragGid) continue;
        if (speed(a.gid) > SNAP_SPEED || speed(b.gid) > SNAP_SPEED) continue;

        // Expressions read left to right, so only side-by-side welds count.
        const [left, right] = a.x <= b.x ? [a, b] : [b, a];
        const gap = right.x - (left.x + left.w);
        const dy = Math.abs((a.y + a.h / 2) - (b.y + b.h / 2));
        if (gap > SNAP_DIST || gap < -left.w * 0.7) continue;
        if (dy > a.h * 0.55) continue;

        // Snap the right-hand group onto the left one, then fuse.
        translateGroup(right.gid,
          (left.x + left.w + SNAP_GAP) - right.x,
          (left.y) - right.y);
        mergeGroups(left.gid, right.gid);
        return; // one weld per frame keeps the motion legible
      }
    }
  }

  /* ───────────────  readout  ─────────────── */

  let lastRead = '';
  function render() {
    const counts = new Map();
    for (const s of syms) counts.set(s.gid, (counts.get(s.gid) || 0) + 1);
    let best = null, n = 1;
    for (const [gid, c] of counts) if (c > n) { n = c; best = gid; }

    const text = best === null
      ? ''
      : members(best).sort((p, q) => p.x - q.x).map((s) => s.ch).join(' ');
    if (text !== lastRead) {
      readout.textContent = text;
      lastRead = text;
      readout.classList.remove('changed');
      void readout.offsetWidth;        // the line is re-lettered, not swapped
      readout.classList.add('changed');
    }
  }

  /* ───────────────  pointer  ─────────────── */

  let dragGid = null;
  let dragSym = null;
  let samples = [];
  let grabOff = { x: 0, y: 0 };
  let lastTap = { el: null, t: 0 };

  const kindOf = (el) =>
    el.classList.contains('op') ? 'op' : (el.classList.contains('num') ? 'num' : '');

  /** Second tap on the same glyph: break an expression apart, or copy a loose one. */
  function splitOrCopy(s) {
    if (members(s.gid).length > 1) { detach(s); return; }
    const copy = spawn(s.ch, kindOf(s.el), Math.min(W - s.w, s.x + 26), Math.max(0, s.y - 18), true);
    if (copy) { const v = bodies.get(copy.gid); v.vx = 2.4; v.vy = -1.8; }
  }

  board.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.ma-sym');
    if (!el) return;
    let s = syms.find((k) => k.el === el);
    if (!s) return;

    // Double-tap is detected here rather than via a dblclick listener: the
    // preventDefault below suppresses the compatibility mouse events, so
    // dblclick never fires. Doing it on the pointer also covers touch.
    const now = performance.now();
    if (lastTap.el === el && now - lastTap.t < 350) {
      lastTap = { el: null, t: 0 };
      e.preventDefault();
      endDrag(e);
      splitOrCopy(s);
      return;
    }
    lastTap = { el, t: now };

    // alt drags a copy off the original
    if (e.altKey) {
      const copy = spawn(s.ch, kindOf(s.el), s.x, s.y, true);
      if (!copy) return;
      s = copy;
    } else if (members(s.gid).length > 1) {
      // dragging a welded glyph drags the whole expression
    }

    e.preventDefault();
    board.setPointerCapture(e.pointerId);

    dragSym = s;
    dragGid = s.gid;
    const v = bodies.get(dragGid); v.vx = 0; v.vy = 0;

    const r = board.getBoundingClientRect();
    grabOff.x = (e.clientX - r.left) - s.x;
    grabOff.y = (e.clientY - r.top) - s.y;

    samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    s.el.classList.add('dragging');
    members(dragGid).forEach((m) => m.el.style.zIndex = 5);
  });

  board.addEventListener('pointermove', (e) => {
    if (dragGid === null) return;
    const r = board.getBoundingClientRect();
    const tx = (e.clientX - r.left) - grabOff.x;
    const ty = (e.clientY - r.top) - grabOff.y;
    translateGroup(dragGid, tx - dragSym.x, ty - dragSym.y);

    samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (samples.length > 6) samples.shift();
  });

  function endDrag(e) {
    if (dragGid === null) return;
    const v = bodies.get(dragGid);

    // Momentum from the last ~80ms of pointer travel.
    const now = performance.now();
    const recent = samples.filter((p) => now - p.t < 90);
    if (recent.length >= 2 && v) {
      const a = recent[0], b = recent[recent.length - 1];
      const dt = Math.max(8, b.t - a.t);
      v.vx = ((b.x - a.x) / dt) * 16;
      v.vy = ((b.y - a.y) / dt) * 16;
      const sp = Math.hypot(v.vx, v.vy);
      if (sp > 34) { v.vx = (v.vx / sp) * 34; v.vy = (v.vy / sp) * 34; }
    }

    dragSym.el.classList.remove('dragging');
    members(dragGid).forEach((m) => m.el.style.zIndex = '');
    if (e) { try { board.releasePointerCapture(e.pointerId); } catch { /* already gone */ } }
    dragGid = null; dragSym = null; samples = [];
  }

  board.addEventListener('pointerup', endDrag);
  board.addEventListener('pointercancel', endDrag);

  resetBtn?.addEventListener('click', () => {
    build();
    if (!reduced) toss();
  });

  /* ───────────────  loop  ─────────────── */

  let onScreen = false, raf = 0;

  function frame() {
    integrate();
    tryWeld();
    render();
    raf = onScreen ? requestAnimationFrame(frame) : 0;
  }

  new IntersectionObserver(([en]) => {
    onScreen = en.isIntersecting;
    if (onScreen && !raf) raf = requestAnimationFrame(frame);
  }, { threshold: 0.02 }).observe(board);

  // The chalk is thrown down when the board is properly in view, not when
  // its first pixel clears the fold — otherwise it lands behind the wipe.
  if (!reduced) {
    const entrance = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      entrance.disconnect();
      toss();
    }, { threshold: 0.35 });
    entrance.observe(board);
  }

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const prevW = W, prevH = H;
      measure();
      if (!prevW || !prevH) return;
      const sx = W / prevW, sy = H / prevH;
      for (const s of syms) {
        s.x = Math.max(0, Math.min(W - s.w, s.x * sx));
        s.y = Math.max(0, Math.min(H - s.h, s.y * sy));
        place(s);
      }
    }, 140);
  });

  build();
  if (reduced) { /* still fully usable — nothing moves unless dragged */ }
}
