> 本文较早的 IPv4-only 结论已由 2026-10-01 双栈更新取代，见 IPV6.md；历史哈希不再代表当前文件。

# 1.14.2 二次审查记录

审查对象为本目录 singbox.json；依据官方仓库 v1.14.2 标签下的文档、同版本生成的 Schema 和同版本内核。没有把官网后续版本新增能力套入本模板。本次复核未发现需要继续修改 JSON 的确定性问题，不为增加条目而改变已验证行为。

模板 SHA256：`93910acc719b4ce74be170bc4f4373b3f822fd1a1be5cb48fb726cac0bc5e643`。

## 逐项结论

| 审查项 | 结论与依据 |
|---|---|
| Android 权限 | 普通 VpnService 模式；移除 Android 不支持的接口名、strict_route 和接口排除，不引入需要特权的 Bridge。 |
| DNS 新结构 | 使用带 type 的 DNS 服务器与 domain_resolver；没有使用旧 address_resolver，也没有在 DNS 动作中添加已弃用的 strategy。全局 dns.strategy 不属于该弃用字段。 |
| DNS 竞速 | evaluate 在顶层先定义响应，race/respond 引用响应；正常答复竞争、NXDOMAIN 按顺序收尾、上游均失败返回 SERVFAIL。不是对每条 DNS 答复真实性的认证。 |
| 缓存 | 使用 cache_file.store_dns/store_fakeip；不使用已弃用的 store_rdrc 或 Clash API 旧缓存字段。 |
| 国内优先 | 原有具体国内服务、游戏国内集合、Steam 国内下载和自定义域名优先于宽泛代理集合；嗅探后再次应用关键例外。 |
| 应用兼容 | 不粗放拦截 STUN/DTLS/QUIC；FCM 和游戏使用真实解析，但不能补足节点缺失的 UDP 能力。 |
| 组与订阅 | 对照原 SFA 模板检查，原 selector/urltest 成员、默认选择保持一致；空节点组仍须由订阅填充。 |
| 启动依赖 | 保持 CDN 直连下载，未恢复用户撤销的代理下载改动。无缓存且 CDN 不通仍会启动失败。 |
| 控制接口 | 保持本机监听和原令牌；API、dashboard、共享 HTTP client 字段均对照固定版本文档。 |

## 验证覆盖

同版本内核检查通过；本机模拟上游与真实 SRS 的既有回归结果为 53 项 DNS、50 项路由通过。二次复核另检查了组成员与默认值、标签重复、Android 不支持字段、Bridge 缺席和规则下载策略。

测试使用 Windows 版相同内核，只验证通用 DNS/路由逻辑；用本机监听和模拟出站替换真实手机网络。不能据此宣称已经验证 Android TUN、锁屏推送、后台耗电、手机切网、真实代理链路或所有应用的 DNS 路径。

## 保留的明确取舍

1. IPv4 方案与 AAAA/HTTPS/SVCB 空答复保留原设计；不适合作为 IPv6-only 网络的保证。
2. 未收录国内域名可能获得 FakeIP 并进入漏网之鱼；优先增加精确例外，避免把大类代理服务误放直连。
3. 游戏及 FCM 的远程 DNS 依赖主节点组；独立选择游戏/Google 出站不会自动改变其 DNS 上游路径。
4. 自动测速值只代表测试地址的连通表现，不保证视频吞吐；两跳链路握手慢不是增加 DNS 规则就能修复的。
5. 三种模式分别验证，不把缓存中的旧连接、应用自带安全 DNS、Android 私人 DNS 或 VPN 排除应用算作已验证覆盖。

## 固定版本官方手册

- [Android 功能与限制](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/clients/android/features.md)
- [TUN](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/inbound/tun.md)、[Bridge](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/outbound/bridge.md)
- [DNS 规则](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/dns/rule.md)、[DNS 动作](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/dns/rule_action.md)、[DoH](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/dns/server/https.md)
- [路由动作](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/route/rule_action.md)、[规则集](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/rule-set/index.md)
- [缓存](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/experimental/cache-file.md)、[API](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/service/api.md)、[HTTP client](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/shared/http-client.md)
- [UDP NAT](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/shared/udp-nat.md)、[自动测速](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/outbound/urltest.md)
