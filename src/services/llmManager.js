const { ipcRenderer } = require('electron');

class LLMManager {
  constructor() {
    this.config = null;
  }

  async loadConfig() {
    this.config = await ipcRenderer.invoke('load-json', 'model.json');
    return this.config;
  }

  async saveConfig() {
    const result = await ipcRenderer.invoke('save-json', 'model.json', this.config);
    return result.success;
  }

  getCurrentProvider() {
    if (!this.config) return null;
    const providerKey = this.config.currentProvider;
    return this.config.providers[providerKey];
  }

  async getOllamaModels(customBaseUrl = null) {
    try {
      const ollamaConfig = this.config.providers.ollama;
      const baseUrl = customBaseUrl || (ollamaConfig ? ollamaConfig.baseUrl : null) || 'http://localhost:11434';
      const result = await ipcRenderer.invoke('get-ollama-models', baseUrl);
      if (result.success) {
        return result.models;
      }
      throw new Error(result.error || '获取模型列表失败');
    } catch (error) {
      throw new Error(`获取Ollama模型列表失败: ${error.message}`);
    }
  }

  async callLLM(messages, options = {}) {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('未配置LLM提供商');
    }
    if (!provider.enabled) {
      throw new Error('当前LLM提供商未启用');
    }
    const result = await ipcRenderer.invoke('call-llm', { messages, provider, options });
    if (result.success) {
      return result.content;
    }
    throw new Error(result.error || 'LLM调用失败');
  }

  setCurrentProvider(providerKey) {
    if (this.config.providers[providerKey]) {
      this.config.currentProvider = providerKey;
      this.saveConfig();
      return true;
    }
    return false;
  }

  disableAllProviders() {
    if (!this.config || !this.config.providers) return false;
    Object.keys(this.config.providers).forEach(key => {
      this.config.providers[key].enabled = false;
    });
    this.saveConfig();
    return true;
  }

  updateProviderConfig(providerKey, updates) {
    if (this.config.providers[providerKey]) {
      Object.assign(this.config.providers[providerKey], updates);
      this.saveConfig();
      return true;
    }
    return false;
  }

  getProvidersList() {
    if (!this.config) return [];
    return Object.entries(this.config.providers).map(([key, value]) => ({
      key: key,
      name: value.name,
      type: value.type,
      enabled: value.enabled,
      model: value.model
    }));
  }
}

module.exports = LLMManager;

