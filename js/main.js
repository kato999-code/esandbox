/* ─────────────────────────────────────────────────────────────
   main.js — page shell.
   Owns: Lenis inertial scroll, the GSAP/ScrollTrigger bridge,
   the left-edge index, and the per-section reveal timelines.
   Each section's own behaviour lives in its own module.
   ───────────────────────────────────────────────────────────── */

import { initJoust }    from './joust.js';
import { initChessPoker } from './chesspoker.js';
import { initUpcoming } from './upcoming.js';
import { initMath }     from './math.js';
import { initWriting }  from './writing.js';
import { initWayLink }  from './waylink.js';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ───────────────────────  scroll  ─────────────────────── */

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

let lenis = null;

if (!REDUCED) {
  lenis = new Lenis({
    lerp: 0.085,
    wheelMultiplier: 1,
    smoothWheel: true,
    // trackpads and touch already have their own inertia
    syncTouch: false,
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

/** Single entry point for "go to this section", used by the rail. */
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.1 });
  else el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
}

/* ───────────────────────  left-edge index  ─────────────────────── */

function initRail() {
  const rail = document.getElementById('rail');
  const links = [...rail.querySelectorAll('.rail-list a')];
  const progress = rail.querySelector('.rail-progress');

  links.forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToSection(a.getAttribute('href').slice(1));
      a.blur();
      rail.classList.remove('is-open');
    });
  });

  // Escape closes the panel when it was opened by keyboard focus.
  rail.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { rail.classList.remove('is-open'); document.activeElement?.blur(); }
  });

  // Mark the section currently occupying the viewport. The spine takes that
  // section's swatch with it, so the one persistent element on the page
  // reports which of the five aesthetics you are standing in.
  const setCurrent = (id) => {
    links.forEach((a) => {
      const on = a.dataset.rail === id;
      if (!on) { a.removeAttribute('aria-current'); return; }
      a.setAttribute('aria-current', 'true');
      const sw = a.querySelector('i')?.style.getPropertyValue('--sw').trim();
      if (sw) rail.style.setProperty('--rail-accent', sw);
    });
  };
  setCurrent('top');   // the page opens on the title card

  // A hidden index nobody finds is not an index: once, after the page has
  // settled, it shows an inch of itself and withdraws. Any real approach
  // from the pointer or the keyboard cancels it.
  const panel = rail.querySelector('.rail-panel');
  if (!REDUCED && panel) {
    const stopPeek = () => panel.classList.remove('peek');
    panel.classList.add('peek');
    panel.addEventListener('animationend', stopPeek, { once: true });
    // #rail itself is pointer-events:none, so the hit strip is what the
    // pointer actually reaches.
    rail.querySelector('.rail-hit')?.addEventListener('pointerenter', stopPeek, { once: true });
    rail.addEventListener('focusin', stopPeek, { once: true });
  }

  document.querySelectorAll('.sec').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 45%',
      end: 'bottom 45%',
      onToggle: (self) => { if (self.isActive) setCurrent(sec.dataset.sec); },
    });
  });

  // Fallback for the scroll-progress bar where animation-timeline: scroll()
  // is unsupported. Where it IS supported the CSS drives it and --p is ignored.
  const supportsSDA = CSS.supports('animation-timeline', 'scroll()');
  if (!supportsSDA) {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.setProperty('--p', max > 0 ? (window.scrollY / max).toFixed(4) : 0);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }
}

/* Anything marked data-jump is an in-page anchor that should ride the
   inertial scroll rather than teleport. The title card's contents list
   is the only user of it so far. */
function initJumps() {
  document.querySelectorAll('a[data-jump]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = (a.getAttribute('href') || '').slice(1);
      if (!id || !document.getElementById(id)) return;   // let the browser have it
      e.preventDefault();
      scrollToSection(id);
    });
  });
}

/* ───────────────────────  reveals  ─────────────────────── */

/**
 * Counts a figure up to the value already written in the markup, so the
 * spec block reads like a machine reporting in rather than a static table.
 * Keeps whatever units the figure was authored with ("82px", "r24").
 */
