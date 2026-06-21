import React, { useEffect, useRef, useState } from 'react';
import { Camera, AlertCircle, ShieldCheck, RefreshCw, Eye, Sliders, AlertTriangle, Smartphone, Zap, Activity } from 'lucide-react';
import { FocusState } from '../types';

interface CameraTrackerProps {
  currentState: FocusState;
  onStateChange: (state: FocusState) => void;
  onDrowsinessChange: (isDrowsy: boolean) => void;
  sensitivity: number; // 1 (Relaxed), 2 (Balanced), 3 (Strict)
  onPhoneOccurrence: () => void;
  onMovementOccurrence: () => void;
  onLookAwayOccurrence: () => void;
}

export const CameraTracker: React.FC<CameraTrackerProps> = ({
  currentState,
  onStateChange,
  onDrowsinessChange,
  sensitivity,
  onPhoneOccurrence,
  onMovementOccurrence,
  onLookAwayOccurrence,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState('Initializing tracker...');
  const [cameraAllowed, setCameraAllowed] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Real or Simulation State Choice
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedSetting, setSimulatedSetting] = useState<FocusState>(FocusState.FOCUSED);
  const [simulatedDrowsy, setSimulatedDrowsy] = useState(false);

  // Active distraction manual simulator triggers (for both webcam and simulation use)
  const [isSimulatingPhone, setIsSimulatingPhone] = useState(false);
  const [isSimulatingMovement, setIsSimulatingMovement] = useState(false);

  // Model statuses
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Metrics for visualization
  const [currentEAR, setCurrentEAR] = useState<number | null>(null);
  const [currentAsymmetry, setCurrentAsymmetry] = useState<number | null>(null);
  const [facePositionOffset, setFacePositionOffset] = useState<number | null>(null);
  
  // Distraction grace tracking counters in ticks (1 tick = 500ms, 10 ticks = 5.0 seconds)
  const consecutiveDistractionTicksRef = useRef<number>(0);
  const [distractionGraceSeconds, setDistractionGraceSeconds] = useState<number>(0);

  const consecutivePhoneTicksRef = useRef<number>(0);
  const [phoneGraceSeconds, setPhoneGraceSeconds] = useState<number>(0);

  const consecutiveMovementTicksRef = useRef<number>(0);
  const [movementGraceSeconds, setMovementGraceSeconds] = useState<number>(0);

  // Erratic motion movement tracking
  const lastNosePositionRef = useRef<{ x: number, y: number } | null>(null);
  const [liveErraticMotionDetected, setLiveErraticMotionDetected] = useState(false);

  // Trigger period lockout states
  const lookAwayTriggeredThisPeriodRef = useRef(false);
  const phoneTriggeredThisPeriodRef = useRef(false);
  const movementTriggeredThisPeriodRef = useRef(false);

  // Timers and stream references
  const streamRef = useRef<MediaStream | null>(null);
  const awayTimerStartRef = useRef<number | null>(null); // To buffer AWAY state until > 5 seconds

  // Refs to anchor values and prevent stale closure traps inside the frame loop
  const isSimulatingRef = useRef(isSimulating);
  const sensitivityRef = useRef(sensitivity);
  const onDrowsinessChangeRef = useRef(onDrowsinessChange);
  const onStateChangeRef = useRef(onStateChange);
  const onPhoneOccurrenceRef = useRef(onPhoneOccurrence);
  const onMovementOccurrenceRef = useRef(onMovementOccurrence);
  const onLookAwayOccurrenceRef = useRef(onLookAwayOccurrence);
  const isSimulatingPhoneRef = useRef(isSimulatingPhone);
  const isSimulatingMovementRef = useRef(isSimulatingMovement);
  const simulatedSettingRef = useRef(simulatedSetting);
  const simulatedDrowsyRef = useRef(simulatedDrowsy);

  // Synchronize refs on state changes
  useEffect(() => { isSimulatingRef.current = isSimulating; }, [isSimulating]);
  useEffect(() => { sensitivityRef.current = sensitivity; }, [sensitivity]);
  useEffect(() => { onDrowsinessChangeRef.current = onDrowsinessChange; }, [onDrowsinessChange]);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);
  useEffect(() => { onPhoneOccurrenceRef.current = onPhoneOccurrence; }, [onPhoneOccurrence]);
  useEffect(() => { onMovementOccurrenceRef.current = onMovementOccurrence; }, [onMovementOccurrence]);
  useEffect(() => { onLookAwayOccurrenceRef.current = onLookAwayOccurrence; }, [onLookAwayOccurrence]);
  useEffect(() => { isSimulatingPhoneRef.current = isSimulatingPhone; }, [isSimulatingPhone]);
  useEffect(() => { isSimulatingMovementRef.current = isSimulatingMovement; }, [isSimulatingMovement]);
  useEffect(() => { simulatedSettingRef.current = simulatedSetting; }, [simulatedSetting]);
  useEffect(() => { simulatedDrowsyRef.current = simulatedDrowsy; }, [simulatedDrowsy]);

  // Load face-api.js from CDN dynamically
  useEffect(() => {
    let active = true;

    async function loadFaceApi() {
      try {
        setLoadingProgress('Connecting to computer vision server...');
        
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
              console.warn(`CDN URL failed: ${url}. Attempting backup...`);
            }
          }
          
          if (!scriptLoaded) {
            throw lastScriptError || new Error('Failed to download computer vision engine.');
          }
        }

        if (!active) return;

        const faceapi = (window as any).faceapi;
        if (!faceapi) {
          throw new Error('Face-API could not be loaded.');
        }

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
            console.warn(`Model loading failed from: ${uri}. Attempting backup...`);
          }
        }
        
        if (!modelsLoadedSuccessfully) {
          throw lastModelError || new Error('Neural network models failed to download.');
        }

        if (!active) return;
        setModelsLoaded(true);
        setLoading(false);
        setLoadingProgress('');
        
        startCamera();
      } catch (err: any) {
        console.error('Failed to initialize Face-API:', err);
        if (active) {
          setErrorMessage(err.message || 'Failed to load face detection library.');
          setLoading(false);
          setIsSimulating(true); // Fallback to simulated mode
        }
      }
    }

    loadFaceApi();

    return () => {
      active = false;
      stopCamera();
    };
  }, []);

  // Frame processing loop using safe, non-blocking recursive setTimeout (evaluates frames every 500ms)
  useEffect(() => {
    let active = true;
    let timerId: NodeJS.Timeout | null = null;

    async function processFrameLoop() {
      if (!active) return;

      try {
        if (isSimulatingRef.current) {
          runSimulationTick();
        } else {
          await runRealCameraTick();
        }
      } catch (err) {
        console.warn('Evaluation frame error:', err);
      }

      if (active) {
        timerId = setTimeout(processFrameLoop, 500);
      }
    }

    timerId = setTimeout(processFrameLoop, 1000);

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  // Start webcam
  async function startCamera() {
    try {
      setErrorMessage(null);
      if (streamRef.current) {
        stopCamera();
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
        };
      }
    } catch (err: any) {
      console.warn('Webcam access was denied or is unavailable:', err);
      setCameraAllowed(false);
      setErrorMessage('Camera access denied or unavailable. Falling back to study simulator mode.');
      setIsSimulating(true);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }

  // Draw cyber-emerald visual face landmarks contour tracking grid
  const drawFaceMesh = (ctx: CanvasRenderingContext2D, landmarks: any) => {
    const points = landmarks.positions;
    
    ctx.strokeStyle = '#10B981'; // emerald green
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 4;

    const drawPath = (start: number, end: number, close = false) => {
      ctx.beginPath();
      ctx.moveTo(points[start].x, points[start].y);
      for (let i = start + 1; i <= end; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      if (close) {
        ctx.lineTo(points[start].x, points[start].y);
      }
      ctx.stroke();
    };

    // Facial segments outline curves
    drawPath(0, 16);          // Jawline
    drawPath(17, 21);         // Left eyebrow
    drawPath(22, 26);         // Right eyebrow
    drawPath(27, 30);         // Nose bridge
    drawPath(30, 35);         // Lower nose definition
    drawPath(36, 41, true);   // Left eye
    drawPath(42, 47, true);   // Right eye
    drawPath(48, 59, true);   // Outer lips
    drawPath(60, 67, true);   // Inner lips

    // Highlight key vertices
    ctx.fillStyle = '#8B5CF6'; // Violet accent points
    ctx.shadowBlur = 0;
    const vertexAesthetics = [0, 8, 16, 17, 21, 22, 26, 30, 33, 36, 39, 42, 45, 48, 54];
    vertexAesthetics.forEach(idx => {
      const pt = points[idx];
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  // 1. SIMULATOR MODE TICK PROCESSOR (continuous 500ms calls)
  function runSimulationTick() {
    // Look Away Ticks
    const lookAwayActive = simulatedSettingRef.current === FocusState.DISTRACTED && !simulatedDrowsyRef.current;
    if (lookAwayActive) {
      consecutiveDistractionTicksRef.current += 1;
      const seconds = consecutiveDistractionTicksRef.current * 0.5;
      setDistractionGraceSeconds(seconds);
      
      if (seconds >= 5) {
        if (!lookAwayTriggeredThisPeriodRef.current) {
          lookAwayTriggeredThisPeriodRef.current = true;
          onLookAwayOccurrenceRef.current();
        }
      }
    } else {
      consecutiveDistractionTicksRef.current = 0;
      setDistractionGraceSeconds(0);
      lookAwayTriggeredThisPeriodRef.current = false;
    }

    // Phone Active Warning Ticks
    const phoneActive = isSimulatingPhoneRef.current || (simulatedSettingRef.current === FocusState.DISTRACTED && simulatedDrowsyRef.current);
    if (phoneActive) {
      consecutivePhoneTicksRef.current += 1;
      const seconds = consecutivePhoneTicksRef.current * 0.5;
      setPhoneGraceSeconds(seconds);

      if (seconds >= 5) {
        if (!phoneTriggeredThisPeriodRef.current) {
          phoneTriggeredThisPeriodRef.current = true;
          onPhoneOccurrenceRef.current();
        }
      }
    } else {
      consecutivePhoneTicksRef.current = 0;
      setPhoneGraceSeconds(0);
      phoneTriggeredThisPeriodRef.current = false;
    }

    // Erratic Motion Active Ticks
    const movementActive = isSimulatingMovementRef.current;
    setLiveErraticMotionDetected(movementActive);
    if (movementActive) {
      consecutiveMovementTicksRef.current += 1;
      const seconds = consecutiveMovementTicksRef.current * 0.5;
      setMovementGraceSeconds(seconds);

      if (seconds >= 5) {
        if (!movementTriggeredThisPeriodRef.current) {
          movementTriggeredThisPeriodRef.current = true;
          onMovementOccurrenceRef.current();
        }
      }
    } else {
      consecutiveMovementTicksRef.current = 0;
      setMovementGraceSeconds(0);
      movementTriggeredThisPeriodRef.current = false;
    }

    // Resolve unified overall state
    let simOverallState = FocusState.FOCUSED;
    if (simulatedSettingRef.current === FocusState.AWAY) {
      simOverallState = FocusState.AWAY;
    } else if (
      consecutiveDistractionTicksRef.current * 0.5 >= 5 ||
      consecutivePhoneTicksRef.current * 0.5 >= 5 ||
      consecutiveMovementTicksRef.current * 0.5 >= 5
    ) {
      simOverallState = FocusState.DISTRACTED;
    }

    onStateChangeRef.current(simOverallState);
    console.log(`Frame check: ${simOverallState}`);

    // Generate simulated coordinates/telemetry readouts
    setCurrentEAR(simulatedDrowsyRef.current ? 0.13 : 0.28);
    setCurrentAsymmetry(lookAwayActive ? 2.3 : 1.1);
    setFacePositionOffset(lookAwayActive ? 0.35 : 0.04);
  }

  // 2. REAL WEB-CAMERA FRAME EVALUATOR
  async function runRealCameraTick() {
    const video = videoRef.current;
    if (!video || video.paused || video.ended) return;

    const faceapi = (window as any).faceapi;
    if (!faceapi) return;

    // Detect face
    const detection = await faceapi.detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 })
    ).withFaceLandmarks(true);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!detection) {
      // Clear facial contour canvas drawings
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      // No face detected! Set telemetry readings to null and shut down drowsiness alerts
      setCurrentEAR(null);
      setCurrentAsymmetry(null);
      setFacePositionOffset(null);
      onDrowsinessChangeRef.current(false);

      // Settle down temporary sub-warning counts
      consecutiveDistractionTicksRef.current = 0;
      setDistractionGraceSeconds(0);
      consecutivePhoneTicksRef.current = 0;
      setPhoneGraceSeconds(0);
      consecutiveMovementTicksRef.current = 0;
      setMovementGraceSeconds(0);

      // Start buffer toward continuous AWAY (requires 5 continuous seconds)
      if (awayTimerStartRef.current === null) {
        awayTimerStartRef.current = Date.now();
        console.log("Frame check: FOCUSED (AWAY countdown tracking)");
      } else {
        const secondsDifference = (Date.now() - awayTimerStartRef.current) / 1000;
        if (secondsDifference >= 5) {
          onStateChangeRef.current(FocusState.AWAY);
          console.log("Frame check: AWAY");
        } else {
          console.log("Frame check: FOCUSED (AWAY countdown tracking)");
        }
      }
      return;
    }

    // Reset buffer timer since face was found
    awayTimerStartRef.current = null;

    const positions = detection.landmarks.positions;

    // Render wireframe outline
    if (canvas && ctx) {
      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      faceapi.matchDimensions(canvas, displaySize);
      ctx.clearRect(0, 0, displaySize.width, displaySize.height);
      drawFaceMesh(ctx, detection.landmarks);
    }

    // Compute EAR (Eye Openness ratio)
    const leftEyeEAR = getEAR(positions, 36, 41);
    const rightEyeEAR = getEAR(positions, 42, 47);
    const avgEAR = (leftEyeEAR + rightEyeEAR) / 2.0;
    setCurrentEAR(avgEAR);

    // Compute face coordinates and offsets from central screen
    const jawLeft = positions[0];
    const jawRight = positions[16];
    const nosePoint = positions[30];

    // Left vs right cheek depth width
    const leftDist = Math.abs(nosePoint.x - jawLeft.x);
    const rightDist = Math.abs(jawRight.x - nosePoint.x);

    // Face distance centering
    const faceCenterX = (jawLeft.x + jawRight.x) / 2;
    const videoCenterX = video.videoWidth / 2;
    const offsetPercent = Math.abs(faceCenterX - videoCenterX) / video.videoWidth;
    setFacePositionOffset(offsetPercent);

    // Lateral face asymmetry
    const asymmetry = Math.max(leftDist, rightDist) / Math.max(1, Math.min(leftDist, rightDist));
    setCurrentAsymmetry(asymmetry);

    // Calculate eye slope (tilt angle)
    const eyeLeftCenter = positions[36];
    const eyeRightCenter = positions[45];
    const eyeSlope = Math.abs(eyeRightCenter.y - eyeLeftCenter.y) / Math.max(1, Math.abs(eyeRightCenter.x - eyeLeftCenter.x));

    // Handle eyes-closed drowsiness alert (threshold = 0.17)
    const isCurrentlyDrowsy = avgEAR < 0.17;
    onDrowsinessChangeRef.current(isCurrentlyDrowsy);

    // Physical erratic motion movement tracking counter
    let liveMovement = false;
    if (lastNosePositionRef.current) {
      const dx = Math.abs(nosePoint.x - lastNosePositionRef.current.x);
      const dy = Math.abs(nosePoint.y - lastNosePositionRef.current.y);
      const delta = Math.sqrt(dx * dx + dy * dy);
      const movementDeltaLimit = sensitivityRef.current === 1 ? 55 : sensitivityRef.current === 3 ? 20 : 32;
      liveMovement = (delta > movementDeltaLimit);
    }
    lastNosePositionRef.current = { x: nosePoint.x, y: nosePoint.y };

    // DETECT STATES DEFINITIONS:
    const isHeadTurned = asymmetry > 1.65;
    const isOffCenter = offsetPercent > 0.25;
    const lookAwayActive = isHeadTurned || isOffCenter;

    // Smart phone holding camera posture heuristic (extreme asymmetry OR tilted posture plus jaw distortion)
    const cameraPhoneActive = isSimulatingPhoneRef.current || (asymmetry > 1.7 && eyeSlope > 0.13) || (asymmetry > 1.95);
    const movementActive = isSimulatingMovementRef.current || liveMovement;

    // 1. LOOK AWAY COUNTDOWN (Start countdown, trigger warning after 5 continuous seconds looking away)
    if (lookAwayActive && !cameraPhoneActive) {
      consecutiveDistractionTicksRef.current += 1;
      const seconds = consecutiveDistractionTicksRef.current * 0.5;
      setDistractionGraceSeconds(seconds);

      if (seconds >= 5) {
        if (!lookAwayTriggeredThisPeriodRef.current) {
          lookAwayTriggeredThisPeriodRef.current = true;
          onLookAwayOccurrenceRef.current();
        }
      }
    } else {
      consecutiveDistractionTicksRef.current = 0;
      setDistractionGraceSeconds(0);
      lookAwayTriggeredThisPeriodRef.current = false;
    }

    // 2. PHONE HOLDING COUNTDOWN (5 continuous seconds)
    if (cameraPhoneActive) {
      consecutivePhoneTicksRef.current += 1;
      const seconds = consecutivePhoneTicksRef.current * 0.5;
      setPhoneGraceSeconds(seconds);

      if (seconds >= 5) {
        if (!phoneTriggeredThisPeriodRef.current) {
          phoneTriggeredThisPeriodRef.current = true;
          onPhoneOccurrenceRef.current();
        }
      }
    } else {
      consecutivePhoneTicksRef.current = 0;
      setPhoneGraceSeconds(0);
      phoneTriggeredThisPeriodRef.current = false;
    }

    // 3. MOTION COUNTDOWN (5 continuous seconds)
    setLiveErraticMotionDetected(movementActive);
    if (movementActive) {
      consecutiveMovementTicksRef.current += 1;
      const seconds = consecutiveMovementTicksRef.current * 0.5;
      setMovementGraceSeconds(seconds);

      if (seconds >= 5) {
        if (!movementTriggeredThisPeriodRef.current) {
          movementTriggeredThisPeriodRef.current = true;
          onMovementOccurrenceRef.current();
        }
      }
    } else {
      consecutiveMovementTicksRef.current = 0;
      setMovementGraceSeconds(0);
      movementTriggeredThisPeriodRef.current = false;
    }

    // Resolve unified overall state
    const overallDistracted = (consecutiveDistractionTicksRef.current * 0.5 >= 5) || 
                              (consecutivePhoneTicksRef.current * 0.5 >= 5) || 
                              (consecutiveMovementTicksRef.current * 0.5 >= 5);
                              
    const resolvedState = overallDistracted ? FocusState.DISTRACTED : FocusState.FOCUSED;
    onStateChangeRef.current(resolvedState);
    console.log(`Frame check: ${resolvedState}`);
  }

  // Calculate Eye Aspect Ratio (EAR)
  function getEAR(positions: any[], startIdx: number, endIdx: number): number {
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

  function toggleSimulationMode() {
    if (isSimulating) {
      setIsSimulating(false);
      startCamera();
    } else {
      setIsSimulating(true);
      stopCamera();
    }
  }

  // Style mappings depending on active FocusState
  const borderRingClasses = {
    [FocusState.FOCUSED]: 'border-[#34D399] shadow-[#34D399]/20',
    [FocusState.DISTRACTED]: 'border-[#FBBF24] shadow-[#FBBF24]/20',
    [FocusState.AWAY]: 'border-[#F87171] shadow-[#F87171]/20',
  };

  const badgeBgClasses = {
    [FocusState.FOCUSED]: 'bg-[#34D399]/10 text-[#34D399]',
    [FocusState.DISTRACTED]: 'bg-[#FBBF24]/10 text-[#FBBF24]',
    [FocusState.AWAY]: 'bg-[#F87171]/10 text-[#F87171]',
  };

  const badgeLabelText = {
    [FocusState.FOCUSED]: 'Focused',
    [FocusState.DISTRACTED]: 'Distracted',
    [FocusState.AWAY]: 'Away',
  };

  return (
    <div id="camera-tracker-panel" className="bg-[#15151D] border border-[#2A2A35] rounded-xl p-5 flex flex-col space-y-4 shadow-xl transition-all duration-300">
      
      {/* Title block */}
      <div className="flex justify-between items-center pb-2 border-b border-[#2A2A35]">
        <div className="flex items-center space-x-2">
          <Camera className="w-4 h-4 text-[#8B5CF6]" />
          <h2 className="font-sans font-semibold text-sm text-[#F5F5F7]">Live Guard Feed</h2>
        </div>

        {/* Live Active Status Badge */}
        <div id="live-guard-status-badge" className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all duration-300 ${badgeBgClasses[currentState]}`}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${
            currentState === FocusState.FOCUSED ? 'bg-[#34D399] animate-pulse' :
            currentState === FocusState.DISTRACTED ? 'bg-[#FBBF24]' : 'bg-[#F87171]'
          }`} />
          <span>{badgeLabelText[currentState]}</span>
        </div>
      </div>

      {/* Frame / Simulator Box */}
      <div className="relative">
        
        {/* Loading overlay for libraries */}
        {loading && (
          <div className="absolute inset-0 bg-[#0A0A0F]/90 rounded-2xl flex flex-col items-center justify-center space-y-3 z-30 p-6 text-center">
            <RefreshCw className="w-8 h-8 text-[#6366F1] animate-spin" />
            <p className="font-sans text-xs text-[#F5F5F7] font-medium">{loadingProgress}</p>
            <p className="font-sans text-[10px] text-[#9CA3AF]">Initializing secure browser-side Neural Network</p>
          </div>
        )}

        {/* Outer Frame Wrapper */}
        <div 
          id="webcam-box-glow" 
          className={`relative aspect-video rounded-xl overflow-hidden border bg-black transition-all duration-500 shadow-lg ${borderRingClasses[currentState]} ${
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
              
              {/* Simulator interactive control dials */}
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

          {/* Distraction Grace Warning HUD overlays */}
          {/* Distraction Grace Warning HUD overlays */}
          {(currentState === FocusState.FOCUSED || currentState === FocusState.DISTRACTED) && (distractionGraceSeconds > 0 || phoneGraceSeconds > 0 || movementGraceSeconds > 0) && (
            <div className="absolute top-3 left-3 right-3 bg-amber-500/95 backdrop-blur-md text-slate-950 px-4 py-3 rounded-xl flex flex-col space-y-2 shadow-2xl border border-amber-400/40 z-10 animate-fade-in">
              <div className="flex items-center space-x-2.5">
                <AlertTriangle className="w-5 h-5 text-slate-950 shrink-0 animate-pulse" />
                <div className="text-left leading-tight flex-grow">
                  <p className="font-sans font-extrabold text-xs">
                    {phoneGraceSeconds > 0 
                      ? 'Stop using your phone — put it away to continue.' 
                      : distractionGraceSeconds > 0 
                        ? 'You are looking away — please look back at the screen to continue.' 
                        : 'Erratic movement — please settle down to continue.'}
                  </p>
                  <p className="font-sans text-[10px] opacity-80 mt-1">
                    {phoneGraceSeconds > 0 
                      ? 'Put your phone completely aside to cancel this alert.' 
                      : distractionGraceSeconds > 0 
                        ? 'Look straight back at your display to resume.' 
                        : 'Calm down to preserve focus block logs.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-950/15 pt-2 mt-1">
                <span className="text-[9px] uppercase tracking-wider font-extrabold opacity-75">Grace period countdown</span>
                <span className="font-mono font-black text-sm bg-slate-950 text-amber-400 px-2 py-0.5 rounded shadow">
                  {phoneGraceSeconds > 0 
                    ? `${Math.max(0, 5 - phoneGraceSeconds).toFixed(1)}s` 
                    : distractionGraceSeconds > 0 
                      ? `${Math.max(0, 5 - distractionGraceSeconds).toFixed(1)}s` 
                      : `${Math.max(0, 5 - movementGraceSeconds).toFixed(1)}s`}
                </span>
              </div>
            </div>
          )}

          {/* Camera Permission Denied Overlay */}
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

        {/* Local Security banner */}
        <div className="flex items-center space-x-1.5 text-emerald-400/80 mt-2 bg-[#34D399]/5 border border-[#34D399]/15 rounded-md px-3 py-1.5 justify-center">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span className="font-sans text-[10px] text-[#F5F5F7] text-center">
            All processing happens locally in your browser. No video or images are ever uploaded or stored.
          </span>
        </div>
      </div>

      {/* Realtime Telemetry coordinates output block */}
      <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-[9px] text-[#9CA3AF]">
        <div className="bg-[#1C1C24] p-2 rounded border border-[#2A2A35]/60">
          <span className="block text-gray-400 capitalize">Eye openness (EAR)</span>
          <span className="font-bold text-[#F5F5F7] text-xs">
            {currentEAR !== null ? (
              <span className={currentEAR < 0.17 ? 'text-[#FBBF24]' : 'text-[#34D399]'}>
                {currentEAR.toFixed(2)} {currentEAR < 0.17 ? '(Drowsiness Alert)' : '(Normal)'}
              </span>
            ) : (
              '-- (No face)'
            )}
          </span>
        </div>
        <div className="bg-[#1C1C24] p-2 rounded border border-[#2A2A35]/60">
          <span className="block text-gray-400 capitalize">Pose alignment slope</span>
          <span className="font-bold text-[#F5F5F7] text-xs">
            {currentAsymmetry !== null ? (
              <span className={currentAsymmetry > 1.65 ? 'text-[#FBBF24]' : 'text-[#34D399]'}>
                {Math.min(90, (currentAsymmetry - 1) * 35).toFixed(1)}° {currentAsymmetry > 1.65 ? '(Atypical turn)' : '(Aligned)'}
              </span>
            ) : (
              '-- (No face)'
            )}
          </span>
        </div>
      </div>

      {/* Manual Distraction Injector (Active for both webcam and simulation testing) */}
      <div className="bg-[#111116] border border-[#2A2A35]/40 p-3 rounded-lg flex flex-col space-y-2 select-none">
        <p className="text-[9px] uppercase tracking-wider font-extrabold text-[#9CA3AF] flex items-center space-x-1">
          <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
          <span>Manual Distraction Injector (Demonstration & Sandbox tools)</span>
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setIsSimulatingPhone(p => !p)}
            className={`cursor-pointer text-[10px] uppercase tracking-widest font-bold py-2 rounded-md transition-all flex items-center justify-center space-x-1.5 border ${
              isSimulatingPhone 
                ? 'bg-[#8B5CF6]/25 border-[#8B5CF6] text-[#C084FC] shadow-inner shadow-[#8B5CF6]/10' 
                : 'bg-[#1C1C24] border-[#2A2A35] text-gray-400 hover:text-white hover:bg-[#20202B]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{isSimulatingPhone ? 'Put Phone Down' : 'Hold Phone to Ear'}</span>
          </button>

          <button
            onClick={() => setIsSimulatingMovement(m => !m)}
            className={`cursor-pointer text-[10px] uppercase tracking-widest font-bold py-2 rounded-md transition-all flex items-center justify-center space-x-1.5 border ${
              isSimulatingMovement 
                ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-inner' 
                : 'bg-[#1C1C24] border-[#2A2A35] text-gray-400 hover:text-white hover:bg-[#20202B]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{isSimulatingMovement ? 'Settle Motion' : 'Simulate Movement'}</span>
          </button>
        </div>

        {/* Realtime progress bar/labels showing the ticking count */}
        {(isSimulatingPhone || isSimulatingMovement || liveErraticMotionDetected) && (
          <div className="text-[9px] text-[#9CA3AF] font-mono leading-relaxed pt-1 border-t border-[#2A2A35]/30 space-y-1">
            {isSimulatingPhone && (
              <div className="flex justify-between items-center">
                <span>Phone holding grace remaining:</span>
                <span className="font-bold text-amber-500 bg-black/40 px-1 rounded">{(5 - phoneGraceSeconds).toFixed(1)}s</span>
              </div>
            )}
            {(isSimulatingMovement || liveErraticMotionDetected) && (
              <div className="flex justify-between items-center">
                <span>Erratic motion grace remaining:</span>
                <span className="font-bold text-blue-400 bg-black/40 px-1 rounded">{(5 - movementGraceSeconds).toFixed(1)}s</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Simulator / Real Toggle Buttons footer */}
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
