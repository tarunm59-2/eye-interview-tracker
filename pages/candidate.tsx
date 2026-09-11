import { useCallback, useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/auth-client";
import { calculateProfessionalismScore, dominantExpression, getScoreLabel } from "@/lib/scoring";
import type { Assessment, ExpressionSample } from "@/lib/types";

const ASSESSMENT_MS = 10_000;

function CandidateWorkspace() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const samplesRef = useRef<ExpressionSample[]>([]);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [remainingMs, setRemainingMs] = useState(ASSESSMENT_MS);
  const [error, setError] = useState("");
  const [latest, setLatest] = useState<Assessment | null>(null);
  const [history, setHistory] = useState<Assessment[]>([]);
  const [expression, setExpression] = useState("Waiting...");

  const loadHistory = useCallback(async () => {
    const data = await apiFetch<{ assessments: Assessment[] }>("/api/assessments");
    setHistory(data.assessments);
    setLatest(data.assessments[0] ?? null);
  }, []);

  useEffect(() => {
    loadHistory().catch(() => undefined);
  }, [loadHistory]);

  useEffect(() => {
    let stream: MediaStream | undefined;
    const start = async () => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceExpressionNet.loadFromUri("/models"),
      ]);
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setReady(true);
    };
    start().catch(() => setError("Unable to start camera. Allow webcam access and retry."));
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return;
      const displaySize = {
        width: videoRef.current.videoWidth || 640,
        height: videoRef.current.videoHeight || 480,
      };
      faceapi.matchDimensions(canvasRef.current, displaySize);
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();
      const resized = faceapi.resizeResults(detections, displaySize);
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      faceapi.draw.drawDetections(canvasRef.current, resized);

      if (detections[0]?.expressions) {
        const sorted = Object.entries(detections[0].expressions).sort((a, b) => b[1] - a[1]);
        const current = { expression: sorted[0][0], confidence: sorted[0][1], timestamp: Date.now() };
        setExpression(current.expression);
        if (recording) {
          samplesRef.current = [...samplesRef.current, current];
        }
      }
    }, 300);
    return () => clearInterval(interval);
  }, [ready, recording]);

  const captureSnapshot = () => {
    const video = videoRef.current;
    if (!video) return null;
    const snap = document.createElement("canvas");
    snap.width = video.videoWidth || 320;
    snap.height = video.videoHeight || 240;
    snap.getContext("2d")?.drawImage(video, 0, 0, snap.width, snap.height);
    return snap.toDataURL("image/jpeg", 0.7);
  };

  const startAssessment = async () => {
    setError("");
    samplesRef.current = [];
    setRecording(true);
    const startedAt = Date.now();
    setRemainingMs(ASSESSMENT_MS);

    await new Promise<void>((resolve) => {
      const tick = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        setRemainingMs(Math.max(0, ASSESSMENT_MS - elapsed));
        if (elapsed >= ASSESSMENT_MS) {
          clearInterval(tick);
          resolve();
        }
      }, 100);
    });

    setRecording(false);
    const samples = samplesRef.current;
    const metrics = calculateProfessionalismScore(samples);
    try {
      const data = await apiFetch<{ assessment: Assessment }>("/api/assessments", {
        method: "POST",
        body: JSON.stringify({
          durationMs: ASSESSMENT_MS,
          samples,
          metrics,
          dominantExpression: dominantExpression(samples),
          snapshot: captureSnapshot(),
        }),
      });
      setLatest(data.assessment);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save assessment");
    }
  };

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <NavBar user={user} />
        <h1 className="mb-2 text-3xl font-bold">Integrity assessment</h1>
        <p className="mb-6 text-slate-400">
          Sit naturally in front of the camera. We record 10 seconds of posture and expression —
          nothing else.
        </p>
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-slate-800 p-4">
            <div className="relative inline-block w-full">
              <video ref={videoRef} autoPlay muted playsInline className="w-full rounded-xl" />
              <canvas ref={canvasRef} className="absolute left-0 top-0 h-full w-full rounded-xl" />
              {recording && (
                <div className="absolute right-3 top-3 rounded-full bg-red-500 px-3 py-1 text-sm">
                  {(remainingMs / 1000).toFixed(1)}s
                </div>
              )}
            </div>
            <p className="mt-3 text-center text-slate-300">
              Current expression: <span className="font-semibold text-blue-400">{expression}</span>
            </p>
            <button
              type="button"
              onClick={startAssessment}
              disabled={!ready || recording}
              className="mt-4 w-full rounded-lg bg-green-600 py-2 hover:bg-green-500 disabled:bg-slate-600"
            >
              {recording ? "Recording..." : "Start 10-second assessment"}
            </button>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-800 p-6">
              <h2 className="mb-2 text-xl font-bold">Latest result</h2>
              {latest ? (
                <>
                  <p className="text-4xl font-bold text-blue-400">{latest.metrics.score}</p>
                  <p className="text-slate-400">{getScoreLabel(latest.metrics.score)}</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Dominant: {latest.dominantExpression} ·{" "}
                    {new Date(latest.createdAt).toLocaleString()}
                  </p>
                </>
              ) : (
                <p className="text-slate-400">No assessment submitted yet.</p>
              )}
            </div>
            <div className="rounded-2xl bg-slate-800 p-6">
              <h2 className="mb-3 text-lg font-bold">Your submissions</h2>
              <ul className="space-y-2 text-sm">
                {history.map((item) => (
                  <li key={item.id} className="flex justify-between rounded-lg bg-slate-700 px-3 py-2">
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                    <span>Score {item.metrics.score}</span>
                  </li>
                ))}
                {history.length === 0 && <li className="text-slate-400">None yet</li>}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function CandidatePage() {
  return (
    <AuthGuard role="candidate">
      <CandidateWorkspace />
    </AuthGuard>
  );
}
