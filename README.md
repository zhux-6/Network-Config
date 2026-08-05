# Network-Config

一个面向日常网络访问、游戏与跨区域网络环境的个人网络配置仓库。

本项目主要维护基于 **sing-box 1.14** 的配置文件、FakeIP 规则以及相关规则集，用于 Windows 与 Android 平台。

> **当前项目以个人实际使用与持续调试为主。**
> 配置并非通用“一键即用”方案，使用前请根据自己的节点、网络环境和需求进行调整。

---

## ✨ 项目特点

* 基于 **sing-box 1.14** 配置体系
* 同时提供 **SFA（Sing-box for Android）** 与 **SFW（Sing-box for Windows）** 配置
* TUN 模式接管网络流量
* DNS 分流
* 国内 / 国外域名分流
* FakeIP 与 Real IP 混合使用
* IPv4 / IPv6 流量控制
* 游戏域名与游戏平台规则
* AI、Google、Microsoft、YouTube、GitHub、Telegram、TikTok 等服务分类
* 独立维护 FakeIP Filter 规则
* JSON 源规则与编译后的规则文件分离
* 持续根据实际网络环境进行调整与优化

---

## 📁 目录结构

```text
Network-Config/
├── sing-box/
│   ├── rules/
│   │   └── fake-ip-filter/
│   │       ├── source/
│   │       └── compiled/
│   │
│   └── singbox1.14beta5/
│       ├── SFA/
│       │   ├── fakeip.json
│       │   └── fakeip-perfer_ipv4.json
│       │
│       └── SFW/
│           ├── fakeip.json
│           └── fakeip-perfer_ipv4.json
│
├── .gitignore
└── LICENSE
```

### `sing-box/`

sing-box 相关配置与规则。

### `sing-box/singbox1.14beta5/SFA/`

面向 **Sing-box for Android** 的配置。

### `sing-box/singbox1.14beta5/SFW/`

面向 **Sing-box for Windows** 的配置。

### `sing-box/rules/fake-ip-filter/source/`

FakeIP Filter 的源规则文件。

### `sing-box/rules/fake-ip-filter/compiled/`

由源规则编译生成的规则集文件。

---

## 🧩 配置设计

本项目的核心思路不是简单地“所有流量代理”，而是根据域名、IP、服务类型以及网络环境进行分流。

### DNS 分流

根据域名类型选择不同的 DNS 服务器：

```text
国内域名
    ↓
国内 DNS
    ↓
直连

国外域名
    ↓
远程 DNS
    ↓
代理网络
```

这样可以避免：

* 国内域名通过国外 DNS 查询
* 国外域名被国内 DNS 污染或返回不理想的结果
* DNS 查询路径与实际流量路径不一致

---

### FakeIP / Real IP

项目采用混合策略：

```text
国内服务
    ↓
Real IP
    ↓
直连

国外服务
    ↓
FakeIP
    ↓
sing-box 路由
    ↓
代理
```

FakeIP 主要用于需要稳定接管和识别流量的场景。

同时通过 FakeIP Filter 排除部分不适合 FakeIP 的域名，例如：

* 局域网设备
* 路由器管理地址
* 网络连通性检测
* Captive Portal
* 部分游戏服务
* 对 FakeIP 兼容性较差的应用

---

## 🎮 游戏网络

项目包含针对游戏场景进行整理的规则。

游戏相关规则主要用于解决：

* 游戏客户端与登录器域名分流
* 游戏更新服务
* CDN
* 游戏 API
* 区服相关域名
* 国内 / 海外服务器识别
* FakeIP 对部分游戏客户端造成的兼容性问题

对于游戏流量，不建议简单使用：

```text
全部代理
```

而是根据游戏服务器所在地、登录服务、CDN 与实际连接情况分别处理。

---

## 🌐 IPv6

IPv6 是本项目中特别关注的一部分。

在部分网络环境和应用中，IPv6 可能出现：

* 绕过代理
* DNS 返回 IPv6 地址后优先连接
* 应用 IPv6 / IPv4 行为不一致
* TUN / 路由策略与 IPv6 不匹配
* 游戏客户端连接异常

