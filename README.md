# 🛡️ 订阅节点名称过滤器

一个基于 Cloudflare Workers 的智能订阅节点名称过滤和重命名工具，支持中英文输出和自定义配置。

## ✨ 主要特性

- 🌍 **智能地区识别** - 支持全球 50+ 个国家和地区的自动识别
- 🔤 **多语言支持** - 支持中英文输出切换（CN/EN）
- ⚙️ **自定义配置** - 可配置前缀、后缀和保留关键词
- 🚫 **智能过滤** - 自动过滤广告、测试、过期等无效节点
- 📝 **名称优化** - 确保节点名称唯一、简洁且易识别
- ⚡ **高性能** - 基于 Cloudflare Workers 全球边缘网络
- 🔗 **API 接口** - 提供简单易用的 HTTP API

## 🚀 快速开始

### 部署到 Cloudflare Workers

1. **登录 Cloudflare Dashboard**
    
    ```
    访问 https://dash.cloudflare.com
    ```
    
2. **创建新的 Worker**
    - 点击 "Workers & Pages"
    - 选择 "Create application" → "Create Worker"
    - 输入名称（如：`subscription-filter`）
3. **部署代码**
    - 将 `_worker.js` 中的代码复制到编辑器
    - 点击 "Save and Deploy"
4. **获取访问链接**
    
    ```
    https://subscription-filter.your-subdomain.workers.dev
    ```
    

### 基本使用

```bash
# 基本调用（英文输出）
curl "https://your-worker.workers.dev/?url=https://example.com/subscription"

# 中文输出
curl "https://your-worker.workers.dev/?url=https://example.com/subscription&lang=CN"

# 自定义前后缀
curl "https://your-worker.workers.dev/?url=https://example.com/subscription&prefix=🚀&suffix=⭐"
```

## 📋 API 参数

| 参数 | 类型 | 必需 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `url` | string | ✅ | - | 原始订阅链接（需 URL 编码） |
| `lang` | string | ❌ | `EN` | 输出语言：`EN`（英文）或 `CN`（中文） |
| `prefix` | string | ❌ | `➥` | 节点名称前缀 |
| `suffix` | string | ❌ | `ᵐᵗ` | 节点名称后缀 |

## 🎯 处理效果示例

### 英文输出模式 (`lang=EN`)

| 原始节点名称 | 处理后名称 |
| --- | --- |
| `美国洛杉矶-Premium-ChatGPT解锁` | `➥🇺🇸USᵐᵗ GPT` |
| `香港-HK-01-广告节点` | *（被过滤）* |
| `日本东京NTT-Netflix优化` | `➥🇯🇵JPᵐᵗ NF` |
| `Singapore-High-Speed` | `➥🇸🇬SGᵐᵗ` |

### 中文输出模式 (`lang=CN`)

| 原始节点名称 | 处理后名称 |
| --- | --- |
| `US-Los Angeles-Premium` | `➥🇺🇸美国ᵐᵗ` |
| `Japan-Tokyo-ChatGPT` | `➥🇯🇵日本ᵐᵗ GPT` |
| `HK-01-测试节点` | *（被过滤）* |
| `Germany-Frankfurt` | `➥🇩🇪德国ᵐᵗ` |

## 🌍 支持的国家和地区

支持 50+ 个国家和地区，包括但不限于：

| 地区 | 英文输出 | 中文输出 |
| --- | --- | --- |
| 美国 | 🇺🇸US | 🇺🇸美国 |
| 香港 | 🇭🇰HK | 🇭🇰香港 |
| 日本 | 🇯🇵JP | 🇯🇵日本 |
| 新加坡 | 🇸🇬SG | 🇸🇬新加坡 |
| 台湾 | 🇨🇳TW | 🇨🇳台湾 |
| 德国 | 🇩🇪DE | 🇩🇪德国 |
| 英国 | 🇬🇧GB | 🇬🇧英国 |
| 加拿大 | 🇨🇦CA | 🇨🇦加拿大 |
| 韩国 | 🇰🇷KR | 🇰🇷韩国 |
| ... | ... | ... |

