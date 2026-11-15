# CPAMP 与 CPA 如何协作

## v2 Beta：Embedded 与 External

v2 Beta 的完整模式不等同于 1.x 的单 Manager 部署。v2 仅支持 **CPA v8**（拒绝低于 v8 的版本，也不承诺未来主版本）：内置官方 CPA 固定为 **`v8.0.55`**；External 目标要求 CPA v8 且最低为 **`v8.0.55`**，仍需通过实际资格检查。1.x 直升基线是精确的 **`v1.14.10`**，且正向 Managed 升级来源（`upgrade cpa-import`）在停机导入前也须已升级到 CPA v8（不仅目标为 v8），见 [升级与回滚](../operations/update.md)。

| 模式 | 谁运行 CPA | CPAMP 边界 |
| --- | --- | --- |
| Embedded / New Managed、合格 Adopt | 单镜像容器内或 Native 的 Runtime Supervisor 托管官方 CPA | 单镜像 `seakee/cpa-manager-plus`（`slim` 向导按需获取 CPA，`full` 内置 CPA）或 Native 包由 launcher 在内部监管 Supervisor、Manager、Ingress 与托管 CPA；Docker 仅公开 `18317` 端口与单一 `/data` 数据卷（固定 `<tag>@sha256:<digest>`） |
| External | 操作者自己的 CPA 主机/容器/服务 | CPAMP 验证并保存连接、管理受支持配置与 Client Key、读取状态和观测；不启停、不重启、不升级外部 CPA 进程，不自动接管其流量入口 |
| Lightweight Panel | CPA 直接托管 `management.html` | 无 Manager、SQLite 或 Runtime；用 CPA Management Key 登录，不能提供 Manager 请求历史 |

**Embedded** 的浏览器与模型流量使用配置好的公开 origin；Ingress 决定公开路由，不能把 `8317`/`9081` 控制或内部入口另外公开。新安装必须由 Host `initialize` 提供短期 Handoff，浏览器设置 Admin Key、完成策略与资格检查后才进入正常产品。向导提供的首个 Client Key 用于模型请求，Admin Key 只用于管理。进程存活、安装完成、Gateway 就绪是不同状态。

**External** 安装先验证连接与 Management Key，配置界面的支持范围不等于获得宿主机写入/生命周期权限。规则写入无独占窗口时保持只读；可写标量按实际能力处理。使用量统计需要管理员显式确认，未确认不会自动改写外部 CPA。外部 CPA 仍由操作者负责升级、TLS/网络、配置/OAuth 凭证备份及可用性；客户端继续使用外部 CPA 的实际入口，不因 Manager 安装完成而自动改道。

外部 Management Key 轮换后，用面板重新绑定并证明当前连接；已被 CPA 拒绝的凭证不应反复重试。Manager 的 `data.key` 与加密数据库必须成套保留。公开 Fresh 安装向导的 **Adopt** 仅接纳网络中既有的 CPA v8（`network_existing`），仍拒绝 `legacy_managed` 来源（编译期内部资格不代表在公开 Fresh 入口开放该类别；1.x 托管 CPA 只能走离线 [升级 `cpa-import`](../operations/update.md)）。Adopt 的资格拒绝或未完成迁移不是 External 自动降级许可；按向导报告处理，不以更换环境变量或手改记录代替证明。

v2 Beta 完整模式的浏览器入口是安装或升级时提交的**控制入口前缀（Control Base Path）**（新安装不再默认 `/console`，而是默认预填 16 位加密随机前缀，支持独立自定义或重新随机；此前已提交 `/console` 的旧实例继续保留 `/console`），前端 API 为 `<控制前缀>/api/v2/*`。以向导完成页“登录并进入 CPAMP”或升级确认前缀为准；路径不能与 `/v1`、`/v1beta`、`/models`、`/management.html`、`/.well-known` 等保留路径冲突。**无论全新安装还是从 1.x 离线升级完成的 v2 实例，都不再提供 `/management.html` 或根路径 `/` 控制台**。Embedded 的 `8317` 与 `9081` 只在容器内，不要另外公开。

