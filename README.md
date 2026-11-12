# CPA Manager Plus documentation

Standalone bilingual documentation for [CPA Manager Plus](https://github.com/seakee/CPA-Manager-Plus), a CPA / CLIProxyAPI management panel.

- `main`: **1.x Stable**, published at <https://cpamp-docs.seakee.dev/>.
- `next`: **v2 Beta**, published at <https://cpamp-docs.seakee.dev/next/>. Every Beta page is marked `noindex`; it is not in the Stable sitemap.
- Chinese is the default language; English lives at `en/` within each channel.

## Preview and checks

Use Node **24.22.1** (`nvm use`), then:

```sh
npm ci
npm test
npm run dev
# Production build, including dead-link checks:
npm run build
npm run preview
```

A push to either publishing branch builds **both** branches and deploys one GitHub Pages artifact. Infrastructure is shared; only `.vitepress/channel.ts` differs. Apply infrastructure changes to both branches. The Beta sidebar also keeps its version-specific installation entries through the shared channel flag.

PRs targeting `main` or `next` run content checks and a production build, then upload a preview artifact without deploying. Download and unpack it; serve Stable at `/`, or place a Beta artifact in a `next/` directory before serving its parent with `npx serve` (without SPA mode). For a complete preview, combine Stable dist at the root and Beta dist at `next/`. Pages uses the root `404.html` for missing URLs.

## Coordinating product and docs PRs

Open user-facing documentation changes here, targeting `main` for 1.x or `next` for v2. In the product PR's Docs section, link the corresponding `cpamp-hq/docs` PR (or explain why none is needed), and cross-link the product PR from the docs PR. Merge the docs PR before the related release. Product source and release assets remain in `seakee/CPA-Manager-Plus`; this repo owns documentation only.

## Imported history

| Channel | Product source commit | `git subtree split --prefix=apps/docs` commit |
| --- | --- | --- |
| `main` | `a67ed8834a914ab24c36d2490fa6bb6d4166724c` (`v1.14.10`) | `4717913de1cc2f043747ef3353a24bbd2864e072` |
| `next` | `daf0f6b4c02b4d2cafa068c0d470ed561c6be310` | `5979dfdae66b0485d9eeb66fddb202d65d3a6dc3` |

Content integrity checks were ported from the corresponding product tests. Product README-only assertions stay with the product; docs assertions run against actual pages here. The additional Beta reverse-proxy and Lite panel wording checks are channel-gated.
