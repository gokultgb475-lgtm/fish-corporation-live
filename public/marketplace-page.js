const marketplaceGrid = document.getElementById('marketplaceGrid');
const marketplaceStatus = document.getElementById('marketplaceStatus');

function formatMoney(value) {
  return `Rs.${Number(value || 0).toFixed(2)}`;
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

async function requestApi(path) {
  const errors = [];
  for (const base of apiCandidates) {
    try {
      const response = await fetch(toApiUrl(base, path), { cache: 'no-store' });
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

function renderProducts(products) {
  if (!Array.isArray(products) || !products.length) {
    marketplaceGrid.innerHTML = '<p class="muted">No products available.</p>';
    return;
  }

  marketplaceGrid.innerHTML = products.slice(0, 12).map((product) => {
    const options = Array.isArray(product.weightOptions) ? product.weightOptions.join(', ') : '--';
    return `
      <article class="feature">
        <img src="${product.image}" alt="${product.name}" loading="lazy" />
        <h3>${product.name}</h3>
        <p>${product.description || ''}</p>
        <p><strong>${formatMoney(product.price)} / ${product.unit || 'unit'}</strong></p>
        <p class="muted">Options: ${options}</p>
      </article>
    `;
  }).join('');

  marketplaceGrid.querySelectorAll('img').forEach((img) => {
    img.addEventListener('error', () => {
      img.src = '/images/freshwater/fallback.svg';
    }, { once: true });
  });
}

(async function init() {
  try {
    const payload = await requestApi('/api/shop/products');
    renderProducts(payload.products || []);
    marketplaceStatus.textContent = `Showing ${Array.isArray(payload.products) ? payload.products.length : 0} freshwater products.`;
    marketplaceStatus.className = 'status ok';
  } catch (error) {
    marketplaceStatus.textContent = `Error: ${error.message}`;
    marketplaceStatus.className = 'status error';
    marketplaceGrid.innerHTML = '';
  }
})();
