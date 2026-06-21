import React, { useState } from 'react';
import { X, Settings, Sliders, Volume2, VolumeX, Flame, Zap } from 'lucide-react';
import { Settings as SettingsType } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SettingsType;
  onSave: (newSettings: SettingsType) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [focusDur, setFocusDur] = useState(settings.focusDuration);
  const [breakDur, setBreakDur] = useState(settings.breakDuration);
  const [soundOn, setSoundOn] = useState(settings.soundEnabled);
  const [sens, setSens] = useState(settings.sensitivity);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      focusDuration: Math.max(1, focusDur),
      breakDuration: Math.max(1, breakDur),
      soundEnabled: soundOn,
      sensitivity: sens,
    });
    onClose();
  };

  return (
    <div id="settings-modal-backdrop" className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
      
      <div 
        id="settings-modal-card" 
        className="bg-[#15151D] border border-[#2A2A35] rounded-xl w-full max-w-md overflow-hidden relative shadow-2xl animate-[scale-up_0.3s_ease-out]"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-[#2A2A35] bg-[#0A0A0F]">
          <div className="flex items-center space-x-2">
            <Settings className="w-4 h-4 text-[#8B5CF6]" />
            <h2 className="font-sans font-semibold text-sm text-[#F5F5F7]">Configure Guardian</h2>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer text-[#9CA3AF] hover:text-[#F5F5F7] p-1.5 rounded-lg hover:bg-[#2A2A35]/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-5">
          
          {/* Pomodoro Durations */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                <Flame className="w-3 h-3 text-[#6366F1]" />
                <span>Focus Block (min)</span>
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={focusDur}
                onChange={(e) => setFocusDur(parseInt(e.target.value) || 25)}
                className="w-full bg-[#0A0A0F] border border-[#2A2A35] text-[#F5F5F7] rounded-lg px-3 py-2 font-mono text-sm outline-none focus:ring-1 focus:ring-[#8B5CF6] focus:border-[#8B5CF6]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                <Zap className="w-3 h-3 text-[#10B981]" />
                <span>Break Block (min)</span>
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={breakDur}
                onChange={(e) => setBreakDur(parseInt(e.target.value) || 5)}
                className="w-full bg-[#0A0A0F] border border-[#2A2A35] text-[#F5F5F7] rounded-lg px-3 py-2 font-mono text-sm outline-none focus:ring-1 focus:ring-[#8B5CF6] focus:border-[#8B5CF6]"
              />
            </div>
          </div>

          {/* Alert Noise Switcher */}
          <div className="bg-[#0A0A0F] border border-[#2A2A35]/60 p-4 rounded-lg flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="block font-sans text-xs font-semibold text-[#F5F5F7]">Sound Alerts</span>
              <span className="block font-sans text-[10px] text-[#9CA3AF]">Web Audio API beep on continuous deviation</span>
            </div>
            
            <button
              type="button"
              onClick={() => setSoundOn(!soundOn)}
              className={`cursor-pointer px-3 py-2 rounded-lg flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider transition-all border ${
                soundOn
                  ? 'bg-[#8B5CF6]/15 border-[#8B5CF6] text-[#8B5CF6]'
                  : 'bg-[#2A2A35]/20 border-[#2A2A35] text-[#9CA3AF]'
              }`}
            >
              {soundOn ? (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span>On</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span>Off</span>
                </>
              )}
            </button>
          </div>

          {/* Distraction sensitivity slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold text-[#F5F5F7]">
              <span className="flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>AI Head Turn Sensitivity</span>
              </span>
              <span className="text-[#8B5CF6] font-bold font-mono">Lvl {sens}</span>
            </div>
            
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={sens}
              onChange={(e) => setSens(parseInt(e.target.value))}
              className="w-full h-1 bg-[#1C1C24] rounded-lg appearance-none cursor-pointer accent-[#8B5CF6]"
            />
            
            <div className="flex justify-between text-[8px] text-[#9CA3AF] uppercase font-bold px-1 select-none">
              <span>Lazy (Hard to trigger)</span>
              <span>Ultra Strict (Tight Ratio)</span>
            </div>
          </div>

          {/* Footer Save & Cancel Buttons */}
          <div className="flex items-center space-x-3 pt-3 border-t border-[#2A2A35]">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer flex-1 py-2.5 rounded-lg border border-[#2A2A35] text-xs font-bold uppercase tracking-widest text-[#9CA3AF] hover:bg-[#2A2A35]/40 hover:text-[#F5F5F7] transition-all"
            >
              Discard
            </button>
            <button
              type="submit"
              className="cursor-pointer flex-1 py-2.5 rounded-lg bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:opacity-95 text-xs font-bold uppercase tracking-widest text-white transition-all shadow-md shadow-indigo-950/20"
            >
              Apply Change
            </button>
          </div>

        </form>
      </div>

    </div>
  );
};
