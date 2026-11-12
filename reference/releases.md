# 版本说明

## v2 Beta 预发布通道与资产

v2 Beta 是 **Prerelease**，不是 Stable；`releases/latest`、1.x 自动面板更新与默认安装脚本继续面向 **1.x Stable**。仅在维护者实际发布后，才可从 [全部 Releases](https://github.com/seakee/CPA-Manager-Plus/releases) 选择对应 Beta 版本下载；本页不是已经发布或已获生产升级授权的声明。不要将 Beta 指向浮动标签，也不要用 Beta 单文件面板替换 Embedded Full Web。

同次 v2 发布的运行组合为：

- 单一镜像仓库 `seakee/cpa-manager-plus`（按 `<tag>@sha256:<digest>` 固定不可变摘要；官方 CPA 固定 `v8.0.55`）：
  - **`slim` 变体**：精确 Beta 标签 `seakee/cpa-manager-plus:2.0.0-beta.N`（滚动标签 `seakee/cpa-manager-plus:beta`），不内置 CPA 二进制，在安装或升级向导中从 CDN / GitHub Release 或本地 `.tar.gz` 上传按固定摘要获取 CPA。
  - **`full` 变体**：精确 Beta 标签 `seakee/cpa-manager-plus:2.0.0-beta.N-full`（滚动标签 `seakee/cpa-manager-plus:beta-full`），镜像内预置官方 CPA 二进制，适合离线与无外网环境。
  - Beta 期间 `:latest`、`:preview`、`:1`、`:1.14` 保持指向 **1.x Stable**；v2 镜像标签不带 `v` 前缀（Git 发布 Tag 仍为 `v2.0.0-beta.N`）；从源码本地构建请使用 `cpa-manager-plus:full-local`（或 `slim-local`），避免覆盖本机 1.x 的 `:latest`。部署 `docker-compose.yml` 见 [v2 Docker 安装](../deployment/docker.md)。
- 同版校验文件 `checksums.txt` 及发布说明；不要混用不同预发布的资产或依赖浮动标签。
- linux/amd64 Native：`cpa-manager-plus-native-v2_<ver>_linux_amd64.tar.gz`。不提供 v2 的 macOS、Windows、linux/arm64 原生包，见 [原生部署](../deployment/native.md)。
- 独立 CPA 轻量面板 `management.html`；Stable 与 Beta 的双轨取得方式见 [轻量面板](../deployment/cpa-panel.md)。

**随 Beta 交付的发布契约，不是已有构建的现行更新能力：** v2 Beta 的 `release-info.json` 契约使用 `schema_version: 2`、`migration_required: true`、`minimum_direct_upgrade_version: v1.14.10`、`minimum_cpa_version: v8.0.55`；更新索引文件名是 **`update-index.json`**，外层保持 `schema_version: 1`，v2 的 `channels.beta` 条目使用 `schema_version: 2`，且只允许 Beta Prerelease。基线 `8935bce5` 尚未实现 v2 发布及该 schema-2 Beta 条目；发布端契约由 PR #1137 引入，当前仅允许显式 opt-in 的 `DRY_RUN=true` 演练，真实发布/索引写入仍须维护者解除门禁。不能据此声称 Beta 已发布或线上索引已改变。

**应用内更新不会提供 v2：** `v1.14.10` 的 Stable 检查不会选择 v2 Beta；手工切到 beta 后也会拒绝 schema-2 的 ReleaseInfo，不会显示可用的 v2 更新。当前 v2 构建同样不会通过应用内更新提供 v2 目标，发布端契约不等于已新增 v2 消费端支持。安装或后续更新必须阅读对应发布说明并显式选择同版资产，不能依赖自动换镜像；从 1.x 迁移按 [离线 copy-in、对账与回滚](../operations/update.md)，备份 `data.key`、SQLite WAL/SHM 和 `usage-archives/`。

## 当前许可证与可核验文件

**当前仓库根 `LICENSE` 是 MIT**，镜像复制该文件；官方 CPA 的 MIT LICENSE 独立分发，第三方依赖保留各自许可证。不要把未来许可提案视为已生效，也不要仅根据 CPAMP 的 MIT 推断所有打包依赖均采用 MIT。实际分发内容与对应许可证文本是核验依据。

### Embedded 单镜像

| 文件 | 含义 |
| --- | --- |
| `/usr/local/share/licenses/cpamp/LICENSE` | 单镜像（`slim` 与 `full`）中的 CPAMP 项目许可证 |
| `/usr/local/share/licenses/cli-proxy-api/LICENSE` | `full` 变体中随内置 CPA 分发的官方许可证（`slim` 不内置 CPA 二进制，因此不含该文件） |
| `/usr/local/share/cpamp/runtime/cpa-artifact.json` | 镜像锁定的官方 CPA 版本（`8.0.55`）与 `artifactId` SHA256 清单 |
| `/usr/local/share/cpamp/release/third-party-inventory.txt` | JSON 内容的聚合第三方收集清单（不要因 `.txt` 后缀当作纯文本列表） |
| `/usr/local/share/licenses/<component>/inventory.json` | 单镜像各组件清单和原始 LICENSE/NOTICE 文件摘要 |
| `/usr/local/share/cpamp/provenance.json` | 版本、源码、角色（`cpamp`）/平台、二进制与第三方清单的字节绑定记录（`slim` 标记 `"cpaBundled": false`） |

单镜像（`role: "cpamp"`）的 `<component>` 包含 `manager`、`web`、`ingress`、`runtime-supervisor`、`base-image`（Alpine）与 `glibc-runtime`（供官方 CPA 二进制运行的 Debian `libc6`/`libgcc-s1`/`gcc-12-base` 运行库）。Go/Web 收集原始许可文本；Alpine 基础镜像的边界是已安装 APK 许可元数据及可取得的包内声明，`glibc-runtime` 使用对应 Debian 包的 copyright 文件。`VERIFIED_LICENSE_COLLECTION` 不代表法律审批，也不把“仅元数据”自动变为完整原文覆盖。

在已运行的单镜像 `docker-compose.yml` 目录中查验（输出是公开构建资料，不包含运行密钥）：

```bash
docker compose exec -T cpa-manager-plus \
  cat /usr/local/share/licenses/cpamp/LICENSE
# 仅 full 变体内置 CPA 许可证：
docker compose exec -T cpa-manager-plus \
  cat /usr/local/share/licenses/cli-proxy-api/LICENSE
docker compose exec -T cpa-manager-plus \
  cat /usr/local/share/cpamp/runtime/cpa-artifact.json
docker compose exec -T cpa-manager-plus \
  cat /usr/local/share/cpamp/release/third-party-inventory.txt
docker compose exec -T cpa-manager-plus \
  cat /usr/local/share/licenses/manager/inventory.json
docker compose exec -T cpa-manager-plus \
  cat /usr/local/share/cpamp/provenance.json
```

将版本、`sourceCommit`、平台与镜像摘要同对应 GitHub Release 说明及 `checksums.txt` 核对，并按 inventory 列出的路径/摘要查验具体声明。Provenance 是**未签名的构建来源声明**，不是受保护发布者证明、签名或法律结论；校验和只证明下载内容匹配相应记录，仍须信任取得记录的发布来源。

### linux/amd64 Native

从解压后的包根目录读取：

```bash
cat LICENSE
cat share/licenses/cli-proxy-api/LICENSE
cat share/cpamp/runtime/cpa-artifact.json
cat share/cpamp/release/third-party-inventory.txt
cat share/cpamp/provenance.json
```

Native 包携带 CPAMP 根 `LICENSE`（及 `share/licenses/cpamp/LICENSE`）、官方 CPA `LICENSE`、`cpa-artifact.json`，以及 `manager`、`ingress`、`runtime-supervisor`、`web` 四个组件的 `share/licenses/<component>/inventory.json` 与 `role: "native"` 的 `share/cpamp/provenance.json`（原生归档不拥有宿主机操作系统，因此不包含容器专用的 `base-image` 与 `glibc-runtime` 组件）。

## 相关维护入口

- 从 1.x（精确基线 `v1.14.10`）离线迁移与回滚：[更新与升级](../operations/update.md)
- 单一 `/data` 数据卷停机备份与恢复：[备份与恢复](../operations/backup.md)
- 重置管理员凭证：[重置管理员密钥](../operations/reset-admin-key.md)
- CPA 轻量面板缓存清理与 Beta 手动替换：[更新与缓存](../deployment/cpa-panel.md#更新与缓存)

## 1.x（升级前）

`releases/latest` 在 Beta 期间继续指向 1.x Stable。1.x 稳定版发布资产与版本核对方式请参阅 1.x 稳定版文档：[版本与更新说明（1.x Stable）](https://cpamp-docs.seakee.dev/reference/releases.html)。
