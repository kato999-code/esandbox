/* ─────────────────────────────────────────────────────────────
   05 · WRITING — deliberately empty.

   No articles, no titles, no dates. The only behaviour is the one
   honest thing the section can say: the count of published pieces,
   struck onto the sheet a character at a time when it scrolls into
   view, then a caret waiting for the first one.
   ───────────────────────────────────────────────────────────── */

const LINE = 'No pieces published.';

export function initWriting() {
  const el = document.getElementById('wr-count');
  if (!el) return;

  // The caret belongs to the line: solid while the line is being set,
  // blinking only once it stands finished.
  const sec = el.closest('.sec-wr');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) { el.textContent = LINE; sec?.classList.add('is-typed'); return; }

  el.textContent = '';

  const type = () => {
    sec?.classList.add('is-typing');
    let i = 0;
    const tick = () => {
      el.textContent = LINE.slice(0, ++i);
      if (i < LINE.length) { setTimeout(tick, 42 + Math.random() * 38); return; }
      sec?.classList.remove('is-typing');
      sec?.classList.add('is-typed');
    };
    tick();
  };

  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    setTimeout(type, 420);
  }, { threshold: 0.4 });

  io.observe(el.closest('.wr-sheet'));
}
