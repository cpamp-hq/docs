# 更新 CPA Manager Plus

## v2 Beta：从 1.x 升级，不是原地换镜像

::: warning 精确基线与停止条件
最低直接升级版本为 **`v1.14.10`**，当前 CLI 只接受这个精确声明，不代表所有更高 1.x 都自动合格。`<= v1.14.9` 必须先按原部署方式升级到 `v1.14.10`，验证正常后再停机；不要仅把 `--source-version` 改为该值。目标 CPA 最低 **`v8.0.55`**（Embedded 固定为该版本）。版本不符、未知/更新的 schema、源忙碌、证据失配或历史差异都必须按报告处理，不能修改 SQLite 标记来继续。
:::

1. 按 [v2 Docker 安装](../deployment/docker.md) 准备独立目录中的 `docker-compose.yml`：使用单一服务 `cpa-manager-plus`、单一数据卷 `cpamp-data:/data`（保持 `stop_grace_period: 150s`，至少为 `CPAMP_DRAIN_TIMEOUT` + `60s`），并将 `seakee/cpa-manager-plus` 固定到精确 Beta 标签与摘要（`slim` 如 `2.0.0-beta.1@sha256:<digest>`，离线/预置 CPA 的 `full` 如 `2.0.0-beta.1-full@sha256:<digest>`；Beta 期间 `:latest`、`:preview`、`:1`、`:1.14` 仍指向 1.x Stable，v2 镜像标签不带 `v` 前缀）。同时核对对应预发布说明与 `checksums.txt`；`releases/latest` 与安装脚本仍属于 1.x Stable。
2. 保存精确的 1.x 镜像/二进制、Compose、环境和数据卷映射。停止旧 Manager；若迁移托管 CPA，同时停止旧 CPA。备份 `usage.sqlite`、WAL/SHM、`data.key`、`usage-archives/`（若存在）、配置与 secrets，见 [备份](./backup.md)。阻止其他进程写入源目录。
3. 为 v2 使用**独立新 `/data` 数据卷**（`cpamp-data`），保留原 1.x 卷不变且仅在升级/回滚命令中只读挂到 `/legacy:ro`。复制、目标与备份目录不可包含彼此的源目录；临时快照目录也不能位于源或目标内。磁盘需求以预检报告为准。

镜像标签仅作已发布版本的示例；当前源码发布端仍限 v2 演练，单镜像构建能力不代表相应 Release、标签或多架构已经发布，见 [发布资产与门禁](../reference/releases.md)。`cpamp-data` 是 Compose 逻辑卷键，实际 Docker 卷名通常为 `<project>_cpamp-data`；本页复用同一项目的 `docker compose run/exec`，不要改成挂裸 `cpamp-data` 的 `docker run`。

### Docker：离线预检、copy-in、四域对账

下面在 v2 `docker-compose.yml` 所在目录运行。`LEGACY_MOUNT` 是**实际旧卷名**（先用 `docker inspect` 核对），不是新的空卷名。若旧部署使用 bind mount，把 `LEGACY_MOUNT` 和 `LEGACY_ROOT` 都设置为同一个实际宿主机绝对路径，使容器与回滚计划中的路径一致。示例卷名必须替换。一次性 CLI 通过 `--entrypoint cpa-manager-plus` 直接调用 Manager CLI（默认 `0:0` 以便读取 1.x `0:0` 属主的只读 `/legacy` 源，不改动原卷），并在服务启动前通过 `fix_manager_ownership` 仅将 `/data` 下 Manager 文件归属设为 `10002:10002`（切勿修改 `/data/runtime`）：

```bash
export LEGACY_MOUNT='actual-1x-manager-volume'
export LEGACY_ROOT='/legacy'
umask 077
mkdir -p upgrade-secrets
docker compose stop
upgrade_cli() {
  docker compose run --rm --no-deps -u 0:0 --entrypoint cpa-manager-plus \
    --add-host host.docker.internal:host-gateway \
    -v "$LEGACY_MOUNT:$LEGACY_ROOT:ro" \
    -v "$PWD/upgrade-secrets":/upgrade-secrets:ro \
    cpa-manager-plus upgrade "$@"
}
fix_manager_ownership() {
  docker compose run --rm --no-deps -u 0:0 --entrypoint sh cpa-manager-plus -ec '
    chown -h 10002:10002 /data/usage.sqlite* /data/data.key
    for d in /data/usage-archives /data/upgrade-backup; do
      [ -e "$d" ] && chown -R 10002:10002 "$d"
    done
  '
}
upgrade_cli preflight --legacy "$LEGACY_ROOT" \
  --source-version v1.14.10 --target-dir /data --json
```

