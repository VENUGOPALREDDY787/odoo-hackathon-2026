import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

export default function LanguageSwitcher({ className = '', dropDirection = 'down' }) {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentLang = i18n.language?.startsWith('hi') ? 'hi' : 'en';

  const languages = [
    { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
    { code: 'hi', label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  ];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code) => {
    i18n.changeLanguage(code);
    setIsOpen(false);
  };

  const activeOption = languages.find((l) => l.code === currentLang) || languages[0];

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-interactive/90 hover:bg-surface-interactive border border-border-subtle hover:border-accent-blue/50 text-text-primary text-xs font-mono font-medium transition-all shadow-sm active:scale-95 select-none"
        title="Change language / भाषा बदलें"
      >
        <span className="text-base leading-none select-none">{activeOption.flag}</span>
        <span className="hidden sm:inline-block tracking-wide">{activeOption.native}</span>
        <span className="sm:hidden tracking-wider uppercase">{activeOption.code}</span>
        <span className={`material-symbols-outlined text-[16px] text-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: dropDirection === 'up' ? 8 : -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropDirection === 'up' ? 8 : -8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute z-50 right-0 w-44 rounded-2xl bg-surface-card/95 backdrop-blur-xl border border-border-subtle shadow-2xl overflow-hidden py-1.5 ${
              dropDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
          >
            <div className="px-3 py-1 text-[10px] font-label-caps uppercase text-text-secondary border-b border-border-subtle/50 mb-1 select-none">
              Language / भाषा
            </div>

            {languages.map((lang) => {
              const isSelected = lang.code === currentLang;
              return (
                <button
                  key={lang.code}
                  onClick={() => handleSelect(lang.code)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors select-none ${
                    isSelected
                      ? 'bg-accent-blue/15 text-accent-blue font-semibold'
                      : 'text-text-primary hover:bg-surface-interactive text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base leading-none">{lang.flag}</span>
                    <div className="text-left">
                      <div className="leading-tight">{lang.native}</div>
                      <div className="text-[10px] opacity-70 leading-tight">{lang.label}</div>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="material-symbols-outlined text-[16px] text-accent-blue font-bold">
                      check
                    </span>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
