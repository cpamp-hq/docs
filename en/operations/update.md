# Upgrade CPA Manager Plus

## v2 Beta: Upgrade From 1.x, Not An In-Place Image Change

::: warning Exact baseline and stop conditions
The minimum direct upgrade version is **`v1.14.10`**; the current CLI accepts only that exact declaration, not every later 1.x release automatically. For `<= v1.14.9`, first upgrade using the original deployment method to `v1.14.10`, verify it, then stop it. Merely changing `--source-version` is not an upgrade. Target CPA requires at least **`v8.0.55`** (Embedded pins that version). Version differences, unknown/newer schemas, a busy source, evidence mismatches, or history differences require operator action; never edit SQLite markers to proceed.
:::

1. Prepare `docker-compose.yml` in a dedicated directory following [v2 Docker Installation](../deployment/docker.md): use the single service `cpa-manager-plus`, the single volume `cpamp-data:/data` (keeping `stop_grace_period: 150s`, at least `CPAMP_DRAIN_TIMEOUT` + `60s`), and pin `seakee/cpa-manager-plus` to an exact Beta tag + digest (`slim` such as `2.0.0-beta.1@sha256:<digest>`, or `full` such as `2.0.0-beta.1-full@sha256:<digest>` for offline/bundled CPA; `:latest`, `:preview`, `:1`, and `:1.14` stay on 1.x Stable during Beta, and v2 image tags have no `v` prefix). Verify the matching prerelease notes and `checksums.txt`; `releases/latest` and the installer remain 1.x Stable.
2. Save the exact 1.x image/binary, Compose, environment, and volume mapping. Stop the old Manager; also stop the old CPA when migrating a managed CPA. Back up `usage.sqlite`, WAL/SHM, `data.key`, `usage-archives/` when present, configuration, and secrets; see [Backup](./backup.md). Prevent all other source writers.
3. Give v2 a **separate new `/data` volume** (`cpamp-data`). Keep the original 1.x volume unchanged and mounted read-only at `/legacy:ro` only during upgrade/rollback steps. Source roots must not overlap target/backup roots; scratch snapshots must be outside source and target. Follow the preflight disk-space report.

Image tags are examples for versions actually published; current v2 release producers are rehearsal-only, so single-image build support does not establish an available Release, tag, or multi-architecture publication. See [Release Assets And Gates](../reference/releases.md). `cpamp-data` is a Compose logical key; the actual Docker volume is normally `<project>_cpamp-data`. Reuse the same project's `docker compose run/exec` rather than substituting `docker run` with bare `cpamp-data`.

### Docker: Offline Preflight, Copy-In, And Four-Domain Reconciliation

Run from the v2 `docker-compose.yml` directory. `LEGACY_MOUNT` is the **actual old volume name** (check `docker inspect`), not a new empty volume. For a bind-mounted source, set both `LEGACY_MOUNT` and `LEGACY_ROOT` to the same actual absolute host path so the container and rollback plan agree. Replace the example volume name. One-shot CLI runs invoke `--entrypoint cpa-manager-plus` directly (defaulting to `0:0` so they can read the `0:0`-owned read-only 1.x `/legacy` mount without modifying it), and `fix_manager_ownership` transfers only Manager-owned files under `/data` to `10002:10002` before service startup (never touching `/data/runtime`):

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

Require exit `0` and `ready: true`, then execute these separately:

```bash
upgrade_cli run --legacy "$LEGACY_ROOT" \
  --source-version v1.14.10 --target /data --json
upgrade_cli reconcile --legacy "$LEGACY_ROOT" \
  --source-version v1.14.10 --target /data --json
```

Continue only after each step succeeds. `run` performs backup/copy-in, not the complete upgrade; its default backup is the target's `upgrade-backup/`. `reconcile` compares **`retained`, `pricing`, `coverage`, and `history`**; inapplicable domains must state why. Review permanently incomplete UTC days individually before repeating the same `reconcile` command with `--acknowledge YYYY-MM-DD` for each day. `--acknowledge-parity-gaps` accepts only reported parity days already lost by old versions, not other measured mismatches. Do not add acknowledgements blindly or interpret them as restoring lost history.

### Finish CPA Connection And Final Verification

**External path**: the CPA operator independently upgrades/configures CPA to at least `v8.0.55` and makes it reachable from the CLI container. Put the real Management Key in a private host file `upgrade-secrets/cpa-management-key`, not a command argument. Replace the example URL; if the external CPA URL or Management Key changed compared with the 1.x source, also run `store-cpa-connection` once before `verify`:

