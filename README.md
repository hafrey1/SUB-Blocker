# 📡 订阅节点名称过滤器

> 一个部署在 Cloudflare Workers 上的智能订阅节点名称过滤器，智能识别节点地区，便于分流规则识别，批量自定义节点前后缀，支持多种订阅格式处理和动态参数配置。
> 

## 🚀 核心功能

### 🔄 订阅类型处理

- **Base64 编码**: 自动解码、处理节点名称、重新编码
- **Clash-meta 格式**: 支持 YAML 格式的 Clash 配置文件处理
- **Sing-box 格式**: JSON 格式的 Sing-box 配置处理
- **自适应识别**: 智能检测订阅类型并选择合适的处理方式

### 🏷️ 节点名称生成

- **智能地区识别**: 基于 50+ 国家/地区关键词自动添加标识符
- **双语支持**: 中文和英文节点名称输出
- **自定义前后缀**: 支持动态设置节点名称前缀和后缀
- **防重复机制**: 自动处理重复节点名称，添加数字后缀

### 🌍 支持的国家/地区

| 地区 | 中文输出 | 英文输出 | 关键词示例 |
| --- | --- | --- | --- |
| 美国 | 🇺🇸美国 | 🇺🇸US | 美国、US、洛杉矶、纽约 |
| 香港 | 🇭🇰香港 | 🇭🇰HK | 港、香港、HK |
| 日本 | 🇯🇵日本 | 🇯🇵JP | 日、东京、大阪、JP |
| 新加坡 | 🇸🇬新加坡 | 🇸🇬SG | 新加坡、狮城、SG |
| ... | ... | ... | 还有 40+ 个国家/地区 |

### 🛡️ 节点过滤功能

自动过滤包含以下关键词的无效节点：

- 广告相关：广告、官网、客服
- 过期信息：过期、到期、失联
- 测试相关：测试、备用、TEST
- 流量相关：流量、剩余、已用

## 📦 部署指南

### 1. Cloudflare Workers 部署

1. **登录 Cloudflare Dashboard**
    - 进入 `Workers` 页面
    - 点击 `Create a Service`
2. **创建新 Worker**
    - 输入服务名称
    - 选择 `HTTP handler` 模板
    - 点击 `Create service`
3. **部署代码**
    - 点击 `Quick edit`
    - 将 `_worker.js` 的完整代码复制粘贴
    - 点击 `Save and deploy`
