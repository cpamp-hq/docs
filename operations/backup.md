# 备份与恢复

CPAMP 的请求历史、配置和加密凭证都在本机。备份时最容易犯的错，是只复制 `usage.sqlite`，漏掉 WAL/SHM、`data.key` 或安装目录里的 secret 文件。

## 持久化目录与必备备份项

v2 Beta 从 **`v1.14.10`** 离线升级，目标 CPA 最低 **`v8.0.55`**；备份不是迁移授权，迁移仍须通过 [升级预检与对账](./update.md)。v2 单镜像将全部持久化状态保存在单一命名卷 `cpamp-data`（容器内 `/data`），备份时必须成套保留：

- **Manager 数据（`10002:10002`）**：`/data/usage.sqlite`、`/data/usage.sqlite-wal`、`/data/usage.sqlite-shm`、`/data/usage.sqlite-journal`（存在时）、`/data/usage.sqlite.manager.lock`、`/data/data.key`（`0600`）、`/data/usage-archives/`（存在时；含原始请求归档与清单，不可只备份 SQLite）以及升级生成的 `/data/upgrade-backup/`（存在时）。
- **Embedded Runtime 状态（`/data/runtime`，根属主 `0:0`）**：`/data/runtime/.cpamp-v8-bootstrap`（`0:0`）、`/data/runtime/supervisor/`（`0:10001`，含 `operations.sqlite`、WAL/SHM，以及 `slim` 变体按需下载或上传校验后的 `artifacts/cpa/` 与激活状态）和 `/data/runtime/gateway/`（`10001:10001`，含 `config.yaml`、单数 `auth/`、`logs/` 与存在时的 `plugins/`）。不要只复制 CPA `config.yaml`。
- **Runtime 传输密钥（`0:10002`）**：`/data/runtime-secret/token`（`0640`）。
- **部署配置**：固定摘要的 `docker-compose.yml`（`seakee/cpa-manager-plus:<tag>@sha256:<digest>`）、`CPAMP_PUBLIC_ORIGIN`、自定义环境变量与反向代理配置。备份归档应加密存储并限制访问权限。

## 为什么必须备份 data.key

Manager 保存的 CPA Management Key 使用 `data.key` 加密后写入 SQLite：

- 只有 `usage.sqlite` 泄露时，无法直接读出明文 CPA Management Key。
- `usage.sqlite` 与 `data.key` 同时泄露时，已保存的密钥可被解密，因此备份归档本身必须按机密保护。
- 丢失 `data.key` 时，已加密的 CPA 连接密钥无法恢复，重置 CPAMP Admin Key 也不能修复丢失的 `data.key`。

## Docker 全量停机备份

在 `docker-compose.yml` 所在目录、同一项目下，将以下完整子 shell 块作为一次操作执行。`docker compose stop` 会按 `stop_grace_period: 150s`（至少 `CPAMP_DRAIN_TIMEOUT` + `60s`）有序排空并停止容器内全部进程；`mktemp -d` 创建私有唯一目录，容器内以 `-u 0:0` 配合 `--numeric-owner` 完整保留 `/data` 内多角色数字 UID/GID 与权限，`set -C` 拒绝覆盖已有归档，`set -eu` 在任一步失败时立即停止，不自动重启服务。记录打印的备份路径：

```bash
(
  set -eu
  umask 077
  BACKUP_DIR="$(mktemp -d "$PWD/cpampd-backup.XXXXXX")"
  printf 'Backup directory: %s\n' "$BACKUP_DIR"
  docker compose stop
  docker compose run --rm --no-deps -u 0:0 \
    -v "$BACKUP_DIR":/backup --entrypoint sh cpa-manager-plus -ec '
      set -C
      tar --numeric-owner -czpf - -C /data . > /backup/cpamp-data.tgz
      gzip -t /backup/cpamp-data.tgz
      tar -tzf /backup/cpamp-data.tgz > /dev/null
    '
  docker compose up -d
)
```

只有归档写入、gzip 完整性检查及 tar 目录读取全部成功，才会运行最后的 `up -d`。任一步失败时保留目录及错误信息，服务保持停止，排除原因后重新创建新的备份目录；不在半成品目录重写归档。命令复用已固定 Digest 的单镜像，离线期间不能有其他进程写入原卷。

## 恢复到全新、已核对为空的数据卷

先准备备份对应的 `docker-compose.yml`（保持同版固定摘要镜像）与原公开 origin/环境配置，保留原卷不动。以下 `BACKUP_DIR` 必须替换为上一节成功备份的真实绝对目录。其余 `RESTORE_*` 仅是本段 shell/Compose override 的变量，不是新的 CPAMP 配置项。脚本先生成并校验合法的恢复项目名、验证合并后的 Compose 配置和新卷名；这些检查全部通过后，才停止原项目、创建全新的 `cpamp-data` 恢复卷，通过 override 显式绑定并确认空目录后才按数字属主解压。不要删除原项目的卷来制造“空卷”。

