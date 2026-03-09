/**
 * Web to Figma - Runner Script
 * 
 * @author 板栗alive
 * @link https://github.com/SGloria
 */

(async () => {
  /**
   * 延迟函数
   */
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // 检查 captureForDesign 是否可用
  if (!window.figma?.captureForDesign) {
    throw new Error('window.figma.captureForDesign is not available. capture.js may not have loaded.');
  }
  
  // 计算滚动步长
  const scrollStep = Math.max(400, Math.floor(window.innerHeight * 0.8));
  
  // 滚动页面以触发懒加载
  for (let y = 0; y < document.body.scrollHeight; y += scrollStep) {
    window.scrollTo(0, y);
    await sleep(400);
  }
  
  // 等待一段时间让内容加载
  await sleep(1500);
  
  // 滚动回顶部
  window.scrollTo(0, 0);
  
  // 等待所有图片加载完成
  const images = Array.from(document.images || []);
  await Promise.allSettled(
    images.map(img => 
      img.complete
        ? Promise.resolve()
        : new Promise(resolve => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
            setTimeout(resolve, 10000);
          })
    )
  );
  
  // 等待字体加载
  if (document.fonts?.ready) {
    await Promise.race([
      document.fonts.ready,
      sleep(3000)
    ]);
  }
  
  // 最终等待
  await sleep(1000);
  
  // 执行采集
  return await window.figma.captureForDesign({ selector: 'body' });
})();
