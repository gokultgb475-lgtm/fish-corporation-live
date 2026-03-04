const salesForm = document.getElementById('salesForm');
const complaintForm = document.getElementById('complaintForm');
const salesStatus = document.getElementById('salesStatus');
const complaintStatus = document.getElementById('complaintStatus');

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

salesForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  salesStatus.textContent = 'Submitting inquiry...';
  salesStatus.className = 'status';

  const formData = new FormData(salesForm);
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
    salesStatus.textContent = payload.message || 'Inquiry submitted successfully.';
    salesStatus.className = 'status ok';
    salesForm.reset();
  } catch (error) {
    salesStatus.textContent = `Error: ${error.message}`;
    salesStatus.className = 'status error';
  }
});

complaintForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  complaintStatus.textContent = 'Submitting complaint...';
  complaintStatus.className = 'status';

  const formData = new FormData(complaintForm);
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
    complaintStatus.textContent = `${payload.message || 'Complaint submitted.'} Ticket: ${payload.complaintId || '--'}`;
    complaintStatus.className = 'status ok';
    complaintForm.reset();
  } catch (error) {
    complaintStatus.textContent = `Error: ${error.message}`;
    complaintStatus.className = 'status error';
  }
});
