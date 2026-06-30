# ModernNav

个人导航仪表盘，玻璃拟态风格。基于 React + Tailwind CSS + Cloudflare Pages (Functions + D1)。

[English](README_en.md) | 中文

## 功能

- **玻璃拟态卡片** — 实时模糊/饱和度/边缘光物理引擎，自适应明暗主题
- **明暗主题** — Tailwind `dark:` 变体 + CSS 变量 token，全站即时切换
- **全局主题色** — 一键换色，前台/后台所有组件即时响应
- **视口缩放** — 1080p / 2K / 4K 自动适配，所有尺寸按比例缩放
- **路由式后台** — `/admin` 独立后台，内容 / 全局 / 外观 / 数据 / 安全五个面板
- **关系化存储** — D1 分表 (categories / subcategories / links) + config KV，v1→v2 自动迁移
- **Diff 写入** — 只发变更部分，一次 D1 batch 事务完成
- **安全认证** — JWT HMAC-SHA256 + HttpOnly Cookie 静默刷新 + IP 级限流
- **离线优先** — TanStack Query + LocalStorage placeholderData，无网可用
- **搜索栏** — 多引擎聚合搜索，下拉切换
- **拖拽排序** — 分类和链接均支持拖拽
- **PWA 缓存** — favicon / 图片 / API 响应运行时缓存
- **图标降级** — 多级 favicon API 自动回退 (favicon.im → Google → DuckDuckGo)
- **中英双语** — `locales/{en,zh}.json`，一键切换
- **数据备份** — 一键导入 / 导出全量数据

## 技术栈

| 层     | 技术                                                         |
| ------ | ------------------------------------------------------------ |
| 前端   | React 18 · Vite 5 · Tailwind 3 · TypeScript 5 · Lucide React |
| 数据层 | TanStack Query v5 · LocalStorage 持久化 · 乐观更新           |
| 后端   | Cloudflare Pages Functions                                   |
| 数据库 | Cloudflare D1 (SQLite)                                       |
| 认证   | JWT HMAC-SHA256 · HttpOnly Cookie                            |
| 工程   | ESLint · Prettier · Vitest · PWA (vite-plugin-pwa)           |

## 快速开始

### 前置要求

- Node.js >= 18
- npm

### 安装

```bash
npm install
```

### 本地开发（仅前端）

数据存储在 LocalStorage，无需后端：

```bash
npm run dev
```

### 全栈开发（含 D1）

```bash
# 初始化本地数据库
npx wrangler d1 execute modern-nav-db --local --file=./schema.sql

# 启动 Cloudflare Pages 模拟
npx wrangler pages dev ./dist
```

### 常用命令

```bash
npm run build          # 生产构建
npm run typecheck      # TypeScript 类型检查（前端 + Functions）
npm run lint           # ESLint
npm run test           # Vitest 单元测试
npm run test:watch     # 测试监听模式
```

## 部署 (Cloudflare Pages)

只需一个免费的 Cloudflare 账号，几分钟即可上线。

### 1. Fork 仓库

将本仓库 Fork 到你的 GitHub 账号下。

### 2. 创建 Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左侧导航找到 **Workers & Pages** → 点击 **Create** → 选择 **Pages** → **Connect to Git**
3. 选择你刚才 Fork 的仓库，填写构建配置：
   - **Framework preset:** `无`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. 点击 **Save and Deploy**，等待首次构建完成

### 3. 创建并绑定数据库

1. 回到 Cloudflare Dashboard，左侧导航找到 **D1 SQL Database** → 点击 **Create**
2. 数据库名称填 `modern-nav-db`，点击创建
3. 进入数据库页面，切换到 **Console** 标签
4. 打开项目中的 `schema.sql` 文件，复制全部内容粘贴到 Console 中，点击 **Execute**
5. 回到你的 Pages 项目 → **Settings** → **Functions** → 找到 **D1 Database Bindings**
6. 添加绑定：
   - Variable name 填 `DB`（必须完全一致）
   - D1 Database 选择 `modern-nav-db`
7. 保存后，进入 **Deployments** → 点击最新部署右侧的 **⋯** → **Retry deployment** 重新部署

### 4. 开始使用

1. 部署完成后访问你的站点地址（`xxx.pages.dev`）
2. 点击导航栏右侧的齿轮图标进入后台
3. 输入默认密码 `admin` 登录
4. **第一件事**：进入「安全设置」修改默认密码

