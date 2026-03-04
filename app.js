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
  localStorage.setItem('bestfishi_cart', JSON.stringify(state.cart));
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

async function requestApi(path, options = {}) {
  const errors = [];

  for (const base of apiCandidates) {
    try {
      const response = await fetch(toApiUrl(base, path), options);
      const payload = await parseJsonSafe(response);
      if (!response.ok) {
        errors.push(payload?.error || `HTTP ${response.status}`);
        continue;
      }
      state.apiBase = base;
      return payload;
    } catch (error) {
      errors.push(error?.message || 'Network error');
    }
  }

  const tail = errors[errors.length - 1] || 'Network error';
  throw new Error(`Unable to reach backend. Run 'npm run start'. Last error: ${tail}`);
}

function setCartVisibility(visible) {
  cartDrawerEl.hidden = !visible;
  cartBackdropEl.hidden = !visible;
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
  const items = Object.values(state.cart);
  cartCountEl.textContent = String(getCartCount());

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
  const categories = ['All', ...new Set(state.products.map((item) => item.category).filter(Boolean))];
  categoryFiltersEl.innerHTML = categories.map((category) => {
    const cls = category === state.activeCategory ? 'filter-btn active' : 'filter-btn';
    return `<button class="${cls}" data-category="${category}" type="button">${category}</button>`;
  }).join('');
}

function renderProducts() {
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

function renderLiveRows(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    liveRowsEl.innerHTML = '<tr><td colspan="7">No live records available.</td></tr>';
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
    heroMissionEl.textContent = data.mission || 'Mission details not available.';

    const badges = Array.isArray(data.trustBadges) ? data.trustBadges : [];
    trustBadgesEl.innerHTML = badges.map((label) => {
      const href = badgePageMap[label] || '/freshwater-aquaculture.html';
      return `<a class="badge-pill badge-link" href="${href}">${label}</a>`;
    }).join('');

    const metrics = Array.isArray(data.metrics) ? data.metrics : [];
    metricGridEl.innerHTML = metrics.map((item) => `
      <article class="metric-card">
        <strong>${item.value || '--'}</strong>
        <span>${item.label || ''}</span>
      </article>
    `).join('');
  } catch (error) {
    heroMissionEl.textContent = error.message;
  }
}

async function loadLiveBoard() {
  try {
    const data = await requestApi('/api/fish/live', { cache: 'no-store' });
    state.liveGeneratedAt = data.generatedAt;
    liveSourceEl.textContent = `Source: ${data.source || '--'}`;
    liveRegionEl.textContent = `Region: ${data.region || '--'}`;
    liveMetaEl.textContent = `Updated ${formatTime(data.generatedAt)} | Highest: ${data.summary?.highest || '--'} | Lowest: ${data.summary?.lowest || '--'}`;
    livePulseEl.textContent = `Live feed synced at ${formatTime(data.generatedAt)}`;
    renderLiveRows(data.rows || []);
  } catch (error) {
    liveMetaEl.textContent = `Live rate error: ${error.message}`;
    livePulseEl.textContent = 'Live sync interrupted. Retrying...';
  }
}

async function loadProducts() {
  try {
    const data = await requestApi('/api/shop/products', { cache: 'no-store' });
    state.products = Array.isArray(data.products) ? data.products : [];
    renderCategoryFilters();
    renderProducts();
  } catch (error) {
    productGridEl.innerHTML = `<p class="muted">${error.message}</p>`;
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
    postGridEl.innerHTML = `<p class="muted">${error.message}</p>`;
    testimonialListEl.innerHTML = `<p class="muted">${error.message}</p>`;
  }
}

async function submitSalesForm(event) {
  event.preventDefault();
  salesStatusEl.textContent = 'Submitting inquiry...';

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
    salesStatusEl.textContent = payload.message || 'Inquiry submitted successfully.';
    salesFormEl.reset();
  } catch (error) {
    salesStatusEl.textContent = `Error: ${error.message}`;
  }
}

async function submitComplaint(event) {
  event.preventDefault();
  complaintStatusEl.textContent = 'Submitting complaint...';

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
    complaintStatusEl.textContent = `${payload.message} Ticket: ${payload.complaintId}`;
    complaintFormEl.reset();
  } catch (error) {
    complaintStatusEl.textContent = `Error: ${error.message}`;
  }
}

async function submitCheckout(event) {
  event.preventDefault();

  const items = Object.values(state.cart).map((item) => ({
    id: item.id,
    qty: Number(item.qty) || 1
  }));

  if (!items.length) {
    checkoutStatusEl.textContent = 'Your cart is empty.';
    return;
  }

  checkoutStatusEl.textContent = 'Placing order...';
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
    checkoutStatusEl.textContent = `${payload.message} Order: ${payload.orderId} | Total: ${formatMoney(payload.grandTotal)} | ${notifySummary}`;
    checkoutFormEl.reset();
    state.cart = {};
    persistCart();
    renderCart();
  } catch (error) {
    checkoutStatusEl.textContent = `Error: ${error.message}`;
  }
}

function setupReveal() {
  const nodes = document.querySelectorAll('.reveal');
  nodes.forEach((node, index) => {
    node.style.transitionDelay = `${Math.min(index * 40, 360)}ms`;
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

  const markReady = () => {
    heroVideoEl.classList.add('is-ready');
  };

  const attemptPlay = async () => {
    if (stopped) return;
    try {
      const playPromise = heroVideoEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        await playPromise;
      }
      markReady();
      clearRetry();
    } catch (error) {
      // Autoplay can be delayed by browser policies, retry below.
    }
  };

  heroVideoEl.addEventListener('canplay', () => {
    markReady();
    attemptPlay();
  });
  heroVideoEl.addEventListener('playing', markReady);
  heroVideoEl.addEventListener('loadeddata', attemptPlay, { once: true });

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

  attemptPlay();

  window.addEventListener('beforeunload', () => {
    stopped = true;
    clearRetry();
  });
}

function setupEvents() {
  categoryFiltersEl.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const category = target.dataset.category;
    if (!category) return;
    state.activeCategory = category;
    renderCategoryFilters();
    renderProducts();
  });

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

  openCartBtn.addEventListener('click', () => {
    if (openCartBtn instanceof HTMLAnchorElement) return;
    setCartVisibility(true);
  });
  closeCartBtn.addEventListener('click', () => setCartVisibility(false));
  cartBackdropEl.addEventListener('click', () => setCartVisibility(false));

  salesFormEl.addEventListener('submit', submitSalesForm);
  complaintFormEl.addEventListener('submit', submitComplaint);
  checkoutFormEl.addEventListener('submit', submitCheckout);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setCartVisibility(false);
  });
}

async function boot() {
  applyImageFallback();
  setupHeroVideoPlayback();
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
