/*
# @ScriptName        订阅节点名称过滤器 Cloudflare Worker
# @Author            Based on @weekin's script
# @UpdateTime        2025/09/19 UTC/GMT +8
# @Function          自动为服务器节点添加国家或地区标识符，支持中英文输出，并通过自定义前缀和后缀重命名节点。同时，过滤无效关键词，保留必要信息，确保节点名称唯一且简洁等
# @DeployTo          Cloudflare Workers
*/

// 配置项
const DEFAULT_CONFIG = {
  customCharStart: "➥",
  customCharEnd: "ᵐᵗ",
  outputLanguage: "EN", // EN 或 CN
  corsHeaders: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }
};

// 国家和地区与标识符的映射
function getCountryNames(outputLanguage) {
  return {
    "美国|美國|US|洛杉矶|洛杉磯|西雅图|纽约|芝加哥|Atlanta|States|American|Los Angeles|Seattle|New York|Chicago": outputLanguage === "EN" ? "🇺🇸US" : "🇺🇸美国",
    "港|香港|HK|Hong Kong": outputLanguage === "EN" ? "🇭🇰HK" : "🇭🇰香港",
    "新加坡|狮城|SG|Singapore": outputLanguage === "EN" ? "🇸🇬SG" : "🇸🇬新加坡",
    "台|台湾|台北|高雄|TW|Taiwan|Taipei|Kaohsiung": outputLanguage === "EN" ? "🇨🇳TW" : "🇨🇳台湾",
    "日|东京|大阪|名古屋|JP|Tokyo|Japan|Osaka|Nagoya": outputLanguage === "EN" ? "🇯🇵JP" : "🇯🇵日本",
    "韩国|首尔|釜山|KR|Korea|Seoul|Busan": outputLanguage === "EN" ? "🇰🇷KR" : "🇰🇷韩国",
    "土耳其|伊斯坦布尔|安卡拉|TR|Turkey|Istanbul|Ankara": outputLanguage === "EN" ? "🇹🇷TR" : "🇹🇷土耳其",
    "爱尔兰|都柏林|IE|Ireland|Dublin": outputLanguage === "EN" ? "🇮🇪IRL" : "🇮🇪爱尔兰",
    "澳|悉尼|墨尔本|布里斯班|AU|Australia|Sydney|Melbourne|Brisbane": outputLanguage === "EN" ? "🇦🇺AU" : "🇦🇺澳大利亚",
    "法国|巴黎|里昂|马赛|FR|France|Paris|Lyon|Marseille": outputLanguage === "EN" ? "🇫🇷FRA" : "🇫🇷法国",
    "瑞典|斯德哥尔摩|哥德堡|SE|Sweden|Stockholm|Gothenburg": outputLanguage === "EN" ? "🇸🇪SE" : "🇸🇪瑞典",
    "德国|法兰克福|柏林|慕尼黑|DE|Germany|Frankfurt|Berlin|Munich": outputLanguage === "EN" ? "🇩🇪DE" : "🇩🇪德国",
    "英国|伦敦|曼彻斯特|伯明翰|GB|UK|United Kingdom|London|Manchester|Birmingham": outputLanguage === "EN" ? "🇬🇧GB" : "🇬🇧英国",
    "印度|孟买|德里|班加罗尔|IN|India|Mumbai|Delhi|Bangalore": outputLanguage === "EN" ? "🇮🇳IN" : "🇮🇳印度",
    "加拿大|多伦多|温哥华|蒙特利尔|CA|Canada|Toronto|Vancouver|Montreal": outputLanguage === "EN" ? "🇨🇦CA" : "🇨🇦加拿大",
    "西班牙|马德里|巴塞罗那|ES|Spain|Madrid|Barcelona": outputLanguage === "EN" ? "🇪🇸ES" : "🇪🇸西班牙",
    "意大利|罗马|米兰|那不勒斯|IT|Italy|Rome|Milan|Naples": outputLanguage === "EN" ? "🇮🇹IT" : "🇮🇹意大利",
    "荷兰|阿姆斯特丹|鹿特丹|NL|Netherlands|Amsterdam|Rotterdam": outputLanguage === "EN" ? "🇳🇱NL" : "🇳🇱荷兰",
    "瑞士|苏黎世|日内瓦|CH|Switzerland|Zurich|Geneva": outputLanguage === "EN" ? "🇨🇭CH" : "🇨🇭瑞士",
    "俄罗斯|莫斯科|圣彼得堡|RU|Russia|Moscow|Saint Petersburg": outputLanguage === "EN" ? "🇷🇺RU" : "🇷🇺俄罗斯",
    "巴西|圣保罗|里约热内卢|BR|Brazil|São Paulo|Rio de Janeiro": outputLanguage === "EN" ? "🇧🇷BR" : "🇧🇷巴西",
    "南非|约翰内斯堡|开普敦|ZA|South Africa|Johannesburg|Cape Town": outputLanguage === "EN" ? "🇿🇦ZA" : "🇿🇦南非",
    "墨西哥|墨西哥城|瓜达拉哈拉|MX|Mexico|Mexico City|Guadalajara": outputLanguage === "EN" ? "🇲🇽MX" : "🇲🇽墨西哥",
    "阿根廷|布宜诺斯艾利斯|AR|Argentina|Buenos Aires": outputLanguage === "EN" ? "🇦🇷AR" : "🇦🇷阿根廷",
    "波兰|华沙|克拉科夫|PL|Poland|Warsaw|Krakow": outputLanguage === "EN" ? "🇵🇱PL" : "🇵🇱波兰",
    "泰国|曼谷|清迈|TH|Thailand|Bangkok|Chiang Mai": outputLanguage === "EN" ? "🇹🇭TH" : "🇹🇭泰国",
    "马来西亚|吉隆坡|槟城|MY|Malaysia|Kuala Lumpur|Penang": outputLanguage === "EN" ? "🇲🇾MY" : "🇲🇾马来西亚",
    "越南|河内|胡志明|VN|Vietnam|Hanoi|Ho Chi Minh": outputLanguage === "EN" ? "🇻🇳VN" : "🇻🇳越南",
    "菲律宾|马尼拉|PH|Philippines|Manila": outputLanguage === "EN" ? "🇵🇭PH" : "🇵🇭菲律宾",
    "埃及|开罗|EG|Egypt|Cairo": outputLanguage === "EN" ? "🇪🇬EG" : "🇪🇬埃及",
    "沙特|利雅得|吉达|SA|Saudi Arabia|Riyadh|Jeddah": outputLanguage === "EN" ? "🇸🇦SA" : "🇸🇦沙特阿拉伯",
    "阿联酋|迪拜|阿布扎比|AE|UAE|Dubai|Abu Dhabi": outputLanguage === "EN" ? "🇦🇪AE" : "🇦🇪阿联酋",
    "挪威|奥斯陆|NO|Norway|Oslo": outputLanguage === "EN" ? "🇳🇴NO" : "🇳🇴挪威",
    "芬兰|赫尔辛基|FI|Finland|Helsinki": outputLanguage === "EN" ? "🇫🇮FI" : "🇫🇮芬兰",
    "奥地利|维也纳|AT|Austria|Vienna": outputLanguage === "EN" ? "🇦🇹AT" : "🇦🇹奥地利",
    "希腊|雅典|GR|Greece|Athens": outputLanguage === "EN" ? "🇬🇷GR" : "🇬🇷希腊",
    "匈牙利|布达佩斯|HU|Hungary|Budapest": outputLanguage === "EN" ? "🇭🇺HU" : "🇭🇺匈牙利",
    "捷克|布拉格|CZ|Czech|Prague": outputLanguage === "EN" ? "🇨🇿CZ" : "🇨🇿捷克",
    "新西兰|奥克兰|NZ|New Zealand|Auckland": outputLanguage === "EN" ? "🇳🇿NZ" : "🇳🇿新西兰",
    "尼泊尔|加德满都|NP|Nepal|Kathmandu": outputLanguage === "EN" ? "🇳🇵NP" : "🇳🇵尼泊尔",
    "葡萄牙|里斯本|PT|Portugal|Lisbon": outputLanguage === "EN" ? "🇵🇹PT" : "🇵🇹葡萄牙",
    "巴基斯坦|伊斯兰堡|PK|Pakistan|Islamabad": outputLanguage === "EN" ? "🇵🇰PK" : "🇵🇰巴基斯坦",
    "伊朗|德黑兰|IR|Iran|Tehran": outputLanguage === "EN" ? "🇮🇷IR" : "🇮🇷伊朗",
    "伊拉克|巴格达|IQ|Iraq|Baghdad": outputLanguage === "EN" ? "🇮🇶IQ" : "🇮🇶伊拉克",
    "阿尔及利亚|阿尔及尔|DZ|Algeria|Algiers": outputLanguage === "EN" ? "🇩🇿DZ" : "🇩🇿阿尔及利亚",
    "摩洛哥|拉巴特|MA|Morocco|Rabat": outputLanguage === "EN" ? "🇲🇦MA" : "🇲🇦摩洛哥",
    "尼日利亚|拉各斯|NG|Nigeria|Lagos": outputLanguage === "EN" ? "🇳🇬NG" : "🇳🇬尼日利亚",
    "智利|圣地亚哥|CL|Chile|Santiago": outputLanguage === "EN" ? "🇨🇱CL" : "🇨🇱智利",
    "秘鲁|利马|PE|Peru|Lima": outputLanguage === "EN" ? "🇵🇪PE" : "🇵🇪秘鲁",
    "哥伦比亚|波哥大|CO|Colombia|Bogotá": outputLanguage === "EN" ? "🇨🇴CO" : "🇨🇴哥伦比亚",
    "罗马尼亚|Romania|RO|Bucharest|Cluj-Napoca|Timișoara": outputLanguage === "EN" ? "🇷🇴RO" : "🇷🇴罗马尼亚",
    "塞尔维亚|Serbia|RS|Belgrade|Novi Sad|Niš": outputLanguage === "EN" ? "🇷🇸RS" : "🇷🇸塞尔维亚",
    "立陶宛|Lithuania|LT|Vilnius|Kaunas|Klaipėda": outputLanguage === "EN" ? "🇱🇹LT" : "🇱🇹立陶宛",
    "危地马拉|Guatemala|GT|Guatemala City|Antigua Guatemala|Quetzaltenango": outputLanguage === "EN" ? "🇬🇹GT" : "🇬🇹危地马拉",
    "丹麦|Denmark|DK|Copenhagen|Aarhus|Odense": outputLanguage === "EN" ? "🇩🇰DK" : "🇩🇰丹麦",
    "乌克兰|Ukraine|UA|Kyiv|Lviv|Odesa": outputLanguage === "EN" ? "🇺🇦UA" : "🇺🇦乌克兰",
    "以色列|Israel|IL|Jerusalem|Tel Aviv|Haifa": outputLanguage === "EN" ? "🇮🇱IL" : "🇮🇱以色列",
    "厄瓜多尔|Ecuador|EC|Quito|Guayaquil|Cuenca": outputLanguage === "EN" ? "🇪🇨EC" : "🇪🇨厄瓜多尔",
    "哥斯达黎加|Costa Rica|CR|San José|Alajuela|Cartago": outputLanguage === "EN" ? "🇨🇷CR" : "🇨🇷哥斯达黎加",
    "塞浦路斯|Cyprus|CY|Nicosia|Limassol|Larnaca": outputLanguage === "EN" ? "🇨🇾CY" : "🇨🇾塞浦路斯",
    "比利时|Belgium|BE|Brussels|Antwerp|Ghent": outputLanguage === "EN" ? "🇧🇪BE" : "🇧🇪比利时",
    "玻利维亚|Bolivia|BO|Sucre|La Paz|Santa Cruz": outputLanguage === "EN" ? "🇧🇴BO" : "🇧🇴玻利维亚"
  };
}

