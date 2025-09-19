/*
# @ScriptName        优化版Shadowrocket节点名称过滤脚本
# @Author            基于@weekin原版优化
# @UpdateTime        2025/09/20
# @Function          高性能节点名称处理，模块化设计，更好的性能和可维护性
*/

// ============= 配置区域 =============
const CONFIG = {
    language: "EN", // "EN" 或 "CN"
    prefix: "➥",
    suffix: "ᵐᵗ",
    enableUniqueness: true,
    caseSensitive: false,
    maxCacheSize: 500 // 防止内存泄漏
};

// ============= 完整国家地区映射 =============
const REGION_MAPPINGS = {
    US: {
        keywords: ["美国", "美國", "US", "洛杉矶", "洛杉磯", "西雅图", "纽约", "芝加哥", "Atlanta", "States", "American", "Los Angeles", "Seattle", "New York", "Chicago"],
        names: { EN: "🇺🇸US", CN: "🇺🇸美国" }
    },
    HK: {
        keywords: ["港", "香港", "HK", "Hong Kong"],
        names: { EN: "🇭🇰HK", CN: "🇭🇰香港" }
    },
    SG: {
        keywords: ["新加坡", "狮城", "SG", "Singapore"],
        names: { EN: "🇸🇬SG", CN: "🇸🇬新加坡" }
    },
    TW: {
        keywords: ["台", "台湾", "台北", "高雄", "TW", "Taiwan", "Taipei", "Kaohsiung"],
        names: { EN: "🇨🇳TW", CN: "🇨🇳台湾" }
    },
    JP: {
        keywords: ["日", "东京", "大阪", "名古屋", "JP", "Tokyo", "Japan", "Osaka", "Nagoya"],
        names: { EN: "🇯🇵JP", CN: "🇯🇵日本" }
    },
    KR: {
        keywords: ["韩国", "首尔", "釜山", "KR", "Korea", "Seoul", "Busan"],
        names: { EN: "🇰🇷KR", CN: "🇰🇷韩国" }
    },
    TR: {
        keywords: ["土耳其", "伊斯坦布尔", "安卡拉", "TR", "Turkey", "Istanbul", "Ankara"],
        names: { EN: "🇹🇷TR", CN: "🇹🇷土耳其" }
    },
    IE: {
        keywords: ["爱尔兰", "都柏林", "IE", "Ireland", "Dublin"],
        names: { EN: "🇮🇪IRL", CN: "🇮🇪爱尔兰" }
    },
    AU: {
        keywords: ["澳", "悉尼", "墨尔本", "布里斯班", "AU", "Australia", "Sydney", "Melbourne", "Brisbane"],
        names: { EN: "🇦🇺AU", CN: "🇦🇺澳大利亚" }
    },
    FR: {
        keywords: ["法国", "巴黎", "里昂", "马赛", "FR", "France", "Paris", "Lyon", "Marseille"],
        names: { EN: "🇫🇷FRA", CN: "🇫🇷法国" }
    },
    SE: {
        keywords: ["瑞典", "斯德哥尔摩", "哥德堡", "SE", "Sweden", "Stockholm", "Gothenburg"],
        names: { EN: "🇸🇪SE", CN: "🇸🇪瑞典" }
    },
    DE: {
        keywords: ["德国", "法兰克福", "柏林", "慕尼黑", "DE", "Germany", "Frankfurt", "Berlin", "Munich"],
        names: { EN: "🇩🇪DE", CN: "🇩🇪德国" }
    },
    GB: {
        keywords: ["英国", "伦敦", "曼彻斯特", "伯明翰", "GB", "UK", "United Kingdom", "London", "Manchester", "Birmingham"],
        names: { EN: "🇬🇧GB", CN: "🇬🇧英国" }
    },
    IN: {
        keywords: ["印度", "孟买", "德里", "班加罗尔", "IN", "India", "Mumbai", "Delhi", "Bangalore"],
        names: { EN: "🇮🇳IN", CN: "🇮🇳印度" }
    },
    CA: {
        keywords: ["加拿大", "多伦多", "温哥华", "蒙特利尔", "CA", "Canada", "Toronto", "Vancouver", "Montreal"],
        names: { EN: "🇨🇦CA", CN: "🇨🇦加拿大" }
    },
    ES: {
        keywords: ["西班牙", "马德里", "巴塞罗那", "ES", "Spain", "Madrid", "Barcelona"],
        names: { EN: "🇪🇸ES", CN: "🇪🇸西班牙" }
    },
    IT: {
        keywords: ["意大利", "罗马", "米兰", "那不勒斯", "IT", "Italy", "Rome", "Milan", "Naples"],
        names: { EN: "🇮🇹IT", CN: "🇮🇹意大利" }
    },
    NL: {
        keywords: ["荷兰", "阿姆斯特丹", "鹿特丹", "NL", "Netherlands", "Amsterdam", "Rotterdam"],
        names: { EN: "🇳🇱NL", CN: "🇳🇱荷兰" }
    },
    CH: {
        keywords: ["瑞士", "苏黎世", "日内瓦", "CH", "Switzerland", "Zurich", "Geneva"],
        names: { EN: "🇨🇭CH", CN: "🇨🇭瑞士" }
    },
    RU: {
        keywords: ["俄罗斯", "莫斯科", "圣彼得堡", "RU", "Russia", "Moscow", "Saint Petersburg"],
        names: { EN: "🇷🇺RU", CN: "🇷🇺俄罗斯" }
    },
    BR: {
        keywords: ["巴西", "圣保罗", "里约热内卢", "BR", "Brazil", "São Paulo", "Rio de Janeiro"],
        names: { EN: "🇧🇷BR", CN: "🇧🇷巴西" }
    },
    ZA: {
        keywords: ["南非", "约翰内斯堡", "开普敦", "ZA", "South Africa", "Johannesburg", "Cape Town"],
        names: { EN: "🇿🇦ZA", CN: "🇿🇦南非" }
    },
    MX: {
        keywords: ["墨西哥", "墨西哥城", "瓜达拉哈拉", "MX", "Mexico", "Mexico City", "Guadalajara"],
        names: { EN: "🇲🇽MX", CN: "🇲🇽墨西哥" }
    },
    AR: {
        keywords: ["阿根廷", "布宜诺斯艾利斯", "AR", "Argentina", "Buenos Aires"],
        names: { EN: "🇦🇷AR", CN: "🇦🇷阿根廷" }
    },
    PL: {
        keywords: ["波兰", "华沙", "克拉科夫", "PL", "Poland", "Warsaw", "Krakow"],
        names: { EN: "🇵🇱PL", CN: "🇵🇱波兰" }
    },
    TH: {
        keywords: ["泰国", "曼谷", "清迈", "TH", "Thailand", "Bangkok", "Chiang Mai"],
        names: { EN: "🇹🇭TH", CN: "🇹🇭泰国" }
    },
    MY: {
        keywords: ["马来西亚", "吉隆坡", "槟城", "MY", "Malaysia", "Kuala Lumpur", "Penang"],
        names: { EN: "🇲🇾MY", CN: "🇲🇾马来西亚" }
    },
    VN: {
        keywords: ["越南", "河内", "胡志明", "VN", "Vietnam", "Hanoi", "Ho Chi Minh"],
        names: { EN: "🇻🇳VN", CN: "🇻🇳越南" }
    },
    PH: {
        keywords: ["菲律宾", "马尼拉", "PH", "Philippines", "Manila"],
        names: { EN: "🇵🇭PH", CN: "🇵🇭菲律宾" }
    },
    EG: {
        keywords: ["埃及", "开罗", "EG", "Egypt", "Cairo"],
        names: { EN: "🇪🇬EG", CN: "🇪🇬埃及" }
    },
    SA: {
        keywords: ["沙特", "利雅得", "吉达", "SA", "Saudi Arabia", "Riyadh", "Jeddah"],
        names: { EN: "🇸🇦SA", CN: "🇸🇦沙特阿拉伯" }
    },
    AE: {
        keywords: ["阿联酋", "迪拜", "阿布扎比", "AE", "UAE", "Dubai", "Abu Dhabi"],
        names: { EN: "🇦🇪AE", CN: "🇦🇪阿联酋" }
    },
    NO: {
        keywords: ["挪威", "奥斯陆", "NO", "Norway", "Oslo"],
        names: { EN: "🇳🇴NO", CN: "🇳🇴挪威" }
    },
    FI: {
        keywords: ["芬兰", "赫尔辛基", "FI", "Finland", "Helsinki"],
        names: { EN: "🇫🇮FI", CN: "🇫🇮芬兰" }
    },
    AT: {
        keywords: ["奥地利", "维也纳", "AT", "Austria", "Vienna"],
        names: { EN: "🇦🇹AT", CN: "🇦🇹奥地利" }
    },
    GR: {
        keywords: ["希腊", "雅典", "GR", "Greece", "Athens"],
        names: { EN: "🇬🇷GR", CN: "🇬🇷希腊" }
    },
    HU: {
        keywords: ["匈牙利", "布达佩斯", "HU", "Hungary", "Budapest"],
        names: { EN: "🇭🇺HU", CN: "🇭🇺匈牙利" }
    },
    CZ: {
        keywords: ["捷克", "布拉格", "CZ", "Czech", "Prague"],
        names: { EN: "🇨🇿CZ", CN: "🇨🇿捷克" }
    },
    NZ: {
        keywords: ["新西兰", "奥克兰", "NZ", "New Zealand", "Auckland"],
        names: { EN: "🇳🇿NZ", CN: "🇳🇿新西兰" }
    },
    NP: {
        keywords: ["尼泊尔", "加德满都", "NP", "Nepal", "Kathmandu"],
        names: { EN: "🇳🇵NP", CN: "🇳🇵尼泊尔" }
    },
    PT: {
        keywords: ["葡萄牙", "里斯本", "PT", "Portugal", "Lisbon"],
        names: { EN: "🇵🇹PT", CN: "🇵🇹葡萄牙" }
    },
    PK: {
        keywords: ["巴基斯坦", "伊斯兰堡", "PK", "Pakistan", "Islamabad"],
        names: { EN: "🇵🇰PK", CN: "🇵🇰巴基斯坦" }
    },
    IR: {
        keywords: ["伊朗", "德黑兰", "IR", "Iran", "Tehran"],
        names: { EN: "🇮🇷IR", CN: "🇮🇷伊朗" }
    },
    IQ: {
        keywords: ["伊拉克", "巴格达", "IQ", "Iraq", "Baghdad"],
        names: { EN: "🇮🇶IQ", CN: "🇮🇶伊拉克" }
    },
    DZ: {
        keywords: ["阿尔及利亚", "阿尔及尔", "DZ", "Algeria", "Algiers"],
        names: { EN: "🇩🇿DZ", CN: "🇩🇿阿尔及利亚" }
    },
    MA: {
        keywords: ["摩洛哥", "拉巴特", "MA", "Morocco", "Rabat"],
        names: { EN: "🇲🇦MA", CN: "🇲🇦摩洛哥" }
    },
    NG: {
        keywords: ["尼日利亚", "拉各斯", "NG", "Nigeria", "Lagos"],
        names: { EN: "🇳🇬NG", CN: "🇳🇬尼日利亚" }
    },
    CL: {
        keywords: ["智利", "圣地亚哥", "CL", "Chile", "Santiago"],
        names: { EN: "🇨🇱CL", CN: "🇨🇱智利" }
    },
    PE: {
        keywords: ["秘鲁", "利马", "PE", "Peru", "Lima"],
        names: { EN: "🇵🇪PE", CN: "🇵🇪秘鲁" }
    },
    CO: {
        keywords: ["哥伦比亚", "波哥大", "CO", "Colombia", "Bogotá"],
        names: { EN: "🇨🇴CO", CN: "🇨🇴哥伦比亚" }
    },
    RO: {
        keywords: ["罗马尼亚", "Romania", "RO", "Bucharest", "Cluj-Napoca", "Timișoara"],
        names: { EN: "🇷🇴RO", CN: "🇷🇴罗马尼亚" }
    },
    RS: {
        keywords: ["塞尔维亚", "Serbia", "RS", "Belgrade", "Novi Sad", "Niš"],
        names: { EN: "🇷🇸RS", CN: "🇷🇸塞尔维亚" }
    },
    LT: {
        keywords: ["立陶宛", "Lithuania", "LT", "Vilnius", "Kaunas", "Klaipėda"],
        names: { EN: "🇱🇹LT", CN: "🇱🇹立陶宛" }
    },
    GT: {
        keywords: ["危地马拉", "Guatemala", "GT", "Guatemala City", "Antigua Guatemala", "Quetzaltenango"],
        names: { EN: "🇬🇹GT", CN: "🇬🇹危地马拉" }
    },
    DK: {
        keywords: ["丹麦", "Denmark", "DK", "Copenhagen", "Aarhus", "Odense"],
        names: { EN: "🇩🇰DK", CN: "🇩🇰丹麦" }
    },
    UA: {
        keywords: ["乌克兰", "Ukraine", "UA", "Kyiv", "Lviv", "Odesa"],
        names: { EN: "🇺🇦UA", CN: "🇺🇦乌克兰" }
    },
    IL: {
        keywords: ["以色列", "Israel", "IL", "Jerusalem", "Tel Aviv", "Haifa"],
        names: { EN: "🇮🇱IL", CN: "🇮🇱以色列" }
    },
    EC: {
        keywords: ["厄瓜多尔", "Ecuador", "EC", "Quito", "Guayaquil", "Cuenca"],
        names: { EN: "🇪🇨EC", CN: "🇪🇨厄瓜多尔" }
    },
    CR: {
        keywords: ["哥斯达黎加", "Costa Rica", "CR", "San José", "Alajuela", "Cartago"],
        names: { EN: "🇨🇷CR", CN: "🇨🇷哥斯达黎加" }
    },
    CY: {
        keywords: ["塞浦路斯", "Cyprus", "CY", "Nicosia", "Limassol", "Larnaca"],
        names: { EN: "🇨🇾CY", CN: "🇨🇾塞浦路斯" }
    },
    BE: {
        keywords: ["比利时", "Belgium", "BE", "Brussels", "Antwerp", "Ghent"],
        names: { EN: "🇧🇪BE", CN: "🇧🇪比利时" }
    },
    BO: {
        keywords: ["玻利维亚", "Bolivia", "BO", "Sucre", "La Paz", "Santa Cruz"],
        names: { EN: "🇧🇴BO", CN: "🇧🇴玻利维亚" }
    }
};

