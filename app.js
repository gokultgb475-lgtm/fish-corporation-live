const heroMissionEl = document.getElementById('heroMission');
const trustBadgesEl = document.getElementById('trustBadges');
const metricGridEl = document.getElementById('metricGrid');
const livePulseEl = document.getElementById('livePulse');
const liveMetaEl = document.getElementById('liveMeta');
const liveSourceEl = document.getElementById('liveSource');
const liveRegionEl = document.getElementById('liveRegion');
const liveRowsEl = document.getElementById('liveRows');
const categoryFiltersEl = document.getElementById('categoryFilters');
const productGridEl = document.getElementById('productGrid');
const postGridEl = document.getElementById('postGrid');
const testimonialListEl = document.getElementById('testimonialList');
const salesFormEl = document.getElementById('salesForm');
const salesStatusEl = document.getElementById('salesStatus');
const complaintFormEl = document.getElementById('complaintForm');
const complaintStatusEl = document.getElementById('complaintStatus');
const openCartBtn = document.getElementById('openCartBtn');
const closeCartBtn = document.getElementById('closeCartBtn');
const cartDrawerEl = document.getElementById('cartDrawer');
const cartBackdropEl = document.getElementById('cartBackdrop');
const cartItemsEl = document.getElementById('cartItems');
const cartTotalEl = document.getElementById('cartTotal');
const cartCountEl = document.getElementById('cartCount');
const checkoutFormEl = document.getElementById('checkoutForm');
const checkoutStatusEl = document.getElementById('checkoutStatus');
const heroVideoEl = document.querySelector('.hero-video');
const heroSectionEl = document.querySelector('.hero-cinema');
const opsShowcaseEl = document.getElementById('ops-showcase');
const opsViewportEl = document.querySelector('[data-ops-viewport]');
const opsTrackEl = document.querySelector('[data-ops-track]');
const opsDotsEl = document.querySelector('[data-ops-dots]');
const opsPrevBtn = document.querySelector('[data-ops-prev]');
const opsNextBtn = document.querySelector('[data-ops-next]');

const API_REQUEST_TIMEOUT_MS = 9000;

const state = {
  apiBase: '',
  products: [],
  activeCategory: 'All',
  cart: loadCartFromStorage(),
  liveGeneratedAt: ''
};

const badgePageMap = {
  'Freshwater Aquaculture': '/freshwater-aquaculture.html',
  'Cold-chain Logistics': '/cold-chain-logistics.html',
  'Traceability First': '/traceability.html',
  'AI + IoT Monitoring': '/ai-iot-monitoring.html'
};

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem('bestfishi_cart');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function persistCart() {
  try {
    localStorage.setItem('bestfishi_cart', JSON.stringify(state.cart));
  } catch (error) {
    // Ignore storage write failures (private mode/quota) and keep cart in-memory.
  }
}

function formatMoney(value) {
  const num = Number(value || 0);
  return `Rs.${num.toFixed(2)}`;
}

