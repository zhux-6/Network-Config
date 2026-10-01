> 2026-10-01 B站访问故障修正：已完整移除 Bridge 出站及两条 Bridge 路由，国内连接使用普通 DIRECT，保留双栈。本文旧的 Bridge 启用描述为历史状态，已不适用。

> 2026-10-01：已更新为直连双栈、代理 IPv4 兼容方案。当前行为以本目录 IPV6.md 为准。

# Windows 日常使用模板 · sing-box 1.14.2

依据官方 v1.14.2 文档和实际 Windows 内核独立审查。目标是稳定、清晰分流和可解释的故障行为；不保证所有宽带、节点、游戏、VPN 与驱动组合都适用。

## 使用

1. 将 singbox.json 作为 SubStore 模板，沿用入口、GCP 出口和地区节点注入流程。空 selector/urltest 数组是模板接口，未经注入不能直接运行。
2. SFW 实际内核必须为 **1.14.2**。schema-1.14.2.json 由该内核生成，仅供编辑器校验，不跟随官网升级。单独上传配置 JSON 不影响内核运行。
3. API secret 已换为随机值，两个 API 使用同一个值，本机端口不变。已有面板需要更新令牌，值在配置的 experimental.clash_api.secret 中。不要公开含令牌的配置。
4. 注入后用检查脚本验证，不会开启 TUN 或修改系统路由：

```powershell
.\Check-Config.ps1 -Core 'C:\你的SFW目录\sing-box.exe' -Config 'C:\导出的配置\config.json'
```

脚本检查内核版本、空分组、出站引用、链路循环，并拒绝注入脚本产生的 COMPATIBLE/direct 兜底。现有 SubStore 脚本可能在缺少节点时插入它；应修复订阅与匹配条件，避免“启动成功但实际直连”。本次没有修改其他平台共用的注入脚本。

## 日常行为

| 场景 | 处理 |
|---|---|
| 国内网站、视频、支付 | 国内真实 DNS；适用的 TUN 连接走 Bridge，其余普通直连 |
| AI、海外视频、GitHub、社交服务 | 客户端 A 查询使用 FakeIP，按服务组选择节点 |
| Steam/Epic 商店与游戏服务 | 规则模式下，steam@cn 与下载域名例外优先使用国内真实 DNS 并直连（包括 steamserver.net）；其余 steam 商店与服务走游戏组。Steam 自身选择 CDN，直连并不保证一定连接国内物理服务器 |
| Windows 更新大文件 | download.windowsupdate.com、delivery.mp.microsoft.com 及子域名真实解析并直连，不把整个微软服务直连 |
| Office、微软登录、OneDrive | 保留微软组默认代理，增加 DIRECT 供手动选择 |
| NAS、打印机、路由器 | 非公网 IP 直连；私有名称、单标签、.lan/.local/.home.arpa 使用本地 DNS；HTTP/SOCKS 传入的本地名称也走本地解析出站 |
| Windows 联网检测 | 指定 NCSI 域名在全部模式下使用本地 DNS 与直连，避免由代理节点状态代替物理网络状态 |
| 通话、游戏 UDP、QUIC | 不统一封锁 STUN/DTLS/QUIC；UDP 路由超时设为 5 分钟，减少短暂静默后的映射失效 |
| NTP 校时 | 规则模式下 UDP/123 直连；global/direct 遵循模式 |
| HTTP/SOCKS 未分类域名 | 域名规则之后才真实解析，再按 IP 分类，避免没有 IP 时跳过国内 IP 规则 |

本地 DNS 依赖网络实际提供的解析能力，不会自动安装 mDNS 或发现设备。联网检测例外有助于门户提示，但不能保证所有公共 Wi-Fi 登录流程正常。UDP 能否通话、打游戏仍取决于节点、链路及 NAT。

## DNS

原始模板例外已复核：B站及 CDN/游戏、抖音、腾讯、阿里、虎牙、库洛、完美、国内游戏集合，以及 Steam 国内节点、Steam/Epic 下载、dcg.microsoft.com、jsDelivr 和自定义直连域名，均优先于宽泛代理规则。小米域名保留国内解析和直连。游戏加速器集合恢复 Local-DNS，HTTP/SOCKS 下也使用本地解析的直连出站。泛化的 cn/geolocation-cn 路由仍在具体服务分组之后，不将所有国内集合无差别前移。