// ============= 过滤关键词 =============
const FILTER_KEYWORDS = [
    "广告", "过期", "无效", "测试", "备用", "官网", "账号", "有效期", "群",
    "到期", "刷新", "剩余", "电报", "会员", "解锁", "流量", "超时",
    "订阅", "佣金", "免翻", "节点", "下载", "更新", "点外", "重置",
    "免流", "Days", "Date", "Expire", "Premium", "建议", "免费",
    "套餐", "版本", "已用", "失联", "官方", "网址", "TEST", "客服",
    "网站", "获取", "机场", "下次", "官址", "联系", "邮箱", "工单",
    "学术", "USE", "USED", "TOTAL", "EMAIL"
];

// ============= 保留关键词映射 =============
const PRESERVE_KEYWORDS = {
    "ChatGPT": "GPT",
    "OpenAI": "AI"
};

// ============= 核心处理类 =============
class NodeNameProcessor {
    constructor() {
        this.compiledFilterRegexes = this.compileFilterRegexes();
        this.compiledRegionRegexes = this.compileRegionRegexes();
        this.compiledPreserveRegexes = this.compilePreserveRegexes();
        this.nameCounter = globalThis.nodeNameCounter || (globalThis.nodeNameCounter = new Map());
        this.lastCleanup = 
