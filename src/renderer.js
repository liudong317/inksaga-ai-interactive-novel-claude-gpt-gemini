const { ipcRenderer } = require('electron');
const { setupQinghongLinkDelegation } = require('./utils/qinghongLinks');

(function() {
  let currentPage = 'config';
  let pageModules = {};
  let isPageInitialized = {};

  async function init() {
    setupQinghongLinkDelegation();
    await loadVersion();
    setupTitlebarControls();
    setupMenuNavigation();
    loadPage('config');
  }

  async function loadVersion() {
    try {
      const version = await ipcRenderer.invoke('get-version');
      document.getElementById('appVersion').textContent = `v${version}`;
    } catch (error) {
      console.error('加载版本号失败:', error);
    }
  }

  function setupTitlebarControls() {
    document.getElementById('minimizeBtn').addEventListener('click', () => {
      ipcRenderer.send('window-minimize');
    });
    document.getElementById('maximizeBtn').addEventListener('click', () => {
      ipcRenderer.send('window-maximize');
    });
    document.getElementById('closeBtn').addEventListener('click', () => {
      ipcRenderer.send('window-close');
    });
  }

  function setupMenuNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        if (page !== currentPage) {
          menuItems.forEach(mi => mi.classList.remove('active'));
          item.classList.add('active');
          loadPage(page);
        }
      });
    });
  }

  function loadPage(page) {
    if (currentPage === page && isPageInitialized[page]) {
      return;
    }
    currentPage = page;
    const contentDiv = document.getElementById('pageContent');
    
    if (!pageModules[page]) {
      switch(page) {
        case 'config':
          pageModules[page] = require('./pages/config/config.js');
          break;
        case 'model':
          pageModules[page] = require('./pages/model/model.js');
          break;
        case 'scenario':
          pageModules[page] = require('./pages/scenario/scenario.js');
          break;
        case 'events':
          pageModules[page] = require('./pages/events/events.js');
          break;
        case 'game':
          pageModules[page] = require('./pages/game/game.js');
          break;
        case 'about':
          pageModules[page] = require('./pages/about/about.js');
          break;
      }
    }
    
    const allPages = document.querySelectorAll('.page-container');
    allPages.forEach(p => p.style.display = 'none');
    
    let pageContainer = document.getElementById(`page-${page}`);
    if (pageContainer) {
      pageContainer.style.display = 'block';
    } else {
      pageContainer = document.createElement('div');
      pageContainer.id = `page-${page}`;
      pageContainer.className = 'page-container';
      contentDiv.appendChild(pageContainer);
      pageModules[page].render(pageContainer);
      isPageInitialized[page] = true;
    }
  }

  window.showGameMenu = function() {
    const gameMenuItem = document.querySelector('.menu-item[data-page="game"]');
    if (gameMenuItem) {
      gameMenuItem.classList.remove('menu-item-hidden');
      gameMenuItem.click();
    }
  };

  window.showModelMenu = function() {
    const modelMenuItem = document.querySelector('.menu-item[data-page="model"]');
    if (modelMenuItem) {
      modelMenuItem.click();
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();

