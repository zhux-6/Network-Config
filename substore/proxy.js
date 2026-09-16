/**
 * Sub-Store 脚本操作
 * ------------------------------------------------------------
 * 功能：
 * 1. 从指定的「单条订阅」或「组合订阅」获取入口节点
 * 2. 从指定的「单条订阅」或「组合订阅」获取 GCP 出口节点
 * 3. 入口和出口可以来自不同订阅，也可以来自同一个订阅
 * 4. 如果入口和出口使用同一个来源，则使用 exitRegex 筛选 GCP 节点
 * 5. GCP 出口节点可自动设置 detour，实现：
 *
 *      入口节点 → GCP 出口
 *
 * 6. 自动填充：
 *      🌐 入口选择
 *      ☁️ GCP出口
 *      🇭🇰 香港
 *      🇹🇼 台湾
 *      🇸🇬 新加坡
 *      🇯🇵 日本
 *      🇺🇸 美国
 *
 * 7. 所有关键配置均支持通过 Sub-Store 脚本参数覆盖。
 *
 * ============================================================
 *
 * 参数：
 *
 * entryName
 *   入口订阅/组合订阅名称
 *
 * entryType
 *   入口类型：
 *   subscription = 单条订阅
 *   collection   = 组合订阅
 *
 * exitName
 *   GCP 出口订阅/组合订阅名称
 *
 * exitType
 *   GCP 出口类型：
 *   subscription = 单条订阅
 *   collection   = 组合订阅
 *
 * exitRegex
 *   当 entryName === exitName 时，
 *   用这个正则从入口节点中筛选 GCP 出口。
 *
 * chainExitThroughEntry
 *   true  = 入口 → GCP 两跳
 *   false = GCP 出口直接连接
 *
 * includeUnsupportedProxy
 *   true / false
 *
 * ============================================================
 *
 * 示例：
 *
 * ① 机场组合 → GCP单独订阅
 *
 * entryName=ALL
 * entryType=collection
 * exitName=googlecloud
 * exitType=subscription
 *
 * ② 单个机场 → GCP单独订阅
 *
 * entryName=机场A
 * entryType=subscription
 * exitName=googlecloud
 * exitType=subscription
 *
 * ③ 一个组合订阅里同时包含机场和GCP
 *
 * entryName=ALL
 * entryType=collection
 * exitName=ALL
 * exitType=collection
 * exitRegex=GCP|AnyTLS|TUIC|Hysteria2|Reality
 *
 * ④ 入口 → GCP 两跳
 *
 * chainExitThroughEntry=true
 *
 * ⑤ GCP直接落地
 *
 * chainExitThroughEntry=false
 */

// ============================================================
// 默认配置
// ============================================================

const CONFIG = {

  // ==========================================================
  // 入口
  // ==========================================================

  // Sub-Store 中的订阅/组合订阅名称
  entryName: 'ALL',

  // subscription = 单条订阅
  // collection   = 组合订阅
  entryType: 'collection',


  // ==========================================================
  // GCP 出口
  // ==========================================================

  // 可以与 entryName 相同
  exitName: 'googlecloud',

  // subscription = 单条订阅
  // collection   = 组合订阅
  exitType: 'subscription',

  // 当 exitName === entryName 时，
  // 从入口节点中筛选 GCP 节点
  exitRegex: /GCP|AnyTLS|TUIC|Hysteria2|Reality/i,


  // ==========================================================
  // 其它功能
  // ==========================================================

  // 是否允许转换 sing-box 默认不支持的协议
  includeUnsupportedProxy: false,

  // true：
  //
  //     你的电脑
  //        ↓
  //     入口节点
  //        ↓
  //     GCP
  //
  // false：
  //
  //     你的电脑
  //        ↓
  //     GCP
  //
  chainExitThroughEntry: true,


  // ==========================================================
  // 模板中的分组
  // ==========================================================

  entryOutboundTag: /^🌐 入口选择$/,

  exitOutboundTag: /^☁️ GCP出口$/,


  // ==========================================================
  // 地区节点匹配
  // ==========================================================

  regions: [

    {
      manualTag: /^🇭🇰 香港$/,
      autoTag: /^🇭🇰 香港-自动测速$/,
      nodeRegex: /港|HK|Hong ?Kong/i,
    },

    {
      manualTag: /^🇹🇼 台湾$/,
      autoTag: /^🇹🇼 台湾-自动测速$/,
      nodeRegex: /台|TW|Taiwan/i,
    },

    {
      manualTag: /^🇸🇬 新加坡$/,
      autoTag: /^🇸🇬 新加坡-自动测速$/,

      // 排除美国节点，避免 US 匹配 SG
      nodeRegex: /^(?!.*(?:美|US)).*(新|SG|Singapore)/i,
    },

    {
      manualTag: /^🇯🇵 日本$/,
      autoTag: /^🇯🇵 日本-自动测速$/,
      nodeRegex: /日|JP|Japan/i,
    },

    {
      manualTag: /^🇺🇸 美国$/,
      autoTag: /^🇺🇸 美国-自动测速$/,
      nodeRegex: /美|US|United ?States/i,
    },

  ],

}


