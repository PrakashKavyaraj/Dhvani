import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  Mic,
  MicOff,
  RefreshCw,
  X,
  Clock,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import {
  createLivenessChallenge,
  verifyLivenessChallenge,
  AegisVoiceRecorder,
} from '../services/aegisApiClient';

export function LivenessChallengeModal({ isOpen, onClose, apiBaseUrl }) {
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [volume, setVolume] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(15);

  const recorderRef = useRef(null);
  const timerRef = useRef(null);

  // Clean state when modal opens
  useEffect(() => {
    if (isOpen) {
      handleGenerateChallenge();
    } else {
      handleCleanup();
    }
  }, [isOpen]);

  // Countdown timer for 15s challenge TTL
  useEffect(() => {
    if (!challenge || result) return;

    setSecondsRemaining(15);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [challenge, result]);

  const handleCleanup = () => {
    if (recorderRef.current) {
      recorderRef.current.stop().catch(() => {});
      recorderRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setVolume(0);
    setResult(null);
    setError(null);
  };

  const handleGenerateChallenge = async () => {
    handleCleanup();
    setLoading(true);
    setError(null);
    try {
      const data = await createLivenessChallenge(`live-${Date.now().toString(36)}`, { apiBaseUrl });
      setChallenge(data);
    } catch (err) {
      setError(err.message || 'Failed to generate cryptographic challenge');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRecord = async () => {
    if (recording) {
      // Stop recording and verify
      setRecording(false);
      setVerifying(true);
      setError(null);

      try {
        const { blob } = await recorderRef.current.stop();
        recorderRef.current = null;
        setVolume(0);

        const verifyRes = await verifyLivenessChallenge(
          blob,
          challenge.challenge_token,
          challenge.challenge_text,
          { apiBaseUrl }
        );
        setResult(verifyRes);
      } catch (err) {
        setError(err.message || 'Liveness verification error');
      } finally {
        setVerifying(false);
      }
    } else {
      // Start recording
      setError(null);
      try {
        recorderRef.current = new AegisVoiceRecorder({
          onVolume: (v) => setVolume(v),
        });
        await recorderRef.current.start();
        setRecording(true);
      } catch (err) {
        setError(err.message || 'Microphone access denied');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-950 p-6 shadow-2xl shadow-cyan-950/50"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  Active Dynamic Liveness Defense
                  <span className="px-2 py-0.5 text-xs font-mono rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    ANTI-CLONE
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Unpredictable challenge-response testing with acoustic latency analysis
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                handleCleanup();
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="mt-5 space-y-5">
            {error && (
              <div className="p-3 text-xs rounded-lg border border-red-500/40 bg-red-950/30 text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Challenge Card */}
            {challenge && !result && (
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 relative overflow-hidden">
                <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                  <span className="flex items-center gap-1.5 font-mono">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    HMAC-SHA256 SIGNED CHALLENGE
                  </span>
                  <span className={`font-mono font-semibold flex items-center gap-1 ${secondsRemaining <= 3 ? 'text-red-400 animate-pulse' : 'text-cyan-400'}`}>
                    <Clock className="w-3.5 h-3.5" />
                    {secondsRemaining}s TTL
                  </span>
                </div>

                <div className="my-4 text-center py-4 px-3 rounded-lg bg-slate-950/80 border border-cyan-500/20 shadow-inner">
                  <div className="text-xs text-cyan-400 font-mono tracking-wider uppercase mb-1">
                    Please repeat clearly:
                  </div>
                  <div className="text-2xl sm:text-3xl font-black tracking-wide text-white selection:bg-cyan-500/40">
                    "{challenge.challenge_text}"
                  </div>
                </div>

                {/* Recorder Control */}
                <div className="flex flex-col items-center justify-center space-y-3 pt-2">
                  <button
                    onClick={handleToggleRecord}
                    disabled={verifying || secondsRemaining === 0}
                    className={`relative px-6 py-3 rounded-xl font-medium text-sm flex items-center gap-2.5 transition-all shadow-lg ${
                      recording
                        ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/30 animate-pulse'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/20'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {recording ? (
                      <>
                        <MicOff className="w-4 h-4" />
                        <span>Stop & Analyze Latency</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" />
                        <span>Speak Phrase Now</span>
                      </>
                    )}
                  </button>

                  {/* Volume Level Bar */}
                  {recording && (
                    <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 transition-all duration-75"
                        style={{ width: `${Math.min(100, volume * 1.5)}%` }}
                      />
                    </div>
                  )}

                  {verifying && (
                    <div className="text-xs text-cyan-300 flex items-center gap-1.5 animate-pulse">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Evaluating speech onset latency & phonetics...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Results Card */}
            {result && (
              <div className={`p-5 rounded-xl border ${result.liveness_verified ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-red-500/40 bg-red-950/20'} space-y-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    {result.liveness_verified ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <ShieldAlert className="w-6 h-6 text-red-400" />
                    )}
                    <div>
                      <h4 className="font-semibold text-slate-100 text-sm">
                        {result.liveness_verified ? 'Active Liveness Verified' : 'Liveness Challenge Failed'}
                      </h4>
                      <p className="text-xs text-slate-400">{result.reason}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border ${
                    result.liveness_verified
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-red-500/20 border-red-500/40 text-red-300'
                  }`}>
                    {result.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-400 block mb-0.5">Reflex Latency</span>
                    <span className={`text-base font-bold ${result.response_latency_ms > 2000 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {result.response_latency_ms} ms
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {result.latency_verdict}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-400 block mb-0.5">VAD Speech Ratio</span>
                    <span className="text-base font-bold text-slate-200">
                      {Math.round((result.vad_speech_ratio || 0) * 100)}%
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {result.passphrase_matched ? 'Phonemes Aligned' : 'Phoneme Mismatch'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleGenerateChallenge}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Issue New Challenge
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
