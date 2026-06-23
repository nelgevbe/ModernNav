import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { LanguageProvider } from "./contexts/LanguageContext";
import { queryClient } from "./services/queries";
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminGuard } from "./components/admin/AdminGuard";
import { AdminAuthPage } from "./components/admin/AdminAuthPage";
import { ContentPage } from "./components/admin/ContentPage";
import { GeneralPage } from "./components/admin/GeneralPage";
import { AppearancePage } from "./components/admin/AppearancePage";
import { DataPage } from "./components/admin/DataPage";
import { SecurityPage } from "./components/admin/SecurityPage";
import { useThemeColor } from "./hooks/useThemeColor";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

/**
 * Applies the saved theme color globally across all routes (dashboard + admin),
 * so theme-color changes take effect immediately everywhere.
 */
const ThemeColorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useThemeColor();
  return <>{children}</>;
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <BrowserRouter>
          <ThemeColorProvider>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/admin/auth" element={<AdminAuthPage />} />
              <Route
                path="/admin"
                element={
                  <AdminGuard>
                    <AdminLayout />
                  </AdminGuard>
                }
              >
                <Route index element={<Navigate to="content" replace />} />
                <Route path="content" element={<ContentPage />} />
                <Route path="general" element={<GeneralPage />} />
                <Route path="appearance" element={<AppearancePage />} />
                <Route path="data" element={<DataPage />} />
                <Route path="security" element={<SecurityPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ThemeColorProvider>
        </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
