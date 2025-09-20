/**
 * _worker.js
 * 完整版 — 订阅节点名称过滤器（支持 Base64 / Clash-meta / Sing-box / 多协议）
 * Author: 整合并增强自定义需求
 * Update: 2025-09-20
 *
 * URL 参数
 *  - url: 必填，原始订阅地址（可以是文本 / base64 / json / clash-meta / sing-box）
 *  - lang: 可选，CN 或 EN（默认 EN）
 *  - prefix: 可选，自定义前缀（默认 "➥"）
 *  - suffix: 可选，自定义后缀（默认 "ᵐᵗ"）
 *
 * 功能要点：
 *  - URL-safe Base64 兼容（-/_ => +/，补齐 =），并完整 encode/decode
 *  - 支持以下协议与格式：vmess/vless/ss/trojan/clash-meta JSON/sing-box 风格 JSON 以及常见的单行 base64 节点
 *  - 自动为节点名称加入国家/地区标识（中英文切换）
 *  - 支持自定义前后缀、过滤无效关键词、保留并替换关键字、保证节点名称唯一
 *  - 支持通过 URL 参数动态切换语言/前缀/后缀
 */

// -------- Worker 入口 ----------
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  try {
    const url = new URL(request.url);
    const params = url.searchParams;

    const rawUrl = params.get('url');
    if (!rawUrl) return new Response('Missing "url" parameter', { status: 400 });

    const outputLanguage = (params.get('lang') || 'EN').toUpperCase() === 'CN' ? 'CN' : 'EN';
    const customPrefix = params.get('prefix') ?? '➥';
    const customSuffix = params.get('suffix') ?? 'ᵐᵗ';
    const keepQuery = params.get('keep_query') === '1'; // optional: 是否在 fetch 原始 url 时保留原 query

    // fetch 订阅内容
    const fetchOptions = { method: 'GET', redirect: 'follow' };
    let fetched;
    try {
      // 如果用户想要保留 query 参数，则直接把原 url 作为字符串传给 fetch
      fetched = await fetch(rawUrl, fetchOptions);
    } catch (e) {
      return new Response(`Fetch subscription failed: ${e.message}`, { status: 502 });
    }
    const contentType = fetched.headers.get('content-type') || '';
    let text = await fetched.text();

    // 判断类型并处理
    // 先去除 BOM
    text = text.replace(/^\uFEFF/, '');

    // 判断是否为单行协议列表 (vmess://... 或 vmess://<base64>...)
    const trimmed = text.trim();

    let output;
    let responseContentType = 'text/plain; charset=utf-8';

    // 如果是纯 JSON（Clash / Sing-box）
    if (looksLikeJson(trimmed)) {
      let json;
      try {
        json = JSON.parse(trimmed);
      } catch (e) {
        // 解析失败则继续下面逻辑（可能是整体被 base64 编码）
        json = null;
      }
      if (json) {
        json = processJsonSubscription(json, { prefix: customPrefix, suffix: customSuffix, lang: outputLanguage });
        output = JSON.stringify(json, null, 2);
        responseContentType = contentType.includes('json') ? contentType : 'application/json; charset=utf-8';
        return new Response(output, { headers: { 'Content-Type': responseContentType } });
      }
    }

    // 如果看起来整体是 base64 编码（长串以 a-zA-Z0-9-_+=），尝试解 base64
    if (isProbablyBase64Only(trimmed)) {
      const decoded = safeBase64Decode(trimmed);
      if (decoded !== null) {
        // decoded 可能是 JSON 或 vmess 列表或纯文本
        const inner = decoded.trim();
        if (looksLikeJson(inner)) {
          try {
            let json = JSON.parse(inner);
            json = processJsonSubscription(json, { prefix: customPrefix, suffix: customSuffix, lang: outputLanguage });
            output = JSON.stringify(json, null, 2);
            // 对于 base64 包裹的订阅，我们通常需要重新 base64 编码回去（保留原格式）
            const reEncoded = safeBase64Encode(output);
            return new Response(reEncoded, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
          } catch (e) {
            // 不是 json，继续作为文本处理
          }
        }
        // 当作文本节点列表继续处理
        text = decoded;
      }
    }

    // 如果是逐行协议（vmess:// ... 等）
    if (looksLikeProtocolList(trimmed)) {
      // 逐行处理每个节点（vmess/vless/ss/trojan）
      const processed = processProtocolLines(text, { prefix: customPrefix, suffix: customSuffix, lang: outputLanguage });
      output = processed;
      responseContentType = 'text/plain; charset=utf-8';
      return new Response(output, { headers: { 'Content-Type': responseContentType }});
    }

    // 其它情况：可能是 Clash-meta 带 base64 编码的 proxies 字段（例如 proxies: [ "vmess://..." or base64 content ]),
    // 或者 sing-box 风格。尝试解析为 JSON->处理；若失败，尝试解析为每行 base64 节点
    // 尝试再次 decode 全文 as base64 (URL-safe) if contains no whitespace or contains many '='
    // 最后兜底：当作文本并对可能的 vmess://base64 进行替换
    // 尝试解析 JSON（有些订阅服务器不会返回 JSON header，但 body 本身是 JSON）
    try {
      let json = JSON.parse(text);
      json = processJsonSubscription(json, { prefix: customPrefix, suffix: customSuffix, lang: outputLanguage });
      output = JSON.stringify(json, null, 2);
      responseContentType = 'application/json; charset=utf-8';
      return new Response(output, { headers: { 'Content-Type': responseContentType } });
    } catch (e) {
      // 继续
    }

    // 兜底：按行尝试处理行内 vmess/vless/ss/trojan 链接（有些订阅会是一行一个链接）
    {
      const processed = processProtocolLines(text, { prefix: customPrefix, suffix: customSuffix, lang: outputLanguage });
      output = processed;
      responseContentType = 'text/plain; charset=utf-8';
      return new Response(output, { headers: { 'Content-Type': responseContentType }});
    }

  } catch (e) {
    return new Response('Internal error: ' + e.stack, { status: 500 });
  }
}

