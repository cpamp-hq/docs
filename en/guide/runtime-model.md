# How CPAMP works with CPA

## v2 Beta: embedded and external

Full Mode in v2 Beta is not the single-Manager 1.x deployment. Embedded official CPA is pinned to **`v8.0.55`**; External requires at least **`v8.0.55`** and actual qualification. The exact 1.x direct upgrade baseline is **`v1.14.10`**; see [Upgrade and Rollback](../operations/update.md).

| Mode | Who runs CPA | CPAMP boundary |
| --- | --- | --- |
| Embedded / New Managed or qualified Adopt | Runtime Supervisor inside the single-image container or Native package manages official CPA | Single image `seakee/cpa-manager-plus` (`slim` acquires CPA via the wizard, `full` bundles CPA) or Native launcher supervises Supervisor, Manager, Ingress, and managed CPA internally; Docker publishes only port `18317` and a single `/data` volume (pinned to `<tag>@sha256:<digest>`) |
| External | The operator's own CPA host/container/service | CPAMP proves/saves the connection, manages supported configuration and Client Keys, and reads status/observations; it does not start, stop, restart, or upgrade external CPA or take over its traffic entry automatically |
| Lightweight Panel | CPA directly hosts `management.html` | No Manager, SQLite, or Runtime; signs in with CPA Management Key and cannot provide Manager request history |

**Embedded** browser/model traffic uses the configured public origin. Ingress owns public routing; do not separately publish internal/control `8317`/`9081`. New installation requires a host `initialize` Handoff, browser Admin Key setup, and strategy/qualification completion before normal product access. The first Client Key is for model requests; Admin Key is for administration. Process liveness, installation completion, and Gateway readiness are different states.

**External** first proves the connection and Management Key. Supported configuration does not imply host filesystem/lifecycle authority. Rule writes stay read-only without an exclusive write window; writable scalar fields follow actual capabilities. Usage statistics require explicit administrator confirmation rather than automatic changes to external CPA. Its operator remains responsible for CPA upgrades, TLS/networking, configuration/OAuth backups, and availability. Clients retain the external CPA's real entry; Manager completion does not reroute them automatically.

After external Management Key rotation, rebind and prove the current connection in the panel; do not repeatedly retry credentials CPA already rejected. Retain Manager `data.key` with its encrypted database. A refused or incomplete Adopt migration does not authorize automatic External fallback: follow the wizard report, not environment changes or manually edited records.

For **v2 Beta**, the Full Mode browser entry is the **Control Base Path** committed at installation or upgrade (new installations pre-fill a 16-character CSPRNG prefix instead of defaulting to `/console`, with independent custom/random controls; existing `/console` deployments keep `/console`), and the frontend API lives at `<control-prefix>/api/v2/*`. Trust the "Sign in and enter CPAMP" link or your committed upgrade prefix; prefixes cannot collide with reserved paths such as `/v1`, `/v1beta`, `/models`, `/management.html`, or `/.well-known`. **Neither fresh v2 installs nor completed 1.x->v2 upgrades serve the console at `/management.html` or `/`**. Embedded `8317` and `9081` remain internal and must not be published separately.

Once prefixes are committed, Ingress routes only the committed `<control-prefix>` and (for Managed modes) `<inference-prefix>`:
- **Independent vs shared prefixes**: Managed uses separate Control and Inference prefixes by default; sharing one prefix requires explicit confirmation and forwards only supported model protocol subpaths (`/v1/*`, `/v1beta/*`, `/openai/v1/*`, `/backend-api/codex/*`, `/api/provider/*`) while keeping `/v0`, `/v8`, `/management.html`, and OAuth callbacks blocked. Ingress strips `<inference-prefix>` once internally before forwarding to managed CPA.
- **Fail-closed posture**: before setup commits or while an older Managed v2 installation awaits its one-time inference prefix completion, the model gateway stays `503`. After Managed commits its inference prefix, unprefixed `/v1/*`, `/management.html`, and `/` return `404` without fallback or redirect. External provides no Manager inference entry, so these paths remain `503`. Both modes deny `/v8/management/*` with `404`. Pre-commit browser navigation redirects to `/.well-known/cpamp-bootstrap/ui` only when Manager positively confirms pre-commit Bootstrap. Manager handles `/health`, `/v0/resource/plugins/*`, and `GET`/`HEAD` `/favicon.ico` and `/apple-touch-icon.png`.

Install: [v2 Docker](../deployment/docker.md) / [linux/amd64 Native](../deployment/native.md). Operate: [Backup](../operations/backup.md) / [Licensing and Release Assets](../reference/releases.md).

## Where requests and keys go

| Scenario | Target URL | Key Used |
| --- | --- | --- |
| **Embedded / Managed** client model requests | `<public-origin><inference-prefix>` + original protocol path (for example OpenAI `.../v1`, Claude/Gemini native `...` for `/v1/messages` or `/v1beta/models`, including SSE/WS; `8317` is not exposed) | Regular CPA Client Key issued by wizard or console |
| **External** client model requests | External CPA's own actual public URL (CPAMP allocates no inference prefix and does not proxy External traffic) | Regular CPA Client Key |
| Open **CPAMP Full Mode console** (Embedded or External) | Control prefix committed at setup or upgrade (for example `<public-origin>/<control-prefix>`, API `<control-prefix>/api/v2/*`; existing `/console` deployments keep `/console`) | CPAMP Admin Key |
| Open **CPAMP Lightweight Panel** (no Manager backend) | External CPA `http://<cpa-host>:8317/management.html` | CPA Management Key |

Never put the CPAMP Admin Key or CPA Management Key into regular model clients. In External mode, Manager reads CPA's Management API and drains its in-memory usage queue without taking over external CPA's host lifecycle. Set the poll interval with `USAGE_POLL_INTERVAL_MS` (default `500` ms), keeping it within CPA's in-memory queue retention window.

## Next steps

- Deploy Full Mode: [v2 Docker Installation](../deployment/docker.md) or [linux/amd64 Native Package](../deployment/native.md)
- Compare Full Mode and Lightweight Panel: [Choose How To Run CPAMP](./choosing-a-panel.md)
- Configure Codex, Claude Code, OpenCode, and SDK clients: [Connect Clients](../gateway/clients.md)
- Diagnose missing monitoring records: [Request Monitoring Has No Data](../troubleshooting/request-monitoring.md)

## 1.X (before upgrading)

1.x Stable uses a single Manager Server paired with an external CPA and serves its UI at `:18317/management.html`; see the 1.x Stable documentation at [How CPAMP Works With CPA (1.x Stable)](https://cpamp-docs.seakee.dev/en/guide/runtime-model.html).
