/**
 * Sub-Store 文件脚本：输入 $content ?? $files[0]，输出 $content。
 * 模板负责 DNS/TUN/route/default，脚本负责节点与出口 detour。
 * 参数：entryName/entryType/exitName/exitType/exitRegex/
 *       chainExitThroughEntry/includeUnsupportedProxy。
 * exitRegex 仅用于同名且同类型来源，填写正则正文，不含 /.../。
 * 必需入口/出口缺失报错；空地区组裁剪；不生成 COMPATIBLE/direct。
 */
const CONFIG = {
  entryName: 'ALL', entryType: 'collection',
  exitName: 'googlecloud', exitType: 'subscription',
  // 机场也有 AnyTLS/Hysteria2/Reality，不能用协议名判定 GCP。
  exitRegex: /GCP|谷歌云|Google[ -]?Cloud/i,
  chainExitThroughEntry: true, includeUnsupportedProxy: false,
  entryOutboundTag: /^🌐 入口选择$/, exitOutboundTag: /^☁️ GCP出口$/,
  regions: [
    { manualTag: /^🇭🇰 香港$/, autoTag: /^🇭🇰 香港-自动测速$/, nodeRegex: /香港|港(?=\d|\s|[-_])|🇭🇰|(?:^|[^A-Za-z])(?:HK|Hong[ -]?Kong)(?=$|[^A-Za-z])/i },
    { manualTag: /^🇹🇼 台湾$/, autoTag: /^🇹🇼 台湾-自动测速$/, nodeRegex: /台湾|台灣|台(?=\d|\s|[-_])|🇹🇼|(?:^|[^A-Za-z])(?:TW|Taiwan)(?=$|[^A-Za-z])/i },
    { manualTag: /^🇸🇬 新加坡$/, autoTag: /^🇸🇬 新加坡-自动测速$/, nodeRegex: /新加坡|狮城|🇸🇬|(?:^|[^A-Za-z])(?:SG|Singapore)(?=$|[^A-Za-z])/i },
    { manualTag: /^🇯🇵 日本$/, autoTag: /^🇯🇵 日本-自动测速$/, nodeRegex: /日本|东京|東京|大阪|日(?=\d|\s|[-_])|🇯🇵|(?:^|[^A-Za-z])(?:JP|Japan)(?=$|[^A-Za-z])/i },
    { manualTag: /^🇺🇸 美国$/, autoTag: /^🇺🇸 美国-自动测速$/, nodeRegex: /美国|美國|美(?=\d|\s|[-_])|🇺🇸|(?:^|[^A-Za-z])(?:US|USA|United[ -]?States)(?=$|[^A-Za-z])/i },
  ],
}
function log(message) { console.log(`[sing-box 节点注入] ${message}`) }
function fail(message) { throw new Error(`[sing-box 节点注入] ${message}`) }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
const args = typeof $arguments !== 'undefined' && $arguments != null ? $arguments : {}
if (!isObject(args)) fail('$arguments 必须是 Sub-Store 提供的参数对象')
function getString(name, fallback) {
  const value = args[name]
  if (value == null) return fallback
  if (!['string', 'number'].includes(typeof value)) fail(`${name} 必须是字符串`)
  if (String(value).trim() === '') return fallback
  return String(value).trim()
}
function getType(name, fallback) {
  const value = getString(name, fallback)
  if (/^(1|col|collection|组合)$/i.test(value)) return 'collection'
  if (/^(0|sub|subscription|订阅|单条订阅)$/i.test(value)) return 'subscription'
  fail(`${name} 只能是 subscription 或 collection`)
}
function getBoolean(name, fallback) {
  const value = args[name]
  if (value == null || (typeof value === 'string' && value.trim() === '')) return fallback
  if (typeof value === 'boolean') return value
  if (/^(1|true|yes|on|是|开启)$/i.test(String(value).trim())) return true
  if (/^(0|false|no|off|否|关闭)$/i.test(String(value).trim())) return false
  fail(`${name} 必须明确填写 true 或 false`)
}
const entryName = getString('entryName', CONFIG.entryName), entryType = getType('entryType', CONFIG.entryType)
const exitName = getString('exitName', CONFIG.exitName), exitType = getType('exitType', CONFIG.exitType)
const sameSource = entryName === exitName && entryType === exitType
const chainExitThroughEntry = getBoolean('chainExitThroughEntry', CONFIG.chainExitThroughEntry)
const includeUnsupportedProxy = getBoolean('includeUnsupportedProxy', CONFIG.includeUnsupportedProxy)
let exitRegex
try {
  const p = getString('exitRegex', null)
  if (p !== null && /^\/.*\/[a-z]*$/i.test(p)) fail('请填写正则正文，不含 /.../i')
  exitRegex = p === null ? CONFIG.exitRegex : new RegExp(p, 'i')
}
catch (error) { fail('exitRegex 不是有效正则，请填写正则正文') }

