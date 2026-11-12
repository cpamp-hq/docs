# 一键安装脚本

::: warning `bin/install-cpamp.sh` 仅用于 1.x Stable，不安装或升级 v2 Beta
仓库及 `main` 分支提供的 `bin/install-cpamp.sh` 始终解析 GitHub `releases/latest`，因此**只安装或维护 1.x Stable**（面板入口 `:18317/management.html`），不会拉取 v2 Beta 预发布，也不能用于把 1.x 数据迁移到 v2。
:::

## v2 Beta 安装与迁移入口

在 `next`（v2 Beta）中，请按目标形态选择对应方式，不要运行 `install-cpamp.sh`：

| 目标场景 | v2 Beta 正确方式 |
| --- | --- |
| **全新安装（Docker 推荐）** | 使用单一镜像 `seakee/cpa-manager-plus` 并按 `<tag>@sha256:<digest>` 固定摘要（`slim` 标签如 `2.0.0-beta.1` 在向导中从 CDN / GitHub Release 或本地上传获取 CPA，`full` 标签如 `2.0.0-beta.1-full` 内置 CPA；Beta 期间 `:latest`、`:preview`、`:1`、`:1.14` 保持 1.x Stable，v2 镜像标签不带 `v` 前缀），通过 `initialize` Handoff 在浏览器完成安装。控制台默认位于 `/console`（`:18317/management.html` 在 v2 返回 404）。见 [v2 Docker 安装](./docker.md)。 |
| **无 Docker 的 Linux x86_64 主机** | 使用 `cpa-manager-plus-native-v2_<ver>_linux_amd64.tar.gz` 原生归档（不提供 v2 的 macOS、Windows 或 `linux/arm64` 原生包）。见 [原生包部署](./native.md)。 |
| **仅在现有 CPA 上试用轻量面板** | 从已发布的 v2 Beta 预发布手动下载单文件 `management.html` 并关闭自动更新。见 [CPAMP 轻量面板](./cpa-panel.md#在-cpa-上试用-v2-beta-面板)。 |
| **从已有 1.x 升级到 v2 Beta** | 先将 1.x 实例升级到精确基线 **`v1.14.10`**（目标 CPA 最低 **`v8.0.55`**），再为 v2 挂载全新空 `/data` 卷并将原 1.x 卷只读挂到 `/legacy:ro`，执行离线预检、copy-in 与四域对账。见 [升级与回滚](../operations/update.md)。 |

表中的 `/console` 与 `/management.html` 不可用说明仅针对 **Fresh 全新安装**；从 1.x 离线升级的实例仍使用 `:18317/management.html`（或 `/`）与原管理员密钥。Ingress 的 `/health`、`/status`、过渡控制路径以及边缘拒绝 `404` 规则见 [运行模型](../guide/runtime-model.md)。单镜像标签是部署示例，不代表当前发布脚本已完成发布；实际可用资产及平台限制见 [发布资产与门禁](../reference/releases.md)。

## 1.x（升级前）

如果你正在部署 1.x Stable，或在迁移到 v2 前需要先用一键安装器将旧版 1.x 升到 `v1.14.10`，请参阅 1.x 稳定版文档中的完整脚本参数与交互说明：[一键安装脚本（1.x Stable）](https://cpamp-docs.seakee.dev/deployment/installer.html)。
