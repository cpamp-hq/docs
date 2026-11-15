# Client configuration

Clients use only a regular **Client API Key** and the matching model gateway endpoint. Never put the CPAMP **Admin Key** (for Console login and `/api/v2/*`) or **CPA Management Key** (used server-side by Manager to manage CPA) into any model client. In 1.x, or v2 **External** mode, do not point model clients at CPAMP—CPAMP does not proxy or reroute External model traffic.

::: tip Base URL by deployment mode (v2 Beta vs 1.x)

- **v2 Beta Managed (`New Managed` / `Adopt` / `Upgrade Managed`)**: clients must use the **Inference Base Path** (`<inference-prefix>`) committed during setup, upgrade, or one-time completion, followed by the original protocol path (CPAMP Ingress strips `<inference-prefix>` once internally; unprefixed `/v1/*` and `/` fallbacks are **never** allowed, and internal port `8317` is not exposed):
  - **OpenAI / Responses / compatible SDKs**: Base URL includes `/v1` -> `https://<host><inference-prefix>/v1` (examples: `.../v1/chat/completions`, `.../v1/responses`, `.../v1/models`).
  - **Claude Code / Anthropic SDK**: Base URL is `https://<host><inference-prefix>` (**do not append `/v1`**; the client appends `/v1/messages`).
  - **Gemini CLI / Google GenAI SDK**: Base URL is `https://<host><inference-prefix>` (**do not append `/v1beta`**; the client appends `/v1beta/models/...`).
  - **Codex / Provider routes & streaming**: Ingress also forwards `/openai/v1/...`, `/backend-api/codex/...`, `/api/provider/...`, plus **SSE** and **WebSocket** (such as `/v1/responses` and Codex WS) under `<inference-prefix>`. Behind a reverse proxy, never strip `<inference-prefix>` before forwarding; see [Reverse Proxy](../deployment/reverse-proxy.md).
- **v2 Beta External (`Connect External` / `Upgrade External`)**: CPAMP does **not** allocate a Manager inference prefix or proxy External model traffic. Clients connect directly to your **External CPA's actual public URL** (including any path prefix the External CPA already uses); model traffic, network reachability, and reverse-proxy routing remain owned by the External CPA, while Manager orchestrates keys, configuration, and usage observation.
- **1.x Stable**: follow the general 1.x rules below.
:::

## Client key management, activation, and recovery (v2 Console)

In the v2 Full Mode **API Keys** workspace and **Access Info** panel, you can copy verified endpoints and manage Client API Keys:

