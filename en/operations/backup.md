# Backup and restore

CPAMP keeps request history, configuration, and encrypted credentials on the host. The common mistake is backing up only `usage.sqlite` and missing WAL/SHM files, `data.key`, or secret files in the install directory.

## Persistent layout and required backup set

v2 Beta upgrades offline from **`v1.14.10`** and supports **CPA v8** only (rejecting releases below v8 without promising future major versions: Embedded pins **`v8.0.55`**, External requires CPA v8 at **`v8.0.55`** or newer within v8 plus actual qualification, and Managed upgrade sources must also already run CPA v8 before `cpa-import`). A backup does not authorize migration: follow [Upgrade Preflight and Reconciliation](./update.md). The v2 single image persists all state inside one named volume `cpamp-data` (mounted at `/data`), which must be backed up as a complete set:

`cpamp-data` is a Compose logical volume key, not a fixed Docker volume name. Without an explicit name override, Docker uses `<project>_cpamp-data`. The commands below reuse the same Compose project to avoid creating an empty volume with plain `docker run -v cpamp-data:/data`; inspect the running container's actual `.Mounts` with `docker inspect` before mounting a volume directly.

- **Manager state (`10002:10002`)**: `/data/usage.sqlite`, `/data/usage.sqlite-wal`, `/data/usage.sqlite-shm`, `/data/usage.sqlite-journal` when present, `/data/usage.sqlite.manager.lock`, `/data/data.key` (`0600`), `/data/usage-archives/` when present (including raw request archives and manifests; SQLite alone is insufficient), automatic slot/schema snapshot directories under `/data/backups/` when present, and `/data/upgrade-backup/` when upgraded from 1.x.
- **Embedded Runtime and control-plane slot state (`/data/runtime`, root `0:0`)**: `/data/runtime/.cpamp-v8-bootstrap` (`0:0`), `/data/runtime/cpamp/` when present (`0:0`, holding Ed25519-verified control-plane `slots/<ver>/` and `slot-state.json`), `/data/runtime/supervisor/` (`0:10001`, including `operations.sqlite`, WAL/SHM, Managed `destination/`, verified CPA artifacts under `artifacts/cpa/`, and `active/cpa/selection-provenance.json`), and `/data/runtime/gateway/` (`10001:10001`, including `config.yaml`, singular `auth/`, `logs/`, and `plugins/` when present). Copying CPA `config.yaml` alone is insufficient.
- **Runtime transport secret (`0:10002`)**: `/data/runtime-secret/token` (`0640`).
- **Deployment configuration**: the digest-pinned `docker-compose.yml` (`seakee/cpa-manager-plus:<tag>@sha256:<digest>`), `CPAMP_PUBLIC_ORIGIN`, custom environment settings, and reverse-proxy configuration. Encrypt backup archives and restrict access.

## Why data.key is required

CPA Management Keys stored by Manager are encrypted with `data.key` before being written to SQLite:

- If only `usage.sqlite` leaks, the plaintext CPA Management Key cannot be read directly.
- If both `usage.sqlite` and `data.key` leak, the stored key can be decrypted, so treat backup archives as secrets.
- If `data.key` is lost, the encrypted CPA connection key cannot be recovered, and resetting the CPAMP Admin Key cannot repair a missing `data.key`.

## Full offline Docker backup

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

## Restore into a new volume proven empty

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

## Scope of offline Manager snapshots (`manager-data-snapshot`)

With the service stopped, `manager-data-snapshot` snapshots the database, WAL/SHM, rollback journal, and `data.key`, with an integrity manifest. It **does not include `usage.sqlite.manager.lock`, `usage-archives/`, custom configuration, `/data/runtime`, `/data/runtime-secret`, or external CPA**, so it does not replace a full backup. Fresh's non-empty `usage.sqlite.manager.lock` holds an admission receipt bound to the database identity; never remove it, empty it, or substitute a different installation's file. Restoring only a Manager snapshot into a new directory cannot restore a Fresh instance. For whole-instance recovery, use the same full-volume archive described above to restore that receipt, archive shards, and Runtime state together. The following commands are only offline database snapshots while retaining the original instance's other state. Run from the v2 native package root (the snapshot directory must not already exist):

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

## Automatic pre-upgrade snapshots and manual post-commit restore (`restore-pre-migrate`)

Before activating a signed control-plane slot or running a cross-generation SQLite schema migration, Manager automatically writes a manifest-verified snapshot directory under `<dataDir>/backups/` (`pre-slot-*` via online `VACUUM INTO` before slot activation, and `pre-migrate-gen*` before schema-generation boundaries), capturing `usage.sqlite`, WAL/SHM/journal, `data.key`, and `snapshot-manifest.json`.

Run `restore-pre-migrate` (which requires an explicit `--confirm` flag) only when a slot enters the `recovery_required` lockout state or when an administrator deliberately chooses to **discard business writes recorded after the upgrade committed** and revert the database after stopping the entire stack:

```bash
docker compose stop
docker compose run --rm --no-deps -u 10002:10002 --entrypoint cpa-manager-plus \
  cpa-manager-plus restore-pre-migrate --latest --db-path /data/usage.sqlite \
  --data-key-path /data/data.key --confirm
```

For the Linux `amd64` native package, stop the `systemd` service first (replace `--latest` with `--snapshot-dir <absolute-path>` to target a specific snapshot directory):

```bash
sudo systemctl stop cpa-manager-plus.service
sudo ./bin/cpa-manager-plus restore-pre-migrate --latest \
  --db-path "$PWD/data/usage.sqlite" --data-key-path "$PWD/data/data.key" --confirm
```

If the reverted upgrade had crossed a SQLite `schema_generation` boundary, switch the container image or native installation back to the matching earlier release before starting the service again; otherwise starting the newer binary will re-apply forward migrations. Like `manager-data-snapshot`, this command covers SQLite and `data.key` only and does not replace a full offline volume backup.

## 1.X (before upgrading)

Before running an offline upgrade from `v1.14.10` to v2, stop the 1.x service and back up the full 1.x data volume/directory (`usage.sqlite`, WAL/SHM, `data.key`, `usage-archives/` when present, configuration, and `secrets/`). For ongoing 1.x Stable backup, restore, and offline `store-cpa-connection` procedures, see the 1.x Stable documentation at [Backup and Restore (1.x Stable)](https://cpamp-docs.seakee.dev/en/operations/backup.html).
