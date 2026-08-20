/* ClearLabel homepage — motion layer (Motion, motion.dev, vanilla JS API).
 *
 * The page reads like a printed regulatory notice; this layer makes it feel
 * like a document waking up. The whole vocabulary is five movements:
 *   1. one scroll reveal (inView)
 *   2. one numeric count-up on the compliance clock
 *   3. one looping pulse (the 7px amber ticker dot)
 *   4. one stepping progress bar in the scanner panel
 *   5. hover transitions (plain CSS in motion.css)
 *
 * This file is strictly additive. It never hides content via a stylesheet:
 * the reveal "hidden" state is written here from JS only, after Motion has
 * loaded, and the failsafes undo it no matter what happens. home-ui.js
 * fills every counter during parse, so the page is fully readable even if
 * this module never runs.
 */
/* Self-hosted bundle (motion@12, animate + inView only) — no third-party CDN,
   for the same GDPR reason the fonts are self-hosted. Rebuild:
   echo 'export { animate, inView } from "motion";' > entry.mjs
   npx esbuild entry.mjs --bundle --format=esm --minify --outfile=motion-slim.mjs */
import { animate, inView } from './motion-slim.mjs';

const EASE = [0.22, 0.61, 0.24, 1];
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (sel) => document.querySelector(sel);
const $all = (sel) => [...document.querySelectorAll(sel)];

/* ------------------------------------------------------------------ */
/* Counters — one date-derived source of truth. The arithmetic and the */
/* dates are identical to home-ui.js, so every element that prints a   */
/* count (clock numerals, ticker, timeline tag, closing line) reads    */
/* the same values and nothing disagrees mid-tween.                    */
/* ------------------------------------------------------------------ */
const DAY = 86400000;
const ENFORCED_FROM = Date.UTC(2026, 7, 2); /* Art. 50(1) disclosure duty */
const MARKING_DUE = Date.UTC(2026, 11, 2);  /* Art. 50(2) machine-readable marking */
const now = new Date();
const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
const bindingDays = today >= ENFORCED_FROM ? Math.floor((today - ENFORCED_FROM) / DAY) + 1 : 0;
const remainingDays = today <= MARKING_DUE ? Math.ceil((MARKING_DUE - today) / DAY) : 0;

const clockBinding = $('#clock-binding-days');
const clockRemaining = $('#clock-remaining-days');
const bindingPeers = ['ticker-day', 'cta-day'].map((id) => document.getElementById(id)).filter(Boolean);
const remainingPeers = ['days-to-marking', 'cta-remaining'].map((id) => document.getElementById(id)).filter(Boolean);

const writeCounts = () => {
  if (clockBinding) clockBinding.textContent = bindingDays;
  if (clockRemaining) clockRemaining.textContent = remainingDays;
  bindingPeers.forEach((el) => { el.textContent = bindingDays; });
  remainingPeers.forEach((el) => { el.textContent = remainingDays; });
};

/* ------------------------------------------------------------------ */
/* §1 Scroll-reveal targets.                                          */
/* ------------------------------------------------------------------ */
const targets = $all('[data-reveal]');

/* This module is injected after window.load, so every target has already
   painted once. Split the targets at init: ones already intersecting the
   viewport are left untouched (no hide, no reveal) so the hero never
   blinks out and back in; only below-the-fold targets are hidden and
   revealed on scroll. */
const isInViewport = (el) => {
  const rect = el.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
};
const pendingTargets = targets.filter((el) => !isInViewport(el));

const revealAll = () => {
  pendingTargets.forEach((el) => {
    el.style.opacity = '1';
    el.style.transform = 'none';
  });
};

/* §1 — JS owns the hidden state, so content is visible if this script
   never runs. This must happen BEFORE the initial hidden-document check
   below, or a background tab would arm the hidden state after the
   failsafe had already run. */
if (!REDUCED) {
  pendingTargets.forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(14px)';
  });
}

/* ------------------------------------------------------------------ */
/* Rule B failsafes — finish the job regardless of how Motion behaves: */
/* frozen animation clock (background tab, preview pane, headless      */
/* screenshot, print/PDF), blocked module, thrown error. A direct      */
/* style write beats a frozen WAAPI/rAF clock.                         */
/* ------------------------------------------------------------------ */
const tweenControls = [];
const finish = () => {
  tweenControls.forEach((c) => { try { c.stop(); } catch (err) { /* noop */ } });
  revealAll();
  writeCounts();
};
setTimeout(finish, 900);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') finish();
});
window.addEventListener('error', finish);

/* ------------------------------------------------------------------ */
/* Reduced motion — check BEFORE any hidden state is set. Everything   */
/* stays at its resting style; counters go straight to final values.   */
/* Hover colour changes (CSS) may remain.                              */
/* ------------------------------------------------------------------ */
if (REDUCED) {
  document.documentElement.style.scrollBehavior = 'auto';
  writeCounts();
}

