/*
# @ScriptName        订阅节点名称过滤器 Cloudflare Workers
# @Author            hafrey
# @UpdateTime        2025/09/20 12:08 UTC/GMT +8
# @Function          自动识别并处理多种订阅格式，为节点添加地区标识符，支持动态参数配置
# @Deploy            部署在 Cloudflare Workers 上的完整解决方案
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
          outbound.tag = processNodeName(outbound.tag, lang, customPrefix, customSuffix);
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
          return match[1] + processedName + match[3];
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
        parts[parts.length - 1] = encodeURIComponent(processedName);
        return parts.join('#');
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
            parts[parts.length - 1] = encodeURIComponent(processedName);
            return parts.join('#');
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
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>订阅节点名称过滤器</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 40px; }
        .usage { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .params { background: #e8f4f8; padding: 15px; border-radius: 6px; margin: 10px 0; }
        .example { background: #fff3cd; padding: 15px; border-radius: 6px; margin: 15px 0; }
        code { background: #f8f8f8; padding: 2px 6px; border-radius: 4px; font-family: 'Courier New', monospace; }
        .note { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📡 订阅节点名称过滤器</h1>
        <p>自动处理多种订阅格式并为节点添加地区标识符</p>
    </div>
    
    <div class="usage">
        <h2>🚀 使用方法</h2>
        <p>在当前 URL 后添加参数来使用过滤器：</p>
        <code>https://your-worker.domain.workers.dev/?url=订阅链接&lang=语言&prefix=前缀&suffix=后缀</code>
    </div>
    
    <div class="params">
        <h3>📋 支持的参数</h3>
        <ul>
            <li><strong>url</strong> (必需) - 原始订阅链接</li>
            <li><strong>lang</strong> (可选) - 语言设置，CN=中文，EN=英文，默认: EN</li>
            <li><strong>prefix</strong> (可选) - 节点名称前缀，默认: ➥</li>
            <li><strong>suffix</strong> (可选) - 节点名称后缀，默认: ᵐᵗ</li>
        </ul>
    </div>
    
    <div class="example">
        <h3>💡 使用示例</h3>
        <p><strong>中文节点名称:</strong></p>
        <code>?url=https://example.com/sub&lang=CN</code>
        
        <p><strong>自定义前缀后缀:</strong></p>
        <code>?url=https://example.com/sub&prefix=🚀&suffix=⭐</code>
        
        <p><strong>完整示例:</strong></p>
        <code>?url=https://example.com/sub&lang=CN&prefix=🌟&suffix=🔥</code>
    </div>
    
    <div class="usage">
        <h3>🔧 支持的订阅格式</h3>
        <ul>
            <li>Base64 编码订阅</li>
            <li>Clash / Clash-meta 配置</li>
            <li>Sing-box 配置</li>
            <li>自适应格式检测</li>
        </ul>
    </div>
    
    <div class="note">
        <p><em>注意：请确保订阅链接可以正常访问，系统会自动检测并处理不同的订阅格式。</em></p>
    </div>
</body>
</html>
  `;
}
