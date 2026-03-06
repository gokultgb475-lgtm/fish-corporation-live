(function () {
  const showcaseEl = document.getElementById('ops-showcase');
  const viewportEl = document.querySelector('[data-ops-viewport]');
  const trackEl = document.querySelector('[data-ops-track]');
  const dotsEl = document.querySelector('[data-ops-dots]');
  const prevBtn = document.querySelector('[data-ops-prev]');
  const nextBtn = document.querySelector('[data-ops-next]');

  if (!(showcaseEl instanceof HTMLElement)) return;
  if (!(viewportEl instanceof HTMLElement)) return;
  if (!(trackEl instanceof HTMLElement)) return;

  const slides = Array.from(trackEl.querySelectorAll('.ops-slide'));
  if (!slides.length) return;

  let currentIndex = 0;
  let maxIndex = 0;
  let perView = 1;
  let autoTimer = null;
  let isHovered = false;
  let resizeRaf = null;

  function getPerView() {
    const width = viewportEl.clientWidth || window.innerWidth;
    if (width >= 1400) return 4;
    if (width >= 980) return 3;
    if (width >= 680) return 2;
    return 1;
  }

  function stopAuto() {
    if (!autoTimer) return;
    clearInterval(autoTimer);
    autoTimer = null;
  }

  function renderDots() {
    if (!(dotsEl instanceof HTMLElement)) return;
    const dotCount = maxIndex + 1;
    dotsEl.innerHTML = '';

    for (let i = 0; i < dotCount; i += 1) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = i === currentIndex ? 'ops-dot active' : 'ops-dot';
      dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
      dot.dataset.opsIndex = String(i);
      dotsEl.appendChild(dot);
    }
  }

  function syncButtons() {
    const disabled = maxIndex <= 0;
    if (prevBtn instanceof HTMLButtonElement) prevBtn.disabled = disabled;
    if (nextBtn instanceof HTMLButtonElement) nextBtn.disabled = disabled;
  }

  function updatePosition() {
    const baseOffset = slides[0]?.offsetLeft || 0;
    const activeOffset = slides[currentIndex]?.offsetLeft || baseOffset;
    trackEl.style.transform = `translate3d(${-Math.max(0, activeOffset - baseOffset)}px, 0, 0)`;

    slides.forEach((slide, index) => {
      slide.classList.toggle('is-active', index >= currentIndex && index < currentIndex + perView);
    });

    if (dotsEl instanceof HTMLElement) {
      dotsEl.querySelectorAll('.ops-dot').forEach((dot, dotIndex) => {
        dot.classList.toggle('active', dotIndex === currentIndex);
      });
    }
  }

  function updateLayout() {
    perView = getPerView();
    maxIndex = Math.max(0, slides.length - perView);
    currentIndex = Math.min(currentIndex, maxIndex);
    trackEl.style.setProperty('--ops-per-view', String(perView));
    renderDots();
    syncButtons();
    updatePosition();
  }

  function goTo(index) {
    if (maxIndex <= 0) {
      currentIndex = 0;
      updatePosition();
      return;
    }

    let target = Number(index);
    if (!Number.isFinite(target)) target = 0;
    if (target > maxIndex) target = 0;
    if (target < 0) target = maxIndex;
    currentIndex = target;
    updatePosition();
  }

  function startAuto() {
    stopAuto();
    if (maxIndex <= 0) return;

    autoTimer = setInterval(() => {
      if (document.hidden || isHovered) return;
      goTo(currentIndex + 1);
    }, 3800);
  }

  if (prevBtn instanceof HTMLButtonElement) {
    prevBtn.addEventListener('click', () => {
      goTo(currentIndex - 1);
      startAuto();
    });
  }

  if (nextBtn instanceof HTMLButtonElement) {
    nextBtn.addEventListener('click', () => {
      goTo(currentIndex + 1);
      startAuto();
    });
  }

  if (dotsEl instanceof HTMLElement) {
    dotsEl.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const index = Number(target.dataset.opsIndex);
      if (!Number.isFinite(index)) return;
      goTo(index);
      startAuto();
    });
  }

  showcaseEl.addEventListener('mouseenter', () => {
    isHovered = true;
  });

  showcaseEl.addEventListener('mouseleave', () => {
    isHovered = false;
  });

  window.addEventListener('resize', () => {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(updateLayout);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    startAuto();
  });

  updateLayout();
  startAuto();
})();
