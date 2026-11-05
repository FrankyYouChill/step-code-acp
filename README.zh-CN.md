# Step Code ACP 中文使用说明

通过 ACP 适配器，在 T3 Code 中使用你本机安装的 **Step Code**。

运行关系：**T3 Code → 本适配器 → Step Code → 你自己的 Step Plan / API 服务**。Step Code 负责实际的编码工作、工具和模型调用，T3 提供项目与对话界面。本项目是基于 pi-acp 的社区兼容适配，不是 StepFun 或 T3 官方发布。

[English README](README.md) · [架构与限制（英文）](docs/architecture.md) · [Registry 状态（英文）](docs/registry.md)

## 1. 先安装并配置 Step Code

如果你已经能在终端正常使用 Step Code，可以跳过这一步。按照 [Step Code 官方安装说明](https://github.com/stepfun-ai/Step-Code#installation)操作，macOS / Linux 的官方命令是：

```sh
curl -fsSL https://static-openapi.stepfun.com/stepcode/install.sh | bash
```

重新打开终端，运行：

```sh
step --version
step
```

在 Step Code 中输入 `/login`，选择与你账户一致的入口：

| 账户类型 | 入口 |
| --- | --- |
| 海外 API Key | Step Platform Oversea |
| 海外 Step Plan | Step Plan Oversea |
| 国内 API / Plan | 对应的 CN / 国内入口 |

按提示输入自己的 Key 或用浏览器登录，再用 `/model` 选择可用模型，发送一句消息确认能收到回复。登录方式以 [Step Code 当前官方文档](https://github.com/stepfun-ai/Step-Code#sign-in-to-the-step-provider)为准。

你的认证信息仍由自己的 Step Code 管理，模型额度和计费属于自己的账户。无需把 Key 发给仓库作者。

## 2. 安装适配器

这些操作需要在 **T3 服务所在的电脑**执行。使用本机 T3 桌面版时，就是你自己的电脑。

### 方式 A：下载发行包

从 [GitHub Releases](https://github.com/FrankyYouChill/step-code-acp/releases)下载对应平台的压缩包，按发布的 `.sha256` 文件校验，然后解压到一个会长期保留的目录。

发行包已包含 Node 运行时和适配器依赖，但仍需要第 1 步的 Step Code CLI。解压目录最外层的 **`step-code-acp`** 就是启动入口，下一步把它的完整路径填进 T3。请保留整个解压目录；移动目录后要更新 T3 中的路径。

当前发行包支持 macOS Apple Silicon 和 Linux x86_64。其他 macOS / Linux 环境可以尝试下面的源码安装；Windows 暂不支持。

### 方式 B：从 GitHub 源码安装

需要 Git、Node.js 24 或更新版本，以及 npm。选择一个会长期保留的位置：

```sh
mkdir -p ~/Projects
cd ~/Projects
git clone https://github.com/FrankyYouChill/step-code-acp.git
cd step-code-acp
node --version
npm ci --ignore-scripts
npm run setup
```

`node --version` 应显示 v24 或更高版本。安装器会生成启动入口，并打印 **Executable 的完整路径**，通常位于 `~/.local/bin/step-code-acp`。

复制本机实际输出的完整路径。保留下载的文件夹；移动它或更换 Node 安装位置后，重新运行 setup。

## 3. 在 T3 添加 Step Code

进入 **Settings → Providers → Add provider → Show more → Local ACP command**，填写：

| 字段 | 内容 |
| --- | --- |
| Display name | `Step Code` |
| Executable | 发行包中入口的完整路径，或源码安装器输出的完整路径 |
| Arguments | 留空 |
| Environment | 通常留空，复用第 1 步的 Step Code 配置 |

默认寻找 `~/.stepcode/bin/step`。如果 Step Code CLI 安装在其他位置，在这个 Provider 的 Environment 中添加 `STEP_CODE_BINARY`，值为 CLI 的完整路径。

## 4. 打开项目并开始工作

在 T3 添加或打开一个本地项目文件夹，新建对话，选择 **Step Code** 及账户可用的模型，然后发送任务。首次可以这样检查：

> 请告诉我当前工作目录，并列出一级文件。先不要修改任何文件。

收到正常回复并看到工具活动，就完成了基础接入。后续直接在 T3 发任务，T3 会按需启动适配器和 Step Code，不用同时手动开着一个 Step Code 终端。

## 图标和 Registry

本项目正在推进 [ACP Registry](https://github.com/agentclientprotocol/registry) 收录，具体进度见 [Registry 状态](docs/registry.md)。发行包已发布不代表 Registry 已接受。

本仓库提供符合 Registry 要求的单色 SVG 图标。条目审核通过、发布到公共目录后，支持 Registry 的客户端可以通过正常机制加载该图标。手动添加 Local ACP command 时，T3 可能显示通用 ACP 图标。

本项目不会修改 T3 前端，也不提供强制换图标的启动器。

## 兼容范围与协作

本机验证过 macOS、Node 24.15.0、T3 0.1.7、Step Code 0.1.6 和 Step 5 Preview；Linux 发行包也通过了构建与启动检查。0.1.7 是已验证的 T3 版本，基础 ACP 接入没有写死该版本。协议、Step Code RPC 或 T3 MCP 工具变化时，仍可能需要适配和复测。

T3 提供会话内 MCP 工具时，Step Code 可以通过本项目的桥接扩展发现能力，并委派 OpenCode 等 T3 子任务。子任务属于 T3 调度，实际可用性取决于客户端、模型访问与工具审批。完整恢复、回滚、取消和长任务生命周期尚未全面验证，自由文本 input/editor 请求暂不支持。

## 验证与卸载

```sh
npm run build
npm test
npm run smoke
npm run smoke:mcp -- --stdio-descriptor
```

`npm test` 使用本地测试数据，不消耗模型额度。两个 smoke 命令会使用自己的 Step Code 模型访问；读写 smoke 仅在临时目录批准测试写入。

源码安装可用 `npm run uninstall` 移除当前安装创建的入口链接。发行包安装请先在客户端移除 Provider，再删除解压目录。Step Code 自己的配置、认证、会话和 T3 历史仍保留在原位置。

代码采用 MIT 许可证；上游和品牌素材说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。已知依赖公告见 [SECURITY.md](SECURITY.md)。