```bash
upgrade_cli external-connect --target /data \
  --cpa-base-url 'http://your-cpa-host:8317' \
  --management-key-file /upgrade-secrets/cpa-management-key --json
# Run only if the external CPA URL or Management Key differs from what 1.x stored:
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

Run the final `fix_manager_ownership` and `docker compose up -d` only after connection, identity, model surface, and reconciliation pass and the persisted stage is `complete`. If the version header is absent, `external-connect --cpa-version` only declares the actual CPA version; it does not turn v7 into v8. After rotating the key, use `--reprove` at the same URL to prove it again rather than repeatedly presenting rejected credentials.

**Managed path**: import the old CPA configuration/credentials and prove the destination against the in-container Runtime Supervisor (`127.0.0.1:9081`); do not use `external-connect` against an internal address instead. In the single image, an unfinished Upgrade record keeps `cpa-manager-plus` on the read-only Upgrade surface with the SQLite write lock released while `cpamp-launcher` runs Runtime Supervisor and Ingress (isolate public client traffic at the host firewall or reverse proxy until acceptance). Run `fix_manager_ownership` first, then start the service with a temporary Compose override mounting the 1.x Manager source, old CPA directory, and real CPA auth directory read-only (paths/source version must come from the old deployment, and plugin choice must be explicit):

```text
fix_manager_ownership
cat > docker-compose.upgrade.yml <<'YAML'
services:
  cpa-manager-plus:
    volumes:
      - <old-Manager-mount-source>:<original-LEGACY_ROOT>:ro
      - <old-CPA-absolute-directory>:/legacy-cpa:ro
      - <old-CPA-auth-absolute-directory>:/legacy-cpa-auth:ro
YAML
docker compose -f docker-compose.yml -f docker-compose.upgrade.yml up -d
```

When using the **`slim`** image, first open the public entry in a browser, sign in to the read-only Upgrade wizard with the original 1.x Admin Key, and download from CDN / GitHub Release or upload the matching official `cli-proxy-api` `linux_<arch>.tar.gz` so Runtime Supervisor prepares the pinned CPA engine (**`full`** already bundles CPA and skips this step). Then run `cpa-import`, `verify`, and `status` inside that running container:

```text
docker compose -f docker-compose.yml -f docker-compose.upgrade.yml exec -T -u 0:0 \
  -e CPAMP_RUNTIME_URL=http://127.0.0.1:9081 \
  -e CPAMP_RUNTIME_TOKEN_FILE=/data/runtime-secret/token \
  cpa-manager-plus cpa-manager-plus upgrade cpa-import \
  --legacy <original-LEGACY_ROOT> --target /data \
  --cpa-dir /legacy-cpa --cpa-auth-dir /legacy-cpa-auth \
  --cpa-version <actual-source-CPA-version> --plugins false --json
docker compose -f docker-compose.yml -f docker-compose.upgrade.yml exec -T -u 0:0 \
  -e CPAMP_RUNTIME_URL=http://127.0.0.1:9081 \
  -e CPAMP_RUNTIME_TOKEN_FILE=/data/runtime-secret/token \
  cpa-manager-plus cpa-manager-plus upgrade verify \
  --legacy <original-LEGACY_ROOT> --target /data --json
docker compose -f docker-compose.yml -f docker-compose.upgrade.yml exec -T -u 0:0 \
  cpa-manager-plus cpa-manager-plus upgrade status \
  --db-path /data/usage.sqlite --json
```

Replace every angle-bracket parameter before running. `--plugins false` explicitly disables plugins in this example; choose according to your intent. Stop on qualification or destination-proof refusals, retain the report, and do not manually copy credentials into `/data/runtime`. `upgrade verify` requires Runtime Supervisor and the destination CPA inside that container to remain running and Ready.

Upgrade CLI uses `0:0` here to read the original root-private 1.x source and CPA credentials; a read-only mount does not make them readable by UID `10002`. Do not start the long-lived Manager as root. CLI writes may create root-owned Manager WAL/lock files, so the stopped-service ownership correction below is required. Do not change the old source's permissions to accommodate the target.

Only after `upgrade status` confirms the persisted stage is `complete`, stop the temporary upgrade override, reapply Manager file ownership, and start the normal `docker-compose.yml` stack before restoring public traffic:

```bash
docker compose -f docker-compose.yml -f docker-compose.upgrade.yml stop
rm -f docker-compose.upgrade.yml
fix_manager_ownership
docker compose up -d
```

Retain original 1.x data and upgrade backups until full acceptance. After completion and restart, open `http://<host>:18317/management.html` (or `/`) and sign in with the original 1.x Admin Key; this upgrade path does not automatically establish Fresh's `/console`. Check public origin, Client Key, history/coverage, account state, and real model requests; `/health` cannot replace these checks.

### Exact Rollback To Original 1.x Data

Rollback never mounts v2 SQLite into the old image. Stop the **whole v2 service**, retain v2 data for diagnosis, and prepare under the same Compose project and identical read-only source mount:

