/**
 * Web to Figma - Background Service Worker
 * 
 * @author 板栗alive
 * @link https://github.com/SGloria
 */

const WORLD = 'ISOLATED';
const CAPTURE_FILE = 'capture.js';
const RUNNER_FILE = 'runner.js';
const TOOLBAR_FILE = 'inpage-toolbar.js';
const FIGMA_CAPTURE_CONCURRENCY_KEY = 'proxyFetchConcurrency';
const FIGMA_CAPTURE_ALLOWED_CONCURRENCY = new Set([4, 6, 8, 10, 12, 16, 20]);
const FIGMA_CAPTURE_DEFAULT_CONCURRENCY = 8;
const FIGMA_CAPTURE_PROXY_SESSION_KEY = 'figmaCaptureProxyAssetCacheV1';
const FIGMA_CAPTURE_PROXY_DIAG_KEY = 'figmaCaptureProxyDiagnosticsV1';
const FIGMA_CAPTURE_PROXY_MAX_DIAG = 500;
const FIGMA_CAPTURE_FETCH_TIMEOUT_MS = 8000;

const figmaProxyQueue = [];
const figmaProxyInFlight = new Map();
const figmaProxyMemCache = new Map();

let figmaProxyActive = 0;
let figmaProxyMaxConcurrency = FIGMA_CAPTURE_DEFAULT_CONCURRENCY;
let figmaProxySessionLoaded = false;
let figmaProxySessionCache = {};
let figmaProxyDiagnostics = [];

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 注入脚本文件到页面
 */
async function injectScriptFile(tabId, file) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: WORLD,
    files: [file]
  });
}

/**
 * 执行页面采集
 */
async function runCapture(tabId) {
  await injectScriptFile(tabId, CAPTURE_FILE);
  await sleep(300);
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: WORLD,
    files: [RUNNER_FILE]
  });
  return result;
}

/**
 * 保存采集结果为 JSON 文件
 */
function saveResult(data) {
  const json = JSON.stringify(data, null, 2);
  const blobUrl = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const filename = 'figma-capture-' + Date.now() + '.json';
  chrome.downloads.download({
    url: blobUrl,
    filename,
    saveAs: true
  }, () => {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
  });
}

/**
 * 标准化并发数配置
 */
function normalizeConcurrency(value) {
  if (value === 'infinite' || value === '∞') {
    return Number.POSITIVE_INFINITY;
  }
  const num = Number(value);
  if (FIGMA_CAPTURE_ALLOWED_CONCURRENCY.has(num)) {
    return num;
  }
  return FIGMA_CAPTURE_DEFAULT_CONCURRENCY;
}

/**
 * 获取并发数显示标签
 */
function concurrencyLabel() {
  return Number.isFinite(figmaProxyMaxConcurrency)
    ? String(figmaProxyMaxConcurrency)
    : 'infinite';
}

/**
 * 加载并发配置
 */
async function loadConcurrencyConfig() {
  try {
    const data = await chrome.storage.local.get({
      [FIGMA_CAPTURE_CONCURRENCY_KEY]: String(FIGMA_CAPTURE_DEFAULT_CONCURRENCY)
    });
    figmaProxyMaxConcurrency = normalizeConcurrency(data?.[FIGMA_CAPTURE_CONCURRENCY_KEY]);
  } catch {
    figmaProxyMaxConcurrency = FIGMA_CAPTURE_DEFAULT_CONCURRENCY;
  }
}

// 监听存储变化
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes || !changes[FIGMA_CAPTURE_CONCURRENCY_KEY]) {
    return;
  }
  figmaProxyMaxConcurrency = normalizeConcurrency(changes[FIGMA_CAPTURE_CONCURRENCY_KEY].newValue);
  pumpProxyQueue();
});

/**
 * 记录诊断信息
 */
function pushDiag(entry) {
  figmaProxyDiagnostics.push({
    ts: Date.now(),
    ...entry
  });
  if (figmaProxyDiagnostics.length > FIGMA_CAPTURE_PROXY_MAX_DIAG) {
    figmaProxyDiagnostics = figmaProxyDiagnostics.slice(-FIGMA_CAPTURE_PROXY_MAX_DIAG);
  }
  chrome?.storage?.session?.set({
    [FIGMA_CAPTURE_PROXY_DIAG_KEY]: figmaProxyDiagnostics
  }).catch(() => {});
}

/**
 * 加载代理会话缓存
 */
async function loadProxySession() {
  if (figmaProxySessionLoaded) return;
  figmaProxySessionLoaded = true;
  
  if (!chrome?.storage?.session) return;
  
  try {
    const data = await chrome.storage.session.get({
      [FIGMA_CAPTURE_PROXY_SESSION_KEY]: {},
      [FIGMA_CAPTURE_PROXY_DIAG_KEY]: []
    });
    figmaProxySessionCache = data?.[FIGMA_CAPTURE_PROXY_SESSION_KEY] || {};
    figmaProxyDiagnostics = Array.isArray(data?.[FIGMA_CAPTURE_PROXY_DIAG_KEY])
      ? data[FIGMA_CAPTURE_PROXY_DIAG_KEY]
      : [];
  } catch {
    figmaProxySessionCache = {};
    figmaProxyDiagnostics = [];
  }
}

