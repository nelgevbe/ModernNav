// 数据验证工具

import { ERROR_MESSAGES } from "./authHelpers";

// 验证分类数据
export function validateCategory(data: any): { valid: boolean; message?: string } {
  if (!data || typeof data !== "object") {
    return { valid: false, message: ERROR_MESSAGES.INVALID_DATA };
  }

  if (!data.id || typeof data.id !== "string") {
    return { valid: false, message: "Category ID is required and must be a string" };
  }

  if (!data.title || typeof data.title !== "string") {
    return { valid: false, message: "Category title is required and must be a string" };
  }

  if (data.title.length > 50) {
    return { valid: false, message: "Category title must be 50 characters or less" };
  }

  if (!data.subCategories || !Array.isArray(data.subCategories)) {
    return { valid: false, message: "SubCategories must be an array" };
  }

  if (data.subCategories.length > 20) {
    return { valid: false, message: "Category cannot have more than 20 subcategories" };
  }

  return { valid: true };
}

// 验证子分类数据
export function validateSubCategory(data: any): { valid: boolean; message?: string } {
  if (!data || typeof data !== "object") {
    return { valid: false, message: ERROR_MESSAGES.INVALID_DATA };
  }

  if (!data.id || typeof data.id !== "string") {
    return { valid: false, message: "SubCategory ID is required and must be a string" };
  }

  if (!data.title || typeof data.title !== "string") {
    return { valid: false, message: "SubCategory title is required and must be a string" };
  }

  if (data.title.length > 50) {
    return { valid: false, message: "SubCategory title must be 50 characters or less" };
  }

  if (!data.items || !Array.isArray(data.items)) {
    return { valid: false, message: "Items must be an array" };
  }

  if (data.items.length > 50) {
    return { valid: false, message: "SubCategory cannot have more than 50 items" };
  }

  return { valid: true };
}

// 验证链接项数据
export function validateLinkItem(data: any): { valid: boolean; message?: string } {
  if (!data || typeof data !== "object") {
    return { valid: false, message: ERROR_MESSAGES.INVALID_DATA };
  }

  if (!data.id || typeof data.id !== "string") {
    return { valid: false, message: "Link ID is required and must be a string" };
  }

  if (!data.title || typeof data.title !== "string") {
    return { valid: false, message: "Link title is required and must be a string" };
  }

  if (data.title.length > 100) {
    return { valid: false, message: "Link title must be 100 characters or less" };
  }

  if (!data.url || typeof data.url !== "string") {
    return { valid: false, message: "Link URL is required and must be a string" };
  }

  if (data.url.length > 500) {
    return { valid: false, message: "Link URL must be 500 characters or less" };
  }

  try {
    const urlStr = /^https?:\/\//.test(data.url) ? data.url : "https://" + data.url;
    new URL(urlStr);
  } catch {
    return { valid: false, message: "Link URL must be a valid URL" };
  }

  if (data.description && typeof data.description !== "string") {
    return { valid: false, message: "Link description must be a string" };
  }

  if (data.description && data.description.length > 200) {
    return { valid: false, message: "Link description must be 200 characters or less" };
  }

  if (data.icon && typeof data.icon !== "string") {
    return { valid: false, message: "Link icon must be a string" };
  }

  if (data.icon && data.icon.length > 500) {
    return { valid: false, message: "Link icon must be 500 characters or less" };
  }

  return { valid: true };
}