if (!REDUCED) {
  pendingTargets.forEach((el) => {
    inView(el, () => {
      animate(el, { opacity: 1, y: 0 }, {
        duration: 0.66,
        ease: EASE,
        delay: Number(el.dataset.revealDelay || 0) / 1000,
      });
      return false; /* reveal once; never re-hide on scroll up */
    }, { margin: '0px 0px -8% 0px', amount: 0.08 });
  });

  /* §2 — count-up on the compliance clock. The two numerals tween from
     0 to their date-derived values; every other element printing the
     same count follows along so nothing disagrees mid-tween. */
  const tweenCount = (el, to, peers) => {
    if (!el) return;
    tweenControls.push(animate(0, to, {
      duration: 1.15,
      ease: 'easeOut',
      onUpdate: (v) => {
        const n = Math.round(v);
        el.textContent = n;
        peers.forEach((p) => { p.textContent = n; });
      },
      onComplete: () => {
        el.textContent = to;
        peers.forEach((p) => { p.textContent = to; });
      },
    }));
  };
  /* A hidden document has a frozen animation clock: write final values
     instead of starting a tween that would sit at 0. */
  if (document.visibilityState === 'visible') {
    tweenCount(clockBinding, bindingDays, bindingPeers);
    tweenCount(clockRemaining, remainingDays, remainingPeers);
  }

  /* §3 — the only loop on the page: the 7px amber ticker dot. */
  const pulse = $('[data-pulse]');
  if (pulse) {
    animate(pulse, { opacity: [1, 0.35, 1], scale: [1, 0.82, 1] }, {
      duration: 2.6,
      ease: 'easeInOut',
      repeat: Infinity,
    });
  }

  /* §6 — FAQ answers: transform-only entrance on open. home-ui.js owns
     the open/closed state; this only animates the answer that just
     became visible. The first item stays open on load, untouched. */
  $all('.faq-question').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const answer = item && item.querySelector('.faq-answer');
      /* home-ui.js toggles .open synchronously in its own (earlier)
         listener, so the state is current by the time we run. */
      if (item && item.classList.contains('open') && answer) {
        animate(answer, { y: [-6, 0] }, { duration: 0.3, ease: EASE });
      }
    });
  });

  /* Hidden document: the hidden state was armed just above, so run the
     failsafe now — a background tab must show every reveal target and
     every counter at its final value with no user interaction. */
  if (document.visibilityState !== 'visible') finish();
}

/* ------------------------------------------------------------------ */
/* §4 — scanner progress bar. A 2px track is inserted directly beneath */
/* the "SCAN OUTPUT" header row with a #22407c fill that starts at     */
/* scaleX(0) — set from JS, for the same reason as the reveals. The    */
/* bar is driven by the real scanner state, never faked:               */
/*   idle → queued (one) → reading (two) → resolved (three) → done.    */
/* Under reduced motion the steps still happen, as static jumps,       */
/* because progress is state feedback, not decoration.                 */
/* ------------------------------------------------------------------ */
const outputHeader = $('.scan-output-header');
const scanPanel = $('.scan-output');
const phaseEl = $('#scan-phase');
const checkStatusEls = $all('.scan-check .check-status');
const scanResultEl = $('#scan-result');
const marks = { idle: 0, one: 0.04, two: 0.38, three: 0.72, done: 1 };

if (outputHeader && scanPanel && phaseEl) {
  const track = document.createElement('div');
  track.className = 'scan-progress';
  const fill = document.createElement('div');
  fill.className = 'scan-progress-fill';
  track.appendChild(fill);
  outputHeader.after(track);
  fill.style.transform = 'scaleX(0)'; /* an idle bar must not look complete */

  const barState = () => {
    const phase = phaseEl.textContent.trim();
    if (phase === 'complete') return 'done';
    if (phase === 'idle' || phase === 'failed') return 'idle';
    const statuses = checkStatusEls.map((el) => el.textContent.trim());
    if (statuses.length && statuses.every((s) => s === 'queued')) return 'one';
    if (statuses.some((s) => s.startsWith('reading'))) return 'two';
    return 'three'; /* all three checks resolved before the phase flips */
  };

  let lastState = null;
  let scheduled = false;
  const sync = () => {
    scheduled = false;
    const state = barState();
    if (state === lastState) return;
    lastState = state;
    if (REDUCED) fill.style.transform = `scaleX(${marks[state]})`;
    else animate(fill, { scaleX: marks[state] }, { duration: 0.45, ease: EASE });
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  };
  new MutationObserver(schedule).observe(scanPanel, {
    subtree: true,
    childList: true,
    characterData: true,
  });

  /* When the result block appears on completion, animate it in with a
     transform-only entrance — no opacity, no height. */
  if (scanResultEl && !REDUCED) {
    new MutationObserver(() => {
      if (!scanResultEl.hidden) {
        animate(scanResultEl, { y: [-6, 0] }, { duration: 0.34, ease: EASE });
      }
    }).observe(scanResultEl, { attributes: true, attributeFilter: ['hidden'] });
  }
}
