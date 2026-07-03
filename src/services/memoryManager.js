const { ipcRenderer } = require('electron');

class MemoryManager {
  constructor() {
    this.memories = [];
    this.currentGameKey = null;
    this.maxMemories = 50;
  }

  async initialize(gameKey) {
    this.currentGameKey = gameKey;
    await this.loadMemories();
  }

  async loadMemories() {
    if (!this.currentGameKey) {
      return;
    }

    try {
      const filename = `chat-history/memory_${this.currentGameKey}.json`;
      const result = await ipcRenderer.invoke('load-json', filename);
      
      if (result && result.memories && Array.isArray(result.memories)) {
        this.memories = result.memories;
        console.log(`已加载 ${this.memories.length} 条游戏记忆`);
      } else {
        this.memories = [];
      }
    } catch (error) {
      this.memories = [];
    }
  }

  async saveMemories() {
    if (!this.currentGameKey) {
      return;
    }

    try {
      const filename = `chat-history/memory_${this.currentGameKey}.json`;
      const data = {
        gameKey: this.currentGameKey,
        memories: this.memories,
        lastUpdate: Date.now()
      };
      
      await ipcRenderer.invoke('save-json', filename, data);
    } catch (error) {
      console.error('保存记忆失败:', error);
    }
  }

  async addMemory(memory) {
    if (!memory || typeof memory !== 'string') {
      return;
    }

    const trimmedMemory = memory.trim();
    if (!trimmedMemory || trimmedMemory.length < 2) {
      return;
    }

    this.resolveConflicts(trimmedMemory);

    if (this.memories.includes(trimmedMemory)) {
      return;
    }

    this.memories.push(trimmedMemory);
    console.log('新增记忆:', trimmedMemory);

    if (this.memories.length > this.maxMemories) {
      this.memories = this.memories.slice(-this.maxMemories);
    }

    await this.saveMemories();
  }

  async addMemories(memoriesArray) {
    if (!Array.isArray(memoriesArray)) {
      return;
    }

    for (const memory of memoriesArray) {
      await this.addMemory(memory);
    }
  }

  resolveConflicts(newMemory) {
    const memoryLower = newMemory.toLowerCase();

    if (memoryLower.includes('已死亡') || memoryLower.includes('死了')) {
      const characterMatch = newMemory.match(/(\S+?)(?:已死亡|死了)/);
      if (characterMatch && characterMatch[1]) {
        const characterName = characterMatch[1].trim();
        this.memories = this.memories.filter(m => 
          !m.includes(characterName) || m.includes('已死亡') || m.includes('死了')
        );
      }
    }

    if (memoryLower.includes('玩家') && memoryLower.includes('身份')) {
      this.memories = this.memories.filter(m => 
        !(m.includes('玩家') && m.includes('身份') && m !== newMemory)
      );
    }

    if (memoryLower.includes('当前位置')) {
      this.memories = this.memories.filter(m => !m.includes('当前位置'));
    }

    if (memoryLower.includes('持有') || memoryLower.includes('获得')) {
      const itemMatch = newMemory.match(/(?:持有|获得)(\S+)/);
      if (itemMatch && itemMatch[1]) {
        const itemName = itemMatch[1].trim();
        this.memories = this.memories.filter(m => 
          !(m.includes('失去') && m.includes(itemName))
        );
      }
    }
    
    if (memoryLower.includes('失去') || memoryLower.includes('丢失')) {
      const itemMatch = newMemory.match(/(?:失去|丢失)(\S+)/);
      if (itemMatch && itemMatch[1]) {
        const itemName = itemMatch[1].trim();
        this.memories = this.memories.filter(m => 
          !(m.includes('持有') && m.includes(itemName))
        );
      }
    }
  }

  getMemories() {
    return [...this.memories];
  }

  getRecentMemories(count = 30) {
    return this.memories.slice(-count);
  }

  async clearMemories() {
    this.memories = [];
    await this.saveMemories();
  }
}

module.exports = new MemoryManager();
