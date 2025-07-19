'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

interface ExpressionHistory {
  expression: string;
  confidence: number;
  timestamp: number;
}

interface ProfessionalismMetrics {
  score: number;
  stability: number;
  engagement: number;
  composure: number;
  authenticity: number;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [expression, setExpression] = useState<string>('Loading...');
  const [expressionHistory, setExpressionHistory] = useState<ExpressionHistory[]>([]);
  const [professionalismMetrics, setProfessionalismMetrics] = useState<ProfessionalismMetrics>({
    score: 0,
    stability: 0,
    engagement: 0,
    composure: 0,
    authenticity: 0
  });
  const [sessionStartTime] = useState<number>(Date.now());
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const calculateProfessionalismScore = (history: ExpressionHistory[]): ProfessionalismMetrics => {
    if (history.length < 10) {
      return { score: 0, stability: 0, engagement: 0, composure: 0, authenticity: 0 };
    }

    // Get recent data (last 30 seconds)
    const recentHistory = history.filter(h => Date.now() - h.timestamp < 30000);
    const last60Seconds = history.filter(h => Date.now() - h.timestamp < 60000);
    
    // 1. STABILITY (25% weight) - Consistent, controlled expressions
    const expressionCounts = recentHistory.reduce((acc, curr) => {
      acc[curr.expression] = (acc[curr.expression] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const dominantExpressions = Object.entries(expressionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    const stabilityBonus = dominantExpressions.reduce((sum, [expr, count]) => {
      const percentage = count / recentHistory.length;
      if (['neutral', 'happy'].includes(expr)) return sum + (percentage * 100);
      if (['surprised', 'sad', 'angry', 'disgusted', 'fearful'].includes(expr)) {
        return sum + Math.max(0, (percentage * 50) - 20); // Penalty for negative expressions
      }
      return sum;
    }, 0);
    
    const stability = Math.min(100, stabilityBonus);

    // 2. ENGAGEMENT (25% weight) - Appropriate positive expressions
    const positiveExpressions = recentHistory.filter(h => 
      ['happy', 'surprised'].includes(h.expression) && h.confidence > 0.6
    );
    const neutralExpressions = recentHistory.filter(h => h.expression === 'neutral');
    
    const engagementRatio = (positiveExpressions.length + neutralExpressions.length * 0.7) / recentHistory.length;
    const engagement = Math.min(100, engagementRatio * 120); // Slight bonus for good engagement

    // 3. COMPOSURE (25% weight) - Low frequency of negative emotions
    const negativeExpressions = recentHistory.filter(h => 
      ['angry', 'fearful', 'disgusted', 'sad'].includes(h.expression)
    );
    const negativeRatio = negativeExpressions.length / recentHistory.length;
    const composure = Math.max(0, 100 - (negativeRatio * 200)); // Heavy penalty for negative emotions

    // 4. AUTHENTICITY (25% weight) - Natural variation and confidence levels
    const avgConfidence = recentHistory.reduce((sum, h) => sum + h.confidence, 0) / recentHistory.length;
    const expressionVariety = Object.keys(expressionCounts).length;
    
    // Good authenticity = high confidence + some natural variation (but not too much)
    const confidenceScore = Math.min(100, avgConfidence * 120);
    const varietyScore = expressionVariety >= 2 && expressionVariety <= 4 ? 100 : 
                       expressionVariety === 1 ? 60 : // Too monotone
                       Math.max(20, 100 - ((expressionVariety - 4) * 15)); // Too erratic
    
    const authenticity = (confidenceScore + varietyScore) / 2;

    // Overall score with weighted average
    const overallScore = (stability * 0.25 + engagement * 0.25 + composure * 0.25 + authenticity * 0.25);

    return {
      score: Math.round(overallScore),
      stability: Math.round(stability),
      engagement: Math.round(engagement),
      composure: Math.round(composure),
      authenticity: Math.round(authenticity)
    };
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Very Good';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    if (score >= 50) return 'Below Average';
    return 'Needs Improvement';
  };

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      startVideo();
    };

    const startVideo = () => {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => console.error('Error accessing webcam: ', err));
    };

    loadModels();
  }, []);

  useEffect(() => {
    const detect = async () => {
      if (
        videoRef.current &&
        canvasRef.current &&
        faceapi.nets.tinyFaceDetector.params
      ) {
        const displaySize = {
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight,
        };

        faceapi.matchDimensions(canvasRef.current, displaySize);

        const detectionInterval = setInterval(async () => {
          const detections = await faceapi
            .detectAllFaces(videoRef.current!, new faceapi.TinyFaceDetectorOptions())
            .withFaceExpressions();

          const resized = faceapi.resizeResults(detections, displaySize);
          canvasRef.current!.getContext('2d')?.clearRect(0, 0, displaySize.width, displaySize.height);
          faceapi.draw.drawDetections(canvasRef.current!, resized);

          if (detections[0]?.expressions) {
            const sorted = Object.entries(detections[0].expressions).sort(
              (a, b) => b[1] - a[1]
            );
            const currentExpression = sorted[0][0];
            const confidence = sorted[0][1];
            
            setExpression(currentExpression);
            
            // Add to history
            setExpressionHistory(prev => {
              const newHistory = [...prev, {
                expression: currentExpression,
                confidence: confidence,
                timestamp: Date.now()
              }];
              
              // Keep only last 2 minutes of data
              const filtered = newHistory.filter(h => Date.now() - h.timestamp < 120000);
              
              // Calculate new metrics
              const newMetrics = calculateProfessionalismScore(filtered);
              setProfessionalismMetrics(newMetrics);
              
              return filtered;
            });
          }
        }, 300);

        return () => clearInterval(detectionInterval);
      }
    };

    videoRef.current?.addEventListener('playing', detect);
  }, []);