// 过滤关键词
const FILTER_KEYWORDS = [
  "广告", "过期", "无效", "测试", "备用", "官网", "账号", "有效期", "群",
  "到期", "刷新", "剩余", "电报", "会员", "解锁", "流量", "超时",
  "订阅", "佣金", "免翻", "节点", "下载", "更新", "点外", "重置",
  "免流", "Days", "Date", "Expire", "Premium", "建议", "免费",
  "套餐", "到期", "有效", "剩余", "版本", "已用", "过期", "失联",
  "测试", "官方", "网址", "备用", "群", "TEST", "客服", "网站",
  "获取", "订阅", "流量", "机场", "下次", "官址", "联系", "邮箱",
  "工单", "学术", "USE", "USED", "TOTAL", "EXPIRE", "EMAIL"
];

// 保留关键词映射
const PRESERVE_KEYWORDS = {
  "ChatGPT": "GPT",
  "Netflix": "NF",
  "Disney": "Disney"
};

// 节点名称处理函数
function processNodeName(originalName, config) {
  const { customCharStart, customCharEnd, outputLanguage } = config;
  const keywordsToNames = getCountryNames(outputLanguage);
  
  // 检查是否包含过滤关键词
  if (FILTER_KEYWORDS.some(kw => new RegExp(kw, 'i').test(originalName))) {
    return null; // 返回null表示过滤掉该节点
  }

  let preservedParts = [];
  let newTitle = originalName;

  // 提取并移除保留的关键词部分
  for (const [keyword, replacement] of Object.entries(PRESERVE_KEYWORDS)) {
    const match = newTitle.match(new RegExp(keyword, 'i'));
    if (match) {
      preservedParts.push(replacement);
      newTitle = newTitle.replace(match[0], '');
    }
  }

  // 匹配地区关键词并替换
  for (const [keyword, name] of Object.entries(keywordsToNames)) {
    if (new RegExp(keyword, 'i').test(newTitle)) {
      newTitle = name;
      break;
    }
  }

  // 添加前缀
  if (customCharStart) {
    newTitle = customCharStart + newTitle;
  }

  // 添加后缀
  if (customCharEnd) {
    newTitle += customCharEnd;
  }

  // 添加保留的部分
  if (preservedParts.length > 0) {
    newTitle += ' ' + preservedParts.join(' ');
  }

  return newTitle;
}