Ingress 仅在完成安装并提交前缀后放行对应 `<control-prefix>` 与（Managed 模式下显式提交的）`<inference-prefix>`：
- **独立与共用前缀**：Managed 默认使用各自独立的控制前缀与推理前缀；只有在向导/升级/补全中显式确认共用时才共享同一前缀，且共用模式下仅转发受支持的模型协议子路径（`/v1/*`、`/v1beta/*`、`/openai/v1/*`、`/backend-api/codex/*`、`/api/provider/*`），不开放 `/v0`、`/v8`、`/management.html` 或 OAuth 回调。Ingress 内部只剥离一次 `<inference-prefix>` 后转给受管 CPA。
- **严格故障关闭（Fail-Closed）**：未完成配置或旧 Managed v2 缺失推理前缀时网关保持 `503`。Managed 提交推理前缀后，无前缀 `/v1/*`、`/management.html` 与根路径 `/` 返回 `404`，不回退或重定向；External 不提供 Manager 推理入口，这些路径保持 `503`。两种模式均拒绝 `/v8/management/*`（`404`）。Pre-commit 引导仅在确认未提交且浏览器导航时跳转 `/.well-known/cpamp-bootstrap/ui`。`/health`、插件资源 `/v0/resource/plugins/*` 及 `GET`/`HEAD` `/favicon.ico`、`/apple-touch-icon.png` 由 Manager 处理。

安装：[v2 Docker](../deployment/docker.md) / [linux/amd64 Native](../deployment/native.md)；维护：[备份](../operations/backup.md) / [许可证与发布资产](../reference/releases.md)。

## 请求与密钥分别发往哪里

| 场景 | 请求地址 | 使用的密钥 |
| --- | --- | --- |
| **Embedded / Managed** 客户端调用模型 | `<public-origin><inference-prefix>` + 原始协议路径（例如 OpenAI `.../v1`，Claude/Gemini 原生 `...` 根接 `/v1/messages` 或 `/v1beta/models`，支持 SSE/WS；`8317` 不对外开放） | 向导或控制台签发的普通 CPA Client Key |
| **External** 客户端调用模型 | 外部 CPA 自己真实的对外地址（CPAMP 不分配推理前缀也不转发其模型流量） | 普通 CPA Client Key |
| 打开 **CPAMP 完整模式控制台**（Embedded 或 External） | 安装或升级时提交的控制前缀（例如 `<public-origin>/<control-prefix>`，API 为 `<控制前缀>/api/v2/*`；此前已提交 `/console` 的旧实例保持 `/console`） | CPAMP Admin Key |
| 打开 **CPAMP 轻量面板**（无 Manager 后端） | 外部 CPA 的 `http://<cpa-host>:8317/management.html` | CPA Management Key |

不要把 CPAMP Admin Key 或 CPA Management Key 填进普通模型客户端。External 模式下，Manager 通过 CPA Management API 读取状态并消费内存请求队列，不接管外部 CPA 进程或宿主机生命周期。轮询间隔由 `USAGE_POLL_INTERVAL_MS` 设置，默认 `500` 毫秒；须不超过 CPA 内存队列保留时间。

## 下一步

- 部署完整模式：[v2 Docker 安装](../deployment/docker.md) 或 [linux/amd64 原生包](../deployment/native.md)
- 选择完整模式还是轻量面板：[选择使用方式](./choosing-a-panel.md)
- 配置 Codex、Claude Code、OpenCode 等模型客户端：[接入客户端](../gateway/clients.md)
- 排查请求监控无数据：[排查监控没有数据](../troubleshooting/request-monitoring.md)

## 1.x（升级前）

1.x Stable 采用单 Manager Server + 外部 CPA 模型，并在 `:18317/management.html` 托管面板；相关架构说明请参阅 1.x 稳定版文档：[CPAMP 与 CPA 的协作关系（1.x Stable）](https://cpamp-docs.seakee.dev/guide/runtime-model.html)。
