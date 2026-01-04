/**
 * Generates a favicon URL using a template and a target URL.
 * @param url The target website URL
 * @param template The API template with {domain} placeholder. Defaults to favicon.im if not provided.
 */
export const getFaviconUrl = (url: string, template?: string): string => {
  if (!url) return "";
  
  try {
    // Ensure URL has a protocol for parsing
    const urlToParse = url.match(/^https?:\/\//) ? url : `https://${url}`;
    const hostname = new URL(urlToParse).hostname;
    
    if (!hostname) return "";

    const apiTemplate = template || "https://favicon.im/{domain}?larger=true";
    
    // Replace placeholder
    return apiTemplate.replace("{domain}", hostname);
  } catch (e) {
    console.warn("Favicon URL generation failed:", e);
    return "";
  }
};
