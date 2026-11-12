# 备份与恢复

CPAMP 的请求历史、配置和加密凭证都在本机。备份时最容易犯的错，是只复制 `usage.sqlite`，漏掉 WAL/SHM、`data.key` 或安装目录里的 secret 文件。

## 必备备份文件

至少把这些文件作为一组备份：

- `usage.sqlite`
- `usage.sqlite-wal`
- `usage.sqlite-shm`
- `data.key`
- `usage-archives/`（若存在；包括原始请求归档及清单，不可只备份 SQLite）
- `usage.sqlite-journal`（若存在）

如果部署目录还有自定义配置文件，也应一起备份。使用一键安装脚本时，至少额外备份安装目录中的 `secrets/` 和 `data/`；成功导入后通常不会再有 `secrets/cpa-management-key`，但升级失败或 `CPAMP_SKIP_EXECUTE=1` 时该临时文件可能仍需保留以便重试。手动 env/secret 部署仍应备份对应 secret 文件。

## 为什么必须备份 data.key

通过 setup 或面板保存的 CPA 连接，会把 CPA Management Key 使用 `data.key` 加密后保存到 SQLite。

- 只有 `usage.sqlite` 泄露时，攻击者不能直接读出 CPA Management Key。
- `usage.sqlite` 和 `data.key` 同时泄露时，CPA Management Key 可被解密。
- 丢失 `data.key` 时，已经保存的 CPA Management Key 无法恢复，只能重新保存 CPA 连接配置。

如果 CPA 连接由手动环境变量或 secret 文件管理，CPA Management Key 可能不写入 SQLite；请把对应的 secret 文件和数据目录作为一组备份。一键安装器的 env 输入会在成功后迁移到 SQLite，不应只备份一次性输入文件。

## v2 Beta：Embedded 全栈备份与恢复

v2 Beta 从 **`v1.14.10`** 离线升级，目标 CPA 最低 **`v8.0.55`**；备份不是迁移授权，仍须通过 [升级预检与对账](./update.md)。v2 单镜像将全部持久化状态保存在单一命名卷 `cpamp-data`（容器内 `/data`）：

- **Manager 数据（`10002:10002`）**：`/data/usage.sqlite`、WAL/SHM/journal（存在时）、`/data/usage.sqlite.manager.lock`、`/data/data.key`（`0600`）、`/data/usage-archives/`（存在时）以及升级生成的 `/data/upgrade-backup/`（存在时）。丢失 `data.key` 无法通过重置 Admin Key 修复。
- **Embedded Runtime 状态（`/data/runtime`，根属主 `0:0`）**：`/data/runtime/.cpamp-v8-bootstrap`（`0:0`）、`/data/runtime/supervisor/`（`0:10001`，含 `operations.sqlite`、WAL/SHM，以及 `slim` 变体按需下载或上传校验后的 `artifacts/cpa/` 与激活状态）和 `/data/runtime/gateway/`（`10001:10001`，含 `config.yaml`、单数 `auth/`、`logs/` 与存在时的 `plugins/`）。不要只复制 CPA `config.yaml`。
- **Runtime 传输密钥（`0:10002`）**：`/data/runtime-secret/token`（`0640`）。同时妥善保存固定摘要的 `docker-compose.yml`（`seakee/cpa-manager-plus:<tag>@sha256:<digest>`）、`CPAMP_PUBLIC_ORIGIN` 与环境配置；备份应加密并限制访问。

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

### 恢复到全新、已核对为空的数据卷

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

### Manager 离线快照的边界

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

## 1.x Stable：备份示例


## Docker 备份示例

如果使用 named volume，可以先停止容器，再用临时容器导出：

```bash
docker stop cpa-manager-plus
docker run --rm \
  -v cpa-manager-plus-data:/data:ro \
  -v "$PWD":/backup \
  alpine \
  tar czf /backup/cpa-manager-plus-data.tgz -C /data .
docker start cpa-manager-plus
```

如果使用宿主机目录挂载：

```bash
docker stop cpa-manager-plus
cp -a /srv/cpa-manager-plus-data /srv/cpa-manager-plus-data.backup
docker start cpa-manager-plus
```

## 原生包备份

停止进程后复制数据目录：

```bash
cp -a ./data ./data.backup
```

Windows PowerShell：

```powershell
Copy-Item -Recurse .\data .\data.backup
```

## 恢复