完整支持列表请查看代码中的 `getCountryNames()` 函数。

## 🚫 过滤规则

以下关键词的节点将被自动过滤：

- **广告相关**：广告、推广、邀请
- **状态相关**：过期、无效、测试、失联
- **流量相关**：流量、剩余、到期、超时
- **系统相关**：官网、群、客服、网址
- **英文标识**：Expire、Premium、TEST、USE

## ⚙️ 高级配置

### 自定义保留关键词

编辑 `PRESERVE_KEYWORDS` 对象来保留特定服务标识：

```jsx
const PRESERVE_KEYWORDS = {
  "ChatGPT": "GPT",
  "Netflix": "NF",
  "Disney": "Disney",
  "YouTube": "YT"
};
```

### 添加新地区支持

在 `getCountryNames()` 函数中添加新的地区映射：

```jsx
"国家关键词|城市名|英文名": outputLanguage === "EN" ? "🏳️CODE" : "🏳️中文名"
```

### 自定义过滤规则

修改 `FILTER_KEYWORDS` 数组来调整过滤规则：

```jsx
const FILTER_KEYWORDS = [
  "你要过滤的关键词",
  // ... 其他关键词
];
```

## 🔧 客户端集成

### Clash 系列客户端

```yaml
proxies:
  - name: "过滤订阅"
    type: http
    url: "https://your-worker.workers.dev/?url=原始订阅链接&lang=CN"
```

### V2Ray 系列客户端

直接在订阅地址中使用：

```
https://your-worker.workers.dev/?url=原始订阅链接&lang=EN
```

### Quantumult X

```
[server_remote]
https://your-worker.workers.dev/?url=原始订阅链接, tag=过滤节点, enabled=true
```

## 📊 性能与限制

- **免费额度**：Cloudflare Workers 免费版每日 100,000 次请求
- **响应时间**：通常 < 100ms（全球边缘网络）
- **支持格式**：V2Ray、Trojan、Shadowsocks、ShadowsocksR 等主流协议
- **并发处理**：自动处理高并发请求

## 🛠️ 开发与调试

### 本地测试

```bash
# 使用 curl 测试 API
curl -X GET "https://your-worker.workers.dev/?url=test_subscription_url" \
  -H "Accept: application/json"

# 测试错误处理
curl -X GET "https://your-worker.workers.dev/" \
  -H "Accept: application/json"
```

### 查看日志

在 Cloudflare Dashboard 中：

1. 进入 Workers 页面
2. 选择你的 Worker
3. 点击 "Logs" 标签查看实时日志

### 错误排除

| 错误信息 | 可能原因 | 解决方案 |
| --- | --- | --- |
| 缺少必要参数: url | 未提供订阅链接 | 检查 URL 参数是否正确 |
| 获取订阅失败 | 订阅链接无效或网络问题 | 验证原始订阅链接 |
| 处理失败 | 订阅内容格式问题 | 检查订阅内容格式 |

## 📝 更新日志

### v1.0.0 (2025-09-19)

- 🎉 初始版本发布
- ✅ 支持 50+ 个国家和地区识别
- ✅ 中英文输出切换
- ✅ 自定义前后缀配置
- ✅ 智能过滤和节点名称优化
- ✅ Cloudflare Workers 部署支持

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支：`git checkout -b feature/AmazingFeature`
3. 提交更改：`git commit -m 'Add some AmazingFeature'`
4. 推送分支：`git push origin feature/AmazingFeature`
5. 提交 Pull Request

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源协议。

## 🙏 致谢

- 感谢 [@weekin](https://github.com/weekin) 的原始 Shadow Rocket 脚本
- 感谢 [Cloudflare Workers](https://workers.cloudflare.com/) 提供的强大平台
- 感谢所有贡献者和用户的支持

## 📞 支持与反馈

- 📮 **Issue**: [GitHub Issues](https://github.com/your-username/subscription-filter/issues)
- 💬 **讨论**: [GitHub Discussions](https://github.com/your-username/subscription-filter/discussions)
- 📧 **邮箱**: [your-email@example.com](mailto:your-email@example.com)

---

**⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！**
