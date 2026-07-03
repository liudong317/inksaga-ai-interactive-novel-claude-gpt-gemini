const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const storyGenerator = require('../../services/storyGenerator.js');
const aiChat = require('../../services/aiChat.js');

const gameModule = (function() {
  let messages = [];
  let isGenerating = false;
  let playerName = '玩家';
  let isStoryReady = false;

  function addMessage(role, content) {
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    messages.push({ role, content, time: timeStr });
    renderMessages();
  }

  function renderMessages() {
    const listContainer = document.getElementById('messageList');
    if (!listContainer) return;
    if (messages.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-game-state">
          <div class="empty-game-icon">🎮</div>
          <div class="empty-game-text">欢迎来到游戏世界</div>
        </div>
      `;
      return;
    }
    listContainer.innerHTML = messages.map(msg => {
      let className = 'message-ai';
      let senderName = '';
      if (msg.role === 'user') {
        className = 'message-user';
        senderName = playerName;
      } else if (msg.role === 'system') {
        className = 'message-ai';
        senderName = 'AI';
      } else if (msg.role === 'ai') {
        className = 'message-ai';
        const nameMatch = msg.content.match(/^【(.+?)】/);
        if (nameMatch) {
          senderName = nameMatch[1];
        } else {
          senderName = 'AI';
        }
      }
      return `
        <div class="message-item ${className}">
          <div class="message-bubble">
            <div class="message-sender">${senderName}</div>
            <div class="message-time">${msg.time || ''}</div>
            <div class="message-content">${msg.content}</div>
          </div>
        </div>
      `;
    }).join('');
    listContainer.scrollTop = listContainer.scrollHeight;
  }

  async function sendMessage() {
    if (isGenerating || !isStoryReady) return;
    const inputDiv = document.getElementById('richInput');
    const content = inputDiv.innerHTML.trim();
    if (!content) return;
    const textContent = inputDiv.textContent.trim();
    addMessage('user', textContent);
    inputDiv.innerHTML = '';
    isGenerating = true;
    updateSendButtonState();
    const thinkingMsgIndex = messages.length;
    addMessage('system', '正在思考......请等待！');
    try {
      const result = await aiChat.sendMessage(textContent, (status) => {
        console.log('AI状态:', status);
      });
      messages.splice(thinkingMsgIndex, 1);
      if (result.success) {
        addMessage('ai', result.content);
      } else {
        addMessage('system', 'AI回复失败：' + result.error);
      }
    } catch (error) {
      messages.splice(thinkingMsgIndex, 1);
      addMessage('system', '发送失败：' + error.message);
    }
    isGenerating = false;
    updateSendButtonState();
  }

  function updateSendButtonState() {
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      sendBtn.disabled = isGenerating;
      sendBtn.style.opacity = isGenerating ? '0.5' : '1';
      sendBtn.style.cursor = isGenerating ? 'not-allowed' : 'pointer';
    }
  }

  async function startGeneration(config) {
    playerName = config.name || '玩家';
    isGenerating = true;
    updateSendButtonState();
    addMessage('system', '开始生成故事...');
    const result = await storyGenerator.generateStory(config, (status) => {
      addMessage('system', status);
    });
    if (result.success) {
      addMessage('system', '故事生成成功！剧情和角色信息已保存。');
      await initializeAIChat(config);
    } else {
      addMessage('system', '故事生成失败：' + result.error);
    }
    isGenerating = false;
    updateSendButtonState();
  }

  async function initializeAIChat(config) {
    try {
      const scenario = await ipcRenderer.invoke('load-json', 'scenario.json');
      const events = await ipcRenderer.invoke('load-json', 'events.json');
      if (scenario && events && scenario.characters && scenario.characters.length > 0) {
        await aiChat.initializeContext(config, scenario, events);
        isStoryReady = true;
        
        await loadHistoryChatMessages(config);
        
        if (messages.length === 0) {
          addMessage('system', '故事世界已就绪，开始你的冒险吧！');
        } else {
          addMessage('system', '已加载历史聊天记录，继续你的冒险！');
        }
      } else {
        addMessage('system', '故事数据加载失败');
      }
    } catch (error) {
      console.error('初始化AI对话失败:', error);
      addMessage('system', '初始化失败：' + error.message);
    }
  }

  async function loadHistoryChatMessages(config) {
    try {
      const gameKey = `${config.name}_${config.category}`;
      const result = await ipcRenderer.invoke('load-chat-history', gameKey);
      
      if (result.success && result.history && result.history.length > 0) {
        messages = [];
        
        result.history.forEach(msg => {
          if (msg.role === 'user') {
            addMessage('user', msg.content);
          } else if (msg.role === 'assistant') {
            addMessage('ai', msg.content);
          }
        });
        
        console.log(`已加载 ${result.history.length} 条历史聊天记录`);
      }
    } catch (error) {
      console.error('加载历史聊天记录失败:', error);
    }
  }

  async function checkExistingStory(config) {
    try {
      const scenario = await ipcRenderer.invoke('load-json', 'scenario.json');
      const events = await ipcRenderer.invoke('load-json', 'events.json');
      if (scenario && events && scenario.outline && scenario.characters && scenario.characters.length > 0 && events.events && events.events.length > 0) {
        playerName = config.name || '玩家';
        addMessage('system', '检测到已有故事内容，正在加载...');
        await initializeAIChat(config);
        return true;
      }
      return false;
    } catch (error) {
      console.error('检查故事数据失败:', error);
      return false;
    }
  }

  function render(container) {
    const htmlPath = path.join(__dirname, 'game.html');
    const cssPath = path.join(__dirname, 'game.css');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    const style = document.createElement('style');
    style.textContent = cssContent;
    document.head.appendChild(style);
    container.innerHTML = htmlContent;
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    const inputDiv = document.getElementById('richInput');
    inputDiv.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    window.startStoryGeneration = async (config) => {
      const hasStory = await checkExistingStory(config);
      if (!hasStory) {
        await startGeneration(config);
      }
    };
  }

  return { render };
})();

module.exports = gameModule;

