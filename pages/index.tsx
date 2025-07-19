'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [expression, setExpression] = useState<string>('Loading...');

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

        setInterval(async () => {
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
            setExpression(sorted[0][0]);
          }
        }, 300);
      }
    };

    videoRef.current?.addEventListener('playing', detect);
  }, []);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-black text-white">
      <h1 className="text-xl mb-2">Facial Expression: {expression}</h1>
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          muted
          className="rounded-xl"
          width="640"
          height="480"
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0"
          width="640"
          height="480"
        />
      </div>
    </main>
  );
}