function countUp(el, duration = 0.9) {
  const m = el.textContent.trim().match(/^(\D*)(\d+(?:\.\d+)?)(\D*)$/);
  if (!m) return;
  const [, pre, num, post] = m;
  const target = parseFloat(num);
  const places = (num.split('.')[1] || '').length;
  const o = { v: 0 };
  gsap.to(o, {
    v: target,
    duration,
    ease: 'power2.out',
    onUpdate: () => { el.textContent = pre + o.v.toFixed(places) + post; },
  });
}

/**
 * Scroll-linked drift. Uses yPercent so it composes with the reveal
 * timelines below, which animate `y` on some of the same elements —
 * GSAP keeps the two transforms separate, so they never fight.
 */
function drift(target, amount, trigger) {
  gsap.fromTo(target, { yPercent: amount }, {
    yPercent: -amount,
    ease: 'none',
    scrollTrigger: { trigger, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
  });
}

/**
 * One orchestrated entrance per section rather than a uniform
 * fade-up on every element — each section gets a move that suits it.
 */
function initReveals() {
  if (REDUCED) return;

  // Sections announce their own arrival, once, for the CSS that wants to
  // know (the plotter pass down the Upcoming sheet, for one).
  document.querySelectorAll('.sec').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec, start: 'top 72%', once: true,
      onEnter: () => sec.classList.add('is-in'),
    });
  });

  // 01 — power-on: the title resolves, the arena widens open.
  gsap.set('.jo-title', { opacity: 0, letterSpacing: '0.4em' });
  gsap.set('.jo-arena', { opacity: 0, clipPath: 'inset(45% 0% 45% 0%)' });
  gsap.timeline({ scrollTrigger: { trigger: '.sec-joust', start: 'top 70%', once: true } })
    .to('.jo-kicker', { opacity: 1, duration: 0.5, ease: 'none' }, 0)
    .to('.jo-title', { opacity: 1, letterSpacing: '0.07em', duration: 1.1, ease: 'expo.out' }, 0.05)
    .to('.jo-arena', { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'power4.out' }, 0.3)
    .from('.jo-rules li', { opacity: 0, y: 16, duration: 0.6, stagger: 0.09, ease: 'power2.out' }, 0.7)
    .from('.jo-spec div', { opacity: 0, duration: 0.4, stagger: 0.05 }, 0.9)
    .add(() => document.querySelectorAll('.jo-spec dd').forEach((dd) => countUp(dd)), 0.9)
    // The slot lights up as soon as the arena has finished opening.
    // clearProps: the button's own hover and press states are CSS transforms,
    // and a left-over inline transform from the reveal would outrank them.
    .from('.jo-enter', { opacity: 0, y: 14, duration: 0.6, ease: 'power2.out', clearProps: 'transform' }, 0.75);

  // 02 — deal: the board is laid down, the panel is dealt in from the side.
  gsap.timeline({ scrollTrigger: { trigger: '.sec-cp', start: 'top 65%', once: true } })
    .from('.cp-head', { opacity: 0, y: 24, duration: 0.8, ease: 'power3.out' }, 0)
    .from('.cp-boardwrap', { opacity: 0, rotateX: 34, y: 40, duration: 1.0, ease: 'power3.out' }, 0.15)
    // the board is dealt square by square, corner to corner
    .from('.cp-sq', {
      opacity: 0, scale: 0.55, duration: 0.5, ease: 'power2.out',
      stagger: { grid: [8, 8], from: 'start', amount: 0.55 },
    }, 0.3)
    .from('.cp-side > *', { opacity: 0, x: 34, duration: 0.7, stagger: 0.11, ease: 'power2.out' }, 0.35)
    // The plaque is set down on the table last, once the hand is dealt.
    // clearProps for the same reason as `.jo-enter` above — the plaque is
    // pressed into the table on :active, which is a CSS transform.
    .from('.cp-enter', { opacity: 0, y: 18, duration: 0.65, ease: 'power3.out', clearProps: 'transform' }, 0.85);

  // 03 — drafting: the frames are ruled in, one after another.
  gsap.timeline({ scrollTrigger: { trigger: '.sec-up', start: 'top 65%', once: true } })
    .from('.up-title', { opacity: 0, x: -30, duration: 0.8, ease: 'power3.out' }, 0)
    .from('.up-meta', { opacity: 0, duration: 0.6 }, 0.3)
    .from('.up-slot', {
      opacity: 0, scaleY: 0.04, transformOrigin: 'center',
      duration: 0.55, stagger: { each: 0.07 }, ease: 'power2.out',
    }, 0.2)
    .from('.up-note', { opacity: 0, y: 14, duration: 0.6 }, 0.7);

  // 04 — the board is wiped clean, then written on.
  gsap.timeline({ scrollTrigger: { trigger: '.sec-math', start: 'top 65%', once: true } })
    .from('.ma-title', { opacity: 0, skewX: 8, y: 20, duration: 0.85, ease: 'power3.out' }, 0)
    .from('.ma-soon', { opacity: 0, scale: 0.7, duration: 0.5, ease: 'back.out(2)' }, 0.25)
    .from('.ma-lede', { opacity: 0, y: 14, duration: 0.7 }, 0.2)
    .from('.ma-board', { opacity: 0, clipPath: 'inset(0% 100% 0% 0%)', duration: 1.0, ease: 'power3.inOut' }, 0.3)
    // clearProps for the same reason as the two enter buttons: the nudge
    // this one plays when it is pressed empty is a CSS transform.
    .from('.ma-open', { opacity: 0, y: 12, duration: 0.55, ease: 'power2.out', clearProps: 'transform' }, 0.95);

  // 05 — the press: the word is struck onto the sheet.
  gsap.timeline({ scrollTrigger: { trigger: '.sec-wr', start: 'top 62%', once: true } })
    .from('.wr-title', { opacity: 0, y: 46, scaleY: 1.14, duration: 1.0, ease: 'expo.out' }, 0)
    .from('.wr-rule', { scaleX: 0, transformOrigin: 'left', duration: 0.9, ease: 'power3.inOut' }, 0.2)
    .from('.wr-empty', { opacity: 0, duration: 0.6 }, 0.5)
    .from('.wr-note', { opacity: 0, y: 12, duration: 0.7 }, 0.6)
    .from('.wr-open', { opacity: 0, y: 12, duration: 0.6, ease: 'power2.out', clearProps: 'transform' }, 0.75);

  // Slow parallax drift on the two textured backdrops. One effect,
  // used twice, rather than a scroll effect on everything.
  gsap.to('.up-grid', {
    backgroundPositionY: '160px, 160px, 160px, 160px',
    ease: 'none',
    scrollTrigger: { trigger: '.sec-up', start: 'top bottom', end: 'bottom top', scrub: true },
  });

  // The reveals fire once and are then spent — on the way back up the page
  // was dead. Each section's masthead now rides the scroll instead, a few
  // percent against the page, so the whole thing stays alive in both
  // directions without any second entrance to sit through.
  drift('.jo-title', 6, '.sec-joust');
  drift('.cp-title', 5, '.sec-cp');
  drift('.up-head', 6, '.sec-up');
  drift('.ma-head', 5, '.sec-math');
  drift('.wr-title', 7, '.sec-wr');
}

