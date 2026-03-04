(function () {
  const style = document.createElement('style');
  style.textContent = `
    .bf-chat-btn {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 1200;
      border: 0;
      border-radius: 999px;
      padding: 0.68rem 0.95rem;
      font: 700 0.85rem/1 'Manrope', sans-serif;
      color: #fff;
      background: linear-gradient(130deg, #00b19f, #007ea8);
      box-shadow: 0 14px 30px rgba(2, 63, 93, 0.28);
      cursor: pointer;
    }
    .bf-chat-panel {
      position: fixed;
      right: 18px;
      bottom: 72px;
      width: min(360px, calc(100vw - 24px));
      max-height: min(70vh, 520px);
      z-index: 1200;
      display: none;
      flex-direction: column;
      border: 1px solid #b9d9e8;
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 18px 34px rgba(8, 63, 92, 0.25);
      overflow: hidden;
    }
    .bf-chat-panel.open { display: flex; }
    .bf-chat-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.72rem 0.85rem;
      color: #ffffff;
      background: linear-gradient(130deg, #006e97, #00aa95);
      font: 700 0.9rem/1.2 'Archivo', sans-serif;
    }
    .bf-chat-close {
      border: 0;
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
      border-radius: 8px;
      width: 28px;
      height: 28px;
      cursor: pointer;
      font-weight: 800;
    }
    .bf-chat-log {
      flex: 1;
      overflow: auto;
      padding: 0.7rem;
      display: grid;
      gap: 0.5rem;
      background: linear-gradient(180deg, #f7fcff, #eef8ff);
    }
    .bf-chat-msg {
      padding: 0.52rem 0.62rem;
      border-radius: 10px;
      font: 600 0.82rem/1.4 'Manrope', sans-serif;
      max-width: 88%;
      word-break: break-word;
    }
    .bf-chat-msg.user {
      margin-left: auto;
      background: #dff7f2;
      border: 1px solid #b9e9dd;
      color: #135a53;
    }
    .bf-chat-msg.bot {
      margin-right: auto;
      background: #ffffff;
      border: 1px solid #cae0ed;
      color: #22495f;
    }
    .bf-chat-form {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.45rem;
      padding: 0.6rem;
      border-top: 1px solid #d7e8f1;
      background: #fcfeff;
    }
    .bf-chat-input {
      border: 1px solid #bfd9e9;
      border-radius: 9px;
      padding: 0.55rem 0.62rem;
      font: 500 0.82rem/1.2 'Manrope', sans-serif;
    }
    .bf-chat-send {
      border: 0;
      border-radius: 9px;
      padding: 0.52rem 0.7rem;
      font: 700 0.8rem/1 'Manrope', sans-serif;
      color: #fff;
      background: linear-gradient(130deg, #00a892, #00739b);
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);

  function toApiUrl(base, path) {
    return base ? `${base}${path}` : path;
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
    for (const base of buildApiCandidates()) {
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

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'bf-chat-btn';
  button.textContent = 'AI Chat';

  const panel = document.createElement('section');
  panel.className = 'bf-chat-panel';
  panel.innerHTML = `
    <header class="bf-chat-head">
      <span>Bestfishi AI Assistant</span>
      <button class="bf-chat-close" type="button" aria-label="Close chat">x</button>
    </header>
    <div class="bf-chat-log" id="bfChatLog"></div>
    <form class="bf-chat-form" id="bfChatForm">
      <input class="bf-chat-input" id="bfChatInput" type="text" placeholder="Ask about order, tracking, pricing..." maxlength="300" required />
      <button class="bf-chat-send" type="submit">Send</button>
    </form>
  `;

  document.body.appendChild(button);
  document.body.appendChild(panel);

  const closeBtn = panel.querySelector('.bf-chat-close');
  const logEl = panel.querySelector('#bfChatLog');
  const formEl = panel.querySelector('#bfChatForm');
  const inputEl = panel.querySelector('#bfChatInput');

  function addMessage(text, who) {
    const item = document.createElement('div');
    item.className = `bf-chat-msg ${who}`;
    item.textContent = text;
    logEl.appendChild(item);
    logEl.scrollTop = logEl.scrollHeight;
  }

  addMessage('Hello, I can help with order tracking, delivery, partnership, and complaints.', 'bot');

  button.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      inputEl.focus();
    }
  });

  closeBtn.addEventListener('click', () => {
    panel.classList.remove('open');
  });

  formEl.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = String(inputEl.value || '').trim();
    if (!message) return;

    addMessage(message, 'user');
    inputEl.value = '';

    try {
      const payload = await requestApi('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      addMessage(payload.reply || 'I could not understand. Please try another question.', 'bot');
    } catch (error) {
      addMessage(`Chat error: ${error.message}`, 'bot');
    }
  });
})();
