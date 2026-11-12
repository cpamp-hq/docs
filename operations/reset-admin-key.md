# 重置管理员密钥

忘记 CPAMP 管理员密钥时，在停机状态下使用 `reset-admin-key` 重置 Manager 的管理员登录凭证。该命令只替换 SQLite 中的 `settings.admin_credential_v1`（盐与 HMAC 摘要），不会恢复丢失的 `/data/data.key`，不会修改 `/data/runtime` 或 `/data/runtime-secret/token`，也不会轮换 CPA Management Key / Client Key、重新认领全新安装或完成未结束的升级。全新安装请使用 [Host initialize 与 Handoff](../deployment/docker.md)，升级中的拒绝按 [升级与回滚](./update.md)（精确基线 `v1.14.10`、目标 CPA 最低 `v8.0.55`）处理。

## 执行前检查

1. 停止整个 v2 服务（Docker 执行 `docker compose stop`，`linux/amd64` 原生包停止完整 launcher / `systemd` 服务），释放 SQLite 进程锁。
2. 按 [备份与恢复](./backup.md) 停机备份单一 `/data` 数据卷（含 Manager 的 `usage.sqlite`、WAL/SHM、`data.key`、存在时的 `usage-archives/`，以及 Embedded 的 `/data/runtime` 与 `/data/runtime-secret/token`）。
3. 不要删除数据卷、`usage.sqlite.manager.lock` 或安装记录。
4. 若 Fresh 首次引导尚未提交管理员密钥，不要运行 `reset-admin-key`；使用 `initialize` 重新取得 Handoff 并继续向导。重置命令不会同步 Fresh 的 `AdminInitialized` 状态，提前写入凭证会使 Fresh 状态不一致。
5. 若启动配置含 `CPA_MANAGER_ADMIN_KEY` 或 `CPA_MANAGER_ADMIN_KEY_FILE`，在重启前同步为重置后的密钥，或移除该启动配置。Fresh 实例发现启动密钥与数据库不一致会报 `Fresh authority conflict` 并保持未就绪，**不会覆盖数据库**；从 1.x 升级的实例保留已有数据库凭证，启动环境也不会覆盖它。

## Docker Compose（单镜像）

在 `docker-compose.yml` 所在目录/同一项目下执行（保留固定摘要的 `seakee/cpa-manager-plus:<tag>@sha256:<digest>` 单镜像）：

```bash
docker compose stop
docker compose run --rm --no-deps -u 10002:10002 --entrypoint cpa-manager-plus \
  cpa-manager-plus reset-admin-key --db-path /data/usage.sqlite
```

`-u 10002:10002 --entrypoint cpa-manager-plus` 直接以 Manager 非特权运行身份（`10002:10002`）调用 CLI，避免默认 PID 1 启动器拉起服务，并确保 SQLite、WAL 与锁文件属主保持 `10002:10002`（不改为 `0:0`）。未传密钥参数时，终端仅输出一次随机生成的密钥：

```text
CPA Manager Plus admin key reset.
New admin key: cpamp_...
Save this value now. It will not be shown again.
```

立即妥善保存该密钥，不要让输出进入公开日志或聊天记录。命令成功且已按上述规则同步启动密钥后，再启动服务并核对 CPA 连接。Fresh 实例使用安装时设置的控制台地址（默认 `http://<host>:18317/console`）；从 1.x 升级的实例使用 `http://<host>:18317/management.html`（或 `/`）。

```bash
docker compose up -d
```

## 指定新管理员密钥（`--admin-key-file`）

如需显式指定新密钥，优先使用 `--admin-key-file`（不要与 `--admin-key` 同时传入，也避免明文进入 shell 历史）。Docker 一次性容器以 `10002:10002` 运行，宿主机临时密钥文件须对 UID `10002` 可读且只读挂载到容器内路径：

```bash
sudo install -m 0400 -o 10002 -g 10002 /dev/null /srv/new-cpamp-admin-key.txt
sudo sh -c "printf '%s\n' 'replace-with-a-long-random-admin-key' > /srv/new-cpamp-admin-key.txt"
docker compose stop
docker compose run --rm --no-deps -u 10002:10002 --entrypoint cpa-manager-plus \
  -v /srv/new-cpamp-admin-key.txt:/run/secrets/new_admin_key:ro \
  cpa-manager-plus reset-admin-key \
  --db-path /data/usage.sqlite \
  --admin-key-file /run/secrets/new_admin_key
docker compose up -d
```

显式指定密钥时，命令只写入摘要、不回显明文（输出 `Use the provided admin key to log in after restarting Manager Server.`）。验证控制台登录与 CPA 连接正常后，删除宿主机上的临时密钥文件 `/srv/new-cpamp-admin-key.txt`。

## linux/amd64 原生包

停止完整 launcher / `systemd` 服务并完成备份后，从解压后的包根目录执行：

```bash
sudo ./bin/cpa-manager-plus reset-admin-key --db-path "$PWD/data/usage.sqlite"
```

如需使用 `--admin-key-file`，传入权限受限的宿主机私有文件；成功后重启原服务并验证登录，不要重新运行 `initialize`。

::: details 高级：命令内部行为
`cpa-manager-plus reset-admin-key`（别名 `reset-admin-password`）在获取独占进程锁后校验目标文件存在、非空且包含 `settings` 与 `usage_events` 表，随后更新 `settings.admin_credential_v1`（保留已有 `CreatedAtMS` 并刷新 `RotatedAtMS`）。命令不启动 HTTP 服务、采集器或后台任务，也不读取 `data.key` 或 `/data/runtime-secret/token`。
:::

## 排障

- `acquire admin reset lock; stop Manager Server and retry`：服务仍在运行或锁被占用；确认 `docker compose stop` 或 `systemctl stop` 已完成，切勿手动删除锁文件。
- `SQLite database not found at ...` / `is empty` / `does not look like a CPA Manager Plus Manager Server database`：`--db-path` 指向了错误路径或新挂载的空卷；保持服务停止并核对实际数据卷映射。
- 生成的新密钥未及时保存：在服务保持停止的状态下重新运行同一命令，会生成新的随机密钥。

## 1.x（升级前）

1.x Stable 部署（如 `docker-compose.manager.yml`、`install-cpamp.sh` 的 `CPAMP_OPERATION=repair` 或多平台 1.x 原生二进制）的重置步骤与 v2 单镜像不同，请参阅 1.x 稳定版文档：[重置管理员密钥（1.x Stable）](https://cpamp-docs.seakee.dev/operations/reset-admin-key.html)。