```bash
(
  set -eu
  umask 077
  BACKUP_DIR='/absolute/path/to/successful/cpampd-backup.XXXXXX'
  test -d "$BACKUP_DIR"
  RESTORE_DIR="$(mktemp -d "$PWD/cpampd-restore.XXXXXX")"
  RESTORE_PROJECT="$(basename "$RESTORE_DIR" | tr '[:upper:].' '[:lower:]-')"
  case "$RESTORE_PROJECT" in
    ''|[!a-z0-9]*|*[!a-z0-9_-]*)
      printf 'Invalid restore project name: %s\n' "$RESTORE_PROJECT" >&2
      exit 1 ;;
  esac
  RESTORE_DATA_VOLUME="$RESTORE_PROJECT-data"
  printf 'Restore project: %s\nRestore directory: %s\n' "$RESTORE_PROJECT" "$RESTORE_DIR"
  cat > "$RESTORE_DIR/volumes.yml" <<YAML
volumes:
  cpamp-data:
    external: true
    name: "$RESTORE_DATA_VOLUME"
YAML
  restore_compose() {
    docker compose -p "$RESTORE_PROJECT" -f docker-compose.yml \
      -f "$RESTORE_DIR/volumes.yml" "$@"
  }
  restore_compose config > /dev/null
  if docker volume inspect "$RESTORE_DATA_VOLUME" > /dev/null 2>&1; then
    printf 'Refusing existing volume: %s\n' "$RESTORE_DATA_VOLUME" >&2
    exit 1
  fi
  docker compose stop
  docker volume create "$RESTORE_DATA_VOLUME"
  restore_compose run --rm --no-deps -u 0:0 --entrypoint sh cpa-manager-plus -ec '
    entries="$(find /data -mindepth 1 -maxdepth 1 -print -quit)"
    test -z "$entries"
  '
  restore_compose run --rm --no-deps -u 0:0 -v "$BACKUP_DIR":/backup:ro \
    --entrypoint sh cpa-manager-plus -ec '
      gzip -t /backup/cpamp-data.tgz
      tar -tzf /backup/cpamp-data.tgz > /dev/null
    '
  restore_compose run --rm --no-deps -u 0:0 -v "$BACKUP_DIR":/backup:ro \
    --entrypoint tar cpa-manager-plus --numeric-owner -xzpf /backup/cpamp-data.tgz -C /data
  restore_compose up -d
)
```

脚本只在空卷检查、归档校验和解压全部成功后启动恢复项目；失败则不启动，保留原卷及恢复目录以便诊断，再换用新的空卷重试。后续必须保留打印的恢复项目名及 `volumes.yml`，始终使用同一 `-p` 和两份 `-f` 参数管理恢复实例；直接运行原项目命令会使用原卷，不是恢复卷。两个项目不能同时占用同一公开端口。

保留归档中的数字属主、权限及目录隔离（`/data/runtime` 根为 `0:0`、Manager 文件为 `10002:10002`、Gateway 为 `10001:10001`），切勿对 `/data` 递归 `chown -R` 为单一用户身份。核对 Admin 登录、CPA 连接、Client Key、历史/coverage 与 Gateway；`/health` 单独成功不代表全部恢复。回退 1.x 必须使用迁移前的原 1.x 卷，不能使用 v2 归档或恢复卷。

## Manager 离线快照（`manager-data-snapshot`）的边界

`manager-data-snapshot` 在停止服务后为数据库、WAL/SHM、rollback journal 和 `data.key` 创建带完整性清单的快照；**不包含 `usage-archives/`、自定义配置、`/data/runtime`、`/data/runtime-secret` 或外部 CPA**，不能替代全量备份。在原生 v2 包根目录执行以下备份命令（快照目录必须尚不存在）：

```bash
sudo ./bin/cpa-manager-plus manager-data-snapshot create \
  --db-path "$PWD/data/usage.sqlite" --data-key-path "$PWD/data/data.key" \
  --snapshot-dir "$PWD/backup/manager-snapshot"
```

只有需要恢复时才运行：

```bash
sudo ./bin/cpa-manager-plus manager-data-snapshot restore \
  --db-path "$PWD/data/usage.sqlite" --data-key-path "$PWD/data/data.key" \
  --snapshot-dir "$PWD/backup/manager-snapshot"
```

锁被占用时命令拒绝，先停止实际服务。Docker 可在 `docker compose stop` 后使用同一 Compose 的 `docker compose run --rm --no-deps -u 10002:10002 -v "$SNAPSHOT_PARENT":/snapshots --entrypoint cpa-manager-plus cpa-manager-plus manager-data-snapshot ...`（确保宿主机挂载目录对 UID `10002` 可写），指定 `/data/usage.sqlite`、`/data/data.key` 和尚不存在的快照子目录。Native 完整备份/恢复还要包括同次的 `data/runtime/` 及 `run/` 中的 secret，保留属主/权限。

External 的 CPA 配置、OAuth 凭证及进程由操作者独立备份/恢复；Manager 快照不会备份远端主机。只保留配置的导出也不是 v2 完整升级路径。

## 1.x（升级前）

在将 `v1.14.10` 实例离线升级到 v2 前，先停止 1.x 服务并完整备份原 1.x 数据卷/目录（`usage.sqlite`、WAL/SHM、`data.key`、存在时的 `usage-archives/`、配置与 `secrets/`）。1.x Stable 部署的日常备份、恢复与离线 `store-cpa-connection` 步骤请参阅 1.x 稳定版文档：[备份与恢复（1.x Stable）](https://cpamp-docs.seakee.dev/operations/backup.html)。
