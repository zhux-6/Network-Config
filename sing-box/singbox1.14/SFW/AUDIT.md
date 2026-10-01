> 2026-10-01 B站访问故障修正：已完整移除 Bridge 出站及两条 Bridge 路由，国内连接使用普通 DIRECT，保留双栈。本文旧的 Bridge 启用描述为历史状态，已不适用。

> 本文较早的 IPv4-only 结论已由 2026-10-01 双栈更新取代，见 IPV6.md；历史哈希不再代表当前文件。

# Windows 模板复审 · 2026-09-30

依据官方仓库 v1.14.2 固定标签文档和同版本 Windows 内核。审查 DNS、路由顺序、Bridge 预匹配、订阅组、缓存、API、下载引导和日常使用边界。此文件记录已验证的结论，不承诺所有网络和软件组合无故障。

## 本轮发现与处理

| 问题 | 处理与取舍 |
|---|---|
| 未分类小众国内网站可能被代理绕路 | 按用户选择恢复 unknown_location：远程解析最多两秒，国内 IP 复用真实响应，其余 FakeIP；NXDOMAIN 保留。允许乐观缓存减少重复访问等待。 |
| JetBrains 域名可能连接后才从 HTTP/TLS 中被识别 | 在嗅探后、国内服务例外前补充 JetBrains 规则，与嗅探前规则配合；不添加应用进程匹配。 |
| 已知境外集合不需要额外地域判断 | 恢复 geolocation-!cn 作为预查询排除条件，远程 SRS 共 53 个。 |
| DNS 策略改变后可能沿用旧持久缓存 | 改用 sfw-1.14.2-reviewed-v3 缓存标识；操作系统与应用缓存不受该标识控制。 |

## 日常场景审查

| 场景 | 结果与边界 |
|---|---|
| 网页、YouTube、AI、社交 | 代理域名优先于宽泛国内地理集合；保持混合 DNS。解除 QUIC 封锁已保留，但节点 UDP 质量差时视频仍可能慢。 |
| Steam / Epic | 国内下载域名和 steam@cn 优先直连，商店等进入游戏组。游戏组默认仍为 DIRECT，组名不保证实际选的是代理。 |
| 游戏、语音、联机 | 不统一丢弃 STUN/DTLS；UDP NAT 与路由超时一致。运营商 NAT、服务端端口和节点 UDP 支持仍影响联机。 |
| JetBrains、GitHub、GitLab、Docker Registry | 已验证代表域名进入 Github 组；JetBrains 使用域名集合，不匹配进程。第三方插件外链和包下载 CDN 不保证属于这些集合。 |
| npm / pip / Maven / Cargo / Go 等 | 按实际域名处理，未分类公网域名通常走漏网之鱼；不粗放代理所有 Java/Python/Git 进程，也不把公共 CDN 整段分给 Github。项目私有镜像需按真实域名添加例外。 |
| 本地开发、数据库、NAS、打印机 | 私有 IP、本地名称优先本地处理。公开域名指向私网的自建服务，以及公司自定义 DNS 后缀，仍需专门配置，不能靠单标签规则覆盖。 |
| Windows 更新和账号登录 | 下载域名直连例外保留；其他微软服务归微软组。NCSI 使用本地 DNS/本地出站。 |
| Git SSH 与 IDE 终端 | 已知 GitHub 域名按 Github 分流；代理须支持目标端口。IDE 发起的子进程不因此获得单独应用代理规则。 |
| WSL / Docker / 虚拟机 | 域名测试不证明虚拟网卡流量被宿主机 TUN 接管。127.0.0.1:7897 是宿主本机监听，不保证容器能访问；没有擅自改成公网或全局域网监听。 |
| 公司 VPN、其他加速器、公共 Wi-Fi 门户 | 路由、DNS 和驱动可能冲突。strict_route 保留但不保证与每个虚拟网卡兼容；门户必要时暂停代理登录。 |

## Bridge 与版本约束

两条 Bridge 规则保留 tun-in、preferred_by 和 FakeIP 排除，位于嗅探前；模式规则优先。不能将嗅探后的普通 TCP/UDP 流量送入 Bridge；普通 mixed 入口仍走四层出站。实际 Bridge 需要相应权限与可用驱动，未通过本轮模拟测试验证。可在国内直连组手动选 DIRECT 排查 Bridge 路径问题。

