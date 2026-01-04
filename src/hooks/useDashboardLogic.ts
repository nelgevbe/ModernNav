import { useState, useEffect } from "react";
import { storageService, DEFAULT_BACKGROUND } from "../services/storage";
import { getDominantColor } from "../utils/color";
import { Category, ThemeMode, UserPreferences } from "../types";
import { useLanguage } from "../contexts/LanguageContext";

export const useDashboardLogic = () => {
  // State
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [background, setBackground] = useState<string>(DEFAULT_BACKGROUND);
  const [cardOpacity, setCardOpacity] = useState<number>(0.1);
  const [themeColor, setThemeColor] = useState<string>("#6280a3");
  const [themeColorAuto, setThemeColorAuto] = useState<boolean>(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>(ThemeMode.Dark);
  const [isDefaultCode, setIsDefaultCode] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [activeSubCategoryId, setActiveSubCategoryId] = useState<string>("");
  // New Layout Preferences
  const [maxContainerWidth, setMaxContainerWidth] = useState<number>(900);
  const [cardWidth, setCardWidth] = useState<number>(96);
  const [cardHeight, setCardHeight] = useState<number>(96);
  const [gridColumns, setGridColumns] = useState<number>(6);
  // New Global Preferences
  const [siteTitle, setSiteTitle] = useState<string>("ModernNav");
  const [faviconApi, setFaviconApi] = useState<string>("https://favicon.im/{domain}?larger=true");
  const [footerGithub, setFooterGithub] = useState<string>("https://github.com/lyan0220");
  const [footerLinks, setFooterLinks] = useState<{title: string, url: string}[]>([]);

  const { language, setLanguage } = useLanguage();

  // Initial Data Fetch
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const data = await storageService.fetchAllData();

        setCategories(data.categories);
        setBackground(data.background);
        setCardOpacity(data.prefs.cardOpacity);
        setThemeMode(data.prefs.themeMode);
        setIsDefaultCode(data.isDefaultCode);
        setThemeColorAuto(data.prefs.themeColorAuto ?? true);

        // Load new preferences
        setMaxContainerWidth(data.prefs.maxContainerWidth ?? 900);
        setCardWidth(data.prefs.cardWidth ?? 96);
        setCardHeight(data.prefs.cardHeight ?? 96);
        setGridColumns(data.prefs.gridColumns ?? 6);
        setSiteTitle(data.prefs.siteTitle ?? "ModernNav");
        setFaviconApi(data.prefs.faviconApi ?? "https://favicon.im/{domain}?larger=true");
        setFooterGithub(data.prefs.footerGithub ?? "https://github.com/lyan0220");
        setFooterLinks(data.prefs.footerLinks ?? []);

        let finalColor = data.prefs.themeColor || "#6280a3";

        if (
          (data.prefs.themeColorAuto ?? true) &&
          data.background.startsWith("http")
        ) {
          finalColor = await getDominantColor(data.background);
        }

        setThemeColor(finalColor);

        // Set Active Category
        if (data.categories.length > 0) {
          setActiveCategory(data.categories[0].id);
        }
      } catch (e) {
        console.error("Failed to load app data", e);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  // Sync Theme Color to CSS Variable
  useEffect(() => {
    document.documentElement.style.setProperty("--theme-primary", themeColor);
    document.documentElement.style.setProperty(
      "--theme-hover",
      `color-mix(in srgb, ${themeColor}, black 10%)`
    );
  }, [themeColor]);

  // Extract color when background changes (if auto mode is on)
  useEffect(() => {
    const updateTheme = async () => {
      if (
        !loading &&
        themeColorAuto &&
        (background.startsWith("http") || background.startsWith("data:"))
      ) {
        const color = await getDominantColor(background);
        setThemeColor(color);
      }
    };
    updateTheme();
  }, [background, loading, themeColorAuto]);

  // Ensure activeCategory is valid
  useEffect(() => {
    if (!loading && categories.length > 0) {
      const currentExists = categories.find((c) => c.id === activeCategory);
      if (!currentExists) {
        const firstCat = categories[0];
        setActiveCategory(firstCat.id);
      }
    }
  }, [categories, activeCategory, loading]);

  // Ensure activeSubCategoryId is valid
  useEffect(() => {
    if (!loading) {
      const currentCat = categories.find((c) => c.id === activeCategory);
      if (currentCat && currentCat.subCategories.length > 0) {
        const subExists = currentCat.subCategories.find(
          (s) => s.id === activeSubCategoryId
        );
        if (!subExists) {
          setActiveSubCategoryId(currentCat.subCategories[0].id);
        }
      } else {
        setActiveSubCategoryId("");
      }
    }
  }, [activeCategory, categories, activeSubCategoryId, loading]);

  const handleUpdateAppearance = async (
    url: string,
    opacity: number,
    color?: string,
    layoutPrefs?: { width: number; cardWidth: number; cardHeight: number; cols: number },
    themeAuto?: boolean,
    extraPrefs?: Partial<UserPreferences>
  ) => {
    const updatedColor = color || themeColor;
    const updatedAuto = themeAuto !== undefined ? themeAuto : (color ? false : themeColorAuto);

    setBackground(url);
    setCardOpacity(opacity);
    setThemeColor(updatedColor);
    setThemeColorAuto(updatedAuto);

    if (layoutPrefs) {
      setMaxContainerWidth(layoutPrefs.width);
      setCardWidth(layoutPrefs.cardWidth);
      setCardHeight(layoutPrefs.cardHeight);
      setGridColumns(layoutPrefs.cols);
    }

    if (extraPrefs) {
      if (extraPrefs.siteTitle !== undefined) setSiteTitle(extraPrefs.siteTitle);
      if (extraPrefs.faviconApi !== undefined) setFaviconApi(extraPrefs.faviconApi);
      if (extraPrefs.footerGithub !== undefined) setFooterGithub(extraPrefs.footerGithub);
      if (extraPrefs.footerLinks !== undefined) setFooterLinks(extraPrefs.footerLinks);
    }

    const finalSiteTitle = extraPrefs?.siteTitle !== undefined ? extraPrefs.siteTitle : siteTitle;
    const finalFaviconApi = extraPrefs?.faviconApi !== undefined ? extraPrefs.faviconApi : faviconApi;
    const finalFooterGithub = extraPrefs?.footerGithub !== undefined ? extraPrefs.footerGithub : footerGithub;
    const finalFooterLinks = extraPrefs?.footerLinks !== undefined ? extraPrefs.footerLinks : footerLinks;

    try {
      await storageService.setBackground(url);
      await storageService.savePreferences(
        {
          cardOpacity: opacity,
          themeColor: updatedColor,
          themeMode,
          themeColorAuto: updatedAuto,
          maxContainerWidth: layoutPrefs?.width ?? maxContainerWidth,
          cardWidth: layoutPrefs?.cardWidth ?? cardWidth,
          cardHeight: layoutPrefs?.cardHeight ?? cardHeight,
          gridColumns: layoutPrefs?.cols ?? gridColumns,
          siteTitle: finalSiteTitle,
          faviconApi: finalFaviconApi,
          footerGithub: finalFooterGithub,
          footerLinks: finalFooterLinks,
        },
        true
      );
    } catch (err) {
      console.error("Failed to save theme preferences:", err);
    }
  };


  const toggleTheme = () => {
    const newTheme =
      themeMode === ThemeMode.Dark ? ThemeMode.Light : ThemeMode.Dark;
    setThemeMode(newTheme);
    storageService.savePreferences({
      cardOpacity,
      themeColor,
      themeMode: newTheme,
      themeColorAuto,
    });
  };

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "zh" : "en");
  };

  const handleMainCategoryClick = (cat: Category) => {
    setActiveCategory(cat.id);
    if (cat.subCategories.length > 0) {
      setActiveSubCategoryId(cat.subCategories[0].id);
    } else {
      setActiveSubCategoryId("");
    }
  };

  const handleSubCategoryClick = (catId: string, subId: string) => {
    setActiveCategory(catId);
    setActiveSubCategoryId(subId);
  };

  return {
    state: {
      loading,
      categories,
      background,
      cardOpacity,
      themeColor,
      themeColorAuto,
      themeMode,
      isDefaultCode,
      activeCategory,
      activeSubCategoryId,
      maxContainerWidth,
      cardWidth,
      cardHeight,
      gridColumns,
      siteTitle,
      faviconApi,
      footerGithub,
      footerLinks,
    },
    actions: {
      setCategories,
      handleUpdateAppearance,
      toggleTheme,
      toggleLanguage,
      handleMainCategoryClick,
      handleSubCategoryClick,
    },
  };
};

