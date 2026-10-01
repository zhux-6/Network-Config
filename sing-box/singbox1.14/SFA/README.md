> 2026-10-01：已更新为直连双栈、代理 IPv4 兼容方案。当前行为以本目录 IPV6.md 为准。

# sing-box for Android · 1.14.2

本模板面向普通、无需 root 的 SFA VpnService 模式，以官方 v1.14.2 文档和同版本内核为依据。保留原来的订阅注入组名、成员关系、默认选择及国内例外；本次没有修改 SFW 配置。

## 导入

1. 用本目录 singbox.json 更新 SubStore 的模板内容，重新注入入口、自建出口及地区节点。
2. 更新手机 SFA 实际加载的配置，再重启服务。仅修改仓库文件不会自动替换手机里的配置。
3. 原模板的空 selector/urltest 数组必须先填充。检查注入脚本是否因缺少节点而插入 COMPATIBLE/direct；那会把应代理的连接变成直连。
4. schema-1.14.2.json 是固定版本的编辑器辅助文件，源于官方内核生成结果；手机运行只需要注入后的 JSON，不需要读取这个 Schema。

原 API 本机监听地址、端口和令牌保留。不要把混合代理或控制 API 改成向整个局域网开放后仍不加认证。日志保持 warn，排错时可临时改成 info，复现后恢复。

## Android 专属处理

- 移除 interface_name：SFA 接口名由 Android 管理。
- 移除 strict_route：官方 SFA 支持表标为未实现，不能靠它宣称防 DNS 泄漏。
- 移除 exclude_interface：普通 SFA 无相应接口管理权限，也不固定 wlan1/ap0 等设备名。
- 不添加 Bridge、Linux bypass/auto_redirect、固定接口或 override_android_vpn。Bridge 需要特权，普通 SFA 的 VPN 模式不满足该前提。
- 保持 auto_route、auto_detect_interface 和系统默认网络选择，不强制 Wi-Fi/移动数据并发。连接迁移仍可能触发重连，不能承诺切网不断流。
- 保留 mixed 栈、MTU 1500、UDP NAT 上限 4096；不采用未经手机实测的大 MTU 或额外心跳。
- 自动测速统一为 5 分钟，闲置超时 10 分钟；保留原测速地址、容差和自动切换不中断已有入站连接的设置。相比原台湾组 2 分钟测速减少探测频率，代价是发现劣化可能更慢；SFA 面板主动测速可能有不同触发行为。

官方 Android 功能表还包含旧地址字段名称；实际 JSON 使用 1.14.2 通用配置手册中的 address，没有恢复旧的 inet4_address 等废弃字段。

## 日常分流

| 场景 | 策略 |
|---|---|
| B站、抖音、腾讯、阿里、虎牙、国内游戏 | 优先国内真实 DNS 和 DIRECT，保留原来的具体例外优先级 |
| 小米/MIUI/小米云、你原有的自定义域名 | 国内解析并直连 |
| Steam 国内节点、Steam/Epic 指定下载域名 | steam@cn、steamcontent.com、steamserver.net 等优先直连，覆盖宽泛游戏集合 |
| Steam/Epic 其他服务、境外游戏集合 | 真实 DNS，进入游戏组；游戏组仍默认 DIRECT，可手动选代理 |
| YouTube、AI、社交及其他代理网站 | 客户端 A 查询使用 FakeIP，连接按原服务组选择节点 |
| Google FCM 推送 | googlefcm 使用远程真实 DNS，连接归 Google 组；保留长连接能力，不按端口强制直连 |
| Android 常见联网检查域名 | connectivitycheck.android.com / connectivitycheck.gstatic.com 使用远程真实 DNS 和 Google 组，不伪造 204、不放行整个 gstatic.com |
| NAS、打印机、路由器 | 私有地址直连；私有域名、单标签、.lan/.local/.home.arpa 使用 Local-DNS 和本地解析出站 |
| 国内游戏加速器 | Local-DNS + LAN-DIRECT，嗅探前后都保留该例外 |
| 通话、语音、联机、QUIC | 取消宽泛 STUN/DTLS/QUIC 封锁；UDP 路由超时 5 分钟。节点是否支持 UDP 仍决定实际可用性 |

加速器直连规则不代表能同时运行两个 Android VPN。若另一加速器也申请 VpnService，可能替换 SFA，取决于客户端和系统。局域网规则也不会自动提供 mDNS、组播发现或热点共享。

## DNS 与性能取舍

