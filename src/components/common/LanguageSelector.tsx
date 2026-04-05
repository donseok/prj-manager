import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '../../i18n';

export default function LanguageSelector() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];

  const handleChange = (code: LanguageCode) => {
    void i18n.changeLanguage(code);
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group relative flex h-11 items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-3 text-sm font-medium text-[color:var(--text-secondary)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[color:var(--bg-secondary-solid)]"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{currentLang.code.toUpperCase()}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-1.5 shadow-[0_24px_56px_-28px_rgba(0,0,0,0.45)] backdrop-blur-2xl animate-scale-in">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleChange(lang.code)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                lang.code === currentLang.code
                  ? 'bg-[rgba(15,118,110,0.08)] text-[color:var(--accent-primary)]'
                  : 'text-[color:var(--text-primary)] hover:bg-[color:var(--bg-tertiary)]'
              }`}
            >
              <span className="text-base">{lang.flag}</span>
              <span>{lang.label}</span>
              {lang.code === currentLang.code && (
                <span className="ml-auto text-xs text-[color:var(--accent-primary)]">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
