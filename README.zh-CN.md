# Step Code ACP：在 T3 中使用真正的 Step Code

这是社区维护的兼容适配器，实际链路是 **T3 → ACP → 本机 Step Code RPC → 你已配置的模型服务**。不是在 OpenCode 里选一个 Step 模型，也不是 StepFun 或 T3 官方发布。

## 别人怎么从 GitHub 用

先安装并配置自己的 [Step Code CLI](https://github.com/stepfun-ai/Step-Code)，在终端确认可以正常对话；安装 Node.js 24 或更新版本，然后：

```sh
git clone https://github.com/FrankyYouChill/step-code-acp.git
cd step-code-acp
node --version
npm ci --ignore-scripts
npm run setup
```

安装输出会给出当前电脑的完整路径。到 T3 的 **Settings → Providers → Add provider → Show more → Local ACP command**：名称填 `Step Code`，Executable 填安装输出的完整路径，参数留空，环境变量通常留空。它复用使用者自己的 Step Code 配置，不需要共享作者的密钥或账号。海外 API、国内 API 或 Plan 的可用性和计费由其 Step Code 配置决定。

默认寻找 `~/.stepcode/bin/step`。如果 CLI 装在别处，在 T3 这个 Provider 的环境设置中添加 `STEP_CODE_BINARY`，值为 CLI 完整路径。项目文件夹要保留；移动文件夹或换 Node 后重新 setup。

## 正确图标怎么复现

T3 0.1.7 原版对 Local ACP command 使用通用图标。因此，**只装适配器还不会改变图标**；本仓库把可复用的界面适配也放在一起了。

macOS 上先运行 `npm run t3:check`，然后从应用菜单退出 T3，再运行 `npm run t3:launch`，或者双击安装时生成的 **T3 with Step Code.app**。Provider 的名字需要是 `Step Code`。图标素材来自项目作者提供的 GitHub 头像，已包含在仓库中，运行时不用联网下载。

它通过 T3 现有的开发界面入口加载本地适配的前端，沿用原后端和 `~/.t3` 数据；不修改原应用、签名或历史记录。界面可能显示 T3 的开发版名称，前端偏好可能因浏览器存储 origin 不同而重置。只支持校验通过的 0.1.7 安装包，其他包会拒绝启动适配。OpenCode 等原生 Provider 仍保留自己的图标。

恢复时：退出 T3 → `npm run t3:stop` → 从 Applications 正常打开原 T3。**录制时保留本地界面服务运行。** ACP 连接与图标服务是两个部分；停止后者不会删除接入代码或会话。

## 协作能力与验证

可把 T3 会话提供的本地 MCP 工具转交给 Step Code，使 Step Code 真正调用 T3 委派 OpenCode 等子任务。子任务属于 T3 调度，不等同于 Step Code 原生 subagent。最终可见能力取决于 T3、模型和工具审批设置。

`npm test` 不消耗模型额度；`npm run smoke` 用自己的模型做真实读写验证；`npm run smoke:mcp -- --stdio-descriptor` 验证真实模型调用本地 MCP 测试工具。基础协议、模型发现、流式文字、读写、审批、错误上报已有验证。恢复、回滚和复杂多 Agent 生命周期尚未全面验证，自由文本 input/editor 暂不支持。

## 开源和申请收录的区别

任何人现在就能按上述步骤从这个 GitHub 安装，**不用先等 ACP Registry 审批**。申请公共目录收录是向 [agentclientprotocol/registry](https://github.com/agentclientprotocol/registry) 提 PR，由该仓库维护者审核。还需要稳定的可分发版本、入口清单、符合要求的 SVG 图标、认证及协议验证。当前仓库尚未宣称被收录。

希望原版 T3 原生支持本地 ACP 自定义图标，则向 [pingdotgg/t3code](https://github.com/pingdotgg/t3code) 提通用功能 PR。这和 Registry 收录是两件事。

更多参数、限制和卸载方法见 [English README](README.md)。代码 MIT；品牌素材单独归属，详见 [第三方说明](THIRD_PARTY_NOTICES.md)。
