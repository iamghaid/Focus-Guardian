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
  
  // Real or Simulation State
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
  
  // Look Away Distraction grace period tracking
  const consecutiveDistractionTicksRef = useRef<number>(0);
  const [distractionGraceSeconds, setDistractionGraceSeconds] = useState<number>(0);

  // Handheld phone distraction grace tracking
  const consecutivePhoneTicksRef = useRef<number>(0);
  const [phoneGraceSeconds, setPhoneGraceSeconds] = useState<number>(0);

  // Erratic motion distraction grace tracking
  const consecutiveMovementTicksRef = useRef<number>(0);
  const [movementGraceSeconds, setMovementGraceSeconds] = useState<number>(0);

  // Frame translation relative position memory
  const lastNosePositionRef = useRef<{ x: number, y: number } | null>(null);
  const isErraticMovementDetectedRef = useRef<boolean>(false);
  const [liveErraticMotionDetected, setLiveErraticMotionDetected] = useState(false);

  // Trigger period lockout states
  const lookAwayTriggeredThisPeriodRef = useRef(false);
  const phoneTriggeredThisPeriodRef = useRef(false);
  const movementTriggeredThisPeriodRef = useRef(false);

  // Timers and stream references
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastStateRef = useRef<FocusState>(currentState);
  const awayTimerStartRef = useRef<number | null>(null); // To buffer AWAY state until > 4 seconds

  // Keep copies of props/state in refs so our single-setup interval always reads the latest values without closures going stale
  const isSimulatingRef = useRef(isSimulating);
  const sensitivityRef = useRef(sensitivity);
  const onDrowsinessChangeRef = useRef(onDrowsinessChange);
  const onStateChangeRef = useRef(onStateChange);
  const onPhoneOccurrenceRef = useRef(onPhoneOccurrence);
  const onMovementOccurrenceRef = useRef(onMovementOccurrence);
  const onLookAwayOccurrenceRef = useRef(onLookAwayOccurrence);

  useEffect(() => {
    isSimulatingRef.current = isSimulating;
  }, [isSimulating]);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  useEffect(() => {
    onDrowsinessChangeRef.current = onDrowsinessChange;
  }, [onDrowsinessChange]);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    onPhoneOccurrenceRef.current = onPhoneOccurrence;
  }, [onPhoneOccurrence]);

  useEffect(() => {
    onMovementOccurrenceRef.current = onMovementOccurrence;
  }, [onMovementOccurrence]);

  useEffect(() => {
    onLookAwayOccurrenceRef.current = onLookAwayOccurrence;
  }, [onLookAwayOccurrence]);

  const isSimulatingPhoneRef = useRef(isSimulatingPhone);
  const isSimulatingMovementRef = useRef(isSimulatingMovement);
  const simulatedSettingRef = useRef(simulatedSetting);
  const simulatedDrowsyRef = useRef(simulatedDrowsy);
  const currentStateRef = useRef(currentState);

  useEffect(() => {
    isSimulatingPhoneRef.current = isSimulatingPhone;
  }, [isSimulatingPhone]);

  useEffect(() => {
    isSimulatingMovementRef.current = isSimulatingMovement;
  }, [isSimulatingMovement]);

  useEffect(() => {
    simulatedSettingRef.current = simulatedSetting;
  }, [simulatedSetting]);

  useEffect(() => {
    simulatedDrowsyRef.current = simulatedDrowsy;
  }, [simulatedDrowsy]);

  useEffect(() => {
    currentStateRef.current = currentState;
  }, [currentState]);

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
      // Resolve dynamic thresholds based on sensitivity
      const sensValue = sensitivityRef.current;
      let maxGraceSeconds = 5; // Balanced default
      let asymmetryThreshold = 1.65;
      let offCenterThreshold = 0.25;
      let awayThresholdSeconds = 5;

      if (sensValue === 1) { // Relaxed
        maxGraceSeconds = 8;
        asymmetryThreshold = 2.0;
        offCenterThreshold = 0.35;
        awayThresholdSeconds = 8;
      } else if (sensValue === 3) { // Strict
        maxGraceSeconds = 2;
        asymmetryThreshold = 1.35;
        offCenterThreshold = 0.18;
        awayThresholdSeconds = 3;
      } else { // Balanced (2 or default)
        maxGraceSeconds = 5;
        asymmetryThreshold = 1.65;
        offCenterThreshold = 0.25;
        awayThresholdSeconds = 5;
      }

      // -- BRACH A: SIMULATOR ACTIVE --
      if (isSimulatingRef.current) {
        // 1. Sideways Look grace calculation
        const lookAwayActive = simulatedSettingRef.current === FocusState.DISTRACTED && !simulatedDrowsyRef.current;
        if (lookAwayActive) {
          consecutiveDistractionTicksRef.current += 1;
          const currentDistractedSec = Math.floor(consecutiveDistractionTicksRef.current * 0.5);
          setDistractionGraceSeconds(currentDistractedSec);

          if (currentDistractedSec >= maxGraceSeconds) {
            onStateChangeRef.current(FocusState.DISTRACTED);
            if (!lookAwayTriggeredThisPeriodRef.current) {
              lookAwayTriggeredThisPeriodRef.current = true;
              onLookAwayOccurrenceRef.current();
            }
          } else {
            onStateChangeRef.current(FocusState.FOCUSED);
          }
        } else {
          consecutiveDistractionTicksRef.current = 0;
          setDistractionGraceSeconds(0);
          lookAwayTriggeredThisPeriodRef.current = false;
        }

        // 2. Phone Active grace calculation
        const phoneActive = isSimulatingPhoneRef.current || (simulatedSettingRef.current === FocusState.DISTRACTED && simulatedDrowsyRef.current);
        if (phoneActive) {
          consecutivePhoneTicksRef.current += 1;
          const currentPhoneSec = Math.floor(consecutivePhoneTicksRef.current * 0.5);
          setPhoneGraceSeconds(currentPhoneSec);

          if (currentPhoneSec >= 5) {
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

        // 3. Erratic Movement grace calculation
        const movementActive = isSimulatingMovementRef.current;
        setLiveErraticMotionDetected(movementActive);
        if (movementActive) {
          consecutiveMovementTicksRef.current += 1;
          const currentMovementSec = Math.floor(consecutiveMovementTicksRef.current * 0.5);
          setMovementGraceSeconds(currentMovementSec);

          if (currentMovementSec >= 5) {
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

        // 4. Away state simulation
        if (simulatedSettingRef.current === FocusState.AWAY) {
          onStateChangeRef.current(FocusState.AWAY);
        }

        // Update simulator feedback metrics
        setCurrentEAR(simulatedDrowsyRef.current ? 0.14 : 0.28);
        setCurrentAsymmetry(lookAwayActive ? 2.3 : 1.1);
        setFacePositionOffset(lookAwayActive ? 0.35 : 0.04);
        return;
      }

      // -- BRANCH B: REAL CAMERA TRACKER ACTIVE --
      const video = videoRef.current;
      if (!video || video.paused || video.ended) return;

      try {
        // Detect single face with landmarks using optimized tiny face detector options
        const detection = await faceapi.detectSingleFace(
          video,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 })
        ).withFaceLandmarks(true);

        if (!detection) {
          // NO FACE DETECTED
          setCurrentEAR(null);
          setCurrentAsymmetry(null);
          setFacePositionOffset(null);
          onDrowsinessChangeRef.current(false);

          consecutiveDistractionTicksRef.current = 0;
          setDistractionGraceSeconds(0);

          // Buffer AWAY state: Only declare AWAY if no face detected for more than awayThresholdSeconds
          if (awayTimerStartRef.current === null) {
            awayTimerStartRef.current = Date.now();
          } else {
            const timeWithoutFace = Date.now() - awayTimerStartRef.current;
            if (timeWithoutFace >= awayThresholdSeconds * 1000) {
              onStateChangeRef.current(FocusState.AWAY);
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

        // Check if drowsy / closed eyes (avgEAR < 0.17 is closed/very drowsy)
        const isCurrentlyDrowsy = avgEAR < 0.17;
        onDrowsinessChangeRef.current(isCurrentlyDrowsy);

        // Calculate nose vector tracking frame delta for real erratic motion
        if (lastNosePositionRef.current) {
          const dx = Math.abs(nosePoint.x - lastNosePositionRef.current.x);
          const dy = Math.abs(nosePoint.y - lastNosePositionRef.current.y);
          const delta = Math.sqrt(dx * dx + dy * dy);
          
          // Higher motion threshold for relaxed sensitivity, strict registers movement quickly
          const movementDeltaLimit = sensValue === 1 ? 55 : sensValue === 3 ? 20 : 32;
          
          // Classify frame movement
          isErraticMovementDetectedRef.current = (delta > movementDeltaLimit);
        }
        lastNosePositionRef.current = { x: nosePoint.x, y: nosePoint.y };

        // 1. Handle sideways Look Away detection
        const isHeadTurned = asymmetry > asymmetryThreshold;
        const isOffCenter = offsetPercent > offCenterThreshold;

        if (isHeadTurned || isOffCenter) {
          consecutiveDistractionTicksRef.current += 1;
          const currentDistractedSec = Math.floor(consecutiveDistractionTicksRef.current * 0.5);
          setDistractionGraceSeconds(currentDistractedSec);

          if (currentDistractedSec >= maxGraceSeconds) {
            onStateChangeRef.current(FocusState.DISTRACTED);
            if (!lookAwayTriggeredThisPeriodRef.current) {
              lookAwayTriggeredThisPeriodRef.current = true;
              onLookAwayOccurrenceRef.current();
            }
          } else {
            onStateChangeRef.current(FocusState.FOCUSED);
          }
        } else {
          // Looking back straight: reset grace counter silently
          consecutiveDistractionTicksRef.current = 0;
          setDistractionGraceSeconds(0);
          lookAwayTriggeredThisPeriodRef.current = false;
          onStateChangeRef.current(FocusState.FOCUSED);
        }

        // 2. Handle Phone active detection via webcam simulated toggle
        const phoneActive = isSimulatingPhoneRef.current;
        if (phoneActive) {
          consecutivePhoneTicksRef.current += 1;
          const currentPhoneSec = Math.floor(consecutivePhoneTicksRef.current * 0.5);
          setPhoneGraceSeconds(currentPhoneSec);

          if (currentPhoneSec >= 5) {
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

        // 3. Handle Erratic movement tracking (combines physical delta + button mock)
        const movementActive = isSimulatingMovementRef.current || isErraticMovementDetectedRef.current;
        setLiveErraticMotionDetected(movementActive);
        if (movementActive) {
          consecutiveMovementTicksRef.current += 1;
          const currentMovementSec = Math.floor(consecutiveMovementTicksRef.current * 0.5);
          setMovementGraceSeconds(currentMovementSec);

          if (currentMovementSec >= 5) {
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

  // Resolve current active thresholds based on sensitivity
  let maxGraceSeconds = 5;
  let asymmetryThreshold = 1.65;
  if (sensitivity === 1) { // Relaxed
    maxGraceSeconds = 8;
    asymmetryThreshold = 2.0;
  } else if (sensitivity === 3) { // Strict
    maxGraceSeconds = 2;
    asymmetryThreshold = 1.35;
  }

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

          {/* Distraction Grace Warning HUD overlay */}
          {currentState === FocusState.FOCUSED && (distractionGraceSeconds > 0 || phoneGraceSeconds > 0 || movementGraceSeconds > 0) && (
            <div className="absolute top-3 left-3 right-3 bg-amber-500/95 backdrop-blur-md text-slate-950 px-4 py-2.5 rounded-xl flex items-center justify-between shadow-lg border border-amber-400/30 z-10 animate-[bounce_1.5s_infinite]">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4.5 h-4.5 text-slate-950 shrink-0" />
                <div className="text-left leading-tight">
                  <p className="font-sans font-bold text-xs uppercase tracking-wider border-b border-slate-950/20 pb-0.5">
                    {distractionGraceSeconds > 0 ? 'Looking Away' : phoneGraceSeconds > 0 ? 'Phone Detected' : 'Erratic Movement'}
                  </p>
                  <p className="font-sans text-[10px] opacity-90 mt-0.5">Please focus back to preserve your session</p>
                </div>
              </div>
              <div className="flex flex-col items-end leading-none">
                <span className="font-mono font-black text-sm">
                  {distractionGraceSeconds > 0 
                    ? `${distractionGraceSeconds}s / ${maxGraceSeconds}s` 
                    : phoneGraceSeconds > 0 
                      ? `${phoneGraceSeconds}s / 5s` 
                      : `${movementGraceSeconds}s / 5s`}
                </span>
                <span className="text-[8px] uppercase font-bold tracking-widest opacity-80 mt-0.5">Grace Period</span>
              </div>
            </div>
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
              <span className={currentAsymmetry > asymmetryThreshold ? 'text-[#FBBF24]' : 'text-[#34D399]'}>
                {unifyAsymmetry(currentAsymmetry).toFixed(1)}° {currentAsymmetry > asymmetryThreshold ? '(Looking away)' : '(Looking straight)'}
              </span>
            ) : (
              '-- (No face)'
            )}
          </span>
        </div>
      </div>

      {/* Manual Distraction Simulators Grid (Always accessible for testing the chances warning design) */}
      <div className="bg-[#111116] border border-[#2A2A35]/40 p-3 rounded-lg flex flex-col space-y-2 select-none">
        <p className="text-[9px] uppercase tracking-wider font-extrabold text-[#9CA3AF] flex items-center space-x-1">
          <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
          <span>Manual Distraction Injector (Webcam & Simulation compatible)</span>
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

        {/* Realtime progress bars to show timer counting up to 5s */}
        {(isSimulatingPhone || isSimulatingMovement || liveErraticMotionDetected) && (
          <div className="text-[9px] text-[#9CA3AF] font-mono leading-relaxed pt-1 border-t border-[#2A2A35]/30 space-y-1">
            {isSimulatingPhone && (
              <div className="flex justify-between items-center">
                <span>Phone holding grace:</span>
                <span className="font-bold text-[#F5F5F7] bg-black/40 px-1 rounded">{phoneGraceSeconds}s / 5s</span>
              </div>
            )}
            {(isSimulatingMovement || liveErraticMotionDetected) && (
              <div className="flex justify-between items-center">
                <span>Erratic motion grace:</span>
                <span className="font-bold text-[#F5F5F7] bg-black/40 px-1 rounded">{movementGraceSeconds}s / 5s</span>
              </div>
            )}
          </div>
        )}
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
