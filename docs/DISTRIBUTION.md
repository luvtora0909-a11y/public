# 可下载的 GitHub 交付入口

此前 `/workspace/public/dist/...` 是云机器上的路径，不是互联网下载地址。不能把它当作已经发布的用户下载链接。

## 已准备的交付方式

`.github/workflows/mac-release.yml` 提供手动触发的 Mac 构建：

1. 源码上传到用户授权的 GitHub 仓库。
2. 在仓库 Actions 中选择 **Build Mac installers**，点击 **Run workflow**。
3. 成功后，在该运行页面的 Artifacts 下载 **luvtora-mac-installers**。下载通常需要登录有仓库访问权限的 GitHub 账户，有效期为 30 天。
4. 同一流程创建一个 **draft release**，附上两种架构的 ZIP 和校验码。草稿只对有权限的用户可见。
5. 用户检查后发布该 Release，即可使用 GitHub 实际生成的安装包下载链接。能否匿名下载取决于仓库可见性；私有仓库下载仍需要权限。

工作流仅 `workflow_dispatch` 手动触发，不会因普通 push 自动创建发行版。正式发布与源码上传均需用户授权。工作流自身使用 GitHub 提供的短期 token，不需要用户把密钥发到聊天。

当前仍未上传源码、运行 GitHub Actions 或发布 Release。工作流配置已准备，尚未在 GitHub 执行验证。真实下载 URL 只能在上传成功后确认，不能提前编造。

## 网络与权限限制

当前环境的 Git HTTPS 只读访问已验证。该结果不证明 push 或 Release API 写权限。如果用户授权后写操作受限，需要通过平台支持的仓库连接授权完成，不能要求用户在聊天提供 token。
