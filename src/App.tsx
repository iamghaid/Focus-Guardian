import { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { CameraTracker } from './components/CameraTracker';
import { PomodoroTimer } from './components/PomodoroTimer';
import { SettingsModal } from './components/SettingsModal';
import { SessionSummary } from './components/SessionSummary';
import { HistoryTab } from './components/HistoryTab';
import { FocusState, SessionHistory, Settings, TimelineEvent } from './types';
import { playAlertBeep, playSoftBeep } from './utils';
import { X, AlertCircle, Sparkles, CheckCircle2, Eye, Flame, ShieldAlert, Award } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'distracted' | 'away' | 'drowsy' | 'info' | 'success';
}

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'study' | 'history'>('study');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Load Settings from LocalStorage or default
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('focus_guardian_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.warn(e); }
    }
    return {
      focusDuration: 25,
      breakDuration: 5,
      soundEnabled: true,
      sensitivity: 2,
      theme: 'dark'
    };
  });

  // Load History from LocalStorage
  const [history, setHistory] = useState<SessionHistory[]>(() => {
    const saved = localStorage.getItem('focus_guardian_history');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.warn(e); }
    }
    return [];
  });

  // Current session states
  const [sessionMode, setSessionMode] = useState<'FOCUS' | 'BREAK'>('FOCUS');
  const [timerSeconds, setTimerSeconds] = useState(settings.focusDuration * 60);
  const [initialSeconds, setInitialSeconds] = useState(settings.focusDuration * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [focusState, setFocusState] = useState<FocusState>(FocusState.FOCUSED);
  const [isDrowsy, setIsDrowsy] = useState(false);

  // Accumulated metrics for current FOCUS session
  const [focusedSeconds, setFocusedSeconds] = useState(0);
  const [distractedSeconds, setDistractedSeconds] = useState(0);
  const [awaySeconds, setAwaySeconds] = useState(0);
  const [distractedAlertCount, setDistractedAlertCount] = useState(0);
  const [sessionTimeline, setSessionTimeline] = useState<TimelineEvent[]>([]);
  const [elapsedSecondsCount, setElapsedSecondsCount] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  // Granular distraction session trackers
  const [lookAwayCount, setLookAwayCount] = useState(0);
  const [phoneCount, setPhoneCount] = useState(0);
  const [movementCount, setMovementCount] = useState(0);

  // Chances system states
  const [phoneChancesUsed, setPhoneChancesUsed] = useState(0);
  const [movementChancesUsed, setMovementChancesUsed] = useState(0);

  // Streak counters for continuous states (seconds)
  const distractedContinuousSeconds = useRef<number>(0);
  const awayContinuousSeconds = useRef<number>(0);
  const drowsyContinuousSeconds = useRef<number>(0);

  // Refs to prevent state/prop closures in setInterval, and to prevent interval recreation every second
  const focusStateRef = useRef(focusState);
  const isDrowsyRef = useRef(isDrowsy);
  const soundEnabledRef = useRef(settings.soundEnabled);
  const sessionModeRef = useRef(sessionMode);

  useEffect(() => {
    focusStateRef.current = focusState;
  }, [focusState]);

  useEffect(() => {
    isDrowsyRef.current = isDrowsy;
  }, [isDrowsy]);

  useEffect(() => {
    soundEnabledRef.current = settings.soundEnabled;
  }, [settings.soundEnabled]);

  useEffect(() => {
    sessionModeRef.current = sessionMode;
  }, [sessionMode]);

  // Distraction trigger callbacks
  const handlePhoneOccurrence = () => {
    if (!isTimerRunning) return;
    
    // Increment total detected counts
    setPhoneCount(p => p + 1);

    setPhoneChancesUsed(prev => {
      const nextChances = prev + 1;
      
      if (nextChances === 1) {
        // 1st time: gentle on-screen message only, no sound
        addToast("I noticed your phone, let's stay focused.", "info");
      } else if (nextChances === 2) {
        // 2nd time: firmer message + soft sound
        if (soundEnabledRef.current) {
          playSoftBeep();
        }
        addToast("Phone detected again. Please put your phone aside, let's lock in! 📱", "info");
      } else {
        // 3rd time onward: full alert with loud sound + visible warning
        if (soundEnabledRef.current) {
          playAlertBeep();
        }
        addToast("Phone holding violation! Strict focus alert active 📱🚨", "distracted");
        setDistractedAlertCount(c => c + 1);
      }
      return nextChances;
    });
  };

  const handleMovementOccurrence = () => {
    if (!isTimerRunning) return;

    // Increment total movement detected counts
    setMovementCount(m => m + 1);

    const maxFreeChances = settings.sensitivity === 1 ? 3 : settings.sensitivity === 3 ? 1 : 2;

    setMovementChancesUsed(prev => {
      const nextChances = prev + 1;
      
      if (nextChances <= maxFreeChances) {
        if (nextChances === 1) {
          // 1st chance: gentle popup with no sound
          addToast("Whoa, settle down — let's get back to studying! 🏃", "info");
        } else {
          // Subsequent chances: firmer popup with soft chime sound
          if (soundEnabledRef.current) {
            playSoftBeep();
          }
          addToast(`Unusual movement? Let's stay settled and locked-in. (Chance ${nextChances}/${maxFreeChances})`, "info");
        }
      } else {
        // Exceeded free chances: full distraction alert
        if (soundEnabledRef.current) {
          playAlertBeep();
        }
        addToast("Erratic movement detected! Strict focus alert active 🚨🏃", "distracted");
        setDistractedAlertCount(c => c + 1);
      }
      return nextChances;
    });
  };

  const handleLookAwayOccurrence = () => {
    if (!isTimerRunning) return;
    setLookAwayCount(l => l + 1);
  };

  // Toast notifications manager
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'distracted' | 'away' | 'drowsy' | 'info' | 'success') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto clear after 4.5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Synchronize timer duration upon settings change (if timer is NOT currently active)
  useEffect(() => {
    if (!isTimerRunning && !showSummary) {
      const targetSeconds = (sessionMode === 'FOCUS' ? settings.focusDuration : settings.breakDuration) * 60;
      setTimerSeconds(targetSeconds);
      setInitialSeconds(targetSeconds);
    }
  }, [settings, sessionMode, isTimerRunning, showSummary]);

  // Synchronize settings save
  const handleSaveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    localStorage.setItem('focus_guardian_settings', JSON.stringify(newSettings));
    addToast('Guardian parameters successfully calibrated!', 'success');
  };

  // Handle study tracking state changes (such as automatic pauses)
  useEffect(() => {
    // If the state becomes AWAY, and timer was active, trigger immediate notification
    if (isTimerRunning && focusState === FocusState.AWAY) {
      // Note: we let the 8-second tick handle the pause as requested
    }
  }, [focusState, isTimerRunning]);

  // Main tick timer interval loop (runs every 1 second when active)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isTimerRunning) {
      // Log starting state if timeline is totally empty
      setSessionTimeline(curr => {
        if (curr.length === 0) {
          return [{ timeOffset: 0, state: focusStateRef.current }];
        }
        return curr;
      });

      interval = setInterval(() => {
        // 1. Tick down timer countdown
        setTimerSeconds(prev => {
          if (prev <= 1) {
            clearInterval(interval!);
            handleSessionComplete();
            return 0;
          }
          return prev - 1;
        });

        // 2. Accumulate chronological statistics (only during FOCUS session)
        if (sessionModeRef.current === 'FOCUS') {
          setElapsedSecondsCount(prevSec => {
            const nextSec = prevSec + 1;
            
            // Record focus state stats
            const currentState = focusStateRef.current;
            if (currentState === FocusState.FOCUSED) {
              setFocusedSeconds(f => f + 1);
              distractedContinuousSeconds.current = 0;
              awayContinuousSeconds.current = 0;
            } else if (currentState === FocusState.DISTRACTED) {
              setDistractedSeconds(d => d + 1);
              distractedContinuousSeconds.current += 1;
              awayContinuousSeconds.current = 0;

              // Since the camera tracker filters distractions and only triggers FocusState.DISTRACTED
              // after the required consecutive seconds grace period has surpassed:
              // we alert them IMMEDIATELY upon entering this state, and thereafter every 5 seconds.
              if (distractedContinuousSeconds.current === 1 || distractedContinuousSeconds.current % 5 === 0) {
                if (soundEnabledRef.current) {
                  playAlertBeep();
                }
                addToast('Stay focused! 🎯', 'distracted');
                setDistractedAlertCount(c => c + 1);
              }
            } else if (currentState === FocusState.AWAY) {
              setAwaySeconds(a => a + 1);
              awayContinuousSeconds.current += 1;
              distractedContinuousSeconds.current = 0;

              // Similarly, since the camera tracker already buffers AWAY state for several seconds,
              // we can alert and pause immediately upon state entry.
              if (awayContinuousSeconds.current === 1) {
                if (soundEnabledRef.current) {
                  playAlertBeep();
                }
                // Pause active countdown timer automatically
                setIsTimerRunning(false);
                addToast('You stepped away — timer paused ⏳', 'away');
              }
            }

            // Record eye closure drowsiness alert
            if (isDrowsyRef.current) {
              drowsyContinuousSeconds.current += 1;
              if (drowsyContinuousSeconds.current >= 4) {
                addToast('Drowsiness alert! Please rest or take a break ☕', 'drowsy');
                drowsyContinuousSeconds.current = 0;
              }
            } else {
              drowsyContinuousSeconds.current = 0;
            }

            // Capture timeline coordinates every 10 seconds for Recharts bar chart
            if (nextSec % 10 === 0) {
              setSessionTimeline(curr => [
                ...curr,
                { timeOffset: nextSec, state: currentState }
              ]);
            }

            return nextSec;
          });
        }

      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  // Session Completed / Completed Callback
  const handleSessionComplete = () => {
    setIsTimerRunning(false);

    if (sessionMode === 'FOCUS') {
      // Calculate final focus percentage
      const totalTrackedSeconds = focusedSeconds + distractedSeconds;
      const finalFocusPercentage = totalTrackedSeconds > 0
        ? Math.round((focusedSeconds / totalTrackedSeconds) * 100)
        : 100;

      // Persist to history logs
      const completedSession: SessionHistory = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        duration: settings.focusDuration,
        focusPercentage: finalFocusPercentage,
        distractedCount: distractedAlertCount,
        focusTime: focusedSeconds,
        distractedTime: distractedSeconds,
        awayTime: awaySeconds,
        timeline: sessionTimeline.length > 0 ? sessionTimeline : [{ timeOffset: elapsedSecondsCount, state: focusState }],
        lookAwayCount: lookAwayCount,
        phoneCount: phoneCount,
        movementCount: movementCount
      };

      const updatedHistory = [...history, completedSession];
      setHistory(updatedHistory);
      localStorage.setItem('focus_guardian_history', JSON.stringify(updatedHistory));

      // Show summary view
      setShowSummary(true);
      addToast('Focus block completed! Review stats 🏆', 'success');
    } else {
      // Break is complete
      addToast('Break finished! Ready to work? 💪', 'info');
      setSessionMode('FOCUS');
      setTimerSeconds(settings.focusDuration * 60);
      setInitialSeconds(settings.focusDuration * 60);
    }

    // Play double sound to signify completion
    if (settings.soundEnabled) {
      playAlertBeep();
      setTimeout(() => playAlertBeep(), 150);
    }
  };

  // Manual Reset session controls
  const handleResetSession = () => {
    setIsTimerRunning(false);
    const target = (sessionMode === 'FOCUS' ? settings.focusDuration : settings.breakDuration) * 60;
    setTimerSeconds(target);
    setInitialSeconds(target);
    
    // Clear session-specific buffers
    setFocusedSeconds(0);
    setDistractedSeconds(0);
    setAwaySeconds(0);
    setDistractedAlertCount(0);
    setSessionTimeline([]);
    setElapsedSecondsCount(0);
    distractedContinuousSeconds.current = 0;
    awayContinuousSeconds.current = 0;
    drowsyContinuousSeconds.current = 0;

    // Reset diagnostics
    setLookAwayCount(0);
    setPhoneCount(0);
    setMovementCount(0);
    setPhoneChancesUsed(0);
    setMovementChancesUsed(0);

    addToast('Session status wiped.', 'info');
  };

  // Skip focus block or break block
  const handleSkipSession = () => {
    setIsTimerRunning(false);
    if (sessionMode === 'FOCUS') {
      setSessionMode('BREAK');
      setTimerSeconds(settings.breakDuration * 60);
      setInitialSeconds(settings.breakDuration * 60);
      addToast('Skipped study focus block. Starting break period ☕', 'info');
    } else {
      setSessionMode('FOCUS');
      setTimerSeconds(settings.focusDuration * 60);
      setInitialSeconds(settings.focusDuration * 60);
      addToast('Skipped break block. Loading focus session 🎯', 'info');
    }
  };

  // Launch new session from Summary Card
  const handleRestartNewSession = () => {
    setShowSummary(false);
    setSessionMode('FOCUS');
    setTimerSeconds(settings.focusDuration * 60);
    setInitialSeconds(settings.focusDuration * 60);
    
    // Wipes session values
    setFocusedSeconds(0);
    setDistractedSeconds(0);
    setAwaySeconds(0);
    setDistractedAlertCount(0);
    setSessionTimeline([]);
    setElapsedSecondsCount(0);
    distractedContinuousSeconds.current = 0;
    awayContinuousSeconds.current = 0;
    drowsyContinuousSeconds.current = 0;

    // Reset diagnostics
    setLookAwayCount(0);
    setPhoneCount(0);
    setMovementCount(0);
    setPhoneChancesUsed(0);
    setMovementChancesUsed(0);
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you absolute sure you want to delete all historical logs? This action is permanent.')) {
      setHistory([]);
      localStorage.removeItem('focus_guardian_history');
      addToast('History logs permanently purged.', 'info');
    }
  };

  return (
    <div className={`min-h-screen bg-[#0A0A0F] text-[#F5F5F7] flex flex-col relative pb-12 transition-all selection:bg-indigo-600/30 selection:text-white ${settings.theme === 'light' ? 'light-theme' : ''}`}>
      
      {/* Absolute floating stack top-right toast tracker */}
      <div id="toast-tracker-overlay" className="fixed top-4 right-4 z-50 flex flex-col space-y-2 max-w-sm w-full font-sans select-none pointer-events-none">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto p-4 rounded-xl border flex items-start space-x-3 shadow-2xl animate-fade-in transition-all duration-300 ${
              item.type === 'distracted' ? 'bg-[#15151D] border-[#FBBF24]/30 text-[#FBBF24] shadow-[#FBBF24]/5' :
              item.type === 'away' ? 'bg-[#15151D] border-[#F87171]/40 text-[#F87171] shadow-[#F87171]/5' :
              item.type === 'drowsy' ? 'bg-[#15151D] border-[#8B5CF6]/45 text-[#F5F5F7]' :
              item.type === 'success' ? 'bg-[#15151D] border-emerald-500/40 text-emerald-400' :
              'bg-[#15151D] border-[#2A2A35] text-[#9CA3AF]'
            }`}
          >
            <div className="shrink-0 pt-0.5">
              {item.type === 'distracted' ? <AlertCircle className="w-4 h-4 text-[#FBBF24]" /> :
               item.type === 'away' ? <AlertCircle className="w-4 h-4 text-[#F87171]" /> :
               item.type === 'drowsy' ? <ShieldAlert className="w-4 h-4 text-[#8B5CF6]" /> :
               item.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
               <Sparkles className="w-4 h-4 text-[#8B5CF6]" />}
            </div>
            <div className="flex-1">
              <span className="block text-xs font-semibold">{item.message}</span>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== item.id))}
              className="shrink-0 text-gray-500 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* App Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          // If jumping out of active tracking, pause it
          if (tab === 'history') {
            setIsTimerRunning(false);
          }
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Container Layout */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full">
        {activeTab === 'study' ? (
          showSummary ? (
            <div className="animate-scale-up">
              <SessionSummary
                duration={settings.focusDuration}
                focusPercentage={history[history.length - 1]?.focusPercentage || 100}
                focusedSeconds={focusedSeconds}
                distractedSeconds={distractedSeconds}
                awaySeconds={awaySeconds}
                distractedAlertCount={distractedAlertCount}
                timeline={sessionTimeline}
                onRestart={handleRestartNewSession}
                lookAwayCount={lookAwayCount}
                phoneCount={phoneCount}
                movementCount={movementCount}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
              
              {/* Left Feed & stats Column (~60%) */}
              <div className="lg:col-span-3 space-y-4">
                <CameraTracker
                  currentState={focusState}
                  onStateChange={(state) => setFocusState(state)}
                  onDrowsinessChange={(drowsy) => setIsDrowsy(drowsy)}
                  sensitivity={settings.sensitivity}
                  onPhoneOccurrence={handlePhoneOccurrence}
                  onMovementOccurrence={handleMovementOccurrence}
                  onLookAwayOccurrence={handleLookAwayOccurrence}
                />
              </div>

              {/* Right Timer Column (~40%) */}
              <div className="lg:col-span-2">
                <PomodoroTimer
                  timerSeconds={timerSeconds}
                  initialSeconds={initialSeconds}
                  isTimerRunning={isTimerRunning}
                  sessionMode={sessionMode}
                  onStart={() => setIsTimerRunning(true)}
                  onPause={() => setIsTimerRunning(false)}
                  onReset={handleResetSession}
                  onSkip={handleSkipSession}
                  focusSecondsAccumulated={focusedSeconds}
                  distractedSecondsAccumulated={distractedSeconds}
                  totalElapsedSeconds={elapsedSecondsCount}
                />
              </div>

            </div>
          )
        ) : (
          <HistoryTab
            history={history}
            onClearHistory={handleClearHistory}
            onBrowseDashboard={() => setActiveTab('study')}
          />
        )}
      </main>

      {/* Settings Dialog Overlay */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

    </div>
  );
}
