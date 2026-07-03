function estimateTokenCount(text) {
  if (!text) return 0;
  
  let chineseChars = 0;
  let englishChars = 0;
  let otherChars = 0;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);
    
    if (code >= 0x4E00 && code <= 0x9FFF) {
      chineseChars++;
    } else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      englishChars++;
    } else {
      otherChars++;
    }
  }
  
  const chineseTokens = chineseChars * 1.5;
  const englishTokens = englishChars / 4;
  const otherTokens = otherChars / 2;
  
  return Math.ceil(chineseTokens + englishTokens + otherTokens);
}

function estimateMessagesTokenCount(messages) {
  if (!Array.isArray(messages)) return 0;
  
  let totalTokens = 0;
  
  for (const message of messages) {
    totalTokens += 4;
    
    if (message.role) {
      totalTokens += estimateTokenCount(message.role);
    }
    
    if (message.content) {
      totalTokens += estimateTokenCount(message.content);
    }
    
    if (message.name) {
      totalTokens += estimateTokenCount(message.name);
    }
  }
  
  totalTokens += 2;
  
  return totalTokens;
}

function truncateMessages(messages, maxTokens = 128000) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return messages;
  }
  
  const currentTokens = estimateMessagesTokenCount(messages);
  
  if (currentTokens <= maxTokens) {
    return messages;
  }
  
  const systemMessages = messages.filter(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');
  
  const systemTokens = estimateMessagesTokenCount(systemMessages);
  const availableTokens = maxTokens - systemTokens - 1000;
  
  if (availableTokens <= 0) {
    const truncatedSystem = truncateSystemMessage(systemMessages[0], maxTokens - 1000);
    return [truncatedSystem];
  }
  
  const truncatedOthers = [];
  let accumulatedTokens = 0;
  
  for (let i = otherMessages.length - 1; i >= 0; i--) {
    const message = otherMessages[i];
    const messageTokens = estimateMessagesTokenCount([message]);
    
    if (accumulatedTokens + messageTokens <= availableTokens) {
      truncatedOthers.unshift(message);
      accumulatedTokens += messageTokens;
    } else {
      const remainingTokens = availableTokens - accumulatedTokens;
      if (remainingTokens > 100) {
        const truncatedMessage = truncateMessage(message, remainingTokens);
        truncatedOthers.unshift(truncatedMessage);
      }
      break;
    }
  }
  
  return [...systemMessages, ...truncatedOthers];
}

function truncateSystemMessage(message, maxTokens) {
  if (!message || !message.content) return message;
  
  const currentTokens = estimateTokenCount(message.content);
  if (currentTokens <= maxTokens) return message;
  
  const ratio = maxTokens / currentTokens;
  const targetLength = Math.floor(message.content.length * ratio * 0.9);
  
  return {
    ...message,
    content: message.content.substring(0, targetLength) + '\n\n[系统提示词因长度限制被截断]'
  };
}

function truncateMessage(message, maxTokens) {
  if (!message || !message.content) return message;
  
  const currentTokens = estimateTokenCount(message.content);
  if (currentTokens <= maxTokens) return message;
  
  const ratio = maxTokens / currentTokens;
  const targetLength = Math.floor(message.content.length * ratio * 0.9);
  
  return {
    ...message,
    content: message.content.substring(0, targetLength) + '...[内容因长度限制被截断]'
  };
}

module.exports = {
  estimateTokenCount,
  estimateMessagesTokenCount,
  truncateMessages
};

