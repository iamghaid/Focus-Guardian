import React, { useEffect, useRef, useState } from 'react';
import { Camera, AlertCircle, ShieldCheck, RefreshCw, Eye, Sliders } from 'lucide-react';
import { FocusState } from '../types';

interface CameraTrackerProps {
  currentState: FocusState;
  onStateChange: (state: FocusState) => void;
  onDrowsinessChange: (isDrowsy: boolean) => void;
  sensitivity: number; // 1 to 10
}

export const CameraTracker: React.FC<CameraTrackerProps> = ({
  currentState,
  onStateChange,
  onDrowsinessChange,
  sensitivity,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState('Initializing tracker...');
  const [cameraAllowed, setCameraAllowed] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Real or Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedSetting, setSimulatedSetting] = useState<FocusState>(FocusState.FOCUSED);
  const [simulatedDrowsy, setSimulatedDrowsy] = useState(false);

  // Model statuses
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Metrics for visualization
  const [currentEAR, setCurrentEAR] = useState<number | null>(null);
  const [currentAsymmetry, setCurrentAsymmetry] = useState<number | null>(null);
  const [facePositionOffset, setFacePositionOffset] = useState<number | null>(null);

  // Timers and stream references
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastStateRef = useRef<FocusState>(currentState);
  const awayTimerStartRef = useRef<number | null>(null); // To buffer AWAY state until > 4 seconds

  // Keep track of state transitions in refs to avoid double triggers
  useEffect(() => {
    lastStateRef.current = currentState;
  }, [currentState]);

  // Load face-api.js from CDN dynamically
  useEffect(() => {
    let active = true;

    async function loadFaceApi() {
      try {
        setLoadingProgress('Connecting to computer vision server...');
        
        // Load the main script if it doesn't exist
        if (!(window as any).faceapi) {
          const cdnUrls = [
            'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js',
            'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.3.0/dist/face-api.js',
            'https://unpkg.com/@vladmandic/face-api/dist/face-api.js'
          ];
          
          let scriptLoaded = false;
          let lastScriptError: any = null;
          
          for (const url of cdnUrls) {
            if (!active) return;
            try {
              setLoadingProgress(`Loading core face-processing library...`);
              const script = document.createElement('script');
              script.src = url;
              script.async = true;
              
              await new Promise<void>((resolve, reject) => {
                script.onload = () => resolve();
                script.onerror = () => reject(new Error(`Failed to load ${url}`));
                document.head.appendChild(script);
              });
              
              if ((window as any).faceapi) {
                scriptLoaded = true;
                break;
              }
            } catch (err) {
              lastScriptError = err;
              console.warn(`CDN URL failed: ${url}. Attempting next backup CDN...`);
            }
          }
          
          if (!scriptLoaded) {
            throw lastScriptError || new Error('Failed to download computer vision engine from any available CDN source.');
          }
        }

        if (!active) return;

        const faceapi = (window as any).faceapi;
        if (!faceapi) {
          throw new Error('Face-API could not be loaded into memory.');
        }

        // Load tinyFaceDetector and faceLandmark68Net
        setLoadingProgress('Loading neural network models...');
        
        const modelUris = [
          'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/',
          'https://unpkg.com/@vladmandic/face-api/model/'
        ];
        
        let modelsLoadedSuccessfully = false;
        let lastModelError: any = null;
        
        for (const uri of modelUris) {
          if (!active) return;
          try {
            setLoadingProgress(`Downloading face tracking neural models...`);
            await Promise.all([
              faceapi.nets.tinyFaceDetector.loadFromUri(uri),
              faceapi.nets.faceLandmark68Net.loadFromUri(uri)
            ]);
            modelsLoadedSuccessfully = true;
            break;
          } catch (err) {
            lastModelError = err;
            console.warn(`Model loading failed from: ${uri}. Attempting next backup source...`);
          }
        }
        
        if (!modelsLoadedSuccessfully) {
          throw lastModelError || new Error('Neural network models failed to download from any available CDN source.');
        }

        if (!active) return;
        setModelsLoaded(true);
        setLoading(false);
        setLoadingProgress('');
        
        // Try starting camera
        startCamera();
      } catch (err: any) {
        console.error('Failed to initialize Face-API tracker:', err);
        if (active) {
          setErrorMessage(err.message || 'Failed to load face detection library. Check your network.');
          setLoading(false);
          // Auto fallback to simulator so app compiles and is fully testable!
          setIsSimulating(true);
        }
      }
    }

    loadFaceApi();

    return () => {
      active = false;
      stopCameraAndTracking();
    };
  }, []);

  // Set up camera
  async function startCamera() {
    try {
      setErrorMessage(null);
      if (streamRef.current) {
        stopCameraAndTracking();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.warn(e));
          setCameraAllowed(true);
          startFaceTracking();
        };
      }
    } catch (err: any) {
      console.warn('Webcam permission denied or unavailable:', err);
      setCameraAllowed(false);
      setErrorMessage('Camera access was denied or is unavailable. Fallback to study simulation mode is enabled.');
      setIsSimulating(true);
    }
  }

  function stopCameraAndTracking() {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }

  // Start face detection loop
  function startFaceTracking() {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }

    const faceapi = (window as any).faceapi;
    if (!faceapi) return;

    detectionIntervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended || isSimulating) return;

      try {
        // Detect single face with landmarks using optimized tiny face detector options
        // We set inputSize to 160 for maximum performance/low resource usage while keeping accuracy
        const detection = await faceapi.detectSingleFace(
          video,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 })
        ).withFaceLandmarks(true);

        if (!detection) {
          // NO FACE DETECTED
          setCurrentEAR(null);
          setCurrentAsymmetry(null);
          setFacePositionOffset(null);
          onDrowsinessChange(false);

          // Buffer AWAY state: Only declare AWAY if no face detected for more than 4 seconds
          if (awayTimerStartRef.current === null) {
            awayTimerStartRef.current = Date.now();
          } else {
            const timeWithoutFace = Date.now() - awayTimerStartRef.current;
            if (timeWithoutFace >= 4000) {
              onStateChange(FocusState.AWAY);
            }
          }
          return;
        }

        // Face found! Reset AWAY buffer timer
        awayTimerStartRef.current = null;

        const landmarks = detection.landmarks;
        const positions = landmarks.positions;

        // Jaw outline left (index 0) to right (index 16)
        const jawLeft = positions[0];
        const jawRight = positions[16];
        const nosePoint = positions[30]; // nose tip

        const leftDist = Math.abs(nosePoint.x - jawLeft.x);
        const rightDist = Math.abs(jawRight.x - nosePoint.x);
        
        // Average eye aspect ratio (EAR) for drowsiness
        // Left eye landmarks: 36 - 41
        // Right eye landmarks: 42 - 47
        const leftEyeEAR = getEAR(positions, 36, 41);
        const rightEyeEAR = getEAR(positions, 42, 47);
        const avgEAR = (leftEyeEAR + rightEyeEAR) / 2.0;

        setCurrentEAR(avgEAR);

        // Calculate face center offset from camera center
        const faceCenterX = (jawLeft.x + jawRight.x) / 2;
        const videoCenterX = video.videoWidth / 2;
        const offsetPercent = Math.abs(faceCenterX - videoCenterX) / video.videoWidth;
        setFacePositionOffset(offsetPercent);

        // Asymmetry Ratio to check horizontal face turn
        const asymmetry = Math.max(leftDist, rightDist) / Math.max(1, Math.min(leftDist, rightDist));
        setCurrentAsymmetry(asymmetry);

        // Check if drowsy / closed eyes (avgEAR < 0.16 indicates closed/very drowsy)
        const isDrowsy = avgEAR < 0.17;
        onDrowsinessChange(isDrowsy);

        // Focus Decision Tree:
        // Asymmetry range slider sensitivity threshold (1 to 10)
        // Level 10 sensitivity -> threshold is 1.25 (Very strict head turn detection)
        // Level 1 sensitivity -> threshold is 2.80 (Very loose head turn detection)
        const baseThreshold = 2.8 - (sensitivity * 0.155); 
        
        // Distracted is triggered if asymmetry is above threshold OR head is centered offset > 0.22
        // OR if eye closure drowsiness is detected
        const isHeadTurned = asymmetry > baseThreshold;
        const isOffCenter = offsetPercent > 0.25;

        if (isDrowsy) {
          // If drowsy/sleeping, mark as distracted or alert them
          onStateChange(FocusState.DISTRACTED);
        } else if (isHeadTurned || isOffCenter) {
          onStateChange(FocusState.DISTRACTED);
        } else {
          onStateChange(FocusState.FOCUSED);
        }

      } catch (err) {
        console.warn('Error during frame detection interval:', err);
      }
    }, 500);
  }

  // Calculate Eye Aspect Ratio (EAR)
  function getEAR(positions: any[], startIdx: number, endIdx: number): number {
    // p1 = startIdx, p2 = startIdx+1, p3 = startIdx+2, p4 = startIdx+3, p5 = startIdx+4, p6 = startIdx+5
    const p1 = positions[startIdx];
    const p2 = positions[startIdx + 1];
    const p3 = positions[startIdx + 2];
    const p4 = positions[startIdx + 3];
    const p5 = positions[startIdx + 4];
    const p6 = positions[startIdx + 5];

    const distY1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
    const distY2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
    const distX = Math.hypot(p1.x - p4.x, p1.y - p4.y);

    return (distY1 + distY2) / (2.0 * Math.max(0.1, distX));
  }

  // Handle Simulation controls
  useEffect(() => {
    if (isSimulating) {
      // Clear real camera tracking intervals
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }

      onStateChange(simulatedSetting);
      onDrowsinessChange(simulatedDrowsy);

      // Generate mock stats
      if (simulatedSetting === FocusState.FOCUSED) {
        setCurrentEAR(simulatedDrowsy ? 0.14 : 0.28);
        setCurrentAsymmetry(1.1);
        setFacePositionOffset(0.04);
      } else if (simulatedSetting === FocusState.DISTRACTED) {
        setCurrentEAR(simulatedDrowsy ? 0.12 : 0.26);
        setCurrentAsymmetry(2.2);
        setFacePositionOffset(0.08);
      } else {
        setCurrentEAR(null);
        setCurrentAsymmetry(null);
        setFacePositionOffset(null);
      }
    }
  }, [isSimulating, simulatedSetting, simulatedDrowsy]);

  function toggleSimulationMode() {
    if (isSimulating) {
      setIsSimulating(false);
      if (cameraAllowed !== false && modelsLoaded) {
        startCamera();
      } else {
        startCamera();
      }
    } else {
      setIsSimulating(true);
      stopCameraAndTracking();
    }
  }

  // Style accents based on currentState
  const ringColorMap = {
    [FocusState.FOCUSED]: 'border-[#34D399] shadow-[#34D399]/20',
    [FocusState.DISTRACTED]: 'border-[#FBBF24] shadow-[#FBBF24]/20',
    [FocusState.AWAY]: 'border-[#F87171] shadow-[#F87171]/20',
  };

  const ringBgMap = {
    [FocusState.FOCUSED]: 'bg-[#34D399]/10 text-[#34D399]',
    [FocusState.DISTRACTED]: 'bg-[#FBBF24]/10 text-[#FBBF24]',
    [FocusState.AWAY]: 'bg-[#F87171]/10 text-[#F87171]',
  };

  const labelMap = {
    [FocusState.FOCUSED]: 'Focused',
    [FocusState.DISTRACTED]: 'Distracted',
    [FocusState.AWAY]: 'Away',
  };

  return (
    <div id="camera-tracker-panel" className="bg-[#15151D] border border-[#2A2A35] rounded-xl p-5 flex flex-col space-y-4 shadow-xl transition-all duration-300">
      
      {/* Title & Stats */}
      <div className="flex justify-between items-center pb-2 border-b border-[#2A2A35]">
        <div className="flex items-center space-x-2">
          <Camera className="w-4 h-4 text-[#8B5CF6]" />
          <h2 className="font-sans font-semibold text-sm text-[#F5F5F7]">Live Guard Feed</h2>
        </div>

        {/* Focus State Badge */}
        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all duration-300 ${ringBgMap[currentState]}`}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${
            currentState === FocusState.FOCUSED ? 'bg-[#34D399] animate-pulse' :
            currentState === FocusState.DISTRACTED ? 'bg-[#FBBF24]' : 'bg-[#F87171]'
          }`} />
          <span>{labelMap[currentState]}</span>
        </div>
      </div>

      {/* Webcam Frame */}
      <div className="relative">
        
        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 bg-[#0A0A0F]/90 rounded-2xl flex flex-col items-center justify-center space-y-3 z-30 p-6 text-center">
            <RefreshCw className="w-8 h-8 text-[#6366F1] animate-spin" />
            <p className="font-sans text-xs text-[#F5F5F7] font-medium">{loadingProgress}</p>
            <p className="font-sans text-[10px] text-[#9CA3AF]">Initializing secure browser-side Neural Network</p>
          </div>
        )}

        {/* Video feed inside standard card */}
        <div 
          id="webcam-box-glow" 
          className={`relative aspect-video rounded-xl overflow-hidden border bg-black transition-all duration-500 shadow-lg ${ringColorMap[currentState]} ${
            currentState === FocusState.FOCUSED ? 'animate-[pulse_2.5s_infinite_ease-in-out]' : ''
          }`}
        >
          {isSimulating ? (
            <div className="absolute inset-0 bg-[#12121A] flex flex-col items-center justify-center p-6 text-center space-y-3">
              <Eye className="w-10 h-10 text-[#9CA3AF] animate-pulse" />
              <div className="space-y-1">
                <p className="font-sans text-xs text-[#F5F5F7] font-semibold">Active Simulation Mode</p>
                <p className="font-sans text-[10px] text-[#9CA3AF] max-w-xs">Testing behavior without camera or when neural models are loading</p>
              </div>
              
              {/* Simulator interactive dials */}
              <div className="bg-[#1C1C24] p-3 rounded-lg border border-[#2A2A35] max-w-[240px] w-full text-left space-y-2.5">
                <p className="text-[9px] uppercase tracking-wider font-bold text-[#8B5CF6]">Control Simulated State</p>
                
                <div className="flex gap-1">
                  {Object.values(FocusState).map((st) => (
                    <button
                      key={st}
                      onClick={() => setSimulatedSetting(st)}
                      className={`text-[9px] uppercase tracking-wider font-bold flex-1 py-1 rounded transition-all cursor-pointer ${
                        simulatedSetting === st 
                          ? st === FocusState.FOCUSED ? 'bg-[#34D399] text-[#0A0A0F]' 
                            : st === FocusState.DISTRACTED ? 'bg-[#FBBF24] text-[#0A0A0F]' 
                            : 'bg-[#F87171] text-[#0A0A0F]'
                          : 'bg-[#2A2A35] text-[#9CA3AF] hover:text-[#F5F5F7]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <label className="flex items-center space-x-2 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={simulatedDrowsy}
                    onChange={(e) => setSimulatedDrowsy(e.target.checked)}
                    className="accent-[#8B5CF6] h-3 w-3 rounded"
                  />
                  <span className="text-[10px] text-[#9CA3AF] font-medium">Trigger eye closure drowsiness</span>
                </label>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none scale-x-[-1]" />
            </>
          )}

          {/* Fallback & Camera Permission Denied Overlay */}
          {!loading && cameraAllowed === false && !isSimulating && (
            <div className="absolute inset-0 bg-[#0A0A0F]/95 flex flex-col items-center justify-center space-y-3 z-20 p-6 text-center">
              <AlertCircle className="w-8 h-8 text-[#FBBF24]" />
              <p className="font-sans text-xs text-[#F5F5F7] font-medium">Camera Access Required</p>
              <p className="font-sans text-[10px] text-[#9CA3AF] max-w-xs">
                To capture live head-turns and eye activity, please allow webcam permissions or switch to simulator demo.
              </p>
              <button
                onClick={startCamera}
                className="cursor-pointer bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:opacity-90 text-[10px] uppercase font-bold tracking-widest text-[#F5F5F7] px-4 py-2 rounded-md transition-all mt-1"
              >
                Retry webcam connect
              </button>
            </div>
          )}
        </div>

        {/* Live processing privacy disclaimer */}
        <div className="flex items-center space-x-1.5 text-emerald-400/80 mt-2 bg-[#34D399]/5 border border-[#34D399]/15 rounded-md px-3 py-1.5 justify-center">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span className="font-sans text-[10px] text-[#F5F5F7]">
            All processing happens locally in your browser. No video or images are ever uploaded or stored.
          </span>
        </div>
      </div>

      {/* Realtime Computer Vision telemetry telemetry data (clean & helpful) */}
      <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-[9px] text-[#9CA3AF]">
        <div className="bg-[#1C1C24] p-2 rounded border border-[#2A2A35]/60">
          <span className="block text-gray-400 capitalize">Eye openness (EAR)</span>
          <span className="font-bold text-[#F5F5F7] text-xs">
            {currentEAR !== null ? (
              <span className={currentEAR < 0.17 ? 'text-[#FBBF24]' : 'text-[#34D399]'}>
                {currentEAR.toFixed(2)} {currentEAR < 0.17 ? '(Closed / Drowsy)' : '(Normal)'}
              </span>
            ) : (
              '-- (No face)'
            )}
          </span>
        </div>
        <div className="bg-[#1C1C24] p-2 rounded border border-[#2A2A35]/60">
          <span className="block text-gray-400 capitalize">Head asymmetry index</span>
          <span className="font-bold text-[#F5F5F7] text-xs">
            {currentAsymmetry !== null ? (
              <span className={currentAsymmetry > (2.8 - sensitivity*0.155) ? 'text-[#FBBF24]' : 'text-[#34D399]'}>
                {unifyAsymmetry(currentAsymmetry).toFixed(1)}° {currentAsymmetry > (2.8 - sensitivity*0.155) ? '(Looking away)' : '(Looking straight)'}
              </span>
            ) : (
              '-- (No face)'
            )}
          </span>
        </div>
      </div>

      {/* Simulator / Real Toggle Buttons */}
      <div className="flex justify-end pt-1">
        <button
          onClick={toggleSimulationMode}
          className="cursor-pointer text-[10px] font-bold text-[#F5F5F7]/70 hover:text-[#8B5CF6] transition-all flex items-center space-x-1"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{isSimulating ? 'Disable Simulator' : 'Trigger Simulator Demo'}</span>
        </button>
      </div>

    </div>
  );
};

// Helper to translate abstract asymmetry calculation to readable coordinate angles
function unifyAsymmetry(val: number): number {
  if (val <= 1.0) return 0;
  return Math.min(90, (val - 1.0) * 35);
}
