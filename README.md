# Luvtora 运营中心

面向 Mac 的独立站经营桌面程序，试用版（v0.1.2）。默认网站 `https://luvtora.com`，每日广告预算参考值 USD 45。

## 当前交付

- 本地经营面板：无模拟销售数据。
- WooCommerce 商品、基础库存和近 30 天订单只读同步，失败不覆盖原数据。
- USD 标准 CSV 导入，按日期和广告名称去重，计算 CTR、CPA、ROAS。
- 图片素材库：PNG/JPEG/WebP，单张 ≤ 4MB，总量 ≤ 24MB。
- OpenAI 文本方案：商品文案、商品图提示词、视频脚本与分镜、广告宣发方案。
- 任务看板、规则复盘、操作记录、JSON 备份与恢复。
- Mac 系统加密凭证存储，凭证不进入导出备份。
- 主要导航及常用控件中英文切换，偏好本地保存；用户内容及部分运营说明保留原文。
- 多语言售后/咨询 AI 草稿：16 种语言及跟随原文，回复正文与内部核查备注分开；仅生成、不发送。
- 完整实施路线见 [PLAN.md](docs/PLAN.md)。

当前**不包含**图片/视频实际生成、平台发布、广告写操作、Codex 执行、自动客服、采购、退款、安全扫描或云端全天任务。界面如实显示这些模块待接入。真实 WooCommerce 和 AI 调用需配置自己的凭证；尚未用真实账户验收。

## Mac 安装与使用

需要 macOS 13 或更新版本。v0.1.1 已在 macOS CI 完成签名完整性、ZIP 解压、实际启动和钥匙串加密往返测试；你的 Mac 首次打开与 Apple 公证仍需另外验证。v0.1.2 继续用同一流程验收。

1. Apple 芯片（M 系列）选择 arm64 ZIP；Intel Mac 选择 x64 ZIP。
2. 解压后将 `Luvtora Operations.app` 拖入“应用程序”，再打开。
3. 本版使用 ad-hoc 签名以保持完整性，尚未使用 Apple Developer ID 签名及公证。如果 macOS 阻止首次打开，在确认下载来源和校验值后使用系统提供的“仍要打开”流程；不需要关闭系统安全保护。
4. 打开“连接与设置”。在 WooCommerce → 设置 → 高级 → REST API 创建**读取**权限密钥，在程序内输入后保存，再点击同步。
5. AI 方案需要你自己的 OpenAI API 密钥与可用额度。ChatGPT 订阅不包含 API 使用费。密钥只输入到程序，不要发送到聊天。
6. 广告分析下载 CSV 模板后填入实际数据；Meta 原始导出需要转换列名及口径。同名广告组应使用唯一广告名称或 ID。
7. 右上角选择界面语言。“多语言客服”选择来源和回复语言，粘贴去除敏感信息的咨询及已核实事实；生成并审核草稿后，可复制回复正文到对应渠道。本版本未实际连接社媒收件箱或自动发送。

数据保存在 macOS 的 Electron `userData` 目录，通常是 `~/Library/Application Support/luvtora-operations`。以系统实际路径为准。JSON 备份含经营数据及图片，请安全保存。恢复会替换当前数据，建议先导出备份；同站点恢复不改变本机密钥；跨站点恢复会清除旧店铺密钥，防止凭证发往其他站点。

关闭程序后本地任务不继续运行。本版本所有同步、方案和复盘都由用户手动触发，没有后台自动投放。

## 开发运行

需要 Node.js 24 和 npm。使用现有 checkout，不需要 Git worktree。

```sh
npm ci
node node_modules/electron/install.js
npm run dev
```

开发服务只绑定 `127.0.0.1:4317`。开发模式的凭证只存内存，进程重启后需要重新输入。启动 Electron 桌面窗口：

```sh
npm start
```

如 Electron 二进制尚未安装：`node node_modules/electron/install.js`。Mac 打包：

```sh
npm run dist:mac
```

产物在 `dist/`，生成 Apple Silicon 与 Intel ZIP。发行签名、公证及 Mac 真机验证需在有权限的 macOS 环境完成。首次正式发布前需要添加 Apple 证书与公证配置；当前 `mac.identity: "-"` 生成 ad-hoc 签名试用版本，保持 hardened runtime 并使用 Electron JIT 与 ad-hoc 库加载所需的权限。

## 检查

```sh
npm test
npm run test:ui
```

UI 检查默认使用 Linux `/usr/bin/chromium`。其他机器通过 `LUVTORA_CHROMIUM` 指定 Chromium 可执行文件路径。测试使用隔离的临时目录，不影响经营工作区。

覆盖 CSV 校验与去重、指标口径、同步失败保留数据、凭证不导出、跨站请求拦截、并发写入、备份恢复、重启持久化和真实浏览器操作。外部接口在自动测试中使用替身，不能代替真实账户验证。

## 第一版接口与安全

- 服务仅监听本机；所有 API 需要随机会话令牌，检查 Host 与 Origin。
- Electron 禁用 renderer Node 权限，启用 sandbox/contextIsolation；阻止外部窗口和导航。
- 不执行 AI 返回的代码或 HTML，方案按纯文本展示。
- WooCommerce 凭证通过 HTTPS 请求头发送，DNS 解析固定公网 IPv4，禁止私有地址和重定向，保持 TLS 验证。
- 当前只支持 IPv4 HTTPS 商店；每次同步最多 2,000 个商品和 2,000 个近 30 天订单，超限不会覆盖已有数据。
- 订单摘要不保存客户姓名、地址、邮箱和支付信息。已付订单金额含店铺口径的税运费，未扣退款，不称为净收入或利润。
- AI 请求仅发送品牌、受众、预算、所选商品摘要和任务要求；使用 `store: false`，仍受服务商数据政策约束。
- 无自动 API 费用上限：生成按钮明确提示计费，单次限制输出 tokens，完整费用管理属于后续阶段。

## 结构

`desktop/` Mac 桌面入口与安全凭证存储；`src/` 本地服务、业务规则和外部接口；`ui/` 中文业务界面；`tests/` 自动验证；`docs/` 完整产品计划及验收。
