import React, { createContext, useContext, useState } from "react";

type Language = "en" | "zh";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const translations = {
  en: {
    // App
    settings: "Settings",
    friendly_links: "Friendly Links",
    about_us: "GitHub",
    copyright: "Copyright",
    powered_by: "Powered by",

    // Search
    search_placeholder: "Search with {engine}...",

    // Auth
    admin_access: "Admin Access",
    enter_code_msg: "Please enter the access code to manage dashboard.",
    default_code: "Default Code: admin",
    unlock_btn: "Unlock Dashboard",
    cancel: "Cancel",
    incorrect_code: "Incorrect Access Code",
    login_rate_limited: "Too many login attempts, please try again later",
    logout: "Logout",
    session_expired: "Session expired due to inactivity. Please login again.",

    // Dashboard Header
    dashboard_manage: "Dashboard Management",

    // Tabs
    tab_content: "Content",
    tab_appearance: "Appearance",
    tab_data: "Data",
    tab_security: "Security",
    tab_general: "General",

    // Security Tab
    access_control: "Access Control",
    access_desc: "Update the access code used to unlock this panel.",
    current_code: "Current Code",
    new_code: "New Code",
    confirm_code: "Confirm New Code",
    show_codes: "Show Codes",
    hide_codes: "Hide Codes",
    update_code_btn: "Update Code",
    code_updated: "Access Code updated successfully.",
    code_mismatch: "New codes do not match.",
    code_length_err: "New code must be at least 4 characters.",
    current_code_err: "Current Access Code is incorrect.",

    // Data Tab
    backup_config: "Backup Configuration",
    backup_desc: "Export your categories and links to a JSON file.",
    download_backup: "Download Backup File",
    restore_config: "Restore Configuration",
    restore_desc: "Import categories and links from a JSON file.",
    select_import: "Select File to Import",
    import_success: "Configuration loaded successfully!",
    import_error: "Failed to import. Please check if the file is a valid JSON backup.",
    data_risk_title: "Cloud Persistence",
    data_risk_desc:
      "Changes are securely stored in Cloudflare D1. Use local backups for extra peace of mind.",
    last_backup: "Last Backup: {time}",
    never_backup: "Never",

    // Appearance Tab
    background_settings: "Background",
    background_desc: "Customize image, blur, and transparency.",
    bg_url_label: "Image URL",
    bg_url_placeholder: "https://example.com/image.jpg",
    update_bg_btn: "Update",
    reset_bg_btn: "Reset Default",
    bg_updated: "Appearance settings updated!",
    label_blur: "Background Blur",
    label_opacity: "Card Opacity",
    label_theme_color: "Theme Color",
    btn_auto_extract: "Auto Extract",
    btn_custom_color: "Custom",
    theme_updated: "Theme color updated!",
    extracting_color: "Extracting color...",

    // Layout/Precision
    precision_controls: "Custom Settings",
    geometry_layout: "Card specifications and layout",
    canvas_width: "Canvas Width",
    grid_cols: "Grid Columns",
    card_width: "Card Width",
    card_height: "Card Height",
    surface_opacity: "Surface Opacity",
    visual_identity: "Visual Identity",

    // Manager UI
    sidebar_categories: "Categories",
    search_links_placeholder: "Search links...",
    add_category_placeholder: "New Category",
    add_category_btn: "Add",
    delete_cat_confirm: "Delete category '{name}' and all its links?",
    edit_category_title: "Rename Category",

    // Sub-menu / Groups
    add_submenu: "Add Sub-menu",
    add_link_directly: "Add Link Directly",
    submenu_title: "Sub-menu Title",
    new_submenu_placeholder: "e.g., Development Tools",
    delete_submenu_confirm: "Delete sub-menu '{name}'?",
    edit_submenu: "Edit Sub-menu",

    // Links Tab
    add_new_link: "Add Link",
    no_links: "No links in this group.",
    no_links_search: "No links match your search.",
    no_submenus: "No sub-menus yet. Add a sub-menu or add links directly.",

    // Link Form
    label_category: "Category",
    label_icon: "Icon",
    icon_placeholder: "Name (Github), Emoji (🚀) or URL",
    label_title: "Title",
    title_placeholder: "My Link",
    label_url: "URL",
    url_placeholder: "https://example.com",
    label_desc: "Description",
    desc_placeholder: "Optional description",
    add_link_card: "Save Link",
    update_link_card: "Update Link",

    // General Tab
    label_site_title: "Site Title",
    label_favicon_api: "Favicon API",
    label_favicon_api_desc:
      "The API used to fetch website icons. Use {domain} as a placeholder for the URL domain. Example: https://favicon.im/{domain}",
    label_github_link: "GitHub Link",
    label_friendship_links: "Friendly Links",
    btn_add_link: "Add Link",
    btn_update_settings: "Update Settings",
    msg_saved: "Saved!",

    // Sync
    syncing_msg: "Syncing changes to cloud...",
  },
  zh: {
    // App
    settings: "设置",
    friendly_links: "友情链接",
    about_us: "GitHub",
    copyright: "版权所有",
    powered_by: "技术支持",

    // Search
    search_placeholder: "使用 {engine} 搜索...",

    // Auth
    admin_access: "管理员访问",
    enter_code_msg: "请输入访问代码以管理仪表盘。",
    default_code: "默认代码: admin",
    unlock_btn: "解锁仪表盘",
    cancel: "取消",
    incorrect_code: "访问代码错误",
    login_rate_limited: "登录尝试过于频繁，请稍后再试",
    logout: "退出登录",
    session_expired: "会话已超时，请重新登录。",

    // Dashboard Header
    dashboard_manage: "仪表盘管理",

    // Tabs
    tab_content: "内容管理",
    tab_appearance: "外观设置",
    tab_data: "数据备份",
    tab_security: "安全设置",
    tab_general: "全局设置",

    // Security Tab
    access_control: "访问控制",
    access_desc: "更新用于解锁此面板的访问代码。",
    current_code: "当前代码",
    new_code: "新代码",
    confirm_code: "确认新代码",
    show_codes: "显示代码",
    hide_codes: "隐藏代码",
    update_code_btn: "更新代码",
    code_updated: "访问代码更新成功。",
    code_mismatch: "新代码不匹配。",
    code_length_err: "新代码至少需要4个字符。",
    current_code_err: "当前访问代码不正确。",

    // Data Tab
    backup_config: "备份配置",
    backup_desc: "将您的分类和链接导出为 JSON 文件。",
    download_backup: "下载备份文件",
    restore_config: "恢复配置",
    restore_desc: "从 JSON 文件导入分类和链接。",
    select_import: "选择导入文件",
    import_success: "配置加载成功！",
    import_error: "导入失败。请检查文件是否为有效的 JSON 备份。",
    data_risk_title: "云端持久化",
    data_risk_desc: "更改已安全存储在 Cloudflare D1 中。使用本地备份以获得额外保障。",
    last_backup: "上次备份: {time}",
    never_backup: "从未备份",

    // Appearance Tab
    background_settings: "背景设置",
    background_desc: "自定义背景图片、模糊度和卡片透明度。",
    bg_url_label: "图片 URL",
    bg_url_placeholder: "https://example.com/image.jpg",
    update_bg_btn: "更新设置",
    reset_bg_btn: "恢复默认",
    bg_updated: "外观设置已更新！",
    label_blur: "背景模糊度",
    label_opacity: "卡片透明度",
    label_theme_color: "主题色",
    btn_auto_extract: "自动从图片提取",
    btn_custom_color: "自定义选择",
    theme_updated: "主题色已更新！",
    extracting_color: "正在提取颜色...",

    // Layout/Precision
    precision_controls: "自定义设置",
    geometry_layout: "卡片规格与布局",
    canvas_width: "画布宽度",
    grid_cols: "网格列数",
    card_width: "卡片宽度",
    card_height: "卡片高度",
    surface_opacity: "卡片表面透明度",
    visual_identity: "视觉识别",

    // Manager UI
    sidebar_categories: "分类列表",
    search_links_placeholder: "搜索当前分类链接...",
    add_category_placeholder: "新分类名称",
    add_category_btn: "添加",
    delete_cat_confirm: "确定删除分类“{name}”及其所有链接吗？",
    edit_category_title: "重命名分类",

    // Sub-menu / Groups
    add_submenu: "添加子菜单",
    add_link_directly: "直接添加链接",
    submenu_title: "子菜单标题",
    new_submenu_placeholder: "例如：开发工具",
    delete_submenu_confirm: "确定删除子菜单“{name}”吗？",
    edit_submenu: "编辑子菜单",

    // Links Tab
    add_new_link: "添加链接",
    no_links: "此分组下暂无链接。",
    no_links_search: "未找到匹配的链接。",
    no_submenus: "暂无子菜单。添加子菜单或直接添加链接。",

    // Link Form
    label_category: "所属分类",
    label_icon: "图标",
    icon_placeholder: "图标名(Github)、表情(🚀)或图片URL",
    label_title: "标题",
    title_placeholder: "我的链接",
    label_url: "链接地址",
    url_placeholder: "https://example.com",
    label_desc: "描述",
    desc_placeholder: "可选描述",
    add_link_card: "保存链接",
    update_link_card: "更新链接",

    // General Tab
    label_site_title: "站点标题",
    label_favicon_api: "图标 API 模板",
    label_favicon_api_desc:
      "用于自动抓取网站图标的地址。使用 {domain} 作为目标域名的占位符。例如：https://favicon.im/{domain}",
    label_github_link: "GitHub 链接",
    label_friendship_links: "友情链接",
    btn_add_link: "添加链接",
    btn_update_settings: "更新设置",
    msg_saved: "已保存！",

    // Sync
    syncing_msg: "正在同步到云端...",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    const savedLang = localStorage.getItem("modernNavLanguage") as Language;
    return savedLang === "en" || savedLang === "zh" ? savedLang : "en";
  });

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("modernNavLanguage", lang);
  };

  const t = (key: string, params?: Record<string, string>) => {
    let text = (translations[language] as Record<string, string>)[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
