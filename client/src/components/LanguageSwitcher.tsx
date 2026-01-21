import React from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { SUPPORTED_LANGUAGES } from "../utils/i18n";

interface LanguageSwitcherProps {
  className?: string;
  showLabel?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className = "",
  showLabel = true,
}) => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <span className="text-sm font-medium text-gray-700">
          {t("language.selectLanguage")}
        </span>
      )}
      <div className="flex gap-1 border border-gray-300 rounded-lg p-1">
        {(Object.entries(SUPPORTED_LANGUAGES) as Array<[any, any]>).map(
          ([langCode, langConfig]) => (
            <button
              key={langCode}
              onClick={() => setLanguage(langCode as any)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                language === langCode
                  ? "bg-blue-500 text-white"
                  : "bg-transparent text-gray-700 hover:bg-gray-100"
              }`}
              title={langConfig.name}
            >
              <span className="mr-1">{langConfig.flag}</span>
              {langCode.toUpperCase()}
            </button>
          )
        )}
      </div>
    </div>
  );
};

// Dropdown variant
interface LanguageSwitcherDropdownProps {
  className?: string;
}

export const LanguageSwitcherDropdown: React.FC<
  LanguageSwitcherDropdownProps
> = ({ className = "" }) => {
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        <span className="text-xl">
          {SUPPORTED_LANGUAGES[language].flag}
        </span>
        <span className="text-sm font-medium">
          {language.toUpperCase()}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
          {(Object.entries(SUPPORTED_LANGUAGES) as Array<[any, any]>).map(
            ([langCode, langConfig]) => (
              <button
                key={langCode}
                onClick={() => {
                  setLanguage(langCode as any);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                  language === langCode
                    ? "bg-blue-50 text-blue-600 font-medium"
                    : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                <span className="text-xl">{langConfig.flag}</span>
                <span>{langConfig.name}</span>
                {language === langCode && (
                  <span className="ml-auto">✓</span>
                )}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};
