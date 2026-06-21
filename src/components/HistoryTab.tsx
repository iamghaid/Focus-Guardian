import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Calendar, Trash2, Award, Zap, AlertTriangle, TrendingUp, History } from 'lucide-react';
import { SessionHistory } from '../types';
import { formatDate } from '../utils';

interface HistoryTabProps {
  history: SessionHistory[];
  onClearHistory: () => void;
  onBrowseDashboard: () => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  history,
  onClearHistory,
  onBrowseDashboard,
}) => {
  // Empty State
  if (history.length === 0) {
    return (
      <div id="history-empty-state" className="max-w-md mx-auto py-16 text-center space-y-5 animate-fade-in">
        <div className="w-16 h-16 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-full flex items-center justify-center mx-auto shadow-md border border-[#8B5CF6]/15">
          <History className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h3 className="font-sans font-bold text-[#F5F5F7] text-md">Quiet Archives</h3>
          <p className="font-sans text-xs text-[#9CA3AF]">
            You haven't recorded any study sessions yet. Your statistics, focus ratios, and timelines will accumulate here.
          </p>
        </div>
        <button
          onClick={onBrowseDashboard}
          className="cursor-pointer bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-xs font-bold uppercase tracking-widest text-white px-5 py-3 rounded-lg transition-all hover:opacity-95 shadow-md shadow-indigo-950/20"
        >
          Initialize First Session
        </button>
      </div>
    );
  }

  // Pre-process trend chart data: last 7 sessions
  const trendData = [...history]
    .slice(-7)
    .map((item, idx) => ({
      index: idx + 1,
      shortDate: new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      percentage: item.focusPercentage,
      duration: item.duration,
      distractedCount: item.distractedCount,
    }));

  // General calculated metrics
  const avgFocusScore = Math.round(history.reduce((acc, cv) => acc + cv.focusPercentage, 0) / history.length);
  const totalSecondsFocused = history.reduce((acc, cv) => acc + cv.focusTime, 0);
  const totalMinutesFocused = Math.round(totalSecondsFocused / 60);
  const totalAlertsSounded = history.reduce((acc, cv) => acc + cv.distractedCount, 0);

  return (
    <div id="history-tab" className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      
      {/* Top Cards General Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Metric 1 */}
        <div className="bg-[#15151D] border border-[#2A2A35] p-4 rounded-xl flex items-center space-x-3 shadow-md relative overflow-hidden">
          <div className="p-2.5 bg-[#34D399]/10 text-[#34D399] rounded-lg border border-[#34D399]/20">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF]">Mean Focus Score</span>
            <span className={`block font-mono text-xl font-extrabold mt-0.5 ${
              avgFocusScore >= 85 ? 'text-[#34D399]' :
              avgFocusScore >= 70 ? 'text-[#FBBF24]' : 'text-[#F87171]'
            }`}>
              {avgFocusScore}%
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#15151D] border border-[#2A2A35] p-4 rounded-xl flex items-center space-x-3 shadow-md relative overflow-hidden">
          <div className="p-2.5 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-lg border border-[#8B5CF6]/20">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF]">Focus Invested</span>
            <span className="block font-mono text-xl font-extrabold text-[#F5F5F7] mt-0.5">
              {totalMinutesFocused} min
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#15151D] border border-[#2A2A35] p-4 rounded-xl flex items-center space-x-3 shadow-md relative overflow-hidden">
          <div className="p-2.5 bg-red-400/10 text-red-400 rounded-lg border border-red-400/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold tracking-wider text-[#9CA3AF]">Alerts Triggered</span>
            <span className="block font-mono text-xl font-extrabold text-[#F5F5F7] mt-0.5">
              {totalAlertsSounded} times
            </span>
          </div>
        </div>

      </div>

      {/* Main Charts Trend layout */}
      <div className="bg-[#15151D] border border-[#2A2A35] rounded-xl p-5 shadow-xl space-y-4">
        
        <div className="flex justify-between items-center select-none pb-2 border-b border-[#2A2A35]">
          <div className="space-y-0.5">
            <h3 className="font-sans font-semibold text-sm text-[#F5F5F7]">Acuity Performance Trends</h3>
            <p className="font-sans text-[10px] text-[#9CA3AF]">Focus score percentage trend over last 7 logged study blocks</p>
          </div>
          
          <button
            onClick={onClearHistory}
            className="cursor-pointer text-[10px] font-bold text-red-400 hover:text-red-300 transition-all flex items-center space-x-1 border border-red-500/15 hover:border-red-500/45 px-2.5 py-1.5 rounded bg-red-500/5 h-fit"
            title="Clear saved stats"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Erasure</span>
          </button>
        </div>

        {/* Recharts LineChart */}
        <div className="h-56 w-full font-mono text-[9px] pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 10, right: 15, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A35" opacity={0.4} />
              <XAxis dataKey="shortDate" stroke="#4B5563" tickLine={false} />
              <YAxis domain={[0, 100]} stroke="#4B5563" tickLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-[#15151D] border border-[#2A2A35] p-2.5 rounded-lg shadow-xl text-left space-y-1">
                        <span className="block text-[10px] font-bold text-[#F5F5F7]">{data.shortDate}</span>
                        <span className="block text-[9px] text-[#9CA3AF]">Ratio Score: <span className="text-[#34D399] font-bold">{data.percentage}%</span></span>
                        <span className="block text-[9px] text-[#9CA3AF]">Duration: <span className="text-white font-bold">{data.duration} min</span></span>
                        <span className="block text-[9px] text-[#9CA3AF]">Distractions: <span className="text-amber-400 font-bold">{data.distractedCount}</span></span>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="percentage"
                stroke="#8B5CF6"
                strokeWidth={3}
                dot={{ fill: '#8B5CF6', stroke: '#15151D', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* Database Session List */}
      <div className="bg-[#15151D] border border-[#2A2A35] rounded-xl shadow-xl overflow-hidden">
        
        {/* Header Title */}
        <div className="p-4 border-b border-[#2A2A35] bg-[#0A0A0F] flex items-center space-x-2">
          <History className="w-4 h-4 text-[#8B5CF6]" />
          <h3 className="font-sans font-semibold text-sm text-[#F5F5F7]">Historical Registry log</h3>
        </div>

        {/* Entries Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-xs">
            <thead>
              <tr className="bg-[#0A0A0F] border-b border-[#2A2A35] text-[#9CA3AF] text-[9px] font-bold uppercase tracking-wider">
                <th className="p-4 flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#9CA3AF]" />
                  <span>Date Started</span>
                </th>
                <th className="p-4">Target Duration</th>
                <th className="p-4">Focus Score</th>
                <th className="p-4">Focus invest (seconds)</th>
                <th className="p-4 text-center">Alerts Sounded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A35]/65">
              {[...history].reverse().map((item) => (
                <tr key={item.id} className="hover:bg-[#1C1C24]/30 transition-colors">
                  <td className="p-4 text-[#F5F5F7] font-medium">{formatDate(item.date)}</td>
                  <td className="p-4 text-gray-400 font-mono">{item.duration} min</td>
                  <td className="p-4">
                    <span className={`font-mono font-bold px-2.5 py-1 rounded inline-block text-[11px] ${
                      item.focusPercentage >= 90 ? 'bg-[#34D399]/10 text-[#34D399]' :
                      item.focusPercentage >= 70 ? 'bg-[#FBBF24]/10 text-[#FBBF24]' : 'bg-[#F87171]/10 text-[#F87171]'
                    }`}>
                      {item.focusPercentage}%
                    </span>
                  </td>
                  <td className="p-4 text-gray-400 font-mono">
                    {Math.round(item.focusTime)}s
                  </td>
                  <td className="p-4 font-mono font-bold text-center text-red-400/90">
                    {item.distractedCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};