从原始显式例外及实际规则集中抽取 25 个代表性地址，加入 DNS 与路由验证；没有穷举远程集合的所有域名。

采用国内/局域网/游戏 RealIP、代理服务 FakeIP 的混合方式，保留 IPv4 策略。

- AAAA 返回空 NOERROR；HTTPS/SVCB 也返回空响应，避免地址提示与 FakeIP/IPv4 策略冲突。这是取舍，会失去这些记录的部分能力，不代表版本不支持。
- hosts 和引导地址优先。本地名称、联网检测优先于模式切换；TXT/MX/PTR 不进入 FakeIP。
- 国内与远程真实 DNS 分别竞速。仅 NOERROR 抢答；NXDOMAIN 不抢在另一有效响应前面；两路失败返回 SERVFAIL，不将国内失败查询偷偷改成 FakeIP。
- 未分类且不属于 geolocation-!cn 的客户端 A 查询，先经 Google-DNS 判断，超时上限 1 秒；正常响应匹配 geoip-cn 时复用真实响应，否则 FakeIP。主查询失败、超时或 NXDOMAIN 时，再经 Cloudflare-DNS 核对，上限 1 秒；备用正常响应按同样方式处理。两者均无正常响应时，有 NXDOMAIN 则返回 NXDOMAIN，否则退回 FakeIP。两次超时预算合计约两秒，不能保证严格墙钟上限。该判断允许普通缓存和乐观缓存。地理判断不是可信性认证，混合国内外地址也可能命中；重要误判应添加精确例外。
- 地理分类不是污染检测或安全认证；一个响应中存在中国 IP 不代表整站或全部地址都在中国。已知代理域名不会先验证存在性再分配 FakeIP。
- 保留 16384 条缓存和 3 天乐观缓存。本地查询不使用过期缓存；联网检测不使用 DNS 缓存。新 cache_id 隔离旧策略的缓存空间，系统和浏览器缓存仍可能需要刷新。
- 公网 DNS 规则移除查询携带的 ECS，不伪造固定位置。
- 节点地址的默认引导解析器仍是阿里；订阅节点自身指定的 domain_resolver 优先。

游戏组选择 DIRECT 时，游戏真实 DNS 仍通过主代理查询，避免商店等域名污染；主代理失效可能影响部分游戏域名解析。这不等同于独立游戏加速器。

## Bridge 与路由

Bridge 仅用于 TUN 预匹配阶段，以 preferred_by 为门控，排除 FakeIP 和本机地址。取消仅凭国内 IP 提前进入 Bridge，避免在自带 DNS、缓存缺失、共享地址场景中抢在域名识别前分错流量。

大致顺序：无效地址/DNS/IPv6处理 → 局域网与联网检测 → 模式 → 国内域名 Bridge → 明确直连 → 嗅探与服务分组 → 未分类 HTTP/SOCKS 域名解析 → IP 分类 → 漏网之鱼。服务组优先于泛化国内集合；明确国内下载例外提前。

“🏠 国内直连”默认 Bridge，可切换 DIRECT，但只控制合格的 Bridge 流量，并非全部直连的总开关。Windows Bridge 需要管理员权限和可用的 WinDivert 支持；尚未实机开启 TUN 测试。

若 Bridge 初始化导致配置无法启动，仅切换 selector 可能无效。在副本删除两条 outbound 为“🏠 国内直连”的规则，再删除 bridge-out 和“🏠 国内直连”两个出站；后续 DIRECT 规则提供普通直连路径。

## 模式和边界

- rule：上述混合策略。
- global：局域网、联网检测以外走 GLOBAL；游戏真实 DNS 也经 GLOBAL，其他客户端 A 查询主要使用 FakeIP。
- direct：局域网、联网检测以外走 DIRECT，公网 DNS 使用阿里；不是 DNS 竞速模式。
- IPv4 模板不能访问仅支持 IPv6 的服务，不自动修改网卡设置。没有认证所有接口、其他 VPN 或应用自带 DoH 的防泄露表现。
- 浏览器自带 DoH 会绕过模板 DNS 分流；要获得可预测行为，应让浏览器使用系统 DNS。
- 普通代理节点通常不转发 ICMP，不能用代理域名 ping 失败判断网页不可用；没有为 ping 设置全局直连。
- strict_route 可能影响 VirtualBox 等应用。公司 VPN、WSL、Docker、虚拟机、远程桌面需结合实际路由测试，没有按进程全部放行。
- 自动测速反映指定 HTTP 地址，不等于游戏延迟、UDP 通畅或地区解锁。自动组切换时保留已有连接。
- 规则集首次下载仍依赖 CDN 与引导 DNS，不保证离线首次启动。
- 未新增广告拦截、TLS 改写、全局端口封锁或宽泛进程直连，以免影响登录、支付、验证码和会议。

