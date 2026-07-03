const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const LLMManager = require('../../services/llmManager');
const modalComponent = require('../../components/modal');

const modelModule = (function() {
  const llmManager = new LLMManager();
  let currentProviderKey = '';

  async function loadProviders() {
    await llmManager.loadConfig();
    const providers = llmManager.getProvidersList();
    const providerSelect = document.getElementById('llm-provider');
    providerSelect.innerHTML = '<option value="">选择LLM提供商...</option>';
    providers.forEach(provider => {
      const option = document.createElement('option');
      option.value = provider.key;
      option.textContent = `${provider.name} ${provider.enabled ? '✓' : ''}`;
      providerSelect.appendChild(option);
    });
    if (llmManager.config && llmManager.config.currentProvider) {
      providerSelect.value = llmManager.config.currentProvider;
      loadProviderConfig(llmManager.config.currentProvider);
    }
    updateConnectionStatus();
  }
  
  function updateConnectionStatus() {
    const testBtn = document.getElementById('btn-test-llm');
    if (!testBtn) return;
    
    const connectionStatus = llmManager.config?.connectionStatus;
    if (connectionStatus && connectionStatus.connected && connectionStatus.provider === currentProviderKey) {
      testBtn.textContent = '点击断开';
      testBtn.style.background = '#4caf50';
    } else {
      testBtn.textContent = '开始连接';
      testBtn.style.background = '';
    }
  }

  function isQinghongProvider() {
    const provider = llmManager.config?.providers?.[currentProviderKey];
    return provider && provider.baseUrl && provider.baseUrl.includes('qinghong.tech');
  }

  function showModelError(message, options = {}) {
    if (isQinghongProvider() || options.forceGuide) {
      modalComponent.showApiGuide(message, {
        showRegister: options.showRegister !== false,
        showModelNav: options.showModelNav || false
      });
    } else {
      modalComponent.showError(message);
    }
  }

  async function loadProviderConfig(providerKey) {
    currentProviderKey = providerKey;
    const provider = llmManager.config.providers[providerKey];
    const configForm = document.getElementById('llm-config-form');
    if (!provider) {
      configForm.innerHTML = '';
      return;
    }
    llmManager.setCurrentProvider(providerKey);
    let formHTML = `
      <div class="form-group">
        <label class="form-label">
          <input type="checkbox" id="provider-enabled" ${provider.enabled ? 'checked' : ''}> 启用此提供商
        </label>
        <p style="color: #ff9800; font-size: 13px; margin-top: 5px;">⚠️ 启用此提供商将自动禁用其他所有提供商（同时只能启用一个）</p>
      </div>
    `;
    if (provider.type === 'deepseek') {
      formHTML += `
        <div class="form-group">
          <label class="form-label">API Key <span style="color: red;">*</span></label>
          <input type="password" class="form-input" id="provider-apikey" value="${provider.apiKey || ''}" placeholder="输入DeepSeek API Key" required>
        </div>
        <div class="form-group">
          <label class="form-label">Base URL</label>
          <input type="text" class="form-input" id="provider-baseurl" value="${provider.baseUrl || 'https://api.deepseek.com'}" placeholder="API基础URL" readonly style="background: #f5f5f5;">
          <p style="color: #666; font-size: 12px; margin-top: 5px;">💡 DeepSeek官方API地址，无需修改</p>
        </div>
        <div class="form-group">
          <label class="form-label">模型选择 <span style="color: red;">*</span></label>
          <select class="form-select" id="provider-model">
            <option value="deepseek-chat" ${provider.model === 'deepseek-chat' ? 'selected' : ''}>deepseek-chat（非思考模式）</option>
            <option value="deepseek-reasoner" ${provider.model === 'deepseek-reasoner' ? 'selected' : ''}>deepseek-reasoner（思考模式）</option>
          </select>
          <p style="color: #666; font-size: 12px; margin-top: 5px;">💡 思考模式会输出推理过程，适合复杂任务</p>
        </div>
      `;
    } else if (provider.type === 'suanli') {
      formHTML += `
        <div class="form-group">
          <label class="form-label">API Key <span style="color: red;">*</span></label>
          <input type="password" class="form-input" id="provider-apikey" value="${provider.apiKey || ''}" placeholder="输入算力云API Key" required>
        </div>
        <div class="form-group">
          <label class="form-label">Base URL</label>
          <input type="text" class="form-input" id="provider-baseurl" value="${provider.baseUrl || 'https://api.suanli.cn/v1'}" placeholder="API基础URL">
        </div>
        <div class="form-group">
          <label class="form-label">模型名称 <span style="color: red;">*</span></label>
          <input type="text" class="form-input" id="provider-model" value="${provider.model || ''}" placeholder="模型名称（必填）" required>
        </div>
      `;
    } else if (provider.type === 'openai') {
      const isQinghong = provider.baseUrl && provider.baseUrl.includes('qinghong.tech');
      const baseUrlReadonly = isQinghong ? 'readonly style="background: #f5f5f5;"' : '';
      const baseUrlHint = isQinghong
        ? '<p style="color: #666; font-size: 12px; margin-top: 5px;">💡 晴红API 官方接口地址，无需修改</p>'
        : '<p style="color: #666; font-size: 12px; margin-top: 5px;">💡 填写 OpenAI 兼容接口地址，如 https://your-api.com/v1</p>';
      const apiKeyHint = isQinghong
        ? `<p style="color: #666; font-size: 12px; margin-top: 5px;">💡 在 <a href="https://www.qinghong.tech/sign-up" target="_blank" style="color:#667eea;">晴红API 控制台</a> 获取 API Key · <a href="https://qinghongkeji.apifox.cn" target="_blank" style="color:#667eea;">文档</a> · <a href="https://www.qinghong.tech/pricing" target="_blank" style="color:#667eea;">模型与定价</a></p>`
        : '<p style="color: #666; font-size: 12px; margin-top: 5px;">💡 OpenAI 兼容服务需要 API Key，本地无认证服务可留空</p>';
      formHTML += `
        <div class="form-group">
          <label class="form-label">API Key <span style="color: red;">*</span></label>
          <input type="password" class="form-input" id="provider-apikey" value="${provider.apiKey || ''}" placeholder="输入 API Key" required>
          ${apiKeyHint}
        </div>
        <div class="form-group">
          <label class="form-label">Base URL <span style="color: red;">*</span></label>
          <input type="text" class="form-input" id="provider-baseurl" value="${provider.baseUrl || ''}" placeholder="API基础URL（必填）" required ${baseUrlReadonly}>
          ${baseUrlHint}
        </div>
        <div class="form-group">
          <label class="form-label">模型选择 <span style="color: red;">*</span></label>
      `;
      if (provider.models && provider.models.length > 0) {
        formHTML += `<select class="form-select" id="provider-model">`;
        provider.models.forEach(modelName => {
          formHTML += `<option value="${modelName}" ${provider.model === modelName ? 'selected' : ''}>${modelName}</option>`;
        });
        formHTML += `</select>`;
      } else {
        formHTML += `<input type="text" class="form-input" id="provider-model" value="${provider.model || ''}" placeholder="模型名称（必填）" required>`;
      }
      formHTML += `
          <p style="color: #666; font-size: 12px; margin-top: 5px;">💡 不同模型在创意写作与推理能力上各有侧重，可按需切换</p>
        </div>
      `;
    } else if (provider.type === 'ollama') {
      formHTML += `
        <div class="form-group">
          <label class="form-label">Base URL</label>
          <input type="text" class="form-input" id="provider-baseurl" value="${provider.baseUrl || 'http://localhost:11434'}" placeholder="Ollama服务地址">
        </div>
        <div class="form-group">
          <label class="form-label">模型名称</label>
          <select class="form-select" id="provider-model">
            <option value="">选择模型...</option>
          </select>
          <button type="button" class="btn btn-secondary" id="btn-refresh-models" style="margin-top: 10px;">🔄 刷新模型列表</button>
          <p style="color: #666; font-size: 12px; margin-top: 5px;">💡 点击刷新按钮获取Ollama中已下载的模型列表</p>
        </div>
      `;
    }
    formHTML += `
      <div class="form-group">
        <label class="form-label">Temperature (0-1)</label>
        <input type="number" class="form-input" id="provider-temperature" value="${provider.temperature || 0.7}" min="0" max="1" step="0.1">
      </div>
    `;
    configForm.innerHTML = formHTML;
    const enabledCheckbox = document.getElementById('provider-enabled');
    if (enabledCheckbox) {
      enabledCheckbox.addEventListener('change', async (e) => {
        if (e.target.checked) {
          const providers = llmManager.getProvidersList();
          const otherEnabled = providers.filter(p => p.key !== currentProviderKey && p.enabled);
          if (otherEnabled.length > 0) {
            const otherNames = otherEnabled.map(p => p.name).join('、');
            modalComponent.showConfirm(
              `启用 ${provider.name} 将自动禁用以下提供商：\n\n${otherNames}\n\n是否继续？`,
              () => {},
              () => {
                e.target.checked = false;
              }
            );
          }
        }
      });
    }
    if (provider.type === 'ollama') {
      const modelSelect = document.getElementById('provider-model');
      if (provider.model) {
        const option = document.createElement('option');
        option.value = provider.model;
        option.textContent = provider.model;
        modelSelect.appendChild(option);
        modelSelect.value = provider.model;
      }
      const refreshBtn = document.getElementById('btn-refresh-models');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshOllamaModels);
      }
    }
  }

  async function refreshOllamaModels() {
    try {
      const modelSelect = document.getElementById('provider-model');
      const baseUrlInput = document.getElementById('provider-baseurl');
      const currentBaseUrl = baseUrlInput ? baseUrlInput.value.trim() : null;
      if (!currentBaseUrl) {
        modalComponent.showError('请先输入Ollama服务地址');
        return;
      }
      
      const currentSelectedModel = modelSelect.value;
      
      modelSelect.innerHTML = '<option value="">正在加载...</option>';
      const models = await llmManager.getOllamaModels(currentBaseUrl);
      modelSelect.innerHTML = '<option value="">选择模型...</option>';
      
      if (models.length === 0) {
        modelSelect.innerHTML = '<option value="">未找到模型</option>';
        modalComponent.showError('Ollama服务中没有可用模型，请先使用 ollama pull 下载模型');
        return;
      }
      
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        modelSelect.appendChild(option);
      });
      
      if (currentSelectedModel && models.includes(currentSelectedModel)) {
        modelSelect.value = currentSelectedModel;
      } else {
        const savedModel = llmManager.config.providers.ollama.model;
        if (savedModel && models.includes(savedModel)) {
          modelSelect.value = savedModel;
        } else if (models.length > 0) {
          modelSelect.value = models[0];
        }
      }
      
      showMessage(`成功获取 ${models.length} 个模型`, 'success');
    } catch (error) {
      modalComponent.showError(`获取模型列表失败: ${error.message}`);
      const modelSelect = document.getElementById('provider-model');
      modelSelect.innerHTML = '<option value="">获取失败</option>';
    }
  }

  async function performSave(updates, isEnabled) {
    try {
      if (isEnabled) {
        llmManager.disableAllProviders();
      }
      llmManager.updateProviderConfig(currentProviderKey, updates);
      if (isEnabled) {
        llmManager.setCurrentProvider(currentProviderKey);
        await ipcRenderer.invoke('set-model-status', true);
      }
      showMessage('配置保存成功', 'success');
      loadProviders();
    } catch (error) {
      modalComponent.showError(`保存失败: ${error.message}`);
    }
  }

  async function saveLLMConfig() {
    if (!currentProviderKey) {
      modalComponent.showError('请选择LLM提供商');
      return;
    }
    try {
      const isEnabled = document.getElementById('provider-enabled').checked;
      const provider = llmManager.config.providers[currentProviderKey];
      const updates = {
        enabled: isEnabled,
        temperature: parseFloat(document.getElementById('provider-temperature').value) || 0.7
      };
      const apikeyInput = document.getElementById('provider-apikey');
      const baseurlInput = document.getElementById('provider-baseurl');
      const modelInput = document.getElementById('provider-model');
      if (provider.type === 'deepseek') {
        if (apikeyInput) {
          const apiKey = apikeyInput.value.trim();
          if (isEnabled && !apiKey) {
            modalComponent.showError('DeepSeek API Key为必填项');
            return;
          }
          updates.apiKey = apiKey;
        }
        if (baseurlInput) {
          updates.baseUrl = baseurlInput.value.trim() || 'https://api.deepseek.com';
        }
        if (modelInput) {
          const model = modelInput.tagName === 'SELECT' ? modelInput.value : modelInput.value.trim();
          if (isEnabled && !model) {
            modalComponent.showError('请选择模型');
            return;
          }
          updates.model = model;
        }
      } else if (provider.type === 'suanli') {
        if (apikeyInput) {
          const apiKey = apikeyInput.value.trim();
          if (isEnabled && !apiKey) {
            modalComponent.showError('算力云API Key为必填项');
            return;
          }
          updates.apiKey = apiKey;
        }
        if (baseurlInput) {
          const baseUrl = baseurlInput.value.trim();
          if (isEnabled && !baseUrl) {
            modalComponent.showError('Base URL为必填项');
            return;
          }
          updates.baseUrl = baseUrl;
        }
        if (modelInput) {
          const model = modelInput.value.trim();
          if (isEnabled && !model) {
            modalComponent.showError('模型名称为必填项');
            return;
          }
          updates.model = model;
        }
      } else if (provider.type === 'openai') {
        if (baseurlInput) {
          const baseUrl = baseurlInput.value.trim();
          if (isEnabled && !baseUrl) {
            modalComponent.showError('启用提供商时，Base URL 为必填项');
            return;
          }
          updates.baseUrl = baseUrl;
        }
        if (modelInput) {
          const model = modelInput.tagName === 'SELECT' ? modelInput.value : modelInput.value.trim();
          if (isEnabled && !model) {
            modalComponent.showError('启用提供商时，模型名称 为必填项');
            return;
          }
          updates.model = model;
        }
        if (apikeyInput) {
          const apiKey = apikeyInput.value.trim();
          if (isEnabled && !apiKey) {
            showModelError('API Key 为必填项。\n\n请前往晴红API 注册获取，注册后在上方填入 Key 并点击「开始连接」。');
            return;
          }
          updates.apiKey = apiKey;
        }
      } else if (provider.type === 'ollama') {
        if (baseurlInput) {
          const baseUrl = baseurlInput.value.trim();
          if (isEnabled && !baseUrl) {
            modalComponent.showError('启用提供商时，Base URL 为必填项');
            return;
          }
          updates.baseUrl = baseUrl;
        }
        if (modelInput) {
          const model = modelInput.value || modelInput.value.trim();
          if (isEnabled && !model) {
            modalComponent.showError('启用提供商时，必须选择一个模型');
            return;
          }
          updates.model = model;
        }
      }
      await performSave(updates, isEnabled);
    } catch (error) {
      modalComponent.showError(`保存失败: ${error.message}`);
    }
  }

  async function testLLMConnection() {
    if (!currentProviderKey) {
      modalComponent.showError('请选择LLM提供商');
      return;
    }
    const testBtn = document.getElementById('btn-test-llm');
    const originalText = testBtn.textContent;
    
    const connectionStatus = llmManager.config?.connectionStatus;
    if (connectionStatus && connectionStatus.connected && connectionStatus.provider === currentProviderKey) {
      llmManager.config.connectionStatus = {
        connected: false,
        lastTestTime: null,
        provider: null
      };
      await llmManager.saveConfig();
      await ipcRenderer.invoke('set-model-status', false);
      testBtn.textContent = '开始连接';
      testBtn.style.background = '';
      showMessage('已断开连接', 'success');
      return;
    }
    
    try {
      const provider = llmManager.config.providers[currentProviderKey];
      if (!provider) {
        modalComponent.showError('提供商配置不存在');
        return;
      }
      const testConfig = {
        type: provider.type,
        name: provider.name,
        enabled: true,
        temperature: parseFloat(document.getElementById('provider-temperature').value) || 0.7
      };
      const apikeyInput = document.getElementById('provider-apikey');
      const baseurlInput = document.getElementById('provider-baseurl');
      const modelInput = document.getElementById('provider-model');
      if (apikeyInput) testConfig.apiKey = apikeyInput.value.trim();
      if (baseurlInput) testConfig.baseUrl = baseurlInput.value.trim();
      if (modelInput) testConfig.model = modelInput.tagName === 'SELECT' ? modelInput.value : modelInput.value.trim();
      if (testConfig.type === 'openai') {
        if (!testConfig.baseUrl) {
          showModelError('请先填写 Base URL');
          return;
        }
        if (!testConfig.model) {
          showModelError('请先选择模型');
          return;
        }
        if (!testConfig.apiKey) {
          showModelError('请先填写 API Key。\n\n没有 Key？点击「注册晴红API」即可快速获取。', { showModelNav: false });
          return;
        }
      } else if (testConfig.type === 'ollama') {
        if (!testConfig.baseUrl) {
          modalComponent.showError('请先填写 Base URL');
          return;
        }
        if (!testConfig.model) {
          modalComponent.showError('请先选择模型');
          return;
        }
      }
      testBtn.disabled = true;
      testBtn.textContent = '连接中...';
      testBtn.style.opacity = '0.6';
      testBtn.style.cursor = 'not-allowed';
      const testMessages = [{ role: 'user', content: '你好，请回复"测试成功"' }];
      showMessage('正在连接LLM服务，请稍候...', 'success');
      const result = await ipcRenderer.invoke('test-llm-connection', { messages: testMessages, provider: testConfig });
      if (result.success) {
        await ipcRenderer.invoke('set-model-status', true);
        testBtn.textContent = '点击断开';
        testBtn.style.opacity = '1';
        testBtn.style.cursor = 'pointer';
        testBtn.style.background = '#4caf50';
        testBtn.disabled = false;
        const displayResponse = result.content.length > 200 ? result.content.substring(0, 200) + '...' : result.content;
        showMessage(`测试成功！响应: ${displayResponse}`, 'success');
        
        const updates = {
          enabled: true,
          temperature: testConfig.temperature
        };
        if (testConfig.apiKey !== undefined) updates.apiKey = testConfig.apiKey;
        if (testConfig.baseUrl) updates.baseUrl = testConfig.baseUrl;
        if (testConfig.model) updates.model = testConfig.model;
        llmManager.disableAllProviders();
        llmManager.updateProviderConfig(currentProviderKey, updates);
        llmManager.setCurrentProvider(currentProviderKey);
        
        llmManager.config.connectionStatus = {
          connected: true,
          lastTestTime: new Date().toISOString(),
          provider: currentProviderKey
        };
        await llmManager.saveConfig();
        
        document.getElementById('provider-enabled').checked = true;
        loadProviders();
      } else {
        await ipcRenderer.invoke('set-model-status', false);
        testBtn.textContent = originalText;
        testBtn.style.opacity = '1';
        testBtn.style.cursor = 'pointer';
        testBtn.style.background = '';
        testBtn.disabled = false;
        
        llmManager.config.connectionStatus = {
          connected: false,
          lastTestTime: new Date().toISOString(),
          provider: currentProviderKey
        };
        await llmManager.saveConfig();
        
        showModelError(`连接失败：${result.error}\n\n请检查 API Key 是否正确，或前往晴红API 重新获取。`, { showModelNav: false });
      }
    } catch (error) {
      await ipcRenderer.invoke('set-model-status', false);
      testBtn.textContent = originalText;
      testBtn.style.opacity = '1';
      testBtn.style.cursor = 'pointer';
      testBtn.style.background = '';
      testBtn.disabled = false;
      
      llmManager.config.connectionStatus = {
        connected: false,
        lastTestTime: new Date().toISOString(),
        provider: currentProviderKey
      };
      await llmManager.saveConfig();
      
      showModelError(`连接失败：${error.message}\n\n请检查网络连接和 API Key 是否有效。`, { showModelNav: false });
    }
  }

  function showMessage(msg, type) {
    const existingMsg = document.querySelector('.message-toast');
    if (existingMsg) existingMsg.remove();
    const toast = document.createElement('div');
    toast.className = 'message-toast';
    toast.textContent = msg;
    toast.style.cssText = `position: fixed; top: 60px; right: 20px; padding: 12px 24px; color: #fff; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 9999; background: ${type === 'success' ? '#38ef7d' : '#f45c43'};`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function render(container) {
    const htmlPath = path.join(__dirname, 'model.html');
    const cssPath = path.join(__dirname, 'model.css');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    const style = document.createElement('style');
    style.textContent = cssContent;
    document.head.appendChild(style);
    container.innerHTML = htmlContent;
    loadProviders();
    document.getElementById('llm-provider').addEventListener('change', (e) => {
      loadProviderConfig(e.target.value);
    });
    document.getElementById('btn-save-llm').addEventListener('click', saveLLMConfig);
    document.getElementById('btn-test-llm').addEventListener('click', testLLMConnection);
  }

  return { render };
})();

module.exports = modelModule;
