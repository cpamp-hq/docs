# One-click installer

::: warning `bin/install-cpamp.sh` Is 1.x Stable Only — Not For v2 Beta
`bin/install-cpamp.sh` resolves GitHub `releases/latest` and therefore **installs or maintains 1.x Stable only** (`:18317/management.html`). It never selects v2 Beta prereleases and cannot migrate 1.x data to v2.
:::

## v2 Beta installation and migration paths

For v2 Beta (`next`), choose the matching guide below instead of running `install-cpamp.sh`:

| Scenario | v2 Beta Procedure |
| --- | --- |
| **Fresh installation (Docker, recommended)** | Deploy the single `seakee/cpa-manager-plus` image pinned via `<tag>@sha256:<digest>` (`slim` tags such as `2.0.0-beta.1` acquire CPA in the wizard from CDN / GitHub Release or a local `.tar.gz` upload, `full` tags such as `2.0.0-beta.1-full` bundle CPA; `:latest`, `:preview`, `:1`, and `:1.14` stay on 1.x Stable during Beta, and v2 image tags have no `v` prefix), then complete browser setup via the host `initialize` Handoff. The console defaults to `/console` (a Fresh installation returns 404 for `:18317/management.html`). See [v2 Docker Installation](./docker.md). |
| **Linux x86_64 host without Docker** | Use the `cpa-manager-plus-native-v2_<ver>_linux_amd64.tar.gz` archive (v2 provides no macOS, Windows, or `linux/arm64` native packages). See [Native Packages](./native.md). |
| **Lightweight Panel only on an existing CPA** | Manually place `management.html` from a published v2 Beta prerelease with automatic panel updates disabled. See [CPAMP Lightweight Panel](./cpa-panel.md#try-the-v2-beta-panel-on-cpa). |
| **Upgrade an existing 1.x deployment to v2 Beta** | Update the 1.x instance to exact baseline **`v1.14.10`** first (target CPA requires at least **`v8.0.55`**), then attach a fresh empty `/data` volume, mount the original 1.x volume read-only at `/legacy:ro`, and run offline preflight, copy-in, and four-domain reconciliation. See [Upgrade and Rollback](../operations/update.md). |

The table's `/console` entry and unavailable `/management.html` describe **Fresh installations only**. Instances upgraded offline from 1.x still use `:18317/management.html` (or `/`) and the original Admin Key. See [Runtime Model](../guide/runtime-model.md) for `/health`, `/status`, transitional control paths, and edge-denied `404` rules. Single-image tags are deployment examples, not evidence that current release scripts have published them; see [Release Assets and Gates](../reference/releases.md) for actual asset/platform limitations.

## 1.X (before upgrading)

If you are deploying 1.x Stable, or using the installer script to bring an older 1.x deployment up to `v1.14.10` before migrating to v2, see the 1.x Stable documentation for full script options and maintenance modes: [One-Click Installer (1.x Stable)](https://cpamp-docs.seakee.dev/en/deployment/installer.html).