先确认预检退出 `0` 且 `ready: true`，再分别执行：

```bash
upgrade_cli run --legacy "$LEGACY_ROOT" \
  --source-version v1.14.10 --target /data --json
upgrade_cli reconcile --legacy "$LEGACY_ROOT" \
  --source-version v1.14.10 --target /data --json
```

每步成功后才执行下一步。`run` 只备份及 copy-in，不会完成整个升级；默认备份位于目标的 `upgrade-backup/`。`reconcile` 比较 **`retained`、`pricing`、`coverage`、`history`** 四域，不适用项必须有原因。被报告为永久不完整的 UTC 日需要逐日审阅后，用同一 `reconcile` 命令增加重复的 `--acknowledge YYYY-MM-DD`；`--acknowledge-parity-gaps` 仅确认报告中旧版已丢失的 parity 日，不会接受其他实测失配。不要盲目加确认参数，也不要把确认解读为恢复了丢失历史。

### 完成 CPA 连接与最终核验

**External 路径**：由 CPA 操作者独立升级/配置 CPA 至至少 `v8.0.55`，使其可从 CLI 容器访问。把真实 Management Key 写入宿主机私有文件 `upgrade-secrets/cpa-management-key`（不要放入命令行）。以下 URL 为示例，必须替换；若目标外部 CPA 的 URL 或 Management Key 相比原 1.x 已变更，还需先执行一次 `store-cpa-connection` 同步目标库连接：

```bash
upgrade_cli external-connect --target /data \
  --cpa-base-url 'http://your-cpa-host:8317' \
  --management-key-file /upgrade-secrets/cpa-management-key --json
# 仅当外部 CPA 地址或 Management Key 与原 1.x 保存值不同时执行：
# docker compose run --rm --no-deps --entrypoint cpa-manager-plus \
#   --add-host host.docker.internal:host-gateway \
#   -v "$PWD/upgrade-secrets":/upgrade-secrets:ro \
#   cpa-manager-plus store-cpa-connection \
#   --cpa-base-url 'http://your-cpa-host:8317' \
#   --management-key-file /upgrade-secrets/cpa-management-key \
#   --db-path /data/usage.sqlite --data-key-path /data/data.key
upgrade_cli verify --legacy "$LEGACY_ROOT" --target /data --json
upgrade_cli status --db-path /data/usage.sqlite --json
fix_manager_ownership
docker compose up -d
```

只有真实连接、身份、模型面及对账证据通过且持久化阶段为 `complete` 才可运行最后的 `fix_manager_ownership` 与 `docker compose up -d` 启动正常产品。缺版本 header 时，`external-connect --cpa-version` 仅用于如实声明实际 CPA 版本，不会把 v7 变成 v8；密钥轮换后使用同一 URL 的 `--reprove` 重新证明，不要反复提交已拒绝凭证。

**Managed 路径**：还需导入旧 CPA 的配置/凭证并向容器内实时运行的 Runtime Supervisor（`127.0.0.1:9081`）证明目标，不是用 `external-connect` 连接内部地址。在单镜像中，未完成的升级记录会让容器内 `cpa-manager-plus` 停留在只读升级面并释放 SQLite 写锁，同时由 `cpamp-launcher` 启动 Runtime Supervisor 与 Ingress（升级完成前请在防火墙或反向代理隔离公开业务流量）。先执行 `fix_manager_ownership`，再用临时覆盖文件把原 1.x 数据卷、旧 CPA 目录及其真实 auth 目录只读挂入容器（路径/源 CPA 版本来自实际旧部署，插件选择必须显式给出）：

```text
fix_manager_ownership
cat > docker-compose.upgrade.yml <<'YAML'
services:
  cpa-manager-plus:
    volumes:
      - <旧Manager挂载源>:<原LEGACY_ROOT>:ro
      - <旧CPA绝对目录>:/legacy-cpa:ro
      - <旧CPA凭证绝对目录>:/legacy-cpa-auth:ro
YAML
docker compose -f docker-compose.yml -f docker-compose.upgrade.yml up -d
```

