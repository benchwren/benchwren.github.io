// The product card leans towards the pointer, with a soft light following it.
// Mouse and pen only, and never when reduced motion is on.
(() => {
  const card = document.getElementById('product-card');
  if (!card) return;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const MAX_DEG = 5;

  card.addEventListener('pointermove', (e) => {
    if (!finePointer.matches || reduceMotion.matches) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    card.classList.add('tilting');
    card.style.setProperty('--ry', `${(px - 0.5) * 2 * MAX_DEG}deg`);
    card.style.setProperty('--rx', `${(0.5 - py) * 2 * MAX_DEG}deg`);
    card.style.setProperty('--gx', `${px * 100}%`);
    card.style.setProperty('--gy', `${py * 100}%`);
    card.style.setProperty('--glow', '1');
  });
  card.addEventListener('pointerleave', () => {
    card.classList.remove('tilting');
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
    card.style.setProperty('--glow', '0');
  });
})();
