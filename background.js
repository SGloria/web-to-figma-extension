/**
 * Web to Figma - Background Service Worker
 * @author 板栗alive
 */

const WORLD = 'MAIN';
const CAPTURE_FILE = 'capture.js';
const CONCURRENCY_KEY = 'proxyFetchConcurrency';
const PROXY_KEY = 'enableAssetProxyFetch';
const ALLOWED_CONCURRENCY = new Set([4, 6, 8, 10, 12, 16, 20]);
const DEFAULT_CONCURRENCY = 8;
const FETCH_TIMEOUT_MS = 8000;

const proxyQueue = [];
const proxyInFlight = new Map();
const proxyMemCache = new Map();

let proxyActive = 0;
let maxConcurrency = DEFAULT_CONCURRENCY;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function injectScript(tabId, file) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: WORLD,
    files: [file]
  });
}

function normalizeConcurrency(val) {
  if (val === 'infinite' || val === '∞') return Infinity;
  const n = Number(val);
  return ALLOWED_CONCURRENCY.has(n) ? n : DEFAULT_CONCURRENCY;
}

async function loadConfig() {
  try {
    const data = await chrome.storage.local.get({ [CONCURRENCY_KEY]: String(DEFAULT_CONCURRENCY) });
    maxConcurrency = normalizeConcurrency(data?.[CONCURRENCY_KEY]);
  } catch {
    maxConcurrency = DEFAULT_CONCURRENCY;
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[CONCURRENCY_KEY]) {
    maxConcurrency = normalizeConcurrency(changes[CONCURRENCY_KEY].newValue);
    pumpQueue();
  }
});

function enqueueTask(task) {
  return new Promise((resolve, reject) => {
    proxyQueue.push({ task, resolve, reject });
    pumpQueue();
  });
}

function pumpQueue() {
  while (proxyActive < maxConcurrency && proxyQueue.length) {
    const item = proxyQueue.shift();
    proxyActive++;
    Promise.resolve()
      .then(item.task)
      .then(item.resolve, item.reject)
      .finally(() => {
        proxyActive--;
        pumpQueue();
      });
  }
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function proxyFetch(url) {
  const cached = proxyMemCache.get(url);
  if (cached) return { ok: true, status: 200, cacheHit: 'memory', ...cached };
  
  if (proxyInFlight.has(url)) return proxyInFlight.get(url);
  
  const promise = enqueueTask(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      
      let res;
      try {
        res = await fetch(url, { credentials: 'omit', signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      
      if (!res.ok) return { ok: false, status: res.status, error: 'HTTP_' + res.status };
      
      const contentType = res.headers.get('content-type') || 'application/octet-stream';
      const base64 = toBase64(await res.arrayBuffer());
      const data = { contentType, base64 };
      
      proxyMemCache.set(url, data);
      return { ok: true, status: res.status, ...data, cacheHit: 'miss' };
    } catch (e) {
      return { ok: false, status: 0, error: String(e) };
    }
  }).finally(() => proxyInFlight.delete(url));
  
  proxyInFlight.set(url, promise);
  return promise;
}

// 处理采集请求 - 注入 capture.js 并显示工具栏
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg?.type !== 'FIGMA_CAPTURE_START') return;
  
  (async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      
      // 注入 capture.js
      await injectScript(tab.id, CAPTURE_FILE);
      await sleep(100);
      
      // 调用 captureForDesign 显示工具栏
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: WORLD,
        func: () => {
          if (window.figma?.captureForDesign) {
            window.figma.captureForDesign({ selector: 'body' });
          }
        }
      });
      
      respond({ ok: true });
    } catch (e) {
      console.error('Capture failed:', e);
      respond({ ok: false, error: String(e) });
    }
  })();
  
  return true;
});

// 处理图片代理请求
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg?.type !== 'FIGMA_CAPTURE_FETCH_ASSET' || !msg.url) return;
  
  proxyFetch(msg.url).then(result => {
    respond({
      ...result,
      diagnostics: {
        queueDepth: proxyQueue.length,
        activeRequests: proxyActive,
        maxConcurrency: Number.isFinite(maxConcurrency) ? maxConcurrency : 'infinite'
      }
    });
  });
  
  return true;
});

loadConfig();
