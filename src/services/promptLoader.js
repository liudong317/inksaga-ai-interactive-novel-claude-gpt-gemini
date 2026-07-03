const fs = require('fs');
const path = require('path');

class PromptLoader {
  constructor() {
    this.promptsDir = path.join(__dirname, '../prompts');
    this.prompts = {};
    this.loadAllPrompts();
  }

  loadAllPrompts() {
    const promptFiles = [
      'core-rules.json',
      'world-logic.json',
      'intent-recognition.json',
      'state-change.json',
      'chat-rules.json',
      'story-generation.json',
      'category-rules.json',
      'output-format.json',
      'gender-rules.json',
      'supplement-prompt.json'
    ];

    promptFiles.forEach(file => {
      try {
        const filePath = path.join(this.promptsDir, file);
        const data = fs.readFileSync(filePath, 'utf8');
        const promptData = JSON.parse(data);
        const key = file.replace('.json', '').replace(/-/g, '_');
        this.prompts[key] = promptData;
      } catch (error) {
        console.error(`加载提示词文件失败: ${file}`, error);
      }
    });
  }

  buildChatPrompt(stateChanges = []) {
    const coreRules = this.prompts.core_rules;
    const worldLogic = this.prompts.world_logic;
    const intentRecognition = this.prompts.intent_recognition;
    const stateChange = this.prompts.state_change;
    const chatRules = this.prompts.chat_rules;

    let prompt = `【核心原则】\n${coreRules.content.principle}\n\n`;

    prompt += `【记忆系统 - ${coreRules.content.memory_system.priority}】\n`;
    prompt += `${coreRules.content.memory_system.description}\n`;
    prompt += `每次回复前，先检查【当前游戏状态变化】，确保：\n`;
    coreRules.content.memory_system.checks.forEach((check, i) => {
      prompt += `${i + 1}. ${check}\n`;
    });

    prompt += `\n【世界逻辑规则 - 必须遵守】\n\n`;
    Object.keys(worldLogic.content).forEach(key => {
      const logic = worldLogic.content[key];
      prompt += `${logic.name}：\n`;
      logic.rules.forEach(rule => {
        prompt += `- ${rule}\n`;
      });
      prompt += `标记：${logic.tag}\n\n`;
    });

    prompt += `【玩家意图识别规则】\n`;
    prompt += `根据玩家的语气和用词，判断意图类型：\n\n`;
    Object.keys(intentRecognition.content).forEach(key => {
      const intent = intentRecognition.content[key];
      prompt += `${intent.name}（${intent.priority || ''}）\n`;
      prompt += `特征：${intent.characteristics}\n`;
      prompt += `识别：${intent.keywords.join('/')}\n`;
      prompt += `处理：${intent.handling}\n\n`;
    });

    prompt += `【状态变化标记规则】\n`;
    prompt += `当发生重要变化时，必须用【状态变化：XXX】标记：\n\n`;
    Object.keys(stateChange.content).forEach(key => {
      const change = stateChange.content[key];
      prompt += `${change.name}：\n`;
      if (Array.isArray(change.tag)) {
        change.tag.forEach(tag => prompt += `- ${tag}\n`);
      } else {
        prompt += `- ${change.tag}\n`;
      }
      if (change.examples) {
        prompt += `示例：${change.examples.join('、')}\n`;
      }
      prompt += `说明：${change.description}\n\n`;
    });

    prompt += `【思考流程 - 每次回复前必须执行】\n`;
    chatRules.content.thinking_process.steps.forEach(step => {
      prompt += `${step.step}. ${step.name}：\n`;
      if (step.checks) {
        step.checks.forEach(check => prompt += `   - ${check}\n`);
      }
      if (step.actions) {
        step.actions.forEach(action => prompt += `   - ${action}\n`);
      }
      prompt += `\n`;
    });

    prompt += `【回复格式】\n`;
    Object.keys(chatRules.content.response_format).forEach(key => {
      const format = chatRules.content.response_format[key];
      prompt += `${key.replace(/_/g, ' ')} → ${format}\n`;
    });

    prompt += `\n【回复原则】\n`;
    chatRules.content.response_principles.forEach(principle => {
      prompt += `- ${principle}\n`;
    });

    prompt += `\n【禁止行为】\n`;
    chatRules.content.forbidden_behaviors.forEach(behavior => {
      prompt += `✗ ${behavior}\n`;
    });

    return prompt;
  }

  getCategoryRule(category) {
    const categoryRules = this.prompts.category_rules;
    if (!categoryRules || !categoryRules.content) {
      return '';
    }
    return categoryRules.content[category] || categoryRules.content.default || '';
  }

  getGenderRule(gender) {
    const genderRules = this.prompts.gender_rules;
    if (!genderRules || !genderRules.content) {
      return '';
    }
    return genderRules.content[gender] || genderRules.content['男'] || '';
  }