  const startAnalysis = () => {
    setIsAnalyzing(true);
    setExpressionHistory([]);
    setProfessionalismMetrics({
      score: 0,
      stability: 0,
      engagement: 0,
      composure: 0,
      authenticity: 0
    });
  };

  const resetAnalysis = () => {
    setIsAnalyzing(false);
    setExpressionHistory([]);
    setProfessionalismMetrics({
      score: 0,
      stability: 0,
      engagement: 0,
      composure: 0,
      authenticity: 0
    });
  };

  const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000);
  const minutes = Math.floor(sessionDuration / 60);
  const seconds = sessionDuration % 60;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Interview Professionalism Analyzer
          </h1>
          <p className="text-slate-400">Real-time facial expression analysis for interview preparation</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Video Feed */}
          <div className="space-y-4">
            <div className="relative bg-slate-800 rounded-2xl p-4">
              <div className="relative inline-block">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="rounded-xl w-full max-w-md"
                  width="640"
                  height="480"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 rounded-xl"
                  width="640"
                  height="480"
                />
                {isAnalyzing && (
                  <div className="absolute top-2 right-2 bg-red-500 w-3 h-3 rounded-full animate-pulse"></div>
                )}
              </div>
              
              <div className="mt-4 text-center">
                <p className="text-lg mb-2">Current Expression: <span className="font-semibold text-blue-400">{expression}</span></p>
                <p className="text-sm text-slate-400">Session Duration: {minutes}m {seconds}s</p>
              </div>

              <div className="flex gap-3 mt-4 justify-center">
                <button
                  onClick={startAnalysis}
                  disabled={isAnalyzing}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
                </button>
                <button
                  onClick={resetAnalysis}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Professionalism Dashboard */}
          <div className="space-y-4">
            {/* Overall Score */}
            <div className="bg-slate-800 rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4">Professionalism Score</h2>
              <div className="text-center">
                <div className={`text-5xl font-bold mb-2 ${getScoreColor(professionalismMetrics.score)}`}>
                  {professionalismMetrics.score}
                </div>
                <div className="text-lg text-slate-400">
                  {getScoreLabel(professionalismMetrics.score)}
                </div>
                <div className="w-full bg-slate-700 rounded-full h-3 mt-4">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${
                      professionalismMetrics.score >= 80 ? 'bg-green-500' :
                      professionalismMetrics.score >= 60 ? 'bg-yellow-500' :
                      professionalismMetrics.score >= 40 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${professionalismMetrics.score}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Detailed Metrics */}
            <div className="bg-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4">Detailed Analysis</h3>
              <div className="space-y-4">
                {[
                  { label: 'Emotional Stability', value: professionalismMetrics.stability, desc: 'Consistency in expressions' },
                  { label: 'Engagement Level', value: professionalismMetrics.engagement, desc: 'Positive & attentive demeanor' },
                  { label: 'Composure', value: professionalismMetrics.composure, desc: 'Control over negative emotions' },
                  { label: 'Authenticity', value: professionalismMetrics.authenticity, desc: 'Natural confidence levels' }
                ].map((metric, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{metric.label}</span>
                        <span className={`text-sm font-bold ${getScoreColor(metric.value)}`}>
                          {metric.value}
                        </span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${
                            metric.value >= 80 ? 'bg-green-500' :
                            metric.value >= 60 ? 'bg-yellow-500' :
                            metric.value >= 40 ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${metric.value}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{metric.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="bg-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4">💡 Tips for Improvement</h3>
              <div className="space-y-2 text-sm">
                {professionalismMetrics.stability < 70 && (
                  <p className="text-yellow-400">• Try to maintain neutral or slightly positive expressions consistently</p>
                )}
                {professionalismMetrics.engagement < 70 && (
                  <p className="text-yellow-400">• Show more genuine interest through appropriate facial expressions</p>
                )}
                {professionalismMetrics.composure < 70 && (
                  <p className="text-yellow-400">• Practice managing stress responses and negative emotions</p>
                )}
                {professionalismMetrics.authenticity < 70 && (
                  <p className="text-yellow-400">• Be more natural - avoid forced expressions or monotone delivery</p>
                )}
                {professionalismMetrics.score >= 80 && (
                  <p className="text-green-400">• Excellent work! You&apos;re demonstrating strong professional presence</p>
                )}
              </div>
            </div>

            {/* Expression History Preview */}
            {expressionHistory.length > 0 && (
              <div className="bg-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4">Recent Expression Pattern</h3>
                <div className="flex flex-wrap gap-2">
                  {expressionHistory.slice(-10).map((hist, index) => (
                    <div 
                      key={index}
                      className="px-2 py-1 bg-slate-700 rounded text-xs"
                      title={`Confidence: ${(hist.confidence * 100).toFixed(1)}%`}
                    >
                      {hist.expression}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {!isAnalyzing && expressionHistory.length === 0 && (
          <div className="text-center mt-8 p-6 bg-slate-800 rounded-2xl">
            <p className="text-slate-400">Click &ldquo;Start Analysis&rdquo; to begin your interview professionalism assessment.</p>
          </div>
        )}
      </div>
    </main>
  );
}