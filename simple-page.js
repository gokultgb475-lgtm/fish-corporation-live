(function () {
  document.querySelectorAll('img').forEach((img) => {
    if (String(img.getAttribute('src') || '').includes('bestfishi-pro-logo.svg')) return;
    img.addEventListener('error', () => {
      img.src = '/images/freshwater/fallback.svg';
    }, { once: true });
  });

  const nodes = document.querySelectorAll('.reveal');
  nodes.forEach((node, index) => {
    node.style.transitionDelay = `${Math.min(index * 50, 300)}ms`;
  });

  if (!('IntersectionObserver' in window)) {
    nodes.forEach((node) => node.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  nodes.forEach((node) => observer.observe(node));
})();
