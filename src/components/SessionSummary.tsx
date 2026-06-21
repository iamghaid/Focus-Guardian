import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FocusState, TimelineEvent } from '../types';
import { formatMMSS } from '../utils';
import { Award, Zap, AlertTriangle, ShieldCheck, Play } from 'lucide-react';

interface SessionSummaryProps {
  duration: number; // in minutes
  focusPercentage: number;
  focusedSeconds: number;
  distractedSeconds: number;
  awaySeconds: number;
  distractedAlertCount: number;
  timeline: TimelineEvent[];
  onRestart: () => void;
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({
  duration,
  focusPercentage,
  focusedSeconds,
  distractedSeconds,
  awaySeconds,
  distractedAlertCount,
  timeline,
  onRestart,
}) => {
  // Motivational message
  let motivationTitle = '';
  let motivationDesc = '';
  let motivationBg = '';
  let motivationText = '';
  let motivationIcon = <Award className="w-5 h-5 text-emerald-400" />;

  if (focusPercentage >= 90) {
    motivationTitle = 'Excellent focus! 🎯';
    motivationDesc = 'Outstanding attention span! You stayed locked-in for almost the entire block. Keep this streak going.';
    motivationBg = 'bg-[#34D399]/10 border-[#34D399]/25';
    motivationText = 'text-[#34D399]';
  } else if (focusPercentage >= 70) {
    motivationTitle = 'Good session, minor drift 📈';
    motivationDesc = 'Solid production! You maintained decent accountability, with only a few minor moments of distraction.';
    motivationBg = 'bg-[#FBBF24]/10 border-[#FBBF24]/25';
    motivationText = 'text-[#FBBF24]';
    motivationIcon = <Zap className="w-5 h-5 text-amber-400" />;
  } else {
    motivationTitle = 'Lots of distractions — try a quieter space 🧘';
    motivationDesc = 'Your focus drifted significantly. Try toggling off notifications, putting your phone in another room, or taking shorter Pomodoro blocks.';
    motivationBg = 'bg-[#F87171]/10 border-[#F87171]/25';
    motivationText = 'text-[#F87171]';
    motivationIcon = <AlertTriangle className="w-5 h-5 text-red-400" />;
  }

  // Pre-process timeline events to partition entire session into 12 chronological bar chart blocks
  const buildTimelineCharts = () => {
    if (timeline.length === 0) return [];
    
    const lastEvent = timeline[timeline.length - 1];
    const totalTime = lastEvent ? lastEvent.timeOffset : duration * 60;
    
    // Create exactly 12 intervals
    const chunkCount = 12;
    const chunkSize = Math.max(1, totalTime / chunkCount);
    
    const data = [];
    
    for (let i = 0; i < chunkCount; i++) {
      const tStart = i * chunkSize;
      const tEnd = (i + 1) * chunkSize;
      const tMid = tStart + chunkSize / 2;
      
      // Find active state at tMid
      let activeState = FocusState.AWAY;
      for (const ev of timeline) {
        if (ev.timeOffset <= tMid) {
          activeState = ev.state;
        } else {
          break;
        }
      }
      
      let numericScore = 1; // AWAY
      if (activeState === FocusState.FOCUSED) numericScore = 3;
      else if (activeState === FocusState.DISTRACTED) numericScore = 2;
      
      data.push({
        num: i + 1,
        timeLabel: formatMMSS(tMid),
        score: numericScore,
        state: activeState,
      });
    }
    
    return data;
  };

  const chartData = buildTimelineCharts();

  // Speedometer Gauge ring calculations
  const r = 50;
  const c = 2 * Math.PI * r;
  // Expressing gauge as a 3/4 circle
  const dashArray = `${c * 0.75} ${c * 0.25}`;
  const strokeOffset = c * 0.75 - (focusPercentage / 100) * (c * 0.75);

  return (
    <div id="session-summary-card" className="bg-[#15151D] border border-[#2A2A35] rounded-xl p-6 shadow-2xl max-w-2xl mx-auto space-y-6 animate-fade-in relative">
      
      {/* Sparkle subtle decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#8B5CF6]/5 rounded-full blur-2xl pointer-events-none" />

      {/* Primary Row header info */}
      <div className="text-center space-y-1.5 border-b border-[#2A2A35] pb-4">
        <h2 className="font-sans font-bold text-lg text-[#F5F5F7]">Session Log Book</h2>
        <p className="font-sans text-xs text-[#9CA3AF]">Accountability performance breakdown</p>
      </div>

      {/* Gauge and metrics columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        
        {/* Speedometer Gauge column */}
        <div className="flex flex-col items-center text-center space-y-3 bg-[#0A0A0F] border border-[#2A2A35]/60 rounded-lg py-5 px-4">
          <span className="text-[10px] uppercase tracking-widest font-bold text-[#9CA3AF]">Focus Score</span>
          
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="absolute w-full h-full transform rotate-[135deg]" viewBox="0 0 120 120">
              {/* Back track arc */}
              <circle
                cx="60"
                cy="60"
                r={r}
                className="stroke-[#2A2A35]"
                strokeWidth="7"
                fill="none"
                strokeDasharray={dashArray}
                strokeLinecap="round"
              />
              {/* Foreground colored arc */}
              <circle
                cx="60"
                cy="60"
                r={r}
                className={`transition-all duration-1000 ease-out ${
                  focusPercentage >= 90 ? 'stroke-[#34D399]' :
                  focusPercentage >= 70 ? 'stroke-[#FBBF24]' : 'stroke-[#F87171]'
                }`}
                strokeWidth="8"
                fill="none"
                strokeDasharray={dashArray}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
              />
            </svg>

            {/* Centered large Score dial */}
            <div className="text-center z-10">
              <span className="block text-3xl font-extrabold tracking-tight text-[#F5F5F7] font-mono">
                {focusPercentage}%
              </span>
              <span className="block text-[8px] uppercase tracking-wider text-[#9CA3AF] mt-0.5 font-bold">
                Consistency
              </span>
            </div>
          </div>

          {/* Mini total elapsed metadata */}
          <span className="text-[10px] text-[#9CA3AF] font-medium font-sans">
            Total Session Duration: <span className="font-mono font-bold text-[#F5F5F7]">{duration} min</span>
          </span>
        </div>

        {/* Breakdown Stats Rows column */}
        <div className="space-y-3">
          
          <div className="bg-[#1C1C24] p-3 rounded-lg border border-[#2A2A35] flex justify-between items-center">
            <span className="font-sans text-xs text-[#9CA3AF] font-medium">Focused Duration</span>
            <span className="font-mono text-sm font-bold text-[#34D399]">{formatMMSS(focusedSeconds)}</span>
          </div>

          <div className="bg-[#1C1C24] p-3 rounded-lg border border-[#2A2A35] flex justify-between items-center">
            <span className="font-sans text-xs text-[#9CA3AF] font-medium">Distracted Duration</span>
            <span className="font-mono text-sm font-bold text-[#FBBF24]">{formatMMSS(distractedSeconds)}</span>
          </div>

          <div className="bg-[#1C1C24] p-3 rounded-lg border border-[#2A2A35] flex justify-between items-center">
            <span className="font-sans text-xs text-[#9CA3AF] font-medium">Stepped Away Duration</span>
            <span className="font-mono text-sm font-bold text-[#F87171]">{formatMMSS(awaySeconds)}</span>
          </div>

          <div className="bg-[#1C1C24] p-3 rounded-lg border border-[#2A2A35] flex justify-between items-center">
            <span className="font-sans text-xs text-[#9CA3AF] font-medium">Alert Notifications Played</span>
            <span className="font-mono text-sm font-bold text-red-400">{distractedAlertCount}</span>
          </div>

        </div>

      </div>

      {/* Chronological bar timeline graph */}
      <div className="bg-[#0A0A0F] border border-[#2A2A35] rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center select-none">
          <span className="text-[11px] font-bold text-[#F5F5F7]">Chronological Session Timeline</span>
          
          {/* Key labels */}
          <div className="flex space-x-2 text-[8px] uppercase tracking-wider font-bold">
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
              <span>Focus</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]" />
              <span>Distracted</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F87171]" />
              <span>Away</span>
            </span>
          </div>
        </div>

