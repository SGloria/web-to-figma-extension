/**
 * Web to Figma - Runner Script (Fast)
 * @author 板栗alive
 */
(async () => {
  if (!window.figma?.captureForDesign) {
    throw new Error('window.figma.captureForDesign is not available');
  }
  
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const vh = window.innerHeight;
  const scrollHeight = document.body.scrollHeight;
  
  if (scrollHeight > vh * 1.5) {
    const step = Math.floor(vh * 0.95);
    for (let y = 0; y < scrollHeight; y += step) {
      window.scrollTo(0, y);
      await sleep(80);
    }
    await sleep(200);
    window.scrollTo(0, 0);
  }
  
  const images = Array.from(document.images || []);
  if (images.length > 0) {
    await Promise.race([
      Promise.allSettled(
        images.map(img => 
          img.complete ? Promise.resolve() : new Promise(r => {
            img.onload = img.onerror = r;
            setTimeout(r, 2000);
          })
        )
      ),
      sleep(3000)
    ]);
  }
  
  if (document.fonts?.ready) {
    await Promise.race([document.fonts.ready, sleep(500)]);
  }
  
  return await window.figma.captureForDesign({ selector: 'body', delayMs: 0 });
})();
