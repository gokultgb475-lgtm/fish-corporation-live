const express = require('express');
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const rootDir = __dirname;
const adminDir = path.join(rootDir, 'admin');
const publicDir = path.join(rootDir, 'public');
const dataDir = path.join(rootDir, 'data');
const reportsDir = path.join(rootDir, 'reports');
const fishBasePriceFile = path.join(dataDir, 'fish-base-prices.json');
const complaintsFile = path.join(dataDir, 'fish-complaints.json');
const ordersFile = path.join(dataDir, 'shop-orders.json');
const salesInquiryFile = path.join(dataDir, 'sales-inquiries.json');
const notificationLogFile = path.join(dataDir, 'notification-log.json');
const shopProductsFile = path.join(dataDir, 'shop-products.json');
const communityPostsFile = path.join(dataDir, 'community-posts.json');
const testimonialsFile = path.join(dataDir, 'testimonials.json');
const siteOverviewFile = path.join(dataDir, 'site-overview.json');

function loadLocalEnv() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const idx = trimmed.indexOf('=');
    if (idx <= 0) return;

    const key = trimmed.slice(0, idx).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) return;
    if (Object.prototype.hasOwnProperty.call(process.env, key)) return;

    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith('\'') && value.endsWith('\''))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  });
}

loadLocalEnv();

const PORT = Number(process.env.PORT) || 4080;
const ADMIN_KEY = String(process.env.ADMIN_KEY || '').trim() || 'change-this-admin-key';
const SITE_NAME = String(process.env.SITE_NAME || 'Bestfishi Freshwater Aquaculture Platform').trim();
const LIVE_FEED_REGION = String(process.env.LIVE_FEED_REGION || 'Tamil Nadu Freshwater Belt').trim();
const NODE_ENV = String(process.env.NODE_ENV || 'development').trim();
const TWILIO_ACCOUNT_SID = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
const TWILIO_AUTH_TOKEN = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
const TWILIO_SMS_FROM = String(process.env.TWILIO_SMS_FROM || process.env.TWILIO_PHONE_NUMBER || '').trim();
const TWILIO_SMS_SERVICE_SID = String(process.env.TWILIO_SMS_SERVICE_SID || '').trim();
const TWILIO_WHATSAPP_FROM = String(
  process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_WHATSAPP_NUMBER || ''
).trim();
const DEFAULT_PHONE_COUNTRY_CODE = (
  /^\+\d{1,3}$/.test(String(process.env.DEFAULT_PHONE_COUNTRY_CODE || '').trim())
    ? String(process.env.DEFAULT_PHONE_COUNTRY_CODE || '').trim()
    : '+91'
);
const ORDER_TRACK_BASE_URL = String(
  process.env.ORDER_TRACK_BASE_URL || `http://localhost:${PORT}/track-order.html`
).trim();

function toSafeText(value, maxLen) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatInr(value) {
  const num = Number(value || 0);
  return `Rs.${num.toFixed(2)}`;
}

function normalizePhoneNumber(raw) {
  const input = String(raw || '').trim();
  if (!input) return '';
  if (input.startsWith('+')) {
    const plusDigits = input.slice(1).replace(/[^\d]/g, '');
    if (!plusDigits) return '';
    if (plusDigits.startsWith('0')) {
      const stripped = plusDigits.replace(/^0+/, '');
      if (stripped.length === 10) return `${DEFAULT_PHONE_COUNTRY_CODE}${stripped}`;
      if (/^\d{8,15}$/.test(stripped)) return `+${stripped}`;
      return '';
    }

    const clean = `+${plusDigits}`;
    return /^\+\d{8,15}$/.test(clean) ? clean : '';
  }

  let digits = input.replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);

  const countryDigits = DEFAULT_PHONE_COUNTRY_CODE.slice(1);
  if (digits.length === 10) return `${DEFAULT_PHONE_COUNTRY_CODE}${digits}`;
  if (digits.length === countryDigits.length + 10 && digits.startsWith(countryDigits)) return `+${digits}`;

  if (!/^\d{8,15}$/.test(digits)) return '';
  if (digits.startsWith('0')) return '';
  return `+${digits}`;
}

function normalizeNotifyPreference(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'sms' || value === 'whatsapp' || value === 'both' || value === 'none') {
    return value;
  }
  return 'both';
}

