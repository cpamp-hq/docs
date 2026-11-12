# Reset Admin Key

Use `reset-admin-key` while the service is stopped when you need to replace Manager's administrator login credential. The command updates only `settings.admin_credential_v1` (salt and HMAC digest) in SQLite. It cannot recover a lost `/data/data.key`, does not modify `/data/runtime` or `/data/runtime-secret/token`, and does not rotate the CPA Management Key / Client Keys, claim a Fresh installation, or finish an incomplete upgrade. For first installation use [Host Initialize And Handoff](../deployment/docker.md); for upgrade refusals follow [Upgrade And Rollback](./update.md) (exact baseline `v1.14.10`, minimum target CPA `v8.0.55`).

## Before You Run It

1. Stop the entire v2 service (`docker compose stop` for Docker, or stop the complete launcher / `systemd` unit for `linux/amd64` Native) so the SQLite process lock is released.
2. Back up the single `/data` volume (Manager's `usage.sqlite`, WAL/SHM, `data.key`, and `usage-archives/` when present, plus Embedded `/data/runtime` and `/data/runtime-secret/token`) following [Backup And Restore](./backup.md).
3. Never delete volumes, `usage.sqlite.manager.lock`, or installation records.

## Docker Compose (Single Image)

From the `docker-compose.yml` directory/project, retaining the digest-pinned `seakee/cpa-manager-plus:<tag>@sha256:<digest>` single image:

```bash
docker compose stop
docker compose run --rm --no-deps -u 10002:10002 --entrypoint cpa-manager-plus \
  cpa-manager-plus reset-admin-key --db-path /data/usage.sqlite
```

`-u 10002:10002 --entrypoint cpa-manager-plus` invokes the CLI directly as the unprivileged Manager identity (`10002:10002`), avoiding starting the PID 1 launcher and keeping SQLite, WAL, and lock-file ownership on `10002:10002` rather than `0:0`. When no key flag is supplied, a random key is printed once:

```text
CPA Manager Plus admin key reset.
New admin key: cpamp_...
Save this value now. It will not be shown again.
```

Save the key immediately and keep terminal output out of public logs or chat transcripts. Only after the command exits successfully, start the service and sign in at the Control Base Path chosen during installation on the original public entry (default `/console`, for example `http://<host>:18317/console`) to confirm the CPA connection; v2 does not serve `/management.html` (404):

```bash
docker compose up -d
```

## Provide A Specific Admin Key (`--admin-key-file`)

To set a chosen key explicitly, pass `--admin-key-file` (cannot be combined with `--admin-key`, and keeps plaintext out of shell history). Because the one-shot Docker container runs as `10002:10002`, make the temporary host file readable by UID `10002` and mount it read-only:

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

When a key is provided, only its digest is stored and the plaintext is never echoed (`Use the provided admin key to log in after restarting Manager Server.`). Remove `/srv/new-cpamp-admin-key.txt` after verifying console login and the CPA connection.

## linux/amd64 Native Package

Stop the complete launcher / `systemd` service and back up `data/` first, then run from the extracted package root:

```bash
sudo ./bin/cpa-manager-plus reset-admin-key --db-path "$PWD/data/usage.sqlite"
```

With `--admin-key-file`, pass a restricted private host file; after success restart the original service and verify login rather than rerunning `initialize`.

::: details Advanced: command internals
`cpa-manager-plus reset-admin-key` (alias `reset-admin-password`) acquires the exclusive process lock, verifies that the target file exists, is non-empty, and contains the `settings` and `usage_events` tables, and writes a new salted HMAC credential to `settings.admin_credential_v1` (preserving an existing `CreatedAtMS` and updating `RotatedAtMS`). It does not start the HTTP server, collector, or background workers, and does not read `data.key` or `/data/runtime-secret/token`.
:::

## Troubleshooting

- `acquire admin reset lock; stop Manager Server and retry`: the service is still running or another process holds the lock. Confirm `docker compose stop` or `systemctl stop` finished; never delete lock files manually.
- `SQLite database not found at ...` / `is empty` / `does not look like a CPA Manager Plus Manager Server database`: `--db-path` points to the wrong path or a newly created empty volume. Leave services stopped and inspect the actual volume mapping.
- The generated key was not saved: run the same command again while the service remains stopped to generate a fresh random key.

## 1.x (Before Upgrading)

1.x Stable deployments (`docker-compose.manager.yml`, `install-cpamp.sh` with `CPAMP_OPERATION=repair`, or multi-platform 1.x native binaries) use a different recovery procedure; see the 1.x Stable documentation at [Reset Admin Key (1.x Stable)](https://cpamp-docs.seakee.dev/en/operations/reset-admin-key.html).
