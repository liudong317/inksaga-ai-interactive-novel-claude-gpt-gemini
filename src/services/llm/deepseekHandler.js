const https = require('https');
const { truncateMessages, estimateMessagesTokenCount } = require('../../utils/tokenCounter');

async function callDeepSeek(messages, provider, options = {}) {
  const maxTokens = 128000;
  const originalTokens = estimateMessagesTokenCount(messages);
  
  if (originalTokens > maxTokens) {
    messages = truncateMessages(messages, maxTokens);
  }
  const apiUrl = new URL(`${provider.baseUrl}/chat/completions`);
  const postData = JSON.stringify({
    model: provider.model,
    messages: messages,
    temperature: options.temperature || provider.temperature || 0.7,
    stream: false
  });

  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: apiUrl.hostname,
      port: apiUrl.port || 443,
      path: apiUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 300000
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          if (res.statusCode === 429) {
            reject(new Error('429'));
            return;
          }
          if (res.statusCode !== 200) {
            const errorMsg = jsonData?.error?.message || jsonData?.message || `HTTP ${res.statusCode}`;
            reject(new Error(errorMsg));
            return;
          }
          if (jsonData && jsonData.choices && jsonData.choices[0] && jsonData.choices[0].message) {
            resolve({ success: true, content: jsonData.choices[0].message.content.trim() });
          } else {
            reject(new Error('DeepSeek返回数据格式错误'));
          }
        } catch (error) {
          reject(new Error(`解析DeepSeek响应失败: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`DeepSeek调用失败: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('API请求超时'));
    });

    req.write(postData, 'utf8');
    req.end();
  });
}

function cleanDeepSeekJSON(jsonStr) {
  if (!jsonStr || typeof jsonStr !== 'string') {
    return jsonStr;
  }
  
  if (jsonStr.includes('<think>')) {
    jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/gi, '');
  }
  
  jsonStr = jsonStr.replace(/```json\s*/gi, '');
  jsonStr = jsonStr.replace(/```\s*/gi, '');
  
  const startIndex = jsonStr.indexOf('{');
  const endIndex = jsonStr.lastIndexOf('}');
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    jsonStr = jsonStr.substring(startIndex, endIndex + 1);
  }
  
  jsonStr = jsonStr.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  
  try {
    JSON.parse(jsonStr);
    return jsonStr;
  } catch (e) {
    console.log('JSON解析失败，尝试修复:', e.message);
  }
  
  let result = '';
  let inString = false;
  let escapeNext = false;
  let stack = [];
  
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    const prevChar = i > 0 ? result[result.length - 1] : '';
    
    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      result += char;
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      if (inString) {
        result += char;
        inString = false;
        
        let j = i + 1;
        while (j < jsonStr.length && /\s/.test(jsonStr[j])) j++;
        
        if (j < jsonStr.length) {
          const nextChar = jsonStr[j];
          const currentContext = stack[stack.length - 1];
          
          if (nextChar === '"') {
            if (currentContext === '[') {
              result += ',';
            } else if (currentContext === '{') {
              const colonIndex = jsonStr.indexOf(':', j);
              const commaIndex = jsonStr.indexOf(',', j);
              const braceIndex = jsonStr.indexOf('}', j);
              
              if (colonIndex !== -1 && (colonIndex < commaIndex || commaIndex === -1) && (colonIndex < braceIndex || braceIndex === -1)) {
                result += ',';
              }
            }
          } else if (nextChar === '{' && currentContext === '[') {
            result += ',';
          }
        }
      } else {
        result += char;
        inString = true;
      }
      continue;
    }
    
    if (inString) {
      if (char === '\n' || char === '\r') {
        continue;
      }
      result += char;
      continue;
    }
    
    if (char === '{') {
      stack.push('{');
      result += char;
    } else if (char === '}') {
      if (stack.length > 0 && stack[stack.length - 1] === '{') {
        stack.pop();
      }
      result += char;
    } else if (char === '[') {
      stack.push('[');
      result += char;
    } else if (char === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === '[') {
        stack.pop();
      }
      result += char;
    } else {
      result += char;
    }
  }
  
  if (inString) {
    console.log('检测到未闭合的字符串，自动闭合');
    result += '"';
  }
  
  while (stack.length > 0) {
    const unclosed = stack.pop();
    if (unclosed === '{') {
      console.log('检测到未闭合的对象，自动闭合');
      result += '}';
    } else if (unclosed === '[') {
      console.log('检测到未闭合的数组，自动闭合');
      result += ']';
    }
  }
  
  result = result.replace(/,(\s*[}\]])/g, '$1');
  result = result.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
  
  return result;
}

module.exports = { callDeepSeek, cleanDeepSeekJSON };