// 保持官方文件脚本接口，不改成订阅节点 operator/proxies 接口。
const parser = typeof ProxyUtils !== 'undefined' && ProxyUtils.JSON5 ? ProxyUtils.JSON5 : JSON
const input = typeof $content !== 'undefined' && $content != null ? $content : typeof $files !== 'undefined' ? $files[0] : undefined
if (typeof input !== 'string' || !input.trim()) fail('没有模板文本，请在文件内容/远程文件来源中配置 sing-box 模板')
let config
try { config = parser.parse(input) } catch (error) { fail('模板不是合法 JSON/JSON5，请检查模板文件') }
if (!isObject(config) || !Array.isArray(config.outbounds)) fail('模板必须是包含 outbounds 数组的 sing-box 配置对象')
if (config.endpoints === undefined) config.endpoints = []
if (!Array.isArray(config.endpoints)) fail('模板 endpoints 必须是数组')
function validateDefinition(node, label) {
  if (!isObject(node) || typeof node.tag !== 'string' || !node.tag.trim() || typeof node.type !== 'string' || !node.type.trim()) fail(`${label} 存在缺少合法 tag/type 的定义`)
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (isObject(value)) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}'
  return JSON.stringify(value)
}
function unique(nodes, label) {
  const map = new Map()
  for (const node of nodes) {
    validateDefinition(node, label)
    const previous = map.get(node.tag)
    if (previous && canonical(previous) !== canonical(node)) fail(`${label} 存在同名不同配置：${node.tag}；请在源订阅先重命名`)
    if (!previous) map.set(node.tag, node)
  }
  if (map.size !== nodes.length) log(`${label} 合并 ${nodes.length - map.size} 个完全相同的重复 tag`)
  return [...map.values()]
}
const templateTags = new Set()
for (const node of [...config.outbounds, ...config.endpoints]) {
  validateDefinition(node, '模板')
  if (templateTags.has(node.tag)) fail(`模板有重复 tag：${node.tag}`)
  templateTags.add(node.tag)
  if (node.tag === 'COMPATIBLE' && node.type === 'direct') fail('模板包含旧 COMPATIBLE/direct，请使用未注入的原模板')
}
function findGroups(regex) { return config.outbounds.filter(node => regex.test(node.tag)) }
function requiredGroup(regex, label) {
  const groups = findGroups(regex)
  if (groups.length !== 1 || groups[0].type !== 'selector' || !Array.isArray(groups[0].outbounds)) fail(`模板必须有一个 ${label} selector，且 outbounds 为数组`)
  return groups[0]
}
const entryGroup = requiredGroup(CONFIG.entryOutboundTag, '入口选择'), exitGroup = requiredGroup(CONFIG.exitOutboundTag, 'GCP出口')
async function fetchProxies(name, type) {
  let raw, data
  try { raw = await produceArtifact({ name, type, platform: 'sing-box', produceOpts: { 'include-unsupported-proxy': includeUnsupportedProxy } }) }
  catch (error) { fail(`读取 ${name} (${type}) 失败，请检查来源和 Sub-Store 后端日志`) }
  try { data = JSON.parse(raw) } catch (error) { fail(`${name} (${type}) 转换结果不是合法 JSON`) }
  if (!isObject(data) || !Array.isArray(data.outbounds) || (data.endpoints !== undefined && !Array.isArray(data.endpoints))) fail(`${name} (${type}) 未返回 sing-box outbounds/endpoints 数组`)
  const outbounds = unique(data.outbounds, name)
  for (const node of outbounds) if (['selector', 'urltest', 'direct', 'block', 'dns'].includes(node.type)) fail(`${name} 中 ${node.tag} 不是可注入的代理节点；请使用节点订阅而非完整配置`)
  const endpoints = unique(data.endpoints || [], `${name} endpoints`)
  const endpointTags = new Set(endpoints.map(node => node.tag))
  if (outbounds.some(node => endpointTags.has(node.tag))) fail(`${name} 的 outbound 与 endpoint 有重复 tag`)
  return { outbounds, endpoints }
}
log(`来源：${entryName} (${entryType}) / ${exitName} (${exitType})；链式代理 ${chainExitThroughEntry ? '开启' : '关闭'}`)
let entryData, exitData
if (sameSource) {
  entryData = await fetchProxies(entryName, entryType)
  exitData = { outbounds: entryData.outbounds.filter(node => exitRegex.test(node.tag)), endpoints: [] }
} else {
  // 独立来源并发转换；同源只请求一次。
  ;[entryData, exitData] = await Promise.all([fetchProxies(entryName, entryType), fetchProxies(exitName, exitType)])
}
if (exitData.outbounds.length === 0) fail('没有可用 GCP 出口节点；请检查出口来源或同源 exitRegex，不会回退 DIRECT')
const exitByTag = new Map(exitData.outbounds.map(node => [node.tag, node]))
let overlap = 0
const entryPool = entryData.outbounds.filter(node => {
  const exit = exitByTag.get(node.tag)
  if (!exit) return true
  if (canonical(node) !== canonical(exit)) fail(`入口/出口来源存在同名不同配置：${node.tag}；请先重命名`)
  overlap++; return false
})
if (entryPool.length === 0) fail('没有独立可用的入口节点；不能让 GCP 经入口组回到自己')
if (overlap) log(`从入口池排除 ${overlap} 个与出口重叠的节点`)
// 克隆后改 detour，避免同源对象共享造成入口定义被意外修改。
const exitNodes = JSON.parse(JSON.stringify(exitData.outbounds))
for (const node of exitNodes) { if (chainExitThroughEntry) node.detour = entryGroup.tag; else delete node.detour }
const injected = [...entryPool, ...exitNodes], endpoints = unique([...entryData.endpoints, ...exitData.endpoints], '合并 endpoints')
const definitions = new Map([...config.outbounds, ...config.endpoints].map(node => [node.tag, node]))
const definitionKinds = new Map([...config.outbounds.map(node => [node.tag, 'outbound']), ...config.endpoints.map(node => [node.tag, 'endpoint'])])
for (const [node, kind] of [...injected.map(node => [node, 'outbound']), ...endpoints.map(node => [node, 'endpoint'])]) {
  const previous = definitions.get(node.tag)
  if (previous && definitionKinds.get(node.tag) !== kind) fail(`outbound 与 endpoint tag 冲突：${node.tag}`)
  if (previous && canonical(previous) !== canonical(node)) fail(`订阅 tag 与模板/endpoint 冲突：${node.tag}；请先重命名或使用原模板`)
  if (!previous) { definitions.set(node.tag, node); definitionKinds.set(node.tag, kind) }
}
function insertTags(groups, tags) {
  for (const group of groups) {
    if (!['selector', 'urltest'].includes(group.type) || !Array.isArray(group.outbounds)) fail(`地区分组类型或成员数组错误：${group.tag}`)
    group.outbounds = [...new Set([...group.outbounds, ...tags])]
  }
}
insertTags([entryGroup], entryPool.map(node => node.tag)); insertTags([exitGroup], exitNodes.map(node => node.tag))
const classified = new Set(), optional = new Set(), automatic = []
for (const region of CONFIG.regions) {
  const tags = entryPool.filter(node => !classified.has(node.tag) && region.nodeRegex.test(node.tag)).map(node => node.tag)
  tags.forEach(tag => classified.add(tag))
  const manualGroups = findGroups(region.manualTag), autoGroups = findGroups(region.autoTag)
  insertTags([...manualGroups, ...autoGroups], tags)
  for (const group of [...manualGroups, ...autoGroups]) optional.add(group.tag)
  automatic.push(...autoGroups.map(group => group.tag)); log(`${region.manualTag}：${tags.length} 个入口节点`)
}
const existingOutbounds = new Set(config.outbounds.map(node => node.tag)), existingEndpoints = new Set(config.endpoints.map(node => node.tag))
for (const node of injected) if (!existingOutbounds.has(node.tag)) { config.outbounds.push(node); existingOutbounds.add(node.tag) }
for (const node of endpoints) if (!existingEndpoints.has(node.tag)) { config.endpoints.push(node); existingEndpoints.add(node.tag) }

