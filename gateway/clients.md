# 客户端接入

客户端只使用普通 **Client API Key** 与对应模型网关地址。不要把 CPAMP **Admin Key**（仅用于登录控制台与 `/api/v2/*`）或 **CPA Management Key**（仅由 Manager 服务端管理 CPA）填进任何模型客户端。在 1.x 和 v2 **External**（连接外部 CPA）模式下，不要把模型客户端指向 CPAMP，CPAMP 不承接 External 模型的转发或改道。

::: tip 按部署形态区分接入地址（v2 Beta vs 1.x）

- **v2 Beta Managed（New Managed / Adopt / Upgrade Managed）**：客户端必须使用在向导（或升级/一次性补全）中提交的 **推理前缀（Inference Base Path）**，拼接原始协议路径（CPAMP Ingress 会在内部剥离一次推理前缀，**不支持**不带前缀的 `/v1/*` 或根路径 `/` 回退；容器内 `8317` 也不对外开放）：
  - **OpenAI / Responses / 兼容客户端**：Base URL 带 `/v1`，即 `https://<host><inference-prefix>/v1`（示例接口：`.../v1/chat/completions`、`.../v1/responses`、`.../v1/models`）。
  - **Claude Code / Anthropic SDK**：Base URL 为 `https://<host><inference-prefix>`（**不要额外附加 `/v1`**，客户端自身会请求 `/v1/messages`）。
  - **Gemini CLI / Google GenAI SDK**：Base URL 为 `https://<host><inference-prefix>`（**不要额外附加 `/v1beta`**，客户端自身会请求 `/v1beta/models/...`）。
  - **Codex / Provider 协议与长连接**：Ingress 同时在 `<inference-prefix>` 下支持 `/openai/v1/...`、`/backend-api/codex/...`、`/api/provider/...`，以及 **SSE 流式**与 **WebSocket**（如 `/v1/responses`、Codex WS）。若经反向代理接入，反代不得剥离 `<inference-prefix>`，见[反向代理](../deployment/reverse-proxy.md)。
- **v2 Beta External（Connect External / Upgrade External）**：CPAMP **不分配 Manager 推理前缀**，也不代理 External 的模型流量。客户端直接连接操作者自己**外部 CPA 的真实对外地址**（包括外部 CPA 自身已带的任何路径前缀）；流量归属、网络可达与反代仍完全属于外部 CPA 自身，Manager 仅负责密钥与配置编排及观测。
- **1.x Stable**：按本页下面的 1.x 通用地址说明配置。
:::

## 客户端密钥管理、激活与恢复（v2 控制台）

在 v2 完整模式控制台的 **API 密钥（API Keys）** 工作区以及 **接入信息（Access Info）** 中，可以核对当前有效的协议接入地址并管理 Client API Key：

- **接入地址四处同步展示**：控制台概览/接入信息、密钥列表、创建成功结果以及单条密钥详情抽屉都会按当前部署形态展示经核验的协议接入地址（Managed 展示带 `<inference-prefix>` 的地址；External 展示外部 CPA 的真实地址；若尚未完成推理前缀补全或连接未就绪，则明确显示等待配置状态，不生成假回退地址）。
- **身份与密文边界（禁止在 URL/日志放明文）**：Admin Key、CPA Management Key 与 Client Key 严格分离。创建新工作区密钥时完整明文在创建确认面板展示；New Managed 向导完成页仅在当前会话展示安装生成的首把 Client Key（关闭或刷新向导后不再重发）。密钥列表只展示脱敏预览与元数据；在已认证控制台的**密钥详情**中，尚未退役的加密 Client Key（`active` / `missing`）均可按需点击“复制密钥”，包括工作区创建、安装生成和接管导入的密钥。受保护安装密钥的生命周期限制不等于禁止按需复制。已退役（`superseded`）密钥、Admin Key 与 CPA Management Key 不可复制回读；明文不进入浏览器持久存储、URL 或服务日志。
- **创建即“加密保存 + CPA 写入 + 真实客户端认证”**：新建 Client Key 只有在 Manager 完成加密持久化、同步写入目标 CPA 并通过真实客户端接口认证探测（确认新密钥可通过且无效/空密钥仍被拒绝）后，才算“已生效 · 已验证”。
- **多密钥无人工总量上限与零密钥保护**：Managed、Adopted、Upgrade 和 External 目标均支持超过 128 把密钥，无人工总量上限；同时保留零密钥与最后一把有效密钥保护。**空 CPA 密钥集可能开放匿名访问**，因此 Manager 拒绝写入空密钥集，也禁止直接撤销最后一把有效密钥；需先创建替代密钥并完成客户端切换，再替换或撤销旧密钥。
- **非退役缺失与失败/未知结果的安全恢复**：
  - 若某把密钥仍在 Manager 有效记录中但在网关侧被观测到缺失（`missing`，非退役），仍保留记录身份、加密密文与历史归属语义，而非静默抹除。
  - 创建或写入 CPA 过程中如遇失败（`not_applied`）、超时或结果未知（`effect_unknown`），**刷新页面或重启 Manager 会按原请求 ID 恢复原有规范密钥记录、密文状态与操作日志（Journal）**，**不要重复新建第二把密钥，也不要盲目重发 `PUT`**。失败状态可直接针对该既有密钥“重试网关激活”；未知状态必须先执行只读的“核对激活状态”观察实际网关结果，再决定后续操作。
