/**
 * Web to Figma - Panel
 * @author 板栗alive
 * @link https://github.com/SGloria
 */
const KEY_PROXY = 'enableAssetProxyFetch';
const KEY_THREADS = 'proxyFetchConcurrency';
const THREADS_OPTS = new Set(['4', '6', '8', '12', '16', '20', 'infinite']);

const $proxy = document.getElementById('proxy');
const $threads = document.getElementById('threads');
const $run = document.getElementById('run');
const $msg = document.getElementById('msg');

const normalize = v => THREADS_OPTS.has(String(v)) ? String(v) : '8';
const showMsg = t => { $msg.textContent = t || ''; };
const setBusy = b => { $run.disabled = b; $run.textContent = b ? '采集中...' : '开始采集'; };

chrome.storage.local.get({ [KEY_PROXY]: false, [KEY_THREADS]: '8' }, d => {
  $proxy.checked = Boolean(d[KEY_PROXY]);
  $threads.value = normalize(d[KEY_THREADS]);
});

$proxy.addEventListener('change', () => {
  chrome.storage.local.set({ [KEY_PROXY]: $proxy.checked });
});

$threads.addEventListener('change', () => {
  const v = normalize($threads.value);
  $threads.value = v;
  chrome.storage.local.set({ [KEY_THREADS]: v });
});

$run.addEventListener('click', () => {
  setBusy(true);
  showMsg('');
  chrome.runtime.sendMessage({ type: 'FIGMA_CAPTURE_START' }, res => {
    const err = chrome.runtime.lastError;
    if (err) { 
      setBusy(false);
      showMsg('出错了：' + err.message); 
      return; 
    }
    if (!res?.ok) { 
      setBusy(false);
      showMsg('出错了：' + (res?.error || '未知问题')); 
      return; 
    }
    // 成功后关闭弹窗，工具栏会在页面上显示
    window.close();
  });
});
