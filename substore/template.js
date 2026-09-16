/**
 * SubStore 脚本操作 —— 把订阅节点注入 sing-box 模板的 outbounds
 * ------------------------------------------------------------
 * 适配你上传的模板结构（双跳链路）：
 *   🌐 入口选择   （空 outbounds，需塞入"全部机场入口节点"）
 *   ☁️ GCP出口   （空 outbounds，需塞入"自建 GCP 出口节点"：AnyTLS/TUIC5/Hysteria2/VLESS-Reality；
 *                这几个节点本身会被打上 detour: "🌐 入口选择"，实现 入口→出口 的链式代理）
 *   🇭🇰 香港 / 🇹🇼 台湾 / 🇸🇬 新加坡 / 🇯🇵 日本 / 🇺🇸 美国
 *                （手动选择组，原本只有一个"-自动测速"条目，现在会把该地区的具体节点也塞进去，
 *                方便手动指定某一个节点而不是只能选自动测速组）
 *   🇭🇰 香港-自动测速 / 🇹🇼 台湾-自动测速 / 🇸🇬 新加坡-自动测速 / 🇯🇵 日本-自动测速 / 🇺🇸 美国-自动测速
 *                （均为空 outbounds 的 urltest 组，按节点名正则分地区塞入）
 *
 * 用法：
 * 1. Sub-Store → 文件管理 → 新建文件，来源选"本地"，粘贴你的 sing-box 模板 JSON（即 11.json 的内容）。
 * 2. 该文件的"处理脚本"里添加一步"脚本"：来源选"本地"直接粘贴本文件内容，或把本文件托管到
 *    GitHub/Gist 后用"链接"方式引入。
 * 3. 改下面 CONFIG 里的 entryName / exitName 为你在 Sub-Store 里实际的订阅/组合订阅名称，
 *    exitRegex 按你 4 个自建节点的命名习惯调整。
 * 4. 如果不想改代码，也可以在 Sub-Store 脚本参数面板里传 entryName / exitName / exitRegex /
 *    entryType / exitType 覆盖 CONFIG（同名参数优先级更高）。
 * 5. 保存后访问该文件链接，得到的就是已经注入好节点的完整 sing-box 配置。
 */

// ======================== 按需修改这里 ========================
const CONFIG = {
  // 入口（机场）订阅名称：Sub-Store 里"订阅"或"组合订阅"的名字
  entryName: 'ALL',
  entryType: 'collection', // 'subscription' 单条订阅 | 'collection' 组合订阅

  // 自建 GCP 出口节点来源：可以是独立订阅名，也可以和 entryName 填一样
  // （填一样时，会用 exitRegex 从入口订阅里再筛一遍，挑出自建的那 4 个节点）
  exitName: 'googlecloud',
  exitType: 'subscription',
  exitRegex: /GCP|AnyTLS|TUIC|Hysteria2|Reality/i,

  // 是否把 SSR / Snell 等 sing-box 不支持的协议也转换进来（一般不需要）
  includeUnsupportedProxy: false,

  // 链式代理：GCP 出口节点是否 detour 经过 "🌐 入口选择"（true = 入口→出口 两跳；false = 出口节点直连落地）
  chainExitThroughEntry: true,

  // 模板里对应分组的 tag（按你的模板原样，一般不用改）
  entryOutboundTag: /^🌐 入口选择$/,
  exitOutboundTag: /^☁️ GCP出口$/,
  regions: [
    { manualTag: /^🇭🇰 香港$/, autoTag: /^🇭🇰 香港-自动测速$/, nodeRegex: /港|HK|Hong ?Kong/i },
    { manualTag: /^🇹🇼 台湾$/, autoTag: /^🇹🇼 台湾-自动测速$/, nodeRegex: /台|TW|Taiwan/i },
    { manualTag: /^🇸🇬 新加坡$/, autoTag: /^🇸🇬 新加坡-自动测速$/, nodeRegex: /^(?!.*(?:美|US)).*(新|SG|Singapore)/i },
    { manualTag: /^🇯🇵 日本$/, autoTag: /^🇯🇵 日本-自动测速$/, nodeRegex: /日|JP|Japan/i },
    { manualTag: /^🇺🇸 美国$/, autoTag: /^🇺🇸 美国-自动测速$/, nodeRegex: /美|US|United ?States/i },
  ],
}
// ============================================================

function log(v) {
  console.log(`[📦 sing-box 节点注入] ${v}`)
}

log('🚀 开始')

const args = typeof $arguments !== 'undefined' ? $arguments : {}
const entryName = args.entryName || CONFIG.entryName
const entryType = /^(1|col|collection|组合)$/i.test(args.entryType || CONFIG.entryType)
  ? 'collection'
  : 'subscription'
const exitName = args.exitName || CONFIG.exitName
const exitType = /^(1|col|collection|组合)$/i.test(args.exitType || CONFIG.exitType)
  ? 'collection'
  : 'subscription'
const exitRegex = args.exitRegex ? new RegExp(args.exitRegex, 'i') : CONFIG.exitRegex

// ① 解析模板
const parser = ProxyUtils.JSON5 || JSON
let config
try {
  config = parser.parse($content ?? $files[0])
} catch (e) {
  throw new Error(`模板不是合法的 ${ProxyUtils.JSON5 ? 'JSON5' : 'JSON'}：${e.message ?? e}`)
}
if (!Array.isArray(config.outbounds)) config.outbounds = []
if (!Array.isArray(config.endpoints)) config.endpoints = []

