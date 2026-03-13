# Web to Figma

> 网页秒变设计稿，一键导入 Figma

将任意网页转换为可编辑的 Figma 设计稿，复制粘贴即可。

## 功能特性

- **一键采集** — 点击按钮，选择采集整页或指定元素
- **直接粘贴** — 采集结果自动复制，在 Figma 中粘贴即可
- **图片代理** — 支持跨域图片抓取，避免资源丢失
- **并发控制** — 可调节图片下载速度
- **动态加载** — 使用 Figma 官方 API，无需本地混淆代码

## 技术实现

本插件使用 Figma 官方的 HTML to Design API：
- 动态加载 Figma 官方的 capture.js（https://mcp.figma.com/mcp/html-to-design/capture.js）
- 避免在插件包中包含混淆代码，符合 Chrome Web Store 政策
- 所有自定义代码都清晰可读

## 安装

### 从 Chrome Web Store 安装

> 即将上线

### 本地安装

1. 下载本仓库
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启右上角的 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择项目文件夹

## 使用方法

1. 打开想要转换的网页
2. 点击工具栏中的扩展图标
3. （可选）开启图片代理、调整并发数
4. 点击 **开始采集**
5. 在页面工具栏中选择采集模式：
   - **Entire Screen** — 采集整个页面
   - **Select Element** — 选择特定元素
6. 采集完成后自动复制到剪贴板
7. 打开 Figma，按 `Ctrl/Cmd + V` 粘贴

## 隐私说明

- 所有数据本地处理，不上传任何服务器
- 不收集个人信息或浏览数据
- 仅在用户主动点击时执行

## 作者

**板栗alive** — [@SGloria](https://github.com/SGloria)

## 致谢

感谢 **白老师** ([@yuqibai88](https://github.com/yuqibai88)) 设计的简约 Logo，让这个小工具更加完整！

## License

MIT License
