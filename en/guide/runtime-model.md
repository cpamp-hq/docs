# How CPAMP Works With CPA

## v2 Beta: Embedded And External

Full Mode in v2 Beta is not the single-Manager 1.x deployment. Embedded official CPA is pinned to **`v8.0.55`**; External requires at least **`v8.0.55`** and actual qualification. The exact 1.x direct upgrade baseline is **`v1.14.10`**; see [Upgrade And Rollback](../operations/update.md).

| Mode | Who runs CPA | CPAMP boundary |
| --- | --- | --- |
| Embedded / New Managed or qualified Adopt | Runtime Supervisor inside the single-image container or Native package manages official CPA | Single image `seakee/cpa-manager-plus` (`slim` acquires CPA via the wizard, `full` bundles CPA) or Native launcher supervises Supervisor, Manager, Ingress, and managed CPA internally; Docker publishes only port `18317` and a single `/data` volume (pinned to `<tag>@sha256:<digest>`) |
| External | The operator's own CPA host/container/service | CPAMP proves/saves the connection, manages supported configuration and Client Keys, and reads status/observations; it does not start, stop, restart, or upgrade external CPA or take over its traffic entry automatically |
| Lightweight Panel | CPA directly hosts `management.html` | No Manager, SQLite, or Runtime; signs in with CPA Management Key and cannot provide Manager request history |

**Embedded** browser/model traffic uses the configured public origin. Ingress owns public routing; do not separately publish internal/control `8317`/`9081`. New installation requires a host `initialize` Handoff, browser Admin Key setup, and strategy/qualification completion before normal product access. The first Client Key is for model requests; Admin Key is for administration. Process liveness, installation completion, and Gateway readiness are different states.

**External** first proves the connection and Management Key. Supported configuration does not imply host filesystem/lifecycle authority. Rule writes stay read-only without an exclusive write window; writable scalar fields follow actual capabilities. Usage statistics require explicit administrator confirmation rather than automatic changes to external CPA. Its operator remains responsible for CPA upgrades, TLS/networking, configuration/OAuth backups, and availability. Clients retain the external CPA's real entry; Manager completion does not reroute them automatically.

After external Management Key rotation, rebind and prove the current connection in the panel; do not repeatedly retry credentials CPA already rejected. Retain Manager `data.key` with its encrypted database. A refused or incomplete Adopt migration does not authorize automatic External fallback: follow the wizard report, not environment changes or manually edited records.

For a **Fresh installation**, the v2 Beta browser entry is the **Control Base Path** chosen during installation: the wizard defaults to **`/console`** (for example `http://<host>:18317/console`), with frontend API `<control-base-path>/api/v2/*`. Use the completion page's "Sign in and enter CPAMP" address; it cannot collide with reserved paths such as `/v1`, `/models`, or `/management.html`. Fresh Full Web is not served at `/management.html`. **Instances upgraded offline from 1.x still use `/management.html` (or `/`) and the existing Admin Key**; upgrading does not automatically establish `/console`. Embedded `8317` and `9081` are container-internal only and must not be published separately.

Ingress also routes `/health`, `/status`, `/`, `/setup`, `/management.html`, `/usage-service/*`, and `/v0/management/*` to Manager for health checks and transitional upgrade compatibility; route ownership does not mean a feature is available in Fresh mode. Edge-denied requests such as `/v8/management/*` and retired control paths return `404` without forwarding to CPA. Manager also handles `GET` / `HEAD` for `/favicon.ico` and `/apple-touch-icon.png`.

Install: [v2 Docker](../deployment/docker.md) / [linux/amd64 Native](../deployment/native.md). Operate: [Backup](../operations/backup.md) / [Licensing And Release Assets](../reference/releases.md).

## Where Requests And Keys Go

| Scenario | Target URL | Key Used |
| --- | --- | --- |
| **Embedded** client model requests | `<public-origin>/v1/...` on CPAMP (forwarded by Ingress to in-container CPA; `8317` is not exposed) | Regular CPA Client Key issued in the wizard or console |
| **External** client model requests | External CPA's own `/v1/...` endpoint | Regular CPA Client Key |
| Open **CPAMP Full Mode console** (Embedded or External) | Fresh installations use their Control Base Path (default `/console`, API `<control-base-path>/api/v2/*`); 1.x upgrades use `/management.html` (or `/`) | CPAMP Admin Key |
| Open **CPAMP Lightweight Panel** (no Manager backend) | External CPA `http://<cpa-host>:8317/management.html` | CPA Management Key |

Never put the CPAMP Admin Key or CPA Management Key into regular model clients. In External mode, Manager reads CPA's Management API and drains its in-memory usage queue without taking over external CPA's host lifecycle. Set the poll interval with `USAGE_POLL_INTERVAL_MS` (default `500` ms), keeping it within CPA's in-memory queue retention window.

## Next Steps

- Deploy Full Mode: [v2 Docker Installation](../deployment/docker.md) or [linux/amd64 Native Package](../deployment/native.md)
- Compare Full Mode and Lightweight Panel: [Choose How To Run CPAMP](./choosing-a-panel.md)
- Configure Codex, Claude Code, OpenCode, and SDK clients: [Connect Clients](../gateway/clients.md)
- Diagnose missing monitoring records: [Request Monitoring Has No Data](../troubleshooting/request-monitoring.md)

## 1.x (Before Upgrading)

1.x Stable uses a single Manager Server paired with an external CPA and serves its UI at `:18317/management.html`; see the 1.x Stable documentation at [How CPAMP Works With CPA (1.x Stable)](https://cpamp-docs.seakee.dev/en/guide/runtime-model.html).
