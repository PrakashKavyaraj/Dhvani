import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Shield,
  UploadCloud,
  FileAudio,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Code2,
  AlertCircle,
  Activity,
  CheckCircle2,
  X,
  FolderOpen,
  KeyRound,
  Server,
} from 'lucide-react';
import { AegisAnalysisResult } from '../components/AegisAnalysisResult';
import { aegis } from '../services/aegisSdk';

export function InstitutionDemoApp() {
  // Backend Environment Configuration State (Polled live from backend config)
  const [backendConfig, setBackendConfig] = useState({
    configured: false,
    endpoint: 'http://127.0.0.1:8000',
    hasKey: false,
    maskedKey: '',
  });

  // Audio & Analysis State
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const fileInputRef = useRef(null);
  const audioPreviewRef = useRef(null);

  // Poll backend environment configuration live every 1.5 seconds
  useEffect(() => {
    let mounted = true;
    const checkConfig = async () => {
      const conf = await aegis.getConfig();
      if (mounted) {
        setBackendConfig(conf);
        if (conf.configured && errorMessage && errorMessage.includes('not configured')) {
          setErrorMessage(null);
        }
      }
    };

    checkConfig();
    const interval = setInterval(checkConfig, 1500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [errorMessage]);

  // Compute audio duration
  useEffect(() => {
    if (!audioUrl) {
      setAudioDuration(0);
      return;
    }
    const audio = new Audio(audioUrl);
    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };
  }, [audioUrl]);

  // Handle file selection
  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.wav')) {
      setErrorMessage('AEGIS acoustic analysis requires .wav PCM format. Please select a valid WAV audio file.');
      return;
    }
    setErrorMessage(null);
    setAudioFile(file);
    setAudioUrl(URL.createObjectURL(file));
  };

  // Drag & drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Quick evaluation sample helper for presentation
  const handleLoadSample = async (sampleName, sampleUrl) => {
    setErrorMessage(null);
    setStatusMessage(`Loading ${sampleName}...`);
    try {
      const res = await fetch(sampleUrl);
      if (!res.ok) throw new Error(`Could not load ${sampleUrl}`);
      const blob = await res.blob();
      const file = new File([blob], sampleUrl.split('/').pop(), { type: 'audio/wav' });
      setAudioFile(file);
      setAudioUrl(URL.createObjectURL(file));
      setStatusMessage('');
    } catch (err) {
      setErrorMessage(`Failed to load benchmark sample: ${err.message}`);
      setStatusMessage('');
    }
  };

  // Audio preview toggle
  const togglePlayAudio = () => {
    if (!audioPreviewRef.current) return;
    if (isAudioPlaying) {
      audioPreviewRef.current.pause();
      setIsAudioPlaying(false);
    } else {
      audioPreviewRef.current.play();
      setIsAudioPlaying(true);
    }
  };

  // Trigger real AEGIS analysis via aegis SDK
  const handleCheckWithAegis = async () => {
    if (!audioFile) {
      setErrorMessage('Please choose or upload an audio file first.');
      return;
    }

    if (!backendConfig.configured) {
      setErrorMessage(
        'AEGIS API Key is not configured in the backend environment (.env.institution). Please set AEGIS_API_KEY in the backend part before running analysis.'
      );
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setAnalysisResult(null);

    try {
      // Tiny Developer Integration: await aegis.analyze(audioFile)
      const result = await aegis.analyze(audioFile, {
        onProgress: (msg) => setStatusMessage(msg),
      });

      setAnalysisResult(result);
      setIsAnalyzing(false);
      setStatusMessage('');
    } catch (err) {
      setIsAnalyzing(false);
      setStatusMessage('');
      setErrorMessage(err.message || 'AEGIS analysis failed. Ensure the AEGIS backend is online.');
    }
  };

  // Reset audio & result
  const handleReset = () => {
    setAnalysisResult(null);
    setAudioFile(null);
    setAudioUrl(null);
    setAudioDuration(0);
    setErrorMessage(null);
    setStatusMessage('');
    setShowRawJson(false);
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100 font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200 pb-24">
      {/* 1. TOP HEADER: Institutional Identity & AEGIS Voice Security */}
      <header className="border-b border-white/10 bg-[#080d1a]/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Institution Identity */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h1 className="font-display font-extrabold text-base sm:text-lg text-white tracking-tight">
                  Example Institution
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 tracking-wide">
                  AEGIS VOICE SECURITY
                </span>
              </div>
              <span className="text-xs text-slate-400 font-mono block">
                External Application • Voice Integrity Verification
              </span>
            </div>
          </div>

          {/* Integration Status & Nav */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
            {/* Live Backend Configuration Status Badge */}
            {backendConfig.configured ? (
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold">✓ AEGIS SERVICE CONFIGURED</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl border bg-amber-500/10 border-amber-500/30 text-amber-300">
                <span className="w-2 h-2 rounded-full border border-amber-400 inline-block" />
                <span className="font-bold">○ API KEY NOT CONFIGURED IN BACKEND</span>
              </div>
            )}

            {/* Link to Main Dhvani Flagship */}
            <a
              href="http://localhost:3000"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 transition-colors"
              title="Open main Dhvani cyber-forensic dashboard"
            >
              <span>Main Dhvani</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 space-y-8">
        {/* Dynamic Architecture Notice Banner */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs font-mono text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
          <div className="flex items-center space-x-2.5">
            <span
              className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                backendConfig.configured
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {backendConfig.configured ? 'BACKEND INTEGRATED' : 'BACKEND CONFIG PENDING'}
            </span>
            <span className="text-slate-300">
              {backendConfig.configured
                ? 'AEGIS API key configured in server environment (.env.institution). Real-time forensic protection active.'
                : 'API key is not configured in backend. Put AEGIS_API_KEY into .env.institution to activate voice security.'}
            </span>
          </div>
          <span className="text-slate-500 text-[11px]">
            Endpoint: {backendConfig.endpoint}
          </span>
        </div>

        {/* 3. AUDIO INPUT CARD: Voice Security / Upload Recording */}
        {!analysisResult && (
          <div className="rounded-3xl border border-white/10 bg-[#080d1a]/90 backdrop-blur-xl p-6 sm:p-10 shadow-2xl space-y-6 text-left max-w-3xl mx-auto">
            <div className="space-y-1 text-left">
              <div className="inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold">
                <Shield className="w-3.5 h-3.5" />
                <span>VOICE SECURITY</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
                Upload an audio recording
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Select an audio recording to run real-time AEGIS deepfake and synthetic speech analysis.
              </p>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,audio/wav"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
              className="hidden"
            />

            {/* Upload Dropzone / Choose Audio */}
            {!audioFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-8 sm:p-12 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center space-y-3 cursor-pointer ${
                  isDragging
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-white/15 hover:border-cyan-500/50 bg-black/40 hover:bg-white/[0.02]'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer mb-1"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Choose Audio</span>
                  </button>
                  <span className="text-xs text-slate-400 font-mono block">
                    or drag & drop a .wav audio file here
                  </span>
                </div>
              </div>
            ) : (
              /* Selected Audio Bar */
              <div className="p-4 rounded-2xl bg-black/60 border border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3 text-left overflow-hidden">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                    <FileAudio className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <span className="text-sm font-mono font-bold text-white block truncate max-w-xs sm:max-w-md">
                      {audioFile.name}
                    </span>
                    <span className="text-xs text-slate-400 font-mono block mt-0.5">
                      {(audioFile.size / 1024 / 1024).toFixed(2)} MB •{' '}
                      {audioDuration > 0 ? `${audioDuration.toFixed(1)}s duration` : 'Audio file selected'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {audioUrl && (
                    <>
                      <audio
                        ref={audioPreviewRef}
                        src={audioUrl}
                        onEnded={() => setIsAudioPlaying(false)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={togglePlayAudio}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-mono text-slate-200 flex items-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        {isAudioPlaying ? (
                          <>
                            <Pause className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Preview</span>
                          </>
                        )}
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setAudioFile(null);
                      setAudioUrl(null);
                      setAudioDuration(0);
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title="Remove selected file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Benchmark Preset Shortcuts */}
            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-400 font-mono text-[11px]">
                Or select an evaluation sample:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleLoadSample('Authentic Voice', '/samples/genuine_human_sample.wav')
                  }
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] transition-colors cursor-pointer"
                >
                  Authentic Human Voice
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleLoadSample('Extortion Deepfake', '/samples/extortion_deepfake_sample.wav')
                  }
                  className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-mono text-[11px] transition-colors cursor-pointer"
                >
                  Extortion Deepfake
                </button>
              </div>
            </div>

            {/* Notice / Warning Message */}
            {errorMessage && (
              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 flex items-start space-x-3 text-rose-200 text-xs text-left">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold font-mono">Notice:</span>
                  <p className="leading-relaxed font-sans">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Action Button: CHECK WITH AEGIS */}
            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs font-mono text-slate-400 min-h-[20px]">
                {statusMessage && (
                  <span className="flex items-center gap-2 text-cyan-400 animate-pulse font-bold">
                    <Activity className="w-4 h-4" />
                    <span>{statusMessage}</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={!audioFile || isAnalyzing}
                onClick={handleCheckWithAegis}
                className={`w-full sm:w-auto px-10 py-4 rounded-2xl font-mono text-sm font-bold flex items-center justify-center space-x-2.5 transition-all cursor-pointer ${
                  !audioFile || isAnalyzing
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                    : !backendConfig.configured
                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                    : 'bg-gradient-to-r from-cyan-600 via-teal-500 to-emerald-500 hover:from-cyan-500 hover:to-emerald-400 text-black font-extrabold shadow-xl shadow-cyan-950/50 hover:shadow-cyan-500/40 scale-100 hover:scale-[1.02]'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isAnalyzing
                    ? 'ANALYZING WITH AEGIS...'
                    : !backendConfig.configured
                    ? 'CHECK WITH AEGIS (CONFIG REQUIRED)'
                    : 'CHECK WITH AEGIS'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* 4. PROCESSING BANNER */}
        {isAnalyzing && (
          <div className="max-w-3xl mx-auto p-8 rounded-3xl bg-[#080d1a]/80 border border-cyan-500/30 text-center space-y-4 shadow-2xl">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/40 animate-spin">
              <Activity className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-display font-bold text-white tracking-wide uppercase">
                ● ANALYZING WITH AEGIS...
              </h3>
              <p className="text-xs font-mono text-cyan-300">
                {statusMessage || 'Submitting to POST /api/v1/analyses and polling pipeline...'}
              </p>
            </div>
          </div>
        )}

        {/* 5. FULL RESULT UI */}
        {analysisResult && (
          <div className="space-y-6 text-left">
            <div className="rounded-2xl bg-[#080d1a]/90 border border-cyan-500/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm sm:text-base text-white">
                    AEGIS Multi-Modal Voice Assessment Received
                  </h3>
                  <span className="text-xs text-slate-400 font-mono block">
                    Direct API Response from {backendConfig.endpoint} • Analysis ID: {analysisResult.analysis_id}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-3 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-slate-300 hover:text-white flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{showRawJson ? 'Hide Raw API JSON' : 'Inspect Raw API JSON'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-mono font-bold text-cyan-300 hover:text-cyan-200 flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Check Another Audio File</span>
                </button>
              </div>
            </div>

            {/* Raw JSON viewer */}
            <AnimatePresence>
              {showRawJson && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="rounded-2xl bg-black/80 border border-white/10 p-4 sm:p-6 overflow-hidden text-left font-mono text-xs shadow-2xl"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                    <span className="text-cyan-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Code2 className="w-4 h-4" /> Live HTTP Response from AEGIS Backend
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      GET /api/v1/analyses/{analysisResult.analysis_id}
                    </span>
                  </div>
                  <pre className="text-emerald-300/90 overflow-x-auto max-h-96 p-3 rounded-xl bg-black/60 border border-white/5 text-[11px] leading-relaxed">
                    {JSON.stringify(analysisResult, null, 2)}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Reusable Full AEGIS Result UI Component */}
            <AegisAnalysisResult
              result={analysisResult}
              audioUrl={audioUrl}
              audioDuration={audioDuration}
              onReset={handleReset}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default InstitutionDemoApp;