function getNotifyChannels(preference) {
  if (preference === 'sms') return ['sms'];
  if (preference === 'whatsapp') return ['whatsapp'];
  if (preference === 'none') return [];
  return ['sms', 'whatsapp'];
}

function buildAiReply(message) {
  const text = String(message || '').toLowerCase();

  if (/(track|where|status|order id)/.test(text)) {
    return 'Track your order on Track Order page using order ID and the same phone number used during checkout.';
  }
  if (/(confirm|confirmed|sms)/.test(text)) {
    return 'When an order is moved to confirmed status in admin, SMS is sent to the customer phone number automatically.';
  }
  if (/(price|rate|cost|today)/.test(text)) {
    return 'Use the live rate board and marketplace to check current freshwater pricing and available product options.';
  }
  if (/(partner|partnership|farmer|join)/.test(text)) {
    return 'Open Request Partnership page and submit your farm/company details. The operations team will contact you.';
  }
  if (/(delivery|logistics|transport)/.test(text)) {
    return 'Delivery uses freshwater cold-chain and live transport planning with route coverage up to 700-800 km.';
  }
  if (/(complaint|issue|problem|refund)/.test(text)) {
    return 'Use the Complaint Desk form in Contact page with your order ID for faster resolution.';
  }
  if (/(contact|call|support|help)/.test(text)) {
    return 'Use the Contact page for sales/support inquiries, or use the phone/email listed in the website footer.';
  }

  return 'I can help with orders, tracking, pricing, partnership, delivery, and complaints. Ask me one specific question.';
}

function buildOrderStatusMessage(order, statusLabel) {
  const phone = encodeURIComponent(String(order.phoneNormalized || order.phone || ''));
  const orderId = encodeURIComponent(String(order.orderId || ''));
  const trackUrl = `${ORDER_TRACK_BASE_URL}?orderId=${orderId}&phone=${phone}`;
  return `${SITE_NAME}: Order ${order.orderId} status is ${statusLabel}. Total ${formatInr(order.grandTotal)}. Track: ${trackUrl}`;
}

function parseOrderSequence(orderId) {
  const match = /^BF-(\d{8})$/.exec(String(orderId || ''));
  if (!match) return null;
  const sequence = Number(match[1]);
  return Number.isFinite(sequence) ? sequence : null;
}

function generateOrderId(existingOrders) {
  const safeOrders = Array.isArray(existingOrders) ? existingOrders : [];
  const existingIds = new Set(safeOrders.map((item) => String(item.orderId || '')));

  let nextSequence = Number(Date.now().toString().slice(-8));
  for (const item of safeOrders) {
    const parsed = parseOrderSequence(item.orderId);
    if (parsed !== null && parsed >= nextSequence) {
      nextSequence = parsed + 1;
    }
  }

  while (true) {
    const candidate = `BF-${String(nextSequence).padStart(8, '0')}`;
    if (!existingIds.has(candidate)) {
      return candidate;
    }
    nextSequence += 1;
  }
}

async function sendTwilioMessage({ to, body, channel }) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return { ok: false, provider: 'twilio', channel, reason: 'twilio_credentials_missing' };
  }

  const payload = new URLSearchParams();
  const destination = channel === 'whatsapp' ? `whatsapp:${to}` : to;
  payload.set('To', destination);
  payload.set('Body', body);

  if (channel === 'whatsapp') {
    if (!TWILIO_WHATSAPP_FROM) {
      return { ok: false, provider: 'twilio', channel, reason: 'twilio_whatsapp_from_missing' };
    }
    payload.set('From', TWILIO_WHATSAPP_FROM);
  } else if (TWILIO_SMS_SERVICE_SID) {
    payload.set('MessagingServiceSid', TWILIO_SMS_SERVICE_SID);
  } else if (TWILIO_SMS_FROM) {
    payload.set('From', TWILIO_SMS_FROM);
  } else {
    return { ok: false, provider: 'twilio', channel, reason: 'twilio_sms_sender_missing' };
  }

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: payload.toString()
    }
  );

  const raw = await response.text();
  let parsed = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch (error) {
    parsed = {};
  }

  if (!response.ok) {
    return {
      ok: false,
      provider: 'twilio',
      channel,
      statusCode: response.status,
      reason: parsed?.message || `HTTP_${response.status}`
    };
  }

  return {
    ok: true,
    provider: 'twilio',
    channel,
    statusCode: response.status,
    sid: parsed.sid || ''
  };
}

