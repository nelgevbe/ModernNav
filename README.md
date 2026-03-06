# ModernNav - 个人导航仪表盘

ModernNav 是一个现代、极简的卡片式导航仪表盘，采用毛玻璃（Glassmorphism）设计风格。它旨在成为一个美观、可高度自定义的浏览器起始页或书签管理器。

本项目基于 **React**、**Tailwind CSS** 和 **Cloudflare Pages** (Functions + D1 Database) 构建。

[English Documentation](README_en.md) | [中文文档](README.md)

## ✨ 功能特性

- **🎨 现代卡片 UI (v3.2):** 支持背景预览与实时配置预览，适配磨砂玻璃特效，并针对 2K/4K 高分屏进行视口动态缩放优化。
- **🖱️ 增强型交互 (v3.2):** 卡片支持原生 `<a>` 标签连接，完美支持鼠标中键后台打开及原生右键菜单，支持文字选中。
- **⚙️ 全局设置中心 (v3.1):** 统一管理站点标题、图标 API 和页脚链接。
- **🧩 动态页脚系统 (v3.1):** 支持自定义 GitHub 链接与多条友情链接。
- **🌐 自定义图标 API (v3.1):** 配置 Favicon 抓取服务（如 Google, favicon.im 等），支持 `{domain}` 占位符。
- **📐 灵活布局配置 (v3.0):** 支持调节卡片宽高、画布宽度、网格列数以及卡片透明度。
- **🔌 逻辑化钩子管理 (v3.0):** 业务逻辑整理至 `useDashboardLogic` Hook。
- **🌓 智能色彩提取:** 支持自动主题切换，并能从背景图片中提取主色调。
- **📏 视口感知缩放 (New):** 自动感知视口宽度，同步缩放搜索框、图标与文字，确保高分辨率下的视觉一致性。
- **🖱️ 拖拽排序:** 支持鼠标拖拽调整分类和链接顺序。
- **🖼️ 高度个性化:** 自定义卡片规格、背景样式及主题细节。
- **🌍 国际化 & 文案支持:** 内置中英文文案支持，覆盖所有配置项。
- **⚡ 轻量化状态提示:** 纯文字浮动提示，减少视觉干扰。
- **🔐 增强型安全认证 (v2.1):** 统一 API 客户端，支持 HttpOnly Cookie 无感刷新与 CSRF 防御。
- **☁️ 智能混合存储 (v2.0):** 采用“脏数据优先”策略与状态持久化机制，解决数据覆盖与丢失问题。
- **💾 全量备份:** 支持数据一键导入/导出。

## 🛠️ 技术栈

- **前端:** React 19, Vite, Tailwind CSS, Lucide React
- **后端:** Cloudflare Pages Functions (Serverless)
- **数据库:** Cloudflare D1 (Serverless SQL Database)
- **鉴权 & 请求:** Unified API Client + Silent Refresh (JWT HMAC-SHA256)
- **语言:** TypeScript

## 🚀 快速开始

### 前置要求

- Node.js (v18 或更高版本)
- npm 或 yarn

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

要在本地测试后端 API 和 D1 存储，您需要安装 `wrangler` CLI 工具。

1.  安装 Wrangler:

    ```bash
    npm install -D wrangler
    ```

2.  初始化本地数据库表结构:

    ```bash
    npx wrangler d1 execute modern-nav-db --local --file=./schema.sql
    ```

3.  运行 Cloudflare Pages 模拟环境:
    ```bash
    npx wrangler pages dev . --d1 DB=modern-nav-db
    ```
    _这将在本地模拟 Cloudflare 的运行环境。_

## 📦 部署指南 (Cloudflare Pages)

本项目专为 **Cloudflare Pages** 优化。

### 第一步: 推送到 Git

将此仓库 Fork 到您的 GitHub 或 GitLab 仓库。

### 第二步: 创建 Cloudflare 项目

1.  登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2.  进入 **Workers & Pages** > **Overview** > **Create Application** > **Pages** > **Connect to Git**。
3.  选择您的代码仓库。

### 第三步: 构建设置 (Build Settings)

- **Framework preset (框架预设):** 选择 `无`
- **Build command (构建命令):** `npm run build`
- **Build output directory (输出目录):** `dist`

### 第四步: 配置数据库 (D1)

