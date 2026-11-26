# 更新 CPA Manager Plus

## v2 Beta：从 1.x 升级，不是原地换镜像

::: warning 支持的来源、停止条件与验证范围
- **支持已证明的 v1.14.x 来源**：预检同时核对 1.x 的物理 schema 与语义 profile（历史、定价、覆盖、身份等）后才放行。不是要求精确 `v1.14.10`，也不代表任意 1.x 都能直升；更早的 1.x 先在原部署内升级到受支持的 v1.14.x 并验证。来源补丁未知时保持未知，`--source-version` 只是如实声明，不会把不兼容格式变成兼容。
- **CPA 只支持 v8 主版本**（`8.0.0` 起、含 8.x；拒绝 7.x 与 9+，也不承诺未来主版本）。`full` 镜像内置官方固定 `v8.0.55`；Managed 导入要求原 1.x 托管 CPA 已是 CPA v8（低于 v8 必须先在 1.x 栈内升级并验证再停机）；External 要求外部 CPA 已是 CPA v8 并提供 v8 配置文档。
- **结构上不支持或无法安全归类的来源、配置与加密路径在停机前拒绝**：例如使用外部 `CPA_MANAGER_CONFIG`、外部 data-key secret 或 `config.json` 挂载的旧 Manager，无法安全归类的数据路径，嵌套来源挂载，多个不同发布端口，或 `host`/`none` 网络；拒绝时不会停止旧服务。来源数据本身的 schema/profile 由停机后的离线预检判定，不兼容时不会写入目标，原数据不变，修正后按同一 `--state-dir` 恢复或显式回滚。
- 本页的 Docker 流程已在合成 v1.14.x 演练中验证过预检、备份、copy-in、对账、浏览器 Managed 导入、验证与激活；这属于**开发验证**，不是发布认证，也不承诺所有部署形态都受支持。
:::

默认 Docker 升级不再要求人工拼接一次性 CLI。运行与所选 v2 源码同版的 `bin/upgrade-cpamp-v2.sh`，由它完成来源发现、备份、copy-in、对账与独立目标创建，再在浏览器完成 CPA 与访问入口决策。旧的多命令 `run`/`cpa-import`/`verify`/属主修正循环只是 CLI 高级路径（见下方 Native 与 CLI 引擎），不是常规 Docker 流程。镜像的 `full`/`slim` 能力见 [v2 Docker 安装](../deployment/docker.md)。

### 第 1 步：准备脚本、镜像与独立状态目录

1. **固定精确 v2 镜像**：`--image` 必须是实际 v2 版本的完整引用，例如 slim 的 `seakee/cpa-manager-plus:2.0.0-beta.1`、full 的 `seakee/cpa-manager-plus:2.0.0-beta.1-full`，或带 `@sha256:<digest>` 的完整摘要。不接受 `latest`、`slim`、`full` 这类浮动标签；脚本还会核对镜像内 OCI version 与 40 位 revision，因此本地自建且无这些标签的镜像不能作为目标。该版本是否已发布见[发布资产与门禁](../reference/releases.md)。
2. **取得并审阅脚本**：脚本位于同一 v2 版本的源码仓库 `bin/upgrade-cpamp-v2.sh`，不是单独的发布资产，本页不提供下载 URL。从你选定的 v2 tag/commit 取出该文件（例如 `git show <tag>:bin/upgrade-cpamp-v2.sh > upgrade-cpamp-v2.sh`），保存到 Docker 宿主机并审阅后，再运行保存后的本地文件。
3. **选择独立状态目录**：`--state-dir` 保存操作清单（不含凭证）。它必须位于原 Manager 数据、CPA 配置/认证目录之外，也要避开经符号链接、VM 共享别名或当前工作目录解析后仍落在这些目录内的位置；默认在当前目录创建 `.cpamp-v2-<Manager ID 前缀>`。脚本会在创建目录前拒绝重叠路径。
4. **保持原数据只读**：原 1.x 容器、原数据/配置/认证和脚本生成的备份都不会被删除或改写；目标 `/data`、`/runtime` 与备份是三个独立新卷，脚本会打印名称。升级前仍建议按[备份](./backup.md)另行保留原数据副本。

### 第 2 步：在 Docker 宿主机运行脚本