- 国内、局域网、游戏、FCM 使用真实 IP；适合代理的网站使用 FakeIP，仅处理客户端 A 查询。内部解析和 TXT/MX/PTR 不进入 FakeIP。
- 两家国内 DoH、两家远程 DoH分别竞速，减少原来的三家远程竞速。只允许 NOERROR 抢答；NXDOMAIN 等待竞争判定；两路失败返回 SERVFAIL。
- 公网 DNS 规则移除查询携带的 ECS，不固定伪造位置。
- 没有未知域名两秒预查询：已知国内规则处理之后，未分类客户端 A 查询直接使用 FakeIP。这减少额外查询与等待，代价是未收录的国内站点可能进入漏网之鱼；需要时添加精确国内例外。
- 已知代理/未分类域名可先分配 FakeIP，再在连接时发现域名不存在；不声称每条 FakeIP 都代表可访问网站。
- 保留 16384 条缓存、5 分钟乐观缓存和 DNS/FakeIP 磁盘缓存，使用独立 cache_id。本地名称与加速器不使用过期缓存，但新鲜缓存仍可能存在；切网异常时可尝试重启服务以排查旧连接。
- 国内直连与本地域名支持 AAAA；代理及未分类域名保留 IPv4 兼容策略。HTTPS/SVCB 仍返回空响应；详见 IPV6.md。

规则模式下游戏 DNS 经主节点组查询，即使游戏组选择 DIRECT，也可能依赖主代理完成首次解析；本模板不是独立游戏加速器。

## 模式、网络与后台

- rule：以上分流。
- global：本地名称/私有地址例外以外交给 GLOBAL；游戏、FCM、联网检查的真实 DNS 同样经 GLOBAL，其他客户端 A 查询主要使用 FakeIP。
- direct：本地例外以外直连，公网 DNS 使用阿里。
- 保持原来的 GCP 出口默认选择和两跳注入方案。模板不能修复入口到出口的握手延迟；前面日志已出现过链路慢，手机遇到类似症状也应单独对比单跳与两跳。
- 公共 Wi-Fi 门户可能需要先暂停 SFA、完成网络登录，再启动。系统探测可能绑定底层网络，不保证所有探测都经过本配置；不修改 ROM 的检测地址。
- FCM 真实解析并不保证锁屏消息及时。SFA 后台运行权限、系统电池限制、Google Play 服务状态及节点稳定性都影响推送；不把整个 Play 服务包粗放排除出 VPN。
- SFA 的“按应用代理”界面可覆盖 include/exclude_package。未配置应用白名单/黑名单，避免把浏览器、支付或消息应用无意绕过规则。银行/支付异常应先定位具体域名或应用，不默认全部绕过。
- Android 私人 DNS、浏览器安全 DNS、其他 VPN 可能改变实际 DNS 路径。需要严格验证本模板分流时，确认请求确实进入 SFA；不得把当前配置等同于所有应用均无 DNS 泄漏。

## 规则下载

沿用原来的 CDN 地址、48 小时更新间隔和直连 HTTP 下载方式，明确提供阿里引导解析器；没有恢复已撤销的“规则下载经入口代理”更改。

首次启动仍需 CDN 和引导 DNS 可用，没有缓存时下载超时可能阻止启动。context canceled 常是其他任务失败后引发的取消，不等于每个规则集都损坏。没有内置远程规则离线副本。

## 验证与边界

- 官方 1.14.2 Windows 内核对填充占位节点的副本执行 check，通过；占位节点不写入正式模板。
- 使用同版本内核、已校验的 51 个实际 SRS 和本机模拟上游，53 项 DNS 测试通过。
- 使用本机标记出站，50 项路由测试通过，包括原始国内例外、FCM、联网检查、Steam 商店/下载、三种模式分别运行、直接连 IP 后嗅探域名。未测试同一进程切换模式后的应用缓存与现有连接。
- Android 不支持字段、Bridge 缺席、组成员保持和下载策略均做了静态核对。
- 这些是通用内核行为验证，不能替代 SFA VpnService 真机测试；没有验证真实手机的锁屏、Doze、Wi-Fi/移动网络切换、IPv6、耗电或节点 UDP 性能。

## 官方依据

- [v1.14.2 Android 支持范围](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/clients/android/features.md)
- [TUN](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/inbound/tun.md)、[Bridge 的特权要求](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/outbound/bridge.md)
- [DNS 规则](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/dns/rule.md)、[DNS 动作](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/dns/rule_action.md)、[本地 DNS](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/dns/server/local.md)
- [网络选择](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/shared/dial.md)、[UDP NAT](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/shared/udp-nat.md)、[自动测速](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/outbound/urltest.md)
- [Google 官方 Android 网络需求：FCM 与联网检查](https://support.google.com/work/android/answer/10513641?hl=en)
