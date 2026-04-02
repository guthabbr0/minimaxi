import { THEME_IDS, type Theme } from "../types";

interface ThemeSwitcherProps {
  activeTheme: Theme;
  onThemeChange: (theme: Theme) => void;
}

const THEME_LABELS: Record<Theme, string> = {
  midnight: "Midnight",
  ember: "Ember",
  abyss: "Abyss"
};

export function ThemeSwitcher({
  activeTheme,
  onThemeChange
}: ThemeSwitcherProps) {
  return (
    <div className="theme-switcher">
      {THEME_IDS.map((id, index) => (
        <button
          key={id}
          className={`theme-switcher__btn ${
            activeTheme === id ? "theme-switcher__btn--active" : ""
          }`}
          type="button"
          title={THEME_LABELS[id]}
          aria-label={THEME_LABELS[id]}
          aria-pressed={activeTheme === id}
          onClick={() => onThemeChange(id)}
        >
          {index + 1}
        </button>
      ))}
    </div>
  );
}
