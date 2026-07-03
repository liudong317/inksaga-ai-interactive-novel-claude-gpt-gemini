const { ipcRenderer } = require('electron');
const { cleanOllamaJSON } = require('./llm/ollamaHandler');
const { cleanOpenAIJSON } = require('./llm/openaiHandler');
const promptLoader = require('./promptLoader');

const storyGenerator = (function() {
  async function generateStory(config, onProgress, retryCount = 0) {
    try {
      const prompt = promptLoader.buildStoryGenerationPrompt(config);

      if (onProgress) {
        onProgress('正在传递故事信息...需要有耐心，不然玩不了~~~');
      }

      const result = await ipcRenderer.invoke('generate-story', prompt);

      if (!result.success) {
        const modelConfig = await ipcRenderer.invoke('load-json', 'model.json');
        if (modelConfig && modelConfig.connectionStatus) {
          modelConfig.connectionStatus.connected = false;
          await ipcRenderer.invoke('save-json', 'model.json', modelConfig);
          await ipcRenderer.invoke('set-model-status', false);
        }
        throw new Error(result.error || '生成失败');
      }

      if (onProgress) {
        onProgress('正在解析返回数据...');
      }

      let storyData;
      try {
        const modelConfig = await ipcRenderer.invoke('load-json', 'model.json');
        const currentProvider = modelConfig.providers[modelConfig.currentProvider];
        const providerType = currentProvider ? currentProvider.type : 'openai';
        
        let jsonStr = result.content.trim();
        
        if (providerType === 'ollama') {
          jsonStr = cleanOllamaJSON(jsonStr);
        } else {
          jsonStr = cleanOpenAIJSON(jsonStr);
        }
        
        storyData = JSON.parse(jsonStr);
        
        if (!storyData.outline || !storyData.characters || !storyData.events) {
          throw new Error('JSON结构不完整');
        }
      } catch (parseError) {
        const errorPos = parseInt(parseError.message.match(/position (\d+)/)?.[1] || '0');
        
        const debugInfo = {
          message: parseError.message,
          position: errorPos,
          contentLength: result.content ? result.content.length : 0
        };
        
        if (result.content) {
          const start = Math.max(0, errorPos - 150);
          const end = Math.min(result.content.length, errorPos + 150);
          debugInfo.before = result.content.substring(start, errorPos);
          debugInfo.errorChar = result.content.charAt(errorPos);
          debugInfo.errorCharCode = result.content.charCodeAt(errorPos);
          debugInfo.after = result.content.substring(errorPos + 1, end);
          debugInfo.fullContent = result.content.substring(0, 1000);
        }
        
        await ipcRenderer.invoke('log-to-main', {
          level: 'error',
          tag: 'JSON解析失败',
          data: debugInfo
        });
        
        throw new Error(`模型返回数据格式错误: ${parseError.message}`);
      }

      const characterCount = storyData.characters.length;
      const eventCount = storyData.events.length;
      const expectedCharacters = config.playerCount;
      const expectedEvents = config.eventCount;

      if (characterCount < expectedCharacters || eventCount < expectedEvents) {
        if (onProgress) {
          onProgress(`数据不完整，正在补充生成...（角色${characterCount}/${expectedCharacters}，事件${eventCount}/${expectedEvents}）`);
        }
        
        const missingCharacters = expectedCharacters - characterCount;
        const missingEvents = expectedEvents - eventCount;
        
        if (missingCharacters > 0 || missingEvents > 0) {
          const supplementPrompt = promptLoader.buildSupplementPrompt(config, storyData, missingCharacters, missingEvents, eventCount);

          const supplementResult = await ipcRenderer.invoke('generate-story', supplementPrompt);
          
          if (supplementResult.success) {
            try {
              let supplementStr = supplementResult.content.trim();
              supplementStr = supplementStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
              supplementStr = supplementStr.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
              const supplementMatch = supplementStr.match(/\{[\s\S]*\}/);
              if (supplementMatch) {
                supplementStr = supplementMatch[0];
              }
              supplementStr = supplementStr.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
              
              supplementStr = supplementStr.replace(/:\s*"([^"]*),\s*"/g, ': "$1"');
              
              supplementStr = supplementStr.replace(/,(\s*[}\]])/g, '$1');
              const supplementData = JSON.parse(supplementStr);
              
              if (supplementData.characters && Array.isArray(supplementData.characters)) {
                storyData.characters.push(...supplementData.characters);
              }
              if (supplementData.events && Array.isArray(supplementData.events)) {
                storyData.events.push(...supplementData.events);
              }
              
              if (onProgress) {
                onProgress(`补充完成！角色${storyData.characters.length}个，事件${storyData.events.length}个`);
              }
            } catch (supplementError) {
              console.error('补充数据解析失败:', supplementError);
            }
          }
        }
      }

      if (onProgress) {
        onProgress('正在保存剧情配置...');
      }

      const roleMapping = {
        '玩家': 'player',
        '男主': 'male_lead',
        '女主': 'female_lead',
        '配角': 'supporting'
      };

      let hasPlayer = false;
      const normalizedCharacters = storyData.characters.map((char, index) => {
        let cleanName = char.name || '';
        cleanName = cleanName.replace(/^(女主|男主|配角|玩家)[：:]\s*/g, '');
        
        let cleanPosition = char.position || '';
        cleanPosition = cleanPosition.replace(/[a-zA-Z]+/g, '').replace(/\s+/g, '');
        
        let cleanPersonality = char.personality || '';
        cleanPersonality = cleanPersonality.replace(/，\s*$/g, '').replace(/,\s*$/g, '');
        
        let cleanTone = char.tone || '';
        cleanTone = cleanTone.replace(/，\s*$/g, '').replace(/,\s*$/g, '');
        cleanTone = cleanTone.replace(/[a-zA-Z]+/g, '').replace(/\s+/g, '');
        
        let finalRole = roleMapping[char.role] || char.role || 'supporting';
        
        if (index === 0 || cleanName === config.name || cleanName.includes(config.name)) {
          finalRole = 'player';
          hasPlayer = true;
        } else if (finalRole === 'player' || finalRole === '玩家') {
          finalRole = 'supporting';
          console.log(`强制修正：${cleanName}的role从"玩家"改为"配角"`);
        }
        
        return {
          ...char,
          name: cleanName,
          position: cleanPosition,
          personality: cleanPersonality,
          tone: cleanTone,
          role: finalRole
        };
      });
      
      if (!hasPlayer && normalizedCharacters.length > 0) {
        normalizedCharacters[0].role = 'player';
      }

      const scenarioData = {
        outline: storyData.outline || '',
        characters: normalizedCharacters
      };
      await ipcRenderer.invoke('save-json', 'scenario.json', scenarioData);

      if (onProgress) {
        onProgress('正在保存事件配置...');
      }

      const eventsData = {
        events: storyData.events || []
      };
      await ipcRenderer.invoke('save-json', 'events.json', eventsData);

      if (onProgress) {
        onProgress('生成完成！');
      }

      return {
        success: true,
        data: storyData
      };
    } catch (error) {
      console.error('故事生成失败:', error);
      if (onProgress) {
        onProgress('生成失败: ' + error.message);
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  return { generateStory };
})();

module.exports = storyGenerator;