## 验证

官方 Windows amd64 1.14.2 内核；检查副本填入本地 SOCKS 占位节点，正式模板仍保留空组。

- 内核配置检查通过，53 个实际远程 SRS 可被该内核解析。
- **64 项 DNS 测试**：模拟上游验证混合解析、负响应竞速、双上游失败、未知域名、NCSI、本地名称、下载、游戏冲突、hosts、AAAA/HTTPS、TXT 和三个模式。
- **62 项路由测试**：真实内核配合本地标记出站，验证 NAS/本机、NCSI、国内网站、AI/视频/GitHub、Windows 下载/登录、Steam、未知域名和三个模式。
- **4 项异常检查**：确认校验脚本拒绝空分组、COMPATIBLE/direct 兜底、出站循环和缺失引用；正常注入检查副本通过。
- 路由测试替换了真实出站并排除 Bridge；DNS 测试未开启 TUN。没有声称验证真实节点、驱动、UDP 穿透、休眠恢复、吞吐量或业务登录。

## 官方依据

- [1.14.2 版本](https://github.com/SagerNet/sing-box/releases/tag/v1.14.2)
- [DNS 规则](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/dns/rule.md)、[DNS 动作](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/dns/rule_action.md)、[缓存](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/dns/index.md)
- [路由动作](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/route/rule_action.md)、[Bridge](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/outbound/bridge.md)、[预匹配](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/shared/pre-match.md)
- [Windows TUN](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/inbound/tun.md)、[本地 DNS](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/dns/server/local.md)
- [Microsoft NCSI](https://learn.microsoft.com/en-us/windows-server/networking/ncsi/ncsi-frequently-asked-questions)

## 最终复审补充

Bridge 出站和默认选择已核对：两条 Bridge 规则均位于嗅探前，仅允许 tun-in，使用 preferred_by 门控并排除 FakeIP；模式切换优先于 Bridge。规则集引用与 DNS 重复规则检查通过。

补充验证直接连接 IP 后从 HTTP Host 识别域名的场景：Steam 商店、Steam 下载、AI、国内 IP 上的海外服务、游戏加速器均进入预期分组。游戏加速器在嗅探前后都使用 LAN-DIRECT。此测试验证四层分流，不替代 Windows TUN/WinDivert 实测。

游戏组沿用原模板默认 DIRECT；商店走游戏组不等于自动选择代理，需要在游戏组选择所需节点。下载例外在规则模式下优先直连，global 模式仍遵循 GLOBAL。
## JetBrains 域名分流补充

规则模式下，MetaCubeX `jetbrains` 规则集覆盖的服务进入 `📦 Github` 组；不按 CLion 或其他应用进程匹配。该域名规则位于国内直连和 Bridge 规则之前；保留局域网例外及 direct/global 模式原有语义。DNS FakeIP 分流及 Bridge 排除列表也包含 jetbrains。

这覆盖规则集内的 JetBrains 服务域名，并不等于 IDE 发起的所有连接都走代理。项目中的第三方仓库、插件外部地址、构建工具下载按各自域名规则处理。使用前重新注入订阅并加载模板，确认 Github 组选择了代理节点。

### 未知域名容错与缓存实测

主备依次查询，避免每个未知域名都双发查询。已测试主 DNS 超时、SERVFAIL、NXDOMAIN 后备用返回国内地址，以及两路不响应后回退 FakeIP。两家仍经过同一主节点组，不能替代代理链路容错。Google 正常返回时不向 Cloudflare 求证，地理库与地址混合的限制仍存在。

另用同版本内核、1 秒 TTL 的模拟记录验证：国内地址过期后立即返回旧地址并后台刷新；上游改成境外地址后，后续查询改为 FakeIP。此测试验证缓存机制，没有等待真实三天，也不保证当前旧地址连接成功。
