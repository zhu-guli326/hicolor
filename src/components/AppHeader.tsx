import { useState } from 'react';
import { Download, Globe, Upload } from 'lucide-react';
import { FeedbackMenu } from './FeedbackMenu';
import { LOCALE_LABELS, type Locale } from '../i18n';

type AppHeaderProps = {
  image: HTMLImageElement | null;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  onSave: () => void;
  uploadTitle: string;
  languageTitle: string;
  exportLabel: string;
};

export function AppHeader({
  image,
  locale,
  setLocale,
  onSave,
  uploadTitle,
  languageTitle,
  exportLabel,
}: AppHeaderProps) {
  const [showLangMenu, setShowLangMenu] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex min-h-14 items-center justify-between border-b border-gray-100 bg-white/80 px-3 pt-[max(0px,env(safe-area-inset-top))] pb-2 backdrop-blur-xl sm:min-h-16 sm:px-6 sm:pb-0">
      <div className="flex items-center">
        <a
          href="https://www.xiaohongshu.com/user/profile/57b3456c82ec3947f79496e9"
          target="_blank"
          rel="noopener noreferrer"
          className="text-lg font-black tracking-tighter text-gray-900 italic leading-none sm:text-xl hover:text-emerald-600 transition-colors cursor-pointer"
          title="访问小红书"
        >
          hicolor
        </a>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <FeedbackMenu
          email="juguli326@gmail.com"
          threadsUrl="https://www.threads.com/@ajuju.326"
          instagramUrl="https://www.instagram.com/ajuju.326/"
          xiaohongshuUrl="https://www.xiaohongshu.com/user/profile/57b3456c82ec3947f79496e9"
        />
        <div className="relative">
          <button
            onClick={() => setShowLangMenu((v) => !v)}
            className="rounded-full bg-gray-50 p-2 text-gray-600 transition-all hover:bg-gray-100 active:scale-90"
            title={languageTitle}
          >
            <Globe size={18} />
          </button>
          {showLangMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
              <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 min-w-[140px]">
                {(Object.entries(LOCALE_LABELS) as [Locale, string][]).map(([l, label]) => (
                  <button
                    key={l}
                    onClick={() => {
                      setLocale(l);
                      setShowLangMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-[13px] font-bold transition-colors ${
                      locale === l ? 'text-emerald-600 bg-emerald-50' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <label
          htmlFor="main-image-upload"
          className="cursor-pointer rounded-full bg-gray-50 p-2 text-gray-600 transition-all hover:bg-gray-100 active:scale-90 sm:p-2.5"
          title={uploadTitle}
        >
          <Upload size={20} />
        </label>
        {image && (
          <button
            onClick={onSave}
            className="group flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-700 active:scale-95 sm:gap-2 sm:px-6 sm:py-2.5"
            title={exportLabel}
          >
            <Download size={18} className="transition-transform group-hover:translate-y-0.5 sm:size-5" />
            <span className="text-[11px] font-black uppercase tracking-widest sm:text-[13px]">{exportLabel}</span>
          </button>
        )}
      </div>
    </header>
  );
}
