(function () {
  function updateScrollEffects() {
    const scrollY = window.scrollY || 0;
    const maxScroll = Math.max((document.documentElement.scrollHeight || 1) - window.innerHeight, 1);
    const progress = Math.min(1, Math.max(0, scrollY / maxScroll));

    document.documentElement.style.setProperty('--scroll-progress', progress.toFixed(4));
    document.body.classList.toggle('scrolled', scrollY > 24);

    const heroContent = document.querySelector('.hero-cinema-content');
    if (heroContent) {
      const offset = Math.min(30, scrollY * 0.08);
      heroContent.style.transform = `translate3d(0, ${offset}px, 0)`;
    }

    document.querySelectorAll('.hero-overlay, .admin-hero-overlay').forEach((overlay) => {
      const opacity = Math.min(0.85, 0.52 + (scrollY * 0.00045));
      overlay.style.opacity = String(opacity);
    });
  }

  let ticking = false;
  function queueScrollEffects() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      ticking = false;
      updateScrollEffects();
    });
  }

  function goBackWithFallback() {
    const fallback = '/';
    if (window.history.length > 1 && document.referrer) {
      document.body.classList.add('page-leaving');
      setTimeout(() => window.history.back(), 170);
      return;
    }
    document.body.classList.add('page-leaving');
    setTimeout(() => {
      window.location.href = fallback;
    }, 170);
  }

  document.querySelectorAll('[data-back-btn]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      goBackWithFallback();
    });
  });

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target.closest('a[href]');
    if (!anchor) return;
    if (anchor.target && anchor.target !== '_self') return;
    if (anchor.hasAttribute('download')) return;

    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    const target = new URL(href, window.location.href);
    if (target.origin !== window.location.origin) return;
    if (target.pathname === window.location.pathname && target.search === window.location.search) return;

    event.preventDefault();
    document.body.classList.add('page-leaving');
    setTimeout(() => {
      window.location.href = target.href;
    }, 170);
  });

  window.addEventListener('scroll', queueScrollEffects, { passive: true });
  window.addEventListener('resize', queueScrollEffects);
  queueScrollEffects();
})();