4. **获取访问地址**
    - 复制生成的 Worker URL
    - 格式：[`https://your-worker-name.your-subdomain.workers.dev`](https://your-worker-name.your-subdomain.workers.dev)

## 🎯 使用方法

### 基本语法

```
https://your-worker.workers.dev/?url=订阅链接&lang=语言&prefix=前缀&suffix=后缀
```

### 参数说明

| 参数 | 必需 | 说明 | 默认值 | 示例 |
| --- | --- | --- | --- | --- |
| `url` | ✅ | 原始订阅链接 | - | https://example.com/sub |
| `lang` | ❌ | 语言设置 | EN | CN (中文) / EN (英文) |
| `prefix` | ❌ | 节点名称前缀 | ➥ | 🚀 |
| `suffix` | ❌ | 节点名称后缀 | ᵐᵗ | ⚡ |

### 使用示例

### 1. 基本使用（英文节点名）

```
https://worker.example.com/?url=https://your-subscription-url
```

**输出示例**: `➥🇺🇸USᵐᵗ`、`➥🇭🇰HKᵐᵗ`、`➥🇯🇵JPᵐᵗ`

### 2. 中文节点名

```
https://worker.example.com/?url=https://your-subscription-url&lang=CN
```

**输出示例**: `➥🇺🇸美国ᵐᵗ`、`➥🇭🇰香港ᵐᵗ`、`➥🇯🇵日本ᵐᵗ`

### 3. 自定义前后缀

```
https://worker.example.com/?url=https://your-subscription-url&prefix=🚀&suffix=⚡
```

**输出示例**: `🚀🇺🇸US⚡`、`🚀🇭🇰HK⚡`、`🚀🇯🇵JP⚡`

### 4. 完整配置

```
[https://worker.example.com/?url=https://your-subscription-url&lang=CN&prefix=[&suffix=]](https://worker.example.com/?url=https://your-subscription-url&lang=CN&prefix=[&suffix=])
```

**输出示例**: `[🇺🇸美国]`、`[🇭🇰香港]`、`[🇯🇵日本]`

## 📱 客户端自适应支持

### 🔄 智能兼容机制

我们的过滤器采用先进的自适应技术，确保与所有主流客户端完美兼容：

1. **格式智能检测**: 自动识别原始订阅类型（Base64/Clash/Sing-box）
2. **Content-Type 保持**: 维持原始订阅的 Content-Type 头，确保客户端正确解析
3. **编码标准化**: 统一编码格式，避免字符集问题
4. **User-Agent 识别**: 根据客户端类型进行针对性优化

### ✅ 支持的客户端列表

| 客户端 | 平台 | Base64 | Clash | Sing-box | 自适应 |
| --- | --- | --- | --- | --- | --- |
| Shadowrocket | iOS | ✅ | ✅ | ⚠️ | ✅ |
| Clash for Windows | Windows | ✅ | ✅ | ❌ | ✅ |
| Clash for Android | Android | ✅ | ✅ | ❌ | ✅ |
| ClashX Pro | macOS | ✅ | ✅ | ❌ | ✅ |
| Sing-box | 全平台 | ✅ | ⚠️ | ✅ | ✅ |
| Quantumult X | iOS | ✅ | ✅ | ❌ | ✅ |
| Surge | iOS/macOS | ✅ | ✅ | ❌ | ✅ |
| V2rayN | Windows | ✅ | ❌ | ❌ | ✅ |
| V2rayNG | Android | ✅ | ❌ | ❌ | ✅ |

> ✅ 完全支持 | ⚠️ 部分支持 | ❌ 不支持
> 

### 🎯 针对性优化

### Shadowrocket 优化

- 完美支持 Base64 编码订阅
- 自动处理 URI 编码的节点名称
- 支持自定义前后缀显示

### Clash 系列优化

- 原生支持 YAML 配置格式
- 自动处理 `name` 字段的节点名称
- 保持代理组和规则完整性

### Sing-box 优化

- JSON 格式完美兼容
- 处理 `outbounds` 中的 `tag` 字段
- 支持复杂的路由配置

### V2ray 系列优化

- Base64 编码标准化
- 自动修复编码问题
- 确保节点信息完整性

## 🔧 技术实现

### 订阅格式检测

```jsx
// Base64 格式检测
function isBase64(str) {
  try {
    return btoa(atob(str)) === str;
  } catch {
    return false;
  }
}

// JSON 格式检测 (Sing-box)
function isJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

// YAML 格式检测 (Clash)
function isYAML(str) {
  return str.includes('proxies:') || 
         str.includes('proxy-groups:') || 
         str.includes('rules:');
}
```

### 节点名称处理流程

1. **获取原始节点名称**
2. **过滤无效关键词** - 跳过广告和无效节点
3. **提取保留关键词** - 保留有用信息（如 ChatGPT → GPT）
4. **地区关键词匹配** - 基于地区关键词生成标识符
5. **添加前后缀** - 根据参数添加自定义前后缀
6. **防重复处理** - 重复名称自动添加数字后缀
7. **重新编码输出** - 根据原格式重新编码

## 🌟 高级特性

### 可扩展性

- **地区映射表**: 可轻松添加新的国家/地区
- **过滤规则**: 可自定义过滤关键词列表
- **保留规则**: 可设置特殊关键词的保留和替换

### 错误处理

- 网络请求异常处理
- 格式解析错误处理
- 参数验证和默认值设置

### 性能优化

- 全局缓存机制防重复
- 流式处理大文件
- 智能格式检测避免无效转换

## 🐛 常见问题

**Q: 为什么部分节点没有被处理？**

A: 可能包含过滤关键词，或者地区关键词匹配失败。检查节点名称是否包含广告、过期等关键词。

**Q: 如何添加新的国家/地区支持？**

A: 在 `getKeywordsToNames` 函数中添加新的映射规则即可。

**Q: 支持哪些订阅格式？**

A: 支持 Base64、Clash YAML、Sing-box JSON 格式，以及自适应格式检测。

**Q: 如何自定义过滤规则？**

A: 修改 `filterKeywords` 数组，添加需要过滤的关键词。

## 📄 许可证

MIT License - 可自由使用、修改和分发。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来完善这个项目！
