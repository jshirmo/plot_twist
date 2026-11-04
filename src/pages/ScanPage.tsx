import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { saveMediaItem } from '../lib/mediaService';
import { Camera, Upload, Sparkles, Check, AlertCircle, Bookmark, RefreshCw } from 'lucide-react';

export const ScanPage: React.FC = () => {
  const { user, userProfile, signIn } = useAuth();
  const [cameraActive, setCameraActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const startCamera = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error('Camera access error:', err);
      setErrorMessage('Could not access camera. Please check permissions or use the file upload option below.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedImage(dataUrl);
      stopCamera();
      analyzeImage(dataUrl, 'image/jpeg');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Image file is too large (maximum 10MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCapturedImage(result);
      analyzeImage(result, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (dataUrl: string, mimeType: string) => {
    setAnalyzing(true);
    setErrorMessage(null);
    setScanResult(null);
    setSavedSuccess(false);

    try {
      const base64Data = dataUrl.split(',')[1];
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType,
          tasteProfile: userProfile?.tasteProfile,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      setScanResult(data);
    } catch (err) {
      console.error('Failed to analyze image:', err);
      setErrorMessage('Failed to recognize the poster or cover. Please try taking a clearer photo.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveScannedItem = async () => {
    if (!user) {
      signIn().catch(console.error);
      return;
    }
    if (!scanResult) return;

    const recognized = scanResult.recognized;
    const catalogMatch = scanResult.catalogMatch;

    try {
      await saveMediaItem({
        mediaId: catalogMatch ? catalogMatch.id : `scan_${Date.now()}`,
        mediaType: recognized.mediaType || 'book',
        title: catalogMatch ? catalogMatch.title : recognized.title,
        posterUrl: catalogMatch ? catalogMatch.posterUrl : capturedImage || '',
        creator: catalogMatch ? catalogMatch.creator : recognized.creator,
        genres: catalogMatch ? catalogMatch.genres : recognized.genres || ['Mystery'],
        status: 'watchlist',
        source: 'scan',
        aiExplanation: scanResult.aiExplanation,
        compatibilityScore: scanResult.compatibilityScore,
      });
      setSavedSuccess(true);
    } catch (err) {
      console.error('Error saving scanned item:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#10283F] border border-[#2C7A7B]/50 rounded-full text-xs font-semibold uppercase tracking-wider text-[#2C7A7B]">
          <Camera className="w-3.5 h-3.5" />
          <span>Visual Compatibility Scanner</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-[#F7F2E9]">
          See It. Scan It. Discover It.
        </h1>
        <p className="text-xs text-[#F7F2E9]/70 max-w-lg mx-auto">
          Photograph any book cover, movie poster, or TV billboard. Gemini AI identifies the title and reveals whether it matches your plot preferences.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-950/40 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Camera / Upload Box */}
      <div className="bg-[#10283F]/30 border border-[#10283F] rounded-3xl p-6 sm:p-8 space-y-6 text-center">
        {!cameraActive && !capturedImage && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#10283F] border border-[#2C7A7B]/40 flex items-center justify-center text-[#2C7A7B]">
              <Camera className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif font-bold text-lg text-[#F7F2E9]">
                Take a Photo or Upload Poster
              </h3>
              <p className="text-xs text-[#F7F2E9]/60">Supports book covers, film posters, and DVD sleeves</p>
            </div>

            <div className="flex flex-wrap gap-4 justify-center pt-2">
              <button
                onClick={startCamera}
                className="px-6 py-3 bg-[#2C7A7B] hover:bg-[#2C7A7B]/90 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Open Live Camera</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-[#10283F] hover:bg-[#10283F]/80 text-[#F7F2E9] border border-[#10283F] font-semibold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#D9B66F]" />
                <span>Upload Image</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>
        )}

        {/* Live Camera View */}
        {cameraActive && (
          <div className="relative max-w-md mx-auto rounded-2xl overflow-hidden border-2 border-[#2C7A7B] bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-80 object-cover"
            />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              <button
                onClick={capturePhoto}
                className="px-6 py-2.5 bg-[#D9B66F] text-[#091A2B] font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg cursor-pointer"
              >
                Capture Photo
              </button>
              <button
                onClick={stopCamera}
                className="px-4 py-2.5 bg-black/60 text-white text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Captured Preview & Analysis */}
        {capturedImage && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <div className="relative w-48 h-64 rounded-xl overflow-hidden border border-[#10283F] bg-[#091A2B] shrink-0">
                <img
                  src={capturedImage}
                  alt="Scanned cover"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Analysis Status */}
              <div className="space-y-4 text-left max-w-sm flex-1">
                {analyzing ? (
                  <div className="space-y-2">
                    <span className="text-xs text-[#D9B66F] font-semibold uppercase animate-pulse flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>Gemini Vision Analyzing Poster...</span>
                    </span>
                    <p className="text-xs text-[#F7F2E9]/60">
                      Reading typography, detecting title & author, and calculating compatibility score...
                    </p>
                  </div>
                ) : scanResult ? (
                  <div className="space-y-3 bg-[#091A2B] p-5 rounded-2xl border border-[#10283F]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#D9B66F]">
                        {scanResult.recognized?.mediaType || 'Media'}
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {scanResult.compatibilityScore}% Compatibility
                      </span>
                    </div>

                    <h3 className="font-serif font-bold text-xl text-[#F7F2E9]">
                      {scanResult.catalogMatch?.title || scanResult.recognized?.title}
                    </h3>

                    {(scanResult.catalogMatch?.creator || scanResult.recognized?.creator) && (
                      <span className="text-xs text-[#F7F2E9]/60 block">
                        By {scanResult.catalogMatch?.creator || scanResult.recognized?.creator}
                      </span>
                    )}

                    <p className="text-xs text-[#F7F2E9]/80 leading-relaxed italic bg-[#10283F]/50 p-2.5 rounded-lg border border-[#D9B66F]/20">
                      "{scanResult.aiExplanation}"
                    </p>

                    <div className="pt-2 flex items-center gap-3">
                      <button
                        onClick={handleSaveScannedItem}
                        disabled={savedSuccess}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                          savedSuccess
                            ? 'bg-[#2C7A7B] text-white'
                            : 'bg-[#D9B66F] text-[#091A2B] hover:bg-[#D9B66F]/90'
                        }`}
                      >
                        {savedSuccess ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                        <span>{savedSuccess ? 'Added to Watchlist' : 'Save to Library'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setCapturedImage(null);
                          setScanResult(null);
                        }}
                        className="p-2.5 bg-[#10283F] text-[#F7F2E9] hover:bg-[#10283F]/80 rounded-xl"
                        title="Scan another"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
