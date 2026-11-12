# Releases

When reviewing a new version, focus on three things: what changed, whether anything is incompatible, and whether the upgrade requires extra backup or configuration work.

## View the latest version

- [Latest GitHub Release](https://github.com/seakee/CPA-Manager-Plus/releases/latest)
- [All Releases](https://github.com/seakee/CPA-Manager-Plus/releases)

Each Release lists major features, fixes, downloads, and any required upgrade notes.

## Release channels and image tags

Stable 1.x is the only production release channel. Docker Hub `seakee/cpa-manager-plus` currently publishes these tags:

| Tag | Points to |
| --- | --- |
| `latest` | The newest stable release |
| `1.14` | The newest 1.14.x release |
| `1.14.10`, `v1.14.10` | That exact version, under both spellings |
| `preview` | Preview builds that are not for production |

Pin an exact version in production so a restart never changes the running image without review. `latest` follows each stable release and moves forward automatically.

v2 is a prerelease channel. Its documentation lives at https://cpamp-docs.seakee.dev/next/ and is separate from this Stable documentation. `latest` and in-app updates do not offer v2, so a Stable deployment stays on 1.x unless you deliberately switch channels.

## Before upgrading

1. Read the target version's Upgrade Notes.
2. Confirm whether you use Lightweight Panel, Docker Full Mode, or a native package.
3. For Full Mode, back up SQLite, `data.key`, and secrets in the install directory.
4. Follow the matching steps in [Upgrade CPAMP](../operations/update.md).

Lightweight Panel is normally updated by CPA when it checks for a new `management.html`. If the old interface remains, see [Lightweight Panel Updates and Cache](../deployment/cpa-panel.md#updates-and-cache).

## If something goes wrong

- Cannot log in after upgrade: [Reset Admin Key](../operations/reset-admin-key.md)
- Monitoring is empty after upgrade: [Monitoring Has No Data](../troubleshooting/request-monitoring.md)
- Unsure where data files are stored: [Configuration and Data Directory](../operations/configuration.md)
