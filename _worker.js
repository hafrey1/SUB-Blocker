/*
# @ScriptName 订阅节点名称过滤器 Cloudflare Workers
# @Author hafrey  
# @UpdateTime 2025/09/20 16:07 UTC/GMT +8
# @Function 自动识别并处理多种订阅格式，为节点添加地区标识符，支持动态参数配置
# @Deploy 部署在 Cloudflare Workers 上的完整解决方案
# @Features 集成现代化 GitHub Pages 风格界面，支持在线 API 测试
*/

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  try {
      const url = new URL(request.url);
      
      // 获取 URL 参数
      const lang = url.searchParams.get('lang') || 'EN';
      const customPrefix = url.searchParams.get('prefix') || '➥';
      const customSuffix = url.searchParams.get('suffix') || 'ᵐᵗ';
      const originalUrl = url.searchParams.get('url');

      // 如果没有提供订阅URL，返回使用说明
      if (!originalUrl) {
          return new Response(getUsageHTML(), {
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
      }

      // 获取原始订阅内容
      const response = await fetch(originalUrl);
      if (!response.ok) {
          throw new Error(`Failed to fetch subscription: ${response.status}`);
      }

      const contentType = response.headers.get('Content-Type') || '';
      const originalContent = await response.text();

      // 处理不同类型的订阅
      const processedContent = await processSubscription(originalContent, contentType, lang, customPrefix, customSuffix);

      // 返回处理后的内容，保持原有的 Content-Type
      return new Response(processedContent, {
          headers: {
              'Content-Type': contentType || 'text/plain; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type'
          }
      });

  } catch (error) {
      return new Response(`Error: ${error.message}`, {
          status: 500,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
  }
}

async function processSubscription(content, contentType, lang, customPrefix, customSuffix) {
  // 检测订阅类型并处理
  if (contentType.includes('application/json') || isJSON(content)) {
      // Sing-box 格式
      return processSingboxSubscription(content, lang, customPrefix, customSuffix);
  } else if (contentType.includes('yaml') || isYAML(content)) {
      // Clash 格式
      return processClashSubscription(content, lang, customPrefix, customSuffix);
  } else if (isBase64(content)) {
      // Base64 格式
      return processBase64Subscription(content, lang, customPrefix, customSuffix);
  } else {
      // 尝试自适应处理
      return processAdaptiveSubscription(content, lang, customPrefix, customSuffix);
  }
}

function processSingboxSubscription(content, lang, customPrefix, customSuffix) {
  try {
      const config = JSON.parse(content);

      if (config.outbounds && Array.isArray(config.outbounds)) {
          config.outbounds = config.outbounds.map(outbound => {
              if (outbound.tag && outbound.tag !== 'direct' && outbound.tag !== 'block') {
                  const processedName = processNodeName(outbound.tag, lang, customPrefix, customSuffix);
                  if (processedName) {
                      outbound.tag = processedName;
                  }
              }
              return outbound;
          });
      }

      return JSON.stringify(config, null, 2);
  } catch (error) {
      console.error('Error processing Sing-box subscription:', error);
      return content;
  }
}

function processClashSubscription(content, lang, customPrefix, customSuffix) {
  try {
      // 处理 YAML 格式的 Clash 配置
      const lines = content.split('\n');
      const processedLines = lines.map(line => {
          // 匹配代理节点名称行
          if (line.trim().match(/^-?\s*name:\s*['"]?(.+?)['"]?\s*$/)) {
              const match = line.match(/^(\s*-?\s*name:\s*['"]?)(.+?)(['"]?\s*)$/);
              if (match) {
                  const processedName = processNodeName(match[2], lang, customPrefix, customSuffix);
                  if (processedName) {
                      return match[1] + processedName + match[3];
                  }
              }
          }
          return line;
      });

      return processedLines.join('\n');
  } catch (error) {
      console.error('Error processing Clash subscription:', error);
      return content;
  }
}

function processBase64Subscription(content, lang, customPrefix, customSuffix) {
  try {
      // 解码 Base64 内容
      const decodedContent = atob(content.trim());
      const nodes = decodedContent.split('\n').filter(node => node.trim());

      const processedNodes = nodes.map(node => {
          // 提取节点名称（通常在 # 后面）
          const parts = node.split('#');
          if (parts.length > 1) {
              const originalName = decodeURIComponent(parts[parts.length - 1]);
              const processedName = processNodeName(originalName, lang, customPrefix, customSuffix);
              if (processedName) {
                  parts[parts.length - 1] = encodeURIComponent(processedName);
                  return parts.join('#');
              }
          }
          return node;
      });

      // 重新编码为 Base64
      return btoa(processedNodes.join('\n'));
  } catch (error) {
      console.error('Error processing Base64 subscription:', error);
      return content;
  }
}

function processAdaptiveSubscription(content, lang, customPrefix, customSuffix) {
  try {
      // 尝试检测和处理各种格式
      if (isJSON(content)) {
          return processSingboxSubscription(content, lang, customPrefix, customSuffix);
      } else if (isYAML(content)) {
          return processClashSubscription(content, lang, customPrefix, customSuffix);
      } else if (isBase64(content)) {
          return processBase64Subscription(content, lang, customPrefix, customSuffix);
      } else {
          // 如果都不匹配，尝试作为纯文本处理
          const lines = content.split('\n');
          const processedLines = lines.map(line => {
              if (line.includes('#')) {
                  const parts = line.split('#');
                  if (parts.length > 1) {
                      const originalName = decodeURIComponent(parts[parts.length - 1]);
                      const processedName = processNodeName(originalName, lang, customPrefix, customSuffix);
                      if (processedName) {
                          parts[parts.length - 1] = encodeURIComponent(processedName);
                          return parts.join('#');
                      }
                  }
              }
              return line;
          });
          return processedLines.join('\n');
      }
  } catch (error) {
      console.error('Error processing adaptive subscription:', error);
      return content;
  }
}

function processNodeName(originalName, lang, customPrefix, customSuffix) {
  // 国家和地区与标识符的映射
  const keywordsToNames = getKeywordsToNames(lang);

  // 过滤关键词
  const filterKeywords = [
      "广告", "过期", "无效", "测试", "备用", "官网", "账号", "有效期", "群",
      "到期", "刷新", "剩余", "电报", "会员", "解锁", "流量", "超时",
      "订阅", "佣金", "免翻", "节点", "下载", "更新", "点外", "重置",
      "免流", "Days", "Date", "Expire", "Premium", "建议", "免费",
      "套餐", "到期", "有效", "剩余", "版本", "已用", "过期", "失联",
      "测试", "官方", "网址", "备用", "群", "TEST", "客服", "网站",
      "获取", "订阅", "流量", "机场", "下次", "官址", "联系", "邮箱",
      "工单", "学术", "USE", "USED", "TOTAL", "EXPIRE", "EMAIL"
  ];

  // 检查是否包含过滤关键词
  if (filterKeywords.some(kw => new RegExp(kw, 'i').test(originalName))) {
      return null; // 过滤掉该节点
  }

  // 保留的关键词映射
  const keywordsMap = {
      "ChatGPT": "GPT",
      "OpenAI": "AI"
  };

  let preservedParts = [];
  let newTitle = originalName;

  // 提取并移除保留的关键词部分
  for (const kw in keywordsMap) {
      const match = newTitle.match(new RegExp(kw, 'i'));
      if (match) {
          preservedParts.push(keywordsMap[kw]);
          newTitle = newTitle.replace(match[0], '');
      }
  }

  // 匹配地区关键词
  let matched = false;
  for (const keyword in keywordsToNames) {
      if (new RegExp(keyword, 'i').test(newTitle)) {
          newTitle = keywordsToNames[keyword];
          matched = true;
          break;
      }
  }

  // 如果没有匹配到地区，保留原名称但清理无效字符
  if (!matched) {
      newTitle = originalName.replace(/[^\w\s\-\u4e00-\u9fa5]/g, '').trim();
  }

  // 添加前缀
  newTitle = customPrefix + newTitle;

  // 防重复处理
  const nodeCounter = globalThis.nodeCounter || (globalThis.nodeCounter = {});
  if (!nodeCounter[newTitle]) {
      nodeCounter[newTitle] = 1;
  } else {
      newTitle = `${newTitle}-${++nodeCounter[newTitle]}`;
  }

  // 添加后缀
  newTitle += customSuffix;

  // 添加保留的部分
  if (preservedParts.length) {
      newTitle += ' ' + preservedParts.join(' ');
  }

  return newTitle;
}

function getKeywordsToNames(lang) {
  const outputLanguage = lang.toUpperCase();

  return {
      "美国|美國|US|洛杉矶|洛杉磯|西雅图|纽约|芝加哥|Atlanta|States|American|Los Angeles|Seattle|New York|Chicago": outputLanguage === "CN" ? "🇺🇸美国" : "🇺🇸US",
      "港|香港|HK|Hong Kong": outputLanguage === "CN" ? "🇭🇰香港" : "🇭🇰HK",
      "新加坡|狮城|SG|Singapore": outputLanguage === "CN" ? "🇸🇬新加坡" : "🇸🇬SG",
      "台|台湾|台北|高雄|TW|Taiwan|Taipei|Kaohsiung": outputLanguage === "CN" ? "🇨🇳台湾" : "🇨🇳TW",
      "日|东京|大阪|名古屋|JP|Tokyo|Japan|Osaka|Nagoya": outputLanguage === "CN" ? "🇯🇵日本" : "🇯🇵JP",
      "韩国|首尔|釜山|KR|Korea|Seoul|Busan": outputLanguage === "CN" ? "🇰🇷韩国" : "🇰🇷KR",
      "土耳其|伊斯坦布尔|安卡拉|TR|Turkey|Istanbul|Ankara": outputLanguage === "CN" ? "🇹🇷土耳其" : "🇹🇷TR",
      "爱尔兰|都柏林|IE|Ireland|Dublin": outputLanguage === "CN" ? "🇮🇪爱尔兰" : "🇮🇪IRL",
      "澳|悉尼|墨尔本|布里斯班|AU|Australia|Sydney|Melbourne|Brisbane": outputLanguage === "CN" ? "🇦🇺澳大利亚" : "🇦🇺AU",
      "法国|巴黎|里昂|马赛|FR|France|Paris|Lyon|Marseille": outputLanguage === "CN" ? "🇫🇷法国" : "🇫🇷FRA",
      "瑞典|斯德哥尔摩|哥德堡|SE|Sweden|Stockholm|Gothenburg": outputLanguage === "CN" ? "🇸🇪瑞典" : "🇸🇪SE",
      "德国|法兰克福|柏林|慕尼黑|DE|Germany|Frankfurt|Berlin|Munich": outputLanguage === "CN" ? "🇩🇪德国" : "🇩🇪DE",
      "英国|伦敦|曼彻斯特|伯明翰|GB|UK|United Kingdom|London|Manchester|Birmingham": outputLanguage === "CN" ? "🇬🇧英国" : "🇬🇧GB",
      "印度|孟买|德里|班加罗尔|IN|India|Mumbai|Delhi|Bangalore": outputLanguage === "CN" ? "🇮🇳印度" : "🇮🇳IN",
      "加拿大|多伦多|温哥华|蒙特利尔|CA|Canada|Toronto|Vancouver|Montreal": outputLanguage === "CN" ? "🇨🇦加拿大" : "🇨🇦CA",
      "西班牙|马德里|巴塞罗那|ES|Spain|Madrid|Barcelona": outputLanguage === "CN" ? "🇪🇸西班牙" : "🇪🇸ES",
      "意大利|罗马|米兰|那不勒斯|IT|Italy|Rome|Milan|Naples": outputLanguage === "CN" ? "🇮🇹意大利" : "🇮🇹IT",
      "荷兰|阿姆斯特丹|鹿特丹|NL|Netherlands|Amsterdam|Rotterdam": outputLanguage === "CN" ? "🇳🇱荷兰" : "🇳🇱NL",
      "瑞士|苏黎世|日内瓦|CH|Switzerland|Zurich|Geneva": outputLanguage === "CN" ? "🇨🇭瑞士" : "🇨🇭CH",
      "俄罗斯|莫斯科|圣彼得堡|RU|Russia|Moscow|Saint Petersburg": outputLanguage === "CN" ? "🇷🇺俄罗斯" : "🇷🇺RU",
      "巴西|圣保罗|里约热内卢|BR|Brazil|São Paulo|Rio de Janeiro": outputLanguage === "CN" ? "🇧🇷巴西" : "🇧🇷BR",
      "南非|约翰内斯堡|开普敦|ZA|South Africa|Johannesburg|Cape Town": outputLanguage === "CN" ? "🇿🇦南非" : "🇿🇦ZA",
      "墨西哥|墨西哥城|瓜达拉哈拉|MX|Mexico|Mexico City|Guadalajara": outputLanguage === "CN" ? "🇲🇽墨西哥" : "🇲🇽MX",
      "阿根廷|布宜诺斯艾利斯|AR|Argentina|Buenos Aires": outputLanguage === "CN" ? "🇦🇷阿根廷" : "🇦🇷AR",
      "波兰|华沙|克拉科夫|PL|Poland|Warsaw|Krakow": outputLanguage === "CN" ? "🇵🇱波兰" : "🇵🇱PL",
      "泰国|曼谷|清迈|TH|Thailand|Bangkok|Chiang Mai": outputLanguage === "CN" ? "🇹🇭泰国" : "🇹🇭TH",
      "马来西亚|吉隆坡|槟城|MY|Malaysia|Kuala Lumpur|Penang": outputLanguage === "CN" ? "🇲🇾马来西亚" : "🇲🇾MY",
      "越南|河内|胡志明|VN|Vietnam|Hanoi|Ho Chi Minh": outputLanguage === "CN" ? "🇻🇳越南" : "🇻🇳VN",
      "菲律宾|马尼拉|PH|Philippines|Manila": outputLanguage === "CN" ? "🇵🇭菲律宾" : "🇵🇭PH",
      "埃及|开罗|EG|Egypt|Cairo": outputLanguage === "CN" ? "🇪🇬埃及" : "🇪🇬EG",
      "沙特|利雅得|吉达|SA|Saudi Arabia|Riyadh|Jeddah": outputLanguage === "CN" ? "🇸🇦沙特阿拉伯" : "🇸🇦SA",
      "阿联酋|迪拜|阿布扎比|AE|UAE|Dubai|Abu Dhabi": outputLanguage === "CN" ? "🇦🇪阿联酋" : "🇦🇪AE",
      "挪威|奥斯陆|NO|Norway|Oslo": outputLanguage === "CN" ? "🇳🇴挪威" : "🇳🇴NO",
      "芬兰|赫尔辛基|FI|Finland|Helsinki": outputLanguage === "CN" ? "🇫🇮芬兰" : "🇫🇮FI",
      "奥地利|维也纳|AT|Austria|Vienna": outputLanguage === "CN" ? "🇦🇹奥地利" : "🇦🇹AT",
      "希腊|雅典|GR|Greece|Athens": outputLanguage === "CN" ? "🇬🇷希腊" : "🇬🇷GR",
      "匈牙利|布达佩斯|HU|Hungary|Budapest": outputLanguage === "CN" ? "🇭🇺匈牙利" : "🇭🇺HU",
      "捷克|布拉格|CZ|Czech|Prague": outputLanguage === "CN" ? "🇨🇿捷克" : "🇨🇿CZ",
      "新西兰|奥克兰|NZ|New Zealand|Auckland": outputLanguage === "CN" ? "🇳🇿新西兰" : "🇳🇿NZ",
      "尼泊尔|加德满都|NP|Nepal|Kathmandu": outputLanguage === "CN" ? "🇳🇵尼泊尔" : "🇳🇵NP",
      "葡萄牙|里斯本|PT|Portugal|Lisbon": outputLanguage === "CN" ? "🇵🇹葡萄牙" : "🇵🇹PT",
      "巴基斯坦|伊斯兰堡|PK|Pakistan|Islamabad": outputLanguage === "CN" ? "🇵🇰巴基斯坦" : "🇵🇰PK",
      "伊朗|德黑兰|IR|Iran|Tehran": outputLanguage === "CN" ? "🇮🇷伊朗" : "🇮🇷IR",
      "伊拉克|巴格达|IQ|Iraq|Baghdad": outputLanguage === "CN" ? "🇮🇶伊拉克" : "🇮🇶IQ",
      "阿尔及利亚|阿尔及尔|DZ|Algeria|Algiers": outputLanguage === "CN" ? "🇩🇿阿尔及利亚" : "🇩🇿DZ",
      "摩洛哥|拉巴特|MA|Morocco|Rabat": outputLanguage === "CN" ? "🇲🇦摩洛哥" : "🇲🇦MA",
      "尼日利亚|拉各斯|NG|Nigeria|Lagos": outputLanguage === "CN" ? "🇳🇬尼日利亚" : "🇳🇬NG",
      "智利|圣地亚哥|CL|Chile|Santiago": outputLanguage === "CN" ? "🇨🇱智利" : "🇨🇱CL",
      "秘鲁|利马|PE|Peru|Lima": outputLanguage === "CN" ? "🇵🇪秘鲁" : "🇵🇪PE",
      "哥伦比亚|波哥大|CO|Colombia|Bogotá": outputLanguage === "CN" ? "🇨🇴哥伦比亚" : "🇨🇴CO",
      "罗马尼亚|Romania|RO|Bucharest|Cluj-Napoca|Timișoara": outputLanguage === "CN" ? "🇷🇴罗马尼亚" : "🇷🇴RO",
      "塞尔维亚|Serbia|RS|Belgrade|Novi Sad|Niš": outputLanguage === "CN" ? "🇷🇸塞尔维亚" : "🇷🇸RS",
      "立陶宛|Lithuania|LT|Vilnius|Kaunas|Klaipėda": outputLanguage === "CN" ? "🇱🇹立陶宛" : "🇱🇹LT",
      "危地马拉|Guatemala|GT|Guatemala City|Antigua Guatemala|Quetzaltenango": outputLanguage === "CN" ? "🇬🇹危地马拉" : "🇬🇹GT",
      "丹麦|Denmark|DK|Copenhagen|Aarhus|Odense": outputLanguage === "CN" ? "🇩🇰丹麦" : "🇩🇰DK",
      "乌克兰|Ukraine|UA|Kyiv|Lviv|Odesa": outputLanguage === "CN" ? "🇺🇦乌克兰" : "🇺🇦UA",
      "以色列|Israel|IL|Jerusalem|Tel Aviv|Haifa": outputLanguage === "CN" ? "🇮🇱以色列" : "🇮🇱IL",
      "厄瓜多尔|Ecuador|EC|Quito|Guayaquil|Cuenca": outputLanguage === "CN" ? "🇪🇨厄瓜多尔" : "🇪🇨EC",
      "哥斯达黎加|Costa Rica|CR|San José|Alajuela|Cartago": outputLanguage === "CN" ? "🇨🇷哥斯达黎加" : "🇨🇷CR",
      "塞浦路斯|Cyprus|CY|Nicosia|Limassol|Larnaca": outputLanguage === "CN" ? "🇨🇾塞浦路斯" : "🇨🇾CY",
      "比利时|Belgium|BE|Brussels|Antwerp|Ghent": outputLanguage === "CN" ? "🇧🇪比利时" : "🇧🇪BE",
      "玻利维亚|Bolivia|BO|Sucre|La Paz|Santa Cruz": outputLanguage === "CN" ? "🇧🇴玻利维亚" : "🇧🇴BO"
  };
}

// 辅助函数
function isJSON(str) {
  try {
      JSON.parse(str);
      return true;
  } catch {
      return false;
  }
}

function isYAML(str) {
  return str.includes('proxies:') || str.includes('proxy-groups:') || str.includes('rules:');
}

function isBase64(str) {
  try {
      return btoa(atob(str)) === str;
  } catch {
      return false;
  }
}

function getUsageHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>订阅节点名称过滤器 | Subscription Node Filter</title>
  <style>
      :root {
          --primary-color: #2563eb;
          --secondary-color: #64748b;
          --accent-color: #f59e0b;
          --success-color: #059669;
          --background: #ffffff;
          --surface: #f8fafc;
          --text-primary: #1e293b;
          --text-secondary: #64748b;
          --border: #e2e8f0;
          --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
      }

      [data-theme="dark"] {
          --background: #0f172a;
          --surface: #1e293b;
          --text-primary: #f1f5f9;
          --text-secondary: #94a3b8;
          --border: #334155;
      }

      * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
      }

      body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
          background: var(--background);
          color: var(--text-primary);
          line-height: 1.6;
          transition: all 0.3s ease;
      }

      .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
      }

      .header {
          background: linear-gradient(135deg, var(--primary-color), #3b82f6);
          color: white;
          padding: 3rem 0;
          text-align: center;
          position: relative;
          overflow: hidden;
      }

      .header-content {
          position: relative;
          z-index: 1;
      }

      .header h1 {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          text-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .header p {
          font-size: 1.2rem;
          opacity: 0.9;
          max-width: 600px;
          margin: 0 auto;
      }

      .badges {
          margin-top: 1.5rem;
          display: flex;
          justify-content: center;
          gap: 0.5rem;
          flex-wrap: wrap;
      }

      .badge {
          padding: 0.25rem 0.75rem;
          background: rgba(255,255,255,0.2);
          border-radius: 1rem;
          font-size: 0.875rem;
          backdrop-filter: blur(8px);
      }

      .nav-tabs {
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          padding: 1rem 0;
          position: sticky;
          top: 0;
          z-index: 100;
      }

      .tabs {
          display: flex;
          gap: 2rem;
          justify-content: center;
      }

      .tab {
          background: none;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          color: var(--text-secondary);
          font-weight: 500;
      }

      .tab.active {
          background: var(--primary-color);
          color: white;
      }

      .tab:hover:not(.active) {
          background: var(--border);
      }

      .main {
          padding: 3rem 0;
      }

      .tab-content {
          display: none;
      }

      .tab-content.active {
          display: block;
      }

      .card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          padding: 2rem;
          margin: 1.5rem 0;
          box-shadow: var(--shadow);
          transition: transform 0.2s, box-shadow 0.2s;
      }

      .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px 0 rgb(0 0 0 / 0.15);
      }

      .card h3 {
          color: var(--primary-color);
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
      }

      .code-block {
          background: #1e293b;
          color: #e2e8f0;
          padding: 1.5rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
          font-size: 0.875rem;
          line-height: 1.5;
          margin: 1rem 0;
          position: relative;
      }

      .copy-btn {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          background: var(--primary-color);
          color: white;
          border: none;
          padding: 0.5rem;
          border-radius: 0.25rem;
          cursor: pointer;
          font-size: 0.75rem;
          transition: opacity 0.2s;
          opacity: 0;
      }

      .code-block:hover .copy-btn {
          opacity: 1;
      }

      .api-tester {
          background: var(--surface);
          border: 2px solid var(--border);
          border-radius: 0.75rem;
          padding: 2rem;
          margin: 2rem 0;
      }

      .form-group {
          margin-bottom: 1.5rem;
      }

      .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: var(--text-primary);
      }

      .form-group input, .form-group select {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid var(--border);
          border-radius: 0.5rem;
          background: var(--background);
          color: var(--text-primary);
          font-size: 1rem;
          transition: border-color 0.2s;
      }

      .form-group input:focus, .form-group select:focus {
          outline: none;
          border-color: var(--primary-color);
      }

      .btn {
          background: var(--primary-color);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 500;
          transition: all 0.2s;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
      }

      .btn:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
      }

      .btn-secondary {
          background: var(--secondary-color);
      }

      .btn-secondary:hover {
          background: #475569;
      }

      .result {
          margin-top: 1.5rem;
          padding: 1rem;
          border-radius: 0.5rem;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.875rem;
          white-space: pre-wrap;
          overflow-x: auto;
      }

      .result.success {
          background: #dcfce7;
          color: #166534;
          border: 1px solid #bbf7d0;
      }

      .result.error {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
      }

      .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          margin: 2rem 0;
      }

      .feature {
          background: var(--surface);
          padding: 1.5rem;
          border-radius: 0.75rem;
          border: 1px solid var(--border);
          text-align: center;
      }

      .feature-icon {
          font-size: 2.5rem;
          margin-bottom: 1rem;
      }

      .footer {
          background: var(--surface);
          border-top: 1px solid var(--border);
          padding: 2rem 0;
          text-align: center;
          margin-top: 4rem;
      }

      .theme-toggle {
          position: fixed;
          top: 1rem;
          right: 1rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 50%;
          width: 3rem;
          height: 3rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          z-index: 1000;
          transition: all 0.2s;
      }

      .theme-toggle:hover {
          transform: scale(1.1);
      }

      .github-link {
          position: fixed;
          top: 1rem;
          left: 1rem;
          background: var(--primary-color);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 2rem;
          text-decoration: none;
          font-size: 0.875rem;
          font-weight: 500;
          z-index: 1000;
          transition: all 0.2s;
      }

      .github-link:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
      }

      @media (max-width: 768px) {
          .header h1 {
              font-size: 2rem;
          }
          
          .tabs {
              flex-wrap: wrap;
              gap: 1rem;
          }
          
          .card {
              padding: 1.5rem;
          }
          
          .features-grid {
              grid-template-columns: 1fr;
          }
          
          .theme-toggle, .github-link {
              position: static;
              margin: 1rem auto;
          }
      }
  </style>
</head>
<body>
  <a class="github-link" href="https://github.com/hafrey1/SubFilter" target="_blank">📂 GitHub</a>
  
  <button class="theme-toggle" onclick="toggleTheme()" title="切换主题">
      <span id="theme-icon">🌙</span>
  </button>

  <header class="header">
      <div class="container">
          <div class="header-content">
              <h1>📡 订阅节点名称过滤器</h1>
              <p>智能处理多种订阅格式，自动为节点添加地区标识符和自定义前后缀</p>
              <div class="badges">
                  <span class="badge">Base64</span>
                  <span class="badge">Clash</span>
                  <span class="badge">Sing-box</span>
                  <span class="badge">自适应</span>
              </div>
          </div>
      </div>
  </header>

  <nav class="nav-tabs">
      <div class="container">
          <div class="tabs">
              <button class="tab active" onclick="showTab('quick-start')">🚀 快速开始</button>
              <button class="tab" onclick="showTab('api-test')">🧪 API 测试</button>
              <button class="tab" onclick="showTab('examples')">💡 使用示例</button>
              <button class="tab" onclick="showTab('features')">⚡ 功能特性</button>
          </div>
      </div>
  </nav>

  <main class="main">
      <div class="container">
          <!-- 快速开始 -->
          <div id="quick-start" class="tab-content active">
              <div class="card">
                  <h3>🚀 快速开始</h3>
                  <p>只需要一个简单的 URL 参数，就可以开始使用订阅过滤器：</p>
                  
                  <div class="code-block">
                      <button class="copy-btn" onclick="copyToClipboard(this)">复制</button>
                      <code>\${location.origin}?url=YOUR_SUBSCRIPTION_URL</code>
                  </div>

                  <h4 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--primary-color);">📋 支持的参数</h4>
                  <ul style="margin-left: 2rem; color: var(--text-secondary);">
                      <li><strong style="color: var(--text-primary);">url</strong> (必需) - 原始订阅链接</li>
                      <li><strong style="color: var(--text-primary);">lang</strong> (可选) - 语言设置 (CN=中文, EN=英文，默认: EN)</li>
                      <li><strong style="color: var(--text-primary);">prefix</strong> (可选) - 节点名称前缀 (默认: ➥)</li>
                      <li><strong style="color: var(--text-primary);">suffix</strong> (可选) - 节点名称后缀 (默认: ᵐᵗ)</li>
                  </ul>
              </div>

              <div class="card">
                  <h3>🔧 支持的订阅格式</h3>
                  <div class="features-grid">
                      <div class="feature">
                          <div class="feature-icon">🔤</div>
                          <h4>Base64 订阅</h4>
                          <p>标准的 Base64 编码订阅链接，自动解码处理</p>
                      </div>
                      <div class="feature">
                          <div class="feature-icon">⚔️</div>
                          <h4>Clash 配置</h4>
                          <p>支持 Clash 和 Clash Meta 的 YAML 格式配置</p>
                      </div>
                      <div class="feature">
                          <div class="feature-icon">📦</div>
                          <h4>Sing-box 配置</h4>
                          <p>处理 Sing-box 的 JSON 格式配置文件</p>
                      </div>
                      <div class="feature">
                          <div class="feature-icon">🎯</div>
                          <h4>自适应检测</h4>
                          <p>智能识别订阅格式，自动选择处理方式</p>
                      </div>
                  </div>
              </div>
          </div>

          <!-- API 测试 -->
          <div id="api-test" class="tab-content">
              <div class="api-tester">
                  <h3>🧪 在线 API 测试工具</h3>
                  <p style="margin-bottom: 2rem; color: var(--text-secondary);">在这里测试你的订阅链接，实时查看处理结果</p>
                  
                  <div class="form-group">
                      <label for="test-url">订阅链接 *</label>
                      <input type="url" id="test-url" placeholder="https://example.com/subscription" required>
                  </div>
                  
                  <div class="form-group">
                      <label for="test-lang">语言设置</label>
                      <select id="test-lang">
                          <option value="EN">英文 (EN)</option>
                          <option value="CN">中文 (CN)</option>
                      </select>
                  </div>
                  
                  <div class="form-group">
                      <label for="test-prefix">前缀</label>
                      <input type="text" id="test-prefix" placeholder="➥" value="➥">
                  </div>
                  
                  <div class="form-group">
                      <label for="test-suffix">后缀</label>
                      <input type="text" id="test-suffix" placeholder="ᵐᵗ" value="ᵐᵗ">
                  </div>
                  
                  <button class="btn" onclick="testAPI()">🚀 测试 API</button>
                  <button class="btn btn-secondary" onclick="generateURL()">🔗 生成链接</button>
                  
                  <div id="test-result"></div>
              </div>
          </div>

          <!-- 使用示例 -->
          <div id="examples" class="tab-content">
              <div class="card">
                  <h3>💡 使用示例</h3>
                  
                  <h4 style="color: var(--success-color); margin: 2rem 0 1rem;">基础使用</h4>
                  <div class="code-block">
                      <button class="copy-btn" onclick="copyToClipboard(this)">复制</button>
                      <code>\${location.origin}?url=https://example.com/subscription</code>
                  </div>
                  
                  <h4 style="color: var(--success-color); margin: 2rem 0 1rem;">中文节点名称</h4>
                  <div class="code-block">
                      <button class="copy-btn" onclick="copyToClipboard(this)">复制</button>
                      <code>\${location.origin}?url=https://example.com/subscription&lang=CN</code>
                  </div>
                  
                  <h4 style="color: var(--success-color); margin: 2rem 0 1rem;">自定义前缀后缀</h4>
                  <div class="code-block">
                      <button class="copy-btn" onclick="copyToClipboard(this)">复制</button>
                      <code>\${location.origin}?url=https://example.com/subscription&prefix=🚀&suffix=ᴴᴰ</code>
                  </div>
                  
                  <h4 style="color: var(--success-color); margin: 2rem 0 1rem;">完整参数示例</h4>
                  <div class="code-block">
                      <button class="copy-btn" onclick="copyToClipboard(this)">复制</button>
                      <code>\${location.origin}?url=https://example.com/subscription&lang=CN&prefix=🚀&suffix=ᴴᴰ</code>
                  </div>
              </div>

              <div class="card">
                  <h3>🌍 地区映射示例</h3>
                  <p>过滤器会自动识别节点中的地区信息，并添加相应的国旗和标识：</p>
                  
                  <div style="margin-top: 1.5rem;">
                      <h4 style="color: var(--text-secondary); margin-bottom: 1rem;">处理前 → 处理后</h4>
                      <div style="font-family: monospace; line-height: 2;">
                          <div>美国洛杉矶-01 → ➥🇺🇸美国ᵐᵗ</div>
                          <div>HK-BGP-香港 → ➥🇭🇰香港ᵐᵗ</div>
                          <div>日本东京节点 → ➥🇯🇵日本ᵐᵗ</div>
                          <div>Singapore-SG → ➥🇸🇬新加坡ᵐᵗ</div>
                      </div>
                  </div>
              </div>
          </div>

          <!-- 功能特性 -->
          <div id="features" class="tab-content">
              <div class="card">
                  <h3>⚡ 核心功能</h3>
                  <div class="features-grid">
                      <div class="feature">
                          <div class="feature-icon">🎯</div>
                          <h4>智能识别</h4>
                          <p>自动检测订阅类型，无需手动指定格式</p>
                      </div>
                      <div class="feature">
                          <div class="feature-icon">🌍</div>
                          <h4>地区映射</h4>
                          <p>支持 50+ 国家地区，自动添加国旗标识</p>
                      </div>
                      <div class="feature">
                          <div class="feature-icon">🗑️</div>
                          <h4>广告过滤</h4>
                          <p>自动过滤广告、过期等无效节点信息</p>
                      </div>
                      <div class="feature">
                          <div class="feature-icon">⚙️</div>
                          <h4>高度定制</h4>
                          <p>支持自定义前缀、后缀、语言等参数</p>
                      </div>
                      <div class="feature">
                          <div class="feature-icon">⚡</div>
                          <h4>边缘计算</h4>
                          <p>部署在 Cloudflare 边缘网络，全球加速</p>
                      </div>
                      <div class="feature">
                          <div class="feature-icon">🔒</div>
                          <h4>隐私保护</h4>
                          <p>不存储任何订阅数据，实时处理返回</p>
                      </div>
                  </div>
              </div>

              <div class="card">
                  <h3>🔧 技术特性</h3>
                  <ul style="margin-left: 2rem; line-height: 2;">
                      <li>✅ 支持 CORS 跨域请求</li>
                      <li>✅ 自动内容类型检测</li>
                      <li>✅ 错误处理和异常捕获</li>
                      <li>✅ 防重复节点名称处理</li>
                      <li>✅ 保留特殊关键词（如 ChatGPT、OpenAI）</li>
                      <li>✅ 支持中英文双语输出</li>
                  </ul>
              </div>
          </div>
      </div>
  </main>

  <footer class="footer">
      <div class="container">
          <p>&copy; 2025 订阅节点名称过滤器 | 基于 <a href="https://workers.cloudflare.com" target="_blank" style="color: var(--primary-color);">Cloudflare Workers</a> 构建</p>
          <p style="margin-top: 0.5rem;">
              <a href="https://github.com/hafrey/subscription-filter" target="_blank" style="color: var(--primary-color); text-decoration: none;">
                  📂 查看源代码
              </a>
          </p>
      </div>
  </footer>

  <script>
      // 主题切换
      function toggleTheme() {
          const body = document.body;
          const themeIcon = document.getElementById('theme-icon');
          
          if (body.hasAttribute('data-theme')) {
              body.removeAttribute('data-theme');
              themeIcon.textContent = '🌙';
              localStorage.setItem('theme', 'light');
          } else {
              body.setAttribute('data-theme', 'dark');
              themeIcon.textContent = '☀️';
              localStorage.setItem('theme', 'dark');
          }
      }

      // 初始化主题
      function initTheme() {
          const savedTheme = localStorage.getItem('theme');
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          
          if (savedTheme === 'dark' || (savedTheme === null && prefersDark)) {
              document.body.setAttribute('data-theme', 'dark');
              document.getElementById('theme-icon').textContent = '☀️';
          }
      }

      // 标签页切换
      function showTab(tabName) {
          // 隐藏所有标签内容
          const contents = document.querySelectorAll('.tab-content');
          contents.forEach(content => content.classList.remove('active'));
          
          // 移除所有标签的激活状态
          const tabs = document.querySelectorAll('.tab');
          tabs.forEach(tab => tab.classList.remove('active'));
          
          // 显示选中的标签内容
          document.getElementById(tabName).classList.add('active');
          
          // 激活选中的标签
          event.target.classList.add('active');
      }

      // 复制到剪贴板
      function copyToClipboard(button) {
          let text;
          if (button.hasAttribute('data-text')) {
              text = button.getAttribute('data-text');
          } else {
              const codeBlock = button.parentNode;
              const code = codeBlock.querySelector('code');
              text = code.textContent;
          }
          
          navigator.clipboard.writeText(text).then(() => {
              const originalText = button.textContent;
              button.textContent = '已复制!';
              setTimeout(() => {
                  button.textContent = originalText;
              }, 2000);
          }).catch(() => {
              // 降级处理
              const textarea = document.createElement('textarea');
              textarea.value = text;
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand('copy');
              document.body.removeChild(textarea);
              
              const originalText = button.textContent;
              button.textContent = '已复制!';
              setTimeout(() => {
                  button.textContent = originalText;
              }, 2000);
          });
      }

      // 生成 URL
      function generateURL() {
          const url = document.getElementById('test-url').value;
          const lang = document.getElementById('test-lang').value;
          const prefix = document.getElementById('test-prefix').value;
          const suffix = document.getElementById('test-suffix').value;
          
          if (!url) {
              alert('请输入订阅链接');
              return;
          }
          
          let generatedURL = location.origin + '?url=' + encodeURIComponent(url);
          if (lang !== 'EN') generatedURL += '&lang=' + lang;
          if (prefix !== '➥') generatedURL += '&prefix=' + encodeURIComponent(prefix);
          if (suffix !== 'ᵐᵗ') generatedURL += '&suffix=' + encodeURIComponent(suffix);
          
          const resultDiv = document.getElementById('test-result');
          resultDiv.innerHTML = \`
              <div class="result success">
                  生成的链接：
                  \${generatedURL}
                  
                  <button class="btn" style="margin-top: 1rem;" onclick="copyToClipboard(this)" data-text="\${generatedURL}">复制链接</button>
              </div>
          \`;
      }

      // 测试 API
      async function testAPI() {
          const url = document.getElementById('test-url').value;
          const lang = document.getElementById('test-lang').value;
          const prefix = document.getElementById('test-prefix').value;
          const suffix = document.getElementById('test-suffix').value;
          const resultDiv = document.getElementById('test-result');
          
          if (!url) {
              resultDiv.innerHTML = '<div class="result error">请输入订阅链接</div>';
              return;
          }
          
          resultDiv.innerHTML = '<div class="result">🔄 正在测试 API...</div>';
          
          try {
              let testURL = location.origin + '?url=' + encodeURIComponent(url);
              if (lang !== 'EN') testURL += '&lang=' + lang;
              if (prefix !== '➥') testURL += '&prefix=' + encodeURIComponent(prefix);
              if (suffix !== 'ᵐᵗ') testURL += '&suffix=' + encodeURIComponent(suffix);
              
              const response = await fetch(testURL);
              const result = await response.text();
              
              if (response.ok) {
                  resultDiv.innerHTML = \`
                      <div class="result success">
                          ✅ 测试成功！
                          
                          处理结果预览（前200字符）：
                          \${result.substring(0, 200)}\${result.length > 200 ? '...' : ''}
                          
                          <button class="btn" style="margin-top: 1rem;" onclick="window.open('\${testURL}', '_blank')">查看完整结果</button>
                      </div>
                  \`;
              } else {
                  resultDiv.innerHTML = \`<div class="result error">❌ 测试失败：\${result}</div>\`;
              }
          } catch (error) {
              resultDiv.innerHTML = \`<div class="result error">❌ 请求失败：\${error.message}</div>\`;
          }
      }

      // 初始化
      document.addEventListener('DOMContentLoaded', function() {
          initTheme();
      });
  </script>
</body>
</html>
`;
}
