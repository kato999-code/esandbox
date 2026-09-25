/* ─────────────────────────────────────────────────────────────
   03 · UPCOMING — deliberately empty.

   Six reserved frames. No names, no dates, no invented titles.
   The only material is the reservation itself: the frames respond
   to the cursor the way a drafting sheet catches the light, and
   nothing else happens, because nothing else is true yet.
   ───────────────────────────────────────────────────────────── */

const SLOTS = 6;
const RADIUS = 260; // px of cursor influence

export function initUpcoming({ reduced }) {
  const host = document.getElementById('up-slots');
  if (!host) return;

  const slots = [];
  for (let i = 0; i < SLOTS; i++) {
    const el = document.createElement('div');
    el.className = 'up-slot';
    el.setAttribute('role', 'listitem');
    const n = document.createElement('span');
    n.textContent = `slot ${String(i + 1).padStart(2, '0')} · open`;
    el.appendChild(n);
    host.appendChild(el);
    slots.push(el);
  }

  if (reduced) return;

  let pointer = null;
  let raf = 0;

  const section = document.querySelector('.sec-up');

  // The plotter head: two rules that track the cursor across the sheet.
  // Inserted before the content so it reads as ruling on the paper
  // underneath rather than an overlay on top of the type.
  const cross = document.createElement('div');
  cross.className = 'up-cross';
  cross.setAttribute('aria-hidden', 'true');
  cross.innerHTML = '<i class="h"></i><i class="v"></i>';
  section.insertBefore(cross, section.querySelector('.up-inner'));

  section.addEventListener('pointermove', (e) => {
    pointer = { x: e.clientX, y: e.clientY };
    section.classList.add('is-live');
    if (!raf) raf = requestAnimationFrame(apply);
  });
  section.addEventListener('pointerleave', () => {
    pointer = null;
    section.classList.remove('is-live');
    if (!raf) raf = requestAnimationFrame(apply);
  });

  function apply() {
    raf = 0;

    if (pointer) {
      const s = section.getBoundingClientRect();
      cross.style.setProperty('--cx', `${(pointer.x - s.left).toFixed(1)}px`);
      cross.style.setProperty('--cy', `${(pointer.y - s.top).toFixed(1)}px`);
    }

    for (const el of slots) {
      let near = 0;
      if (pointer) {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const d = Math.hypot(pointer.x - cx, pointer.y - cy);
        near = Math.max(0, 1 - d / RADIUS);
        near *= near; // tighten the falloff so the effect stays local
      }
      el.style.setProperty('--near', near.toFixed(3));
    }
  }
}