若使用 **`slim`** 镜像，此时先用浏览器打开公开入口，凭原 1.x 管理员密钥登录只读升级向导，从 CDN / GitHub Release 下载或上传对应的官方 `cli-proxy-api` `linux_<arch>.tar.gz` 以就绪固定摘要的 CPA 引擎（**`full`** 镜像已内置，无需此步）。随后在同一运行容器内执行 `cpa-import`、`verify` 与 `status`：

```text
docker compose -f docker-compose.yml -f docker-compose.upgrade.yml exec -T -u 0:0 \
  -e CPAMP_RUNTIME_URL=http://127.0.0.1:9081 \
  -e CPAMP_RUNTIME_TOKEN_FILE=/data/runtime-secret/token \
  cpa-manager-plus cpa-manager-plus upgrade cpa-import \
  --legacy <原LEGACY_ROOT> --target /data \
  --cpa-dir /legacy-cpa --cpa-auth-dir /legacy-cpa-auth \
  --cpa-version <实际源CPA版本> --plugins false --json
docker compose -f docker-compose.yml -f docker-compose.upgrade.yml exec -T -u 0:0 \
  -e CPAMP_RUNTIME_URL=http://127.0.0.1:9081 \
  -e CPAMP_RUNTIME_TOKEN_FILE=/data/runtime-secret/token \
  cpa-manager-plus cpa-manager-plus upgrade verify \
  --legacy <原LEGACY_ROOT> --target /data --json
docker compose -f docker-compose.yml -f docker-compose.upgrade.yml exec -T -u 0:0 \
  cpa-manager-plus cpa-manager-plus upgrade status \
  --db-path /data/usage.sqlite --json
```

这段是参数模板，替换所有尖括号后运行；`--plugins false` 是显式关闭插件的示例，按实际意图选择。`cpa-import` 或 `verify` 的资格与目标证明拒绝时立即停止，保留报告，不手工复制凭证到 `/data/runtime`。`upgrade verify` 必须在同一容器内 Runtime Supervisor 与目标 CPA 处于运行且 Ready 时执行。

这里升级 CLI 使用 `0:0` 是为了读取仍为 root 私有权限的原 1.x 源及 CPA 凭证；只读挂载不等于 UID `10002` 可读。不要按此身份启动长驻 Manager。CLI 可能生成 root 属主的 Manager WAL/锁文件，所以下面的停机属主修正不可省略；不要修改旧源权限来迁就目标。

只有 `upgrade status` 确认持久化阶段为 `complete` 后，才退出临时挂载、修正 Manager 文件属主并按正式 `docker-compose.yml` 启动完整服务与恢复公开流量：

```bash
docker compose -f docker-compose.yml -f docker-compose.upgrade.yml stop
rm -f docker-compose.upgrade.yml
fix_manager_ownership
docker compose up -d
```

保留原 1.x 数据与升级备份直到完整验收。升级完成并重启后，访问 `http://<host>:18317/management.html`（或根路径 `/`），使用原 1.x 管理员密钥登录；这条升级路径不会自动建立 Fresh 的 `/console`。核对公开 origin、Client Key、历史/coverage、账号状态与实际模型请求，`/health` 不能代替它们。

### 精确回滚到原 1.x 数据

回滚不是把 v2 SQLite 挂回旧镜像。停止**整个 v2 服务**，保留 v2 目录供诊断，仍在同一 Compose 项目与相同只读源挂载下生成计划：

```bash
docker compose stop
upgrade_cli rollback --prepare --legacy "$LEGACY_ROOT" --target /data \
  --volume "$LEGACY_MOUNT" --legacy-image seakee/cpa-manager-plus:v1.14.10
```

`--prepare` 只输出/保存计划，不控制 Docker。逐条在 **Docker 宿主机**检查输出的 preconditions：旧卷/绝对目录确实是 copy-in 的源，v2 已停，回滚端口空闲。默认旧 Manager 回滚端口是 **18318**，不同于 v2 公开端口 18317；容器内端口检查不能证明宿主机空闲。把输出的 Compose 内容和 invocation 应用于宿主机，或恢复原 1.x Compose 指向**原未修改的 1.x 卷**，使用计划的精确镜像与端口，恢复原 CPA 配置。不要使用浮动标签或 v2 数据副本。

旧 1.x 启动后，**必须先在 Docker 宿主机完成容器身份与挂载人工门禁，才能运行 `rollback --verify`**。CLI 没有 Docker socket，不能证明回答健康检查的容器确实使用了原数据卷。先以计划的实际回滚端口定位唯一容器，再把真实完整容器 ID 设为 `ROLLBACK_CONTAINER_ID`：

