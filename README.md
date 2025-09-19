# 订阅节点名称过滤器项目

这是一个用于自动过滤和重命名订阅节点名称的 Cloudflare Workers 项目，支持中英文输出和自定义前后缀。

## 项目功能

- 🌍 自动为服务器节点添加国家或地区标识符
- 🔤 支持中英文输出切换
- ⚙️ 自定义前缀和后缀重命名节点
- 🚫 过滤无效关键词和广告节点
- 📝 保留必要信息，确保节点名称唯一且简洁
- 🔗 提供 API 接口处理订阅链接

# 项目特性

## 🌟 主要特性

### 智能地区识别

- 🌍 支持全球 50+ 个国家和地区识别
- 🏙️ 包含主要城市名称匹配
- 🇺🇸 自动添加国旗和地区代码

### 多语言支持

- 🇨🇳 中文输出：`🇺🇸美国`、`🇭🇰香港`
- 🇺🇸 英文输出：`🇺🇸US`、`🇭🇰HK`
- 🔄 通过参数动态切换

### 智能过滤

- 🚫 自动过滤广告和无效节点
- 📝 保留重要服务标识（如ChatGPT→GPT）
- 🎯 确保节点名称简洁有效

### 自定义配置

- ⚙️ 可配置前缀和后缀字符
- 🔤 支持自定义保留关键词
- 🎨 灵活的输出格式

### 高性能部署

- ⚡ Cloudflare Workers 边缘计算
- 🌐 全球 CDN 加速
- 🔒 CORS 跨域支持
- 📱 支持多种订阅格式

## 🔧 配置选项

### 默认配置

```jsx
const DEFAULT_CONFIG = {
  customCharStart: "➥",     // 前缀字符
  customCharEnd: "ᵐᵗ",       // 后缀字符
  outputLanguage: "EN"      // 默认语言
};
```

### 支持的地区代码

| 地区 | 中文输出 | 英文输出 |
| --- | --- | --- |
| 美国 | 🇺🇸美国 | 🇺🇸US |
| 香港 | 🇭🇰香港 | 🇭🇰HK |
| 新加坡 | 🇸🇬新加坡 | 🇸🇬SG |
| 日本 | 🇯🇵日本 | 🇯🇵JP |
| 台湾 | 🇨🇳台湾 | 🇨🇳TW |

......

### 过滤关键词

自动过滤包含以下关键词的节点：

- 广告、过期、无效、测试
- 流量、到期、剩余、超时
- 官网、群、客服、邮箱
- 以及其他无效标识符

## Cloudflare Workers 部署步骤

### 1. 创建 Worker

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击左侧菜单中的 **Workers & Pages**
3. 点击 **Create application**
4. 选择 **Create Worker**
5. 输入 Worker 名称，例如 `subscription-filter`

### 2. 部署代码

1. 将 `_worker.js` 中的代码复制到 Worker 编辑器中
2. 点击 **Save and Deploy**

### 3. 配置自定义域名（可选）

1. 在 Worker 详情页面点击 **Settings**
2. 选择 **Triggers** 标签
3. 点击 **Add Custom Domain**
4. 输入你的自定义域名

### 4. 测试部署

访问你的 Worker URL：

```
https://subscription-filter.your-subdomain.workers.dev/?url=你的订阅链接
```

## API 接口说明

### 请求格式

```
GET /?url={订阅链接}&lang={语言}&prefix={前缀}&suffix={后缀}
```

### 参数说明

- **url** (必需): 原始订阅链接
- **lang** (可选): 输出语言，`EN` 或 `CN`，默认 `EN`
- **prefix** (可选): 自定义前缀，默认 `➥`
- **suffix** (可选): 自定义后缀，默认 `ᵐᵗ`

### 示例
# 英文输出
https://your-worker.workers.dev/?url=https://example.com/sub&lang=EN

US-Los Angeles-High Speed → ➥🇺🇸美国ᵐᵗ

香港-01-Premium → ➥🇭🇰香港ᵐᵗ

Singapore-ChatGPT → ➥🇸🇬新加坡ᵐᵗ GPT

# 中文输出，自定义前后缀
https://your-worker.workers.dev/?url=https://example.com/sub&lang=CN&prefix=🚀&suffix=⭐
# 使用火箭和星星作为前后缀
prefix=🚀&suffix=⭐

处理结果：
美国节点 → 🚀🇺🇸US⭐

日本节点 → 🚀🇯🇵JP⭐
