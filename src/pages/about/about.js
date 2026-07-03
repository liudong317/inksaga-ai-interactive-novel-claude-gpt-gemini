const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

const aboutModule = (function() {
  async function loadVersion() {
    try {
      const version = await ipcRenderer.invoke('get-version');
      const el = document.getElementById('aboutVersion');
      if (el) el.textContent = `v${version}`;
    } catch (error) {
      console.error('加载版本号失败:', error);
    }
  }

  function render(container) {
    const htmlPath = path.join(__dirname, 'about.html');
    const cssPath = path.join(__dirname, 'about.css');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    const style = document.createElement('style');
    style.textContent = cssContent;
    document.head.appendChild(style);
    container.innerHTML = htmlContent;
    loadVersion();
  }

  return { render };
})();

module.exports = aboutModule;