async function appendNotificationLogs(entries) {
  if (!entries.length) return;
  const existing = await readJson(notificationLogFile, []);
  const safeExisting = Array.isArray(existing) ? existing : [];
  safeExisting.unshift(...entries);
  await writeJson(notificationLogFile, safeExisting.slice(0, 4000));
}

async function notifyOrderStatus(order, statusLabel, triggerSource) {
  const phone = normalizePhoneNumber(order.phoneNormalized || order.phone);
  const preference = normalizeNotifyPreference(order.notifyPreference);
  const channelSet = new Set(getNotifyChannels(preference));
  if (String(statusLabel || '').toLowerCase() === 'confirmed') {
    channelSet.add('sms');
  }
  const channels = [...channelSet];

  if (!phone || !channels.length) {
    const skipped = {
      ok: false,
      provider: 'system',
      channel: 'none',
      reason: !phone ? 'invalid_phone' : 'notification_disabled'
    };
    await appendNotificationLogs([
      {
        createdAt: new Date().toISOString(),
        orderId: order.orderId,
        triggerSource,
        result: skipped
      }
    ]);
    return [skipped];
  }

  const message = buildOrderStatusMessage(order, statusLabel);
  const results = [];

  for (const channel of channels) {
    try {
      const result = await sendTwilioMessage({ to: phone, body: message, channel });
      results.push(result);
    } catch (error) {
      results.push({
        ok: false,
        provider: 'twilio',
        channel,
        reason: error?.message || 'notification_error'
      });
    }
  }

  await appendNotificationLogs(results.map((result) => ({
    createdAt: new Date().toISOString(),
    orderId: order.orderId,
    triggerSource,
    result
  })));
  return results;
}

function createRateLimiter({ windowMs, maxRequests, scope }) {
  const bucket = new Map();

  return (req, res, next) => {
    const key = `${scope}:${req.ip || 'unknown'}`;
    const now = Date.now();
    const item = bucket.get(key);

    if (!item || now > item.expiresAt) {
      bucket.set(key, {
        count: 1,
        expiresAt: now + windowMs
      });
      return next();
    }

    item.count += 1;

    if (item.count > maxRequests) {
      const retryAfterSeconds = Math.ceil((item.expiresAt - now) / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: 'Too many requests. Please retry after a short wait.'
      });
    }

    return next();
  };
}

async function readJson(filePath, fallbackValue) {
  try {
    const raw = await fsPromises.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return fallbackValue;
    }
    throw error;
  }
}

async function writeJson(filePath, data) {
  await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2));
}

function loadBaseFishCatalog() {
  try {
    const raw = fs.readFileSync(fishBasePriceFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      throw new Error('Fish catalog is empty.');
    }
    return parsed;
  } catch (error) {
    console.error('Failed to load fish catalog:', error.message);
    return [];
  }
}

const fishCatalog = loadBaseFishCatalog();
const fishPriceState = new Map();

fishCatalog.forEach((fish) => {
  fishPriceState.set(fish.id, {
    currentPrice: Number(fish.basePrice) || 0,
    previousPrice: Number(fish.basePrice) || 0,
    trend: 'flat',
    freshnessScore: 90
  });
});

function rollLiveFishPrices() {
  const rows = fishCatalog.map((fish) => {
    const state = fishPriceState.get(fish.id) || {
      currentPrice: Number(fish.basePrice) || 0,
      previousPrice: Number(fish.basePrice) || 0,
      trend: 'flat',
      freshnessScore: 90
    };

    const driftPct = (Math.random() * 0.06) - 0.03;
    const stockFactor = fish.stock === 'Low' ? 0.012 : fish.stock === 'High' ? -0.008 : 0;
    const finalDrift = driftPct + stockFactor;
    const nextPrice = clamp(state.currentPrice * (1 + finalDrift), fish.basePrice * 0.75, fish.basePrice * 1.35);

    state.previousPrice = state.currentPrice;
    state.currentPrice = Number(nextPrice.toFixed(2));

    const delta = state.currentPrice - state.previousPrice;
    state.trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    state.freshnessScore = clamp(
      Math.round((state.freshnessScore * 0.7) + (70 + Math.random() * 30) * 0.3),
      65,
      99
    );

    fishPriceState.set(fish.id, state);

    const changePct = state.previousPrice
      ? Number((((state.currentPrice - state.previousPrice) / state.previousPrice) * 100).toFixed(2))
      : 0;

    return {
      id: fish.id,
      name: fish.name,
      grade: fish.grade,
      unit: fish.unit,
      origin: fish.origin,
      stock: fish.stock,
      currentPrice: state.currentPrice,
      previousPrice: state.previousPrice,
      changePct,
      trend: state.trend,
      freshnessScore: state.freshnessScore
    };
  });

  rows.sort((a, b) => b.currentPrice - a.currentPrice);

  return {
    source: 'Bestfishi Freshwater Live Engine',
    region: LIVE_FEED_REGION,
    generatedAt: new Date().toISOString(),
    totalItems: rows.length,
    rows
  };
}