// ============================================================
// 工具函数
// ============================================================

function log(v) {
  console.log(`[📦 sing-box 节点注入] ${v}`)
}


// ============================================================
// 获取 Sub-Store 参数
// ============================================================

const args =
  typeof $arguments !== 'undefined'
    ? $arguments
    : {}


// ============================================================
// 参数解析函数
// ============================================================

function getString(name, defaultValue) {

  const value = args[name]

  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ''
  ) {
    return defaultValue
  }

  return String(value).trim()
}


function getType(name, defaultValue) {

  const value = getString(name, defaultValue)

  if (
    /^(1|col|collection|组合)$/i.test(value)
  ) {
    return 'collection'
  }

  return 'subscription'
}


function getBoolean(name, defaultValue) {

  const value = args[name]

  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return defaultValue
  }

  if (typeof value === 'boolean') {
    return value
  }

  return /^(1|true|yes|on|是|开启)$/i.test(
    String(value).trim()
  )
}


// ============================================================
// 最终配置
// ============================================================

const entryName = getString(
  'entryName',
  CONFIG.entryName
)

const entryType = getType(
  'entryType',
  CONFIG.entryType
)


const exitName = getString(
  'exitName',
  CONFIG.exitName
)

const exitType = getType(
  'exitType',
  CONFIG.exitType
)


const exitRegex = args.exitRegex
  ? new RegExp(
      String(args.exitRegex),
      'i'
    )
  : CONFIG.exitRegex


const includeUnsupportedProxy =
  getBoolean(
    'includeUnsupportedProxy',
    CONFIG.includeUnsupportedProxy
  )


const chainExitThroughEntry =
  getBoolean(
    'chainExitThroughEntry',
    CONFIG.chainExitThroughEntry
  )


// ============================================================
// 输出参数状态
// ============================================================

log('🚀 开始')

log(
  `入口：${entryName} (${entryType})`
)

log(
  `出口：${exitName} (${exitType})`
)

log(
  `GCP筛选：${exitRegex}`
)

log(
  `链式代理：${chainExitThroughEntry ? '开启' : '关闭'}`
)

log(
  `允许不支持协议：${includeUnsupportedProxy ? '是' : '否'}`
)


// ============================================================
// 解析模板
// ============================================================

const parser =
  ProxyUtils.JSON5 || JSON

let config

try {

  config = parser.parse(
    $content ?? $files[0]
  )

} catch (e) {

  throw new Error(
    `模板不是合法的 ${
      ProxyUtils.JSON5
        ? 'JSON5'
        : 'JSON'
    }：${
      e.message ?? e
    }`
  )

}


if (!Array.isArray(config.outbounds)) {
  config.outbounds = []
}


if (!Array.isArray(config.endpoints)) {
  config.endpoints = []
}


// ============================================================
// 拉取订阅
// ============================================================

async function fetchProxies(
  name,
  type
) {

  const raw =
    await produceArtifact({

      name,

      type,

      platform: 'sing-box',

      produceOpts: {
        'include-unsupported-proxy':
          includeUnsupportedProxy,
      },

    })


  const data =
    JSON.parse(raw)


  return {

    outbounds:
      data.outbounds ?? [],

    endpoints:
      data.endpoints ?? [],

  }

}


// ============================================================
// 入口订阅
// ============================================================

log(
  `② 拉取入口订阅：${entryName}（${entryType}）`
)

const entryData =
  await fetchProxies(
    entryName,
    entryType
  )


// ============================================================
// GCP 出口订阅
// ============================================================

let exitData


if (
  exitName === entryName
) {

  log(
    '③ GCP 与入口同源，按照 exitRegex 筛选 GCP 节点'
  )


  exitData = {

    outbounds:
      entryData.outbounds.filter(
        p => exitRegex.test(p.tag)
      ),

    endpoints: [],

  }

} else {

  log(
    `③ 拉取 GCP 出口订阅：${exitName}（${exitType}）`
  )


  exitData =
    await fetchProxies(
      exitName,
      exitType
    )

}


log(
  `入口节点：${entryData.outbounds.length} 个`
)

log(
  `GCP出口节点：${exitData.outbounds.length} 个`
)


