const postsEl = document.getElementById('communityPosts');
const testimonialsEl = document.getElementById('communityTestimonials');
const statusEl = document.getElementById('communityStatus');

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

function renderPosts(posts) {
  if (!Array.isArray(posts) || !posts.length) {
    postsEl.innerHTML = '<p class="muted">No posts available.</p>';
    return;
  }
  postsEl.innerHTML = posts.map((post) => `
    <article class="feature">
      <img src="${post.image || '/images/freshwater/photos/rohu.jpg'}" alt="${post.title || 'Community update'}" loading="lazy" />
      <h3>${post.title || 'Update'}</h3>
      <p>${post.summary || ''}</p>
      <p class="muted">${post.tag || 'Community'} | ${post.publishedAt || '--'}</p>
    </article>
  `).join('');

  postsEl.querySelectorAll('img').forEach((img) => {
    img.addEventListener('error', () => {
      img.src = '/images/freshwater/fallback.svg';
    }, { once: true });
  });
}

function renderTestimonials(testimonials) {
  if (!Array.isArray(testimonials) || !testimonials.length) {
    testimonialsEl.innerHTML = '<p class="muted">No testimonials available.</p>';
    return;
  }
  testimonialsEl.innerHTML = testimonials.map((item) => `
    <article class="feature">
      <img src="${item.image || '/images/freshwater/photos/catla.jpg'}" alt="${item.name || 'Customer'}" loading="lazy" />
      <h3>${item.name || 'Customer'}</h3>
      <p class="muted">${item.role || ''}</p>
      <p>${item.quote || ''}</p>
    </article>
  `).join('');

  testimonialsEl.querySelectorAll('img').forEach((img) => {
    img.addEventListener('error', () => {
      img.src = '/images/freshwater/fallback.svg';
    }, { once: true });
  });
}

(async function init() {
  try {
    const [postsData, testimonialsData] = await Promise.all([
      requestApi('/api/community/posts'),
      requestApi('/api/testimonials')
    ]);

    renderPosts(postsData.posts || []);
    renderTestimonials(testimonialsData.testimonials || []);
    statusEl.textContent = 'Community content loaded.';
    statusEl.className = 'status ok';
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
    statusEl.className = 'status error';
  }
})();