function collectAuditFindings() {
  const findings = [];

  if (!ADMIN_KEY || ADMIN_KEY === 'change-this-admin-key') {
    findings.push({
      severity: 'high',
      code: 'ADMIN_KEY_DEFAULT',
      issue: 'Default admin key is still active.',
      fix: 'Set a strong ADMIN_KEY in .env before live deployment.'
    });
  }

  if (NODE_ENV !== 'production') {
    findings.push({
      severity: 'medium',
      code: 'NODE_ENV_DEV',
      issue: 'Server is not running in production mode.',
      fix: 'Set NODE_ENV=production on your live server.'
    });
  }

  if (process.env.TRUST_PROXY !== '1') {
    findings.push({
      severity: 'medium',
      code: 'TRUST_PROXY_OFF',
      issue: 'Proxy trust is not enabled.',
      fix: 'If deploying behind Nginx/Cloudflare, set TRUST_PROXY=1.'
    });
  }

  if (!fs.existsSync(complaintsFile)) {
    findings.push({
      severity: 'low',
      code: 'COMPLAINT_FILE_BOOTSTRAP',
      issue: 'Complaint storage file not initialized yet.',
      fix: 'Submit one complaint or create fish-complaints.json with [].'
    });
  }

  if (!fs.existsSync(path.join(publicDir, 'styles.css'))) {
    findings.push({
      severity: 'high',
      code: 'STATIC_CSS_MISSING',
      issue: 'Main stylesheet is missing.',
      fix: 'Ensure public/styles.css is deployed.'
    });
  }

  if (!fs.existsSync(shopProductsFile)) {
    findings.push({
      severity: 'high',
      code: 'SHOP_DATA_MISSING',
      issue: 'Shop product catalog is missing.',
      fix: 'Ensure data/shop-products.json is present in deployment.'
    });
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    findings.push({
      severity: 'medium',
      code: 'ORDER_NOTIFICATION_DISABLED',
      issue: 'Twilio credentials are not configured for SMS/WhatsApp updates.',
      fix: 'Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env.'
    });
  } else {
    if (!TWILIO_SMS_SERVICE_SID && !TWILIO_SMS_FROM) {
      findings.push({
        severity: 'medium',
        code: 'TWILIO_SMS_SENDER_MISSING',
        issue: 'SMS sender is not configured for Twilio.',
        fix: 'Set TWILIO_SMS_FROM or TWILIO_SMS_SERVICE_SID in .env.'
      });
    }
    if (!TWILIO_WHATSAPP_FROM) {
      findings.push({
        severity: 'low',
        code: 'TWILIO_WHATSAPP_SENDER_MISSING',
        issue: 'WhatsApp sender is not configured for Twilio.',
        fix: 'Set TWILIO_WHATSAPP_FROM in .env.'
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    findings,
    safeChecklist: {
      securityHeaders: true,
      apiRateLimit: true,
      complaintValidation: true,
      adminRouteProtection: true
    }
  };
}

function requireAdmin(req, res, next) {
  const key = String(req.headers['x-admin-key'] || req.query.key || '').trim();
  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  return next();
}

const app = express();

if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', true);
}

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  next();
});

const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
  scope: 'api'
});

const complaintLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 6,
  scope: 'complaint'
});

const orderLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 12,
  scope: 'order'
});

const contactLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 10,
  scope: 'contact'
});

const aiChatLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  scope: 'ai-chat'
});

app.use('/api', apiLimiter);

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    app: SITE_NAME,
    env: NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    generatedAt: new Date().toISOString()
  });
});