因此配置会根据实际使用环境对 IPv6 进行控制。

> 如果你的网络、节点以及 sing-box 路由没有完整配置 IPv6，请不要盲目开启 IPv6 代理。

---

## 📱 Android / Windows

### SFA

SFA 配置主要面向 Android：

```text
singbox1.14beta5/
└── SFA/
```

适合：

* Android 手机
* TUN VPN
* 移动网络
* Wi-Fi
* 游戏
* 日常网络访问

---

### SFW

SFW 配置主要面向 Windows：

```text
singbox1.14beta5/
└── SFW/
```

适合：

* Windows 11
* TUN
* 游戏
* 浏览器
* 桌面应用
* 系统级网络分流

---

## 🛠️ FakeIP Filter

FakeIP Filter 单独维护：

```text
sing-box/
└── rules/
    └── fake-ip-filter/
        ├── source/
        └── compiled/
```

其中：

* `source/`：人工维护、编辑的源规则
* `compiled/`：编译后的 sing-box Rule Set

修改规则时建议优先修改 `source/`，然后重新生成 `compiled/`，避免直接修改编译结果。

---

## ⚙️ 使用方法

### 1. 安装 sing-box

请先安装与你的平台对应的 sing-box 版本。

推荐使用与配置版本匹配的 **sing-box 1.14.x**。

---

### 2. 选择对应平台配置

Android：

```text
sing-box/singbox1.14beta5/SFA/
```

Windows：

```text
sing-box/singbox1.14beta5/SFW/
```

---

### 3. 修改节点

配置中的节点信息需要替换为你自己的节点。

不要直接使用其他人的：

* Server
* UUID
* Password
* Reality Key
* Token
* Subscription
* API Token

等敏感信息。

---

### 4. 检查配置

使用 sing-box 检查配置：

```powershell
sing-box check -c sing-box.json
```

确认没有错误后再启动。

---

## ⚠️ 注意事项

### 不是通用配置

不同网络环境可能存在明显差异：

* ISP DNS
* IPv4 / IPv6
* NAT 类型
* MTU
* DNS 劫持
* 节点质量
* 游戏服务器
* CDN
* 本地网络路由

因此，即使配置在我的环境中正常工作，也不代表能够直接适用于所有人。

---

### 不要提交私人节点

本仓库只应该保存：

* 配置模板
* 公共规则
* FakeIP Filter
* Rule Set
* 脱敏后的配置

不要提交：

```text
订阅链接
UUID
密码
Private Key
Reality Private Key
Cloudflare API Token
GCP 凭据
其他个人身份认证信息
```

如果配置中出现私人节点信息，应在提交前进行脱敏。

---

## 📌 版本说明

当前目录主要针对：

```text
sing-box 1.14
```

进行维护。

其中：

```text
singbox1.14beta5
```

表示该目录对应 sing-box 1.14 Beta 5 配置环境。

sing-box 配置格式会随着版本变化，因此：

> **不同 sing-box 大版本之间不保证配置兼容。**

如果未来升级到新的稳定版或大版本，建议重新检查：

* DNS
* Route
* Rule Set
* TUN
* Sniff
* Outbound
* Selector
* FakeIP Filter
* IPv6

等配置项。

---

## 🔄 更新原则

本项目会根据实际使用情况持续调整。

主要关注：

* sing-box 新版本配置变化
* DNS 分流准确性
* FakeIP 兼容性
* 游戏连接稳定性
* IPv4 / IPv6 行为
* 国内外服务分流
* Rule Set 更新
* Windows / Android 平台差异

配置以实际测试结果为准，而不是单纯追求规则数量。

---

## 📄 License

本项目采用 [MIT License](LICENSE)。

规则集、GeoIP、GeoSite 或其他第三方资源如果存在各自的许可证或版权声明，应以其原项目的许可证为准。

---

## ⭐ Disclaimer

本项目仅用于网络配置研究、学习以及个人使用。

配置文件不保证适用于所有网络环境，也不保证所有服务始终可用。

使用者应自行确认相关配置及网络行为符合所在地法律法规以及所使用服务的相关条款。

---

**Maintained by [zhux-6](https://github.com/zhux-6)**
