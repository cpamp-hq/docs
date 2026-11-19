# Upgrade CPA Manager Plus

## v2 Beta: upgrade from 1.x, not an in-place image change

::: warning Supported sources, stop conditions, and verification scope
- **Supported sources are proven v1.14.x installations**: the preflight admits a source only after checking both the physical schema and the semantic profile of the 1.x data (history, pricing, coverage, identity, and related domains). It does not require the exact `v1.14.10` patch, and it does not make every 1.x release eligible. Older 1.x installations must first be upgraded inside their original deployment to a supported v1.14.x release and verified. An unknown source patch stays unknown; `--source-version` is only a truthful declaration and never turns an incompatible format into a compatible one.
- **CPA support is the v8 major only** (`8.0.0` and later 8.x; 7.x and 9+ are refused, and future major versions are not promised). A `full` image bundles the official pinned `v8.0.55`; Managed import requires the original 1.x managed CPA to already be CPA v8 (below v8, upgrade it inside the 1.x stack and verify before stopping); External requires a CPA that is already v8 and serves a v8 configuration document.
- **Structurally unsupported or unsafe-to-classify sources, configuration, and encrypted paths are refused before any stop**: for example an old Manager using external `CPA_MANAGER_CONFIG`, an external data-key secret or a `config.json` mount, data paths that cannot be classified safely, nested source mounts, multiple different published ports, or `host`/`none` networking; a refusal does not stop the old service. The source data's own schema/profile is judged by the offline preflight after the stop; an incompatible source is never written into the target, the original data is unchanged, and recovery or an explicit rollback uses the same `--state-dir` after correction.
- The Docker flow on this page was exercised in a synthetic v1.14.x rehearsal through preflight, backup, copy-in, reconciliation, browser Managed import, verification, and activation. That is **development verification**, not release certification, and it does not promise support for every deployment shape.
:::

Default Docker upgrades no longer require assembling one-shot CLI commands by hand. Run `bin/upgrade-cpamp-v2.sh` from the same v2 source version: it discovers the source, takes the backup, copies in, reconciles, and creates the separate target, then the browser completes the CPA and access-route decisions. The old multi-command `run`/`cpa-import`/`verify`/ownership-correction loop remains only as the advanced CLI path (see Native and the CLI engine below), not the normal Docker flow. For `full`/`slim` image capabilities, see [v2 Docker Installation](../deployment/docker.md).

### Step 1: prepare the script, image, and an isolated state directory

1. **Pin an exact v2 image**: `--image` must be a full reference to an actual v2 release, for example the slim `seakee/cpa-manager-plus:2.0.0-beta.1`, the full `seakee/cpa-manager-plus:2.0.0-beta.1-full`, or a full reference with `@sha256:<digest>`. Mutable tags such as `latest`, `slim`, and `full` are refused; the script also checks the image's OCI version and 40-character revision, so a locally built image without those labels cannot be the target. Whether that version is published is covered by [Release Assets and Gates](../reference/releases.md).
2. **Obtain and review the script**: the script lives in the same v2 source version at `bin/upgrade-cpamp-v2.sh`. It is not a separate release asset, and this page provides no download URL. Extract the file from the v2 tag/commit you selected (for example `git show <tag>:bin/upgrade-cpamp-v2.sh > upgrade-cpamp-v2.sh`), save it on the Docker host, review it, and then run the saved local file.
3. **Choose an isolated state directory**: `--state-dir` holds the operation manifest (no credentials). It must be outside the original Manager data and CPA configuration/authentication directories, and it must not resolve into them through symlinks, VM shared aliases, or the current working directory; the default is `.cpamp-v2-<Manager ID prefix>` under the current directory. The script refuses overlapping paths before creating anything.
4. **Keep the source read-only**: the original 1.x containers, data, configuration, authentication, and the script's backup are never deleted or changed. The target `/data`, `/runtime`, and backup are three separate new volumes, and the script prints their names. Before upgrading, still keep an additional copy of the original data as described in [Backup](./backup.md).

### Step 2: run the script on the Docker host

The command below is a template: replace every angle-bracket placeholder and do not copy the example values literally.

```bash
bash upgrade-cpamp-v2.sh \
  --image '<full-v2-image-reference: fixed-version-tag-or-@sha256-digest>' \
  --manager '<old-Manager-name-or-ID>' \
  --cpa '<associated-CPA-name-or-ID>' \
  --cpa-version '<actual-CPA-v8-release>' \
  --source-version '<actual-v1.14.x-release>' \
  --mode managed \
  --state-dir '/absolute/isolated-state-directory'
```

Do not add `--confirm` on the first run. The script pulls or verifies the image, inspects the source and mounts read-only, then prints the objects it will stop, the backup, target volumes, published endpoint, origin, networks, and CPA impact. After checking the plan, type `UPGRADE` when prompted; alternatively re-run the same command with `--confirm` after that review. `--confirm` only skips the interactive prompt; it does not mean the script checked the plan for you.

