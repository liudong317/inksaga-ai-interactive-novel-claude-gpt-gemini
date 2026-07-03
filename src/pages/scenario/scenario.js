const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

const scenarioModule = (function() {
  let scenarioData = {
    outline: '',
    characters: []
  };

  async function loadScenario() {
    const data = await ipcRenderer.invoke('load-json', 'scenario.json');
    if (data) {
      scenarioData = data;
      renderCharacterList();
    }
  }

  async function saveScenario() {
    const result = await ipcRenderer.invoke('save-json', 'scenario.json', scenarioData);
    if (result.success) {
      showMessage('保存成功', 'success');
    } else {
      showMessage('保存失败', 'error');
    }
  }

  function renderCharacterList() {
    const listContainer = document.getElementById('characterList');
    if (!listContainer) return;
    if (scenarioData.characters.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-text">暂无角色信息，请在基本配置中生成故事</div>
        </div>
      `;
      return;
    }
    const colors = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
      'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
    ];
    
    const roleLabels = {
      'player': '玩家',
      'male_lead': '男主',
      'female_lead': '女主',
      'supporting': '配角'
    };
    
    listContainer.innerHTML = scenarioData.characters.map((char, index) => {
      const roleLabel = roleLabels[char.role] || '配角';
      const roleColor = char.role === 'player' ? '#ff6b6b' : (char.role === 'male_lead' || char.role === 'female_lead') ? '#ffd93d' : '#6bcf7f';
      return `
      <div class="character-card" style="background: ${colors[index % colors.length]};">
        <div class="character-card-header">
          <div class="character-card-name">${char.name}</div>
          <div class="character-card-gender">${char.gender}</div>
        </div>
        <div style="text-align: center; margin: 8px 0;">
          <span style="background: ${roleColor}; color: #fff; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;">${roleLabel}</span>
        </div>
        <div class="character-card-info">
          ${char.position ? `<div><strong>职位：</strong>${char.position}</div>` : ''}
          <div><strong>性格：</strong>${char.personality}</div>
          <div><strong>语气：</strong>${char.tone}</div>
          ${char.description ? `<div><strong>定位：</strong>${char.description}</div>` : ''}
        </div>
      </div>
    `;
    }).join('');
  }

  function refresh() {
    loadScenario().then(() => {
      const outlineInput = document.getElementById('scenarioOutline');
      if (outlineInput) outlineInput.value = scenarioData.outline || '';
    });
  }

  function render(container) {
    const htmlPath = path.join(__dirname, 'scenario.html');
    const cssPath = path.join(__dirname, 'scenario.css');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    const style = document.createElement('style');
    style.textContent = cssContent;
    document.head.appendChild(style);
    container.innerHTML = htmlContent;
    loadScenario().then(() => {
      const outlineInput = document.getElementById('scenarioOutline');
      if (outlineInput) outlineInput.value = scenarioData.outline || '';
    });
    window.refreshScenarioPage = refresh;
  }

  return { render };
})();

module.exports = scenarioModule;