// 仅裁剪空地区组，绝不引入隐式直连。
const removed = new Set()
let changed = true
while (changed) {
  changed = false
  for (const group of config.outbounds) {
    if (!['selector', 'urltest'].includes(group.type)) continue
    if (!Array.isArray(group.outbounds) || group.outbounds.some(tag => typeof tag !== 'string' || !tag)) fail(`无效成员数组：${group.tag}`)
    group.outbounds = group.outbounds.filter(tag => !removed.has(tag))
    if (optional.has(group.tag) && group.outbounds.length === 0 && !removed.has(group.tag)) { removed.add(group.tag); changed = true }
  }
}
config.outbounds = config.outbounds.filter(node => !removed.has(node.tag))
for (const group of config.outbounds) {
  if (!['selector', 'urltest'].includes(group.type)) continue
  group.outbounds = group.outbounds.filter(tag => !removed.has(tag))
  if (group.outbounds.length === 0) fail(`必需/业务组没有成员：${group.tag}`)
  if (removed.has(group.default)) {
    let fallback = group.outbounds[0]
    if (group === entryGroup) {
      fallback = automatic.find(tag => !removed.has(tag)) || fallback
      if (!group.outbounds.includes(fallback)) group.outbounds.unshift(fallback)
    }
    log(`${group.tag} 的默认组已移除，改为 ${fallback}`); group.default = fallback
  }
  if (group.default && !group.outbounds.includes(group.default)) fail(`default 不在组成员中：${group.tag}`)
}
if (removed.size) log(`删除空地区组：${[...removed].join('、')}；未加入直连占位`)

