# ModernNav - Personal Navigation Dashboard

ModernNav is a modern, minimalist, card-based navigation dashboard featuring a frosted glass (Glassmorphism) aesthetic. It is designed to be a beautiful, customizable browser start page or bookmark manager.

Built with **React**, **Tailwind CSS**, and **Cloudflare Pages** (Functions + D1 Database).

[中文文档](README.md) | [English Documentation](README_en.md)

## ✨ Features

- **🎨 Modern Card UI:** Supports background preview and real-time configuration preview with frosted glass effects. Optimized for 2K/4K high-res displays with dynamic viewport scaling.
- **🗂️ Routed Admin Panel:** Dedicated `/admin` routes with a unified shell + tab navigation. Every settings page is built on shared layout primitives (Container/Section/Row) for a consistent look.
- **🌗 Site-wide Light/Dark Theme:** A design-token system scoped via `theme-light` / `theme-dark`, shared by both frontend and admin, so theme switching takes effect instantly everywhere.
- **🎯 Global Theme Color:** The theme color is written to CSS variables via `useThemeColor`, so all frontend/admin components respond instantly once saved.
- **🖱️ Enhanced Interaction:** Cards use native `<a>` tags, providing full support for middle-click opening, native context menus, and text selection.
- **⚙️ Global Configuration:** "General" tab to manage site title, Favicon API, and footer links.
- **🧩 Dynamic Footer System:** Supports custom GitHub links and multiple friendship links.
- **🌐 Custom Favicon API:** Configure Favicon fetching services (e.g., Google, favicon.im) with `{domain}` placeholder.
- **📐 Flexible Layout Settings:** Adjust card dimensions, canvas width, grid columns, and card opacity.
- **🔌 Logical Hook Management:** Business logic managed via the `useDashboardLogic` hook.
- **🌓 Intelligent Color Extraction:** Supports automatic theme switching and extracts dominant colors from backgrounds.
- **📏 Viewport-Aware Scaling:** Dynamic root `font-size` based responsive scaling system, automatically adapting both frontend and modal components for high-resolution displays.
- **🔄 Smart Icon Fallback:** Automatically falls back to alternative APIs (vemetric.com, Google, DuckDuckGo) when the default favicon API fails, ensuring icons always load.
- **⚡ PWA Runtime Caching:** Intelligent caching for favicons, images, and API responses for faster repeat visits.
- **🖱️ Drag & Drop:** Reorder categories and links via drag-and-drop.
- **🖼️ High Personalization:** Customize card specifications, background styles, and theme details.
- **🌍 I18n & Copy Support:** Built-in support for English and Chinese copy across all settings.
- **⚡ Lightweight Status Indicators:** Text-only floating notifications to reduce visual noise.
- **🔐 Enhanced Security:** Unified API client with HttpOnly Cookie silent refresh and CSRF protection.
- **☁️ Smart Hybrid Storage:** Features a "Dirty-First" strategy and state persistence to prevent data loss.
- **💾 Full Backup:** One-click data export and restore for total control.

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS, Lucide React
- **Data Layer:** TanStack Query (with LocalStorage persistence + optimistic updates)
- **Backend:** Cloudflare Pages Functions (Serverless)
- **Database:** Cloudflare D1 (relational schema v2: categories / subcategories / links + config KV)
- **Auth & Requests:** Unified API Client + Silent Refresh (JWT HMAC-SHA256)
- **Language:** TypeScript

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn

### 1. Installation

```bash
npm install
```

### 2. Local Development (Frontend Only)

If you only want to work on the UI (uses LocalStorage):

```bash
npm run dev
```

### 3. Local Development (Full Stack with Cloudflare)

To test the Backend API and D1 storage locally, you need `wrangler`.

1.  Install Wrangler:

    ```bash
    npm install -D wrangler
    ```

2.  Initialize local database schema:

    ```bash
    npx wrangler d1 execute modern-nav-db --local --file=./schema.sql
    ```

3.  Run the Cloudflare Pages simulation:
    ```bash
    npx wrangler pages dev . --d1 DB=modern-nav-db
    ```
    _This simulates the Cloudflare environment locally._

## 📦 Deployment (Cloudflare Pages)

This project is optimized for **Cloudflare Pages**.

### Step 1: Push to Git

Push this code to your GitHub or GitLab repository.

### Step 2: Create Cloudflare Project

1.  Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2.  Go to **Workers & Pages** > **Overview** > **Create Application** > **Pages** > **Connect to Git**.
3.  Select your repository.

### Step 3: Build Settings

- **Framework preset:** `None`
- **Build command:** `npm run build`
- **Build output directory:** `dist`

### Step 4: Configure Database (D1)

1.  After the project is created, go to **Workers & Pages** > **D1**.
2.  Click **Create** to create a database (e.g., `modern-nav-db`).
3.  Go to the database **Console** tab.
4.  Open `schema.sql` in your project, copy the content, paste it into the console, and click **Execute**.
5.  Go back to your Pages project settings: **Settings** > **Functions** > **D1 Database Bindings**.
6.  Add a binding:
    - **Variable name:** `DB` (Must be exact)
    - **D1 Database:** Select the namespace you created.
7.  **Save** and **Redeploy** (Go to Deployments > Retry deployment).

