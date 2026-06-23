import { useEffect, useState } from "react";
import { storageService } from "../services/storage";

// Tracks whether the API client currently has a valid session.
// Re-checks every minute to catch expirations and exposes a `setAuthenticated`
// for the auth screen to flip the flag locally on a successful login.
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      storageService.isAuthenticated().then((v) => {
        if (!cancelled) setIsAuthenticated(v);
      });
    check();
    const id = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { isAuthenticated, setIsAuthenticated };
}
