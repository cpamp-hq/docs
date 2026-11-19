# 从 CPA-Manager 迁移

本文面向从旧 `seakee/cpa-manager` / CPA-Manager 项目迁移到 `seakee/cpa-manager-plus` 的用户。目标是保留历史请求统计、模型价格、API 密钥别名和已保存的 CPA 连接配置。

如果你没有使用过旧 `seakee/cpa-manager`，不需要阅读本页，直接使用[快速开始](../guide/getting-started.md)。

::: warning 本页迁移路径面向 1.x Stable，升级 v2 Beta 须分两步执行
本页的直接挂卷/目录兼容迁移只把旧 `seakee/cpa-manager` 迁移到 **CPAMP 1.x Stable**（入口 `:18317/management.html`）。切勿将旧 `cpa-manager`（或 1.x）数据卷直接挂到 **v2 Beta** 的 `/data`，公开 Fresh 向导的 Adopt 也拒绝 `legacy_managed` 来源。若最终目标是 **v2 Beta**，请先按本页迁移到受支持的 **v1.14.x**（v2 预检以实际物理 schema 与语义 profile 是否通过为准，不是只能停在精确 `v1.14.10`；更早的 1.x 先升级到受支持的 v1.14.x）并验证运行正常，同时把 CPA 升级到 **CPA v8 主版本**（`8.0.0` 起、含 8.x，拒绝 7.x 与 9+，不承诺未来主版本：`full` 内置 `v8.0.55`，Managed 导入要求原 1.x 托管 CPA 已是 CPA v8，External 要求 CPA v8 并提供 v8 配置文档），再按[更新 CPAMP](../operations/update.md) 运行升级脚本并在浏览器完成升级向导。

完成并激活 v2 后，用原管理员密钥登录 `<origin><已提交控制前缀>`，不要添加 `/ui` 或再次打开安装向导。
:::

## 关键变化

- 镜像名从 `seakee/cpa-manager` 变为 `seakee/cpa-manager-plus`。
- 原生包和二进制从 `cpa-manager` 变为 `cpa-manager-plus`。
- 完整 Docker 方案的登录凭证从 CPA Management Key 变为 Manager Server 管理员密钥 `cpamp_...`。
- CPA Management Key 会使用 `/data/data.key` 加密后保存到 SQLite。
- 旧数据会在首次启动时自动执行必要的兼容迁移。

## 迁移前检查

1. 确认 CPA 本体版本（1.x Stable 历史兼容范围）：1.x Stable 推荐 `v7.1.0+`，HTTP 用量队列至少需要 `v6.10.8+`（若后续还需升级到 v2 Beta，则源或外部 CPA 必须升级到 CPA v8，见上方说明）。
2. 确认旧 Manager Server 数据位置：
   - Docker volume 常见为 `cpa-manager-data`。
   - 宿主机目录挂载通常映射到容器 `/data`。
   - 原生包默认在程序目录下的 `data/usage.sqlite`。
3. 停止旧容器或旧进程，避免 SQLite WAL 文件继续写入。
4. 备份整个旧数据目录。至少保留：
   - `usage.sqlite`
   - `usage.sqlite-wal`
   - `usage.sqlite-shm`
5. 决定管理员密钥策略。推荐迁移时显式设置 `CPA_MANAGER_ADMIN_KEY` 或 `CPA_MANAGER_ADMIN_KEY_FILE`。

## Docker Volume 迁移

旧 compose 常见结构：

```yaml
services:
  cpa-manager:
    image: seakee/cpa-manager:latest
    volumes:
      - cpa-manager-data:/data

volumes:
  cpa-manager-data:
```

仅迁移到 **1.x Stable** 时，Plus 可以直接挂载旧 volume。以下模板中的 `<1.x-Stable-tag>` 必须替换为明确的 1.x 版本标签；不要使用可能转向 v2 的 `latest`：

```yaml
services:
  cpa-manager-plus:
    image: 'seakee/cpa-manager-plus:<1.x-Stable-tag>'
    restart: unless-stopped
    ports:
      - '18317:18317'
    environment:
      HTTP_ADDR: '0.0.0.0:18317'
      USAGE_DB_PATH: '/data/usage.sqlite'
      CPA_MANAGER_DATA_KEY_PATH: '/data/data.key'
      CPA_MANAGER_ADMIN_KEY: 'replace-with-a-long-random-admin-key'
      USAGE_COLLECTOR_MODE: 'auto'
    volumes:
      - cpa-manager-data:/data

volumes:
  cpa-manager-data:
    external: true
```

注意：Plus 示例 compose 默认创建 `cpa-manager-plus-data`。如果直接使用默认新 volume，面板会像新安装一样没有旧数据。

## 宿主机目录迁移

```bash
docker stop cpa-manager
cp -a /srv/cpa-manager-data /srv/cpa-manager-data.backup

docker run -d \
  --name cpa-manager-plus \
  --restart unless-stopped \
  -p 18317:18317 \
  -v /srv/cpa-manager-data:/data \
  -e CPA_MANAGER_ADMIN_KEY='replace-with-a-long-random-admin-key' \
  'seakee/cpa-manager-plus:<1.x-Stable-tag>'
```

启动后打开（1.x Stable）`http://<host>:18317/management.html`，使用管理员密钥登录。

## 原生包迁移

1. 停止旧 `cpa-manager` 进程。
2. 备份旧程序目录，尤其是 `data/usage.sqlite*`。
3. 解压 `cpa-manager-plus_<version>_<os>_<arch>`。
4. 将旧 `data` 目录复制到新包目录，或设置 `USAGE_DATA_DIR` / `USAGE_DB_PATH` 指向旧数据目录。
5. 首次启动时建议设置管理员密钥：

```bash
CPA_MANAGER_ADMIN_KEY='replace-with-a-long-random-admin-key' ./cpa-manager-plus
```

## 首次启动后验证

1. 查看启动日志，确认没有 `decrypt secret`、`open sqlite`、`bootstrap manager server` 错误。
2. 打开面板并进入配置页面。
3. 检查 CPA 地址、请求监控开关、采集模式、轮询间隔。
4. 打开仪表盘或监控页，确认历史数据可见。
5. 请求 `/status`，确认采集器状态、`lastConsumedAt`、`lastInsertedAt` 和 `lastError`。
6. 备份迁移后的 `/data`，此时必须包含新生成的 `data.key`。

## 回滚

回滚前先停止 Plus。旧 CPA-Manager 可继续读取主要用量表和旧 `settings.setup`，但无法识别 Plus 新增的管理员凭证、bootstrap 状态和加密数据密钥。建议优先回滚到迁移前备份。

## 常见问题

- 迁移后没有旧数据：通常是挂载了新的 `cpa-manager-plus-data` 空 volume，而不是旧 `cpa-manager-data`。
- 登录一直 401：Manager Server 接口需要管理员密钥；CPA Management Key 只用于登录 CPA 控制面板。
- 监控为空：确认 CPA 用量发布已开启，采集模式与网络路径匹配，并且同一个 CPA 实例只有一个 Manager Server 消费用量队列。
- 解密失败：确认迁移后没有丢失或替换 `/data/data.key`。