```bash
docker compose stop
upgrade_cli rollback --prepare --legacy "$LEGACY_ROOT" --target /data \
  --volume "$LEGACY_MOUNT" --legacy-image seakee/cpa-manager-plus:v1.14.10
```

`--prepare` prints/saves a plan; it never controls Docker. Check every emitted precondition on the **Docker host**: the old volume/path is the copy-in source, v2 is stopped, and the rollback port is free. Default 1.x rollback port is **18318**, distinct from v2 public port 18317; checks inside a container cannot prove host port availability. Apply the printed Compose and invocation on the host, or restore the original 1.x Compose against the **original unchanged 1.x volume**, using the plan's exact image and port, and restore the original CPA configuration. Never use a floating tag or the v2 data copy.

After 1.x starts, **complete the Docker-host container-identity and mount inspection gate before running `rollback --verify`**. The CLI has no Docker socket and cannot prove that the container answering health checks uses the original volume. Locate the unique container on the plan's actual rollback port, then set `ROLLBACK_CONTAINER_ID` to its real full ID:

```bash
docker ps --no-trunc --filter publish=18318 --format '{{.ID}} {{.Image}} {{.Names}}'
export ROLLBACK_CONTAINER_ID='actual-full-container-id'
docker inspect --format '{{.Id}} {{.Config.Image}} {{.Image}}' "$ROLLBACK_CONTAINER_ID"
docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Type}} {{.Name}} {{.Source}} -> {{.Destination}}{{println}}{{end}}{{end}}' "$ROLLBACK_CONTAINER_ID"
```

Confirm the container ID belongs to the old Manager just restarted. `.Config.Image` must equal the plan's exact image reference; `.Image` is its actual image ID. For a named volume, `/data`'s `.Name` must equal the original `LEGACY_MOUNT`; run `docker volume inspect "$LEGACY_MOUNT"` and compare its returned `Mountpoint` with that container's `/data` `.Source`. For a bind mount, `.Source` must equal the original absolute host path. Where container-side paths differ, manually establish that this is the same source mounted read-only during copy-in. Stop on any mismatch or unproven correspondence; retain the inspection record with the plan.

Only after that gate, run `--verify` with the plan's backup and port. Inside the one-shot CLI container above, the Docker host is not `127.0.0.1`; for the default port:

```bash
upgrade_cli rollback --verify --legacy "$LEGACY_ROOT" --target /data \
  --legacy-image seakee/cpa-manager-plus:v1.14.10 \
  --status-url http://host.docker.internal:18318/health
upgrade_cli status --db-path /data/usage.sqlite --json
```

For custom backup/port settings, retain the emitted `--backup` and use the actual port. `rolled_back` records only the CLI's successful health-identity, source-directory, backup-integrity, and retained-data checks; **it contains neither automatic Docker container/mount proof nor a manual-confirmation field**. Consider rollback complete only together with the operator's saved container/mount inspection record above. An ordinary HTTP request exiting `0` is insufficient too. If refused, do not recreate the source volume or delete upgrade records to proceed.

### Native And Common Diagnostics

linux/amd64 Native uses the matching package's `bin/cpa-manager-plus upgrade ...`, but **not every step runs with the whole stack stopped**:

1. Stop the old 1.x Manager / CPA being imported and the target Native launcher/systemd stack. Use the original absolute 1.x data directory for `--legacy` and the new package's absolute `data/` as target. Run offline `preflight --target-dir ...` → `run --target ...` → `reconcile --target ...`. `--target-dir` belongs only to `preflight`. Custom backup directories use `--bundle` with `run/reconcile` and the same path through `--backup` with `rollback --prepare/--verify`.
2. External uses a private host credential file for `external-connect`, synchronizes `store-cpa-connection` if needed, then runs offline `verify`. For Managed, start the configured Native launcher/systemd service after reconciliation and keep public client traffic isolated. The unfinished Upgrade keeps Manager read-only with its lock released; Runtime Supervisor must remain running. Use the same `cpa-import` flags above with absolute host source/target/credential paths, supplying the actual `CPAMP_RUNTIME_URL` and `CPAMP_RUNTIME_TOKEN_FILE` to both import and subsequent `verify`. Import also needs `CPA_UPSTREAM_URL` or `--destination-url`. Defaults are `http://127.0.0.1:18318`, `<package-root>/run/runtime-token`, and `http://127.0.0.1:8317`, not Docker's `9081` and `/data/runtime-secret/token`. Run as the same root identity as Native Manager (for example `sudo env CPAMP_RUNTIME_URL=... CPAMP_RUNTIME_TOKEN_FILE=... CPA_UPSTREAM_URL=... ./bin/cpa-manager-plus upgrade cpa-import ...`).
3. Run `verify` while Supervisor and Managed CPA are running and Ready. Only after `status --db-path <new-data-directory>/usage.sqlite --json` confirms `complete`, restart Native, restore traffic, and check the upgrade entry described above.
4. Stop the entire target stack (including public Ingress) before Native rollback. `rollback --prepare` generates a **Docker Compose plan, not a systemd plan**; do not apply it directly to Native services. Bind `--volume` to the original absolute source directory and pass the actual `--manager-addr` (default `127.0.0.1:18319`) when preparing the plan. Independently restore the exact original 1.x binary/service and data, check the actual binary/data path and the plan's separate port, then run host-side `rollback --verify --legacy ... --target ... --backup ... --status-url http://127.0.0.1:18318/health --manager-addr 127.0.0.1:18319` as specified by the plan (substituting actual addresses). CLI health-identity and data checks do not replace inspection of the Native binary/service identity. Do not use container-only `host.docker.internal`.

