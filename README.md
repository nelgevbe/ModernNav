
# ModernNav - 个人导航仪表盘

ModernNav 是一个现代、极简的卡片式导航仪表盘，采用毛玻璃（Glassmorphism）设计风格。它旨在成为一个美观、可高度自定义的浏览器起始页或书签管理器。

本项目基于 **React**、**Tailwind CSS** 和 **Cloudflare Pages** (Functions + KV) 构建。

[English Documentation](README_en.md)

## ✨ 功能特性

*   **🎨 惊艳的 UI 设计:** 采用自适应毛玻璃特效（Glassmorphism），拥有流畅的动画效果和响应式布局。
*   **🌓 深色/浅色模式:** 支持自动主题切换，并能从背景图片中智能提取主色调。
*   **🖱️ 拖拽排序:** 在管理界面通过拖拽轻松调整分类和链接的顺序。
*   **🖼️ 高度个性化:** 支持更换背景图片、调节卡片模糊度和透明度，以及自定义主题颜色。
*   **📂 分组管理:** 支持创建一级分类和二级子菜单（文件夹）来整理链接。
*   **🔍 聚合搜索:** 内置搜索栏，支持 Google、必应、百度、GitHub 等多种搜索引擎切换。
*   **🔐 无状态安全认证:** 采用 **HMAC 签名无状态认证**。登录与会话维持 **零数据库写入**，彻底消除 KV 存储读写消耗，同时保留 HttpOnly Cookie 和短效访问令牌的双重安全机制，全面防止 XSS 与 CSRF 攻击。
*   **🛡️ 数据健壮性保护:** 内置严格的数据类型校验与容错机制，自动修复异常数据结构，杜绝白屏崩溃，确保系统在数据格式升级或异常时依然稳定运行。
*   **☁️ 智能混合存储:**
    *   **读取策略 (网络优先):** 优先获取云端最新数据，网络异常时自动降级读取本地缓存，确保页面秒开且在离线状态下依然可用。
    *   **写入策略 (乐观更新):** 修改配置立即生效，无需等待服务器响应，并在后台静默同步至 Cloudflare KV，提供丝滑流畅的操作体验。
*   **🌍 国际化:** 内置英语和简体中文支持。
*   **💾 全量备份:** 支持将所有数据（分类、链接、背景设置、偏好设置）导出为 JSON 文件，或随时一键恢复。

## 🛠️ 技术栈

*   **前端:** React 19, Vite, Tailwind CSS, Lucide React
*   **后端:** Cloudflare Pages Functions (Serverless 无服务器函数)
*   **数据库:** Cloudflare KV (键值存储)
*   **鉴权:** 无状态 JWT (HMAC-SHA256) + HttpOnly Cookie
*   **语言:** TypeScript

## 🚀 快速开始

### 前置要求

*   Node.js (v18 或更高版本)
*   npm 或 yarn

### 1. 安装依赖

```bash
npm install
```

### 2. 本地开发 (仅前端)

如果您只想修改 UI 界面（数据将存储在 LocalStorage）：

```bash
npm run dev
```

### 3. 本地开发 (全栈 + Cloudflare 模拟)

要在本地测试后端 API 和 KV 存储，您需要安装 `wrangler` CLI 工具。

1.  安装 Wrangler:
    ```bash
    npm install -D wrangler
    ```

2.  运行 Cloudflare Pages 模拟环境:
    ```bash
    npx wrangler pages dev . --kv KV_STORE
    ```
    *这将在本地模拟 Cloudflare 的运行环境，支持 Cookie 和 KV 操作。*

## 📦 部署指南 (Cloudflare Pages)

本项目专为 **Cloudflare Pages** 优化。

### 第一步: 推送到 Git
将此仓库Fork到您的 GitHub 或 GitLab 仓库。

### 第二步: 创建 Cloudflare 项目
1.  登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2.  进入 **Workers & Pages** > **Overview** > **Create Application** > **Pages** > **Connect to Git**。
3.  选择您的代码仓库。

### 第三步: 构建设置 (Build Settings)
*   **Framework preset (框架预设):** 选择 `无`
*   **Build command (构建命令):** `npm run build`
*   **Build output directory (输出目录):** `dist`

### 第四步: 配置数据库 (KV)
1.  项目创建完成后，在 Cloudflare侧边栏点击 **Workers & Pages** > **KV**。
2.  点击 **Create a Namespace** 创建一个命名空间 (例如命名为 `modern-nav-db`)。
3.  回到您刚才创建的 Pages 项目页面: 点击 **Settings** > **Functions** > **KV Namespace Bindings**。
4.  添加绑定 (Add binding):
    *   **Variable name (变量名):** 必须填写 `KV_STORE` (必须完全一致)。
    *   **KV Namespace:** 选择您刚才创建的命名空间。
5.  **保存** 并 **重新部署** (进入 Deployments > 点击最新部署右侧的三个点 > Retry deployment)。

## ⚙️ 配置与使用

### 初始化设置
1.  打开部署好的网站。
2.  点击右上角的 **设置 (齿轮图标)**。
3.  输入默认访问代码: `admin`。
4.  **重要提示:** 请立即进入 "安全设置 (Security)" 选项卡修改您的访问代码。

### 个性化
*   **内容管理:** 在 "内容管理" 标签页添加分类、子菜单和链接，支持拖拽排序。
*   **外观设置:** 在 "外观设置" 标签页更改背景图片 URL 和调节卡片透明度。

## 📂 项目结构

```
├── components/        # React UI 组件 (GlassCard, SearchBar, LinkManagerModal 等)
├── contexts/          # React Context (语言状态管理)
├── functions/api/     # Cloudflare Pages Functions (后端 API)
│   ├── bootstrap.ts   # 初始化数据加载
│   ├── update.ts      # 数据保存 (需 Bearer Token)
│   └── auth.ts        # 鉴权逻辑 (无状态签名验证)
├── services/          # 数据服务层 (处理 Token 刷新、拦截器、同步逻辑)
├── types.ts           # TypeScript 类型定义
├── App.tsx            # 主应用逻辑
└── index.html         # 入口文件及 Tailwind 配置
```

## 📄 许可证

MIT License. 供个人免费使用和修改。