/**
 * 持久化代理会话缓存
 */
async function persistProxySession() {
  if (!chrome?.storage?.session) return;
  try {
    await chrome.storage.session.set({
      [FIGMA_CAPTURE_PROXY_SESSION_KEY]: figmaProxySessionCache,
      [FIGMA_CAPTURE_PROXY_DIAG_KEY]: figmaProxyDiagnostics
    });
  } catch {}
}

/**
 * 将任务加入代理队列
 */
function enqueueProxyTask(task) {
  return new Promise((resolve, reject) => {
    figmaProxyQueue.push({ task, resolve, reject });
    pumpProxyQueue();
  });
}

/**
 * 处理代理队列
 */
function pumpProxyQueue() {
  while (figmaProxyActive < figmaProxyMaxConcurrency && figmaProxyQueue.length) {
    const item = figmaProxyQueue.shift();
    figmaProxyActive++;
    Promise.resolve()
      .then(item.task)
      .then(item.resolve, item.reject)
      .finally(() => {
        figmaProxyActive--;
        pumpProxyQueue();
      });
  }
}

/**
 * ArrayBuffer 转 Base64
 */
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * 代理获取资源
 */
async function proxyFetchAsset(url) {
  await loadProxySession();
  
  // 检查内存缓存
  const memCached = figmaProxyMemCache.get(url);
  if (memCached) {
    pushDiag({ url, phase: 'proxy-cache-memory', ok: true, status: 200 });
    return { ok: true, status: 200, cacheHit: 'memory', ...memCached };
  }
  
  // 检查会话缓存
  const sessionCached = figmaProxySessionCache[url];
  if (sessionCached) {
    figmaProxyMemCache.set(url, sessionCached);
    pushDiag({ url, phase: 'proxy-cache-session', ok: true, status: 200 });
    return { ok: true, status: 200, cacheHit: 'session', ...sessionCached };
  }
  
  // 检查是否正在请求
  if (figmaProxyInFlight.has(url)) {
    return figmaProxyInFlight.get(url);
  }
  
  // 创建新请求
  const promise = enqueueProxyTask(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FIGMA_CAPTURE_FETCH_TIMEOUT_MS);
      
      let response;
      try {
        response = await fetch(url, {
          credentials: 'omit',
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      
      if (!response.ok) {
        pushDiag({
          url,
          phase: 'proxy-fetch',
          ok: false,
          status: response.status,
          error: 'HTTP_' + response.status
        });
        return { ok: false, status: response.status, error: 'HTTP_' + response.status };
      }
      
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const base64 = toBase64(await response.arrayBuffer());
      const cached = { contentType, base64 };
      
      figmaProxyMemCache.set(url, cached);
      figmaProxySessionCache[url] = cached;
      persistProxySession();
      
      pushDiag({
        url,
        phase: 'proxy-fetch',
        ok: true,
        status: response.status,
        bytes: base64.length
      });
      
      return {
        ok: true,
        status: response.status,
        contentType,
        base64,
        cacheHit: 'miss'
      };
    } catch (err) {
      const errMsg = String(err);
      pushDiag({ url, phase: 'proxy-fetch', ok: false, status: 0, error: errMsg });
      return { ok: false, status: 0, error: errMsg };
    }
  }).finally(() => {
    figmaProxyInFlight.delete(url);
  });
  
  figmaProxyInFlight.set(url, promise);
  return promise;
}

// 处理采集请求消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'FIGMA_CAPTURE_START') return;
  
  (async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs && tabs[0];
      
      if (!tab?.id) {
        throw new Error('No active tab to capture');
      }
      
      const result = await runCapture(tab.id);
      if (!result) {
        throw new Error('Capture returned empty result');
      }
      
      saveResult(result);
      sendResponse({ ok: true });
    } catch (err) {
      console.error('Capture failed:', err);
      sendResponse({ ok: false, error: String(err) });
    }
  })();
  
  return true;
});

// 处理资源代理请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'FIGMA_CAPTURE_FETCH_ASSET' || !message.url) return;
  
  (async () => {
    const result = await proxyFetchAsset(message.url);
    sendResponse({
      ...result,
      diagnostics: {
        phase: 'proxy',
        cacheHit: result.cacheHit || null,
        queueDepth: figmaProxyQueue.length,
        activeRequests: figmaProxyActive,
        maxConcurrency: concurrencyLabel()
      }
    });
  })();
  
  return true;
});

// 处理诊断信息请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'FIGMA_CAPTURE_GET_DIAGNOSTICS') return;
  
  (async () => {
    await loadProxySession();
    sendResponse({
      ok: true,
      diagnostics: {
        generatedAt: new Date().toISOString(),
        queueDepth: figmaProxyQueue.length,
        activeRequests: figmaProxyActive,
        inFlight: figmaProxyInFlight.size,
        maxConcurrency: concurrencyLabel(),
        failures: figmaProxyDiagnostics.filter(d => d && d.ok === false)
      }
    });
  })();
  
  return true;
});

// 初始化并发配置
loadConcurrencyConfig();
