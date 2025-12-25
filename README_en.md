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
- **☁️ Smart Hybrid Storage:**
  - **Read Strategy (Network First):** Prioritizes fetching the latest data from the cloud, automatically falling back to local cache if offline, ensuring instant loading and offline availability.
  - **Write Strategy (Optimistic UI):** Changes are applied immediately to the interface without waiting for server response, while silently syncing to Cloudflare D1 in the background for a smooth experience.
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

2.  Initialize local database schema (using the text file):

    ```bash
    npx wrangler d1 execute modern-nav-db --local --file=./schema.txt
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
4.  Open `schema.txt` in your project, copy the content, paste it into the console, and click **Execute**.
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
├── components/                 # React UI Components
│   ├── settings/               # Settings Modal Tabs
│   │   ├── AppearanceTab.tsx   # Appearance settings
│   │   ├── AuthScreen.tsx      # Login/Verification screen
│   │   ├── ContentTab.tsx      # Content management (Categories/Links)
│   │   ├── DataTab.tsx         # Data import/export
│   │   └── SecurityTab.tsx     # Security settings (Change password)
│   ├── CategoryNav.tsx         # Main Navigation Bar
│   ├── GlassCard.tsx           # Frosted Glass Card Component
│   ├── IconPicker.tsx          # Icon Selector
│   ├── LinkManagerModal.tsx    # Settings Modal Container
│   ├── SearchBar.tsx           # Aggregated Search Bar
│   ├── SyncIndicator.tsx       # Cloud Sync Status Indicator
│   └── Toast.tsx               # Notification Component
├── contexts/                   # React Context
│   └── LanguageContext.tsx     # Internationalization State
├── functions/api/              # Cloudflare Pages Functions (Backend API)
│   ├── auth.ts                 # Authentication Logic (Login/Refresh/Update)
│   ├── bootstrap.ts            # Initial Data Load (Read D1)
│   └── update.ts               # Data Persistence (Write D1)
├── hooks/                      # Custom Hooks
│   └── useCategoryDragDrop.ts  # Complex Drag & Drop Logic Encapsulation
├── services/                   # Business Logic Services
│   └── storage.ts              # Core Data Layer (Cache, Sync, Crypto, API)
├── utils/                      # Utilities
│   └── color.ts                # Dominant Color Extraction Algorithm
├── App.tsx                     # Main Application Component
├── constants.tsx               # Default Constants
├── schema.sql                  # Database Initialization SQL
├── types.ts                    # TypeScript Type Definitions
└── ...
```

## 📄 License

MIT License. Feel free to use and modify for personal use.
