import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

// Fix the dynamic import for react-webcam
const Webcam = dynamic(() => import("react-webcam").then(mod => ({ default: mod.default })), { 
  ssr: false 
});

export default function Home() {
  const webcamRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [interviewActive, setInterviewActive] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [webcamReady, setWebcamReady] = useState(false);
  const scores = useRef<number[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const faceAPIRef = useRef<any>(null); // Store the imported faceAPI
  const INTERVIEW_DURATION_MS = 60000;

  const addDebugInfo = (message: string) => {
    console.log("DEBUG:", message);
    setDebugInfo(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    const loadModels = async () => {
      try {
        addDebugInfo("Starting to load face-api.js models...");
        
        // Import face-api.js dynamically and store reference
        // Only import on client side
        if (typeof window === "undefined") return;
        
        const faceAPI = await import("face-api.js");
        faceAPIRef.current = faceAPI;
        addDebugInfo("face-api.js imported successfully");
        
        const MODEL_URL = "/models";
        addDebugInfo(`Loading models from: ${MODEL_URL}`);
        
        // Load models one by one with proper error handling
        await faceAPI.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        addDebugInfo("✅ Tiny face detector loaded");
        
        await faceAPI.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        addDebugInfo("✅ Face expression model loaded");
        
        await faceAPI.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        addDebugInfo("✅ Face landmarks model loaded");
        
        setModelsLoaded(true);
        addDebugInfo("✅ All models loaded successfully - ready for face detection");
        
      } catch (err: any) {
        console.error("Error loading models:", err);
        setError(`Failed to load face detection models: ${err.message}`);
        addDebugInfo(`❌ Model loading failed: ${err.message}`);
      }
    };

    // Only load models on client side
    loadModels();
  }, []);

  const startInterview = async () => {
    if (!modelsLoaded || !faceAPIRef.current) {
      setError("Models not loaded yet");
      return;
    }

    try {
      addDebugInfo("Starting interview...");
      setError(null);
      scores.current = [];
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user' 
        } 
      });
      
      addDebugInfo("Webcam stream obtained");
      
      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
        
        // Wait for video to be ready, then start everything
        const waitForVideo = () => {
          return new Promise<void>((resolve) => {
            const checkVideo = () => {
              if (webcamRef.current && 
                  webcamRef.current.readyState === 4 && 
                  webcamRef.current.videoWidth > 0) {
                addDebugInfo("Video is fully ready");
                resolve();
              } else {
                addDebugInfo("Video not ready yet, checking again...");
                setTimeout(checkVideo, 100);
              }
            };
            checkVideo();
          });
        };
        
        webcamRef.current.onloadedmetadata = () => {
          addDebugInfo("Video metadata loaded");
        };
        
        // Wait for video to be ready, then set states and start detection
        await waitForVideo();
        
        addDebugInfo("Setting interview active and webcam ready...");
        setInterviewActive(true);
        setWebcamReady(true);
        
        // Start detection immediately after states are set
        addDebugInfo("Starting detection immediately...");
        runScoring();
        
        // Set timeout to stop interview
        timeoutRef.current = setTimeout(() => {
          addDebugInfo("Interview duration reached, stopping...");
          stopInterview();
        }, INTERVIEW_DURATION_MS);
      }
      
    } catch (err: any) {
      console.error("Webcam error:", err);
      setError(`Failed to access webcam: ${err.message}`);
      addDebugInfo(`❌ Webcam error: ${err.message}`);
      setInterviewActive(false);
    }
  };

  const stopInterview = () => {
    addDebugInfo("Stopping interview...");
    
    // Clear interval using custom cleanup if available
    if (intervalRef.current) {
      if ((intervalRef as any).cleanup) {
        (intervalRef as any).cleanup();
      } else {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    
    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      addDebugInfo("Interview timeout cleared");
    }
    
    // Calculate final score
    if (scores.current.length > 0) {
      const avg = scores.current.reduce((acc, val) => acc + val, 0) / scores.current.length;
      setFinalScore(Math.round(avg));
      addDebugInfo(`Final score calculated: ${Math.round(avg)} from ${scores.current.length} measurements`);
    } else {
      setFinalScore(0);
      addDebugInfo("❌ No measurements collected - no face detected");
    }
    
    // Stop webcam
    if (webcamRef.current && webcamRef.current.srcObject) {
      const stream = webcamRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      webcamRef.current.srcObject = null;
    }
    
    // Reset states
    setWebcamReady(false);
    setInterviewActive(false);
  };

  const runScoring = async () => {
    try {
      const faceAPI = faceAPIRef.current;
      if (!faceAPI) {
        addDebugInfo("❌ Face API not available");
        return;
      }
      
      addDebugInfo("Face detection loop started");
      
      let detectionCount = 0;
      let isRunning = true; // Local flag to track if we should continue
      
      const doDetection = async () => {
        detectionCount++;
        addDebugInfo(`🔄 Detection attempt #${detectionCount}`);
        
        // Check if we should stop (using local flag and refs)
        if (!isRunning) {
          addDebugInfo("❌ Detection stopped by local flag");
          return;
        }
        
        // Check webcam reference
        if (!webcamRef.current) {
          addDebugInfo("❌ No webcam reference");
          return;
        }

        try {
          const video = webcamRef.current;
          
          addDebugInfo(`🔍 Video state: readyState=${video.readyState}, size=${video.videoWidth}x${video.videoHeight}`);
          
          // Check if video is ready
          if (video.readyState !== 4 || video.videoWidth === 0 || video.videoHeight === 0) {
            addDebugInfo("❌ Video not ready, skipping detection");
            return;
          }
          
          // Try detection with different approaches
          const detectionOptions = [
            { inputSize: 512, scoreThreshold: 0.5 },
            { inputSize: 416, scoreThreshold: 0.4 },
            { inputSize: 320, scoreThreshold: 0.3 },
            { inputSize: 224, scoreThreshold: 0.2 }
          ];
          
          let detections: any = null;
          let faceDetection: any = null;
          let expressions: any = null;
          let landmarks: any = null;
          
          for (let i = 0; i < detectionOptions.length && !detections; i++) {
            const options = detectionOptions[i];
            addDebugInfo(`Trying detection ${i + 1}/4: inputSize=${options.inputSize}, threshold=${options.scoreThreshold}`);
            
            try {
              // Step 1: Basic face detection
              faceDetection = await faceAPI.detectSingleFace(
                video, 
                new faceAPI.TinyFaceDetectorOptions(options)
              );
              
              if (!faceDetection || faceDetection.score < options.scoreThreshold) {
                addDebugInfo(`No face or low confidence: ${faceDetection?.score?.toFixed(3) || 'none'}`);
                continue;
              }
              
              addDebugInfo(`✅ Face detected! Confidence: ${faceDetection.score.toFixed(3)}`);
              
              // Step 2: Get expressions
              try {
                expressions = await faceAPI.detectFaceExpressions(video);
                if (expressions && expressions.length > 0) {
                  addDebugInfo(`✅ Expressions detected: ${Object.keys(expressions[0].expressions).length} types`);
                } else {
                  addDebugInfo("❌ No expressions detected");
                }
              } catch (expErr: any) {
                addDebugInfo(`❌ Expression detection failed: ${expErr.message}`);
              }
              
              // Step 3: Get landmarks
              try {
                landmarks = await faceAPI.detectFaceLandmarks(video);
                if (landmarks && landmarks.length > 0) {
                  addDebugInfo(`✅ Landmarks detected: ${landmarks[0].positions.length} points`);
                } else {
                  addDebugInfo("❌ No landmarks detected");
                }
              } catch (landErr: any) {
                addDebugInfo(`❌ Landmark detection failed: ${landErr.message}`);
              }
              
              // Create combined detection object
              detections = {
                detection: faceDetection,
                expressions: expressions?.[0]?.expressions || {},
                landmarks: landmarks?.[0] || null
              };
              
              break;
              
            } catch (err: any) {
              addDebugInfo(`Detection attempt ${i + 1} failed: ${err.message}`);
            }
          }

          if (detections && detections.detection) {
            const score = scoreFromDetections(detections);
            scores.current.push(score);
            addDebugInfo(`📊 Score: ${score}/100 (Total: ${scores.current.length} measurements)`);

            // Draw detections on canvas
            const canvas = canvasRef.current;
            if (canvas) {
              const displaySize = { width: video.videoWidth, height: video.videoHeight };
              faceAPI.matchDimensions(canvas, displaySize);
              
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw face box
                const box = detections.detection.box;
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 2;
                ctx.strokeRect(box.x, box.y, box.width, box.height);
                
                // Draw confidence score
                ctx.fillStyle = '#00ff00';
                ctx.font = '16px Arial';
                ctx.fillText(`${(detections.detection.score * 100).toFixed(1)}%`, box.x, box.y - 5);
                
                addDebugInfo("✅ Drew detection overlay");
              }
            }
          } else {
            addDebugInfo("❌ No face detected with any settings");
            
            // Clear canvas if no face detected
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
              }
            }
          }
        } catch (err: any) {
          addDebugInfo(`❌ Detection error: ${err.message}`);
          console.error("Detection error:", err);
        }
      };
      
      // Start the interval
      addDebugInfo("Setting up detection interval (every 1.5 seconds)");
      intervalRef.current = setInterval(doDetection, 1500);
      
      // Store cleanup function
      const cleanup = () => {
        isRunning = false;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          addDebugInfo("Detection interval cleared");
        }
      };
      
      // Store cleanup in ref for stopInterview to use
      (intervalRef as any).cleanup = cleanup;
      
      // Run first detection after a short delay
      setTimeout(() => {
        addDebugInfo("Running first detection...");
        doDetection();
      }, 500);
      
    } catch (err: any) {
      addDebugInfo(`❌ Failed to start detection: ${err.message}`);
      console.error("Failed to start detection:", err);
    }
  };

  const scoreFromDetections = (detection: any) => {
    const { expressions } = detection;
    const { 
      neutral = 0, 
      happy = 0, 
      sad = 0, 
      angry = 0, 
      disgusted = 0, 
      fearful = 0,
      surprised = 0
    } = expressions;
    
    let score = 50; // Base score

    // Expression scoring - more balanced approach
    score += neutral * 25;      // Neutral is very important for professionalism
    score += happy * 15;        // Slight smile is good
    score += surprised * 5;     // Small bonus for alertness
    score -= (angry + sad + disgusted + fearful) * 20; // Penalty for negative emotions

    // Head alignment bonus
    try {
      if (detection.landmarks && detection.landmarks.positions) {
        const positions = detection.landmarks.positions;
        const nose = positions.slice(27, 36); // Nose landmarks
        
        if (nose && nose.length >= 2) {
          const noseTip = nose[Math.floor(nose.length / 2)]; // Middle of nose
          const faceBox = detection.detection.box;
          const faceCenter = faceBox.x + faceBox.width / 2;
          const alignment = Math.abs(noseTip.x - faceCenter);
          
          if (alignment < 20) {
            score += 10; // Good alignment bonus
          } else if (alignment > 40) {
            score -= 5;  // Poor alignment penalty
          }
        }
      }
    } catch (err) {
      console.error("Landmark processing error:", err);
    }

    // Ensure score is within valid range
    const finalScore = Math.max(10, Math.min(100, Math.round(score)));
    
    addDebugInfo(`Expression breakdown: neutral:${(neutral*100).toFixed(0)}%, happy:${(happy*100).toFixed(0)}%, negative:${((angry+sad+disgusted+fearful)*100).toFixed(0)}%`);
    
    return finalScore;
  };

  const resetEvaluation = () => {
    addDebugInfo("Resetting evaluation...");
    setFinalScore(null);
    setError(null);
    scores.current = [];
    
    // Clear all intervals and timeouts
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Stop webcam
    if (webcamRef.current && webcamRef.current.srcObject) {
      const stream = webcamRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      webcamRef.current.srcObject = null;
    }
    
    setWebcamReady(false);
    setInterviewActive(false);
  };

  const testDetection = async () => {
    if (!modelsLoaded || !webcamRef.current || !webcamReady || !faceAPIRef.current) {
      addDebugInfo("❌ Cannot test - missing requirements");
      addDebugInfo(`Models loaded: ${modelsLoaded}, Webcam ref: ${!!webcamRef.current}, Webcam ready: ${webcamReady}, FaceAPI: ${!!faceAPIRef.current}`);
      return;
    }

    try {
      const faceAPI = faceAPIRef.current;
      const video = webcamRef.current;
      
      addDebugInfo("🧪 Running detection test...");
      addDebugInfo(`Video: ${video.videoWidth}x${video.videoHeight}, readyState: ${video.readyState}`);
      
      const faceDetection = await faceAPI.detectSingleFace(
        video, 
        new faceAPI.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.3
        })
      );

      if (faceDetection) {
        addDebugInfo(`✅ TEST PASSED! Face detected with confidence: ${faceDetection.score.toFixed(3)}`);
        
        // Try to get expressions separately
        const expressions = await faceAPI.detectFaceExpressions(video);
        const landmarks = await faceAPI.detectFaceLandmarks(video);
        
        const combinedDetection = {
          detection: faceDetection,
          expressions: expressions?.[0]?.expressions || {},
          landmarks: landmarks?.[0] || null
        };
        
        const testScore = scoreFromDetections(combinedDetection);
        addDebugInfo(`Test score would be: ${testScore}/100`);
        
        // Draw test result
        const canvas = canvasRef.current;
        if (canvas) {
          const displaySize = { width: video.videoWidth, height: video.videoHeight };
          faceAPI.matchDimensions(canvas, displaySize);
          
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw face box
            const box = faceDetection.box;
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
            
            // Draw confidence score
            ctx.fillStyle = '#00ff00';
            ctx.font = '16px Arial';
            ctx.fillText(`${(faceDetection.score * 100).toFixed(1)}%`, box.x, box.y - 5);
          }
        }
      } else {
        addDebugInfo("❌ TEST FAILED: No face detected");
        
        // Try basic detection with lower threshold
        const basicDetection = await faceAPI.detectSingleFace(
          video, 
          new faceAPI.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.1
          })
        );
          
        if (basicDetection) {
          addDebugInfo(`👀 Basic face found but low confidence: ${basicDetection.score.toFixed(3)}`);
        } else {
          addDebugInfo("❌ No face detected even with basic settings");
        }
      }
    } catch (err: any) {
      addDebugInfo(`❌ TEST ERROR: ${err.message}`);
      console.error("Test error:", err);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Store current webcam ref in cleanup to avoid stale closure
      const currentWebcamRef = webcamRef.current;
      if (currentWebcamRef && currentWebcamRef.srcObject) {
        const stream = currentWebcamRef.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        AI Professionalism Evaluator (Debug Mode)
      </h1>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded max-w-2xl">
          {error}
        </div>
      )}
      
      <div className="mb-6 text-center">
        {!modelsLoaded ? (
          <p className="text-lg text-gray-600">Loading AI models...</p>
        ) : finalScore === null ? (
          interviewActive ? (
            <div>
              <p className="text-lg text-blue-600 mb-2">Interview in progress...</p>
              <p className="text-sm text-gray-500">
                Scores collected: {scores.current.length} | Webcam ready: {webcamReady ? "✅" : "❌"}
              </p>
            </div>
          ) : (
            <p className="text-lg text-gray-600">Ready to start evaluation</p>
          )
        ) : (
          <div>
            <p className="text-lg mb-2">
              Final Professionalism Score: 
              <span className="font-mono text-2xl ml-2 text-blue-600">
                {finalScore}/100
              </span>
            </p>
            <p className="text-sm text-gray-500">
              Based on {scores.current.length} measurements
            </p>
          </div>
        )}
      </div>

      <div className="mb-6 space-x-2 flex flex-wrap justify-center gap-2">
        {!interviewActive && finalScore === null && modelsLoaded && (
          <button
            onClick={startInterview}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            Start Interview
          </button>
        )}
        
        {modelsLoaded && webcamReady && !interviewActive && (
          <button
            onClick={testDetection}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
          >
            Test Detection
          </button>
        )}
        
        {finalScore !== null && (
          <button
            onClick={resetEvaluation}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
          >
            Reset
          </button>
        )}
        
        {interviewActive && (
          <button
            onClick={stopInterview}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
          >
            Stop Interview
          </button>
        )}
      </div>

      <div className="relative bg-black rounded-lg overflow-hidden shadow-lg mb-4">
        <video
          ref={webcamRef}
          width={640}
          height={480}
          autoPlay
          muted
          playsInline
          className="block"
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="absolute top-0 left-0 pointer-events-none"
        />
        {!webcamReady && interviewActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75">
            <p className="text-white text-lg">
              {!modelsLoaded ? "Loading models..." : "Initializing webcam..."}
            </p>
          </div>
        )}
      </div>

      {/* Debug Console */}
      <div className="w-full max-w-4xl bg-black text-green-400 p-4 rounded-lg font-mono text-xs max-h-64 overflow-y-auto">
        <h3 className="text-white mb-2 font-bold">Debug Console:</h3>
        {debugInfo.length === 0 ? (
          <p className="text-gray-500">Waiting for debug info...</p>
        ) : (
          debugInfo.map((info, index) => (
            <div key={index} className="mb-1">{info}</div>
          ))
        )}
      </div>
    </div>
  );
}