以下命令是模板，必须替换全部尖括号占位符；不要照抄示例值。

```bash
bash upgrade-cpamp-v2.sh \
  --image '<实际v2镜像完整引用：固定版本标签或@sha256摘要>' \
  --manager '<旧Manager容器名或ID>' \
  --cpa '<关联CPA容器名或ID>' \
  --cpa-version '<实际CPA-v8版本>' \
  --source-version '<实际v1.14.x版本>' \
  --mode managed \
  --state-dir '/绝对路径/独立状态目录'
```

先不要加 `--confirm`。脚本会拉取或校验镜像、只读检查来源与挂载，然后打印将停止的对象、备份、目标卷、发布端口、origin、网络与 CPA 影响。确认计划无误后，按提示输入 `UPGRADE`；或在检查完成后重跑同一命令并加 `--confirm`。`--confirm` 只跳过交互确认，不代表脚本替你核对了计划。

- 不传 `--manager` 时，脚本只接受唯一的旧 Compose Manager（`cpa-manager-plus` 服务）；不传 `--cpa` 时按同一 Compose 项目查找关联 CPA，找不到唯一对象会要求显式指定。旧 Manager 的数据目录必须与 `usage.sqlite`/`data.key` 同处一个精确挂载，不能靠挂宿主大目录绕过。
- `--mode managed`（在来源 CPA 的配置与认证挂载都可用时的默认值）只停止选中的旧 Manager 与关联的旧 CPA；`--mode external` 只停止旧 Manager，旧 CPA 继续运行。旧容器不会被删除，原数据不会被修改。
- 省略 `--source-version`/`--cpa-version` 时，脚本与引擎按镜像标签、OCI version 和实际证据判定；无法证明的版本保持未知。需要时用它们如实声明，它们不是格式或版本门禁的覆盖开关。
- 其他可选参数：`--source-mount`（旧 Manager 的数据挂载目标）、`--network`（外部 CPA 所在的既有 Docker 网络）、`--public-host`/`--public-origin`（见下文）。脚本不会把 Docker socket 暴露给 Web 或 Manager，也不会递归修改来源或运行时属主；Manager 保持 `10002`，只由临时受限 root worker 执行固定的目标属主修复。
- 若脚本对账后需要历史决策，仍会打印 Upgrade-only UI 地址；确认必须留在浏览器逐项完成，脚本不会静默接受缺口。

### 第 3 步：在浏览器完成 CPA 与访问入口

打开脚本打印的 Upgrade UI 地址，使用**原 Manager 管理员密钥**登录（不是 CPA Management Key）。未完成升级时脚本打印的是本机探测返回 `200` 的固定引导面 `/.well-known/cpamp-bootstrap/ui`；不要假设根路径 `/` 能进入升级页面，也不要手工改写地址。身份来自复制后的原库，沿用原管理员密钥，不创建新 key。未完成升级时 `/health` 可能返回 `503`，这是正常的；不要用 `/health` 判定升级失败。

1. **只读预检与历史确认**：按页面列出的历史日与 parity 缺口确认。接受缺口只代表知悉，不代表恢复已删除事件；当差异日期超过单页展示上限（366 天）被截断时，建议先核对完整对账报告，再在页面显式勾选确认全部历史差异日期后继续。
2. **选择 CPA 目标**：选「内置 Managed CPA · 推荐」导入来源 CPA，或选「外部 External CPA · 备选」显式连接独立可达的 CPA。Managed 必须**显式**选择「保持插件关闭（推荐）」或「启用插件」；插件可能运行高权限能力。`full` 镜像引擎已就绪；`slim` 需先按向导准备官方固定版本的 CPA 产物（下载或上传并校验摘要）。
3. **访问入口前缀**：Managed 配置管理入口与独立推理前缀（默认两套独立随机 16 位，可各自自定义；共用需显式勾选）；External 只配置管理前缀，模型推理仍直连外部 CPA。不要把安装/引导端点或管理 API（例如 `/.well-known/cpamp-bootstrap`、`<控制前缀>/api/v2/*`）当成模型 API，模型流量只走推理前缀或外部 CPA 地址。
4. **完成升级验证**：「完成升级验证」是唯一完成门禁；通过后点「激活 v2 并重启」，由受控容器重启让已提交路由生效。
5. **最终验收**：打开规范控制台 `<origin><控制前缀>`（不加 `/ui`；管理 API 位于 `<控制前缀>/api/v2/*`），用原管理员密钥登录。Managed 用正确 Client Key 请求 `<origin><推理前缀>/v1/models` 应返回 `200`，错误 key 应返回 `401`；External 则直接验证外部 CPA 的模型入口。之后不要再运行常规终端迁移命令（`cpa-import`/`verify`/属主修正或反复 `docker compose up`）；需要恢复时回到脚本同一 `--state-dir`。

