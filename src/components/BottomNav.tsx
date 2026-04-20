import { forwardRef } from 'react';
import { motion } from 'motion/react';
import { Palette, Target, Video } from 'lucide-react';

type BottomNavTab = 'background' | 'elements' | 'video';

type BottomNavProps = {
  activeTab: BottomNavTab | null;
  onTabChange: (tab: BottomNavTab | null) => void;
  labels: {
    background: string;
    elements: string;
    video: string;
  };
};

export const BottomNav = forwardRef<HTMLElement, BottomNavProps>(function BottomNav(
  { activeTab, onTabChange, labels },
  ref
) {
  const renderTabButton = (
    id: BottomNavTab,
    icon: React.ReactNode,
    label: string
  ) => (
    <button
      type="button"
      onClick={() => onTabChange(activeTab === id ? null : id)}
      className={`flex-1 flex flex-col items-center py-3 space-y-1 transition-all relative ${
        activeTab === id ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      {id === 'video' && <span className="text-[7px] font-bold text-gray-400">Beta</span>}
      {activeTab === id && (
        <motion.div
          layoutId="tab-indicator"
          className="absolute bottom-0 w-8 h-1 bg-green-500 rounded-t-full"
        />
      )}
    </button>
  );

  return (
    <nav
      ref={ref}
      className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-2xl border-t border-gray-100 pb-safe z-50"
    >
      <div className="flex justify-around items-center h-14 px-4">
        {renderTabButton('background', <Palette size={22} />, labels.background)}
        {renderTabButton('elements', <Target size={22} />, labels.elements)}
        {renderTabButton('video', <Video size={22} />, labels.video)}
      </div>
    </nav>
  );
});
