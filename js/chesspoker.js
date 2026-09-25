/* ─────────────────────────────────────────────────────────────
   02 · CHESS POKER

   The section's interactable material is the game's actual hinge:
   placing a wager flips the board to your opponent's view. Clicking
   a square stakes a chip on it; the Bet button turns the board over.
   Nothing here plays chess — it demonstrates the one mechanic that
   makes the game what it is.

   The money is deliberately kept out of all of that. The flip costs
   nothing and pays nothing, so it moves no figure; the one thing
   that makes the pot climb is `raisePot()`, which is an animation
   and says so. See "the money" below.
   ───────────────────────────────────────────────────────────── */

// Standard opening position, written from white's side down. Both sides use the
// solid glyphs and are told apart by fill colour — the outline set (♖♘♗) renders
// too thin to read at board size, and washes out entirely on the light squares.
const BACK = ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'];
const PAWN = '♟';

const ANTE = 40;
/** What one press of the money animation adds. Cosmetic — see `raisePot`. */
const FLOURISH = 25;

export function initChessPoker() {
  const board = document.getElementById('cp-board');
  const betBtn = document.getElementById('cp-bet');
  const potEl = document.getElementById('cp-pot');
  const trayEl = document.getElementById('cp-tray');
  const potBox = potEl?.closest('.cp-pot');
  const raiseBtn = document.getElementById('cp-raise');
  const sayEl = document.getElementById('cp-say');
  const label = document.getElementById('cp-flip-label');
  if (!board) return;

  /* ── build the board ── */
  const squares = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = document.createElement('div');
      sq.className = `cp-sq ${(r + f) % 2 === 0 ? 'lt' : 'dk'}`;

      let glyph = '', side = '';
      if (r === 0)      { glyph = BACK[f]; side = 'b'; }
      else if (r === 1) { glyph = PAWN;    side = 'b'; }
      else if (r === 6) { glyph = PAWN;    side = 'w'; }
      else if (r === 7) { glyph = BACK[f]; side = 'w'; }

      if (glyph) {
        const pc = document.createElement('span');
        pc.className = `pc ${side}`;
        pc.textContent = glyph;
        sq.appendChild(pc);
      }
      board.appendChild(sq);
      squares.push(sq);
    }
  }

  let flipped = false;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── the money ────────────────────────────────────────────────
     Two figures, kept apart on purpose.

     `ledger.pot` is the game's money. Exactly one thing on this page
     is allowed to set it, and that is the ante below. In particular
     the flip does not: turning the table round is a change of
     viewpoint, it is not a transaction, and it must leave every
     number, counter and animation on this section exactly where it
     found them.

     `flourish` is the animation's money. It exists so that the pot
     has something to count up to when `raisePot()` is called, and
     nothing reads it back — no rule of the game can see it. The
     figure on the felt is the sum of the two. */
  const ledger = { pot: ANTE };
  let flourish = 0;
  const total = () => ledger.pot + flourish;

  /* A pot is told, not displayed: the figure counts up to the new total and
     the chips that pay for it drop into the tray one after another. */
  let shown = total();
  let potRaf = 0;

  function countPot(to) {
    cancelAnimationFrame(potRaf);
    const from = shown;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 620);
      shown = from + (to - from) * (1 - (1 - k) ** 3);
      potEl.textContent = `$${Math.round(shown)}`;
      if (k < 1) { potRaf = requestAnimationFrame(step); return; }
      shown = to;
      potEl.textContent = `$${to}`;
      // announced once it lands, rather than sixty times on the way
      if (sayEl) sayEl.textContent = `Match pot $${to}`;
    };
    potRaf = requestAnimationFrame(step);
  }

  function renderChips(animate) {
    const want = Math.min(14, Math.round(total() / 20));
    const have = trayEl.children.length;
    for (let i = have; i < want; i++) {
      const c = document.createElement('i');
      c.className = animate ? 'cp-chip is-new' : 'cp-chip';
      if (animate) c.style.animationDelay = `${(i - have) * 70}ms`;
      trayEl.appendChild(c);
    }
    for (let i = have; i > want; i--) trayEl.lastElementChild?.remove();
  }

  function renderPot(animate = true) {
    if (animate && !reduced) {
      countPot(total());
      potEl.classList.remove('bump');
      void potEl.offsetWidth;           // restart the knock on every raise
      potEl.classList.add('bump');
    } else {
      shown = total();
      potEl.textContent = `$${shown}`;
      if (sayEl) sayEl.textContent = `Match pot $${shown}`;
    }
    renderChips(animate && !reduced);
  }

  renderPot(false);   // the ante is already on the table when you arrive

  /* a figure that rises off the pot and is gone — purely the flourish */
  function floatGain(by) {
    if (reduced || !potBox) return;
    const g = document.createElement('span');
    g.className = 'cp-gain';
    g.textContent = `+$${by}`;
    g.setAttribute('aria-hidden', 'true');
    g.addEventListener('animationend', () => g.remove());
    potBox.appendChild(g);
  }

  /**
   * The money animation, and nothing else.
   *
   * This is the ONLY thing that makes the figure climb. It is
   * cosmetic by construction: it adds to `flourish`, never to
   * `ledger.pot`, so no amount of pressing it changes what the game
   * would be playing for. Wired to the "toss a chip" button, and
   * exposed as window.eSandbox.raisePot() for the console.
   *
   * @param {number} by dollars to add to the display. Default FLOURISH.
   */
  function raisePot(by = FLOURISH) {
    const amount = Math.max(1, Math.round(Number(by) || FLOURISH));
    flourish += amount;
    renderPot(true);
    floatGain(amount);
    return total();
  }

  raiseBtn?.addEventListener('click', () => raisePot());

  board.addEventListener('click', (e) => {
    const sq = e.target.closest('.cp-sq');
    if (!sq) return;
    sq.classList.toggle('wager');
  });

  /* ── the flip ── */
  const wrap = board.closest('.cp-boardwrap');

  /* The flip is a change of viewpoint and NOTHING ELSE.
     It turns the board over, retriggers the lift, and relabels. It must
     not touch the money in either direction — the pot's own copy says it
     grows on the ante and on every FAILED read, and placing a read is
     neither. So there is deliberately no renderPot(), no countPot(), no
     chip render and no ledger arithmetic anywhere in this handler: flip
     as many times as you like and the figure will not move. The one
     thing that moves it is raisePot(), above. */
  betBtn.addEventListener('click', () => {
    flipped = !flipped;
    board.classList.toggle('flipped', flipped);

    // retrigger the lift animation on every press
    wrap.classList.remove('turning');
    void wrap.offsetWidth;
    wrap.classList.add('turning');

    // The caption belongs to whichever side of the table is facing you, so
    // it changes at the bottom of the turn, not at the start of it.
    const caption = flipped ? "opponent's view" : 'your view';
    if (reduced) label.textContent = caption;
    else setTimeout(() => { label.textContent = caption; }, 380);

    if (flipped) betBtn.textContent = 'Read placed — flip back';
    else betBtn.innerHTML = 'Bet &mdash; flip the board';
  });

  return { raisePot };
}
