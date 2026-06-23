import { DEFAULT_FAVICON_API, FALLBACK_FAVICON_APIS } from "../constants/defaults";

export const getFaviconUrl = (url: string, template?: string): string => {
  if (!url) return "";

  try {
    const urlToParse = url.match(/^https?:\/\//) ? url : `https://${url}`;
    const hostname = new URL(urlToParse).hostname;

    if (!hostname) return "";

    const apiTemplate = template || DEFAULT_FAVICON_API;

    return apiTemplate.replace("{domain}", hostname);
  } catch (e) {
    console.warn("Favicon URL generation failed:", e);
    return "";
  }
};

export const getFallbackFaviconUrls = (url: string, template?: string): string[] => {
  if (!url) return [];

  try {
    const urlToParse = url.match(/^https?:\/\//) ? url : `https://${url}`;
    const hostname = new URL(urlToParse).hostname;

    if (!hostname) return [];

    const urls: string[] = [];

    if (template) {
      urls.push(template.replace("{domain}", hostname));
    } else {
      urls.push(DEFAULT_FAVICON_API.replace("{domain}", hostname));
    }

    for (const fallback of FALLBACK_FAVICON_APIS) {
      urls.push(fallback.replace("{domain}", hostname));
    }

    return urls;
  } catch (e) {
    console.warn("Fallback favicon URL generation failed:", e);
    return [];
  }
};

export const getIconSize = (baseSize: number, scale: number): number => {
  return Math.round(baseSize * scale);
};
