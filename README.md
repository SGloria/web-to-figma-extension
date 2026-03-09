# Web to Figma

> 网页秒变设计稿，一键导入 Figma

一个 Chrome 扩展，可以捕获任意网页的视觉结构（DOM、样式、图片），导出为 JSON 文件，然后导入到 Figma 中生成可编辑的设计稿。

## ✨ 功能特性

- **一键采集** — 点击扩展按钮即可捕获当前网页的完整视觉结构
- **图片代理** — 支持跨域图片抓取，自动将图片转为 Base64 编码
- **并发控制** — 可调节资源下载并发线程数（4/6/8/12/16/20/不限）
- **本地导出** — 采集数据以 JSON 文件保存到本地，不上传任何数据
- **智能滚动** — 自动滚动页面确保懒加载内容被完整捕获
- **字体等待** — 等待页面字体和图片加载完成后再采集，确保还原度

## 📦 安装

### 从 Chrome Web Store 安装

> *即将上线*

### 本地开发安装

1. 克隆本仓库：

```bash
git clone https://github.com/SGloria/web-to-figma-extension.git
```

2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启右上角的 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择项目文件夹

## 🚀 使用方法

1. 打开你想要捕获的网页
2. 点击浏览器工具栏中的 **Web to Figma** 图标
3. （可选）开启 **图片代理** 以抓取跨域图片
4. （可选）调整 **并发线程** 数量
5. 点击 **开始采集**
6. 等待采集完成，选择保存位置，JSON 文件将自动下载
7. 在 Figma 中导入该 JSON 文件即可生成设计稿

## 📁 项目结构

```
web-to-figma-extension/
├── manifest.json      # 扩展清单文件 (Manifest V3)
├── background.js      # Service Worker：消息处理、资源代理、文件下载
├── capture.js         # 注入脚本：捕获页面 DOM 和样式数据
├── runner.js          # 注入脚本：执行采集流程（滚动、等待、采集）
├── panel.html         # 弹出面板 UI
├── panel.js           # 弹出面板逻辑
└── logo/
    ├── logo16.png     # 16x16 图标
    ├── logo48.png     # 48x48 图标
    └── logo128.png    # 128x128 图标
```

## 🔒 权限说明

| 权限 | 用途 |
|------|------|
| `activeTab` | 访问用户当前激活的标签页以捕获网页内容 |
| `scripting` | 将采集脚本注入到目标网页中执行 |
| `downloads` | 将采集结果以 JSON 文件下载到本地 |
| `storage` | 在本地存储用户偏好设置（代理开关、并发数） |
| `host_permissions` | 代理获取网页中引用的跨域图片和字体资源 |

## 🛡️ 隐私说明

- ✅ 所有数据仅在本地处理，**不会上传到任何服务器**
- ✅ 不收集任何个人信息或浏览数据
- ✅ 不包含任何分析、追踪或广告服务
- ✅ 所有脚本均打包在扩展内，不加载任何远程代码
- ✅ 仅在用户主动点击时才执行采集操作

## 🛠️ 技术栈

- Chrome Extension Manifest V3
- Chrome Scripting API
- Chrome Storage API
- Chrome Downloads API
- Vanilla JavaScript（无框架依赖）

## 👤 作者

**板栗alive** — [@SGloria](https://github.com/SGloria)

## 📄 License

MIT License
