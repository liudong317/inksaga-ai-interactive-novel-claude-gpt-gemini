const { ipcRenderer } = require('electron');
const { cleanDeepSeekJSON } = require('./llm/deepseekHandler');
const { cleanOllamaJSON } = require('./llm/ollamaHandler');
const { cleanSuanliJSON } = require('./llm/suanliHandler');
const { cleanOpenAIJSON } = require('./llm/openaiHandler');
const promptLoader = require('./promptLoader');
const memoryManager = require('./memoryManager');

const aiChat = (function() {
  let conversationHistory = [];
  let storyContext = null;
  let playerInfo = null;
  let requestQueue = [];
  let isProcessing = false;
  let lastRequestTime = 0;
  const MIN_REQUEST_INTERVAL = 3000;
  let currentEventIndex = 0;
  let gameStartTime = null;
  let currentGameKey = null;

  async function initializeContext(config, scenario, events) {
    playerInfo = {
      name: config.name,
      gender: config.gender,
      category: config.category,
      description: config.description
    };

    const roleLabels = {
      'player': '玩家',
      'male_lead': '男主',
      'female_lead': '女主',
      'supporting': '配角'
    };

    const charactersInfo = scenario.characters.map(char => {
      const roleLabel = roleLabels[char.role] || '配角';
      const position = char.position ? `，职位：${char.position}` : '';
      const desc = char.description ? `，定位：${char.description}` : '';
      return `${char.name}（${roleLabel}，${char.gender}${position}，性格：${char.personality}，语气：${char.tone}${desc}）`;
    }).join('\n');

    storyContext = {
      outline: scenario.outline,
      characters: scenario.characters,
      charactersInfo: charactersInfo,
      events: events.events,
      category: config.category
    };

    currentGameKey = `${config.name}_${config.category}`;
    
    conversationHistory = [];
    await loadGameProgress();
    await loadChatHistory();
    await memoryManager.initialize(currentGameKey);
    console.log('AI对话上下文初始化完成');
  }

  async function loadGameProgress() {
    try {
      const progress = await ipcRenderer.invoke('load-json', 'game-progress.json');
      if (progress && progress.gameStartTime) {
        currentEventIndex = progress.currentEventIndex || 0;
        gameStartTime = progress.gameStartTime;
      } else {
        currentEventIndex = 0;
        gameStartTime = Date.now();
        await saveGameProgress();
      }
    } catch (error) {
      console.error('加载游戏进度失败:', error);
      currentEventIndex = 0;
      gameStartTime = Date.now();
    }
  }

  async function saveGameProgress() {
    const progress = {
      currentEventIndex: currentEventIndex,
      completedEvents: storyContext.events.slice(0, currentEventIndex).map((e, i) => i),
      gameStartTime: gameStartTime,
      lastUpdateTime: Date.now()
    };
    await ipcRenderer.invoke('save-json', 'game-progress.json', progress);
  }

  async function loadChatHistory() {
    if (!currentGameKey) {
      console.log('游戏标识为空，跳过加载聊天记录');
      return;
    }
    
    try {
      const result = await ipcRenderer.invoke('load-chat-history', currentGameKey);
      if (result.success && result.history && result.history.length > 0) {
        conversationHistory = result.history;
        console.log(`已加载 ${result.history.length} 条聊天记录`);
      } else {
        console.log('未找到历史聊天记录，开始新游戏');
      }
    } catch (error) {
      console.error('加载聊天记录失败:', error);
    }
  }

  async function saveChatHistory() {
    if (!currentGameKey) {
      console.log('游戏标识为空，跳过保存聊天记录');
      return;
    }
    
    try {
      await ipcRenderer.invoke('save-chat-history', currentGameKey, conversationHistory);
    } catch (error) {
      console.error('保存聊天记录失败:', error);
    }
  }

  function getGameTime() {
    if (!gameStartTime) return 0;
    const realTimeElapsed = Date.now() - gameStartTime;
    const gameYears = realTimeElapsed / (60 * 60 * 1000);
    return gameYears;
  }

  function getCurrentEvent() {
    if (!storyContext || !storyContext.events || currentEventIndex >= storyContext.events.length) {
      return null;
    }
    return storyContext.events[currentEventIndex];
  }

  function checkEventTrigger() {
    const currentEvent = getCurrentEvent();
    if (!currentEvent) return null;
    const timelineMatch = currentEvent.timeline.match(/第(\d+)(周|个月|年)/);
    if (!timelineMatch) return null;
    const [, num, unit] = timelineMatch;
    const value = parseInt(num);
    let requiredYears = 0;
    if (unit === '周') {
      requiredYears = value / 52;
    } else if (unit === '个月') {
      requiredYears = value / 12;
    } else if (unit === '年') {
      requiredYears = value;
    }
    const gameYears = getGameTime();
    if (gameYears >= requiredYears) {
      return currentEvent;
    }
    return null;
  }

  async function processQueue() {
    if (isProcessing || requestQueue.length === 0) {
      return;
    }
    isProcessing = true;
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    const { userMessage, onProgress, resolve, reject, retryCount } = requestQueue.shift();
    try {
      const result = await executeRequest(userMessage, onProgress, retryCount);
      resolve(result);
    } catch (error) {
      reject(error);
    }
    lastRequestTime = Date.now();
    isProcessing = false;
    if (requestQueue.length > 0) {
      setTimeout(() => processQueue(), 100);
    }
  }

  async function executeRequest(userMessage, onProgress, retryCount = 0) {
    if (!storyContext || !playerInfo) {
      throw new Error('对话上下文未初始化');
    }

    conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    const memories = memoryManager.getRecentMemories(30);
    const memoryContext = memories.length > 0 ? `\n\n【!!!核心记忆 - 必须严格遵守!!!】\n以下是游戏中已发生的重要变化，你必须无条件记住并在所有回复中遵守：\n${memories.map((memory, i) => `${i + 1}. ${memory}`).join('\n')}\n` : '';

    const coreRules = promptLoader.buildChatPrompt();

    const systemPrompt = promptLoader.buildSimpleSystemPrompt(
      playerInfo,
      storyContext.charactersInfo,
      storyContext.category,
      storyContext.outline
    ) + memoryContext + '\n\n' + coreRules;

    const recentHistory = conversationHistory.slice(-2);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory
    ];

    if (onProgress) {
      onProgress('AI思考中...');
    }

    try {
      const result = await ipcRenderer.invoke('chat-with-ai', messages);

      if (!result.success) {
        const modelConfig = await ipcRenderer.invoke('load-json', 'model.json');
        if (modelConfig && modelConfig.connectionStatus) {
          modelConfig.connectionStatus.connected = false;
          await ipcRenderer.invoke('save-json', 'model.json', modelConfig);
          await ipcRenderer.invoke('set-model-status', false);
        }
        
        if (result.error.includes('429')) {
          if (retryCount < 2) {
            if (onProgress) {
              onProgress('请求过于频繁，等待后重试...');
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
            conversationHistory.pop();
            return executeRequest(userMessage, onProgress, retryCount + 1);
          }
          throw new Error('请求频率超限，请稍后再试');
        }
        if (retryCount < 1 && (result.error.includes('超时') || result.error.includes('重置'))) {
          if (onProgress) {
            onProgress('连接失败，正在重试...');
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
          conversationHistory.pop();
          return executeRequest(userMessage, onProgress, retryCount + 1);
        }
        throw new Error(result.error || 'AI回复失败');
      }

      conversationHistory.push({
        role: 'assistant',
        content: result.content
      });

      await extractStateChanges(result.content);

      if (conversationHistory.length > 50) {
        conversationHistory = conversationHistory.slice(-50);
      }

      await saveChatHistory();

      return {
        success: true,
        content: result.content
      };
    } catch (error) {
      console.error('AI对话失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async function sendMessage(userMessage, onProgress) {
    return new Promise((resolve, reject) => {
      requestQueue.push({
        userMessage,
        onProgress,
        resolve,
        reject,
        retryCount: 0
      });
      processQueue();
    });
  }

  async function clearHistory() {
    conversationHistory = [];
    await memoryManager.clearMemories();
    console.log('对话历史和记忆已清空');
  }

  async function extractStateChanges(aiResponse) {
    const changes = [];

    const explicitPattern = /【状态变化[：:](.*?)】/g;
    let match;
    while ((match = explicitPattern.exec(aiResponse)) !== null) {
      const change = match[1].trim();
      if (change && change.length > 0 && change.length < 100) {
        changes.push(change);
      }
    }

    if (changes.length > 0) {
      await memoryManager.addMemories(changes);
    }
  }

  return {
    initializeContext,
    sendMessage,
    clearHistory,
    getMemories: () => memoryManager.getMemories(),
    getMemoryStats: () => memoryManager.getStats()
  };
})();

module.exports = aiChat;
