/* ─────────────────────────────────────────────────────────────
   waylink.js — the one thing 04 and 05 share.

   Both sections carry a button that has to lead somewhere the day
   there is something behind it, and must not look broken until
   then. The markup ships as an <a> with no href and an empty
   `data-href`, which means the browser already treats it as not a
   link: there is no dead URL to click through to even if this
   file never runs.

   Turning one on is a one-attribute job, in index.html, with no
   code change:

       data-href="/math/notes/"

   …and the element becomes a real <a href>, drops its empty
   styling, and takes the label in `data-ready-sub`.

   Left empty it stays in the tab order and reports itself as a
   disabled link (aria-disabled, per the ARIA practice of keeping
   disabled controls discoverable rather than hiding them), says
   in its own sub-label that there is nothing there, and declines
   with a small shake if you press it anyway.
   ───────────────────────────────────────────────────────────── */

export function initWayLink(el) {
  if (!el) return;

  const href = (el.dataset.href || '').trim();
  const sub = el.querySelector('[data-sub]');

  /* ── there is something behind it ── */
  if (href) {
    el.href = href;
    el.classList.remove('is-empty');
    el.removeAttribute('role');
    el.removeAttribute('aria-disabled');
    el.removeAttribute('tabindex');
    if (sub && el.dataset.readySub) sub.textContent = el.dataset.readySub;
    return;
  }

  /* ── there is not ── */
  el.classList.add('is-empty');
  el.removeAttribute('href');
  el.setAttribute('role', 'link');
  el.setAttribute('aria-disabled', 'true');
  el.setAttribute('tabindex', '0');

  const decline = (e) => {
    e.preventDefault();
    el.classList.remove('nudge');
    void el.offsetWidth;          // restart the shake on every press
    el.classList.add('nudge');
  };

  el.addEventListener('click', decline);
  el.addEventListener('keydown', (e) => {
    // A role="link" is activated by Enter; Space is caught too so the
    // page does not scroll out from under a keyboard user instead.
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') decline(e);
  });
  el.addEventListener('animationend', () => el.classList.remove('nudge'));
}
