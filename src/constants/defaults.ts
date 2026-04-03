import { ThemeMode, UserPreferences } from "../types";

export const DEFAULT_THEME_COLOR = "#6280a3";
export const DEFAULT_FAVICON_API = "https://favicon.im/{domain}?larger=true";

export const FALLBACK_FAVICON_APIS = [
  "https://favicon.vemetric.com/{domain}",
  "https://www.google.com/s2/favicons?domain={domain}&sz=64",
  "https://duckduckgo.com/ip2/{domain}.ico",
];
export const DEFAULT_SITE_TITLE = "ModernNav";
export const DEFAULT_FOOTER_GITHUB = "https://github.com/lyan0220";
export const DEFAULT_FOOTER_LINKS = [{ title: "Friendly Links", url: "https://coyoo.ggff.net/" }];

export const DEFAULT_LAYOUT = {
  maxContainerWidth: 900,
  cardWidth: 96,
  cardHeight: 96,
  gridColumns: 6,
};

export const DEFAULT_LAYOUT_UI = {
  width: DEFAULT_LAYOUT.maxContainerWidth,
  cardWidth: DEFAULT_LAYOUT.cardWidth,
  cardHeight: DEFAULT_LAYOUT.cardHeight,
  cols: DEFAULT_LAYOUT.gridColumns,
};

export const DEFAULT_PREFS: UserPreferences = {
  cardOpacity: 0.1,
  themeColor: DEFAULT_THEME_COLOR,
  themeMode: ThemeMode.Dark,
  themeColorAuto: true,
  faviconApi: DEFAULT_FAVICON_API,
  siteTitle: DEFAULT_SITE_TITLE,
  footerGithub: DEFAULT_FOOTER_GITHUB,
  footerLinks: DEFAULT_FOOTER_LINKS,
};
