const shopGrid = document.getElementById('shopGrid');
const selectedItemsEl = document.getElementById('selectedItems');
const selectedTotalEl = document.getElementById('selectedTotal');
const shopOrderForm = document.getElementById('shopOrderForm');
const orderStatusEl = document.getElementById('orderStatus');

const state = {
  products: [],
  selected: {}
};

function formatMoney(value) {
  return `Rs.${Number(value || 0).toFixed(2)}`;
}

function toTitleCase(value) {
  return String(value || '')
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
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

function buildApiCandidates() {
  const list = [''];
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  if (window.location.protocol === 'file:') {
    list.push('http://localhost:4080');
  } else if (isLocal && window.location.port !== '4080') {
    list.push('http://localhost:4080');
  }
  return [...new Set(list)];
}

const apiCandidates = buildApiCandidates();

function toApiUrl(base, path) {
  return base ? `${base}${path}` : path;
}

async function parseJsonSafe(response) {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { error: `Invalid response (${response.status})` };
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
      return payload;
    } catch (error) {
      errors.push(error?.message || 'Network error');
    }
  }
  throw new Error(errors[errors.length - 1] || 'API error');
}

function getSelectedList() {
  return Object.values(state.selected).filter((item) => item.qty > 0);
}

function getSelectedTotal() {
  return getSelectedList().reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);
}

function renderSelected() {
  const items = getSelectedList();
  if (!items.length) {
    selectedItemsEl.innerHTML = '<p class="muted">No items selected.</p>';
    selectedTotalEl.textContent = 'Total: Rs.0.00';
    return;
  }

  selectedItemsEl.innerHTML = items.map((item) => `
    <div class="feature">
      <h3>${item.name}</h3>
      <p>${formatMoney(item.price)} x ${item.qty} = ${formatMoney(item.price * item.qty)}</p>
    </div>
  `).join('');

  selectedTotalEl.textContent = `Total: ${formatMoney(getSelectedTotal())}`;
}

function renderProducts() {
  if (!state.products.length) {
    shopGrid.innerHTML = '<p class="muted">No products found.</p>';
    return;
  }

  shopGrid.innerHTML = state.products.map((product) => {
    const options = Array.isArray(product.weightOptions) ? product.weightOptions.join(', ') : '--';
    return `
      <article class="feature">
        <img src="${product.image}" alt="${product.name}" loading="lazy" />
        <h3>${product.name}</h3>
        <p>${product.description || ''}</p>
        <p><strong>${formatMoney(product.price)} / ${product.unit || 'unit'}</strong></p>
        <p class="muted">Options: ${options}</p>
        <div class="form-grid">
          <input type="number" data-qty-input="${product.id}" min="0" max="200" value="${state.selected[product.id]?.qty || 0}" />
          <button class="btn btn-light" type="button" data-add="${product.id}">Update Selection</button>
        </div>
      </article>
    `;
  }).join('');

  shopGrid.querySelectorAll('img').forEach((img) => {
    img.addEventListener('error', () => {
      img.src = '/images/freshwater/fallback.svg';
    }, { once: true });
  });
}

async function loadProducts() {
  try {
    const data = await requestApi('/api/shop/products', { cache: 'no-store' });
    state.products = Array.isArray(data.products) ? data.products : [];
    renderProducts();
    renderSelected();
  } catch (error) {
    shopGrid.innerHTML = `<p class="muted">${error.message}</p>`;
  }
}

shopGrid.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const button = target.closest('[data-add]');
  if (!(button instanceof HTMLButtonElement)) return;
  const id = button.dataset.add;
  if (!id) return;

  const input = shopGrid.querySelector(`input[data-qty-input="${id}"]`);
  if (!(input instanceof HTMLInputElement)) return;
  const qty = Math.max(0, Math.min(200, Number(input.value) || 0));

  const product = state.products.find((item) => item.id === id);
  if (!product) return;

  if (qty === 0) {
    delete state.selected[id];
  } else {
    state.selected[id] = {
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      qty
    };
  }

  renderSelected();
});

shopOrderForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const items = getSelectedList().map((item) => ({ id: item.id, qty: item.qty }));
  if (!items.length) {
    orderStatusEl.textContent = 'Select at least one item before placing order.';
    orderStatusEl.className = 'status error';
    return;
  }

  const formData = new FormData(shopOrderForm);
  const body = {
    customerName: String(formData.get('customerName') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    notifyPreference: String(formData.get('notifyPreference') || 'both').trim(),
    address: String(formData.get('address') || '').trim(),
    notes: String(formData.get('notes') || '').trim(),
    items
  };

  orderStatusEl.textContent = 'Placing order...';
  orderStatusEl.className = 'status';

  try {
    const payload = await requestApi('/api/shop/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const notifySummary = Array.isArray(payload.notification)
      ? payload.notification.map((item) => formatNotificationStatus(item)).join(' | ')
      : 'Notification status unavailable';

    orderStatusEl.textContent = `${payload.message} Order: ${payload.orderId} | ${notifySummary}`;
    orderStatusEl.className = 'status ok';
    shopOrderForm.reset();
    state.selected = {};
    renderProducts();
    renderSelected();
  } catch (error) {
    orderStatusEl.textContent = `Error: ${error.message}`;
    orderStatusEl.className = 'status error';
  }
});

loadProducts();
