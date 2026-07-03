const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

const eventsModule = (function() {
  let eventsData = {
    events: []
  };

  async function loadEvents() {
    const data = await ipcRenderer.invoke('load-json', 'events.json');
    if (data) {
      eventsData = data;
      renderEventList();
    }
  }

  async function saveEvents() {
    const result = await ipcRenderer.invoke('save-json', 'events.json', eventsData);
    if (result.success) {
      showMessage('保存成功', 'success');
    } else {
      showMessage('保存失败', 'error');
    }
  }

  function renderEventList() {
    const listContainer = document.getElementById('eventList');
    if (!listContainer) return;
    if (eventsData.events.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <div class="empty-state-text">暂无事件信息，请在基本配置中生成故事</div>
        </div>
      `;
      return;
    }
    const colors = [
      '#667eea', '#f5576c', '#00f2fe', '#38f9d7', 
      '#fee140', '#330867', '#fed6e3', '#fecfef'
    ];
    listContainer.innerHTML = eventsData.events.map((event, index) => {
      const charactersHtml = event.characters && event.characters.length > 0 
        ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
             <strong>参与角色：</strong>${event.characters.join('、')}
           </div>`
        : '';
      return `
      <div class="event-card" style="border-left-color: ${colors[index % colors.length]};">
        <div class="event-card-header">
          <div class="event-card-category">${event.category}</div>
          <div class="event-card-timeline">${event.timeline}</div>
        </div>
        <div class="event-card-content">${event.content}</div>
        ${charactersHtml}
      </div>
    `;
    }).join('');
  }

  function refresh() {
    loadEvents();
  }

  function render(container) {
    const htmlPath = path.join(__dirname, 'events.html');
    const cssPath = path.join(__dirname, 'events.css');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    const style = document.createElement('style');
    style.textContent = cssContent;
    document.head.appendChild(style);
    container.innerHTML = htmlContent;
    loadEvents();
    window.refreshEventsPage = refresh;
  }

  return { render };
})();

module.exports = eventsModule;