```bash
docker ps --no-trunc --filter publish=18318 --format '{{.ID}} {{.Image}} {{.Names}}'
export ROLLBACK_CONTAINER_ID='actual-full-container-id'
docker inspect --format '{{.Id}} {{.Config.Image}} {{.Image}}' "$ROLLBACK_CONTAINER_ID"
docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Type}} {{.Name}} {{.Source}} -> {{.Destination}}{{println}}{{end}}{{end}}' "$ROLLBACK_CONTAINER_ID"
```

确认容器 ID 就是本次重启的旧 Manager；`.Config.Image` 必须是计划中的精确镜像引用，`.Image` 是对应的实际镜像 ID。对于 named volume，核对 `/data` 的 `.Name` 等于原 `LEGACY_MOUNT`，并执行 `docker volume inspect "$LEGACY_MOUNT"`，确认输出的 `Mountpoint` 与该容器 `/data` 的 `.Source` 相同；对于 bind mount，`.Source` 必须等于原始宿主机绝对路径。另在容器间路径不同的环境中人工核对它确实是 copy-in 只读挂载的同一源。任何不一致或无法确认就停止，不执行核验。将此检查记录与计划一起保留。

门禁通过后，按计划输出的 `--backup` 与端口执行 `--verify`。在上述一次性 CLI 容器中，宿主机不是 `127.0.0.1`；默认端口示例为：

```bash
upgrade_cli rollback --verify --legacy "$LEGACY_ROOT" --target /data \
  --legacy-image seakee/cpa-manager-plus:v1.14.10 \
  --status-url http://host.docker.internal:18318/health
upgrade_cli status --db-path /data/usage.sqlite --json
```

如果使用自定义备份或端口，保留计划打印的 `--backup` 并改为实际端口。`rolled_back` 仅记录 CLI 的健康身份、源目录、备份完整性与保留数据检查通过，**不包含 Docker 容器/实际挂载的自动证明或人工确认字段**。只有结合上述操作者保存的容器与挂载检查记录，才能把回滚视为完成；普通 HTTP 请求退出 `0` 也不足以证明回滚。若计划拒绝，不重建源卷或删除升级记录来强行继续。

### Native 与常见诊断

linux/amd64 Native 使用同版包的 `bin/cpa-manager-plus upgrade ...`，但**不能把所有步骤一律改为停机运行**：

1. 停止旧 1.x Manager / 待导入 CPA 及目标 Native launcher/systemd 栈。用原 1.x 绝对数据目录作为 `--legacy`，新包的绝对 `data/` 作为目标；离线执行 `preflight --target-dir ...` → `run --target ...` → `reconcile --target ...`。`--target-dir` 只属于 `preflight`。自定义备份目录在 `run/reconcile` 中用 `--bundle`，在 `rollback --prepare/--verify` 中用同一路径的 `--backup`。
2. External 使用宿主机私有凭证文件执行 `external-connect`，必要时同步 `store-cpa-connection`，再离线 `verify`。Managed 则在对账成功后启动已配置的 Native launcher/systemd 服务，保持公开业务隔离；未完成升级时 Manager 保持只读并释放锁，Runtime Supervisor 必须运行。执行同样的 `cpa-import` 参数模板，但所有源/目标/凭证路径改为宿主机绝对路径，并为该 CLI 及随后的 `verify` 提供实际 `CPAMP_RUNTIME_URL`、`CPAMP_RUNTIME_TOKEN_FILE`；`cpa-import` 还需 `CPA_UPSTREAM_URL` 或 `--destination-url`。默认值分别为 `http://127.0.0.1:18318`、`<包根目录>/run/runtime-token` 和 `http://127.0.0.1:8317`，不是 Docker 的 `9081` 与 `/data/runtime-secret/token`。以与 Native Manager 相同的 root 身份执行（如 `sudo env CPAMP_RUNTIME_URL=... CPAMP_RUNTIME_TOKEN_FILE=... CPA_UPSTREAM_URL=... ./bin/cpa-manager-plus upgrade cpa-import ...`）。
3. `verify` 必须在 Supervisor 与 Managed CPA 运行且 Ready 时执行；`status --db-path <新data目录>/usage.sqlite --json` 确认阶段为 `complete` 后，重启 Native 服务并恢复流量，按上文升级入口验收。
4. Native 回滚前停止整个目标栈（包括公开 Ingress）。`rollback --prepare` 生成的是 **Docker Compose 计划，不是 systemd 服务计划**，不要直接应用到 Native 服务。生成计划时将 `--volume` 绑定原绝对源目录，并传入真实 `--manager-addr`（默认 `127.0.0.1:18319`）。操作者独立恢复原精确 1.x 二进制/服务和原数据，核对实际二进制、数据路径与计划的独立端口，再从宿主机按计划执行 `rollback --verify --legacy ... --target ... --backup ... --status-url http://127.0.0.1:18318/health --manager-addr 127.0.0.1:18319`（替换实际地址）。CLI 的健康身份和数据检查不能代替 Native 二进制/服务身份核对；不要使用容器专用的 `host.docker.internal`。

