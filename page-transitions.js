(function () {
  const TOP_NAV_ITEMS = [
    { href: '/ecosystem.html', label: 'Ecosystem' },
    { href: '/marketplace.html', label: 'Marketplace' },
    { href: '/technology.html', label: 'Technology' },
    { href: '/community.html', label: 'Community' }
  ];

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
      window.history.back();
      return;
    }
    window.location.href = fallback;
  }

  function buildTopNav() {
    const nav = document.createElement('nav');
    nav.className = 'nav-links';
    nav.setAttribute('aria-label', 'Primary navigation');
    nav.innerHTML = TOP_NAV_ITEMS.map((item) => `<a href="${item.href}">${item.label}</a>`).join('');
    return nav;
  }

  function ensureTopTopicsOnHome() {
    const homeNav = document.querySelector('.site-header .nav-links');
    if (!(homeNav instanceof HTMLElement)) return;
    homeNav.innerHTML = TOP_NAV_ITEMS.map((item) => `<a href="${item.href}">${item.label}</a>`).join('');
  }

  function ensureTopNavOnDetailPages() {
    const topbar = document.querySelector('.topbar');
    if (!(topbar instanceof HTMLElement)) return;
    const currentNav = topbar.querySelector('.nav-links');
    const forceHomeUiNav = document.body.classList.contains('home-ui-page');
    if (currentNav instanceof HTMLElement) {
      if (forceHomeUiNav) {
        currentNav.innerHTML = TOP_NAV_ITEMS.map((item) => `<a href="${item.href}">${item.label}</a>`).join('');
      }
      return;
    }

    const nav = buildTopNav();
    const actions = topbar.querySelector('.top-actions');
    if (actions instanceof HTMLElement) {
      topbar.insertBefore(nav, actions);
      return;
    }
    topbar.appendChild(nav);
  }

  function ensureBackButton() {
    if (document.body.classList.contains('home-page')) return;
    if (document.querySelector('[data-back-btn]')) return;

    const navShell = document.querySelector('.site-header .nav-shell');
    const topbar = document.querySelector('.topbar');
    const target = navShell || topbar;
    if (!(target instanceof HTMLElement)) return;

    const actions = document.createElement('div');
    actions.className = 'top-actions auto-top-actions';
    actions.innerHTML = '<button class="btn btn-light global-back-btn" type="button" data-back-btn aria-label="Go back">Back</button>';
    target.appendChild(actions);
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const backBtn = target.closest('[data-back-btn]');
    if (backBtn) {
      event.preventDefault();
      goBackWithFallback();
      return;
    }

    if (event.defaultPrevented) return;
  });

  ensureTopTopicsOnHome();
  ensureTopNavOnDetailPages();
  ensureBackButton();
  window.addEventListener('scroll', queueScrollEffects, { passive: true });
  window.addEventListener('resize', queueScrollEffects);
  queueScrollEffects();
})();