// ============================================================
// 入口节点池
// ============================================================
//
// 如果入口和出口来自同一个订阅：
//
//     ALL
//      ├─ 台湾节点
//      ├─ 香港节点
//      ├─ 美国节点
//      └─ GCP
//
// GCP 节点不能同时作为入口。
// 否则：
//
//     GCP → detour → 入口选择 → 自己
//
// 会产生 detour 自环。
//

const entryPool =
  exitName === entryName

    ? entryData.outbounds.filter(
        p => !exitRegex.test(p.tag)
      )

    : entryData.outbounds


// ============================================================
// 找模板分组
// ============================================================

function findGroups(regex) {

  return config.outbounds.filter(
    o => regex.test(o.tag)
  )

}


// ============================================================
// 向分组添加节点
// ============================================================

function insertTags(
  groups,
  tags
) {

  groups.forEach(g => {

    if (!Array.isArray(g.outbounds)) {
      g.outbounds = []
    }


    tags.forEach(t => {

      if (
        !g.outbounds.includes(t)
      ) {
        g.outbounds.push(t)
      }

    })

  })

}


// ============================================================
// 入口选择
// ============================================================

const entryGroups =
  findGroups(
    CONFIG.entryOutboundTag
  )


insertTags(
  entryGroups,
  entryPool.map(
    p => p.tag
  )
)


const entryTagLiteral =
  entryGroups[0]?.tag


// ============================================================
// GCP 出口分组
// ============================================================

insertTags(

  findGroups(
    CONFIG.exitOutboundTag
  ),

  exitData.outbounds.map(
    p => p.tag
  )

)


// ============================================================
// 设置 detour
// ============================================================

if (
  chainExitThroughEntry &&
  entryTagLiteral
) {

  exitData.outbounds.forEach(
    p => {

      p.detour =
        entryTagLiteral

    }
  )


  log(
    `⛓️ 已设置 ${
      exitData.outbounds.length
    } 个 GCP 节点 detour → ${
      entryTagLiteral
    }`
  )

} else if (
  chainExitThroughEntry
) {

  log(
    '⚠️ 没有找到入口分组，无法设置 detour'
  )

}


// ============================================================
// 地区分类
// ============================================================

const used =
  new Set()


CONFIG.regions.forEach(
  region => {

    const matched =
      entryPool

        .filter(
          p =>
            !used.has(p.tag) &&
            region.nodeRegex.test(
              p.tag
            )
        )

        .map(
          p => {

            used.add(
              p.tag
            )

            return p.tag

          }
        )


    // 手动选择组
    insertTags(

      findGroups(
        region.manualTag
      ),

      matched

    )


    // 自动测速组
    insertTags(

      findGroups(
        region.autoTag
      ),

      matched

    )


    log(
      `${region.autoTag} / ${region.manualTag}：${matched.length} 个节点`
    )

  }
)


// ============================================================
// 空分组保护
// ============================================================

let compatibleInserted =
  false


const guardedTags = [

  CONFIG.entryOutboundTag,

  CONFIG.exitOutboundTag,

  ...CONFIG.regions.flatMap(
    r => [
      r.manualTag,
      r.autoTag,
    ]
  ),

]


config.outbounds.forEach(
  o => {

    const isGuarded =
      guardedTags.some(
        r => r.test(o.tag)
      )


    if (
      isGuarded &&
      Array.isArray(o.outbounds) &&
      o.outbounds.length === 0
    ) {

      if (
        !compatibleInserted
      ) {

        config.outbounds.push({

          tag: 'COMPATIBLE',

          type: 'direct',

        })

        compatibleInserted =
          true

      }


      o.outbounds.push(
        'COMPATIBLE'
      )


      log(
        `⚠️ ${o.tag} 没有匹配节点，加入 COMPATIBLE`
      )

    }

  }
)


// ============================================================
// 添加真实节点
// ============================================================

const seenOutbound =
  new Set(
    config.outbounds.map(
      o => o.tag
    )
  )


;[
  ...entryData.outbounds,
  ...exitData.outbounds,
].forEach(
  p => {

    if (
      !seenOutbound.has(
        p.tag
      )
    ) {

      config.outbounds.push(
        p
      )

      seenOutbound.add(
        p.tag
      )

    }

  }
)


// ============================================================
// 添加 endpoints
// ============================================================

const seenEndpoint =
  new Set(
    config.endpoints.map(
      e => e.tag
    )
  )


;[
  ...entryData.endpoints,
  ...exitData.endpoints,
].forEach(
  e => {

    if (
      !seenEndpoint.has(
        e.tag
      )
    ) {

      config.endpoints.push(
        e
      )

      seenEndpoint.add(
        e.tag
      )

    }

  }
)


// ============================================================
// 输出
// ============================================================

$content =
  JSON.stringify(
    config,
    null,
    2
  )


log('✅ 结束')