1. 停止 CPAMP。
2. 恢复完整数据目录。
3. 确认 `usage.sqlite` 和 `data.key` 来自同一次备份。
4. 如果使用 env/secret 管理 CPA 连接，同时恢复安装目录里的 `secrets/`。
5. 启动 CPAMP。
6. 登录后检查配置、监控数据和采集器状态。

如果恢复后出现解密失败，优先检查 `data.key` 是否和 SQLite 匹配。

## 不保留请求历史，只迁移 Manager 配置

如果旧 `usage.sqlite` 很大且请求历史不需要保留，可以让新实例使用空数据目录，然后通过现有 Manager 配置 API 导出和导入非敏感的 CPA 连接地址、采集器、Codex 巡检与 External Usage Service 配置。该方式不会复制 `usage_events`、rollup、巡检运行历史、模型价格、API 密钥别名或账号处理策略，也不会导出 CPA Management Key。

在旧实例仍可访问时导出：

```bash
export OLD_CPAMP_URL='http://old-host:18317'
export OLD_CPAMP_ADMIN_KEY='cpamp_...'

curl -fsS \
  -H "Authorization: Bearer ${OLD_CPAMP_ADMIN_KEY}" \
  "${OLD_CPAMP_URL}/usage-service/config" \
  | jq '{config: .config}' \
  > manager-config.json
chmod 600 manager-config.json
```

新版本的 `manager-config.json` 不包含 CPA Management Key；仍应按配置文件管理，避免把其他敏感配置提交到版本库或发送到 Issue。来自旧版本的导出文件可能包含明文密钥，必须立即按 secret 处理并在迁移后删除。

停止旧实例并准备新实例的空数据目录。先在 Manager Server 未运行时用离线命令重新提供 CPA Management Key：

```bash
cpa-manager-plus store-cpa-connection \
  --cpa-base-url 'http://cpa:8317' \
  --management-key-file '/secure/cpa-management-key' \
  --db-path './data/usage.sqlite' \
  --data-key-path './data/data.key'
```

该命令要求先停止 Manager Server；它会把密钥加密写入 SQLite，命令输出不会回显密钥。

连接记录的 authority 规则是：完整的 `manager_config_v1` 权威；它与过期或冲突的旧 `setup` 同时存在时，启动和导入会保留 manager 连接并 canonicalize setup，不需要修复。manager 只有 partial 数据而完整的旧 setup 与其已有字段兼容时，setup 会补全 manager。只有在没有完整 authority 且 partial 记录彼此冲突，或解析器无法判断持久化状态时，上面的命令才会拒绝写入并在错误信息中给出修复方式。确认要以显式提供的连接为准时，追加 `--repair-conflict` 修复：

```bash
cpa-manager-plus store-cpa-connection \
  --repair-conflict \
  --cpa-base-url 'http://cpa:8317' \
  --management-key-file '/secure/cpa-management-key' \
  --db-path './data/usage.sqlite' \
  --data-key-path './data/data.key'
```

`--repair-conflict` 只用于修复解析器无法信任的历史状态：互相冲突的 `manager_config_v1`/`setup` 记录，或与请求冲突且没有权威方的 partial 记录。它把你显式提供的连接在单个事务里同时写入 `manager_config_v1` 与旧 `setup` 镜像（密钥加密存储），并保留采集器设置与其他数据；对完整且一致的已存连接仍然要求输入完全匹配，不会静默改绑。修复完成后再正常启动，连接存储迁移会照常完成。然后再启动新实例并导入其余配置：

```bash
export NEW_CPAMP_URL='http://new-host:18317'
export NEW_CPAMP_ADMIN_KEY='cpamp_...'

curl -fsS \
  -X PUT \
  -H "Authorization: Bearer ${NEW_CPAMP_ADMIN_KEY}" \
  -H 'Content-Type: application/json' \
  --data-binary @manager-config.json \
  "${NEW_CPAMP_URL}/usage-service/config"
```

导入时会校验 CPA Management API；成功后检查采集器状态和相关开关。确认恢复完成后安全删除导出文件和临时密钥文件。

如果旧实例仍由环境变量或 secret 文件管理，API 返回的 `source` 为 `env`，连接字段不能通过 API 导入覆盖；应先用上面的离线命令把 CPA 连接写入新 SQLite，或在新实例 setup 中重新填写。管理员登录凭证也不属于 Manager 配置导出：新实例使用新生成或显式设置的 `CPA_MANAGER_ADMIN_KEY`。
