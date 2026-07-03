const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const modalComponent = require('../../components/modal.js');
const storyGenerator = require('../../services/storyGenerator.js');

const configModule = (function() {
  let configData = {
    name: '',
    gender: '',
    category: '',
    description: '',
    playerCount: 5,
    eventCount: 10
  };

  async function loadConfig() {
    const data = await ipcRenderer.invoke('load-json', 'config.json');
    if (data) {
      configData = data;
      updateForm();
    }
  }

  function updateForm() {
    const nameInput = document.getElementById('configName');
    const genderSelect = document.getElementById('configGender');
    const categorySelect = document.getElementById('configCategory');
    const descriptionTextarea = document.getElementById('configDescription');
    const playerCountSelect = document.getElementById('configPlayerCount');
    const eventCountSelect = document.getElementById('configEventCount');
    if (nameInput) nameInput.value = configData.name || '';
    if (genderSelect) genderSelect.value = configData.gender || '';
    if (categorySelect) categorySelect.value = configData.category || '都市';
    if (descriptionTextarea) descriptionTextarea.value = configData.description || '';
    if (playerCountSelect) playerCountSelect.value = configData.playerCount || 5;
    if (eventCountSelect) eventCountSelect.value = configData.eventCount || 10;
  }

  async function saveConfig() {
    const nameInput = document.getElementById('configName');
    const genderSelect = document.getElementById('configGender');
    const categorySelect = document.getElementById('configCategory');
    const descriptionTextarea = document.getElementById('configDescription');
    const playerCountSelect = document.getElementById('configPlayerCount');
    if (!nameInput.value.trim()) {
      modalComponent.showError('请输入姓名');
      return;
    }
    if (!genderSelect.value) {
      modalComponent.showError('请选择性别');
      return;
    }
    if (!categorySelect.value) {
      modalComponent.showError('请选择剧情类别');
      return;
    }
    if (!descriptionTextarea.value.trim()) {
      modalComponent.showError('请输入剧情描述');
      return;
    }
    const eventCountSelect = document.getElementById('configEventCount');
    configData = {
      name: nameInput.value,
      gender: genderSelect.value,
      category: categorySelect.value,
      description: descriptionTextarea.value,
      playerCount: parseInt(playerCountSelect.value),
      eventCount: parseInt(eventCountSelect.value)
    };
    const result = await ipcRenderer.invoke('save-json', 'config.json', configData);
    if (result.success) {
      showMessage('保存成功', 'success');
    } else {
      modalComponent.showError('保存失败');
    }
  }

  async function clearConfig() {
    modalComponent.showConfirm(
      '删除配置将同时删除该配置的聊天记录和记忆文件，此操作不可恢复！',
      async () => {
        try {
          const currentGameKey = configData.name && configData.category ? 
            `${configData.name}_${configData.category}` : null;

          const emptyConfig = {
            name: '',
            gender: '',
            category: '都市',
            description: '',
            playerCount: 5,
            eventCount: 10
          };
          const emptyScenario = {
            outline: '',
            characters: []
          };
          const emptyEvents = {
            events: []
          };
          
          await ipcRenderer.invoke('save-json', 'config.json', emptyConfig);
          await ipcRenderer.invoke('save-json', 'scenario.json', emptyScenario);
          await ipcRenderer.invoke('save-json', 'events.json', emptyEvents);
          
          if (currentGameKey) {
            await ipcRenderer.invoke('delete-chat-history', currentGameKey);
            await ipcRenderer.invoke('delete-memory', currentGameKey);
          }
          
          configData = emptyConfig;
          updateForm();
          showMessage('配置已清理，聊天记录和记忆已删除', 'success');
          
          if (window.refreshScenarioPage) {
            window.refreshScenarioPage();
          }
          if (window.refreshEventsPage) {
            window.refreshEventsPage();
          }
        } catch (error) {
          console.error('清理配置失败:', error);
          modalComponent.showError('清理配置失败: ' + error.message);
        }
      }
    );
  }

  async function startGame() {
    const nameInput = document.getElementById('configName');
    const genderSelect = document.getElementById('configGender');
    const categorySelect = document.getElementById('configCategory');
    const descriptionTextarea = document.getElementById('configDescription');
    const playerCountSelect = document.getElementById('configPlayerCount');
    if (!nameInput.value.trim()) {
      modalComponent.showError('请输入姓名');
      return;
    }
    if (!genderSelect.value) {
      modalComponent.showError('请选择性别');
      return;
    }
    if (!categorySelect.value) {
      modalComponent.showError('请选择剧情类别');
      return;
    }
    if (!descriptionTextarea.value.trim()) {
      modalComponent.showError('请输入剧情描述');
      return;
    }
    const modelStatus = await ipcRenderer.invoke('check-model-status');
    if (!modelStatus.connected) {
      modalComponent.showApiGuide(
        '请先连接 AI 模型后再开始游戏。\n\n推荐使用晴红API 中转站，注册即可获取 API Key，支持 Claude / GPT / Gemini 等模型。',
        { showRegister: true, showModelNav: true }
      );
      return;
    }
    if (window.showGameMenu) {
      window.showGameMenu();
    }
    if (window.startStoryGeneration) {
      const config = {
        name: nameInput.value,
        gender: genderSelect.value,
        category: categorySelect.value,
        description: descriptionTextarea.value,
        playerCount: parseInt(playerCountSelect.value)
      };
      window.startStoryGeneration(config);
    }
  }

  function showMessage(msg, type) {
    const existingMsg = document.querySelector('.message-toast');
    if (existingMsg) existingMsg.remove();
    const toast = document.createElement('div');
    toast.className = 'message-toast';
    toast.textContent = msg;
    toast.style.cssText = `background: ${type === 'success' ? '#38ef7d' : '#f45c43'};`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  function render(container) {
    const htmlPath = path.join(__dirname, 'config.html');
    const cssPath = path.join(__dirname, 'config.css');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    const style = document.createElement('style');
    style.textContent = cssContent;
    document.head.appendChild(style);
    container.innerHTML = htmlContent;
    loadConfig();
    document.getElementById('saveConfigBtn').addEventListener('click', saveConfig);
    document.getElementById('clearConfigBtn').addEventListener('click', clearConfig);
    document.getElementById('startGameBtn').addEventListener('click', startGame);
    const gotoModelBtn = document.getElementById('gotoModelFromConfig');
    if (gotoModelBtn) {
      gotoModelBtn.addEventListener('click', () => {
        if (window.showModelMenu) window.showModelMenu();
      });
    }
  }

  return { render };
})();

module.exports = configModule;