// 验证用户偏好设置
export function validatePreferences(data: any): { valid: boolean; message?: string } {
  if (!data || typeof data !== "object") {
    return { valid: false, message: ERROR_MESSAGES.INVALID_DATA };
  }

  if (data.cardOpacity !== undefined) {
    if (typeof data.cardOpacity !== "number" || data.cardOpacity < 0 || data.cardOpacity > 1) {
      return { valid: false, message: "Card opacity must be a number between 0 and 1" };
    }
  }

  if (data.themeColor !== undefined) {
    if (typeof data.themeColor !== "string") {
      return { valid: false, message: "Theme color must be a string" };
    }

    // 简单的颜色格式验证
    const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!colorRegex.test(data.themeColor)) {
      return { valid: false, message: "Theme color must be a valid hex color" };
    }
  }

  if (data.themeMode !== undefined) {
    if (data.themeMode !== "dark" && data.themeMode !== "light") {
      return { valid: false, message: "Theme mode must be either 'dark' or 'light'" };
    }
  }

  const intFields = ["maxContainerWidth", "cardWidth", "cardHeight", "gridColumns"] as const;
  for (const field of intFields) {
    if (data[field] !== undefined) {
      if (typeof data[field] !== "number" || !Number.isFinite(data[field]) || data[field] < 1) {
        return { valid: false, message: `${field} must be a positive number` };
      }
    }
  }

  const shortStrFields = ["siteTitle", "faviconApi", "footerGithub"] as const;
  for (const field of shortStrFields) {
    if (data[field] !== undefined) {
      if (typeof data[field] !== "string" || data[field].length > 200) {
        return { valid: false, message: `${field} must be a string of 200 characters or less` };
      }
    }
  }

  if (data.footerLinks !== undefined) {
    if (!Array.isArray(data.footerLinks) || data.footerLinks.length > 20) {
      return { valid: false, message: "footerLinks must be an array of at most 20 items" };
    }
    for (const link of data.footerLinks) {
      if (!link || typeof link !== "object") {
        return { valid: false, message: "Each footer link must be an object" };
      }
      if (typeof link.title !== "string" || link.title.length > 100) {
        return {
          valid: false,
          message: "Footer link title must be a string of 100 characters or less",
        };
      }
      if (typeof link.url !== "string" || link.url.length > 500) {
        return {
          valid: false,
          message: "Footer link URL must be a string of 500 characters or less",
        };
      }
    }
  }

  if (data.searchEngines !== undefined) {
    if (!Array.isArray(data.searchEngines) || data.searchEngines.length > 20) {
      return { valid: false, message: "searchEngines must be an array of at most 20 items" };
    }
    for (const engine of data.searchEngines) {
      if (!engine || typeof engine !== "object") {
        return { valid: false, message: "Each search engine must be an object" };
      }
      if (typeof engine.id !== "string" || !engine.id) {
        return { valid: false, message: "Search engine id is required and must be a string" };
      }
      if (typeof engine.name !== "string" || !engine.name || engine.name.length > 50) {
        return {
          valid: false,
          message: "Search engine name must be a non-empty string of 50 characters or less",
        };
      }
      if (
        typeof engine.urlTemplate !== "string" ||
        !engine.urlTemplate ||
        engine.urlTemplate.length > 500
      ) {
        return {
          valid: false,
          message: "Search engine urlTemplate must be a non-empty string of 500 characters or less",
        };
      }
      if (typeof engine.icon !== "string" || engine.icon.length > 500) {
        return {
          valid: false,
          message: "Search engine icon must be a string of 500 characters or less",
        };
      }
    }
  }

  return { valid: true };
}

// 验证背景设置
export function validateBackground(data: any): { valid: boolean; message?: string } {
  if (data === undefined || data === null) {
    return { valid: false, message: ERROR_MESSAGES.INVALID_DATA };
  }

  if (typeof data !== "string") {
    return { valid: false, message: "Background must be a string" };
  }

  if (data.length > 1000) {
    return { valid: false, message: "Background must be 1000 characters or less" };
  }

  if (data.startsWith("http")) {
    try {
      new URL(data);
    } catch {
      return { valid: false, message: "Background must be a valid URL" };
    }
  }

  return { valid: true };
}

// 验证完整的分类结构（包括子分类和链接）
export function validateFullCategory(category: any): { valid: boolean; message?: string } {
  // 首先验证基本分类属性
  const categoryValidation = validateCategory(category);
  if (!categoryValidation.valid) {
    return categoryValidation;
  }

  // 验证每个子分类
  for (const subCategory of category.subCategories) {
    const subValidation = validateSubCategory(subCategory);
    if (!subValidation.valid) {
      return {
        valid: false,
        message: `SubCategory "${subCategory.title || "unnamed"}": ${subValidation.message}`,
      };
    }

    // 验证子分类中的每个链接
    for (const item of subCategory.items) {
      const itemValidation = validateLinkItem(item);
      if (!itemValidation.valid) {
        return {
          valid: false,
          message: `Link "${item.title || "unnamed"}" in "${subCategory.title || "unnamed"}": ${itemValidation.message}`,
        };
      }
    }
  }

  return { valid: true };
}
