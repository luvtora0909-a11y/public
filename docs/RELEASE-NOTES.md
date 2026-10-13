# Luvtora Operations v0.1.1 — Mac 试用版

需要 macOS 13 或更新版本。

- Apple 芯片（M 系列）：下载名称带 arm64 的 ZIP。
- Intel：下载名称不带 arm64 的 Mac ZIP。
- 解压后将 Luvtora Operations.app 放入“应用程序”。
- 本版修复旧包未重新签名的问题，使用 ad-hoc 签名，并在 macOS CI 验证包签名与实际启动。当前仍未使用 Apple Developer ID 签名及公证。确认来源后使用 macOS 的首次打开流程，不要关闭系统安全保护。

功能包含：WooCommerce 只读同步接口、广告 CSV 分析、图片素材管理、OpenAI 文字方案接口、运营任务、规则复盘、备份与恢复。

真实 WooCommerce / OpenAI 账户仍需在程序内配置并验证；密钥不要发到聊天。实际图片/视频生成、自动投放、社媒发布、客服物流与全天云端执行尚未实现。完整范围见 docs/PLAN.md。

请对照 SHA256SUMS.txt 检查下载文件。核心业务和浏览器测试通过不等于 Mac 真机与钥匙串验收完成。
