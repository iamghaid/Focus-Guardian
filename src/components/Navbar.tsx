import React from 'react';
import { Eye, History, Settings, Flame } from 'lucide-react';

interface NavbarProps {
  activeTab: 'study' | 'history';
  setActiveTab: (tab: 'study' | 'history') => void;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSettings,
}) => {
  return (
    <nav className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-md border-b border-[#2A2A35] transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo & Headline */}
          <div className="flex items-center space-x-3 select-none">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-indigo-950/40">
              <Eye className="w-5 h-5 text-white animate-pulse" />
            </div>
            
            <div className="flex flex-col">
              <span className="font-sans font-extrabold text-sm text-[#F5F5F7] tracking-wider uppercase">
                Focus Guardian
              </span>
              <span className="font-sans text-[9px] tracking-wider text-[#9CA3AF]">
                Stay accountable. Stay focused.
              </span>
            </div>
          </div>

          {/* Tab navigation & settings button */}
          <div className="flex items-center space-x-4">
            
            {/* Tabs */}
            <div className="flex bg-[#15151D] border border-[#2A2A35] p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('study')}
                className={`cursor-pointer px-3.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all ${
                  activeTab === 'study'
                    ? 'bg-[#2A2A35] text-[#F5F5F7]'
                    : 'text-[#9CA3AF] hover:text-[#F5F5F7]'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`cursor-pointer px-3.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all ${
                  activeTab === 'history'
                    ? 'bg-[#2A2A35] text-[#F5F5F7]'
                    : 'text-[#9CA3AF] hover:text-[#F5F5F7]'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>History Logs</span>
              </button>
            </div>

            {/* Configure Gear */}
            <button
              onClick={onOpenSettings}
              className="cursor-pointer p-2 rounded-lg bg-[#15151D] hover:bg-[#2A2A35] border border-[#2A2A35] text-[#9CA3AF] hover:text-[#F5F5F7] transition-all"
              title="Tune parameters"
            >
              <Settings className="w-4.5 h-4.5 animate-[spin_12s_infinite_linear]" />
            </button>

          </div>

        </div>
      </div>
    </nav>
  );
};
