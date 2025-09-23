/*
# @ScriptName 订阅节点名称过滤器 Cloudflare Workers - 纯API版
# @Author hafrey
# @UpdateTime 2025/09/22
# @Function 自动识别并处理多种订阅格式，为节点添加地区标识符，支持动态参数配置
# @Deploy Cloudflare Workers
# @Features 纯API模式，无GUI界面
*/

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
  });
  
  async function handleRequest(request) {
    try {
      const url = new URL(request.url);
      const lang = url.searchParams.get('lang') || 'EN';
      const customPrefix = url.searchParams.get('prefix') || '➥';
      const customSuffix = url.searchParams.get('suffix') || 'ᵐᵗ';
      const originalUrl = url.searchParams.get('url');
  
      // 无 url 参数，返回 API 说明
      if (!originalUrl) {
        return new Response(JSON.stringify({
          name: "订阅节点名称过滤器 API",
          version: "2.0",
          author: "hafrey",
          description: "自动识别并处理多种订阅格式，为节点添加地区标识符",
          usage: {
            endpoint: new URL(request.url).origin,
            method: "GET",
            parameters: {
              url: "[必需] 原始订阅链接",
              lang: "[可选] 语言，EN(默认)|CN",
              prefix: "[可选] 节点名前缀，默认: ➥",
              suffix: "[可选] 节点名后缀，默认: ᵐᵗ"
            },
            example: `${new URL(request.url).origin}/?url=https://example.com/sub&lang=CN&prefix=[My]&suffix=-AUTO`
          },
          supported_formats: [
            "Sing-box (JSON)",
            "Clash/Clash Meta (YAML)",
            "Base64 订阅",
            "通用文本订阅"
          ]
        }, null, 2), {
          headers: { 
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        });
      }
  
      // 读取原始订阅
      const response = await fetch(originalUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch subscription: ${response.status}`);
      }
      const contentType = response.headers.get('Content-Type') || '';
      const originalContent = await response.text();
  
      // 处理订阅内容
      const processedContent = await processSubscription(
        originalContent,
        contentType,
        lang,
        customPrefix,
        customSuffix
      );
  
      // 返回时尽量保留原 Content-Type
      return new Response(processedContent, {
        headers: {
          'Content-Type': contentType || 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: true,
        message: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
  
  async function processSubscription(content, contentType, lang, customPrefix, customSuffix) {
    if (contentType.includes('application/json') || isJSON(content)) {
      return processSingboxSubscription(content, lang, customPrefix, customSuffix);
    } else if (contentType.includes('yaml') || contentType.includes('yml') || isYAML(content)) {
      return processClashSubscription(content, lang, customPrefix, customSuffix);
    } else if (isBase64(content)) {
      return processBase64Subscription(content, lang, customPrefix, customSuffix);
    } else {
      return processAdaptiveSubscription(content, lang, customPrefix, customSuffix);
    }
  }
  
  // Sing-box (JSON)
  function processSingboxSubscription(content, lang, customPrefix, customSuffix) {
    try {
      const config = JSON.parse(content);
      if (config.outbounds && Array.isArray(config.outbounds)) {
        config.outbounds = config.outbounds.map(outbound => {
          if (outbound && outbound.tag && outbound.tag !== 'direct' && outbound.tag !== 'block') {
            const name = processNodeName(outbound.tag, lang, customPrefix, customSuffix);
            if (name) outbound.tag = name;
          }
          return outbound;
        });
      }
      return JSON.stringify(config, null, 2);
    } catch (e) {
      console.error('Error processing Sing-box:', e);
      return content;
    }
  }
  
  // Clash / Clash Meta (YAML 粗略处理 name 字段)
  function processClashSubscription(content, lang, customPrefix, customSuffix) {
    try {
      const lines = content.split('\n');
      const processed = lines.map(line => {
        // 匹配 "name: ..."，宽松处理单双引号与空格
        if (line.trim().match(/^-?\s*name:\s*['"]?.+['"]?\s*$/)) {
          const match = line.match(/^(\s*-?\s*name:\s*['"]?)(.+?)(['"]?\s*)$/);
          if (match) {
            const name = processNodeName(match[2], lang, customPrefix, customSuffix);
            if (name) return match[1] + name + match[3];
          }
        }
        return line;
      });
      return processed.join('\n');
    } catch (e) {
      console.error('Error processing Clash:', e);
      return content;
    }
  }
  
  // Base64 订阅文本（每行一个链接，#后为名称）
  function processBase64Subscription(content, lang, customPrefix, customSuffix) {
    try {
      const decoded = atob(content.trim());
      const lines = decoded.split('\n').filter(Boolean);
      const processed = lines.map(line => {
        const parts = line.split('#');
        if (parts.length > 1) {
          const originalName = safeDecodeURIComponent(parts[parts.length - 1]);
          const name = processNodeName(originalName, lang, customPrefix, customSuffix);
          if (name) {
            parts[parts.length - 1] = encodeURIComponent(name);
            return parts.join('#');
          }
        }
        return line;
      });
      return btoa(processed.join('\n'));
    } catch (e) {
      console.error('Error processing Base64:', e);
      return content;
    }
  }
  
  // 自适应（纯文本每行带 #name 的，也尝试处理）
  function processAdaptiveSubscription(content, lang, customPrefix, customSuffix) {
    try {
      if (isJSON(content)) return processSingboxSubscription(content, lang, customPrefix, customSuffix);
      if (isYAML(content)) return processClashSubscription(content, lang, customPrefix, customSuffix);
      if (isBase64(content)) return processBase64Subscription(content, lang, customPrefix, customSuffix);
  
      const lines = content.split('\n');
      const processed = lines.map(line => {
        if (line.includes('#')) {
          const parts = line.split('#');
          if (parts.length > 1) {
            const originalName = safeDecodeURIComponent(parts[parts.length - 1]);
            const name = processNodeName(originalName, lang, customPrefix, customSuffix);
            if (name) {
              parts[parts.length - 1] = encodeURIComponent(name);
              return parts.join('#');
            }
          }
        }
        return line;
      });
      return processed.join('\n');
    } catch (e) {
      console.error('Error processing adaptive:', e);
      return content;
    }
  }
  
  // 名称处理
  function processNodeName(originalName, lang, customPrefix, customSuffix) {
    const keywordsToNames = getKeywordsToNames(lang);
  
    // 过滤无效关键词
    const filterKeywords = [
      "广告", "过期", "无效", "测试", "备用", "官网", "账号", "群组", "工单", "到期", "刷新", "剩余", "电报", "会员", "解锁", "流量", "超时", "免流", 
      "订阅", "佣金", "免翻", "节点", "下载", "更新", "点外", "重置", "建议", "免费", "套餐", "到期", "有效", "剩余", "版本", "已用", "过期", "失联", 
      "测试", "官方", "网址", "备用", "群组", "客服", "网站", "获取", "订阅", "流量", "机场", "下次", "官址", "联系", "邮箱", "学术",
      "有效期", "Days", "Date", "Expire", "Premium", "USE", "USED", "TOTAL", "EXPIRE", "EMAIL", "TEST", 
    ];
    if (filterKeywords.some(kw => new RegExp(kw, 'i').test(originalName))) return null;
  
    // 保留关键词（压缩）
    const keepMap = { 'ChatGPT': 'GPT', 'OpenAI': 'AI' };
    let preserved = [];
    let work = originalName;
  
    for (const k in keepMap) {
      const m = work.match(new RegExp(k, 'i'));
      if (m) {
        preserved.push(keepMap[k]);
        work = work.replace(m[0], '');
      }
    }
  
    // 地区匹配
    let matched = false;
    for (const key in keywordsToNames) {
      if (new RegExp(key, 'i').test(work)) {
        work = keywordsToNames[key];
        matched = true;
        break;
      }
    }
    if (!matched) {
      work = originalName.replace(/[^\w\s\-\u4e00-\u9fa5]/g, '').trim();
    }
  
    // 前后缀与去重
    let title = customPrefix + work;
    const counter = globalThis.__nodeCounter || (globalThis.__nodeCounter = {});
    if (!counter[title]) counter[title] = 1;
    else title = `${title}-${++counter[title]}`;
    title += customSuffix;
    if (preserved.length) title += ' ' + preserved.join(' ');
    return title;
  }
  
  function getKeywordsToNames(lang) {
    const L = (lang || '').toUpperCase();
    return {
      '美国|美國|US|洛杉矶|洛杉磯|西雅图|纽约|芝加哥|Atlanta|States|American|Los Angeles|Seattle|New York|Chicago': L === 'CN' ? '🇺🇸美国' : '🇺🇸US',
      '港|香港|HK|Hong Kong': L === 'CN' ? '🇭🇰香港' : '🇭🇰HK',
      '新加坡|狮城|SG|Singapore': L === 'CN' ? '🇸🇬新加坡' : '🇸🇬SG',
      '台|台湾|台北|高雄|TW|Taiwan|Taipei|Kaohsiung': L === 'CN' ? '🇨🇳台湾' : '🇨🇳TW',
      '日|东京|大阪|名古屋|JP|Tokyo|Japan|Osaka|Nagoya': L === 'CN' ? '🇯🇵日本' : '🇯🇵JP',
      '韩国|首尔|釜山|KR|Korea|Seoul|Busan': L === 'CN' ? '🇰🇷韩国' : '🇰🇷KR',
      '土耳其|伊斯坦布尔|安卡拉|TR|Turkey|Istanbul|Ankara': L === 'CN' ? '🇹🇷土耳其' : '🇹🇷TR',
      '爱尔兰|都柏林|IE|Ireland|Dublin': L === 'CN' ? '🇮🇪爱尔兰' : '🇮🇪IRL',
      '澳|悉尼|墨尔本|布里斯班|AU|Australia|Sydney|Melbourne|Brisbane': L === 'CN' ? '🇦🇺澳大利亚' : '🇦🇺AU',
      '法国|巴黎|里昂|马赛|FR|France|Paris|Lyon|Marseille': L === 'CN' ? '🇫🇷法国' : '🇫🇷FRA',
      '瑞典|斯德哥尔摩|哥德堡|SE|Sweden|Stockholm|Gothenburg': L === 'CN' ? '🇸🇪瑞典' : '🇸🇪SE',
      '德国|法兰克福|柏林|慕尼黑|DE|Germany|Frankfurt|Berlin|Munich': L === 'CN' ? '🇩🇪德国' : '🇩🇪DE',
      '英国|伦敦|曼彻斯特|伯明翰|GB|UK|United Kingdom|London|Manchester|Birmingham': L === 'CN' ? '🇬🇧英国' : '🇬🇧GB',
      '印度|孟买|德里|班加罗尔|IN|India|Mumbai|Delhi|Bangalore': L === 'CN' ? '🇮🇳印度' : '🇮🇳IN',
      '加拿大|多伦多|温哥华|蒙特利尔|CA|Canada|Toronto|Vancouver|Montreal': L === 'CN' ? '🇨🇦加拿大' : '🇨🇦CA',
      '西班牙|马德里|巴塞罗那|ES|Spain|Madrid|Barcelona': L === 'CN' ? '🇪🇸西班牙' : '🇪🇸ES',
      '意大利|罗马|米兰|那不勒斯|IT|Italy|Rome|Milan|Naples': L === 'CN' ? '🇮🇹意大利' : '🇮🇹IT',
      '荷兰|阿姆斯特丹|鹿特丹|NL|Netherlands|Amsterdam|Rotterdam': L === 'CN' ? '🇳🇱荷兰' : '🇳🇱NL',
      '瑞士|苏黎世|日内瓦|CH|Switzerland|Zurich|Geneva': L === 'CN' ? '🇨🇭瑞士' : '🇨🇭CH',
      '俄罗斯|莫斯科|圣彼得堡|RU|Russia|Moscow|Saint Petersburg': L === 'CN' ? '🇷🇺俄罗斯' : '🇷🇺RU',
      '巴西|圣保罗|里约热内卢|BR|Brazil|São Paulo|Rio de Janeiro': L === 'CN' ? '🇧🇷巴西' : '🇧🇷BR',
      '南非|约翰内斯堡|开普敦|ZA|South Africa|Johannesburg|Cape Town': L === 'CN' ? '🇿🇦南非' : '🇿🇦ZA',
      '墨西哥|墨西哥城|瓜达拉哈拉|MX|Mexico|Mexico City|Guadalajara': L === 'CN' ? '🇲🇽墨西哥' : '🇲🇽MX',
      '阿根廷|布宜诺斯艾利斯|AR|Argentina|Buenos Aires': L === 'CN' ? '🇦🇷阿根廷' : '🇦🇷AR',
      '波兰|华沙|克拉科夫|PL|Poland|Warsaw|Krakow': L === 'CN' ? '🇵🇱波兰' : '🇵🇱PL',
      '泰国|曼谷|清迈|TH|Thailand|Bangkok|Chiang Mai': L === 'CN' ? '🇹🇭泰国' : '🇹🇭TH',
      '马来西亚|吉隆坡|槟城|MY|Malaysia|Kuala Lumpur|Penang': L === 'CN' ? '🇲🇾马来西亚' : '🇲🇾MY',
      '越南|河内|胡志明|VN|Vietnam|Hanoi|Ho Chi Minh': L === 'CN' ? '🇻🇳越南' : '🇻🇳VN',
      '菲律宾|马尼拉|PH|Philippines|Manila': L === 'CN' ? '🇵🇭菲律宾' : '🇵🇭PH',
      '埃及|开罗|EG|Egypt|Cairo': L === 'CN' ? '🇪🇬埃及' : '🇪🇬EG',
      '沙特|利雅得|吉达|SA|Saudi Arabia|Riyadh|Jeddah': L === 'CN' ? '🇸🇦沙特阿拉伯' : '🇸🇦SA',
      '阿联酋|迪拜|阿布扎比|AE|UAE|Dubai|Abu Dhabi': L === 'CN' ? '🇦🇪阿联酋' : '🇦🇪AE',
      '挪威|奥斯陆|NO|Norway|Oslo': L === 'CN' ? '🇳🇴挪威' : '🇳🇴NO',
      '芬兰|赫尔辛基|FI|Finland|Helsinki': L === 'CN' ? '🇫🇮芬兰' : '🇫🇮FI',
      '奥地利|维也纳|AT|Austria|Vienna': L === 'CN' ? '🇦🇹奥地利' : '🇦🇹AT',
      '希腊|雅典|GR|Greece|Athens': L === 'CN' ? '🇬🇷希腊' : '🇬🇷GR',
      '匈牙利|布达佩斯|HU|Hungary|Budapest': L === 'CN' ? '🇭🇺匈牙利' : '🇭🇺HU',
      '捷克|布拉格|CZ|Czech|Prague': L === 'CN' ? '🇨🇿捷克' : '🇨🇿CZ',
      '新西兰|奥克兰|NZ|New Zealand|Auckland': L === 'CN' ? '🇳🇿新西兰' : '🇳🇿NZ',
      '尼泊尔|加德满都|NP|Nepal|Kathmandu': L === 'CN' ? '🇳🇵尼泊尔' : '🇳🇵NP',
      '葡萄牙|里斯本|PT|Portugal|Lisbon': L === 'CN' ? '🇵🇹葡萄牙' : '🇵🇹PT',
      '巴基斯坦|伊斯兰堡|PK|Pakistan|Islamabad': L === 'CN' ? '🇵🇰巴基斯坦' : '🇵🇰PK',
      '伊朗|德黑兰|IR|Iran|Tehran': L === 'CN' ? '🇮🇷伊朗' : '🇮🇷IR',
      '伊拉克|巴格达|IQ|Iraq|Baghdad': L === 'CN' ? '🇮🇶伊拉克' : '🇮🇶IQ',
      '阿尔及利亚|阿尔及尔|DZ|Algeria|Algiers': L === 'CN' ? '🇩🇿阿尔及利亚' : '🇩🇿DZ',
      '摩洛哥|拉巴特|MA|Morocco|Rabat': L === 'CN' ? '🇲🇦摩洛哥' : '🇲🇦MA',
      '尼日利亚|拉各斯|NG|Nigeria|Lagos': L === 'CN' ? '🇳🇬尼日利亚' : '🇳🇬NG',
      '智利|圣地亚哥|CL|Chile|Santiago': L === 'CN' ? '🇨🇱智利' : '🇨🇱CL',
      '秘鲁|利马|PE|Peru|Lima': L === 'CN' ? '🇵🇪秘鲁' : '🇵🇪PE',
      '哥伦比亚|波哥大|CO|Colombia|Bogotá': L === 'CN' ? '🇨🇴哥伦比亚' : '🇨🇴CO',
      '罗马尼亚|Romania|RO|Bucharest|Cluj-Napoca|Timișoara': L === 'CN' ? '🇷🇴罗马尼亚' : '🇷🇴RO',
      '塞尔维亚|Serbia|RS|Belgrade|Novi Sad|Niš': L === 'CN' ? '🇷🇸塞尔维亚' : '🇷🇸RS',
      '立陶宛|Lithuania|LT|Vilnius|Kaunas|Klaipėda': L === 'CN' ? '🇱🇹立陶宛' : '🇱🇹LT',
      '危地马拉|Guatemala|GT|Guatemala City|Antigua Guatemala|Quetzaltenango': L === 'CN' ? '🇬🇹危地马拉' : '🇬🇹GT',
      '丹麦|Denmark|DK|Copenhagen|Aarhus|Odense': L === 'CN' ? '🇩🇰丹麦' : '🇩🇰DK',
      '乌克兰|Ukraine|UA|Kyiv|Lviv|Odesa': L === 'CN' ? '🇺🇦乌克兰' : '🇺🇦UA',
      '以色列|Israel|IL|Jerusalem|Tel Aviv|Haifa': L === 'CN' ? '🇮🇱以色列' : '🇮🇱IL',
      '厄瓜多尔|Ecuador|EC|Quito|Guayaquil|Cuenca': L === 'CN' ? '🇪🇨厄瓜多尔' : '🇪🇨EC',
      '哥斯达黎加|Costa Rica|CR|San José|Alajuela|Cartago': L === 'CN' ? '🇨🇷哥斯达黎加' : '🇨🇷CR',
      '塞浦路斯|Cyprus|CY|Nicosia|Limassol|Larnaca': L === 'CN' ? '🇨🇾塞浦路斯' : '🇨🇾CY',
      '比利时|Belgium|BE|Brussels|Antwerp|Ghent': L === 'CN' ? '🇧🇪比利时' : '🇧🇪BE',
      '玻利维亚|Bolivia|BO|Sucre|La Paz|Santa Cruz': L === 'CN' ? '🇧🇴玻利维亚' : '🇧🇴BO'
    };
  }
  
  /* ===================== 工具函数 ===================== */
  function s(v) { return v == null ? '' : String(v); }
  function parseCSV(s) { return (s || '').split(',').map(x => x.trim()).filter(Boolean); }
  function escapeReg(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function isJSON(str) { try { JSON.parse(str); return true; } catch { return false; } }
  function isYAML(str) {
    return str.includes('proxies:') || str.includes('proxy-groups:') || str.includes('rules:');
  }
  function isBase64(str) { try { return btoa(atob(str)) === str; } catch { return false; } }
  function safeDecodeURIComponent(s) { try { return decodeURIComponent(s); } catch { return s; } }
  
