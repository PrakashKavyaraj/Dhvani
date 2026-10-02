import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  PhoneCall,
  CheckCircle,
  AlertTriangle,
  X,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Server,
  Layers,
  Zap,
  Radio,
  Sliders,
  RefreshCw,
  Activity,
  Wifi,
} from 'lucide-react';
import {
  evaluateBankingPreAuth,
  simulateTelephonyStream,
  analyzeTelephonyChannel,
  simulateTelephonyDegradation,
  getTelephonyCodecs,
  getTelephonyStats,
} from '../services/aegisApiClient';

export function BankingPreAuthModal({ isOpen, onClose, apiBaseUrl, analysisResult }) {
  const [activeTab, setActiveTab] = useState('preauth'); // 'preauth' | 'telephony'

  // Pre-Auth State
  const [customerId, setCustomerId] = useState('CUST-88421');
  const [amount, setAmount] = useState('150000');
  const [livenessOverride, setLivenessOverride] = useState('default');
  const [loading, setLoading] = useState(false);
  const [authResult, setAuthResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Telephony & PLC Resilience State
  const [simPacketLoss, setSimPacketLoss] = useState(8); // 8% loss
  const [simJitter, setSimJitter] = useState(30); // 30ms jitter
  const [simCodec, setSimCodec] = useState('G.711');
  const [simBurstLength, setSimBurstLength] = useState(2.0);
  const [applyPlc, setApplyPlc] = useState(true);
  const [telephonySimResult, setTelephonySimResult] = useState(null);
  const [telephonyStats, setTelephonyStats] = useState(null);
  const [codecsList, setCodecsList] = useState(null);

  useEffect(() => {
    if (isOpen) {
      getTelephonyStats({ apiBaseUrl })
        .then((data) => setTelephonyStats(data))
        .catch(() => null);
      getTelephonyCodecs({ apiBaseUrl })
        .then((data) => setCodecsList(data?.codecs || null))
        .catch(() => null);
    }
  }, [isOpen, apiBaseUrl]);

  const handleEvaluate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setAuthResult(null);

    try {
      const payload = {
        customer_id: customerId.trim(),
        transaction_amount_inr: parseFloat(amount) || 0,
        voiceprint_sha256: analysisResult?.analysis_id ? undefined : undefined,
        analysis_id: analysisResult?.analysis_id || undefined,
        liveness_verified:
          livenessOverride === 'pass' ? true : livenessOverride === 'fail' ? false : undefined,
        biometric_similarity: analysisResult?.ecapa_similarity ?? 0.85,
      };

      const res = await evaluateBankingPreAuth(payload, { apiBaseUrl });
      setAuthResult(res);
    } catch (err) {
      setErrorMsg(err.message || 'Evaluation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRunTelephonyDegradation = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await simulateTelephonyDegradation(
        null,
        {
          target_loss_rate: simPacketLoss / 100.0,
          jitter_ms: simJitter,
          burst_length_avg: simBurstLength,
          apply_plc: applyPlc,
          codec: simCodec,
        },
        { apiBaseUrl }
      );
      setTelephonySimResult(res);
    } catch (err) {
      setErrorMsg(err.message || 'Telephony simulation failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-cyan-500/30 bg-[#090e1a] shadow-2xl shadow-cyan-950/60 max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-slate-900 via-[#0b1329] to-slate-900 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-display font-bold text-white tracking-wide">
                    Core Banking Intercept & Telephony Resilience
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    ISO 8583
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    ITU-T G.107
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 font-sans">
                  Real-time transaction fraud interception and packet loss concealment (PLC) de-biasing
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-white/10 bg-slate-900/60 px-4 sm:px-6 gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('preauth')}
              className={`py-3 px-3 sm:px-4 text-xs font-mono font-bold border-b-2 flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'preauth'
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-4 h-4 text-cyan-400" />
              <span>ISO 8583 Pre-Auth Intercept</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('telephony')}
              className={`py-3 px-3 sm:px-4 text-xs font-mono font-bold border-b-2 flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'telephony'
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wifi className="w-4 h-4 text-cyan-400" />
              <span>Carrier Telephony & PLC Resilience</span>
            </button>
          </div>

          {errorMsg && (
            <div className="m-4 p-3 text-xs rounded-xl border border-red-500/40 bg-red-950/30 text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Modal Content */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-left">
            {/* TAB 1: CORE BANKING ISO 8583 PRE-AUTH */}
            {activeTab === 'preauth' && (
              <div className="space-y-5">
                <form onSubmit={handleEvaluate} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium font-sans">
                        Customer Account / UPI VPA
                      </label>
                      <input
                        type="text"
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium font-sans">
                        Pre-Auth Transaction Amount (INR)
                      </label>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium font-sans">
                        Biometric Liveness Verification State
                      </label>
                      <select
                        value={livenessOverride}
                        onChange={(e) => setLivenessOverride(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono text-xs"
                      >
                        <option value="default">Infer from Voice Risk Score</option>
                        <option value="pass">Verified Natural Reflex (Pass)</option>
                        <option value="fail">AI Voice Clone Lag Detected (Fail)</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>{loading ? 'Evaluating Intercept...' : 'Evaluate Pre-Auth Intercept'}</span>
                      </button>
                    </div>
                  </div>
                </form>

                {/* Pre-Auth Intercept Verdict Card */}
                {authResult && (
                  <div
                    className={`p-4 sm:p-5 rounded-2xl border ${
                      authResult.iso_response_code === '00'
                        ? 'border-emerald-500/40 bg-emerald-950/20'
                        : 'border-rose-500/40 bg-rose-950/20'
                    } space-y-3 text-xs`}
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        {authResult.iso_response_code === '00' ? (
                          <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                        ) : (
                          <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />
                        )}
                        <div>
                          <span className="font-display font-bold text-slate-100 text-sm sm:text-base">
                            {authResult.pre_auth_action}
                          </span>
                          <span className="text-xs text-slate-300 block font-sans mt-0.5">
                            {authResult.description}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-slate-400 block text-[10px] font-mono uppercase">
                          ISO 8583 Code
                        </span>
                        <span className="font-mono text-base font-bold text-cyan-400">
                          {authResult.iso_response_code}
                        </span>
                      </div>
                    </div>

                    {/* Core Banking Compliance Headers */}
                    <div className="p-3 rounded-xl bg-black/50 border border-white/10 font-mono text-[11px] space-y-1.5">
                      <span className="text-cyan-400 block font-bold text-[10px] uppercase tracking-wider">
                        ISO 20022 / Open Banking HTTP Compliance Headers
                      </span>
                      {Object.entries(authResult.compliance_headers).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-slate-300 py-0.5 border-b border-white/5">
                          <span className="text-slate-400">{k}:</span>
                          <span className="font-semibold text-white truncate max-w-[280px]" title={String(v)}>
                            {String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TELEPHONY RESILIENCE & PLC DEGRADATION */}
            {activeTab === 'telephony' && (
              <div className="space-y-6">
                {/* Standards Summary Card */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs font-mono space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold flex items-center gap-2">
                      <Radio className="w-4 h-4 text-cyan-400" />
                      <span>ITU-T G.107 E-Model & Packet Loss Concealment (PLC)</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      TRAI & ITU Compliant
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs font-sans leading-relaxed">
                    Cellular (2G/3G/4G VoLTE) and SIP/RTP voice networks introduce packet drops and decoder pitch-repetition
                    concealment (ITU-T G.711 App I) that naive deepfake detectors mistake for synthetic speech. Dhvani
                    disentangles network degradation from AI voice clones and calibrates threat scores accordingly.
                  </p>
                </div>

                {/* Simulation Control Grid */}
                <div className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-xs font-mono font-bold text-white flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Gilbert-Elliott Network Degradation Simulator</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      2-State Markov Burst Loss Model
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Target Packet Loss Rate:</span>
                        <span className="text-cyan-400 font-bold">{simPacketLoss}% Loss</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="25"
                        step="1"
                        value={simPacketLoss}
                        onChange={(e) => setSimPacketLoss(Number(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Network Delay Jitter:</span>
                        <span className="text-cyan-400 font-bold">{simJitter} ms</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="80"
                        step="5"
                        value={simJitter}
                        onChange={(e) => setSimJitter(Number(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                    <div>
                      <label className="text-slate-400 block mb-1">Carrier Audio Codec:</label>
                      <select
                        value={simCodec}
                        onChange={(e) => setSimCodec(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                      >
                        <option value="G.711">G.711 (PSTN / VoLTE 64 kbps)</option>
                        <option value="OPUS">Opus (WhatsApp / SIP VoIP)</option>
                        <option value="AMR">AMR-NB (2G/3G Cellular 7.4 kbps)</option>
                        <option value="AMR-WB">AMR-WB / G.722.2 (HD Voice)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">Avg Burst Length:</label>
                      <select
                        value={simBurstLength}
                        onChange={(e) => setSimBurstLength(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                      >
                        <option value={1.5}>1.5 frames (Isolated drop)</option>
                        <option value={2.0}>2.0 frames (Typical 40ms burst)</option>
                        <option value={3.5}>3.5 frames (Severe 70ms burst)</option>
                      </select>
                    </div>

                    <div className="flex items-center space-x-2 pt-5">
                      <input
                        type="checkbox"
                        id="plc_toggle"
                        checked={applyPlc}
                        onChange={(e) => setApplyPlc(e.target.checked)}
                        className="accent-cyan-400 rounded cursor-pointer"
                      />
                      <label htmlFor="plc_toggle" className="text-slate-300 text-xs cursor-pointer font-sans">
                        Apply G.711 App I PLC Extrapolation
                      </label>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRunTelephonyDegradation}
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono font-bold text-xs transition cursor-pointer flex items-center justify-center space-x-2 shadow-lg shadow-cyan-900/30"
                  >
                    <Activity className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>{loading ? 'Simulating Carrier Degradation...' : 'Run Network Degradation Benchmark'}</span>
                  </button>
                </div>

                {/* Simulation Output Telemetry */}
                {telephonySimResult && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-cyan-500/40 space-y-4 text-xs font-mono">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <span className="text-white font-bold flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span>Carrier Telephony Resilience Output</span>
                      </span>
                      <span className="text-[10px] text-cyan-300 bg-cyan-500/10 px-2.5 py-0.5 rounded border border-cyan-500/20">
                        {telephonySimResult.network_results?.qos?.category || 'GOOD'}
                      </span>
                    </div>

                    {/* Metric Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                        <span className="text-[10px] text-slate-400 block uppercase">ITU-T G.107 R-Factor</span>
                        <span className="text-base font-bold text-cyan-400 mt-0.5 block">
                          {telephonySimResult.network_results?.qos?.r_factor} / 100
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                        <span className="text-[10px] text-slate-400 block uppercase">Estimated MOS</span>
                        <span className="text-base font-bold text-emerald-400 mt-0.5 block">
                          {telephonySimResult.network_results?.qos?.mos_score} / 4.5
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                        <span className="text-[10px] text-slate-400 block uppercase">PLC Pitch Artifact</span>
                        <span className="text-base font-bold text-amber-400 mt-0.5 block">
                          {telephonySimResult.plc_detection?.plc_artifact_prob}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                        <span className="text-[10px] text-slate-400 block uppercase">Applied De-biasing</span>
                        <span className="text-base font-bold text-emerald-400 mt-0.5 block">
                          -{(telephonySimResult.debiasing_discount * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Disentanglement Analysis */}
                    <div className="p-3 rounded-xl bg-black/50 border border-white/10 space-y-1.5 font-sans">
                      <span className="text-slate-300 font-mono font-bold text-[11px] block uppercase text-cyan-400">
                        Disentanglement Verdict: {telephonySimResult.plc_detection?.disentanglement_verdict}
                      </span>
                      <p className="text-slate-400 text-xs">
                        The engine identified {telephonySimResult.plc_detection?.plc_frame_count} concealed frames.
                        Because repetition is attributable to decoder packet loss concealment rather than generative vocoder loops,
                        suspicion was discounted by {(telephonySimResult.debiasing_discount * 100).toFixed(0)}%, preventing an erroneous fraud block.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