// 确保节点名称唯一
function ensureUniqueName(name, usedNames) {
  let uniqueName = name;
  let counter = 1;
  
  while (usedNames.has(uniqueName)) {
    uniqueName = `${name}-${counter}`;
    counter++;
  }
  
  usedNames.add(uniqueName);
  return uniqueName;
}

// 处理订阅内容
function processSubscription(content, config) {
  const lines = content.split('\n');
  const processedLines = [];
  const usedNames = new Set();
  
  for (const line of lines) {
    if (line.trim() === '' || line.startsWith('#')) {
      processedLines.push(line);
      continue;
    }
    
    // 解析节点信息（这里简化处理，实际需要根据具体协议解析）
    let nodeName = '';
    let nodeConfig = line;
    
    // 尝试提取节点名称（适用于多种协议格式）
    const nameMatch = line.match(/(?:name=|#)([^,\s&]+)/);
    if (nameMatch) {
      nodeName = decodeURIComponent(nameMatch[1]);
    }
    
    if (nodeName) {
      const processedName = processNodeName(nodeName, config);
      
      if (processedName) {
        const uniqueName = ensureUniqueName(processedName, usedNames);
        // 替换原始名称
        nodeConfig = line.replace(nameMatch[0], nameMatch[0].replace(nameMatch[1], encodeURIComponent(uniqueName)));
        processedLines.push(nodeConfig);
      }
      // 如果processedName为null，则过滤掉该行
    } else {
      processedLines.push(line);
    }
  }
  
  return processedLines.join('\n');
}

// 处理HTTP请求
async function handleRequest(request) {
  // 处理CORS预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: DEFAULT_CONFIG.corsHeaders
    });
  }

  const url = new URL(request.url);
  const subscriptionUrl = url.searchParams.get('url');
  const language = url.searchParams.get('lang') || DEFAULT_CONFIG.outputLanguage;
  const prefix = url.searchParams.get('prefix') || DEFAULT_CONFIG.customCharStart;
  const suffix = url.searchParams.get('suffix') || DEFAULT_CONFIG.customCharEnd;

  // 检查必要参数
  if (!subscriptionUrl) {
    return new Response(JSON.stringify({
      error: '缺少必要参数: url',
      usage: '用法: /?url=订阅链接&lang=EN/CN&prefix=前缀&suffix=后缀'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...DEFAULT_CONFIG.corsHeaders
      }
    });
  }

  try {
    // 获取原始订阅内容
    const response = await fetch(subscriptionUrl, {
      headers: {
        'User-Agent': 'ClashforWindows/0.18.1'
      }
    });

    if (!response.ok) {
      throw new Error(`获取订阅失败: ${response.status} ${response.statusText}`);
    }

    let content = await response.text();
    
    // 如果是base64编码，先解码
    try {
      content = atob(content);
    } catch (e) {
      // 如果解码失败，说明不是base64编码的内容，直接使用
    }

    // 处理配置
    const config = {
      customCharStart: prefix,
      customCharEnd: suffix,
      outputLanguage: language.toUpperCase()
    };

    // 处理订阅内容
    const processedContent = processSubscription(content, config);

    // 返回处理后的内容（base64编码）
    const encodedContent = btoa(processedContent);
    
    return new Response(encodedContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        ...DEFAULT_CONFIG.corsHeaders
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: `处理失败: ${error.message}`
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...DEFAULT_CONFIG.corsHeaders
      }
    });
  }
}

// 主要事件监听器
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
