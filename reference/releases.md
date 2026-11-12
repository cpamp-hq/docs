# 版本说明

查看新版本时，重点关注三件事：新增了什么、是否有不兼容变化、升级前是否需要额外备份或配置调整。

## 查看最新版本

- [最新 GitHub Release](https://github.com/seakee/CPA-Manager-Plus/releases/latest)
- [全部历史版本](https://github.com/seakee/CPA-Manager-Plus/releases)

每个 Release 会列出主要功能、修复、下载文件和必要的升级说明。

## 版本通道与镜像标签

Stable 1.x 是唯一的生产发布通道。Docker Hub `seakee/cpa-manager-plus` 当前发布以下标签：

| 标签 | 指向 |
| --- | --- |
| `latest` | 最新的 Stable 版本 |
| `1.14` | 最新的 1.14.x 版本 |
| `1.14.10`、`v1.14.10` | 该确切版本，两种写法都可用 |
| `preview` | 预览构建，不用于生产 |

生产环境请固定确切版本，避免重启后未经确认就换镜像。`latest` 跟随每个 Stable 版本自动前移。

v2 属于预发布通道，文档位于 https://cpamp-docs.seakee.dev/next/，与本文档的 Stable 内容分开维护。`latest` 与应用内更新都不会提供 v2，因此除非主动切换通道，Stable 部署始终停留在 1.x。

## 升级前

1. 阅读目标版本的 Upgrade Notes。
2. 确认当前使用的是轻量面板、Docker 完整模式还是原生包。
3. 完整模式先备份 SQLite、`data.key` 和安装目录中的 secret。
4. 再按[更新 CPAMP](../operations/update.md)执行对应步骤。

轻量面板通常由 CPA 自动检查新的 `management.html`。如果升级后仍显示旧界面，查看[轻量面板更新与缓存](../deployment/cpa-panel.md#更新与缓存)。

## 遇到问题

- 更新后无法登录：[重置管理员密钥](../operations/reset-admin-key.md)
- 更新后监控为空：[请求监控没有数据](../troubleshooting/request-monitoring.md)
- 不确定数据文件位置：[配置与数据目录](../operations/configuration.md)
