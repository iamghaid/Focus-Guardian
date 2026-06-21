import React from 'react';
import { Play, Pause, RotateCcw, SkipForward, Timer, Award, Activity, ShieldAlert } from 'lucide-react';
import { FocusState } from '../types';
import { formatMMSS } from '../utils';

interface PomodoroTimerProps {
  timerSeconds: number;
  initialSeconds: number;
  isTimerRunning: boolean;
  sessionMode: 'FOCUS' | 'BREAK';
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSkip: () => void;
  
  // Accumulated stats
  focusSecondsAccumulated: number;
  distractedSecondsAccumulated: number;
  totalElapsedSeconds: number;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  timerSeconds,
  initialSeconds,
  isTimerRunning,
  sessionMode,
  onStart,
  onPause,
  onReset,
  onSkip,
  focusSecondsAccumulated,
  distractedSecondsAccumulated,
  totalElapsedSeconds,
}) => {
  // Circular ring measurements
  const radius = 90;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate percentage of timer completed
  const elapsedPercent = initialSeconds > 0 
    ? ((initialSeconds - timerSeconds) / initialSeconds) * 100 
    : 0;

  const strokeDashoffset = circumference - (elapsedPercent / 100) * circumference;

  // Calculate live focus percentage: focusTime / (focusTime + distractedTime) * 100
  // Note: if no elapsed time or stats yet, show 100%
  const totalTrackedSeconds = focusSecondsAccumulated + distractedSecondsAccumulated;
  const liveFocusPercentage = totalTrackedSeconds > 0
    ? Math.round((focusSecondsAccumulated / totalTrackedSeconds) * 100)
    : 100;

  return (
    <div id="pomodoro-timer-panel" className="bg-[#15151D] border border-[#2A2A35] rounded-xl p-6 shadow-xl flex flex-col justify-between items-center space-y-6 relative overflow-hidden">
      
      {/* Decorative backdrop glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#8B5CF6]/5 rounded-full blur-2xl pointer-events-none" />
      
      {/* Modes Tab Header */}
      <div className="flex bg-[#0A0A0F] border border-[#2A2A35] p-1.5 rounded-lg w-full max-w-[280px]">
        <div className={`flex-1 text-center py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all duration-300 ${
          sessionMode === 'FOCUS' 
            ? 'bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white shadow-md' 
            : 'text-[#9CA3AF]'
        }`}>
          Focus Block
        </div>
        <div className={`flex-1 text-center py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all duration-300 ${
          sessionMode === 'BREAK' 
            ? 'bg-gradient-to-r from-[#10B981] to-[#059669] text-white shadow-md' 
            : 'text-[#9CA3AF]'
        }`}>
          Break Period
        </div>
      </div>

      {/* SVG Circular Ring and Timer Digit */}
      <div className="relative flex items-center justify-center w-56 h-56 mt-2">
        
        {/* SVG Ring Container */}
        <svg className="absolute transform -rotate-90 w-full h-full" viewBox="0 0 200 200">
          {/* Static Background circle */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            className="stroke-[#2A2A35]"
            strokeWidth={stroke - 2}
            fill="transparent"
          />
          {/* Animated active boundary filling circle */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            className={`transition-all duration-500 ease-out ${
              sessionMode === 'FOCUS' ? 'stroke-[#6366F1]' : 'stroke-[#10B981]'
            }`}
            strokeWidth={stroke}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Core numbers inside circle */}
        <div className="text-center z-10 flex flex-col items-center">
          <Timer className={`w-5 h-5 mb-1 ${sessionMode === 'FOCUS' ? 'text-[#8B5CF6]' : 'text-[#10B981]'}`} />
          <span className="font-mono text-4xl font-bold tracking-tight text-[#F5F5F7] select-none">
            {formatMMSS(timerSeconds)}
          </span>
          <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mt-1">
            {isTimerRunning ? 'STAY SECURE' : 'PAUSED'}
          </span>
        </div>
      </div>

      {/* Primary Action Button Controllers */}
      <div className="flex items-center space-x-3 w-full max-w-[280px]">
        {/* Reset Trigger */}
        <button
          onClick={onReset}
          className="cursor-pointer p-3 rounded-lg bg-[#2A2A35] hover:bg-[#3E3E4B] text-[#9CA3AF] hover:text-[#F5F5F7] transition-all flex-1 flex justify-center"
          title="Reset Block"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Toggle Ticking (Start/Pause) */}
        <button
          onClick={isTimerRunning ? onPause : onStart}
          className={`cursor-pointer font-sans py-3 px-6 rounded-lg text-xs font-bold uppercase tracking-widest text-white flex-1.5 flex items-center justify-center space-x-1.5 transition-all duration-300 shadow-md ${
            isTimerRunning 
              ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/10' 
              : 'bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:opacity-95 shadow-indigo-900/10'
          }`}
        >
          {isTimerRunning ? (
            <>
              <Pause className="w-4 h-4 text-white fill-white" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 text-white fill-white" />
              <span>Start</span>
            </>
          )}
        </button>

        {/* Skip Forward */}
        <button
          onClick={onSkip}
          className="cursor-pointer p-3 rounded-lg bg-[#2A2A35] hover:bg-[#3E3E4B] text-[#9CA3AF] hover:text-[#F5F5F7] transition-all flex-1 flex justify-center"
          title="Skip to next"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Live Session Statistics Panel */}
      <div className="w-full bg-[#0A0A0F] border border-[#2A2A35]/60 rounded-lg p-4 grid grid-cols-3 gap-2 text-center relative overflow-hidden">
        
        {/* Stat: Focused Block */}
        <div className="flex flex-col items-center">
          <Award className="w-3.5 h-3.5 text-[#34D399] mb-1" />
          <span className="text-[9px] uppercase tracking-wider text-[#9CA3AF]">Focus time</span>
          <span className="font-mono text-xs font-bold text-[#F5F5F7] mt-0.5">
            {formatMMSS(focusSecondsAccumulated)}
          </span>
        </div>

        {/* Stat: Distracted Block */}
        <div className="flex flex-col items-center border-x border-[#2A2A35]/60">
          <ShieldAlert className="w-3.5 h-3.5 text-[#FBBF24] mb-1" />
          <span className="text-[9px] uppercase tracking-wider text-[#9CA3AF]">Distracted</span>
          <span className="font-mono text-xs font-bold text-[#F5F5F7] mt-0.5">
            {formatMMSS(distractedSecondsAccumulated)}
          </span>
        </div>

        {/* Stat: Focus percentage */}
        <div className="flex flex-col items-center">
          <Activity className="w-3.5 h-3.5 text-[#8B5CF6] mb-1" />
          <span className="text-[9px] uppercase tracking-wider text-[#9CA3AF]">Ratio</span>
          <span className={`font-mono text-xs font-bold mt-0.5 ${
            liveFocusPercentage >= 85 ? 'text-[#34D399]' :
            liveFocusPercentage >= 70 ? 'text-[#FBBF24]' : 'text-[#F87171]'
          }`}>
            {liveFocusPercentage}%
          </span>
        </div>
      </div>

    </div>
  );
};
