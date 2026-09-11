export type FaceDetection = {
  expressions?: Record<string, number>;
};

export type FaceApi = {
  nets: {
    tinyFaceDetector: { loadFromUri: (uri: string) => Promise<unknown> };
    faceExpressionNet: { loadFromUri: (uri: string) => Promise<unknown> };
  };
  matchDimensions: (canvas: HTMLCanvasElement, size: { width: number; height: number }) => void;
  detectAllFaces: (
    input: HTMLVideoElement,
    options?: object,
  ) => { withFaceExpressions: () => Promise<FaceDetection[]> };
  TinyFaceDetectorOptions: new () => object;
  resizeResults: <T>(d: T, size: { width: number; height: number }) => T;
  draw: { drawDetections: (canvas: HTMLCanvasElement, results: unknown) => void };
};

declare global {
  interface Window {
    faceapi?: FaceApi;
  }
}

export function loadFaceApi(): Promise<FaceApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("face-api is browser only"));
  }
  if (window.faceapi) {
    return Promise.resolve(window.faceapi);
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/face-api.min.js";
    script.async = true;
    script.onload = () => {
      if (!window.faceapi) {
        reject(new Error("face-api failed to load"));
        return;
      }
      resolve(window.faceapi);
    };
    script.onerror = () => reject(new Error("face-api failed to load"));
    document.head.appendChild(script);
  });
}