- Without `--manager`, the script accepts only a unique old Compose Manager (the `cpa-manager-plus` service); without `--cpa`, it looks for the associated CPA in the same Compose project, and asks for an explicit choice when no unique object exists. The old Manager's data directory must sit on one exact mount together with `usage.sqlite`/`data.key`; do not work around it by mounting a broad host parent.
- `--mode managed` (the default when both the source CPA's configuration and authentication mounts are available) stops only the selected old Manager and its associated old CPA. `--mode external` stops only the old Manager and leaves the old CPA running. Old containers are never deleted, and original data is never modified.
- When `--source-version`/`--cpa-version` are omitted, the script and engine decide from image tags, OCI versions, and actual evidence; a version that cannot be proven stays unknown. Declare them truthfully when needed; they are not overrides for the format or version gates.
- Other optional flags: `--source-mount` (the old Manager's data mount destination), `--network` (an existing Docker network that reaches the external CPA), and `--public-host`/`--public-origin` (see below). The script never exposes the Docker socket to the web UI or Manager and never recursively changes ownership of the source or runtime trees. The Manager stays `10002`; only a transient restricted root worker performs the fixed target-ownership repair.
- If reconciliation needs historical decisions, the script still prints the Upgrade-only UI address. Those acknowledgements must be made item by item in the browser; the script never accepts gaps silently.

### Step 3: complete CPA and access routes in the browser

Open the Upgrade UI address the script prints, and sign in with the **original Manager administrator key** (not a CPA Management Key). While the upgrade is unfinished, the script prints the fixed bootstrap surface `/.well-known/cpamp-bootstrap/ui`, which its local probe gets `200` from; do not assume the root path `/` opens the upgrade page, and do not rewrite the address by hand. Identity comes from the copied original store, so the existing administrator key is retained and no new key is created. While the upgrade is unfinished, `/health` may return `503`; that is expected, so do not use `/health` to judge failure.

1. **Read-only preflight and history confirmation**: confirm the listed historical days and any parity gaps. Accepting a gap only records that you know about it; it does not restore deleted events. When mismatch dates exceed the single-page display cap (366 days) and the list is truncated, review the complete reconciliation report first and then explicitly check the option to confirm all historical mismatch dates in the wizard before continuing.
2. **Choose the CPA target**: select "Managed CPA · Recommended" to import the source CPA, or "External CPA · Alternate" to connect an independently reachable CPA explicitly. Managed requires an **explicit** choice of "Keep plugins disabled (recommended)" or "Enable plugins"; plugins may run privileged capabilities. A `full` image already has the engine; `slim` first prepares the official pinned CPA artifact in the wizard (download or upload with digest verification).
3. **Access prefixes**: Managed configures the control entry and an independent inference prefix (two independent 16-character random prefixes by default, each customizable; sharing requires an explicit toggle). External configures the control prefix only; model inference still connects directly to the external CPA. Do not treat installation/bootstrap endpoints or management APIs (for example `/.well-known/cpamp-bootstrap`, `<control-prefix>/api/v2/*`) as model APIs; model traffic uses only the inference prefix or the external CPA address.
4. **Complete upgrade verification**: "Run the verification" is the only completion gate. After it passes, select "Activate v2 and restart" so the controlled container restart makes the committed routes effective.
5. **Final acceptance**: open the canonical console `<origin><control-prefix>` (no `/ui` suffix; management API at `<control-prefix>/api/v2/*`) and sign in with the original administrator key. For Managed, request `<origin><inference-prefix>/v1/models` with the correct Client Key and expect `200`; a wrong key must return `401`. For External, verify the external CPA model endpoint directly. Do not run normal migration terminal commands afterwards (`cpa-import`/`verify`/ownership correction or repeated `docker compose up`); for recovery, return to the script with the same `--state-dir`.

Copy access details without keys from the completion page. To recover only a forgotten prefix, run [`cpa-manager-plus access show`](../deployment/docker.md#recover-a-forgotten-access-prefix) in the target v2 container. This does not require rerunning the upgrade or keeping the original `--state-dir`.

### Step 4: recovery, re-run, and explicit rollback

Recovery means re-running the script with the same `--state-dir`. The script binds the original Manager/CPA identities, image, volumes, mounts, and origin; conflicting flags are refused rather than overwritten. A completed operation is not migrated again; the script never rolls back automatically and never pretends a lossless return is possible after v2 writes. After completion and activation, a rerun prints `<origin><committed-control-prefix>`. Open it as printed: do not append `/ui` or return to the retired `/.well-known/cpamp-bootstrap/ui`.

```bash
bash upgrade-cpamp-v2.sh --state-dir '/absolute/isolated-state-directory'
bash upgrade-cpamp-v2.sh --state-dir '/absolute/isolated-state-directory' --rollback
```

`--rollback` is explicit: the script first checks the source identity, the verified target, and the three operation volumes, then stops that target and restarts only the old containers that were actually running before the upgrade. It does **not** migrate v2 writes back to 1.x. The v2 data, backup, and runtime volumes are retained for diagnosis and printed again. Do not continue the same operation after a rollback; a new upgrade must re-evaluate the source.

### When 1.x data was mounted directly into `/data`

The 1.x lock files and `data.key` are owned by `0:0`, while the v2 Manager runs as `10002:10002`. Mounting the original 1.x volume directly into v2 at `/data` is unsupported: v2 stops on the read-only bootstrap page and reports `source_ownership_unavailable`, leaving the original database and key untouched.

- **Correct recovery**: stop that manually mounted container, leave the original 1.x container and volume untouched, and upgrade the original Manager with `bin/upgrade-cpamp-v2.sh` from the same version. The script reads the original volume through a read-only source mount and a transient restricted worker, so the original file ownership does not need to change.
- Do **not** run `chown` by hand on the original 1.x data, `/data`, or `/data/runtime`, and do not re-initialize the original installation or delete lock files to force the page open. If the standard flow cannot be restored, keep the original data unchanged and inspect the original deployment on its host.

### Public origin and External network boundaries

- When access goes through a controlled TLS reverse proxy or a remote Docker daemon, declare the fixed http(s) origin the browser uses with `--public-origin 'https://<your-actual-origin>'` (or `CPAMP_PUBLIC_ORIGIN`; conflicting values are refused). The origin is persisted and bound to the target container environment; `--public-host` only shapes a displayed address and is not TLS authority. The server never trusts a spoofable `X-Forwarded-Proto`, so do not infer HTTPS or the origin from that header.
- External sets the control prefix only, and model inference still connects directly to the externally operated CPA. If preparation used `--mode managed`, the script stopped the original CPA; switching to External then requires a separately running and reachable CPA, because the upgrade page cannot start Docker containers.
- The External address must be reachable from both the target container and the actual clients. Across Docker networks, attach an existing network with `--network`; do not assume a Docker-internal DNS name resolves outside its network or on the host.

### CLI engine and Native (manual path)

The script covers Docker deployments only. Native or manually prepared installations are not promised to be upgradeable by the script, and Docker commands must not be copied verbatim as Native commands. The CLI upgrade engine remains a reusable advanced path, and these steps are self-contained:

1. Stop the old 1.x Manager, the CPA to be imported, and the target Native launcher/systemd stack. Use the original 1.x absolute data directory as `--legacy` and the new package's absolute `data/` as the target; run `preflight --target-dir ...` → `run --target ...` → `reconcile --target ...` offline. `--target-dir` belongs to `preflight` only; a custom backup directory uses `--bundle` on `run/reconcile` and the same path as `--backup` on `rollback --prepare/--verify`. If host `TMPDIR` points inside `--legacy`, `--target`, or `--backup`, pass an explicit `--scratch-dir <dir>` on `preflight`, `run`, `reconcile`, `cpa-import`, `external-connect`, `verify`, `status`, or `rollback --prepare/--verify` to override `TMPDIR` (overlap checks against source, target, and backup roots still apply).
2. For External, run `external-connect` with a private host credential file, synchronize `store-cpa-connection` when needed, and run `verify` offline. For Managed, start the configured Native launcher/systemd service after reconciliation succeeds while public traffic stays isolated; the Manager remains read-only and releases its lock until the upgrade completes, and the Runtime Supervisor must be running. Run `cpa-import --legacy <old-dir> --target <new-data-dir> --cpa-dir <old-CPA-dir> --cpa-auth-dir <old-CPA-auth-dir> --cpa-version <actual-CPA-v8-release> --plugins false`, pointing the actual `CPAMP_RUNTIME_URL` and `CPAMP_RUNTIME_TOKEN_FILE` at the running Supervisor (Native defaults are `http://127.0.0.1:18318` and `<package-root>/run/runtime-token`, not Docker's `9081` and `/data/runtime-secret/token`); `cpa-import` also needs `CPA_UPSTREAM_URL` or `--destination-url`. Then run `verify --legacy ... --target ... --control-base-path '/<control-prefix>' --inference-base-path '/<inference-prefix>'` (omit the inference prefix for External).
3. Run `verify` only while the Supervisor and the Managed CPA are running and Ready. After `status --db-path <new-data-dir>/usage.sqlite --json` reports the `complete` stage, restart the Native service and restore traffic, then open the control entry submitted during the upgrade; for Managed, also prove model requests through the inference prefix.
4. Before a Native rollback, stop the entire target stack, including the public Ingress. `rollback --prepare` generates a **Docker Compose plan, not a systemd service plan**, so do not apply it to a Native service. When generating the plan, bind `--volume` to the original absolute source directory and pass the real `--manager-addr` (default `127.0.0.1:18319`). Restore the exact original 1.x binary, service, and data independently, verify the actual binary, data path, and the plan's dedicated port, then run the planned `rollback --verify ... --status-url http://127.0.0.1:18318/health --manager-addr 127.0.0.1:18319` on the host. The CLI's health identity and data checks cannot replace the Native binary/service identity check; do not use the container-only `host.docker.internal`.

| Report/exit code | Action |
| --- | --- |
| `0` | The current step succeeded; still check the stage, because it does not mean every step is complete |
| `1` | Blocked, refused, or awaiting a decision: read the report and stop advancing automatically |
| `2` | Usage, environment, or retryable error: remove the cause and retry |
| `upgrade_source_version_unsupported` | Check whether the source belongs to the proven v1.14.x family/profile; `--source-version` only declares the actual release and cannot override the format decision |
| `upgrade_cpa_version_unsupported` / `upgrade_cpa_version_required` / `external_cpa_version_unsupported` | CPA must be the v8 major (`8.0.0` and later, 9+ refused); a Managed source must already be CPA v8 inside the 1.x stack, and External must serve a v8 configuration document; when image tags cannot prove it, declare the actual `--cpa-version` |
| `upgrade_source_busy` / `upgrade_store_locked` | Stop the real source/target Manager; do not remove lock files to evade the check |
| `upgrade_source_changed` | The source is still changing; stop all writers and re-evaluate the source and backup |
| `upgrade_worker_unavailable` | Keep the upgrade page and read the status again; for Docker recovery, re-run the script with the same `--state-dir` instead of re-initializing |
| `source_ownership_unavailable` (`/.well-known/cpamp-bootstrap`) | The original 1.x volume was mounted directly into v2 at `/data`: stop that container, keep the original volume, and use the `bin/upgrade-cpamp-v2.sh` standard flow; do not change the original data ownership or re-initialize |

## Patch updates for existing v2 installations and one-time inference-prefix completion

- **Ordinary patch updates keep the existing prefixes**: an installed v2 instance (including one that already committed `/console` as its control prefix) keeps its committed `controlBasePath` and `inferenceBasePath` unchanged across ordinary patch updates. The console and environment variables provide no second editing entry.
- **Older Managed v2 instances missing an inference prefix**: if only a control prefix (for example `/console`) was committed before the upgrade and `inferenceBasePath` was never set, the model gateway stays closed after restart (`503`, with no fallback to `/` or prefixless `/v1`). After the administrator signs in to the existing control entry with the original administrator key, the UI triggers a **one-time inference-prefix completion**: enter a valid custom prefix or use the pre-filled 16-character random prefix, and optionally share the control entry after understanding the boundary. The existing control prefix stays unchanged after submission, and the gateway opens on the new inference prefix.
- **Early completed upgrade databases with no recorded control prefix**: if an upgraded database is `complete` but no control prefix was ever committed, the service refuses to open silently. Stop the writing service and run `cpa-manager-plus upgrade verify --target <v2_data_dir> --control-base-path '/<your-control-prefix>' [--inference-base-path '/<your-inference-prefix>']` once (omit the inference prefix for External) to lock the prefix; the old 1.x source does not need to be mounted again.

## Offline derived indexes and data maintenance (`cleanup-derived`)

To keep startup bounded on large databases, missing indexes for large query tables and old derived-data cleanup are not performed without limit during startup. When the console shows the offline database-maintenance banner (`databaseMaintenance.required = true`), stop the entire v2 service and run `cleanup-derived` as the Manager user (it does not delete or rewrite the authoritative `usage_events`):

```bash
docker compose stop
docker compose run --rm --no-deps -u 10002:10002 --entrypoint cpa-manager-plus \
  cpa-manager-plus cleanup-derived --db-path /data/usage.sqlite
docker compose up -d
```

For the `linux/amd64` native package, stop the complete launcher / `systemd` service first:

```bash
sudo ./bin/cpa-manager-plus cleanup-derived --db-path "$PWD/data/usage.sqlite"
```

## 1.x (before upgrading)

Any 1.x release older than the supported family, or any 1.x source whose preflight has not proven compatibility, must first be updated inside its original 1.x deployment to a supported **v1.14.x** release and verified before the v2 upgrade on this page; do not merely change `--source-version`. For day-to-day updates that stay on the 1.x Stable line, see the 1.x Stable documentation: [Upgrade CPA Manager Plus (1.x Stable)](https://cpamp-docs.seakee.dev/en/operations/update.html).