完成页可以复制不含密钥的接入地址。若只忘记前缀，用 [`cpa-manager-plus access show`](../deployment/docker.md#忘记接入前缀) 在目标 v2 容器内查询，不需要重跑升级或保留原 `--state-dir`。

### 第 4 步：恢复、重跑与显式回滚

恢复就是使用同一 `--state-dir` 重跑脚本。脚本会绑定原来的 Manager/CPA 身份、镜像、卷、挂载与 origin；与记录冲突的参数会被拒绝，而不是覆盖。已完成的操作不会重复迁移；脚本不会自动回滚，也不会在 v2 已写入后假装可以无损退回。已完成并激活的操作再次重跑时，脚本打印 `<origin><已提交控制前缀>`。直接打开该地址，不要添加 `/ui`，也不要回到已退役的 `/.well-known/cpamp-bootstrap/ui`。

```bash
bash upgrade-cpamp-v2.sh --state-dir '/绝对路径/独立状态目录'
bash upgrade-cpamp-v2.sh --state-dir '/绝对路径/独立状态目录' --rollback
```

`--rollback` 是显式操作：脚本先核对来源身份、已验证的目标与三个操作卷，再停止该目标，并只重启升级前实际在运行的旧容器。它**不会**把 v2 写入反向迁移回 1.x；v2 的 data、backup、runtime 三个卷保留用于诊断并再次打印。回滚后不要继续同一操作，新的升级必须重新评估来源。

### 误挂 1.x 数据卷时

1.x 的锁文件与 `data.key` 属主是 `0:0`，而 v2 Manager 以 `10002:10002` 运行；把原 1.x 卷直接挂到 v2 的 `/data` 不受支持，会停在只读引导页并报告 `source_ownership_unavailable`，此时原数据库与密钥未被修改。

- **正确做法**：停止那个手工挂载的容器，保留原 1.x 容器与卷不动，改用同版 `bin/upgrade-cpamp-v2.sh` 对原 Manager 执行升级。脚本以只读来源挂载和临时受限 worker 读取原卷，不需要改动原文件属主。
- **不要**对原 1.x 数据、`/data` 或 `/data/runtime` 手工执行 `chown`，也不要重新初始化原安装或删除锁文件来强行打开页面。无法按标准流程恢复时先保持原数据不变，并在宿主机检查原部署。

### 公网 origin 与 External 网络边界

- 通过受控 TLS 反向代理或远程 Docker 访问时，用 `--public-origin 'https://<你的实际origin>'` 明确声明浏览器使用的固定 http(s) origin（也可用 `CPAMP_PUBLIC_ORIGIN`，两者冲突会被拒绝）。origin 会持久化并绑定到目标容器环境；`--public-host` 只用于生成显示地址，不是 TLS 权威。服务端不会信任可伪造的 `X-Forwarded-Proto`，不要靠该头推断 HTTPS 或 origin。
- External 只设置管理入口前缀，模型推理仍直连外部独立运维的 CPA。若先用 `--mode managed` 准备，脚本会停止原 CPA；此时改选 External 必须另行提供一个已运行且可达的 CPA，升级页面不能启动 Docker 容器。
- External 地址必须同时被目标容器和实际客户端访问到；跨 Docker 网络时用 `--network` 接入既有网络，不要假设 Docker 内部 DNS 名在外部网络或宿主机上可用。

### CLI 引擎与 Native（手动路径）

脚本只覆盖 Docker 旧部署；Native 或手工准备的安装不承诺由脚本升级，也不能把 Docker 命令改成 Native 命令照抄。CLI 升级引擎仍是可复用的高级路径，下列步骤自包含：

1. 停止旧 1.x Manager、待导入 CPA 及目标 Native launcher/systemd 栈。用原 1.x 绝对数据目录作为 `--legacy`，新包的绝对 `data/` 作为目标；离线执行 `preflight --target-dir ...` → `run --target ...` → `reconcile --target ...`。`--target-dir` 只属于 `preflight`；自定义备份目录在 `run/reconcile` 中用 `--bundle`，在 `rollback --prepare/--verify` 中用同一路径的 `--backup`。若宿主机 `TMPDIR` 落在 `--legacy`、`--target` 或 `--backup` 内部，可在 `preflight`、`run`、`reconcile`、`cpa-import`、`external-connect`、`verify`、`status` 与 `rollback --prepare/--verify` 上显式传入 `--scratch-dir <独立临时目录>` 覆盖 `TMPDIR`（仍会校验其不与源/目标/备份目录重叠）。
2. External 用宿主机私有凭证文件执行 `external-connect`，必要时同步 `store-cpa-connection`，再离线执行 `verify`。Managed 则在对账成功后启动已配置的 Native launcher/systemd 服务，保持公开业务隔离；未完成升级时 Manager 保持只读并释放锁，Runtime Supervisor 必须运行。执行 `cpa-import --legacy <旧目录> --target <新data目录> --cpa-dir <旧CPA目录> --cpa-auth-dir <旧CPA凭证目录> --cpa-version <实际CPA-v8版本> --plugins false`，并通过实际的 `CPAMP_RUNTIME_URL`、`CPAMP_RUNTIME_TOKEN_FILE` 指向运行中的 Supervisor（Native 默认 `http://127.0.0.1:18318` 与 `<包根目录>/run/runtime-token`，不是 Docker 的 `9081` 与 `/data/runtime-secret/token`）；`cpa-import` 还需 `CPA_UPSTREAM_URL` 或 `--destination-url`。随后执行 `verify --legacy ... --target ... --control-base-path '/<控制前缀>' --inference-base-path '/<推理前缀>'`（External 不传推理前缀）。
3. `verify` 必须在 Supervisor 与 Managed CPA 运行且 Ready 时执行；`status --db-path <新data目录>/usage.sqlite --json` 确认阶段为 `complete` 后，重启 Native 服务并恢复流量，访问升级时提交的控制入口；Managed 同时按推理前缀验证模型请求。
4. Native 回滚前停止整个目标栈（包括公开 Ingress）。`rollback --prepare` 生成的是 **Docker Compose 计划，不是 systemd 服务计划**，不要直接应用到 Native 服务。生成计划时将 `--volume` 绑定原绝对源目录，并传入真实 `--manager-addr`（默认 `127.0.0.1:18319`）。操作者独立恢复原精确 1.x 二进制、服务和原数据，核对实际二进制、数据路径与计划的独立端口，再从宿主机按计划执行 `rollback --verify ... --status-url http://127.0.0.1:18318/health --manager-addr 127.0.0.1:18319`。CLI 的健康身份和数据检查不能代替 Native 二进制/服务身份核对；不要使用容器专用的 `host.docker.internal`。

| 报告/退出码 | 操作 |
| --- | --- |
| `0` | 当前步骤成功；仍须核对阶段，不等于所有步骤完成 |
| `1` | 阻塞/拒绝/待确认：读报告，停止自动推进 |
| `2` | 用法、环境或可重试错误：排除原因后再重试 |
| `upgrade_source_version_unsupported` | 核对来源是否属于已证明的 v1.14.x family/profile；`--source-version` 只作如实声明，不能覆盖格式判定 |
| `upgrade_cpa_version_unsupported` / `upgrade_cpa_version_required` / `external_cpa_version_unsupported` | CPA 必须为 v8 主版本（`8.0.0` 起，拒绝 9+）；Managed 源须在 1.x 栈内已是 CPA v8，External 须提供 v8 配置文档；无法从镜像/标签证明时如实传入 `--cpa-version` |
| `upgrade_source_busy` / `upgrade_store_locked` | 停止真实源/目标 Manager，不能移除锁文件规避 |
| `upgrade_source_changed` | 源仍在变化；停止所有写入，重新评估源和备份 |
| `upgrade_worker_unavailable` | 保留升级页面并重新读取状态；Docker 恢复用同一 `--state-dir` 重跑脚本，不要重新初始化 |
| `source_ownership_unavailable`（`/.well-known/cpamp-bootstrap`） | 原 1.x 卷被直接挂到了 v2 的 `/data`：停止该容器、保留原卷，改用 `bin/upgrade-cpamp-v2.sh` 标准流程；不要修改原数据属主或重新初始化 |

## 既有 v2 实例升级：签名槽位自更新、手动换版与 CPA 基线

已完成初始化或迁移的 v2 实例通过独立的 `update-index-v2.json`（`schema_version: 2`）发现更新，不会读取或影响 1.x 的 `update-index.json` 与 `releases/latest`，并按内置 `provenance.json` 自动识别当前运行形态（`docker-full`、`docker-slim`、`native`）。

### 面板一键签名槽位自更新与自动回滚（`v2.0.0-beta.1` 出厂内置）

在单容器 Docker（`slim` / `full`）及以 root 运行的 Linux Native（`systemd`）部署中，v2 由 `cpamp-launcher` 在应用内完成控制面自更新，无需挂载 `/var/run/docker.sock` 或额外部署伴生容器：

1. **离线 Ed25519 验签与只读槽位暂存**：在「系统管理 → 系统更新」中可在线拉取或离线上传同架构的 `cpamp-slot_<tag>_linux_amd64.tar.gz` 槽位包。`cpamp-launcher` 先使用编译期内置的离线根公钥（`cpamp-root-2026-01`）验证 `slot-manifest.json.sig`、校验 `min_base_epoch` 与全量成员 SHA-256，再将静态二进制与运行时种子写入 `/data/runtime/cpamp/slots/<ver>/`（属主 `0:0`、二进制 `0555`，Manager `10002`、Supervisor `10001` 与 Ingress `10003` 均无写权限）。
2. **在线快照、写围栏与原地换代**：点击激活后，Manager 先通过 `VACUUM INTO` 在 `<dataDir>/backups/` 生成停机前在线 SQLite 快照并开启试运行写围栏（暂停外部与后台写入，保持只读查询可用）；`cpamp-launcher` 有序排空子进程后调用 `unix.Exec` 原地替换 `PID 1` 进程镜像（容器不退出），并启动 60 秒 Trial 看门狗与 5 秒零重启稳定期检查（验证 `/health` 返回 `200` 且子进程稳定存活）。
3. **提交前自动回滚与同代际一键回退**：若新槽位在开放业务写入前未通过健康检查或稳定期，看门狗会自动还原停机前快照并切回上一可用槽位或底座版本；已提交且 SQLite `schema_generation` 未跨代变化的槽位，可在系统更新页一键回退。控制台顶栏、系统更新页与 `/health` 会同时展示当前运行版本（`version`）与底座镜像/原生包版本（`base_version`）。

### 手动更新 Docker 镜像或 Native 底座包

跨越 `base_epoch` 基础运行库代际，或按常规运维习惯手动更新底座镜像/原生包时，系统更新页同样会生成匹配当前变体（无 `v` 前缀的 `<semver>` 对应 `slim`、`<semver>-full` 对应 `full`）且绑定 `@sha256:<digest>` 的升级命令：

- **Docker 单镜像**：按页面给出的固定摘要引用更新 `docker-compose.yml` 或执行 `docker pull` 重建容器。冷启动时 `cpamp-launcher` 自动仲裁 `BaseVersion >= SlotVersion`：只要底座镜像版本不低于槽位版本，新镜像即自动优先接管并清理已被超越的旧槽位。
- **Linux `amd64` 原生包**：将新版本 `cpa-manager-plus-native-v2_<tag>_linux_amd64.tar.gz` 解压到现有安装目录**之外**的独立目录，进入解压目录执行原子升级命令（拒绝直接对 1.x 原生目录执行原地覆盖，自动保留自定义 `Environment=` / `EnvironmentFile=` / `ReadWritePaths=` 与 `150s` 停机排空预算，并在启动后健康检查失败时自动回滚二进制与 `systemd` 单元）：

```bash
sudo ./cpa-manager-plusctl upgrade --home /opt/cpa-manager-plus
```

### 跨代际数据库围栏与 `recovery_required` 人工恢复

v2 在 SQLite 中维护单调递增的 `upgrade_schema_meta` 与 `PRAGMA user_version` 降级围栏：旧版本二进制检测到高代际数据库时会在零写入状态下拒绝启动，防止误回退损坏数据。新版本完成迁移并开放业务写入后，系统**不会**静默自动还原旧快照，以免无声丢弃升级后新产生的用量与配置记录。若自动回滚异常中断使槽位状态进入 `recovery_required` 横幅锁定态，或确需放弃升级后新增写入并人工回退数据库，请先停止服务再按[升级前自动快照与事后人工恢复](./backup.md#升级前自动快照与事后人工恢复-restore-pre-migrate)执行 `cpa-manager-plus restore-pre-migrate`。

### 内置 CPA 引擎更新与切回内置基线

Managed 模式的「系统更新 → CPA 引擎」仅接受官方 CPA `v8`（最低 `v8.0.55`），并在目标制品通过摘要与运行确认后记录来源血统（`selection-provenance.json`）：

- **`:full` 切回内置基线（`adopt-baseline`）**：若此前通过面板将内置 CPA 热更新到了其他 `v8.x` 版本（标记为 `user_update`），可在 CPA 引擎卡片一键执行「切回内置基线」，清除外部覆盖选择并回归当前底座内置且校验通过的 CPA 基线。
- **`:slim` 跨版本基线演进（`baseline_acquire`）**：当 `:slim` 实例更新底座镜像且新镜像锁定更高版本的官方 CPA 时，若当前仍处于初始基线（未由管理员手动覆写为 `user_update`），可在面板或向导中按固定摘要获取新基线 CPA 制品，不会覆盖管理员主动锁定的自定义 CPA 版本。

## 既有 v2 实例的补丁更新与推理前缀补全

- **普通补丁更新保留既有前缀**：已部署的 v2 实例（包括此前已提交 `/console` 作为控制前缀的实例）在普通补丁更新后原样保留其已提交的 `controlBasePath` 与 `inferenceBasePath`；控制台与环境变量均不提供二次修改入口。
- **缺少推理前缀的旧 Managed v2 实例**：若升级前仅提交了控制前缀（例如 `/console`）而尚未设置 `inferenceBasePath`，重启后模型网关保持关闭（返回 `503`，不回退到 `/` 或无前缀 `/v1`）。管理员使用原管理员密钥登录既有控制入口后，界面会触发**一次性推理前缀补全**：可输入自定义合法前缀或使用预填的 16 位加密随机前缀，也可以在了解安全边界后显式勾选与控制入口共用。补全提交后既有控制前缀保持不变，网关按新推理前缀开放。
- **早期未记录控制前缀的已完成升级库**：若升级库处于 `complete` 但未提交任何控制前缀，服务会拒绝静默放行；停止写入服务后执行一次 `cpa-manager-plus upgrade verify --target <v2_data_dir> --control-base-path '/<你的控制前缀>' [--inference-base-path '/<你的推理前缀>']`（External 不传推理前缀）即可一次性锁定前缀，无需重新挂载旧 1.x 源。

## 离线派生索引与数据维护（`cleanup-derived`）

为保证大库启动阶段有界监听，缺失的大表查询索引和旧派生数据清理不会在启动时无界阻塞；当控制台全局提示出现离线数据库维护横幅（`databaseMaintenance.required = true`）时，先停止整个 v2 服务再以 Manager 身份运行 `cleanup-derived`（不会删除或改写权威 `usage_events`）：

```bash
docker compose stop
docker compose run --rm --no-deps -u 10002:10002 --entrypoint cpa-manager-plus \
  cpa-manager-plus cleanup-derived --db-path /data/usage.sqlite
docker compose up -d
```

`linux/amd64` 原生包在停止完整 launcher / `systemd` 服务后执行：

```bash
sudo ./bin/cpa-manager-plus cleanup-derived --db-path "$PWD/data/usage.sqlite"
```

## 1.x（升级前）

早于受支持 family 的 1.x，或任何未经预检证明的 1.x 来源，都必须先按原 1.x 部署方式升级到受支持的 **v1.14.x** 并验证运行正常，再执行本页的 v2 升级；不要只修改 `--source-version` 来冒充。继续留在 1.x Stable 分支内的日常更新步骤，请参阅 1.x 稳定版文档：[更新 CPA Manager Plus（1.x Stable）](https://cpamp-docs.seakee.dev/operations/update.html)。
