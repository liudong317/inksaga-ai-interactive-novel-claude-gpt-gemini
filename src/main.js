const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { callOllama } = require('./services/llm/ollamaHandler');
const { callOpenAI } = require('./services/llm/openaiHandler');

let mainWindow = null;
let splashWindow = null;
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createSplashWindow();
    setTimeout(() => {
      createMainWindow();
    }, 2000);
  });
}

const iconPath = path.join(__dirname, 'assets/icons/icon.ico');

if (process.platform === 'win32') {
  app.setAppUserModelId('com.inksaga.app');
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 576,
    show: false,
    frame: false,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('get-version', () => {
  try {
    const verPath = path.join(__dirname, '../ver.json');
    const verData = fs.readFileSync(verPath, 'utf8');
    return JSON.parse(verData).version;
  } catch (error) {
    console.error('读取版本号失败:', error);
    return '1.0.0';
  }
});

ipcMain.handle('load-json', (event, filename) => {
  try {
    const filePath = path.join(__dirname, 'data', filename);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('读取JSON失败:', error);
    return null;
  }
});

ipcMain.handle('save-json', (event, filename, data) => {
  try {
    const filePath = path.join(__dirname, 'data', filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('保存JSON失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-chat-history', (event, gameKey, chatHistory) => {
  try {
    const chatDir = path.join(__dirname, 'data', 'chat-history');
    if (!fs.existsSync(chatDir)) {
      fs.mkdirSync(chatDir, { recursive: true });
    }
    
    const safeGameKey = gameKey.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
    const filePath = path.join(chatDir, `${safeGameKey}.json`);
    
    fs.writeFileSync(filePath, JSON.stringify({
      gameKey: gameKey,
      lastUpdate: new Date().toISOString(),
      history: chatHistory
    }, null, 2), 'utf8');
    
    return { success: true };
  } catch (error) {
    console.error('保存聊天记录失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-chat-history', (event, gameKey) => {
  try {
    const chatDir = path.join(__dirname, 'data', 'chat-history');
    const safeGameKey = gameKey.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
    const filePath = path.join(chatDir, `${safeGameKey}.json`);
    
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const chatData = JSON.parse(data);
      return { success: true, history: chatData.history };
    }
    
    return { success: true, history: [] };
  } catch (error) {
    console.error('加载聊天记录失败:', error);
    return { success: false, error: error.message, history: [] };
  }
});

ipcMain.handle('delete-chat-history', (event, gameKey) => {
  try {
    const chatDir = path.join(__dirname, 'data', 'chat-history');
    const safeGameKey = gameKey.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
    const filePath = path.join(chatDir, `${safeGameKey}.json`);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    return { success: true };
  } catch (error) {
    console.error('删除聊天记录失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-memory', (event, gameKey) => {
  try {
    const chatDir = path.join(__dirname, 'data', 'chat-history');
    const safeGameKey = gameKey.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
    const filePath = path.join(chatDir, `memory_${safeGameKey}.json`);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    return { success: true };
  } catch (error) {
    console.error('删除记忆文件失败:', error);
    return { success: false, error: error.message };
  }
});

let modelConnectionStatus = false;

function loadConnectionStatus() {
  try {
    const filePath = path.join(__dirname, 'data', 'model.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const modelConfig = JSON.parse(data);
      if (modelConfig && modelConfig.connectionStatus) {
        modelConnectionStatus = modelConfig.connectionStatus.connected || false;
      }
    }
  } catch (error) {
    console.error('读取连接状态失败:', error);
    modelConnectionStatus = false;
  }
}

loadConnectionStatus();

ipcMain.handle('test-model-connection', async (event, config) => {
  try {
    const https = require('https');
    const http = require('http');
    const url = require('url');
    const apiUrl = new URL(`${config.baseUrl}/chat/completions`);
    const postData = JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: '测试连接' }],
      max_tokens: 10
    });
    const options = {
      hostname: apiUrl.hostname,
      port: apiUrl.port || (apiUrl.protocol === 'https:' ? 443 : 80),
      path: apiUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };
    return new Promise((resolve) => {
      const protocol = apiUrl.protocol === 'https:' ? https : http;
      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('模型连接测试成功');
            modelConnectionStatus = true;
            resolve({ success: true });
          } else {
            console.error('模型连接测试失败:', res.statusCode, data);
            modelConnectionStatus = false;
            resolve({ success: false, error: `HTTP ${res.statusCode}` });
          }
        });
      });
      req.on('error', (error) => {
        console.error('模型连接测试错误:', error);
        modelConnectionStatus = false;
        resolve({ success: false, error: error.message });
      });
      req.on('timeout', () => {
        req.destroy();
        console.error('模型连接测试超时');
        modelConnectionStatus = false;
        resolve({ success: false, error: '连接超时' });
      });
      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error('模型连接测试异常:', error);
    modelConnectionStatus = false;
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-model-status', (event, status) => {
  modelConnectionStatus = status;
  console.log('模型连接状态更新:', modelConnectionStatus);
  return { success: true };
});

ipcMain.handle('check-model-status', () => {
  loadConnectionStatus();
  return { connected: modelConnectionStatus };
});

ipcMain.handle('log-to-main', (event, logData) => {
  const { level, tag, data } = logData;
  console.log(`\n=== ${tag} ===`);
  if (level === 'error') {
    console.error('错误信息:', data.message);
    console.error('错误位置:', data.position);
    console.error('内容长度:', data.contentLength);
    if (data.before) console.error('错误位置前150字符:', data.before);
    if (data.errorChar) console.error('错误位置字符:', data.errorChar, '(ASCII:', data.errorCharCode, ')');
    if (data.after) console.error('错误位置后150字符:', data.after);
    if (data.fullContent) console.error('完整内容（前1000字符）:', data.fullContent);
  } else {
    console.log('数据:', data);
  }
  console.log('=== 日志结束 ===\n');
  return { success: true };
});

ipcMain.handle('get-ollama-models', async (event, baseUrl) => {
  try {
    const http = require('http');
    const url = require('url');
    const apiUrl = new URL(`${baseUrl}/api/tags`);
    return new Promise((resolve, reject) => {
      const options = {
        hostname: apiUrl.hostname,
        port: apiUrl.port || 11434,
        path: apiUrl.pathname,
        method: 'GET',
        timeout: 5000
      };
      const req = http.request(options, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            if (jsonData && jsonData.models) {
              const models = jsonData.models.map(m => m.name);
              resolve({ success: true, models });
            } else {
              resolve({ success: true, models: [] });
            }
          } catch (error) {
            reject(new Error('解析Ollama响应失败'));
          }
        });
      });
      req.on('error', (error) => {
        reject(new Error(`无法连接到Ollama服务: ${error.message}`));
      });
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('连接Ollama服务超时'));
      });
      req.end();
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

async function invokeLLM(messages, provider, options = {}) {
  if (provider.type === 'ollama') {
    return await callOllama(messages, provider, options);
  }
  return await callOpenAI(messages, provider, options);
}

ipcMain.handle('test-llm-connection', async (event, { messages, provider }) => {
  try {
    return await invokeLLM(messages, provider);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('call-llm', async (event, { messages, provider, options }) => {
  try {
    return await invokeLLM(messages, provider, options);
  } catch (error) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle('chat-with-ai', async (event, messages) => {
  try {
    const modelConfig = await new Promise((resolve) => {
      const filePath = path.join(__dirname, 'data', 'model.json');
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        resolve(JSON.parse(data));
      } else {
        resolve(null);
      }
    });
    if (!modelConfig || !modelConfig.currentProvider) {
      return { success: false, error: '模型配置未找到' };
    }
    const provider = modelConfig.providers[modelConfig.currentProvider];
    if (!provider || !provider.enabled) {
      return { success: false, error: '未启用LLM提供商' };
    }
    return await invokeLLM(messages, provider, { temperature: 0.8, max_tokens: 800 });
  } catch (error) {
    console.error('AI对话异常:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('generate-story', async (event, prompt) => {
  try {
    const modelConfig = await new Promise((resolve) => {
      const filePath = path.join(__dirname, 'data', 'model.json');
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        resolve(JSON.parse(data));
      } else {
        resolve(null);
      }
    });
    if (!modelConfig || !modelConfig.currentProvider) {
      return { success: false, error: '模型配置未找到' };
    }
    const provider = modelConfig.providers[modelConfig.currentProvider];
    if (!provider || !provider.enabled) {
      return { success: false, error: '未启用LLM提供商' };
    }
    const messages = [{ role: 'user', content: prompt }];
    return await invokeLLM(messages, provider, { temperature: 0.7, max_tokens: 3000 });
  } catch (error) {
    console.error('故事生成异常:', error);
    return { success: false, error: error.message };
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  modelConnectionStatus = false;
});

