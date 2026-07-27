"use client";

import React, { useState, useRef, useEffect } from "react";
import { createWorker } from "tesseract.js";
import { parseReceiptText, OCRResult } from "@/lib/ocr";
import {
  Camera,
  Upload,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  PlusCircle,
} from "lucide-react";

interface CameraScannerProps {
  onScanComplete: (result: OCRResult) => void;
  onManualMode: () => void;
}

export function CameraScanner({ onScanComplete, onManualMode }: CameraScannerProps) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Start live webcam / mobile camera stream
  const startCamera = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err: unknown) {
      console.error("Camera access error:", err);
      setErrorMsg(
        "Could not access camera. Please check camera permissions or upload a photo."
      );
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Process image data (base64 data URL or File object) with Tesseract OCR
  const processImageWithOCR = async (imageSource: string | File) => {
    setIsScanning(true);
    setProgress(0);
    setStatusText("Initializing OCR Engine...");
    setErrorMsg(null);

    try {
      const worker = await createWorker(["eng", "ind"]);
      
      setStatusText("Scanning receipt text...");
      const ret = await worker.recognize(imageSource);
      setProgress(100);

      const parsed = parseReceiptText(ret.data.text);
      await worker.terminate();

      if (parsed.items.length === 0) {
        setErrorMsg("No prices found. Please check image clarity or enter items manually.");
      }

      onScanComplete(parsed);
    } catch (err: unknown) {
      console.error("OCR Error:", err);
      setErrorMsg("Failed to scan receipt image. Please try uploading a clearer image.");
    } finally {
      setIsScanning(false);
    }
  };

  // Snap photo from video stream
  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setCapturedImage(dataUrl);
      stopCamera();
      processImageWithOCR(dataUrl);
    }
  };

  // Handle file select upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCapturedImage(reader.result);
        processImageWithOCR(file);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-2xl p-6 shadow-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Receipt Camera Scan
            </h2>
            <p className="text-xs text-slate-400">
              Snap receipt or upload photo to auto-detect prices
            </p>
          </div>
        </div>

        <button
          onClick={onManualMode}
          className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 font-medium px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-all"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Manual Entry
        </button>
      </div>

      {/* Main Viewport Container */}
      <div className="relative min-h-[320px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex flex-col items-center justify-center p-4">
        {/* Hidden Canvas element */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Live Camera View */}
        {isCameraActive && (
          <div className="relative w-full h-full flex flex-col items-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full max-h-[420px] object-cover rounded-lg"
            />
            {/* Viewfinder Target Box */}
            <div className="absolute inset-4 border-2 border-dashed border-emerald-400/60 rounded-xl pointer-events-none flex items-center justify-center">
              <span className="bg-slate-900/70 text-emerald-400 text-xs px-3 py-1 rounded-full backdrop-blur-md">
                Align receipt inside frame
              </span>
            </div>

            <div className="absolute bottom-4 flex items-center gap-4">
              <button
                onClick={stopCamera}
                className="p-3 rounded-full bg-slate-900/80 text-slate-300 hover:bg-slate-800 backdrop-blur-md transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <button
                onClick={captureSnapshot}
                className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/50 active:scale-90 transition-all border-4 border-slate-900"
              >
                <Camera className="w-7 h-7" />
              </button>
            </div>
          </div>
        )}

        {/* Processing/Scanning State */}
        {isScanning && (
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-4 max-w-xs">
            <div className="relative">
              <RefreshCw className="w-12 h-12 text-emerald-400 animate-spin" />
              <Sparkles className="w-5 h-5 text-emerald-300 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">{statusText}</p>
              <p className="text-xs text-slate-400 mt-1">Reading item names and amounts</p>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Captured Preview */}
        {!isCameraActive && !isScanning && capturedImage && (
          <div className="relative w-full flex flex-col items-center">
            {/* eslint-disable-next-html-element-suppression */}
            <img
              src={capturedImage}
              alt="Receipt Preview"
              className="max-h-[300px] object-contain rounded-lg border border-slate-800"
            />
            <button
              onClick={() => setCapturedImage(null)}
              className="mt-3 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retake or Choose Another
            </button>
          </div>
        )}

        {/* Idle Initial State */}
        {!isCameraActive && !isScanning && !capturedImage && (
          <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-200">
                Scan Your Receipt
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Take a picture of your bill using your camera or upload an existing photo from gallery
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={startCamera}
                className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/40 active:scale-95"
              >
                <Camera className="w-4 h-4" />
                <span>Open Camera</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-11 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm flex items-center gap-2 transition-all border border-slate-700 active:scale-95"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Image</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