- **Addresses across summary, list, create, and detail**: Console Access Info/Overview, Key List, key creation confirmation, and individual Key Details all show the verified protocol endpoints for the current installation (prefixed with `<inference-prefix>` for Managed; the External CPA's actual URL for External; or an explicit pending state when inference setup/connection is incomplete—never a fake root fallback).
- **Credential isolation & secret handling (no plaintext in URLs/logs)**: Admin Key, CPA Management Key, and Client Keys are strictly separate. A newly created workspace key is displayed in its creation confirmation; New Managed displays the installation-generated Client Key in the current completion session (wizard replay never re-emits it). Lists show only masked previews and metadata. In authenticated **Key Details**, all non-retired (`active` or `missing`) encrypted Client Keys can be copied on demand, including workspace-created, installation-generated, and adopted keys. Protected installation-key lifecycle restrictions do not prohibit on-demand copying. Retired (`superseded`) keys, Admin Keys, and CPA Management Keys cannot be read or copied back. Plaintext is never persisted in browser storage, URLs, or service logs.
- **Create success means encrypted save + CPA apply + real auth**: creating a Client Key reaches verified active status only after Manager encrypts and saves it in SQLite, writes it to the target CPA, and passes real CPA client-authentication probing (confirming the key authenticates while empty/invalid keys remain rejected).
- **No artificial 128-key cap & zero/last-key protection**: Managed, Adopted, Upgraded, and External targets support sets beyond 128 keys without an artificial total cap. **An empty CPA key set can enable anonymous access**, so Manager refuses writes that empty the set and blocks revoking the last effective key. Create a replacement and switch clients before replacing or revoking the old key.
- **Missing non-retired keys & safe failure/unknown recovery**:
  - A saved key observed absent on the gateway transitions to non-retired `missing` while retaining its identity, protected ciphertext, and historical attribution rather than vanishing.
  - If gateway activation fails (`not_applied`) or times out with an unknown result (`effect_unknown`), **refreshing the browser or restarting Manager recovers the original canonical key record, secret status, and operation journal via the intent's request ID—never create a duplicate key or send a blind `PUT`**. Use **Retry gateway activation** on the existing record when failed, or run read-only **Check activation status** first when unknown.
- **External rebind & aborted intents**: when an External CPA rotates its Management Key, Rebind updates the stored credential while preserving canonical Client Keys and the External CPA's real URL. Rebind fences in-flight operations so **only intents that have never attempted any write to CPA** can be aborted to terminal `aborted` (guaranteed never-applied); attempted operations must be inspected/settled rather than silently discarded.

## General rules (1.x Stable & External CPA reference)

| Item       | Recommendation                                                                            |
| ---------- | ----------------------------------------------------------------------------------------- |
| Base URL   | The public CPA address, such as `https://gateway.example.com` or `http://localhost:8317`. |
| API Key    | Use a regular Client API Key. Do not use the CPAMP Admin Key or CPA Management Key.       |
| Model      | Use the model name or alias exposed by CPA providers.                                     |
| Monitoring | CPAMP can collect and display events only when requests pass through CPA.                 |

With a 1.x same-domain reverse proxy, client requests to `/v1/*`, `/v1beta/*`, and `/backend-api/codex/*` go to CPA. For v2 Managed, keep `<inference-prefix>` intact through the reverse proxy; for v2 External, keep calling the External CPA directly.

## Codex

Before connecting Codex, prepare:

- Base URL pointing to the target Codex-compatible entry (include `<inference-prefix>` for v2 Managed, e.g. `https://<host><inference-prefix>/openai/v1` or `.../v1`; use the External CPA's real URL for v2 External and 1.x).
- A normal CPA API Key.
- A Codex provider or auth file configured in CPA.
- Stable `auth_index` and recognizable account metadata if you want account inspection.

When Codex requests fail, start with the failure summary in [Monitoring](../manual/monitoring.md). If it looks like an account or quota issue, continue with [Codex Inspection](../manual/codex-inspection.md).

## Claude Code

Before connecting Claude Code:

- CPA has a Claude Code provider or compatible provider.
- OAuth or auth file setup is complete.
- For v2 Managed, set `ANTHROPIC_BASE_URL=https://<host><inference-prefix>` (without `/v1`) and a Client API Key; for v2 External and 1.x, use the External CPA's actual base URL (also without appending `/v1`) and a Client API Key.

OAuth success only means authentication completed. If requests still fail, check account state in Accounts first, then read the Monitoring failure summary.

## OpenCode, Gemini CLI, and general OpenAI clients

OpenCode, OpenAI SDKs, and most relay clients use the OpenAI-compatible `/v1/...` API (Base URL includes `/v1`):

```text
v2 Managed Base URL:   https://<cpamp-host><inference-prefix>/v1
v2 External / 1.x URL: https://<cpa-host>/v1
API Key:               normal Client API Key (not Admin Key or Management Key)
Model:                 model name or alias exposed by CPA
```

Gemini CLI / Google GenAI SDK uses native `/v1beta/models/...` (Base URL must **not** include `/v1beta`):

```text
v2 Managed Base URL:   https://<cpamp-host><inference-prefix>
v2 External / 1.x URL: https://<cpa-host>
```

Behind a reverse proxy, a 401 from `/v1/models` is usually a CPA API Key problem. A 401 from `/v0/management/config` is a CPAMP management login problem.

## Factory droid and other tools

Any tool that accepts an OpenAI-compatible or Gemini-compatible endpoint can use the API exposed by CPA. The important part is that traffic passes through CPA; only then can CPAMP observe request events, cost, and account health.