function toTitleCase(value) {
  return String(value || '')
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatTime(iso) {
  if (!iso) return '--';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function buildApiCandidates() {
  const candidates = [];
  const runtime = typeof window.__API_BASE__ === 'string' ? window.__API_BASE__.trim().replace(/\/+$/, '') : '';
  if (runtime) candidates.push(runtime);
  candidates.push('');

  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';

  if (window.location.protocol === 'file:') {
    candidates.push('http://localhost:4080');
  } else if (isLocal && window.location.port !== '4080') {
    candidates.push('http://localhost:4080');
  }

  return [...new Set(candidates)];
}

const apiCandidates = buildApiCandidates();

function toApiUrl(base, path) {
  return base ? `${base}${path}` : path;
}

async function parseJsonSafe(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    return { error: `Invalid response (${response.status}).` };
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutRef = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);
  try {
    const signal = options.signal || controller.signal;
    return await fetch(url, { ...options, signal });
  } finally {
    clearTimeout(timeoutRef);
  }
}

async function requestApi(path, options = {}) {
  const errors = [];

  for (const base of apiCandidates) {
    try {
      const response = await fetchWithTimeout(toApiUrl(base, path), options);
      const payload = await parseJsonSafe(response);
      if (!response.ok) {
        const message = payload?.error || `HTTP ${response.status}`;
        errors.push(String(message));
        continue;
      }
      state.apiBase = base;
      return payload;
    } catch (error) {
      const message = error?.name === 'AbortError'
        ? `Request timeout after ${Math.round(API_REQUEST_TIMEOUT_MS / 1000)}s`
        : (error?.message || 'Network error');
      errors.push(String(message));
    }
  }

  const tail = errors[errors.length - 1] || 'Network error';
  throw new Error(`Unable to load data right now. ${tail}`);
}

function setCartVisibility(visible) {
  if (cartDrawerEl) cartDrawerEl.hidden = !visible;
  if (cartBackdropEl) cartBackdropEl.hidden = !visible;
}

function getCartCount() {
  return Object.values(state.cart).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
}

function getCartTotal() {
  return Object.values(state.cart).reduce((sum, item) => {
    return sum + ((Number(item.qty) || 0) * (Number(item.price) || 0));
  }, 0);
}

function renderCart() {
  if (cartCountEl) {
    cartCountEl.textContent = String(getCartCount());
  }
  if (!cartItemsEl || !cartTotalEl) return;

  const items = Object.values(state.cart);

  if (!items.length) {
    cartItemsEl.innerHTML = '<p class="muted">Cart is empty. Add products from marketplace.</p>';
    cartTotalEl.textContent = 'Total: Rs.0.00';
    return;
  }

  cartItemsEl.innerHTML = items.map((item) => {
    const lineTotal = (Number(item.qty) || 0) * (Number(item.price) || 0);
    return `
      <article class="cart-item">
        <h4>${item.name}</h4>
        <p>${formatMoney(item.price)} x ${item.qty} = ${formatMoney(lineTotal)}</p>
        <div class="product-actions">
          <label>
            Qty
            <input data-cart-qty="${item.id}" type="number" min="1" max="200" value="${item.qty}" />
          </label>
          <button data-cart-remove="${item.id}" class="btn btn-light" type="button">Remove</button>
        </div>
      </article>
    `;
  }).join('');

  cartTotalEl.textContent = `Total: ${formatMoney(getCartTotal())}`;
}

function updateCartQuantity(productId, qty) {
  if (!state.cart[productId]) return;
  const safeQty = Math.min(200, Math.max(1, Number(qty) || 1));
  state.cart[productId].qty = safeQty;
  persistCart();
  renderCart();
}

function removeFromCart(productId) {
  delete state.cart[productId];
  persistCart();
  renderCart();
}

function addToCart(product) {
  const existing = state.cart[product.id];
  if (existing) {
    existing.qty = Math.min(200, (Number(existing.qty) || 0) + 1);
  } else {
    state.cart[product.id] = {
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      qty: 1
    };
  }
  persistCart();
  renderCart();
  setCartVisibility(true);
}

function renderCategoryFilters() {
  if (!categoryFiltersEl) return;
  const categories = ['All', ...new Set(state.products.map((item) => item.category).filter(Boolean))];
  categoryFiltersEl.innerHTML = categories.map((category) => {
    const cls = category === state.activeCategory ? 'filter-btn active' : 'filter-btn';
    return `<button class="${cls}" data-category="${category}" type="button">${category}</button>`;
  }).join('');
}

function renderProducts() {
  if (!productGridEl) return;
  const filtered = state.activeCategory === 'All'
    ? state.products
    : state.products.filter((item) => item.category === state.activeCategory);

  if (!filtered.length) {
    productGridEl.innerHTML = '<p class="muted">No products available in this category.</p>';
    return;
  }

  productGridEl.innerHTML = filtered.map((product) => {
    const options = Array.isArray(product.weightOptions) ? product.weightOptions.join(', ') : '--';
    return `
      <article class="product-card">
        <img src="${product.image}" alt="${product.name}" loading="lazy" />
        <div class="product-body">
          <h3>${product.name}</h3>
          <p class="product-meta">${product.category} | Options: ${options}</p>
          <p class="product-meta">${product.description || ''}</p>
          <div class="product-actions">
            <span class="product-price">${formatMoney(product.price)} / ${product.unit || 'unit'}</span>
            <button class="btn btn-primary" type="button" data-add-cart="${product.id}">Add To Cart</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  productGridEl.querySelectorAll('img').forEach((img) => {
    img.addEventListener('error', () => {
      img.src = '/images/freshwater/fallback.svg';
    }, { once: true });
  });
}

function renderLiveRows(rows, emptyMessage = 'No live records available.') {
  if (!liveRowsEl) return;
  if (!Array.isArray(rows) || !rows.length) {
    liveRowsEl.innerHTML = `<tr><td colspan="7">${emptyMessage}</td></tr>`;
    return;
  }

  liveRowsEl.innerHTML = rows.map((row) => {
    const cls = row.changePct > 0 ? 'up' : row.changePct < 0 ? 'down' : 'flat';
    const sign = row.changePct > 0 ? '+' : '';
    return `
      <tr>
        <td>${row.name}</td>
        <td>${row.grade}</td>
        <td>${row.origin}</td>
        <td>${row.stock}</td>
        <td>${formatMoney(row.currentPrice)} / ${row.unit}</td>
        <td><span class="delta ${cls}">${sign}${Number(row.changePct || 0).toFixed(2)}%</span></td>
        <td>${row.freshnessScore}%</td>
      </tr>
    `;
  }).join('');
}

function renderPosts(posts) {
  if (!postGridEl) return;
  if (!Array.isArray(posts) || !posts.length) {
    postGridEl.innerHTML = '<p class="muted">No community posts available.</p>';
    return;
  }
  postGridEl.innerHTML = posts.map((post) => `
    <article class="post-card">
      <img class="post-thumb" src="${post.image || '/images/freshwater/photos/rohu.jpg'}" alt="${post.title || 'Community update'}" loading="lazy" />
      <span class="tag">${post.tag || 'Update'}</span>
      <h3>${post.title}</h3>
      <p>${post.summary || ''}</p>
      <p class="product-meta">Published: ${post.publishedAt || '--'}</p>
    </article>
  `).join('');
  applyImageFallback(postGridEl);
}

function renderTestimonials(testimonials) {
  if (!testimonialListEl) return;
  if (!Array.isArray(testimonials) || !testimonials.length) {
    testimonialListEl.innerHTML = '<p class="muted">No testimonials available.</p>';
    return;
  }
  testimonialListEl.innerHTML = testimonials.map((item) => `
    <article class="testimonial-card">
      <img class="testimonial-thumb" src="${item.image || '/images/freshwater/photos/catla.jpg'}" alt="${item.name || 'Customer'}" loading="lazy" />
      <h3>${item.name}</h3>
      <p class="product-meta">${item.role || ''}</p>
      <p>${item.quote || ''}</p>
    </article>
  `).join('');
  applyImageFallback(testimonialListEl);
}

function formatNotificationStatus(item) {
  const channel = toTitleCase(item?.channel || 'notification');
  if (item?.ok) return `${channel}: sent`;
  const reason = String(item?.reason || '').toLowerCase();
  if (
    reason === 'twilio_credentials_missing' ||
    reason === 'twilio_sms_sender_missing' ||
    reason === 'twilio_whatsapp_from_missing'
  ) {
    return `${channel}: pending setup`;
  }
  if (reason === 'notification_disabled') return `${channel}: disabled`;
  if (reason === 'invalid_phone') return `${channel}: invalid phone`;
  if (item?.reason) return `${channel}: failed (${item.reason})`;
  return `${channel}: failed`;
}

function applyImageFallback(scope = document) {
  scope.querySelectorAll('img').forEach((img) => {
    if (String(img.getAttribute('src') || '').includes('bestfishi-pro-logo.svg')) return;
    img.addEventListener('error', () => {
      img.src = '/images/freshwater/fallback.svg';
    }, { once: true });
  });
}

async function loadOverview() {
  try {
    const data = await requestApi('/api/site/overview', { cache: 'no-store' });
    if (heroMissionEl) {
      heroMissionEl.textContent = data.mission || 'Mission details not available.';
    }

    const badges = Array.isArray(data.trustBadges) ? data.trustBadges : [];
    if (trustBadgesEl) {
      trustBadgesEl.innerHTML = badges.map((label) => {
        const href = badgePageMap[label] || '/freshwater-aquaculture.html';
        return `<a class="badge-pill badge-link" href="${href}">${label}</a>`;
      }).join('');
    }

    const metrics = Array.isArray(data.metrics) ? data.metrics : [];
    if (metricGridEl) {
      metricGridEl.innerHTML = metrics.map((item) => `
      <article class="metric-card">
        <strong>${item.value || '--'}</strong>
        <span>${item.label || ''}</span>
      </article>
    `).join('');
    }
  } catch (error) {
    if (heroMissionEl) {
      heroMissionEl.textContent = 'Mission details are unavailable right now.';
    }
    if (trustBadgesEl) {
      trustBadgesEl.innerHTML = '<span class="badge-pill">Platform data unavailable</span>';
    }
    if (metricGridEl) {
      metricGridEl.innerHTML = `
        <article class="metric-card">
          <strong>--</strong>
          <span>Metrics temporarily unavailable</span>
        </article>
      `;
    }
  }
}

async function loadLiveBoard() {
  try {
    const data = await requestApi('/api/fish/live', { cache: 'no-store' });
    state.liveGeneratedAt = data.generatedAt;
    if (liveSourceEl) liveSourceEl.textContent = `Source: ${data.source || '--'}`;
    if (liveRegionEl) liveRegionEl.textContent = `Region: ${data.region || '--'}`;
    if (liveMetaEl) {
      liveMetaEl.textContent = `Updated ${formatTime(data.generatedAt)} | Highest: ${data.summary?.highest || '--'} | Lowest: ${data.summary?.lowest || '--'}`;
    }
    if (livePulseEl) {
      livePulseEl.textContent = `Live feed synced at ${formatTime(data.generatedAt)}`;
    }
    renderLiveRows(data.rows || []);
  } catch (error) {
    if (liveSourceEl) liveSourceEl.textContent = 'Source: unavailable';
    if (liveRegionEl) liveRegionEl.textContent = 'Region: unavailable';
    if (liveMetaEl) {
      liveMetaEl.textContent = 'Live rates are unavailable right now. Please retry shortly.';
    }
    if (livePulseEl) {
      livePulseEl.textContent = 'Live sync unavailable.';
    }
    renderLiveRows([], 'No data available right now.');
  }
}

async function loadProducts() {
  try {
    const data = await requestApi('/api/shop/products', { cache: 'no-store' });
    state.products = Array.isArray(data.products) ? data.products : [];
    renderCategoryFilters();
    renderProducts();
  } catch (error) {
    if (categoryFiltersEl) {
      categoryFiltersEl.innerHTML = '<span class="muted">Categories unavailable.</span>';
    }
    if (productGridEl) {
      productGridEl.innerHTML = '<p class="muted">Products are unavailable right now.</p>';
    }
  }
}

async function loadCommunity() {
  try {
    const [postsData, testimonialData] = await Promise.all([
      requestApi('/api/community/posts', { cache: 'no-store' }),
      requestApi('/api/testimonials', { cache: 'no-store' })
    ]);
    renderPosts(postsData.posts || []);
    renderTestimonials(testimonialData.testimonials || []);
  } catch (error) {
    if (postGridEl) {
      postGridEl.innerHTML = '<p class="muted">Community feed is unavailable right now.</p>';
    }
    if (testimonialListEl) {
      testimonialListEl.innerHTML = '<p class="muted">Testimonials are unavailable right now.</p>';
    }
  }
}

async function submitSalesForm(event) {
  event.preventDefault();
  if (!(salesFormEl instanceof HTMLFormElement)) return;
  if (salesStatusEl) salesStatusEl.textContent = 'Submitting inquiry...';

  const formData = new FormData(salesFormEl);
  const body = {
    name: String(formData.get('name') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    company: String(formData.get('company') || '').trim(),
    message: String(formData.get('message') || '').trim()
  };

  try {
    const payload = await requestApi('/api/contact/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (salesStatusEl) salesStatusEl.textContent = payload.message || 'Inquiry submitted successfully.';
    if (salesFormEl) salesFormEl.reset();
  } catch (error) {
    if (salesStatusEl) salesStatusEl.textContent = `Error: ${error.message}`;
  }
}

async function submitComplaint(event) {
  event.preventDefault();
  if (!(complaintFormEl instanceof HTMLFormElement)) return;
  if (complaintStatusEl) complaintStatusEl.textContent = 'Submitting complaint...';

  const formData = new FormData(complaintFormEl);
  const body = {
    name: String(formData.get('name') || '').trim(),
    contact: String(formData.get('contact') || '').trim(),
    orderId: String(formData.get('orderId') || '').trim(),
    category: String(formData.get('category') || '').trim(),
    message: String(formData.get('message') || '').trim()
  };

  try {
    const payload = await requestApi('/api/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (complaintStatusEl) complaintStatusEl.textContent = `${payload.message} Ticket: ${payload.complaintId}`;
    if (complaintFormEl) complaintFormEl.reset();
  } catch (error) {
    if (complaintStatusEl) complaintStatusEl.textContent = `Error: ${error.message}`;
  }
}

async function submitCheckout(event) {
  event.preventDefault();
  if (!(checkoutFormEl instanceof HTMLFormElement)) return;

  const items = Object.values(state.cart).map((item) => ({
    id: item.id,
    qty: Number(item.qty) || 1
  }));

  if (!items.length) {
    if (checkoutStatusEl) checkoutStatusEl.textContent = 'Your cart is empty.';
    return;
  }

  if (checkoutStatusEl) checkoutStatusEl.textContent = 'Placing order...';
  const formData = new FormData(checkoutFormEl);
  const body = {
    customerName: String(formData.get('customerName') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    notifyPreference: String(formData.get('notifyPreference') || 'both').trim(),
    address: String(formData.get('address') || '').trim(),
    notes: String(formData.get('notes') || '').trim(),
    items
  };

  try {
    const payload = await requestApi('/api/shop/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const notifySummary = Array.isArray(payload.notification)
      ? payload.notification.map((item) => formatNotificationStatus(item)).join(' | ')
      : 'Notification status unavailable';
    if (checkoutStatusEl) {
      checkoutStatusEl.textContent = `${payload.message} Order: ${payload.orderId} | Total: ${formatMoney(payload.grandTotal)} | ${notifySummary}`;
    }
    if (checkoutFormEl) checkoutFormEl.reset();
    state.cart = {};
    persistCart();
    renderCart();
  } catch (error) {
    if (checkoutStatusEl) checkoutStatusEl.textContent = `Error: ${error.message}`;
  }
}

function setupReveal() {
  const nodes = document.querySelectorAll('.reveal');
  nodes.forEach((node) => {
    node.style.transitionDelay = '0ms';
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
}

function setupHeroVideoPlayback() {
  if (!(heroVideoEl instanceof HTMLVideoElement)) return;

  const enableVideoFallback = () => {
    if (heroSectionEl) {
      heroSectionEl.classList.add('hero-video-fallback');
    }
    heroVideoEl.classList.remove('is-ready');
  };

  const disableVideoFallback = () => {
    if (heroSectionEl) {
      heroSectionEl.classList.remove('hero-video-fallback');
    }
    heroVideoEl.classList.add('is-ready');
  };

  heroVideoEl.muted = true;
  heroVideoEl.defaultMuted = true;
  heroVideoEl.playsInline = true;
  heroVideoEl.setAttribute('muted', '');
  heroVideoEl.setAttribute('playsinline', '');
  heroVideoEl.setAttribute('webkit-playsinline', '');

  let retryTimer = null;
  let stopped = false;

  const clearRetry = () => {
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
  };

  const attemptPlay = async () => {
    if (stopped) return;
    try {
      const playPromise = heroVideoEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        await playPromise;
      }
      disableVideoFallback();
      clearRetry();
    } catch (error) {
      // Autoplay can be delayed by browser policies, retry below.
    }
  };

  heroVideoEl.addEventListener('canplay', () => {
    disableVideoFallback();
    attemptPlay();
  });
  heroVideoEl.addEventListener('playing', disableVideoFallback);
  heroVideoEl.addEventListener('loadeddata', attemptPlay, { once: true });
  heroVideoEl.addEventListener('error', enableVideoFallback);
  heroVideoEl.addEventListener('stalled', enableVideoFallback);
  heroVideoEl.addEventListener('abort', enableVideoFallback);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (heroVideoEl.paused) attemptPlay();
  });

  window.addEventListener('pageshow', () => {
    if (heroVideoEl.paused) attemptPlay();
  });

  // If browser delays autoplay, try again after ~2 seconds and continue retrying.
  setTimeout(() => {
    if (heroVideoEl.paused) attemptPlay();
  }, 2000);

  retryTimer = setInterval(() => {
    if (!heroVideoEl.paused) {
      clearRetry();
      return;
    }
    attemptPlay();
  }, 2000);

  setTimeout(() => {
    if (heroVideoEl.paused) {
      enableVideoFallback();
    }
  }, 5000);

  attemptPlay();

  window.addEventListener('beforeunload', () => {
    stopped = true;
    clearRetry();
  });
}

function setupOperationsShowcaseSlider() {
  if (!(opsShowcaseEl instanceof HTMLElement)) return;
  if (!(opsViewportEl instanceof HTMLElement)) return;
  if (!(opsTrackEl instanceof HTMLElement)) return;

  const slides = Array.from(opsTrackEl.querySelectorAll('.ops-slide'));
  if (!slides.length) return;

  let currentIndex = 0;
  let maxIndex = 0;
  let perView = 1;
  let autoTimer = null;
  let isHovered = false;
  let resizeRaf = null;

  const getPerView = () => {
    const width = opsViewportEl.clientWidth || window.innerWidth;
    if (width >= 1400) return 4;
    if (width >= 980) return 3;
    if (width >= 680) return 2;
    return 1;
  };

  const stopAuto = () => {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  };

  const renderDots = () => {
    if (!(opsDotsEl instanceof HTMLElement)) return;
    const dotCount = maxIndex + 1;
    opsDotsEl.innerHTML = '';
    for (let i = 0; i < dotCount; i += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = i === currentIndex ? 'ops-dot active' : 'ops-dot';
      btn.setAttribute('aria-label', `Go to slide ${i + 1}`);
      btn.dataset.opsIndex = String(i);
      opsDotsEl.appendChild(btn);
    }
  };

  const syncButtons = () => {
    const disabled = maxIndex <= 0;
    if (opsPrevBtn instanceof HTMLButtonElement) opsPrevBtn.disabled = disabled;
    if (opsNextBtn instanceof HTMLButtonElement) opsNextBtn.disabled = disabled;
  };

  const updatePosition = () => {
    const baseOffset = slides[0]?.offsetLeft || 0;
    const activeOffset = slides[currentIndex]?.offsetLeft || baseOffset;
    const delta = activeOffset - baseOffset;
    opsTrackEl.style.transform = `translate3d(${-delta}px, 0, 0)`;

    slides.forEach((slide, index) => {
      slide.classList.toggle('is-active', index >= currentIndex && index < currentIndex + perView);
    });

    if (opsDotsEl instanceof HTMLElement) {
      opsDotsEl.querySelectorAll('.ops-dot').forEach((dot, dotIndex) => {
        dot.classList.toggle('active', dotIndex === currentIndex);
      });
    }
  };

  const updateLayout = () => {
    perView = getPerView();
    maxIndex = Math.max(0, slides.length - perView);
    currentIndex = Math.min(currentIndex, maxIndex);
    opsTrackEl.style.setProperty('--ops-per-view', String(perView));
    renderDots();
    syncButtons();
    updatePosition();
  };

  const goTo = (nextIndex) => {
    if (maxIndex <= 0) {
      currentIndex = 0;
      updatePosition();
      return;
    }

    let target = Number(nextIndex);
    if (!Number.isFinite(target)) target = 0;
    if (target > maxIndex) target = 0;
    if (target < 0) target = maxIndex;
    currentIndex = target;
    updatePosition();
  };

  const startAuto = () => {
    stopAuto();
    if (maxIndex <= 0) return;
    autoTimer = setInterval(() => {
      if (document.hidden || isHovered) return;
      goTo(currentIndex + 1);
    }, 3800);
  };

  if (opsPrevBtn instanceof HTMLButtonElement) {
    opsPrevBtn.addEventListener('click', () => {
      goTo(currentIndex - 1);
      startAuto();
    });
  }

  if (opsNextBtn instanceof HTMLButtonElement) {
    opsNextBtn.addEventListener('click', () => {
      goTo(currentIndex + 1);
      startAuto();
    });
  }

  if (opsDotsEl instanceof HTMLElement) {
    opsDotsEl.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const index = Number(target.dataset.opsIndex);
      if (!Number.isFinite(index)) return;
      goTo(index);
      startAuto();
    });
  }

  opsShowcaseEl.addEventListener('mouseenter', () => {
    isHovered = true;
  });
  opsShowcaseEl.addEventListener('mouseleave', () => {
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
}

function setupEvents() {
  if (categoryFiltersEl) {
    categoryFiltersEl.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const category = target.dataset.category;
      if (!category) return;
      state.activeCategory = category;
      renderCategoryFilters();
      renderProducts();
    });
  }

  if (productGridEl) {
    productGridEl.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest('[data-add-cart]');
      if (!(button instanceof HTMLButtonElement)) return;
      const id = button.dataset.addCart;
      const product = state.products.find((item) => item.id === id);
      if (!product) return;
      addToCart(product);
    });
  }

  if (cartItemsEl) {
    cartItemsEl.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest('[data-cart-remove]');
      if (!(button instanceof HTMLButtonElement)) return;
      const id = button.dataset.cartRemove;
      if (!id) return;
      removeFromCart(id);
    });

    cartItemsEl.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const id = target.dataset.cartQty;
      if (!id) return;
      updateCartQuantity(id, target.value);
    });
  }

  if (openCartBtn) {
    openCartBtn.addEventListener('click', () => {
      if (openCartBtn instanceof HTMLAnchorElement) return;
      setCartVisibility(true);
    });
  }
  if (closeCartBtn) {
    closeCartBtn.addEventListener('click', () => setCartVisibility(false));
  }
  if (cartBackdropEl) {
    cartBackdropEl.addEventListener('click', () => setCartVisibility(false));
  }

  if (salesFormEl) {
    salesFormEl.addEventListener('submit', submitSalesForm);
  }
  if (complaintFormEl) {
    complaintFormEl.addEventListener('submit', submitComplaint);
  }
  if (checkoutFormEl) {
    checkoutFormEl.addEventListener('submit', submitCheckout);
  }

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setCartVisibility(false);
  });
}

async function boot() {
  applyImageFallback();
  renderLiveRows([], 'Loading live data...');
  setupHeroVideoPlayback();
  setupOperationsShowcaseSlider();
  setupReveal();
  setupEvents();
  renderCart();

  await Promise.all([
    loadOverview(),
    loadProducts(),
    loadCommunity(),
    loadLiveBoard()
  ]);

  setInterval(loadLiveBoard, 12000);
}

boot();
