# Backup And Restore

CPAMP keeps request history, configuration, and encrypted credentials on the host. The common mistake is backing up only `usage.sqlite` and missing WAL/SHM files, `data.key`, or secret files in the install directory.

## Required Backup Files

Back up these files as a set:

- `usage.sqlite`
- `usage.sqlite-wal`
- `usage.sqlite-shm`
- `data.key`
- `usage-archives/` when present, including raw request archives and manifests; SQLite alone is insufficient
- `usage.sqlite-journal` when present

If your deployment directory contains custom configuration files, back them up too. With the one-click installer, also back up `secrets/` and `data/` under the install directory; after a successful import, `secrets/cpa-management-key` is normally gone, but it may remain after a failed upgrade or with `CPAMP_SKIP_EXECUTE=1` for retry. Manual env/secret deployments should back up their matching secret files.

## Why data.key Is Required

CPA connections saved through setup or the panel encrypt the CPA Management Key with `data.key` before saving it to SQLite.

- If only `usage.sqlite` leaks, an attacker cannot directly read the CPA Management Key.
- If both `usage.sqlite` and `data.key` leak, the CPA Management Key can be decrypted.
- If `data.key` is lost, the saved CPA Management Key cannot be recovered. You must save the CPA connection configuration again.

If a CPA connection is managed by manual environment variables or secret files, the CPA Management Key may not be written to SQLite. Back up the related secret files together with the data directory. The installer's env input is migrated into SQLite after success, so do not rely on the one-time input file alone.

## v2 Beta: Embedded Stack Backup And Restore

v2 Beta's offline upgrade source is **`v1.14.10`** and target CPA requires at least **`v8.0.55`**. A backup does not authorize migration: follow [Upgrade Preflight And Reconciliation](./update.md). The v2 single image persists all state inside one named volume `cpamp-data` (mounted at `/data`):

- **Manager state (`10002:10002`)**: `/data/usage.sqlite`, WAL/SHM/journal when present, `/data/usage.sqlite.manager.lock`, `/data/data.key` (`0600`), `/data/usage-archives/` when present, and `/data/upgrade-backup/` when upgraded from 1.x. Resetting Admin cannot repair a missing `data.key`.
- **Embedded Runtime state (`/data/runtime`, root `0:0`)**: `/data/runtime/.cpamp-v8-bootstrap` (`0:0`), `/data/runtime/supervisor/` (`0:10001`, including `operations.sqlite`, WAL/SHM, and on `slim` the verified CPA engine under `artifacts/cpa/` plus active state), and `/data/runtime/gateway/` (`10001:10001`, including `config.yaml`, singular `auth/`, `logs/`, and `plugins/` when present). Copying CPA `config.yaml` alone is insufficient.
- **Runtime transport secret (`0:10002`)**: `/data/runtime-secret/token` (`0640`). Retain the matching digest-pinned `docker-compose.yml` (`seakee/cpa-manager-plus:<tag>@sha256:<digest>`), `CPAMP_PUBLIC_ORIGIN`, and environment configuration. Encrypt backups and restrict access.

From the `docker-compose.yml` directory and the same project, run the following complete subshell block as one operation. `docker compose stop` drains and stops all in-container processes within `stop_grace_period: 150s` (at least `CPAMP_DRAIN_TIMEOUT` + `60s`); `mktemp -d` creates a private unique directory, container-side `-u 0:0` with `--numeric-owner` preserves all numeric UIDs/GIDs and permissions inside `/data`, `set -C` refuses existing archive destinations, and `set -eu` stops on any failure without restarting services. Record the printed backup path:

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

The final `up -d` runs only after the archive write, gzip integrity check, and tar directory read all succeed. On any failure, retain the directory/error, leave services stopped, resolve the cause, and use a fresh backup directory rather than overwriting a partial archive. The commands reuse the Digest-pinned single image; no other process may write the original volume while offline.

### Restore Into A New Volume Proven Empty

Prepare the backup's `docker-compose.yml` (retaining the same digest-pinned image) and restore the saved public origin/environment without changing the original volume. Replace `BACKUP_DIR` below with the actual absolute directory of a successful backup. Other `RESTORE_*` variables are local shell/Compose override values, not new CPAMP settings. The script first generates and validates a legal restore project name, the merged Compose configuration, and the new volume name. Only after those checks pass does it stop the original project, create one new `cpamp-data` volume, bind it explicitly through the override, verify `/data` is empty, and extract with numeric ownership preserved. Do not delete the original project's volume to make it empty.

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

The restore project starts only after the empty-volume check, archive validation, and extraction succeed. On failure, do not start it; retain the original volume and restore records, then retry with another new empty volume. Keep the printed restore project name and `volumes.yml`, always using the same `-p` and both `-f` arguments to manage this instance. Original-project commands address the original volume, not the restored one. Both projects cannot publish the same host port simultaneously.

Preserve archived numeric owners, permissions, and directory isolation (`/data/runtime` root `0:0`, Manager files `10002:10002`, Gateway `10001:10001`); never run `chown -R` across `/data` to a single UID. Verify Admin login, CPA connection, Client Key, history/coverage, and Gateway; `/health` alone is insufficient. A 1.x rollback uses the original pre-migration 1.x volume, never v2 archives or restored volumes.

### Scope Of Offline Manager Snapshots

With the service stopped, `manager-data-snapshot` snapshots the database, WAL/SHM, rollback journal, and `data.key`, with an integrity manifest. It **does not include `usage-archives/`, custom configuration, `/data/runtime`, `/data/runtime-secret`, or external CPA**, so it does not replace a full backup. From the v2 native package root (the snapshot directory must not already exist):

