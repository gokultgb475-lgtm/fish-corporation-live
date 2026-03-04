const authForm = document.getElementById('authForm');
const adminKeyInput = document.getElementById('adminKeyInput');
const authStatus = document.getElementById('authStatus');
const refreshBtn = document.getElementById('refreshBtn');
const ordersCount = document.getElementById('ordersCount');
const complaintsCount = document.getElementById('complaintsCount');
const inquiriesCount = document.getElementById('inquiriesCount');
const lastSync = document.getElementById('lastSync');
const ordersList = document.getElementById('ordersList');
const complaintsList = document.getElementById('complaintsList');
const inquiriesList = document.getElementById('inquiriesList');

const state = {
  adminKey: localStorage.getItem('bestfishi_admin_key') || '',
  apiBase: ''
};

if (state.adminKey) {
  adminKeyInput.value = state.adminKey;
}

function formatTime(iso) {
  if (!iso) return '--';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatMoney(value) {
  return `Rs.${Number(value || 0).toFixed(2)}`;
}

function statusClass(value) {
  return `status-${String(value || 'pending').toLowerCase().replace(/[^a-z0-9_]+/g, '_')}`;
}

function buildApiCandidates() {
  const list = [];
  list.push('');

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
  if (!state.adminKey) {
    throw new Error('Admin key required.');
  }

  const errors = [];
  for (const base of apiCandidates) {
    try {
      const response = await fetch(toApiUrl(base, path), {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': state.adminKey,
          ...(options.headers || {})
        }
      });
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

  throw new Error(errors[errors.length - 1] || 'API error');
}

function renderOrderCards(orders) {
  if (!Array.isArray(orders) || !orders.length) {
    ordersList.innerHTML = '<p class="muted">No orders yet.</p>';
    return;
  }

  ordersList.innerHTML = orders.map((item) => {
    const lines = Array.isArray(item.items) ? item.items : [];
    const linesHtml = lines.map((line) => `<li>${line.id} x ${line.qty} (${formatMoney(line.lineTotal)})</li>`).join('');

    return `
      <article class="record-card">
        <div class="record-head">
          <h3>${item.orderId}</h3>
          <span class="status-chip ${statusClass(item.status || 'pending')}">${item.status || 'pending'}</span>
        </div>
        <p class="record-meta">${item.customerName} | ${item.phone} | ${formatTime(item.createdAt)}</p>
        <div class="record-grid">
          <div>
            <p class="record-meta"><strong>Address:</strong> ${item.address || '-'}</p>
            <p class="record-meta"><strong>Total:</strong> ${formatMoney(item.grandTotal)}</p>
            <p class="record-meta"><strong>Notify By:</strong> ${item.notifyPreference || 'both'}</p>
          </div>
          <div>
            <p class="record-meta"><strong>Items:</strong></p>
            <ul class="record-meta">${linesHtml}</ul>
          </div>
        </div>
        <form class="status-form" data-type="order" data-id="${item.orderId}">
          <select name="status">
            <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>pending</option>
            <option value="confirmed" ${item.status === 'confirmed' ? 'selected' : ''}>confirmed</option>
            <option value="dispatched" ${item.status === 'dispatched' ? 'selected' : ''}>dispatched</option>
            <option value="delivered" ${item.status === 'delivered' ? 'selected' : ''}>delivered</option>
            <option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>cancelled</option>
          </select>
          <button class="btn btn-primary" type="submit">Update</button>
        </form>
      </article>
    `;
  }).join('');
}

function renderComplaintCards(complaints) {
  if (!Array.isArray(complaints) || !complaints.length) {
    complaintsList.innerHTML = '<p class="muted">No complaints yet.</p>';
    return;
  }

  complaintsList.innerHTML = complaints.map((item) => `
    <article class="record-card">
      <div class="record-head">
        <h3>${item.category || 'Complaint'}</h3>
        <span class="status-chip ${statusClass(item.status || 'open')}">${item.status || 'open'}</span>
      </div>
      <p class="record-meta">${item.name} | ${item.contact} | ${formatTime(item.createdAt)}</p>
      <p class="record-meta"><strong>Order:</strong> ${item.orderId || 'N/A'}</p>
      <p class="record-meta"><strong>Message:</strong> ${item.message || ''}</p>
      <form class="status-form" data-type="complaint" data-id="${item.id}">
        <select name="status">
          <option value="open" ${item.status === 'open' ? 'selected' : ''}>open</option>
          <option value="in_progress" ${item.status === 'in_progress' ? 'selected' : ''}>in_progress</option>
          <option value="resolved" ${item.status === 'resolved' ? 'selected' : ''}>resolved</option>
          <option value="closed" ${item.status === 'closed' ? 'selected' : ''}>closed</option>
        </select>
        <button class="btn btn-primary" type="submit">Update</button>
      </form>
    </article>
  `).join('');
}

function renderInquiryCards(inquiries) {
  if (!Array.isArray(inquiries) || !inquiries.length) {
    inquiriesList.innerHTML = '<p class="muted">No sales inquiries yet.</p>';
    return;
  }

  inquiriesList.innerHTML = inquiries.map((item) => `
    <article class="record-card">
      <div class="record-head">
        <h3>${item.name}</h3>
        <span class="status-chip ${statusClass(item.status || 'new')}">${item.status || 'new'}</span>
      </div>
      <p class="record-meta">${item.phone || '-'} | ${item.email || '-'} | ${formatTime(item.createdAt)}</p>
      <p class="record-meta"><strong>Company:</strong> ${item.company || '-'}</p>
      <p class="record-meta"><strong>Message:</strong> ${item.message || ''}</p>
      <form class="status-form" data-type="inquiry" data-id="${item.id}">
        <select name="status">
          <option value="new" ${item.status === 'new' ? 'selected' : ''}>new</option>
          <option value="contacted" ${item.status === 'contacted' ? 'selected' : ''}>contacted</option>
          <option value="qualified" ${item.status === 'qualified' ? 'selected' : ''}>qualified</option>
          <option value="closed" ${item.status === 'closed' ? 'selected' : ''}>closed</option>
        </select>
        <button class="btn btn-primary" type="submit">Update</button>
      </form>
    </article>
  `).join('');
}

async function refreshDashboard() {
  try {
    const [ordersPayload, complaintsPayload, inquiriesPayload] = await Promise.all([
      requestApi('/api/admin/orders'),
      requestApi('/api/complaints'),
      requestApi('/api/admin/sales-inquiries')
    ]);

    const orders = Array.isArray(ordersPayload.orders) ? ordersPayload.orders : [];
    const complaints = Array.isArray(complaintsPayload.complaints) ? complaintsPayload.complaints : [];
    const inquiries = Array.isArray(inquiriesPayload.inquiries) ? inquiriesPayload.inquiries : [];

    ordersCount.textContent = String(orders.length);
    complaintsCount.textContent = String(complaints.length);
    inquiriesCount.textContent = String(inquiries.length);
    lastSync.textContent = formatTime(new Date().toISOString());

    renderOrderCards(orders);
    renderComplaintCards(complaints);
    renderInquiryCards(inquiries);

    authStatus.textContent = `Dashboard connected (${state.apiBase || 'same-origin'})`;
    authStatus.className = 'ok';
  } catch (error) {
    authStatus.textContent = `Dashboard error: ${error.message}`;
    authStatus.className = 'error';
  }
}

async function updateStatus(type, id, status) {
  if (type === 'order') {
    return requestApi(`/api/admin/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }

  if (type === 'complaint') {
    return requestApi(`/api/admin/complaints/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }

  if (type === 'inquiry') {
    return requestApi(`/api/admin/sales-inquiries/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }

  throw new Error('Unknown status type.');
}

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  state.adminKey = adminKeyInput.value.trim();
  localStorage.setItem('bestfishi_admin_key', state.adminKey);
  authStatus.textContent = 'Connecting dashboard...';
  authStatus.className = 'muted';
  await refreshDashboard();
});

refreshBtn.addEventListener('click', refreshDashboard);

document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (!form.classList.contains('status-form')) return;

  event.preventDefault();
  const type = form.dataset.type;
  const id = form.dataset.id;
  const select = form.querySelector('select[name="status"]');
  if (!type || !id || !(select instanceof HTMLSelectElement)) return;

  try {
    const payload = await updateStatus(type, id, select.value);
    authStatus.textContent = payload?.message || 'Status updated successfully.';
    authStatus.className = 'ok';
    await refreshDashboard();
  } catch (error) {
    authStatus.textContent = `Update failed: ${error.message}`;
    authStatus.className = 'error';
  }
});

if (state.adminKey) {
  refreshDashboard();
}

setInterval(() => {
  if (!state.adminKey) return;
  refreshDashboard();
}, 15000);