/**
 * Marks each section while it is anywhere near the viewport. The looping
 * CSS animations (the CRT raster, the phosphor tear, the allocation dot,
 * the warmth under the writing page) are paused until their section is
 * marked, so sitting on one section costs nothing on the other four.
 */
function initIdleGuard() {
  if (REDUCED) return;
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) en.target.classList.toggle('is-near', en.isIntersecting);
  }, { rootMargin: '15% 0px' });
  document.querySelectorAll('.sec').forEach((s) => io.observe(s));
}

/* ───────────────────────  boot  ─────────────────────── */

initRail();
initJumps();
initIdleGuard();
initJoust({ reduced: REDUCED });
const chessPoker = initChessPoker();
initUpcoming({ reduced: REDUCED });
initMath({ reduced: REDUCED });
initWriting();

// 04 and 05 each carry a way on. Neither has anywhere to go yet; both
// become real links the moment their data-href is filled in.
initWayLink(document.getElementById('ma-open'));
initWayLink(document.getElementById('wr-open'));

initReveals();

// Sections change height once their JS content exists.
ScrollTrigger.refresh();

/* The money animation in 02, reachable from the console as well as from
   its button. Cosmetic either way — it moves the figure on the felt and
   nothing behind it. See js/chesspoker.js. */
window.eSandbox = {
  raisePot: (by) => chessPoker?.raisePot(by),
  scrollToSection,
};

export { scrollToSection };
