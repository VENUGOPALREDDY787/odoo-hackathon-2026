import React from 'react';
import { useTranslation } from 'react-i18next';

export default function ThemeToggle({ theme, onToggle }) {
  const { t } = useTranslation();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={
        isLight
          ? t('navigation.switchToDark', 'Switch to dark mode')
          : t('navigation.switchToLight', 'Switch to light mode')
      }
      title={
        isLight
          ? t('navigation.switchToDark', 'Switch to dark mode')
          : t('navigation.switchToLight', 'Switch to light mode')
      }
      className="w-10 h-10 rounded-full bg-surface-interactive border border-border-subtle flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-accent-blue transition-all active:scale-95"
    >
      <span className="material-symbols-outlined text-[20px]">
        {isLight ? 'dark_mode' : 'light_mode'}
      </span>
    </button>
  );
}
