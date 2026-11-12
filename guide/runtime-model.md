# CPAMP 与 CPA 如何协作

## v2 Beta：Embedded 与 External

v2 Beta 的完整模式不等同于 1.x 的单 Manager 部署。内置官方 CPA 固定为 **`v8.0.55`**；External 目标最低要求 **`v8.0.55`**，仍需通过实际资格检查。1.x 直升基线是精确的 **`v1.14.10`**，见 [升级与回滚](../operations/update.md)。

| 模式 | 谁运行 CPA | CPAMP 边界 |
| --- | --- | --- |
| Embedded / New Managed、合格 Adopt | 单镜像容器内或 Native 的 Runtime Supervisor 托管官方 CPA | 单镜像 `seakee/cpa-manager-plus`（`slim` 向导按需获取 CPA，`full` 内置 CPA）或 Native 包由 launcher 在内部监管 Supervisor、Manager、Ingress 与托管 CPA；Docker 仅公开 `18317` 端口与单一 `/data` 数据卷（固定 `<tag>@sha256:<digest>`） |
| External | 操作者自己的 CPA 主机/容器/服务 | CPAMP 验证并保存连接、管理受支持配置与 Client Key、读取状态和观测；不启停、不重启、不升级外部 CPA 进程，不自动接管其流量入口 |
| Lightweight Panel | CPA 直接托管 `management.html` | 无 Manager、SQLite 或 Runtime；用 CPA Management Key 登录，不能提供 Manager 请求历史 |

**Embedded** 的浏览器与模型流量使用配置好的公开 origin；Ingress 决定公开路由，不能把 `8317`/`9081` 控制或内部入口另外公开。新安装必须由 Host `initialize` 提供短期 Handoff，浏览器设置 Admin Key、完成策略与资格检查后才进入正常产品。向导提供的首个 Client Key 用于模型请求，Admin Key 只用于管理。进程存活、安装完成、Gateway 就绪是不同状态。

**External** 安装先验证连接与 Management Key，配置界面的支持范围不等于获得宿主机写入/生命周期权限。规则写入无独占窗口时保持只读；可写标量按实际能力处理。使用量统计需要管理员显式确认，未确认不会自动改写外部 CPA。外部 CPA 仍由操作者负责升级、TLS/网络、配置/OAuth 凭证备份及可用性；客户端继续使用外部 CPA 的实际入口，不因 Manager 安装完成而自动改道。

外部 Management Key 轮换后，用面板重新绑定并证明当前连接；已被 CPA 拒绝的凭证不应反复重试。Manager 的 `data.key` 与加密数据库必须成套保留。Adopt 的资格拒绝或未完成迁移不是 External 自动降级许可；按向导报告处理，不以更换环境变量或手改记录代替证明。

v2 Beta **全新安装**的浏览器入口是公开 origin 下安装时设置的**控制台地址（Control Base Path）**：向导默认 **`/console`**（例如 `http://<host>:18317/console`），前端 API 为 `<控制台路径>/api/v2/*`。以向导完成页“登录并进入 CPAMP”指向的地址为准；路径不能与 `/v1`、`/models`、`/management.html` 等保留路径冲突。Fresh 完整控制台不在 `/management.html` 提供服务；**从 1.x 离线升级的实例仍使用 `/management.html`（或根路径 `/`）与原管理员密钥**，不会因升级自动获得 `/console`。Embedded 的 `8317` 与 `9081` 只在容器内，不要另外公开。

Ingress 还将 `/health`、`/status`、`/`、`/setup`、`/management.html`、`/usage-service/*`、`/v0/management/*` 路由至 Manager，供健康检查及升级过渡使用；路由归属不代表对应功能在 Fresh 中可用。`/v8/management/*`、已退役控制台路径等边缘拒绝请求返回 `404`，不会转发至 CPA。`GET` / `HEAD` 的 `/favicon.ico` 与 `/apple-touch-icon.png` 也由 Manager 处理。

安装：[v2 Docker](../deployment/docker.md) / [linux/amd64 Native](../deployment/native.md)；维护：[备份](../operations/backup.md) / [许可证与发布资产](../reference/releases.md)。

## 请求与密钥分别发往哪里

| 场景 | 请求地址 | 使用的密钥 |
| --- | --- | --- |
| **Embedded** 客户端调用模型 | CPAMP 公开 origin 的 `/v1/...`（由 Ingress 转发至容器内 CPA，`8317` 不对外开放） | 向导或控制台签发的普通 CPA Client Key |
| **External** 客户端调用模型 | 外部 CPA 原有的对外 `/v1/...` 地址 | 普通 CPA Client Key |
| 打开 **CPAMP 完整模式控制台**（Embedded 或 External） | 全新安装使用控制台地址（默认 `/console`，API 为 `<控制台路径>/api/v2/*`）；1.x 升级实例使用 `/management.html`（或 `/`） | CPAMP Admin Key |
| 打开 **CPAMP 轻量面板**（无 Manager 后端） | 外部 CPA 的 `http://<cpa-host>:8317/management.html` | CPA Management Key |

不要把 CPAMP Admin Key 或 CPA Management Key 填进普通模型客户端。External 模式下，Manager 通过 CPA Management API 读取状态并消费内存请求队列，不接管外部 CPA 进程或宿主机生命周期。轮询间隔由 `USAGE_POLL_INTERVAL_MS` 设置，默认 `500` 毫秒；须不超过 CPA 内存队列保留时间。

## 下一步

- 部署完整模式：[v2 Docker 安装](../deployment/docker.md) 或 [linux/amd64 原生包](../deployment/native.md)
- 选择完整模式还是轻量面板：[选择使用方式](./choosing-a-panel.md)
- 配置 Codex、Claude Code、OpenCode 等模型客户端：[接入客户端](../gateway/clients.md)
- 排查请求监控无数据：[排查监控没有数据](../troubleshooting/request-monitoring.md)

## 1.x（升级前）

1.x Stable 采用单 Manager Server + 外部 CPA 模型，并在 `:18317/management.html` 托管面板；相关架构说明请参阅 1.x 稳定版文档：[CPAMP 与 CPA 的协作关系（1.x Stable）](https://cpamp-docs.seakee.dev/guide/runtime-model.html)。