- **External 重新绑定（Rebind）与中止语义**：当外部 CPA 更换 Management Key 时，可通过“重新绑定管理密钥”更新凭据；rebind 会保留原有的规范 Client Key 与外部 CPA 地址，并仅允许将**从未向目标 CPA 发起过任何写入尝试**的操作意图安全中止为终态 `aborted`（保证从未写入过网关）；已经尝试过写入的操作必须先核对或收敛，不会被静默丢弃。

## 通用规则（1.x Stable 与外部 CPA 参考）

| 项目     | 建议                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| Base URL | CPA 对外地址，例如 `https://gateway.example.com` 或 `http://localhost:8317`。 |
| API 密钥 | 使用 CPA 的普通 Client API 密钥，不要使用 CPAMP 管理员密钥或 CPA Management Key。 |
| 模型     | 使用 CPA 提供商暴露的模型名或别名。                                           |
| 监控     | 请求通过 CPA 后，CPAMP 才能采集用量队列并展示在请求监控 / 用量分析中。        |

1.x 同域名反向代理时，`/v1/*`、`/v1beta/*`、`/backend-api/codex/*` 这些客户端请求应转发到 CPA；v2 Beta Managed 则必须在反代中完整保留 `<inference-prefix>`，External 则继续直连外部 CPA。

## Codex

Codex 接入前先准备好：

- Base URL 指向目标入口的 Codex 兼容路径（v2 Managed 需包含 `<inference-prefix>`，例如 `https://<host><inference-prefix>/openai/v1` 或 `.../v1`；v2 External 与 1.x 指向外部 CPA 真实入口）。
- API 密钥使用 CPA 普通 API 密钥。
- Codex 提供商或认证文件已在 CPA 中配置。
- 如果要做账号巡检，认证文件中需要稳定的 `auth_index` 和可识别账号信息。

Codex 请求失败时，先看 [请求监控](../manual/monitoring.md) 的失败摘要；如果像账号或配额问题，再看 [Codex 账号巡检](../manual/codex-inspection.md)。

## Claude Code

Claude Code 接入前检查：

- CPA 中已有 Claude Code 提供商或兼容提供商。
- OAuth 或认证文件已完成。
- v2 Managed 使用 `ANTHROPIC_BASE_URL=https://<host><inference-prefix>`（不要带 `/v1`）与普通 Client API Key；v2 External 与 1.x 使用外部 CPA 真实基础地址（同样不额外拼接 `/v1`）与普通 Client API Key。

OAuth 成功只能说明认证流程完成，不代表账号一定能服务请求。请求失败时，先在凭证管理中检查账号状态，再看请求监控的失败摘要。

## OpenCode、Gemini CLI 与通用 OpenAI 客户端

OpenCode、OpenAI SDK 和多数兼容客户端使用 OpenAI 兼容的 `/v1/...`（Base URL 带 `/v1`）：

```text
v2 Managed Base URL:   https://<cpamp-host><inference-prefix>/v1
v2 External / 1.x URL: https://<cpa-host>/v1
API 密钥:              Client API Key（非 Admin Key / Management Key）
模型:                  CPA 暴露的模型名或别名
```

Gemini CLI / Google GenAI SDK 使用原生 `/v1beta/models/...`（Base URL **不要**包含 `/v1beta`）：

```text
v2 Managed Base URL:   https://<cpamp-host><inference-prefix>
v2 External / 1.x URL: https://<cpa-host>
```

经过反向代理时，`/v1/models` 返回 401 通常是 CPA API 密钥问题；`/v0/management/config` 返回 401 才是 CPAMP 管理登录问题。

## Factory Droid / 其他工具

其他工具只要能填写 OpenAI 兼容或 Gemini 兼容端点，就按 CPA 暴露的接口配置。关键是让请求经过 CPA；只有这样，CPAMP 才能看到请求事件、成本和账号健康信息。
