# 版本说明

## v2 Beta 预发布通道与资产

v2 Beta 是 **Prerelease**，不是 Stable；`releases/latest`、1.x 自动面板更新与默认安装脚本继续面向 **1.x Stable**。仅在维护者实际发布后，才可从 [全部 Releases](https://github.com/seakee/CPA-Manager-Plus/releases) 选择对应 Beta 版本下载；本页不是已经发布或已获生产升级授权的声明。不要将 Beta 指向浮动标签，也不要用 Beta 单文件面板替换 Embedded Full Web。

当前源码具备单镜像 `slim` / `full` 构建 target：`slim` 在向导中按固定摘要获取官方 CPA `v8.0.55`，`full` 内置同版 CPA。它们是构建能力，**不是单镜像正式发布、滚动标签或多架构已可用的证明**。从源码本地构建请自选 `cpa-manager-plus:full-local` / `slim-local`，不要覆盖本机 1.x 的 `:latest`；源码中的 `docker-compose.yml` 不是下载资产，部署示例见 [v2 Docker 安装](../deployment/docker.md)。

当前发布流水线仅默认放行显式 opt-in 的 v2 **`DRY_RUN=true`** 演练，真实发布与线上索引写入仍受维护者门禁保护。`update-contract.mjs` 将平台固定为 **`linux/amd64`**，单镜像 Docker 变体角色统一为无 `v` 前缀标签的 `slim`（`<semver>`，如 `2.0.0-beta.1`）与 `full`（`<semver>-full`，如 `2.0.0-beta.1-full`），且严禁改写 1.x 的 `:latest`、`:preview`、`:1` 与 `:1.x` 标签。安装前必须核对真实 Release 的同版镜像 `@sha256` 摘要、平台与 Compose 是否一致。

v2 Beta 发布包资产清单如下：

| 文件 | 用途 |
| --- | --- |
| `cpa-manager-plus-native-v2_<tag>_linux_amd64.tar.gz` | linux/amd64 Native，`<tag>` 包含 `v` 前缀；不提供 v2 macOS、Windows 或 linux/arm64 原生包 |
| `cpamp-slot_<tag>_linux_amd64.tar.gz` | 离线 Ed25519 签名控制面槽位包（已配置签名私钥时自 `v2.0.0-beta.1` 起随版签发，`v2.0.0-beta.2` 起强制校验；含 `slot-manifest.json` 与 `slot-manifest.json.sig`，由 `cpamp-launcher` 按内置根公钥 `cpamp-root-2026-01` 验签） |
| `management.html` | 独立 CPA 轻量面板，不是 Embedded Full Web |
| `docker-compose.v2-embedded.yml` | 生成的 Embedded 单镜像 Compose 模板，不能用仓库根 `docker-compose.yml` 冒充 |
| `embedded-release-pairing.json` | 同次单镜像 `slim` / `full` 摘要与构建配对证据 |
| `release-info.json` | 同次发布元数据（`schema_version: 2`） |
| `checksums.txt` | 同次资产 SHA-256 校验和 |

v2 Beta 的 `release-info.json` 使用 `schema_version: 2`、`minimum_direct_upgrade_version: v1.14.10`、`minimum_cpa_version: v8.0.55`。发布通道物理隔离为两套索引：1.x 继续独占 `update-index.json`（`schema_version: 1`）与 `stable-version.txt`；v2 独立写入 **`update-index-v2.json`**（`schema_version: 2`，含单调递增 `revision`、`channels.beta` 及绑定的 `release_info_sha256`）。Native 见 [原生部署](../deployment/native.md)，轻量面板的 Stable / Beta 取得方式见 [轻量面板](../deployment/cpa-panel.md)。

**1.x 与 v2 应用内更新严格隔离：** 1.x 实例仅读取 `update-index.json`，即使切到 `beta` 通道也绝不会看到或误装 v2 Beta；从 1.x 升级到 v2 必须按 [离线预检、copy-in 与对账](../operations/update.md) 执行。已运行的 v2 实例读取 `update-index-v2.json`，自 `v2.0.0-beta.1` 起即内置单容器与 Linux Native 面板一键签名槽位自更新、60 秒 Trial 看门狗自动回滚与 `:full` 内置 CPA 基线回归，同时保留变体匹配的 `@sha256` 镜像命令与 `cpa-manager-plusctl upgrade` 原生升级指引（详见 [既有 v2 实例升级](../operations/update.md#既有-v2-实例升级-签名槽位自更新、手动换版与-cpa-基线)）。

### 当前源码变更（尚未正式发布）

- 全新安装和升级完成页支持复制不含密钥的接入信息；忘记前缀时可运行只读 [`access show`](../deployment/docker.md#忘记接入前缀) 查询。
- 已在 `v2` 分支合入单镜像 `update-index-v2.json` 隔离索引、签名槽位 `unix.Exec` 一键自更新与 60 秒看门狗自动回滚、SQLite `upgrade_schema_meta` 降级围栏与 `restore-pre-migrate`、`seed-lineage.json` 谱系校验、内置 CPA `adopt-baseline` 以及 `cpa-manager-plusctl upgrade` 原子升级。

## 当前许可证与可核验文件

**当前仓库根 `LICENSE` 是 MIT**，镜像复制该文件；官方 CPA 的 MIT LICENSE 独立分发，第三方依赖保留各自许可证。不要把未来许可提案视为已生效，也不要仅根据 CPAMP 的 MIT 推断所有打包依赖均采用 MIT。实际分发内容与对应许可证文本是核验依据。

### Embedded 单镜像

| 文件 | 含义 |
| --- | --- |
| `/usr/local/share/licenses/cpamp/LICENSE` | 单镜像（`slim` 与 `full`）中的 CPAMP 项目许可证 |
| `/usr/local/share/licenses/cli-proxy-api/LICENSE` | `full` 变体中随内置 CPA 分发的官方许可证（`slim` 不内置 CPA 二进制，因此不含该文件） |
| `/usr/local/share/cpamp/runtime/cpa-artifact.json` | 镜像锁定的官方 CPA 版本（`8.0.55`）与 `artifactId` SHA256 清单 |
| `/usr/local/share/cpamp/runtime/seed-lineage.json` | 兼容历史与当前网关 `config.seed.yaml` 引导指纹的只读谱系清单 |
| `/usr/local/share/cpamp/release/base-abi.json` | 底座运行库与目录契约代际声明（`base_epoch`，供签名槽位校验 `min_base_epoch`） |
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
cat share/cpamp/runtime/seed-lineage.json
cat share/cpamp/release/base-abi.json
cat share/cpamp/provenance.json
```

Native 包携带 CPAMP 根 `LICENSE`（及 `share/licenses/cpamp/LICENSE`）、官方 CPA `LICENSE`、`cpa-artifact.json`，以及 `manager`、`ingress`、`runtime-supervisor`、`web` 四个组件的 `share/licenses/<component>/inventory.json` 与 `role: "native"` 的 `share/cpamp/provenance.json`（原生归档不拥有宿主机操作系统，因此不包含容器专用的 `base-image` 与 `glibc-runtime` 组件）。

## 相关维护入口

- 从 1.x（`v1.14.x` 兼容来源）迁移与回滚：[更新与升级](../operations/update.md)
- 单一 `/data` 数据卷停机备份与恢复：[备份与恢复](../operations/backup.md)
- 重置管理员凭证：[重置管理员密钥](../operations/reset-admin-key.md)
- CPA 轻量面板缓存清理与 Beta 手动替换：[更新与缓存](../deployment/cpa-panel.md#更新与缓存)

## 1.x（升级前）

`releases/latest` 在 Beta 期间继续指向 1.x Stable。1.x 稳定版发布资产与版本核对方式请参阅 1.x 稳定版文档：[版本与更新说明（1.x Stable）](https://cpamp-docs.seakee.dev/reference/releases.html)。