const nodes = new Map([...config.outbounds, ...config.endpoints].map(node => [node.tag, node]))
function validateReferences(value) {
  if (Array.isArray(value)) { value.forEach(validateReferences); return }
  if (!isObject(value)) return
  for (const key of ['detour', 'outbound']) if (value[key] !== undefined && value[key] !== '') {
    if (typeof value[key] !== 'string' || !nodes.has(value[key])) fail(`缺失或无效 ${key} 引用：${String(value[key])}`)
  }
  Object.values(value).forEach(validateReferences)
}
validateReferences(config)
const states = new Map()
function visit(tag, path) {
  if (!nodes.has(tag)) fail(`缺失出站/endpoint：${tag}`)
  if (states.get(tag) === 1) fail(`出站依赖循环：${[...path, tag].join(' → ')}`)
  if (states.get(tag) === 2) return
  states.set(tag, 1)
  const node = nodes.get(tag), edges = ['selector', 'urltest'].includes(node.type) ? [...node.outbounds] : []
  if (node.detour) edges.push(node.detour)
  for (const target of edges) visit(target, [...path, tag])
  states.set(tag, 2)
}
for (const tag of nodes.keys()) visit(tag, [])
$content = JSON.stringify(config, null, 2)
log(`完成：${entryPool.length} 个入口、${exitNodes.length} 个出口；引用/环检查通过。字段合法性仍以 sing-box 1.14.2 check 为准。`)