```bash
sudo ./bin/cpa-manager-plus manager-data-snapshot create \
  --db-path "$PWD/data/usage.sqlite" --data-key-path "$PWD/data/data.key" \
  --snapshot-dir "$PWD/backup/manager-snapshot"
```

Only when restoring:

```bash
sudo ./bin/cpa-manager-plus manager-data-snapshot restore \
  --db-path "$PWD/data/usage.sqlite" --data-key-path "$PWD/data/data.key" \
  --snapshot-dir "$PWD/backup/manager-snapshot"
```

A held lock refuses the command: stop the actual service first. After `docker compose stop`, Docker can run `docker compose run --rm --no-deps -u 10002:10002 -v "$SNAPSHOT_PARENT":/snapshots --entrypoint cpa-manager-plus cpa-manager-plus manager-data-snapshot ...` (with a host directory writable by UID `10002`), naming `/data/usage.sqlite`, `/data/data.key`, and a non-existent snapshot subdirectory. A full Native backup/restore also includes the same backup's `data/runtime/` and secrets in `run/`, preserving ownership/permissions.

For External, the operator separately backs up/restores CPA configuration, OAuth credentials, and process state. Manager snapshots do not back up the remote host. Configuration-only export is not a complete v2 upgrade path.

## 1.x Stable: Backup Examples


## Docker Backup Example

If you use a named volume, stop the container first, then export through a temporary container:

```bash
docker stop cpa-manager-plus
docker run --rm \
  -v cpa-manager-plus-data:/data:ro \
  -v "$PWD":/backup \
  alpine \
  tar czf /backup/cpa-manager-plus-data.tgz -C /data .
docker start cpa-manager-plus
```

If you use a host directory mount:

```bash
docker stop cpa-manager-plus
cp -a /srv/cpa-manager-plus-data /srv/cpa-manager-plus-data.backup
docker start cpa-manager-plus
```

## Native Package Backup

Stop the process, then copy the data directory:

```bash
cp -a ./data ./data.backup
```

Windows PowerShell:

```powershell
Copy-Item -Recurse .\data .\data.backup
```

## Restore

1. Stop CPAMP.
2. Restore the full data directory.
3. Confirm that `usage.sqlite` and `data.key` come from the same backup.
4. If the CPA connection is env/secret-managed, also restore `secrets/` from the install directory.
5. Start CPAMP.
6. Log in and check configuration, monitoring data, and collector status.

If restore produces decryption errors, first check whether `data.key` matches the SQLite database.

## Move Manager Configuration Without Request History

If the old `usage.sqlite` is large and request history is no longer needed, start the replacement instance with an empty data directory and use the existing Manager configuration API to move the non-sensitive CPA URL, collector, Codex inspection, and External Usage Service settings. This does not copy `usage_events`, rollups, inspection run history, model prices, API Key aliases, or account-processing policy, and it does not export the CPA Management Key.

Export while the old instance is still reachable:

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

The new `manager-config.json` does not contain the CPA Management Key; still treat the configuration file as sensitive and do not commit or attach it to an issue. An export from an older version may contain the plaintext key, so handle it as a secret and delete it after migration.

Stop the old instance and prepare an empty data directory for the replacement. While Manager Server is not running, provide the CPA Management Key with the offline command:

```bash
cpa-manager-plus store-cpa-connection \
  --cpa-base-url 'http://cpa:8317' \
  --management-key-file '/secure/cpa-management-key' \
  --db-path './data/usage.sqlite' \
  --data-key-path './data/data.key'
```

Stop Manager Server before running this command. It encrypts the key into SQLite and never echoes it.

Connection records follow these authority rules: a complete `manager_config_v1` is authoritative; if it coexists with stale or conflicting legacy `setup` data, startup and import keep the manager connection and canonicalize setup without repair. If manager data is partial and legacy setup is complete and compatible with its existing fields, setup completes manager. The command above refuses the write and explains the repair path only when no complete authority exists and partial records conflict, or when the persisted state cannot be resolved. After confirming this explicit connection is correct, append `--repair-conflict` to repair explicitly:

```bash
cpa-manager-plus store-cpa-connection \
  --repair-conflict \
  --cpa-base-url 'http://cpa:8317' \
  --management-key-file '/secure/cpa-management-key' \
  --db-path './data/usage.sqlite' \
  --data-key-path './data/data.key'
```

`--repair-conflict` exists only for persisted state the resolver cannot trust: `manager_config_v1`/`setup` rows that conflict with each other, or authority-less partial rows that conflict with the request. It writes the connection you explicitly provide into both `manager_config_v1` and the legacy `setup` mirror in a single transaction (the key stays encrypted at rest) while preserving collector settings and other data. A complete and consistent stored connection still requires exactly matching input; repair never rebinds silently. After repairing, start normally and the connection-storage migration completes as usual. Start the new instance, then import the remaining configuration:

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

The import validates the CPA Management API. After it succeeds, verify collector status and the related settings, then securely delete the exported file and temporary key file.

If the old connection is managed through environment variables or secret files, the API reports `source` as `env` and an API import cannot override the connection fields. Use the offline command above to write the CPA connection into the new SQLite database, or enter it again during setup. Administrator credentials are also outside the Manager configuration export; the new instance uses its newly generated or explicitly configured `CPA_MANAGER_ADMIN_KEY`.
