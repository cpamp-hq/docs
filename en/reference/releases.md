# Releases

## V2 Beta prerelease channel and assets

v2 Beta is a **Prerelease**, not Stable. `releases/latest`, automatic 1.x panel updates, and the default installer remain on **1.x Stable**. Select the matching Beta from [All Releases](https://github.com/seakee/CPA-Manager-Plus/releases) only after the maintainer actually publishes it; this page does not assert publication or authorize production migration. Do not use floating Beta tags or replace Embedded Full Web with the Beta single-file panel.

Current source provides single-image `slim` / `full` build targets: `slim` acquires digest-pinned official CPA `v8.0.55` in the wizard, while `full` bundles the same CPA. These are build capabilities, **not proof of published single-image releases, rolling tags, or multi-architecture availability**. Choose local tags such as `cpa-manager-plus:full-local` / `slim-local` when building from source instead of overwriting local 1.x `:latest`. The source `docker-compose.yml` is not a downloadable release asset; see [v2 Docker Installation](../deployment/docker.md) for deployment examples.

Current release scripts permit only explicitly opted-in v2 **`DRY_RUN=true`** rehearsals. `update-contract.mjs` still limits platforms to **`linux/amd64`** and image roles to `manager`, `ingress`, and `runtime`. The candidate build step produces single-image evidence, but the complete release contract has not yet switched over. Dockerfile target/platform support does not establish published assets; do not deploy a mixture of old and new topologies. Before installing, verify that the actual Release's image digests, platform, and Compose agree.

The rehearsal defines these six asset filenames:

| File | Purpose |
| --- | --- |
| `cpa-manager-plus-native-v2_<tag>_linux_amd64.tar.gz` | linux/amd64 Native; `<tag>` includes its `v` prefix; no v2 macOS, Windows, or linux/arm64 native packages |
| `management.html` | Independent CPA lightweight panel, not Embedded Full Web |
| `docker-compose.v2-embedded.yml` | Generated Embedded Compose template, not the repository's source `docker-compose.yml` |
| `embedded-release-pairing.json` | Pairing evidence for the same Embedded build |
| `release-info.json` | Matching release metadata |
| `checksums.txt` | Matching asset checksums |

The v2 Beta `release-info.json` contract uses `schema_version: 2`, `migration_required: true`, `minimum_direct_upgrade_version: v1.14.10`, and `minimum_cpa_version: v8.0.55`. The update channel index is **`versions.json`**, retaining outer `schema_version: 1`; its v2 `channels.beta` entry uses `schema_version: 2` and permits Beta Prereleases only. Real publication/index writes remain behind a maintainer gate. This does not assert a published Beta, pushed image tags, or a changed live index. See [Native Deployment](../deployment/native.md) and [Lightweight Panel](../deployment/cpa-panel.md) for Native and Stable/Beta panel download details.

**In-app updates do not offer v2:** `v1.14.10` Stable checks do not select v2 Beta. Manually selecting beta still rejects schema-2 ReleaseInfo, so no available v2 update is shown. Current v2 builds likewise do not offer v2 targets through in-app updates; the producer contract does not add v2 consumer support. Installation or later updates require reading the matching release notes and explicitly selecting one asset group, not automatic image replacement. For 1.x migration, follow [Offline Copy-In, Reconciliation, and Rollback](../operations/update.md), backing up `data.key`, SQLite WAL/SHM, and `usage-archives/`.

## Current licensing and inspectable files

**The current repository root `LICENSE` is MIT**, and images copy that file. Official CPA's MIT LICENSE is distributed separately; third-party dependencies retain their own terms. Future licensing proposals are not effective licenses. CPAMP's MIT license does not imply that every bundled dependency uses MIT. Inspect the actual distributed files and matching license texts.

### Embedded single image

| File | Meaning |
| --- | --- |
| `/usr/local/share/licenses/cpamp/LICENSE` | CPAMP project license in both `slim` and `full` variants |
| `/usr/local/share/licenses/cli-proxy-api/LICENSE` | Official bundled CPA license in the `full` variant (`slim` omits the CPA binary and this file) |
| `/usr/local/share/cpamp/runtime/cpa-artifact.json` | Image-pinned official CPA version (`8.0.55`) and `artifactId` SHA256 manifest |
| `/usr/local/share/cpamp/release/third-party-inventory.txt` | Aggregate license collection inventory containing JSON, despite the `.txt` suffix |
| `/usr/local/share/licenses/<component>/inventory.json` | Component inventory and original LICENSE/NOTICE file digests |
| `/usr/local/share/cpamp/provenance.json` | Byte-bound version, source, role (`cpamp`)/platform, binary, and third-party inventory record (`"cpaBundled": false` on `slim`) |

Single-image (`role: "cpamp"`) `<component>` directories are `manager`, `web`, `ingress`, `runtime-supervisor`, `base-image` (Alpine), and `glibc-runtime` (Debian `libc6`/`libgcc-s1`/`gcc-12-base` runtime libraries required by the official CPA binary). Go/Web collect original texts. Alpine base-image coverage is installed APK license metadata and available packaged notices; `glibc-runtime` uses the corresponding Debian copyright files. `VERIFIED_LICENSE_COLLECTION` is not legal approval and does not turn metadata-only coverage into complete original-text coverage.

Inspect from the running single-image `docker-compose.yml` directory (public build data, not runtime secrets):

```bash
docker compose exec -T cpa-manager-plus \
  cat /usr/local/share/licenses/cpamp/LICENSE
# full variant only (bundled CPA license):
docker compose exec -T cpa-manager-plus \
  cat /usr/local/share/licenses/cli-proxy-api/LICENSE
docker compose exec -T cpa-manager-plus \
  cat /usr/local/share/cpamp/runtime/cpa-artifact.json
docker compose exec -T cpa-manager-plus \
  cat /usr/local/share/cpamp/release/third-party-inventory.txt
docker compose exec -T cpa-manager-plus \
  cat /usr/local/share/licenses/manager/inventory.json
docker compose exec -T cpa-manager-plus \
  cat /usr/local/share/cpamp/provenance.json
```

Compare version, `sourceCommit`, platform, and image digest with the matching GitHub Release notes and `checksums.txt`, and inspect individual notices using inventory paths/digests. Provenance is an **unsigned build-source claim**, not protected-producer proof, a signature, or a legal conclusion. Checksums prove correspondence with a record; you must still trust the release source supplying it.

### Linux/amd64 native

From the extracted package root:

```bash
cat LICENSE
cat share/licenses/cli-proxy-api/LICENSE
cat share/cpamp/runtime/cpa-artifact.json
cat share/cpamp/release/third-party-inventory.txt
cat share/cpamp/provenance.json
```

The Native package carries CPAMP's root `LICENSE` (and `share/licenses/cpamp/LICENSE`), the official CPA `LICENSE`, `cpa-artifact.json`, `share/licenses/<component>/inventory.json` for `manager`, `ingress`, `runtime-supervisor`, and `web`, plus `share/cpamp/provenance.json` with `role: "native"` (a tarball does not own the host OS, so it omits container-only `base-image` and `glibc-runtime` components).

## Related operations

- Offline migration from 1.x (exact baseline `v1.14.10`) and rollback: [Upgrade CPA Manager Plus](../operations/update.md)
- Full offline `/data` volume backup and restore: [Backup and Restore](../operations/backup.md)
- Replace a forgotten administrator credential: [Reset Admin Key](../operations/reset-admin-key.md)
- CPA lightweight panel cache clearing and manual Beta placement: [Updates and Cache](../deployment/cpa-panel.md#updates-and-cache)

## 1.X (before upgrading)

`releases/latest` continues to track 1.x Stable during Beta. For 1.x Stable release assets and update guidance, see the 1.x Stable documentation at [Releases and Update Notes (1.x Stable)](https://cpamp-docs.seakee.dev/en/reference/releases.html).