保持现有 IPv4 方案，本轮不混入尚未实测的双栈改动。保持原组成员、默认选择、节点注入流程及 CDN 直连规则下载。规则下载与 SFW 获取远程配置是不同路径；首次无缓存时 CDN 故障仍可能阻止启动。

## 实际验证

- 官方 1.14.2 内核 check 通过；检查副本填充本机 SOCKS 占位节点，正式模板不包含占位节点。
- 64 项 DNS 测试、62 项路由测试通过，含三种模式分别运行、负响应竞速、原国内例外和新增开发服务域名。
- 使用缓存的实际 SRS、本机模拟 DNS 和标记出站；未开启真实 TUN/Bridge、连接真实节点或变更系统网络。
- 静态确认规则集引用、Bridge 门控、模式优先级、无应用进程规则；原出站组及入站配置保持不变。
- 没有验证真实游戏 UDP、视频吞吐、公司内网、模式实时切换后已有连接、WSL/容器流量或断网恢复。

## 使用

singbox.json 是完整配置模板，仍需订阅注入补全空节点组，再用 Check-Config.ps1 检查注入结果。加载后确认 Github、游戏和主节点组的实际选择。若网页仍慢，应对比入口直出与 GCP 两跳，DNS 规则不能修复节点链路本身的握手延迟。

## 固定版本依据

- [DNS 规则](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/dns/rule.md)、[DNS 动作](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/dns/rule_action.md)
- [路由规则](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/route/rule.md)、[路由动作](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/route/rule_action.md)
- [TUN](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/inbound/tun.md)、[Bridge](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/outbound/bridge.md)、[预匹配](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/shared/pre-match.md)
- [拨号字段](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/shared/dial.md)、[UDP NAT](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/shared/udp-nat.md)、[缓存](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/experimental/cache-file.md)

## 乐观缓存方案确认

全局 optimistic.enabled=true、timeout=3d，与 1.14.2 开启后的默认窗口一致。三天是过期缓存允许使用的窗口，不是固定刷新周期。未知域名判断不再设置 disable_optimistic_cache；局域网、本地名称及加速器继续禁用乐观缓存，联网检测禁用缓存。首次无缓存仍可能等待两秒；旧地址失效时可能先连接失败，后台刷新不是连接成功保证。

新增模拟 DNS 完全不答复的测试，确认未知域名超时后返回 FakeIP。真实查询取决于主节点组；最终漏网之鱼可以另选节点，但本模板不承诺预查询总能完成。

## 后续完善：主备查询与缓存生命周期

未知域名由 Google 先查询，1 秒超时；仅失败、超时或 NXDOMAIN 时继续 Cloudflare，1 秒超时。任一正常响应先按国内 IP 判断处理；主查询正常即不启动备用。两路均无正常响应时优先保留已取得的 NXDOMAIN，否则 FakeIP 兜底。这个约两秒预算是两次 DNS 查询超时之和，不是严格的端到端时限。两家依然共用主代理路径，不能解决主代理整体断连。

64 项 DNS 回归和 62 项路由回归通过；新增独立缓存生命周期测试通过，验证过期国内地址立即返回、触发延迟后台刷新、地址变为境外后下一次查询回到 FakeIP，以及正常查询不启动备用。使用 1 秒 TTL 加速复现，未做三天持续运行或系统/浏览器缓存测试。

## B站日志证据与修复边界

用户提供 logs-2026-10-01-17.35.31.txt：第 657–682 行 www.bilibili.com 的乐观 DNS 答复为 0ms，随后 IPv6 目标被预匹配交给 bridge-out；第 704 行刷新后仍返回同一 IPv6 地址。图片资源 boss.hdslb.com 新查询约 16–17ms，随后同样进入 IPv6 Bridge。日志未含握手完成或响应时延，不能证明具体丢包原因；也没有证据把这次慢直接归因于三天缓存或远程未知域名查询。

结合此前 Bridge 端口预留启动失败，移除 Bridge 以排除该路径变量。保留原双栈与 DNS，未把所有国内站点强制 IPv4。国内直连选择组保留名称、成员改为仅 DIRECT，避免旧 Bridge 引用；普通路由由原国内域名/IP规则处理。实际页面是否恢复需用户加载注入后的新配置验证，不能凭离线检查宣称已解决。
