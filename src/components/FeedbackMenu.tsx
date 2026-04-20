import { useState } from 'react';
import { Check, ChevronRight, Copy, Mail } from 'lucide-react';

type FeedbackMenuProps = {
  email: string;
  threadsUrl: string;
  instagramUrl: string;
  xiaohongshuUrl: string;
};

export function FeedbackMenu({
  email,
  threadsUrl,
  instagramUrl,
  xiaohongshuUrl,
}: FeedbackMenuProps) {
  const [open, setOpen] = useState(false);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const handleCopyFeedback = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedItem(label);
      window.setTimeout(() => {
        setCopiedItem((current) => (current === label ? null : current));
      }, 1800);
    } catch {
      window.prompt('Copy this:', value);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-2 text-gray-700 transition-all hover:bg-gray-100 active:scale-95"
        title="Feedback"
      >
        <Mail size={16} className="text-gray-500 group-hover:text-emerald-600 transition-colors" />
        <span className="text-[10px] font-black uppercase tracking-[0.18em] sm:text-[11px]">Feedback</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-[250px] rounded-3xl border border-gray-100 bg-white p-3 shadow-2xl">
            <div className="mb-2 px-1">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Contact</div>
              <div className="mt-1 text-[11px] font-bold text-gray-500">Send feedback or say hi</div>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void handleCopyFeedback('email', email)}
                className="flex w-full items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-left text-sm font-bold text-gray-800 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
              >
                <span>Email</span>
                <span className="flex items-center gap-2 text-[11px] text-gray-400">
                  <span>{copiedItem === 'email' ? 'Copied' : email}</span>
                  {copiedItem === 'email' ? <Check size={14} /> : <Copy size={14} />}
                </span>
              </button>
              <a
                href={threadsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-800 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
              >
                <span>Threads</span>
                <ChevronRight size={16} className="text-gray-400" />
              </a>
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-800 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
              >
                <span>Instagram</span>
                <ChevronRight size={16} className="text-gray-400" />
              </a>
              <a
                href={xiaohongshuUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-800 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
              >
                <span>Xiaohongshu</span>
                <ChevronRight size={16} className="text-gray-400" />
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
