const http = require('http');
const { truncateMessages, estimateMessagesTokenCount } = require('../../utils/tokenCounter');

async function callOllama(messages, provider, options = {}) {
  const maxTokens = 128000;
  const originalTokens = estimateMessagesTokenCount(messages);
  
  if (originalTokens > maxTokens) {
    console.log(`Ollama请求token数: ${originalTokens}, 超过限制${maxTokens}, 正在截断...`);
    messages = truncateMessages(messages, maxTokens);
    const truncatedTokens = estimateMessagesTokenCount(messages);
    console.log(`截断后token数: ${truncatedTokens}`);
  } else {
    console.log(`Ollama请求token数: ${originalTokens}`);
  }
  const apiUrl = new URL(`${provider.baseUrl}/api/chat`);
  const postData = JSON.stringify({
    model: provider.model,
    messages: messages,
    stream: false,
    options: {
      temperature: options.temperature || provider.temperature || 0.7
    }
  });

  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: apiUrl.hostname,
      port: apiUrl.port || 11434,
      path: apiUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 600000
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`Ollama返回错误状态码: ${res.statusCode}`));
            return;
          }
          const jsonData = JSON.parse(data);
          if (jsonData && jsonData.message && jsonData.message.content) {
            resolve({ success: true, content: jsonData.message.content.trim() });
          } else {
            reject(new Error('Ollama返回数据格式错误'));
          }
        } catch (error) {
          reject(new Error(`解析Ollama响应失败: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Ollama调用失败: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Ollama响应超时'));
    });

    req.write(postData, 'utf8');
    req.end();
  });
}

function cleanOllamaJSON(jsonStr) {
  if (jsonStr.includes('<think>')) {
    jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/gi, '');
  }
  jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  jsonStr = jsonStr.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }
  jsonStr = jsonStr.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  jsonStr = jsonStr.replace(/\}\s*\{/g, '},{');
  jsonStr = jsonStr.replace(/:\s*"([^"]*?),\s*\n/g, function(match, value) {
    return ':"' + value.replace(/，\s*$/, '') + '",\n';
  });
  jsonStr = jsonStr.replace(/:\s*"([^"]*?)(\n\s*"[a-zA-Z]+":)/g, ':"$1",$2');
  jsonStr = jsonStr.replace(/:\s*"([^"]*),\s*"/g, ': "$1"');
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
  jsonStr = jsonStr.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
  jsonStr = jsonStr.replace(/:\s*'([^']*)'/g, ': "$1"');
  jsonStr = jsonStr.replace(/\n/g, '\\n').replace(/\r/g, '');
  jsonStr = jsonStr.replace(/"([^"]*)"(\s*):/g, function(match, key, space) {
    return '"' + key.replace(/\\/g, '\\\\') + '"' + space + ':';
  });
  jsonStr = jsonStr.replace(/:\s*"([^"]*)"/g, function(match, value) {
    return ': "' + value.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  });
  return jsonStr;
}

module.exports = { callOllama, cleanOllamaJSON };

