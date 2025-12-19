
# ModernNav - Personal Navigation Dashboard

ModernNav is a modern, minimalist, card-based navigation dashboard featuring a frosted glass (Glassmorphism) aesthetic. It is designed to be a beautiful, customizable browser start page or bookmark manager.

Built with **React**, **Tailwind CSS**, and **Cloudflare Pages** (Functions + KV).

[中文文档](README.md)

## ✨ Features

*   **🎨 Stunning UI:** Glassmorphism design with adaptive frosted glass effects, smooth animations, and responsive layout.
*   **🌓 Dark/Light Mode:** Automatic theme switching with intelligent color extraction from background images.
*   **🖱️ Drag & Drop:** Easily reorder categories and links via drag and drop in the settings.
*   **🖼️ Customization:** Change background images, adjust blur/opacity levels, and customize theme colors.
*   **📂 Grouping:** Organize links into Categories and Sub-categories (Folders).
*   **🔍 Aggregated Search:** Integrated search bar supporting Google, Bing, Baidu, GitHub, and more.
*   **🔐 Enterprise-Grade Security:** Implements **Dual Token Authentication (Access/Refresh)** with **HttpOnly Cookies**, Token Rotation, and sliding window sessions for maximum security against XSS/CSRF.
*   **☁️ Hybrid Storage (Enhanced):**
    *   **Cloud Sync:** Syncs data to Cloudflare KV when deployed for real-time multi-device access.
    *   **Offline First:** Robust sync logic with dirty checking, conflict resolution, and automatic background retries ensuring data integrity even with unstable connections.
*   **🌍 Internationalization:** Built-in support for English and Chinese (Simplified).
*   **💾 Full Backup:** Export your entire configuration (links, background, settings) to JSON and restore anytime.

## 🛠️ Tech Stack

*   **Frontend:** React 19, Vite, Tailwind CSS, Lucide React
*   **Backend:** Cloudflare Pages Functions (Serverless)
*   **Database:** Cloudflare KV (Key-Value Store)
*   **Auth:** Access Token (In-Memory) + Refresh Token (HttpOnly Cookie)
*   **Language:** TypeScript

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18 or later)
*   npm or yarn

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

To test the Backend API and KV storage locally, you need `wrangler`.

1.  Install Wrangler:
    ```bash
    npm install -D wrangler
    ```

2.  Run the Cloudflare Pages simulation:
    ```bash
    npx wrangler pages dev . --kv KV_STORE
    ```
    *This simulates the Cloudflare environment locally, including Cookie and KV handling.*

## 📦 Deployment (Cloudflare Pages)

This project is optimized for **Cloudflare Pages**.

### Step 1: Push to Git
Push this code to your GitHub or GitLab repository.

### Step 2: Create Cloudflare Project
1.  Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2.  Go to **Workers & Pages** > **Overview** > **Create Application** > **Pages** > **Connect to Git**.
3.  Select your repository.

### Step 3: Build Settings
*   **Framework preset:** `None`
*   **Build command:** `npm run build`
*   **Build output directory:** `dist`

### Step 4: Configure Database (KV)
1.  After the project is created, go to **Workers & Pages** > **KV**.
2.  Click **Create a Namespace** (e.g., name it `modern-nav-db`).
3.  Go back to your Pages project settings: **Settings** > **Functions** > **KV Namespace Bindings**.
4.  Add a binding:
    *   **Variable name:** `KV_STORE` (Must be exact)
    *   **KV Namespace:** Select the namespace you created.
5.  **Save** and **Redeploy** (Go to Deployments > Retry deployment).

## ⚙️ Configuration & Usage

### Initial Setup
1.  Open your deployed site.
2.  Click the **Settings (Gear Icon)** in the top right.
3.  Enter the default access code: `admin`.
4.  **Important:** Go to the "Security" tab immediately and change your access code.

### Customization
*   **Content:** Add categories, sub-menus, and links in the "Content" tab. Reorder them using drag and drop.
*   **Appearance:** Change the background URL and adjust card opacity in the "Appearance" tab.

## 📂 Project Structure

```
├── components/        # React UI components (GlassCard, SearchBar, LinkManagerModal, etc.)
├── contexts/          # React Context (Language)
├── functions/api/     # Cloudflare Pages Functions (Backend API)
│   ├── bootstrap.ts   # Initial data load
│   ├── update.ts      # Save data (Protected by Bearer Token)
│   └── auth.ts        # Authentication logic (Login/Refresh/Logout)
├── services/          # Data layer (handles Token refresh, Interceptors, Sync logic)
├── types.ts           # TypeScript interfaces
├── App.tsx            # Main application logic
└── index.html         # Entry point & Tailwind config
```

## 📄 License

MIT License. Feel free to use and modify for personal use.