  buildStoryGenerationPrompt(config) {
    const storyGen = this.prompts.story_generation;
    const outputFormat = this.prompts.output_format;
    const categoryRule = this.getCategoryRule(config.category);
    const leadGenderRule = this.getGenderRule(config.gender);

    let prompt = `你是专业的${config.category}小说编剧。现在要创作一部${config.category}类型的故事。\n\n`;

    prompt += `【核心信息】\n`;
    prompt += `- 主角姓名：${config.name}（这是唯一role为"玩家"的角色）\n`;
    prompt += `- 主角性别：${config.gender}\n`;
    prompt += `- 故事背景：${config.description}\n`;
    prompt += `- 需要角色总数：${config.playerCount}人（包含主角${config.name}）\n`;
    prompt += `- 需要事件总数：${config.eventCount}个\n\n`;

    if (categoryRule) {
      prompt += `【人物和地名规则】\n${categoryRule}\n\n`;
    }

    Object.keys(storyGen.content).forEach(key => {
      if (key === 'forbidden_behaviors') return;
      
      const section = storyGen.content[key];
      prompt += `【${section.name}】\n`;
      
      if (section.requirements) {
        section.requirements.forEach(req => {
          let requirement = req;
          requirement = requirement.replace(/\{playerName\}/g, config.name);
          requirement = requirement.replace(/\{playerCount\}/g, config.playerCount);
          requirement = requirement.replace(/\{eventCount\}/g, config.eventCount);
          requirement = requirement.replace(/\{gender\}/g, config.gender);
          requirement = requirement.replace(/\{leadGenderRule\}/g, leadGenderRule || '');
          prompt += `- ${requirement}\n`;
        });
      }
      
      prompt += `\n`;
    });

    prompt += `【禁止行为】\n`;
    storyGen.content.forbidden_behaviors.forEach(behavior => {
      let forbiddenBehavior = behavior;
      forbiddenBehavior = forbiddenBehavior.replace(/\{playerName\}/g, config.name);
      prompt += `✗ ${forbiddenBehavior}\n`;
    });

    prompt += `\n【${outputFormat.content.title}】\n`;
    prompt += `你必须直接输出一个标准的JSON对象，格式如下：\n`;
    prompt += `${outputFormat.content.format}\n\n`;
    
    prompt += `禁止事项：\n`;
    outputFormat.content.forbidden.forEach(item => {
      prompt += `❌ ${item}\n`;
    });
    
    prompt += `\n必须事项：\n`;
    outputFormat.content.required.forEach(item => {
      prompt += `✓ ${item}\n`;
    });

    prompt += `\n现在立即开始生成，直接输出JSON对象（${config.playerCount}个角色+${config.eventCount}个事件）：`;

    return prompt;
  }

  buildSupplementPrompt(config, storyData, missingCharacters, missingEvents, eventCount) {
    const supplement = this.prompts.supplement_prompt;
    const categoryRule = this.getCategoryRule(config.category);
    
    let prompt = supplement.content.intro.replace('{category}', config.category) + '\n\n';
    
    const existingSection = supplement.content.sections.existing_content;
    prompt += `【${existingSection.name}】\n`;
    prompt += existingSection.fields[0].replace('{outline}', storyData.outline.substring(0, 200) + '...') + '\n';
    const characterNames = storyData.characters.map(c => c.name || '未命名').filter(name => name !== '未命名').join('、');
    prompt += existingSection.fields[1].replace('{characters}', characterNames || '无') + '\n';
    prompt += existingSection.fields[2].replace('{eventCount}', eventCount) + '\n\n';
    
    const supplementSection = supplement.content.sections.supplement_needed;
    prompt += `【${supplementSection.name}】\n`;
    if (missingCharacters > 0) {
      prompt += `- ${supplementSection.character_template
        .replace('{missingCharacters}', missingCharacters)
        .replace('{totalCharacters}', config.playerCount)}\n`;
    }
    if (missingEvents > 0) {
      prompt += `- ${supplementSection.event_template
        .replace('{missingEvents}', missingEvents)
        .replace('{totalEvents}', config.eventCount)}\n`;
    }
    prompt += '\n';
    
    if (categoryRule) {
      prompt += `【人物和地名规则】\n${categoryRule}\n\n`;
    }
    
    const reqSection = supplement.content.sections.requirements;
    prompt += `【${reqSection.name}】\n`;
    reqSection.rules.forEach((rule, i) => {
      prompt += `${i + 1}. ${rule}\n`;
    });
    prompt += '\n';
    
    const formatSection = supplement.content.sections.output_format;
    prompt += `${formatSection.name}：\n`;
    prompt += formatSection.template;
    
    return prompt;
  }

  buildSimpleSystemPrompt(playerInfo, charactersInfo, category, outline) {
    return `你是多角色扮演AI。

【角色信息】
${charactersInfo}

【故事背景】
${category} - ${outline}

【玩家信息】
${playerInfo.name}（${playerInfo.gender}）`;
  }
}

module.exports = new PromptLoader();