1.  项目创建完成后，在 Cloudflare 侧边栏点击 **Workers & Pages** > **D1 SQL Database**。
2.  点击 **Create** 创建一个数据库 (例如命名为 `modern-nav-db`)。
3.  点击进入该数据库，选择 **Console** 标签页。
4.  **重要:** 打开项目中的 `schema.sql` 文件，复制其中的 SQL 语句并在 Console 中 **Execute**，以初始化表结构和默认密码。
5.  回到您刚才创建的 Pages 项目页面: 点击 **Settings** > **Functions** > **D1 Database Bindings**。
6.  添加绑定 (Add binding):
    - **Variable name (变量名):** 必须填写 `DB` (必须完全一致)。
    - **D1 Database:** 选择您刚才创建的 `modern-nav-db`。
7.  **保存** 并 **重新部署** (进入 Deployments > 点击最新部署右侧的三个点 > Retry deployment)。

## ⚙️ 配置与使用

### 初始化设置

1.  打开部署好的网站。
2.  点击右上角的 **设置 (齿轮图标)**。
3.  输入默认访问代码: `admin`。
4.  **重要提示:** 请立即进入 "安全设置 (Security)" 选项卡修改您的访问代码。

### 个性化

- **内容管理:** 在 "内容管理" 标签页添加分类、子菜单和链接，支持拖拽排序。
- **外观设置:** 在 "外观设置" 标签页更改背景图片 URL 和调节卡片透明度。

## 📂 项目结构

```text
├── public/                     # 静态资源
│   ├── favicon.svg             # 站点图标
│   └── fonts/                  # 字体文件
├── functions/api/              # Cloudflare Pages Functions (后端 API)
│   ├── auth.ts                 # 鉴权接口 (登录/刷新/修改密码)
│   ├── bootstrap.ts            # 初始化数据接口 (Read D1)
│   ├── health.ts               # 健康检查接口
│   ├── update.ts               # 数据同步接口 (Write D1)
│   └── utils/                  # 后端工具函数 (鉴权/验证/日志)
├── src/                        # 前端源代码
│   ├── assets/                 # 静态资源引用
│   ├── components/             # React UI 组件
│   │   ├── settings/           # 设置模态框组件
│   │   │   ├── AppearanceTab.tsx   # 外观设置页
│   │   │   ├── AuthScreen.tsx      # 认证/登录页
│   │   │   ├── ContentTab.tsx      # 内容管理页
│   │   │   ├── DataTab.tsx         # 数据备份/恢复页
│   │   │   ├── GeneralTab.tsx      # 全局设置页
│   │   │   └── SecurityTab.tsx     # 安全设置页
│   │   ├── BackgroundLayer.tsx # 沉浸式背景渲染
│   │   ├── CategoryNav.tsx     # 侧边/顶部导航栏
│   │   ├── Footer.tsx          # 响应式页脚
│   │   ├── GlassCard.tsx       # 毛玻璃卡片组件
│   │   ├── IconPicker.tsx      # 图标选择组件
│   │   ├── LinkManagerModal.tsx # 设置弹窗容器
│   │   ├── SearchBar.tsx       # 聚合搜索组件
│   │   ├── SkeletonLoader.tsx  # 语义化骨架屏
│   │   ├── SmartIcon.tsx       # 智能图标捕获
│   │   ├── SyncIndicator.tsx   # 同步状态指示器
│   │   └── Toast.tsx           # 全局提示组件
│   ├── contexts/               # 全局状态管理
│   │   └── LanguageContext.tsx # 多语言 Context
│   ├── hooks/                  # 自定义 Hooks
│   │   ├── useDashboardLogic.ts # 核心业务逻辑 (状态/同步/更新)
│   │   ├── useCategoryDragDrop.ts # 拖拽排序逻辑
│   │   ├── useViewportScale.ts # 视口自适应缩放
│   │   └── useResponsiveColumns.ts # 响应式网格列数计算
│   ├── services/               # 业务服务层
│   │   ├── apiClient.ts        # 统一 API 客户端 (认证/拦截/重试)
│   │   └── storage.ts          # 数据存储与同步服务 (核心逻辑)
│   ├── types/                  # TypeScript 类型定义
│   │   └── index.ts            # 类型声明入口
│   ├── utils/                  # 前端工具函数
│   │   ├── color.ts            # 颜色提取工具
│   │   └── favicon.ts          # 图标生成工具
│   ├── App.tsx                 # 应用根组件
│   ├── constants.tsx           # 常量配置
│   ├── index.tsx               # 应用入口文件
│   └── index.css               # 全局样式 (Tailwind)
├── index.html                  # HTML 模板
├── vite.config.ts              # Vite 构建配置
├── tsconfig.json               # TypeScript 配置
└── wrangler.toml               # Cloudflare Pages 配置
```

## 📄 许可证

MIT License. 供个人免费使用和修改。