> **从旧版升级？** 无需手动操作。部署新代码后首次访问会自动检测 schema 版本并完成迁移，数据不会丢失。建议升级前在 D1 控制台导出一份备份。

## 项目结构

```
functions/api/                          # Cloudflare Pages Functions
├── auth.ts                             # 登录 / 刷新 / 改密
├── bootstrap.ts                        # 初始化数据 + 自动迁移
├── health.ts                           # 健康检查
├── update.ts                           # 数据写入（diff-based）
└── utils/
    ├── schema.ts                       # DDL + schema 版本管理
    ├── migration.ts                    # v1 → v2 迁移
    ├── diff.ts                         # 分类差异计算 + 应用
    ├── reads.ts                        # D1 读取 + bootstrap 组装
    ├── writes.ts                       # 全量写入（仅迁移用）
    ├── authHelpers.ts                  # JWT / Cookie / 限流
    ├── validation.ts                   # 数据校验
    └── logger.ts                       # 日志

src/
├── components/
│   ├── admin/                          # 后台路由页
│   │   ├── AdminLayout.tsx             # 后台外壳（顶栏 + 主题）
│   │   ├── AdminGuard.tsx              # 登录态路由守卫
│   │   ├── AdminAuthPage.tsx           # 登录页
│   │   ├── ContentPage.tsx             # 内容管理
│   │   ├── GeneralPage.tsx             # 全局设置
│   │   ├── AppearancePage.tsx          # 外观设置
│   │   ├── DataPage.tsx                # 数据备份
│   │   └── SecurityPage.tsx            # 安全设置
│   ├── settings/                       # 设置面板 UI
│   │   ├── SettingsPrimitives.tsx      # 共享布局原语
│   │   ├── ContentTab.tsx              # 内容管理 UI（数据装配）
│   │   ├── CategorySidebar.tsx         # 分类侧栏
│   │   ├── SubcategoryPanel.tsx        # 子分类面板
│   │   ├── LinkCard.tsx                # 链接卡片
│   │   ├── LinkForm.tsx                # 链接表单
│   │   ├── useContentEditor.ts         # 内容编辑逻辑
│   │   ├── AppearanceTab.tsx           # 外观设置 UI
│   │   ├── GeneralTab.tsx              # 全局设置 UI
│   │   ├── DataTab.tsx                 # 数据备份 UI
│   │   └── SecurityTab.tsx             # 安全设置 UI
│   ├── BackgroundLayer.tsx             # 背景渲染
│   ├── CategoryNav.tsx                 # 导航栏（桌面岛 + 移动抽屉）
│   ├── GlassCard.tsx                   # 玻璃卡片组件
│   ├── SearchBar.tsx                   # 聚合搜索
│   ├── SmartIcon.tsx                   # 图标（缩放 + 降级）
│   ├── Footer.tsx                      # 页脚
│   ├── SkeletonLoader.tsx              # 骨架屏
│   ├── SyncIndicator.tsx               # 同步状态
│   ├── IconPicker.tsx                  # 图标选择
│   └── Toast.tsx                       # 全局提示
├── hooks/
│   ├── useDashboardLogic.ts            # 核心业务逻辑
│   ├── useThemeColor.ts                # 主题色 + dark class 管理
│   ├── useViewportScale.ts             # 视口缩放因子
│   ├── useResponsiveColumns.ts         # 响应式列数
│   ├── useCategoryDragDrop.ts          # 拖拽排序
│   └── useAuth.ts                      # 登录态
├── services/
│   ├── apiClient.ts                    # API 客户端（拦截 / 重试 / 静默刷新）
│   ├── queries.ts                      # TanStack Query hooks
│   └── storage.ts                      # LocalStorage 读写 + 导入导出
├── contexts/
│   └── LanguageContext.tsx             # 多语言 Context
├── locales/                            # 翻译字典
│   ├── en.json
│   └── zh.json
├── constants/
│   └── defaults.ts                     # 默认值常量
├── types/
│   └── index.ts                        # TypeScript 类型
├── utils/
│   ├── color.ts                        # 颜色提取
│   └── favicon.ts                      # Favicon URL 生成
├── App.tsx                             # 根组件
├── constants.tsx                       # 搜索引擎等常量
├── index.tsx                           # 入口（路由 + React.lazy 分包）
└── index.css                           # 全局样式 + 主题 token
```

## License

MIT
