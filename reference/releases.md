# 版本说明

## v2 Beta 预发布通道与资产

v2 Beta 是 **Prerelease**，不是 Stable；`releases/latest`、1.x 自动面板更新与默认安装脚本继续面向 **1.x Stable**。仅在维护者实际发布后，才可从 [全部 Releases](https://github.com/seakee/CPA-Manager-Plus/releases) 选择对应 Beta 版本下载；本页不是已经发布或已获生产升级授权的声明。不要将 Beta 指向浮动标签，也不要用 Beta 单文件面板替换 Embedded Full Web。

当前源码具备单镜像 `slim` / `full` 构建 target：`slim` 在向导中按固定摘要获取官方 CPA `v8.0.55`，`full` 内置同版 CPA。它们是构建能力，**不是单镜像正式发布、滚动标签或多架构已可用的证明**。从源码本地构建请自选 `cpa-manager-plus:full-local` / `slim-local`，不要覆盖本机 1.x 的 `:latest`；源码中的 `docker-compose.yml` 不是下载资产，部署示例见 [v2 Docker 安装](../deployment/docker.md)。

当前发布脚本只允许显式 opt-in 的 v2 **`DRY_RUN=true`** 演练。`update-contract.mjs` 仍将平台限制为 **`linux/amd64`**，镜像角色仍为 `manager`、`ingress`、`runtime`；候选构建步骤已生成单镜像证据，不代表整个发布契约已经完成切换。不要从 Dockerfile 支持的 target/platform 推断已发布资产；也不要据此部署混合的新旧拓扑。安装前必须核对真实 Release 的同版镜像摘要、平台与 Compose 是否一致。

演练定义的六件套文件名为：

| 文件 | 用途 |
| --- | --- |
| `cpa-manager-plus-native-v2_<tag>_linux_amd64.tar.gz` | linux/amd64 Native，`<tag>` 包含 `v` 前缀；不提供 v2 macOS、Windows 或 linux/arm64 原生包 |
| `management.html` | 独立 CPA 轻量面板，不是 Embedded Full Web |
| `docker-compose.v2-embedded.yml` | 生成的 Embedded Compose 模板，不能用仓库根 `docker-compose.yml` 冒充 |
| `embedded-release-pairing.json` | 同次 Embedded 组合的配对证据 |
| `release-info.json` | 同次发布元数据 |
| `checksums.txt` | 同次资产校验和 |

v2 Beta 的 `release-info.json` 契约使用 `schema_version: 2`、`migration_required: true`、`minimum_direct_upgrade_version: v1.14.10`、`minimum_cpa_version: v8.0.55`。更新通道索引文件为 **`versions.json`**，外层保持 `schema_version: 1`，v2 的 `channels.beta` 条目使用 `schema_version: 2`，且只允许 Beta Prerelease。真实发布与索引写入仍受维护者门禁限制；不能据此声称 Beta 已发布、镜像标签已推送或线上索引已改变。Native 见 [原生部署](../deployment/native.md)，轻量面板的 Stable / Beta 取得方式见 [轻量面板](../deployment/cpa-panel.md)。

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