| 报告/退出码 | 操作 |
| --- | --- |
| `0` | 当前步骤成功；仍须核对阶段，不等于所有步骤完成 |
| `1` | 阻塞/拒绝/待确认：读报告，停止自动推进 |
| `2` | 用法、环境或可重试错误：排除原因后再重试 |
| `upgrade_source_version_unsupported` / `upgrade_source_version_undeclared` | 核对实际源版本和精确 `v1.14.10` 声明 |
| `upgrade_source_busy` / `upgrade_store_locked` | 停止真实源/目标 Manager，不能移除锁文件规避 |
| `upgrade_source_changed` | 源仍在变化；停止所有写入，重新评估源和备份 |
| `upgrade_rollback_image_unpinned` / `upgrade_rollback_volume_unbound` | 提供精确旧镜像和原卷映射，不能改用新空卷 |
| `source_ownership_unavailable`（`/.well-known/cpamp-bootstrap`） | 1.x 数据卷被直接挂到了 `/data`（锁/密钥属主为 `0:0`，而 v2 Manager 以 `10002:10002` 运行）：停止容器并改挂新 `/data` + 只读 `/legacy:ro`；若仅需只读查看升级入口，只修改 `usage.sqlite*` 与 `data.key` 属主为 `10002:10002`，切勿递归 `chown -R /data`（`/data/runtime` 必须保持 `0:0`） |

### 误将 1.x 数据卷挂到 `/data` 时

1.x 容器以 `root`（`0:0`）写入 `/data/usage.sqlite.manager.lock` 与 `/data/data.key`（`0600`），而 v2 单镜像中的 Manager 以非特权用户 `10002:10002` 运行、Supervisor 要求 `/data/runtime` 保持 `0:0`。若误把 1.x 卷直接挂到 `/data`，v2 会停留在只读引导页（`/.well-known/cpamp-bootstrap/ui`）并报告 `source_ownership_unavailable`，且未修改 1.x 数据库与密钥文件：

1. **推荐做法（标准升级）**：停止当前容器，保留原 1.x 卷只读挂到 `/legacy:ro`，为 `/data` 创建全新空卷后按上文执行 `upgrade preflight` 与 `upgrade run`。
2. **仅打开只读升级入口验证原 1.x 管理员密钥**：Docker 命名卷在宿主机上不存在 `/data` 路径，所以不要直接在宿主机执行 `chown /data/...`，改用“停止正在运行该卷的 v2 容器 → 一次性容器挂载该卷修改属主 → 启动 v2 容器 → 回到引导页重新检查”：

   ```bash
   docker stop <v2_container>
   docker run --rm -u 0:0 --entrypoint sh -v <1x_volume>:/data seakee/cpa-manager-plus:<v2_tag> \
     -c 'chown -h 10002:10002 /data/usage.sqlite* /data/data.key'
   docker start <v2_container>
   ```

   只修改 `usage.sqlite*` 与 `data.key` 的属主（属主变更只改文件元数据，不改写数据库内容）；切勿执行 `chown -R 10002:10002 /data`，`/data/runtime` 必须保持 `0:0`。完成后回到引导页点击“重新检查来源状态”。

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

`<= v1.14.9` 的旧实例在执行本页的 v2 离线 copy-in 之前，必须先按原 1.x 部署方式升级到精确基线 **`v1.14.10`** 并验证运行正常；继续留在 1.x Stable 分支内的日常更新步骤，请参阅 1.x 稳定版文档：[更新 CPA Manager Plus（1.x Stable）](https://cpamp-docs.seakee.dev/operations/update.html)。
