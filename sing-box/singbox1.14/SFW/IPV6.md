> 2026-10-01 B站访问故障修正：已完整移除 Bridge 出站及两条 Bridge 路由，国内连接使用普通 DIRECT，保留双栈。本文旧的 Bridge 启用描述为历史状态，已不适用。

# IPv6 更新 · 1.14.2 · 2026-10-01

采用直连双栈、代理 IPv4 兼容方案，适配用户 VPS 无 IPv6 出网的条件。不是所有目的地都开放 IPv6。

## 当前行为

- TUN address 增加 fdfe:dcba:9876::1/126；auto_route 保留，移除统一 IPv6 拒绝规则。不使用旧 inet6_address。
- dns.strategy 改为 prefer_ipv4，允许双栈解析并优先 IPv4；应用自己处理 A/AAAA 时的地址选择仍取决于应用。
- 私有域名、本地名称、明确国内直连集合，以及未被代理集合覆盖的 cn/geolocation-cn，可返回真实 AAAA。国内 DNS 竞速保留。
- 已知代理服务、游戏代理集合、未分类域名的 AAAA 返回空 NOERROR，防止通常的 DNS 流程向 IPv4-only 出口交付真实 IPv6。FakeIP 继续只对 A 使用，不添加虚假的 IPv6 能力。
- direct 模式允许公共 AAAA；global 模式除前置本地/系统联网检测例外外抑制 AAAA，匹配现有出口限制。
- HTTP/SOCKS 未分类域名的后置 resolve 显式使用 ipv4_only，避免真实境外 IPv6 地址交给 VPS。这里是 route resolve 的有效 strategy，不是已弃用的 DNS 动作 strategy。
- 保留 HTTPS/SVCB 空答复，避免地址提示绕过既定解析策略；相应协议能力仍有取舍。
- 节点组、订阅接口、国内下载优先级和规则下载路径保持；没有进程规则。更新缓存标识，系统和浏览器已有缓存需要另行刷新或重启应用。

## 网络条件与边界

本地宽带/移动网络必须实际提供可用 IPv6。TUN 的 ULA 地址不创造运营商 IPv6，也不是设备对外出口地址。国内 IPv6-only 域名只有在允许真实 AAAA 的规则范围内才可用；未分类 IPv6-only 网站仍受限制，可以按实际目的地添加精确直连例外。

IPv4-only VPS 无法访问代理侧 IPv6-only 网站。应用绕过本 DNS、自带 IPv6 字面地址时，仍按路由规则处理，不能承诺代理可达；不会因为出口不支持而无条件放行 IPv6 直连。真实注入节点的解析和服务端策略仍需核对。

本地 IPv6、链路本地地址的接口 scope、多播发现、WSL/容器与系统私人 DNS 不是单靠上述字段就能保证正确。没有修改系统网络、启用真实 TUN 或测试运营商 IPv6。

## 验证

同版本内核检查通过。72 项 DNS、66 项路由模拟测试通过：包含国内 AAAA、局域网 AAAA、Steam 下载 AAAA、代理 AAAA 空答复、direct/global 模式差异、IPv6 回环和国内 IPv6 地址路由，以及原 IPv4 场景。占位节点仅用于检查副本。真实 Windows Bridge/Android VPN、节点吞吐与切网尚未实测。

## 官方固定版本依据

- [TUN address](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/inbound/tun.md)
- [DNS strategy](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/dns/index.md)
- [route resolve](https://github.com/SagerNet/sing-box/blob/v1.14.2/docs/configuration/route/rule_action.md)

Windows 保留 strict_route 和既有 Bridge 门控；Bridge 仍仅用于预匹配且排除 FakeIP。未知 A 域名仍走远程主备判断、三天乐观缓存；未知 AAAA 不参与该地域探测。
