import { ApiError } from "../types/errors";

export const handleApiError = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return "Session expired. Please login again.";
      case 403:
        return "Access denied.";
      case 404:
        return "Resource not found.";
      case 429:
        return "Too many requests. Please try again later.";
      case 500:
        return "Server error. Please try again later.";
      default:
        return error.message || fallbackMessage;
    }
  }

  if (error instanceof TypeError && error.message.includes("fetch")) {
    return "Network error. Please check your connection.";
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return "Request timeout. Please try again.";
  }

  return fallbackMessage;
};