app.get('/api/fish/live', (req, res) => {
  const data = rollLiveFishPrices();
  const highest = data.rows[0] || null;
  const lowest = data.rows[data.rows.length - 1] || null;

  res.json({
    ...data,
    summary: {
      highest: highest ? `${highest.name} - Rs.${highest.currentPrice}/${highest.unit}` : 'N/A',
      lowest: lowest ? `${lowest.name} - Rs.${lowest.currentPrice}/${lowest.unit}` : 'N/A'
    }
  });
});

app.get('/api/site/overview', async (req, res, next) => {
  try {
    const overview = await readJson(siteOverviewFile, {
      brand: SITE_NAME,
      mission: '',
      metrics: [],
      trustBadges: [],
      ctas: []
    });
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

app.post('/api/ai/chat', aiChatLimiter, (req, res) => {
  const message = toSafeText(req.body.message, 300);
  if (message.length < 2) {
    return res.status(400).json({ error: 'Please enter a valid question.' });
  }

  const reply = buildAiReply(message);
  return res.json({
    ok: true,
    reply,
    suggestions: [
      'How to track my order?',
      'When do I receive SMS updates?',
      'How do I join as partner?'
    ]
  });
});

app.get('/api/shop/products', async (req, res, next) => {
  try {
    const categoryFilter = toSafeText(req.query.category, 50).toLowerCase();
    const products = await readJson(shopProductsFile, []);
    const safeProducts = Array.isArray(products) ? products : [];
    const filtered = categoryFilter
      ? safeProducts.filter((item) => String(item.category || '').toLowerCase() === categoryFilter)
      : safeProducts;

    res.json({
      total: filtered.length,
      products: filtered
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/shop/orders', orderLimiter, async (req, res, next) => {
  try {
    const customerName = toSafeText(req.body.customerName, 80);
    const phone = toSafeText(req.body.phone, 30);
    const phoneNormalized = normalizePhoneNumber(phone);
    const email = toSafeText(req.body.email, 120);
    const address = toSafeText(req.body.address, 240);
    const notes = toSafeText(req.body.notes, 400);
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const notifyPreference = normalizeNotifyPreference(req.body.notifyPreference);

    if (customerName.length < 2) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }

    if (phone.length < 8 || !phoneNormalized) {
      return res.status(400).json({ error: 'Valid phone number is required.' });
    }

    if (address.length < 10) {
      return res.status(400).json({ error: 'Delivery address is required.' });
    }

    if (!items.length) {
      return res.status(400).json({ error: 'At least one product is required.' });
    }

    const catalog = await readJson(shopProductsFile, []);
    const safeCatalog = Array.isArray(catalog) ? catalog : [];
    const priceMap = new Map(safeCatalog.map((item) => [item.id, Number(item.price) || 0]));

    let grandTotal = 0;
    const normalizedItems = [];

    for (const item of items.slice(0, 40)) {
      const productId = toSafeText(item.id, 60);
      const qty = clamp(Number(item.qty) || 0, 1, 200);
      const unitPrice = priceMap.get(productId);
      if (!unitPrice) continue;

      const lineTotal = Number((unitPrice * qty).toFixed(2));
      grandTotal += lineTotal;
      normalizedItems.push({ id: productId, qty, unitPrice, lineTotal });
    }

    if (!normalizedItems.length) {
      return res.status(400).json({ error: 'Selected items are invalid.' });
    }

    const orders = await readJson(ordersFile, []);
    const safeOrders = Array.isArray(orders) ? orders : [];
    const orderId = generateOrderId(safeOrders);
    const record = {
      id: crypto.randomUUID(),
      orderId,
      createdAt: new Date().toISOString(),
      customerName,
      phone,
      phoneNormalized,
      email,
      address,
      notes,
      notifyPreference,
      items: normalizedItems,
      grandTotal: Number(grandTotal.toFixed(2)),
      status: 'pending'
    };

    safeOrders.unshift(record);
    await writeJson(ordersFile, safeOrders.slice(0, 2000));
    const notification = await notifyOrderStatus(record, record.status, 'order_created');

    res.status(201).json({
      ok: true,
      orderId,
      grandTotal: record.grandTotal,
      message: 'Order placed successfully. Our team will call you shortly.',
      notification
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/contact/sales', contactLimiter, async (req, res, next) => {
  try {
    const name = toSafeText(req.body.name, 80);
    const phone = toSafeText(req.body.phone, 30);
    const email = toSafeText(req.body.email, 120);
    const company = toSafeText(req.body.company, 120);
    const message = toSafeText(req.body.message, 700);

    if (name.length < 2) {
      return res.status(400).json({ error: 'Name is required.' });
    }
    if (phone.length < 8 && email.length < 5) {
      return res.status(400).json({ error: 'Phone or email is required.' });
    }
    if (message.length < 12) {
      return res.status(400).json({ error: 'Please add more details in your message.' });
    }

    const inquiries = await readJson(salesInquiryFile, []);
    const safeInquiries = Array.isArray(inquiries) ? inquiries : [];
    const inquiry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      name,
      phone,
      email,
      company,
      message,
      status: 'new'
    };
    safeInquiries.unshift(inquiry);
    await writeJson(salesInquiryFile, safeInquiries.slice(0, 2000));

    res.status(201).json({
      ok: true,
      message: 'Sales inquiry submitted. Our team will reach out soon.'
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/community/posts', async (req, res, next) => {
  try {
    const posts = await readJson(communityPostsFile, []);
    const safePosts = Array.isArray(posts) ? posts : [];
    res.json({
      total: safePosts.length,
      posts: safePosts
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/testimonials', async (req, res, next) => {
  try {
    const testimonials = await readJson(testimonialsFile, []);
    const safeTestimonials = Array.isArray(testimonials) ? testimonials : [];
    res.json({
      total: safeTestimonials.length,
      testimonials: safeTestimonials
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/complaints', complaintLimiter, async (req, res, next) => {
  try {
    const name = toSafeText(req.body.name, 80);
    const contact = toSafeText(req.body.contact, 80);
    const orderId = toSafeText(req.body.orderId, 40);
    const category = toSafeText(req.body.category, 40);
    const message = toSafeText(req.body.message, 800);

    if (name.length < 2) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    if (contact.length < 8) {
      return res.status(400).json({ error: 'Phone or email is required.' });
    }

    if (message.length < 10) {
      return res.status(400).json({ error: 'Complaint message must be at least 10 characters.' });
    }

    const complaints = await readJson(complaintsFile, []);
    const safeComplaints = Array.isArray(complaints) ? complaints : [];

    const complaint = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      name,
      contact,
      orderId,
      category,
      message,
      status: 'open'
    };

    safeComplaints.unshift(complaint);
    const trimmed = safeComplaints.slice(0, 1000);
    await writeJson(complaintsFile, trimmed);

    return res.status(201).json({
      ok: true,
      message: 'Complaint received. Our support team will contact you shortly.',
      complaintId: complaint.id
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/complaints', requireAdmin, async (req, res, next) => {
  try {
    const complaints = await readJson(complaintsFile, []);
    const safeComplaints = Array.isArray(complaints) ? complaints : [];
    res.json({
      total: safeComplaints.length,
      complaints: safeComplaints
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/orders', requireAdmin, async (req, res, next) => {
  try {
    const orders = await readJson(ordersFile, []);
    const safeOrders = Array.isArray(orders) ? orders : [];
    res.json({
      total: safeOrders.length,
      orders: safeOrders
    });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/admin/orders/:orderId', requireAdmin, async (req, res, next) => {
  try {
    const orderId = toSafeText(req.params.orderId, 40);
    const status = toSafeText(req.body.status, 20).toLowerCase();
    const allowed = new Set(['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled']);

    if (!allowed.has(status)) {
      return res.status(400).json({ error: 'Invalid order status.' });
    }

    const orders = await readJson(ordersFile, []);
    const safeOrders = Array.isArray(orders) ? orders : [];
    const index = safeOrders.findIndex((item) => String(item.orderId || '') === orderId);
    if (index < 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const previousStatus = String(safeOrders[index].status || '');
    if (previousStatus === status) {
      return res.json({
        ok: true,
        order: safeOrders[index],
        notification: [],
        message: 'Status unchanged. Notification skipped.'
      });
    }

    safeOrders[index].status = status;
    safeOrders[index].updatedAt = new Date().toISOString();
    await writeJson(ordersFile, safeOrders);
    const notification = await notifyOrderStatus(safeOrders[index], status, 'order_status_changed');

    res.json({ ok: true, order: safeOrders[index], notification });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/sales-inquiries', requireAdmin, async (req, res, next) => {
  try {
    const inquiries = await readJson(salesInquiryFile, []);
    const safeInquiries = Array.isArray(inquiries) ? inquiries : [];
    res.json({
      total: safeInquiries.length,
      inquiries: safeInquiries
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/notifications', requireAdmin, async (req, res, next) => {
  try {
    const logs = await readJson(notificationLogFile, []);
    const safeLogs = Array.isArray(logs) ? logs : [];
    res.json({
      total: safeLogs.length,
      notifications: safeLogs.slice(0, 500)
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/orders/track', async (req, res, next) => {
  try {
    const orderId = toSafeText(req.query.orderId, 40);
    const phone = normalizePhoneNumber(req.query.phone);
    if (!orderId || !phone) {
      return res.status(400).json({ error: 'orderId and phone are required.' });
    }

    const orders = await readJson(ordersFile, []);
    const safeOrders = Array.isArray(orders) ? orders : [];
    const order = safeOrders.find(
      (item) => String(item.orderId || '') === orderId && normalizePhoneNumber(item.phoneNormalized || item.phone) === phone
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    res.json({
      orderId: order.orderId,
      status: order.status,
      updatedAt: order.updatedAt || order.createdAt,
      createdAt: order.createdAt,
      grandTotal: order.grandTotal,
      items: order.items || [],
      notifyPreference: order.notifyPreference || 'both'
    });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/admin/sales-inquiries/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = toSafeText(req.params.id, 64);
    const status = toSafeText(req.body.status, 20).toLowerCase();
    const allowed = new Set(['new', 'contacted', 'qualified', 'closed']);

    if (!allowed.has(status)) {
      return res.status(400).json({ error: 'Invalid inquiry status.' });
    }

    const inquiries = await readJson(salesInquiryFile, []);
    const safeInquiries = Array.isArray(inquiries) ? inquiries : [];
    const index = safeInquiries.findIndex((item) => String(item.id || '') === id);
    if (index < 0) {
      return res.status(404).json({ error: 'Inquiry not found.' });
    }

    safeInquiries[index].status = status;
    safeInquiries[index].updatedAt = new Date().toISOString();
    await writeJson(salesInquiryFile, safeInquiries);

    res.json({ ok: true, inquiry: safeInquiries[index] });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/admin/complaints/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = toSafeText(req.params.id, 64);
    const status = toSafeText(req.body.status, 20).toLowerCase();
    const allowed = new Set(['open', 'in_progress', 'resolved', 'closed']);

    if (!allowed.has(status)) {
      return res.status(400).json({ error: 'Invalid complaint status.' });
    }

    const complaints = await readJson(complaintsFile, []);
    const safeComplaints = Array.isArray(complaints) ? complaints : [];
    const index = safeComplaints.findIndex((item) => String(item.id || '') === id);
    if (index < 0) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    safeComplaints[index].status = status;
    safeComplaints[index].updatedAt = new Date().toISOString();
    await writeJson(complaintsFile, safeComplaints);

    res.json({ ok: true, complaint: safeComplaints[index] });
  } catch (error) {
    next(error);
  }
});

app.get('/api/audit/errors', (req, res) => {
  res.json(collectAuditFindings());
});

app.get('/api/reports/website-audit', (req, res) => {
  const reportPath = path.join(reportsDir, 'website-audit.md');
  if (!fs.existsSync(reportPath)) {
    return res.status(404).json({ error: 'Audit report not generated yet.' });
  }
  res.sendFile(reportPath);
});

app.use('/reports', express.static(reportsDir));
app.use(express.static(__dirname));
app.use('/admin', express.static(adminDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(adminDir, 'index.html'));
});

app.get('/:page', (req, res, next) => {
  const page = String(req.params.page || '').trim();

  if (!/^[a-zA-Z0-9_-]+$/.test(page)) {
    return next();
  }
  if (page === 'api' || page === 'reports') {
    return next();
  }

  const pagePath = path.join(__dirname, `${page}.html`);
  if (!fs.existsSync(pagePath)) {
    return next();
  }
  return res.sendFile(pagePath);
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found.' });
  }
  return res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`${SITE_NAME} running on http://localhost:${PORT}`);
  console.log(`Region: ${LIVE_FEED_REGION}`);
  console.log(`Production protections: headers + rate limit + validation + admin gate`);
});