> **Upgrading from a previous version (schema v1 → v2):** No manual steps. On the first request after deployment, the backend detects `schema_version` and fans the legacy JSON blob out into the new relational tables atomically inside a D1 batch. Take a backup first with `npx wrangler d1 export modern-nav-db --output=backup.sql` if you have important data.

## ⚙️ Configuration & Usage

### Initial Setup

1.  Open your deployed site.
2.  Click the **Settings (Gear Icon)** in the top right.
3.  Enter the default access code: `admin`.
4.  **Important:** Go to the "Security" tab immediately and change your access code.

### Customization

- **Content:** Add categories, sub-menus, and links in the "Content" tab. Reorder them using drag and drop.
- **Appearance:** Change the background URL and adjust card opacity in the "Appearance" tab.

## 📂 Project Structure

```text
├── public/                     # Static Assets
│   ├── favicon.svg             # Favicon
│   └── fonts/                  # Local Fonts
├── functions/api/              # Cloudflare Pages Functions (Backend API)
│   ├── auth.ts                 # Auth Endpoint (Login/Refresh/Update)
│   ├── bootstrap.ts            # Bootstrap Endpoint (Read D1 + auto schema migration)
│   ├── health.ts               # Health Check Endpoint
│   ├── update.ts               # Sync Endpoint (Write D1)
│   └── utils/                  # Backend Utilities
│       ├── authHelpers.ts      # JWT / Cookie / rate limiting
│       ├── dbHelpers.ts        # D1 schema bootstrap + v1→v2 migration + relational R/W
│       ├── logger.ts           # Logging
│       └── validation.ts       # Input validation
├── src/                        # Frontend Source Code
│   ├── assets/                 # Assets
│   ├── components/             # React UI Components
│   │   ├── admin/              # Routed admin panel (replaces the old settings modal)
│   │   │   ├── AdminLayout.tsx     # Admin shell (top nav + theme scope)
│   │   │   ├── AdminGuard.tsx      # Auth route guard
│   │   │   ├── AdminAuthPage.tsx   # Admin login page
│   │   │   ├── ContentPage.tsx     # Content management (data wiring)
│   │   │   ├── GeneralPage.tsx     # General settings (data wiring)
│   │   │   ├── AppearancePage.tsx  # Appearance settings (data wiring)
│   │   │   ├── DataPage.tsx        # Data backup (data wiring)
│   │   │   └── SecurityPage.tsx    # Security settings (data wiring)
│   │   ├── settings/           # Settings UI (assembled by admin pages)
│   │   │   ├── SettingsPrimitives.tsx # Shared layout primitives (Container/Section/Row)
│   │   │   ├── AppearanceTab.tsx   # Appearance UI
│   │   │   ├── ContentTab.tsx      # Content management UI (split-pane card)
│   │   │   ├── DataTab.tsx         # Data backup/restore UI
│   │   │   ├── GeneralTab.tsx      # General settings UI
│   │   │   └── SecurityTab.tsx     # Security settings UI
│   │   ├── BackgroundLayer.tsx # Immersive Background Rendering
│   │   ├── CategoryNav.tsx     # Navigation Bar
│   │   ├── Footer.tsx          # Responsive Footer
│   │   ├── GlassCard.tsx       # Glass Effect Card
│   │   ├── IconPicker.tsx      # Icon Selector
│   │   ├── SearchBar.tsx       # Search Bar
│   │   ├── SkeletonLoader.tsx  # Semantic Skeleton Loader
│   │   ├── SmartIcon.tsx       # Intelligent Icon (Auto-scale/Fallback)
│   │   ├── SyncIndicator.tsx   # Sync Status Indicator
│   │   └── Toast.tsx           # Toast Notification
│   ├── contexts/               # Global State
│   │   └── LanguageContext.tsx # i18n Context
│   ├── hooks/                  # Custom Hooks
│   │   ├── useDashboardLogic.ts # Core Business Logic (State/Sync/Updates)
│   │   ├── useAuth.ts          # Auth-state query
│   │   ├── useThemeColor.ts    # Global theme-color application (writes CSS vars, site-wide)
│   │   ├── useCategoryDragDrop.ts # Drag & Drop Logic
│   │   ├── useViewportScale.ts # Viewport adaptive scaling
│   │   └── useResponsiveColumns.ts # Responsive grid columns calculation
│   ├── services/               # Services layer
│   │   ├── apiClient.ts        # Unified API Client (Auth/Intercept/Retry)
│   │   ├── queries.ts          # TanStack Query hooks (bootstrap/categories/background/prefs)
│   │   └── storage.ts          # Local cache + notifications + import/export
│   ├── types/                  # TypeScript Types
│   │   └── index.ts            # Type Definitions
│   ├── utils/                  # Frontend Utilities
│   │   ├── color.ts            # Color Extraction
│   │   └── favicon.ts          # Favicon Generation & Fallback
│   ├── constants/              # Constants
│   │   └── defaults.ts         # Unified Default Values
│   ├── App.tsx                 # Root Component
│   ├── constants.tsx           # Constants Entry
│   ├── index.tsx               # Entry Point
│   └── index.css               # Global Styles (Tailwind + theme tokens + light/dark scopes)
├── index.html                  # HTML Entry
├── vite.config.ts              # Vite Configuration
├── tsconfig.json               # TypeScript Configuration
└── wrangler.toml               # Cloudflare Configuration
```

## 📄 License

MIT License. Feel free to use and modify for personal use.
