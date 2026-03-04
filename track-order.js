const trackForm = document.getElementById('trackForm');
const trackStatus = document.getElementById('trackStatus');
const trackResult = document.getElementById('trackResult');

function formatMoney(value) {
  return `Rs.${Number(value || 0).toFixed(2)}`;
}

function formatTime(iso) {
  if (!iso) return '--';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
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

trackForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  trackStatus.textContent = 'Checking order...';
  trackStatus.className = 'status';

  const formData = new FormData(trackForm);
  const orderId = String(formData.get('orderId') || '').trim();
  const phone = String(formData.get('phone') || '').trim();

  try {
    const payload = await requestApi(`/api/orders/track?orderId=${encodeURIComponent(orderId)}&phone=${encodeURIComponent(phone)}`);
    trackStatus.textContent = `Current situation: ${payload.status}`;
    trackStatus.className = 'status ok';

    const items = Array.isArray(payload.items) ? payload.items : [];
    const itemsHtml = items.map((item) => `<li>${item.id} x ${item.qty}</li>`).join('');

    trackResult.innerHTML = `
      <article class="feature">
        <h3>Order ${payload.orderId}</h3>
        <p><strong>Status:</strong> ${payload.status}</p>
        <p><strong>Created:</strong> ${formatTime(payload.createdAt)}</p>
        <p><strong>Updated:</strong> ${formatTime(payload.updatedAt)}</p>
        <p><strong>Total:</strong> ${formatMoney(payload.grandTotal)}</p>
        <p><strong>Notification Mode:</strong> ${payload.notifyPreference}</p>
        <p><strong>Items:</strong></p>
        <ul>${itemsHtml}</ul>
      </article>
    `;
  } catch (error) {
    trackStatus.textContent = `Error: ${error.message}`;
    trackStatus.className = 'status error';
    trackResult.innerHTML = '';
  }
});

(function prefillFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('orderId');
  const phone = params.get('phone');
  if (orderId) trackForm.elements.orderId.value = orderId;
  if (phone) trackForm.elements.phone.value = phone;
})();
