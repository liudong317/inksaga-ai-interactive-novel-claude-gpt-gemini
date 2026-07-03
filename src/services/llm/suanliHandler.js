const https = require('https');
const { truncateMessages, estimateMessagesTokenCount } = require('../../utils/tokenCounter');

async function callSuanli(messages, provider, options = {}) {
  const maxTokens = 128000;
  const originalTokens = estimateMessagesTokenCount(messages);
  
  if (originalTokens > maxTokens) {
    console.log(`算力云请求token数: ${originalTokens}, 超过限制${maxTokens}, 正在截断...`);
    messages = truncateMessages(messages, maxTokens);
    const truncatedTokens = estimateMessagesTokenCount(messages);
    console.log(`截断后token数: ${truncatedTokens}`);
  } else {
    console.log(`算力云请求token数: ${originalTokens}`);
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
            reject(new Error('算力云返回数据格式错误'));
          }
        } catch (error) {
          reject(new Error(`解析算力云响应失败: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`算力云调用失败: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('API请求超时'));
    });

    req.write(postData, 'utf8');
    req.end();
  });
}

function cleanSuanliJSON(jsonStr) {
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

module.exports = { callSuanli, cleanSuanliJSON };