| Report/exit code | Action |
| --- | --- |
| `0` | Current step succeeded; inspect its stage, not every step is complete |
| `1` | Blocked/refused/acknowledgement required: read the report and stop automation |
| `2` | Usage, environment, or retryable error: resolve the cause before retry |
| `upgrade_source_version_unsupported` / `upgrade_source_version_undeclared` | Check the actual release and exact `v1.14.10` declaration |
| `upgrade_source_busy` / `upgrade_store_locked` | Stop the actual source/target Manager; do not remove lock files to proceed |
| `upgrade_source_changed` | Source is changing: stop all writers and reassess source/backup |
| `upgrade_rollback_image_unpinned` / `upgrade_rollback_volume_unbound` | Provide the exact old image and original volume mapping, not a new empty volume |
| `source_ownership_unavailable` (`/.well-known/cpamp-bootstrap`) | A 1.x data volume was mounted at `/data` (lock/key files are `0:0` while v2 Manager runs as `10002:10002`): stop the container and remount with a fresh `/data` plus read-only `/legacy:ro`; for read-only Upgrade entry inspection only, `chown 10002:10002` on `usage.sqlite*` and `data.key` only — never `chown -R /data` (`/data/runtime` must remain `0:0`) |

### If A 1.x Volume Was Mounted At `/data`

1.x containers write `/data/usage.sqlite.manager.lock` and `/data/data.key` (`0600`) as `root` (`0:0`), whereas the v2 single-image Manager runs as unprivileged `10002:10002` and Runtime Supervisor requires `/data/runtime` to stay owned by `0:0`. If a 1.x volume is mounted at `/data`, v2 stays in read-only guidance mode (`/.well-known/cpamp-bootstrap/ui`) with `source_ownership_unavailable` and did not modify the 1.x database and key files:

1. **Recommended (standard upgrade)**: stop the container, mount the original 1.x volume read-only at `/legacy:ro`, attach a new empty volume to `/data`, and run `upgrade preflight` and `upgrade run` above.
2. **Read-only Upgrade entry inspection only**: a Docker named volume has no `/data` path on the host, so do not run `chown /data/...` from the host. Stop the v2 container that is running with this volume, run one one-off container that mounts the volume and changes ownership only on the database and key files, then start the v2 container again and re-check on the guidance page:

   ```bash
   docker stop <v2_container>
   docker run --rm -u 0:0 --entrypoint sh -v <1x_volume>:/data seakee/cpa-manager-plus:<v2_tag> \
     -c 'chown -h 10002:10002 /data/usage.sqlite* /data/data.key'
   docker start <v2_container>
   ```

   Only `usage.sqlite*` and `data.key` change owner; ownership is file metadata, not the database content. Never run `chown -R 10002:10002 /data`, which invalidates the `0:0` owner requirement on `/data/runtime`.

## Offline Derived Index And Data Maintenance (`cleanup-derived`)

To keep startup bounded on large stores, missing large-table query indexes and legacy-derived cleanup jobs are deferred rather than blocking HTTP startup indefinitely. When the console displays the database maintenance banner (`databaseMaintenance.required = true`), stop the v2 service and run `cleanup-derived` as the Manager identity (`10002:10002`); it never deletes or rewrites authoritative `usage_events`:

```bash
docker compose stop
docker compose run --rm --no-deps -u 10002:10002 --entrypoint cpa-manager-plus \
  cpa-manager-plus cleanup-derived --db-path /data/usage.sqlite
docker compose up -d
```

For the `linux/amd64` Native package, stop the complete launcher / `systemd` service first, then run:

```bash
sudo ./bin/cpa-manager-plus cleanup-derived --db-path "$PWD/data/usage.sqlite"
```

## 1.x (Before Upgrading)

Deployments on `<= v1.14.9` must first update within their original 1.x setup to the exact **`v1.14.10`** baseline and verify health before starting the v2 offline copy-in on this page. For 1.x-to-1.x update procedures, see the 1.x Stable documentation at [Upgrade CPA Manager Plus (1.x Stable)](https://cpamp-docs.seakee.dev/en/operations/update.html).
