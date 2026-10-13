# Luvtora Operations v0.1.2 — Mac 试用版

需要 macOS 13 或更新版本。

- Apple 芯片（M 系列）：下载名称带 arm64 的 ZIP。
- Intel：下载名称不带 arm64 的 Mac ZIP。
- 解压后将 Luvtora Operations.app 放入“应用程序”。
- 本版修复旧包未重新签名的问题，使用 ad-hoc 签名，并在 macOS CI 验证包签名与实际启动。当前仍未使用 Apple Developer ID 签名及公证。确认来源后使用 macOS 的首次打开流程，不要关闭系统安全保护。

功能包含：WooCommerce 只读同步接口、广告 CSV 分析、图片素材管理、OpenAI 文字方案接口、运营任务、规则复盘、备份与恢复。

新增：主要导航与常用控件中英文切换；多语言售后/咨询草稿。支持跟随客户语言或选择英语、简体/繁体中文、西班牙语、法语、德语、葡萄牙语、意大利语、日语、韩语、阿拉伯语、印地语、泰语、越南语、俄语、乌克兰语。原文、经营内容及部分运营说明不会自动翻译。

客服需要配置 OpenAI API，仅生成可审核草稿。Instagram、Facebook Messenger、WhatsApp、TikTok、Pinterest、YouTube、X、邮件和网站渠道目前仅作为来源分类，尚未实际连接消息接口，不自动发送回复。请移除敏感信息后再提交给 AI；订单事实、退款承诺与身份核验需要人工确认。

真实 WooCommerce / OpenAI 账户仍需在程序内配置并验证；密钥不要发到聊天。实际图片/视频生成、自动投放、社媒发布、客服物流与全天云端执行尚未实现。完整范围见 docs/PLAN.md。

请对照 SHA256SUMS.txt 检查下载文件。核心业务和浏览器测试通过不等于 Mac 真机与钥匙串验收完成。