        {/* Recharts Bar graph visualization */}
        {chartData.length > 0 ? (
          <div className="h-40 w-full font-mono text-[9px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: -5 }}>
                <XAxis dataKey="timeLabel" stroke="#4B5563" tickLine={false} />
                <YAxis 
                  domain={[1, 3]} 
                  ticks={[1, 2, 3]} 
                  tickFormatter={(val) => val === 3 ? 'Focus' : val === 2 ? 'Dist' : 'Away'} 
                  stroke="#4B5563" 
                  tickLine={false} 
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const label = data.state === FocusState.FOCUSED ? 'Focused state' : data.state === FocusState.DISTRACTED ? 'Distracted state' : 'Away state';
                      const color = data.state === FocusState.FOCUSED ? 'text-[#34D399]' : data.state === FocusState.DISTRACTED ? 'text-[#FBBF24]' : 'text-[#F87171]';
                      return (
                        <div className="bg-[#15151D] border border-[#2A2A35] p-2 rounded-md shadow-lg">
                          <span className="block text-[8px] text-[#9CA3AF]">T-offset: {data.timeLabel}</span>
                          <span className={`block font-bold capitalize text-[10px] ${color}`}>{label}</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]} barSize={24}>
                  {chartData.map((entry, index) => {
                    let color = '#34D399';
                    if (entry.state === FocusState.DISTRACTED) color = '#FBBF24';
                    else if (entry.state === FocusState.AWAY) color = '#F87171';
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-[#9CA3AF]">Not enough chronological data captured</div>
        )}
      </div>

      {/* Motivation Dialogue bar */}
      <div className={`border p-4 rounded-lg flex items-start space-x-3 transition-colors duration-300 ${motivationBg}`}>
        <div className="mt-0.5 shrink-0 bg-black/30 p-1.5 rounded-md">
          {motivationIcon}
        </div>
        <div>
          <span className={`block font-sans font-bold text-xs ${motivationText}`}>{motivationTitle}</span>
          <p className="font-sans text-[11px] text-[#9CA3AF] leading-relaxed mt-1">{motivationDesc}</p>
        </div>
      </div>

      {/* Restart CTA block */}
      <div className="flex justify-center pt-2">
        <button
          onClick={onRestart}
          className="cursor-pointer bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:opacity-95 text-xs font-bold uppercase tracking-widest text-white px-8 py-3.5 rounded-lg flex items-center space-x-2 transition-all shadow-lg shadow-indigo-950/20"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Launch Next Session</span>
        </button>
      </div>

    </div>
  );
};