// ② 拉取订阅并转换成 sing-box outbound 结构
async function fetchProxies(name, type) {
  const raw = await produceArtifact({
    name,
    type,
    platform: 'sing-box',
    produceOpts: { 'include-unsupported-proxy': CONFIG.includeUnsupportedProxy },
  })
  const data = JSON.parse(raw)
  return { outbounds: data.outbounds ?? [], endpoints: data.endpoints ?? [] }
}

log(`② 拉取入口订阅：${entryName}（${entryType}）`)
const entryData = await fetchProxies(entryName, entryType)

let exitData
if (exitName === entryName) {
  log('③ GCP 出口与入口同源，按 exitRegex 从入口节点池中筛选')
  exitData = { outbounds: entryData.outbounds.filter(p => exitRegex.test(p.tag)), endpoints: [] }
} else {
  log(`③ 拉取 GCP 出口订阅：${exitName}（${exitType}）`)
  exitData = await fetchProxies(exitName, exitType)
}
log(`入口节点 ${entryData.outbounds.length} 个，GCP 出口节点 ${exitData.outbounds.length} 个`)

// 入口/地区分组要用的节点池：如果出口和入口同源，必须把自建出口节点排除掉，
// 否则一旦启用链式代理（detour），"🌐 入口选择"里选到自建出口节点自己，就会形成 detour 自环，
// sing-box 校验配置时会直接报错拒绝启动
const entryPool = exitName === entryName
  ? entryData.outbounds.filter(p => !exitRegex.test(p.tag))
  : entryData.outbounds

// ③ 工具函数
function findGroups(regex) {
  return config.outbounds.filter(o => regex.test(o.tag))
}
function insertTags(groups, tags) {
  groups.forEach(g => {
    if (!Array.isArray(g.outbounds)) g.outbounds = []
    tags.forEach(t => {
      if (!g.outbounds.includes(t)) g.outbounds.push(t)
    })
  })
}

// ④ 入口选择：塞入全部入口节点（若出口和入口同源，已在上面的 entryPool 里排除了自建出口节点，
//    避免它们既是入口候选又 detour 回自己）
const entryGroups = findGroups(CONFIG.entryOutboundTag)
insertTags(entryGroups, entryPool.map(p => p.tag))
// 实际的入口分组 tag 字面量（正常情况下就是 "🌐 入口选择"），后面链式代理要用到
const entryTagLiteral = entryGroups[0]?.tag

// ⑤ GCP 出口：塞入自建出口节点
insertTags(findGroups(CONFIG.exitOutboundTag), exitData.outbounds.map(p => p.tag))

// ⑤.5 链式代理：给每个自建出口节点打上 detour，让它们的流量先走 "🌐 入口选择" 里选中的入口节点
if (CONFIG.chainExitThroughEntry && entryTagLiteral) {
  exitData.outbounds.forEach(p => {
    p.detour = entryTagLiteral
  })
  log(`⛓️ 已为 ${exitData.outbounds.length} 个 GCP 出口节点设置 detour → ${entryTagLiteral}`)
} else if (CONFIG.chainExitThroughEntry) {
  log('⚠️ 未找到入口分组，跳过链式代理 detour 设置，请检查 entryOutboundTag 是否匹配到模板中的分组')
}

// ⑥ 按地区分类，同时塞入"手动选择组"和"自动测速组"（每个节点只归入第一个匹配到的地区，避免重复计入）
const used = new Set()
CONFIG.regions.forEach(region => {
  const matched = entryPool
    .filter(p => !used.has(p.tag) && region.nodeRegex.test(p.tag))
    .map(p => {
      used.add(p.tag)
      return p.tag
    })
  insertTags(findGroups(region.manualTag), matched)
  insertTags(findGroups(region.autoTag), matched)
  log(`${region.autoTag} / ${region.manualTag} 匹配到 ${matched.length} 个节点`)
})

// ⑦ 空分组兜底：sing-box 不允许 selector/urltest 的 outbounds 为空数组，否则启动报错
// （手动选择组本身自带一个"-自动测速"条目，理论上不会真空，这里一并检查是为了兜底）
let compatibleInserted = false
const guardedTags = [
  CONFIG.entryOutboundTag,
  CONFIG.exitOutboundTag,
  ...CONFIG.regions.flatMap(r => [r.manualTag, r.autoTag]),
]
config.outbounds.forEach(o => {
  const isGuarded = guardedTags.some(r => r.test(o.tag))
  if (isGuarded && Array.isArray(o.outbounds) && o.outbounds.length === 0) {
    if (!compatibleInserted) {
      config.outbounds.push({ tag: 'COMPATIBLE', type: 'direct' })
      compatibleInserted = true
    }
    o.outbounds.push('COMPATIBLE')
    log(`⚠️ ${o.tag} 未匹配到任何节点，已插入 COMPATIBLE(direct) 占位，避免启动报错`)
  }
})

// ⑧ 把真实节点定义（含 endpoints）追加进配置，去重
const seenOutbound = new Set(config.outbounds.map(o => o.tag))
;[...entryData.outbounds, ...exitData.outbounds].forEach(p => {
  if (!seenOutbound.has(p.tag)) {
    config.outbounds.push(p)
    seenOutbound.add(p.tag)
  }
})
const seenEndpoint = new Set(config.endpoints.map(e => e.tag))
;[...entryData.endpoints, ...exitData.endpoints].forEach(e => {
  if (!seenEndpoint.has(e.tag)) {
    config.endpoints.push(e)
    seenEndpoint.add(e.tag)
  }
})

$content = JSON.stringify(config, null, 2)
log('✅ 结束')