// -------------------- 工具与核心逻辑 --------------------

// 判断是否像 JSON
function looksLikeJson(s) {
  return /^\s*[\{\[]/.test(s);
}

// 判断是否可能是整串 base64（无换行或少量换行，且字符集为 base64 URL-safe）
function isProbablyBase64Only(s) {
  // 如果长度非常长且只包含 base64 字符（URL safe）
  const noNewline = s.replace(/\s+/g, '');
  if (noNewline.length > 100 && /^[A-Za-z0-9\-_+=]+$/.test(noNewline)) return true;
  return false;
}

// 判断是否逐行协议
function looksLikeProtocolList(s) {
  // 若任意一行以 vmess:// vless:// ss:// trojan:// 开头，则认为是协议列表
  return /(^|\n)\s*(vmess|vless|ss|trojan):\/\//i.test(s);
}

// ------- Base64 安全编解码（支持 URL safe） -------
function safeBase64Decode(input) {
  if (!input || typeof input !== 'string') return null;
  // 移除空白
  const s = input.trim().replace(/\s+/g, '');
  // URL safe -> 标准
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  // 补齐
  while (b64.length % 4 !== 0) b64 += '=';
  try {
    // atob 在 Workers 环境可用
    const decoded = atob(b64);
    return decoded;
  } catch (e) {
    return null;
  }
}

function safeBase64Encode(input) {
  if (typeof input !== 'string') input = String(input);
  try {
    let b64 = btoa(input);
    // 转 URL safe，去掉 '='
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) {
    // 处理大文本可能超出 btoa 的限制，我们可以分片处理（兼容）
    try {
      const u8 = new TextEncoder().encode(input);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < u8.length; i += chunk) {
        binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
      }
      let b64 = btoa(binary);
      return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (e2) {
      return '';
    }
  }
}

// ---------- 处理协议行（vmess/vless/ss/trojan） ----------
function processProtocolLines(text, opts) {
  const lines = text.split(/\r?\n/);
  const map = {}; // 名称唯一性 map
  const processed = lines.map(line => {
    if (!line || !line.trim()) return line;
    const l = line.trim();
    // vmess://<base64>
    if (/^vmess:\/\//i.test(l) || /^vless:\/\//i.test(l)) {
      try {
        const parsed = parseVmessOrVlessLine(l);
        if (parsed && parsed.name) {
          parsed.name = transformNodeName(parsed.name, { prefix: opts.prefix, suffix: opts.suffix, lang: opts.lang, map, keywordsMapForPreserve: defaultKeywordsMap, filterKeywords: defaultFilterKeywords, keywordsToNames: defaultKeywordsToNames });
          // put back
          if (parsed.type === 'vmess' || parsed.type === 'vless') {
            // 将 data 对象重新序列化为 base64 JSON（保持原结构）
            const encoded = safeBase64Encode(JSON.stringify(parsed.data));
            return `${parsed.type}://${encoded}`;
          }
        }
        return l;
      } catch (e) {
        return l;
      }
    }

    // ss:// ... 的形式： ss://[method:password@]host:port#name 或 ss://base64(method:password@host:port)#name
    if (/^ss:\/\//i.test(l)) {
      try {
        const parsed = parseSSLine(l);
        if (parsed && parsed.name) {
          parsed.name = transformNodeName(parsed.name, { prefix: opts.prefix, suffix: opts.suffix, lang: opts.lang, map, keywordsMapForPreserve: defaultKeywordsMap, filterKeywords: defaultFilterKeywords, keywordsToNames: defaultKeywordsToNames });
          // rebuild
          return rebuildSSLine(parsed);
        }
        return l;
      } catch (e) {
        return l;
      }
    }

    // trojan://password@host:port?params#name
    if (/^trojan:\/\//i.test(l)) {
      try {
        const parsed = parseTrojanLine(l);
        if (parsed && parsed.name) {
          parsed.name = transformNodeName(parsed.name, { prefix: opts.prefix, suffix: opts.suffix, lang: opts.lang, map, keywordsMapForPreserve: defaultKeywordsMap, filterKeywords: defaultFilterKeywords, keywordsToNames: defaultKeywordsToNames });
          return rebuildTrojanLine(parsed);
        }
        return l;
      } catch (e) {
        return l;
      }
    }

    // 若行中包含 vmess://<base64>（例如混合多行），替换所有出现
    const replaced = l.replace(/(vmess:\/\/)([A-Za-z0-9\-_]+=*)/ig, (m, p1, p2) => {
      try {
        const decoded = safeBase64Decode(p2);
        if (!decoded) return m;
        const obj = JSON.parse(decoded);
        const nameKey = obj.ps || obj.ps || obj.remarks || obj.remarks || obj.tag || obj.name;
        if (nameKey) {
          obj.ps = transformNodeName(nameKey, { prefix: opts.prefix, suffix: opts.suffix, lang: opts.lang, map, keywordsMapForPreserve: defaultKeywordsMap, filterKeywords: defaultFilterKeywords, keywordsToNames: defaultKeywordsToNames });
        }
        const re = safeBase64Encode(JSON.stringify(obj));
        return `${p1}${re}`;
      } catch (e) {
        return m;
      }
    });
    return replaced;
  });

  return processed.join('\n');
}

// ---------- JSON 订阅处理（Clash / Clash-meta / Sing-box 等） ----------
function processJsonSubscription(json, opts) {
  const map = {}; // 名称唯一性 map across JSON
  // 封装转换函数
  const transform = name => transformNodeName(name, { prefix: opts.prefix, suffix: opts.suffix, lang: opts.lang, map, keywordsMapForPreserve: defaultKeywordsMap, filterKeywords: defaultFilterKeywords, keywordsToNames: defaultKeywordsToNames });

  // Clash 格式：proxies 数组或 proxies.xxx
  if (Array.isArray(json)) {
    // 有些订阅直接是 proxies 数组
    return json.map(node => {
      if (typeof node === 'string') return node; // 不处理纯字符串
      if (node.name) node.name = transform(node.name);
      if (node.ps) node.ps = transform(node.ps);
      if (node.tag) node.tag = transform(node.tag);
      if (node.alias) node.alias = transform(node.alias);
      // 保证 vmess 类型里 data.ps 或 remark 也改名（部分不规范 config）
      if (node.type && (node.type === 'vmess' || node.type === 'vless') && node.ps) node.ps = transform(node.ps);
      return node;
    });
  }

  // Clash-like object
  if (json.proxies && Array.isArray(json.proxies)) {
    json.proxies = json.proxies.map(p => {
      if (p.name) p.name = transform(p.name);
      // sing-box sometimes uses tag
      if (p.tag) p.tag = transform(p.tag);
      if (p.remarks) p.remarks = transform(p.remarks);
      if (p.alias) p.alias = transform(p.alias);
      // v2ray-style might have 'ps' or 'remark'
      if (p.ps) p.ps = transform(p.ps);
      if (p.remark) p.remark = transform(p.remark);
      return p;
    });
    // 有些 Clash-meta 还有 'proxy-groups' 里面有 'proxies' 字段（字符串数组）
    if (Array.isArray(json['proxy-groups'])) {
      json['proxy-groups'] = json['proxy-groups'].map(g => {
        if (g.proxies && Array.isArray(g.proxies)) {
          g.proxies = g.proxies.map(item => {
            if (typeof item === 'string') {
              // 若字符串是节点名，尽量替换（但需确保与 proxies 对应）
              // 我们在这里不尝试精确匹配所有名字，因为有可能 group 引用了一些别名。
              // 这里仅对带有过滤关键词的条目做替换以保持简洁。
              return transform(item);
            }
            return item;
          });
        }
        return g;
      });
    }
    return json;
  }

  // Sing-box 风格：outbounds 列表或 inbound/outbound
  if (json.outbounds && Array.isArray(json.outbounds)) {
    json.outbounds = json.outbounds.map(ob => {
      // sing-box 用 'tag' 表示名称
      if (ob.tag) ob.tag = transform(ob.tag);
      if (ob.name) ob.name = transform(ob.name);
      // 如果是 vless/vmess 内嵌 remark
      if (ob.transport && ob.transport.type && ob.tag) ob.tag = transform(ob.tag);
      return ob;
    });
    return json;
  }

  // 其他结构，逐字段递归查找 name/ps/tag 字段进行替换（防止遗漏）
  const deepTransform = obj => {
    if (!obj || typeof obj !== 'object') return obj;
    for (const k of Object.keys(obj)) {
      if (k.toLowerCase().includes('name') || k.toLowerCase().includes('tag') || k.toLowerCase().includes('ps') || k.toLowerCase().includes('remark')) {
        if (typeof obj[k] === 'string') obj[k] = transform(obj[k]);
      } else if (typeof obj[k] === 'object') {
        deepTransform(obj[k]);
      } else if (Array.isArray(obj[k])) {
        obj[k] = obj[k].map(v => (typeof v === 'string' ? transform(v) : (typeof v === 'object' ? deepTransform(v) : v)));
      }
    }
    return obj;
  };

  return deepTransform(json);
}

// ----------------- 节点名称转换主逻辑 -----------------
/**
 * options:
 *  - prefix, suffix, lang
 *  - map: 用于追踪同名计数以确保唯一性（对象，会被修改）
 *  - keywordsMapForPreserve: map of preserved keywords -> replacement
 *  - filterKeywords: list
 *  - keywordsToNames: mapping pattern -> country string
 */
function transformNodeName(originalName, options = {}) {
  if (!originalName || typeof originalName !== 'string') return originalName;
  let name = originalName.trim();

  const prefix = options.prefix ?? '';
  const suffix = options.suffix ?? '';
  const lang = options.lang ?? 'EN';
  const map = options.map || {};
  const keywordsMapForPreserve = options.keywordsMapForPreserve || defaultKeywordsMap;
  const filterKeywords = options.filterKeywords || defaultFilterKeywords;
  const keywordsToNames = options.keywordsToNames || defaultKeywordsToNames;

  // 1) 先移除 BOM 与多余空白
  name = name.replace(/^\uFEFF/, '').replace(/\s+/g, ' ').trim();

  // 2) 过滤掉 (或删除) 无效关键词
  for (const kw of filterKeywords) {
    try {
      name = name.replace(new RegExp(escapeRegExp(kw), 'ig'), '');
    } catch (e) {
      // skip invalid regex
    }
  }
  name = name.trim();

  // 3) 保留并替换一些关键词（将来会加回到末尾）
  const preservedParts = [];
  for (const kw in keywordsMapForPreserve) {
    try {
      const re = new RegExp(escapeRegExp(kw), 'i');
      const m = name.match(re);
      if (m) {
        preservedParts.push(keywordsMapForPreserve[kw]);
        name = name.replace(re, '');
      }
    } catch (e) {}
  }
  name = name.trim();

  // 4) 按地区关键词匹配并替换成带表情的国家/地区标识（优先匹配）
  let regionMatched = false;
  for (const patt in keywordsToNames) {
    try {
      const re = new RegExp(patt, 'i');
      if (re.test(name)) {
        name = keywordsToNames[patt];
        regionMatched = true;
        break;
      }
    } catch (e) {
      // invalid pattern skip
    }
  }

  // 如果没有匹配到地区，但 node 有 host/ip，尝试从带有括号或 - 分隔中抽取可能国家缩写（尽量保守）
  if (!regionMatched) {
    // 尝试提取末尾的国家简写 (如 US / CN / HK 等)
    const match = name.match(/\b([A-Za-z]{2,3})\b$/);
    if (match && match[1]) {
      const code = match[1].toUpperCase();
      const fallback = codeToEmoji(code, lang);
      if (fallback) {
        name = fallback;
        regionMatched = true;
      }
    }
  }

  // 如果处理后 name 为空（全部关键词被过滤掉），就用默认 "NODE"
  if (!name) name = lang === 'CN' ? '节点' : 'NODE';

  // 拼接前缀
  let finalName = (prefix || '') + name;

  // 保证唯一性：使用 map 计数添加 -n
  if (!map[finalName]) {
    map[finalName] = 1;
  } else {
    map[finalName] += 1;
    finalName = `${finalName}-${map[finalName]}`;
  }

  // 拼接后缀
  finalName += (suffix || '');

  // 添加保留部分（如 GPT 等）到末尾
  if (preservedParts.length) {
    finalName += ' ' + preservedParts.join(' ');
  }

  // 最终清理：去除重复空格，裁剪长度到合理范围（例如 128 字符）
  finalName = finalName.replace(/\s+/g, ' ').trim();
  if (finalName.length > 128) finalName = finalName.slice(0, 125) + '...';

  return finalName;
}

// ---------- 匹配/解析 vmess/vless 单行 ----------
function parseVmessOrVlessLine(line) {
  const m = line.match(/^([a-z0-9]+):\/\/(.+)$/i);
  if (!m) return null;
  const type = m[1].toLowerCase();
  const payload = m[2].trim();
  // payload 对于 vmess/vless 通常是 base64(json)
  const decoded = safeBase64Decode(payload);
  if (!decoded) throw new Error('vmess/vless payload not base64');
  let obj;
  try {
    obj = JSON.parse(decoded);
  } catch (e) {
    throw new Error('vmess/vless payload not json');
  }
  // vmess 对象常见字段: ps (备注)
  const name = obj.ps || obj.remarks || obj.remarks || obj.name || '';
  return { type, data: obj, name };
}

// ---------- 解析并重建 SS ----------
function parseSSLine(line) {
  // ss://base64 or ss://method:passwd@host:port#name
  // Handle both
  // decode URI components for fragment (#)
  // First extract fragment
  const fragIndex = line.indexOf('#');
  let name = '';
  let uriPart = line;
  if (fragIndex !== -1) {
    name = decodeURIComponent(line.slice(fragIndex + 1));
    uriPart = line.slice(0, fragIndex);
  }
  // remove leading ss://
  let body = uriPart.replace(/^ss:\/\//i, '');
  // If body contains '@' then it's not base64 form
  if (body.indexOf('@') !== -1) {
    // format: method:passwd@host:port or method:passwd@host:port?params
    // decode percent
    // name may be provided as fragment
    // We return parsed structure
    return { raw: line, scheme: 'ss', name: name || '', body };
  } else {
    // base64 payload (possibly URL-safe)
    // payload might be "base64@host:port" in newer ssr-like style, but for ss it is base64(method:passwd@host:port)
    // Try decode as base64
    let decoded = safeBase64Decode(body);
    if (decoded) {
      // decoded typically looks like "method:password@host:port"
      // There may also be params after '?'
      const qIndex = decoded.indexOf('?');
      if (qIndex !== -1) {
        // there are params; fragment name stays as given
        const core = decoded.slice(0, qIndex);
        return { raw: line, scheme: 'ss', name: name || '', body: core };
      } else {
        return { raw: line, scheme: 'ss', name: name || '', body: decoded };
      }
    } else {
      // fallback: treat as raw
      return { raw: line, scheme: 'ss', name: name || '', body };
    }
  }
}

function rebuildSSLine(parsed) {
  // If original was base64 style and had a name
  // We try to rebuild as original style: ss://<base64 or method:password@host:port>#name
  if (!parsed) return '';
  const namePart = parsed.name ? `#${encodeURIComponent(parsed.name)}` : '';
  if (parsed.raw && parsed.raw.startsWith('ss://') && parsed.raw.indexOf('@') === -1) {
    // original was base64 style; re-encode body to base64
    const enc = safeBase64Encode(parsed.body);
    return `ss://${enc}${namePart}`;
  }
  // else if parsed.body contains '@', we can use it directly
  return `ss://${parsed.body}${namePart}`;
}

// ---------- 解析与重建 Trojan ----------
function parseTrojanLine(line) {
  // trojan://password@host:port?params#name
  const urlPart = line.replace(/^trojan:\/\//i, '');
  const fragIndex = urlPart.indexOf('#');
  let name = '';
  let beforeFrag = urlPart;
  if (fragIndex !== -1) {
    name = decodeURIComponent(urlPart.slice(fragIndex + 1));
    beforeFrag = urlPart.slice(0, fragIndex);
  }
  // beforeFrag is like password@host:port?params
  return { raw: line, scheme: 'trojan', name, body: beforeFrag };
}

function rebuildTrojanLine(parsed) {
  const namePart = parsed.name ? `#${encodeURIComponent(parsed.name)}` : '';
  return `trojan://${parsed.body}${namePart}`;
}

// ---------- 支持的默认关键词映射与过滤 ----------

// 过滤关键词（中英文混合）
const defaultFilterKeywords = [
    "广告", "过期", "无效", "测试", "备用", "官网", "账号", "有效期", "群",
    "到期", "刷新", "剩余", "电报", "会员", "解锁", "流量", "超时",
    "订阅", "佣金", "免翻", "节点", "下载", "更新", "点外", "重置",
    "免流", "Days", "Date", "Expire", "Premium", "建议", "免费",
    "套餐", "到期", "有效", "剩余", "版本", "已用", "过期", "失联",
    "测试", "官方", "网址", "备用", "群", "TEST", "客服", "网站",
    "获取", "订阅", "流量", "机场", "下次", "官址", "联系", "邮箱",
    "工单", "学术", "USE", "USED", "TOTAL", "EXPIRE", "EMAIL"
];

// 保留关键词映射（可扩展）
const defaultKeywordsMap = {
    "ChatGPT": "GPT",
    // "保留的关键词2": "替换词2"
};

// 下面是你提供的国家/地区映射表（保持原样，支持中英输出）
const defaultKeywordsToNames = (function(){
  // We build the mapping object dynamically so it can use output language at runtime;
  // but here we'll store both CN and EN versions in arrays of [pattern, ENname, CNname]
  const list = [
    ["美国|美國|US|洛杉矶|洛杉磯|西雅图|纽约|芝加哥|Atlanta|States|American|Los Angeles|Seattle|New York|Chicago","🇺🇸US","🇺🇸美国"],
    ["港|香港|HK|Hong Kong","🇭🇰HK","🇭🇰香港"],
    ["新加坡|狮城|SG|Singapore","🇸🇬SG","🇸🇬新加坡"],
    ["台|台湾|台北|高雄|TW|Taiwan|Taipei|Kaohsiung","🇨🇳TW","🇨🇳台湾"],
    ["日|东京|大阪|名古屋|JP|Tokyo|Japan|Osaka|Nagoya","🇯🇵JP","🇯🇵日本"],
    ["韩国|首尔|釜山|KR|Korea|Seoul|Busan","🇰🇷KR","🇰🇷韩国"],
    ["土耳其|伊斯坦布尔|安卡拉|TR|Turkey|Istanbul|Ankara","🇹🇷TR","🇹🇷土耳其"],
    ["爱尔兰|都柏林|IE|Ireland|Dublin","🇮🇪IRL","🇮🇪爱尔兰"],
    ["澳|悉尼|墨尔本|布里斯班|AU|Australia|Sydney|Melbourne|Brisbane","🇦🇺AU","🇦🇺澳大利亚"],
    ["法国|巴黎|里昂|马赛|FR|France|Paris|Lyon|Marseille","🇫🇷FRA","🇫🇷法国"],
    ["瑞典|斯德哥尔摩|哥德堡|SE|Sweden|Stockholm|Gothenburg","🇸🇪SE","🇸🇪瑞典"],
    ["德国|法兰克福|柏林|慕尼黑|DE|Germany|Frankfurt|Berlin|Munich","🇩🇪DE","🇩🇪德国"],
    ["英国|伦敦|曼彻斯特|伯明翰|GB|UK|United Kingdom|London|Manchester|Birmingham","🇬🇧GB","🇬🇧英国"],
    ["印度|孟买|德里|班加罗尔|IN|India|Mumbai|Delhi|Bangalore","🇮🇳IN","🇮🇳印度"],
    ["加拿大|多伦多|温哥华|蒙特利尔|CA|Canada|Toronto|Vancouver|Montreal","🇨🇦CA","🇨🇦加拿大"],
    ["西班牙|马德里|巴塞罗那|ES|Spain|Madrid|Barcelona","🇪🇸ES","🇪🇸西班牙"],
    ["意大利|罗马|米兰|那不勒斯|IT|Italy|Rome|Milan|Naples","🇮🇹IT","🇮🇹意大利"],
    ["荷兰|阿姆斯特丹|鹿特丹|NL|Netherlands|Amsterdam|Rotterdam","🇳🇱NL","🇳🇱荷兰"],
    ["瑞士|苏黎世|日内瓦|CH|Switzerland|Zurich|Geneva","🇨🇭CH","🇨🇭瑞士"],
    ["俄罗斯|莫斯科|圣彼得堡|RU|Russia|Moscow|Saint Petersburg","🇷🇺RU","🇷🇺俄罗斯"],
    ["巴西|圣保罗|里约热内卢|BR|Brazil|São Paulo|Rio de Janeiro","🇧🇷BR","🇧🇷巴西"],
    ["南非|约翰内斯堡|开普敦|ZA|South Africa|Johannesburg|Cape Town","🇿🇦ZA","🇿🇦南非"],
    ["墨西哥|墨西哥城|瓜达拉哈拉|MX|Mexico|Mexico City|Guadalajara","🇲🇽MX","🇲🇽墨西哥"],
    ["阿根廷|布宜诺斯艾利斯|AR|Argentina|Buenos Aires","🇦🇷AR","🇦🇷阿根廷"],
    ["波兰|华沙|克拉科夫|PL|Poland|Warsaw|Krakow","🇵🇱PL","🇵🇱波兰"],
    ["泰国|曼谷|清迈|TH|Thailand|Bangkok|Chiang Mai","🇹🇭TH","🇹🇭泰国"],
    ["马来西亚|吉隆坡|槟城|MY|Malaysia|Kuala Lumpur|Penang","🇲🇾MY","🇲🇾马来西亚"],
    ["越南|河内|胡志明|VN|Vietnam|Hanoi|Ho Chi Minh","🇻🇳VN","🇻🇳越南"],
    ["菲律宾|马尼拉|PH|Philippines|Manila","🇵🇭PH","🇵🇭菲律宾"],
    ["埃及|开罗|EG|Egypt|Cairo","🇪🇬EG","🇪🇬埃及"],
    ["沙特|利雅得|吉达|SA|Saudi Arabia|Riyadh|Jeddah","🇸🇦SA","🇸🇦沙特阿拉伯"],
    ["阿联酋|迪拜|阿布扎比|AE|UAE|Dubai|Abu Dhabi","🇦🇪AE","🇦🇪阿联酋"],
    ["挪威|奥斯陆|NO|Norway|Oslo","🇳🇴NO","🇳🇴挪威"],
    ["芬兰|赫尔辛基|FI|Finland|Helsinki","🇫🇮FI","🇫🇮芬兰"],
    ["奥地利|维也纳|AT|Austria|Vienna","🇦🇹AT","🇦🇹奥地利"],
    ["希腊|雅典|GR|Greece|Athens","🇬🇷GR","🇬🇷希腊"],
    ["匈牙利|布达佩斯|HU|Hungary|Budapest","🇭🇺HU","🇭🇺匈牙利"],
    ["捷克|布拉格|CZ|Czech|Prague","🇨🇿CZ","🇨🇿捷克"],
    ["新西兰|奥克兰|NZ|New Zealand|Auckland","🇳🇿NZ","🇳🇿新西兰"],
    ["尼泊尔|加德满都|NP|Nepal|Kathmandu","🇳🇵NP","🇳🇵尼泊尔"],
    ["葡萄牙|里斯本|PT|Portugal|Lisbon","🇵🇹PT","🇵🇹葡萄牙"],
    ["巴基斯坦|伊斯兰堡|PK|Pakistan|Islamabad","🇵🇰PK","🇵🇰巴基斯坦"],
    ["伊朗|德黑兰|IR|Iran|Tehran","🇮🇷IR","🇮🇷伊朗"],
    ["伊拉克|巴格达|IQ|Iraq|Baghdad","🇮🇶IQ","🇮🇶伊拉克"],
    ["阿尔及利亚|阿尔及尔|DZ|Algeria|Algiers","🇩🇿DZ","🇩🇿阿尔及利亚"],
    ["摩洛哥|拉巴特|MA|Morocco|Rabat","🇲🇦MA","🇲🇦摩洛哥"],
    ["尼日利亚|拉各斯|NG|Nigeria|Lagos","🇳🇬NG","🇳🇬尼日利亚"],
    ["智利|圣地亚哥|CL|Chile|Santiago","🇨🇱CL","🇨🇱智利"],
    ["秘鲁|利马|PE|Peru|Lima","🇵🇪PE","🇵🇪秘鲁"],
    ["哥伦比亚|波哥大|CO|Colombia|Bogotá","🇨🇴CO","🇨🇴哥伦比亚"],
    ["罗马尼亚|Romania|RO|Bucharest|Cluj-Napoca|Timișoara","🇷🇴RO","🇷🇴罗马尼亚"],
    ["塞尔维亚|Serbia|RS|Belgrade|Novi Sad|Niš","🇷🇸RS","🇷🇸塞尔维亚"],
    ["立陶宛|Lithuania|LT|Vilnius|Kaunas|Klaipėda","🇱🇹LT","🇱🇹立陶宛"],
    ["危地马拉|Guatemala|GT|Guatemala City|Antigua Guatemala|Quetzaltenango","🇬🇹GT","🇬🇹危地马拉"],
    ["丹麦|Denmark|DK|Copenhagen|Aarhus|Odense","🇩🇰DK","🇩🇰丹麦"],
    ["乌克兰|Ukraine|UA|Kyiv|Lviv|Odesa","🇺🇦UA","🇺🇦乌克兰"],
    ["以色列|Israel|IL|Jerusalem|Tel Aviv|Haifa","🇮🇱IL","🇮🇱以色列"],
    ["厄瓜多尔|Ecuador|EC|Quito|Guayaquil|Cuenca","🇪🇨EC","🇪🇨厄瓜多尔"],
    ["哥斯达黎加|Costa Rica|CR|San José|Alajuela|Cartago","🇨🇷CR","🇨🇷哥斯达黎加"],
    ["塞浦路斯|Cyprus|CY|Nicosia|Limassol|Larnaca","🇨🇾CY","🇨🇾塞浦路斯"],
    ["比利时|Belgium|BE|Brussels|Antwerp|Ghent","🇧🇪BE","🇧🇪比利时"],
    ["玻利维亚|Bolivia|BO|Sucre|La Paz|Santa Cruz","🇧🇴BO","🇧🇴玻利维亚"]
  ];

  // build map keyed by pattern string -> function(lang)
  const map = {};
  for (const row of list) {
    const pattern = row[0];
    map[pattern] = (lang === 'EN') ? row[1] : row[2]; // we'll override in runtime if needed
  }
  // But above would freeze to the last lang; instead we return the raw list and interpret at runtime:
  return list.reduce((acc, row) => {
    acc[row[0]] = { EN: row[1], CN: row[2] };
    return acc;
  }, {});
})();

// helper to pick emoji name by code fallback (limited)
function codeToEmoji(code, lang) {
  const codeMap = {
    'US': { EN: '🇺🇸US', CN: '🇺🇸美国' },
    'CN': { EN: '🇨🇳CN', CN: '🇨🇳中国' },
    'HK': { EN: '🇭🇰HK', CN: '🇭🇰香港' },
    'SG': { EN: '🇸🇬SG', CN: '🇸🇬新加坡' },
    'JP': { EN: '🇯🇵JP', CN: '🇯🇵日本' },
    'KR': { EN: '🇰🇷KR', CN: '🇰🇷韩国' },
    'TW': { EN: '🇨🇳TW', CN: '🇨🇳台湾' }
    // 可继续扩展
  };
  const up = (code || '').toUpperCase();
  if (codeMap[up]) return codeMap[up][lang === 'CN' ? 'CN' : 'EN'];
  return null;
}

// 由于 defaultKeywordsToNames 存储了 {pattern: {EN, CN}}, 我们需要在 transform 时使用：
function defaultKeywordsToNamesLookup(lang) {
  const out = {};
  for (const patt in defaultKeywordsToNames) {
    out[patt] = defaultKeywordsToNames[patt][lang === 'CN' ? 'CN' : 'EN'];
  }
  return out;
}

// 在 transformNodeName 中用于取值
// 但为了避免每次构建 map 的开销，我们在 transformNodeName 中取 options.keywordsToNames 或默认
// 所以在外面提供默认 getter:
function getKeywordsToNamesForLang(lang) {
  const out = {};
  for (const patt in defaultKeywordsToNames) {
    out[patt] = defaultKeywordsToNames[patt][lang === 'CN' ? 'CN' : 'EN'];
  }
  return out;
}

// ----------------- 小工具 -----------------
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
