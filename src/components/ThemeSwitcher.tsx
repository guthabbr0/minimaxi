import type { Theme } from "../types";

interface ThemeSwitcherProps {
  activeTheme: Theme;
  onThemeChange: (theme: Theme) => void;
}

const THEMES: { id: Theme; label: string; key: string }[] = [
  { id: "midnight", label: "Midnight", key: "1" },
  { id: "ember", label: "Ember", key: "2" },
  { id: "abyss", label: "Abyss", key: "3" }
];

export function ThemeSwitcher({
  activeTheme,
  onThemeChange
}: ThemeSwitcherProps) {
  return (
    <div className="theme-switcher">
      {THEMES.map((theme) => (
        <button
          key={theme.id}
          className={`theme-switcher__btn ${
            activeTheme === theme.id ? "theme-switcher__btn--active" : ""
          }`}
          type="button"
          title={theme.label}
          aria-label={theme.label}
          aria-pressed={activeTheme === theme.id}
          onClick={() => onThemeChange(theme.id)}
        >
          {theme.key}
        </button>
      ))}
    </div>
  );
}
