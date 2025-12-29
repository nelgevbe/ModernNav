# ModernNav - Personal Navigation Dashboard

ModernNav is a modern, minimalist, card-based navigation dashboard featuring a frosted glass (Glassmorphism) aesthetic. It is designed to be a beautiful, customizable browser start page or bookmark manager.

Built with **React**, **Tailwind CSS**, and **Cloudflare Pages** (Functions + D1 Database).

[中文文档](README.md) | [English Documentation](README_en.md)

## ✨ Features

- **🎨 Stunning UI:** Glassmorphism design with adaptive frosted glass effects, smooth animations, and responsive layout.
- **🌓 Dark/Light Mode:** Automatic theme switching with intelligent color extraction from background images.
- **🖱️ Drag & Drop:** Easily reorder categories and links via drag and drop in the settings.
- **🖼️ Customization:** Change background images, adjust blur/opacity levels, and customize theme colors.
- **📂 Grouping:** Organize links into Categories and Sub-categories (Folders).
- **🔍 Aggregated Search:** Integrated search bar supporting Google, Bing, Baidu, GitHub, and more.
- **🔐 Stateless Security:** Implements **Stateless Dual Token Authentication** (HMAC-Signed). Sessions require **zero database writes**, using D1 only for storing the admin code, while maintaining maximum security via HttpOnly Cookies and token rotation against XSS/CSRF.
- **🛡️ Robust Data Handling:** Built-in strict type validation and automatic error recovery prevent application crashes (White Screen of Death) caused by malformed data structure updates.
- **☁️ Smart Hybrid Storage (v2.0):**
  - **Dirty Data Priority (Dirty-First):** Introduces intelligent state tracking. If there are unsynced local changes (Dirty Data), the system enforces the use of local data to prevent overwriting by stale cloud data.
  - **State Persistence:** "Unsynced" status is persisted. Even if you refresh the page or close the browser immediately after making changes, your data remains safe and will automatically retry syncing when online.
  - **Instant Consistency:** Removed server-side caching to ensure every configuration read fetches the latest data from the database, eliminating "reversion" issues.
- **🌍 Internationalization:** Built-in support for English and Chinese (Simplified).
- **💾 Full Backup:** Export your entire configuration (links, background, settings) to JSON and restore anytime.

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS, Lucide React
- **Backend:** Cloudflare Pages Functions (Serverless)
- **Database:** Cloudflare D1 (Serverless SQL Database)
- **Auth:** Stateless JWT (HMAC-SHA256) + HttpOnly Cookie
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
├── functions/api/              # Cloudflare Pages Functions (Backend)
│   ├── auth.ts                 # Auth Endpoint (Login/Refresh/Update)
│   ├── bootstrap.ts            # Bootstrap Endpoint (Read D1)
│   ├── update.ts               # Sync Endpoint (Write D1)
│   └── utils/                  # Backend Utilities (Auth/Validation)
├── src/                        # Frontend Source Code
│   ├── assets/                 # Assets
│   ├── components/             # React UI Components
│   │   ├── settings/           # Settings Modal Components
│   │   │   ├── AppearanceTab.tsx   # Appearance Tab
│   │   │   ├── AuthScreen.tsx      # Auth/Login Screen
│   │   │   ├── ContentTab.tsx      # Content Management Tab
│   │   │   ├── DataTab.tsx         # Data Backup/Restore Tab
│   │   │   └── SecurityTab.tsx     # Security Settings Tab
│   │   ├── CategoryNav.tsx     # Navigation Bar
│   │   ├── GlassCard.tsx       # Glass Effect Card
│   │   ├── IconPicker.tsx      # Icon Selector
│   │   ├── LinkManagerModal.tsx # Settings Modal Container
│   │   ├── SearchBar.tsx       # Search Bar
│   │   ├── SyncIndicator.tsx   # Sync Status Indicator
│   │   └── Toast.tsx           # Toast Notification
│   ├── contexts/               # Global State
│   │   └── LanguageContext.tsx # i18n Context
│   ├── hooks/                  # Custom Hooks
│   │   └── useCategoryDragDrop.ts # Drag & Drop Logic
│   ├── services/               # Services
│   │   └── storage.ts          # Storage & Sync Service (Core)
│   ├── types/                  # TypeScript Types
│   │   └── index.ts            # Type Definitions
│   ├── utils/                  # Frontend Utilities
│   │   └── color.ts            # Color Extraction
│   ├── App.tsx                 # Root Component
│   ├── constants.tsx           # App Constants
│   ├── index.tsx               # Entry Point
│   └── index.css               # Global Styles (Tailwind)
├── index.html                  # HTML Entry
├── vite.config.ts              # Vite Configuration
├── tsconfig.json               # TypeScript Configuration
└── wrangler.toml               # Cloudflare Configuration
```

## 📄 License

MIT License. Feel free to use and modify for personal use.
