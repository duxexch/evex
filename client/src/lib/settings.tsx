import { createContext, useContext, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface Theme {
  id: string;
  name: string;
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  cardColor: string;
  mutedColor: string;
  borderColor: string;
  isActive: boolean;
  isDefault: boolean;
}

interface PublicSettings {
  sections: Record<string, boolean>;
  theme?: Theme | null;
}

interface SettingsContextType {
  settings: PublicSettings | null;
  isLoading: boolean;
  isSectionEnabled: (section: string) => boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  isLoading: true,
  isSectionEnabled: () => true,
});

function isValidHex(hex: string): boolean {
  if (!hex || typeof hex !== "string") return false;
  const cleaned = hex.replace("#", "");
  return /^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(cleaned);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!isValidHex(hex)) return null;
  let cleaned = hex.replace("#", "");
  if (cleaned.length === 3) {
    cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2];
  }
  return {
    r: parseInt(cleaned.substring(0, 2), 16),
    g: parseInt(cleaned.substring(2, 4), 16),
    b: parseInt(cleaned.substring(4, 6), 16),
  };
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastForeground(bgHex: string): string {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return "0 0% 100%";
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  return luminance > 0.179 ? "220 13% 10%" : "0 0% 98%";
}

function hexToHsl(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function adjustLightness(hsl: string, amount: number): string {
  const parts = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!parts) return hsl;
  const h = parseInt(parts[1]);
  const s = parseInt(parts[2]);
  const l = Math.max(0, Math.min(100, parseInt(parts[3]) + amount));
  return `${h} ${s}% ${l}%`;
}

function applyThemeColors(theme: Theme) {
  const root = document.documentElement;
  
  const primaryHsl = hexToHsl(theme.primaryColor);
  const accentHsl = hexToHsl(theme.accentColor);
  const secondaryHsl = hexToHsl(theme.secondaryColor);
  const bgHsl = hexToHsl(theme.backgroundColor);
  const cardHsl = hexToHsl(theme.cardColor);
  const fgHsl = hexToHsl(theme.foregroundColor);
  const mutedHsl = hexToHsl(theme.mutedColor);
  const borderHsl = hexToHsl(theme.borderColor);
  
  const primaryFg = getContrastForeground(theme.primaryColor);
  const accentFg = getContrastForeground(theme.accentColor);
  const secondaryFg = getContrastForeground(theme.secondaryColor);
  
  if (primaryHsl) {
    root.style.setProperty("--primary", primaryHsl);
    root.style.setProperty("--primary-foreground", primaryFg);
    root.style.setProperty("--ring", primaryHsl);
    root.style.setProperty("--chart-1", primaryHsl);
    root.style.setProperty("--sidebar-primary", primaryHsl);
    root.style.setProperty("--sidebar-primary-foreground", primaryFg);
    root.style.setProperty("--sidebar-ring", primaryHsl);
  }
  
  if (accentHsl) {
    root.style.setProperty("--accent", accentHsl);
    root.style.setProperty("--accent-foreground", accentFg);
    root.style.setProperty("--sidebar-accent", accentHsl);
    root.style.setProperty("--sidebar-accent-foreground", accentFg);
  }
  
  if (secondaryHsl) {
    root.style.setProperty("--secondary", secondaryHsl);
    root.style.setProperty("--secondary-foreground", secondaryFg);
    root.style.setProperty("--warning", secondaryHsl);
    root.style.setProperty("--warning-foreground", secondaryFg);
  }
  
  if (bgHsl) {
    root.style.setProperty("--background", bgHsl);
  }
  
  if (fgHsl) {
    root.style.setProperty("--foreground", fgHsl);
    root.style.setProperty("--card-foreground", fgHsl);
    root.style.setProperty("--popover-foreground", fgHsl);
    root.style.setProperty("--sidebar-foreground", fgHsl);
  }
  
  if (cardHsl) {
    root.style.setProperty("--card", cardHsl);
    root.style.setProperty("--sidebar", cardHsl);
    root.style.setProperty("--popover", cardHsl);
  }
  
  if (mutedHsl) {
    root.style.setProperty("--muted", adjustLightness(mutedHsl, -25));
    root.style.setProperty("--muted-foreground", mutedHsl);
  }
  
  if (borderHsl) {
    root.style.setProperty("--border", borderHsl);
    root.style.setProperty("--input", borderHsl);
    root.style.setProperty("--card-border", borderHsl);
    root.style.setProperty("--sidebar-border", borderHsl);
    root.style.setProperty("--popover-border", borderHsl);
  }
  
  root.style.setProperty("--success", "142 76% 36%");
  root.style.setProperty("--success-foreground", "0 0% 100%");
  root.style.setProperty("--destructive", "0 84% 60%");
  root.style.setProperty("--destructive-foreground", "0 0% 100%");
  root.style.setProperty("--win", "142 76% 36%");
  root.style.setProperty("--loss", "0 84% 60%");
  
  root.style.setProperty("--chart-2", "142 76% 36%");
  root.style.setProperty("--chart-3", "0 84% 60%");
  root.style.setProperty("--chart-4", "199 89% 48%");
  root.style.setProperty("--chart-5", "280 68% 60%");
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { data: settings, isLoading } = useQuery<PublicSettings>({
    queryKey: ["/api/settings/public"],
    queryFn: async () => {
      const res = await fetch("/api/settings/public");
      if (!res.ok) return { sections: {} };
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (settings?.theme) {
      applyThemeColors(settings.theme);
    }
  }, [settings?.theme]);

  const isSectionEnabled = (section: string): boolean => {
    if (!settings?.sections) return true;
    return settings.sections[section] !== false;
  };

  return (
    <SettingsContext.Provider value={{ 
      settings: settings || null, 
      isLoading, 
      isSectionEnabled
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
