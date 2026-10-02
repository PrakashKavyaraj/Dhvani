import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Headphones,
  User,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Radio,
  Clock,
  Send,
  RotateCcw,
  CheckCircle,
  XCircle,
  PhoneCall,
  Volume2,
  Lock,
  ExternalLink,
  ChevronRight,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  fetchCopilotSampleSession,
  evaluateCopilotTurn,
  escalateCopilotSupervisor,
  resetCopilotSession,
} from '../../services/aegisApiClient';

export function CallCenterCopilotModal({ isOpen, onClose, apiBaseUrl }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [escalating, setEscalating] = useState(false);
  const [escalationResult, setEscalationResult] = useState(null);
  const [simText, setSimText] = useState('');
  const [simSpeaker, setSimSpeaker] = useState('CALLER');
  const [simLatency, setSimLatency] = useState(850);
  const [simSyntheticProb, setSimSyntheticProb] = useState(0.88);
  const [simulatingTurn, setSimulatingTurn] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadSession();
    }
  }, [isOpen]);

  const loadSession = async () => {
    setLoading(true);
    try {
      const data = await fetchCopilotSampleSession({ apiBaseUrl });
      setSession(data);
      if (data.supervisor_escalated) {
        setEscalationResult({
          escalation_id: data.supervisor_escalation_id,
          reason: data.escalation_notes,
          timestamp: new Date().toISOString(),
        });
      } else {
        setEscalationResult(null);
      }
    } catch (err) {
      console.error('Failed to load copilot session:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async () => {
    if (!session) return;
    setEscalating(true);
    try {
      const res = await escalateCopilotSupervisor(
        {
          session_id: session.session_id,
          agent_id: session.agent_id || 'AGENT-408-PRIYA',
          reason: 'High-confidence synthetic voice clone detected on caller channel during high-value wire request',
        },
        { apiBaseUrl }
      );
      setEscalationResult(res);
      setSession((prev) => ({
        ...prev,
        supervisor_escalated: true,
        supervisor_escalation_id: res.escalation_id,
        status: 'SUPERVISOR_CONFERENCED',
      }));
    } catch (err) {
      console.error('Failed to escalate to supervisor:', err);
      alert('Escalation failed: ' + err.message);
    } finally {
      setEscalating(false);
    }
  };

  const handleResetSession = async () => {
    if (!session) return;
    try {
      await resetCopilotSession(session.session_id, { apiBaseUrl });
      setEscalationResult(null);
      await loadSession();
    } catch (err) {
      console.error('Failed to reset session:', err);
    }
  };

  const handleSimulateTurn = async (e) => {
    e?.preventDefault();
    if (!session || !simText.trim()) return;

    setSimulatingTurn(true);
    try {
      const res = await evaluateCopilotTurn(
        {
          session_id: session.session_id,
          speaker: simSpeaker,
          text: simText.trim(),
          latency_ms: Number(simLatency),
          forced_synthetic_prob: simSpeaker === 'CALLER' ? Number(simSyntheticProb) : 0.02,
        },
        { apiBaseUrl }
      );

      // Append new turn and update session
      setSession((prev) => {
        const updatedTurns = [...(prev.turns || []), res.turn];
        const updatedStrip = [
          ...(prev.risk_heat_strip || []),
          {
            time_sec: res.turn.timestamp_offset_sec,
            score: res.current_risk_score,
            level: res.risk_status === 'CRITICAL_FRAUD' ? 'CRITICAL' : res.risk_status === 'ELEVATED' ? 'ELEVATED' : 'LOW',
          },
        ];
        return {
          ...prev,
          turns: updatedTurns,
          current_risk_score: res.current_risk_score,
          risk_status: res.risk_status,
          active_prompts: res.active_prompts,
          risk_heat_strip: updatedStrip,
        };
      });

      setSimText('');
    } catch (err) {
      console.error('Failed to evaluate turn:', err);
      alert('Simulation error: ' + err.message);
    } finally {
      setSimulatingTurn(false);
    }
  };

  const handleCopyPrompt = (prompt) => {
    navigator.clipboard?.writeText(prompt.script_text);
    setCopiedPromptId(prompt.prompt_id);
    setTimeout(() => setCopiedPromptId(null), 2500);
  };

  const handleChallengeVerdict = async (passed) => {
    if (!session) return;
    const text = passed
      ? 'Caller recited challenge phrase smoothly with natural human prosody.'
      : 'Caller stumbled, exhibited vocal tract artifacts and uncharacteristic hesitation.';
    const forcedProb = passed ? 0.12 : 0.95;
    const latency = passed ? 200 : 1200;

    await evaluateCopilotTurn(
      {
        session_id: session.session_id,
        speaker: 'CALLER',
        text: text,
        latency_ms: latency,
        forced_synthetic_prob: forcedProb,
      },
      { apiBaseUrl }
    );
    await loadSession();
  };

  if (!isOpen) return null;

  const currentRisk = session?.current_risk_score || 0.10;
  const isCritical = currentRisk >= 0.70;
  const isElevated = currentRisk >= 0.35 && currentRisk < 0.70;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Headphones className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Dual-Channel Call Center Agent Co-Pilot
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  Live Human-in-the-Loop
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  Pindrop Pulse Benchmark
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Continuous split-stream telephony monitoring (CH1 Agent vs CH2 Inbound Caller) with real-time dynamic challenge guidance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetSession}
              title="Reset Session"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Demo
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Subheader / Status Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-3 bg-slate-950/40 border-b border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block font-mono">SESSION IDENTIFIER</span>
            <span className="font-semibold text-slate-200">{session?.session_id || 'Connecting...'}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-mono">ACCOUNT UNDER DEFENSE</span>
            <span className="font-semibold text-amber-300">{session?.account_id} ({session?.customer_name?.split(' ')[0]})</span>
          </div>
          <div>
            <span className="text-slate-400 block font-mono">CALLER ANI (PHONE)</span>
            <span className="font-semibold text-slate-200">{session?.caller_ani} [VoIP Gateway]</span>
          </div>
          <div>
            <span className="text-slate-400 block font-mono">FRAUD SUPERVISOR STATUS</span>
            {session?.supervisor_escalated ? (
              <span className="inline-flex items-center gap-1 font-bold text-rose-400">
                <Lock className="w-3.5 h-3.5" /> SUPERVISOR LOCKED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" /> ACTIVE AGENT DESK
              </span>
            )}
          </div>
        </div>

        {/* Main Body: Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Dual Channel Acoustic Strip & Risk Gauge */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Channel 1: Agent */}
            <div className="md:col-span-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                    Channel 1: Agent Stream
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    CLEAN MIC
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-white">{session?.agent_name}</h4>
                <p className="text-xs text-slate-400 mt-1">Priority Desk Operator (ID: {session?.agent_id})</p>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/60 text-[11px]">
                <div>
                  <span className="text-slate-400">Signal-to-Noise:</span>
                  <div className="font-mono text-slate-200 font-semibold">{session?.channel_metrics?.agent_channel?.snr_db || 28.5} dB</div>
                </div>
                <div>
                  <span className="text-slate-400">Deepfake Prob:</span>
                  <div className="font-mono text-emerald-400 font-semibold">{(Number(session?.channel_metrics?.agent_channel?.deepfake_probability || 0.02) * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>

            {/* Overall Risk Meter */}
            <div className={`md:col-span-4 p-4 rounded-xl flex flex-col items-center justify-center text-center border transition-all ${
              isCritical
                ? 'bg-rose-950/30 border-rose-500/50 shadow-lg shadow-rose-950/50'
                : isElevated
                ? 'bg-amber-950/30 border-amber-500/50'
                : 'bg-slate-950/60 border-slate-800'
            }`}>
              <div className="text-[11px] font-mono tracking-wider uppercase mb-1 text-slate-400">
                Rolling Call Center Risk Level
              </div>
              <div className="flex items-baseline gap-1 my-1">
                <span className={`text-4xl font-extrabold tracking-tight font-mono ${
                  isCritical ? 'text-rose-400' : isElevated ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {(currentRisk * 100).toFixed(1)}%
                </span>
                <span className="text-xs font-semibold text-slate-400">FRAUD RISK</span>
              </div>

              <div className="flex items-center gap-1.5 mt-2">
                {isCritical ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                    <ShieldAlert className="w-3.5 h-3.5" /> CRITICAL ATTACK DETECTED
                  </span>
                ) : isElevated ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <AlertTriangle className="w-3.5 h-3.5" /> SUSPICIOUS CADENCE / LATENCY
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <CheckCircle className="w-3.5 h-3.5" /> NORMAL CONVERSATION
                  </span>
                )}
              </div>
            </div>

            {/* Channel 2: Caller */}
            <div className={`md:col-span-4 p-4 rounded-xl border flex flex-col justify-between ${
              isCritical
                ? 'bg-rose-950/20 border-rose-500/40'
                : 'bg-slate-950/60 border-slate-800/80'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${
                    isCritical ? 'text-rose-400' : 'text-amber-400'
                  }`}>
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    Channel 2: Inbound Caller
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isCritical
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                  }`}>
                    {session?.channel_metrics?.caller_channel?.telephony_carrier || 'VOIP INBOUND'}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-white">{session?.customer_name}</h4>
                <p className="text-xs text-slate-400 mt-1">Claimed Identity: Rajesh Kumar Singhania</p>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/60 text-[11px]">
                <div>
                  <span className="text-slate-400">Avg Hesitation Delay:</span>
                  <div className="font-mono text-amber-300 font-semibold">{session?.channel_metrics?.caller_channel?.avg_turn_latency_ms || 903.3} ms</div>
                </div>
                <div>
                  <span className="text-slate-400">Synthetic Voice Prob:</span>
                  <div className={`font-mono font-semibold ${isCritical ? 'text-rose-400' : 'text-slate-200'}`}>
                    {(Number(session?.channel_metrics?.caller_channel?.deepfake_probability || 0.94) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rolling Risk Heat-Strip across Call Timeline */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-400" />
                Continuous In-Call Risk Heat-Strip
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Duration: {session?.turns?.length ? session.turns[session.turns.length - 1].timestamp_offset_sec + session.turns[session.turns.length - 1].duration_sec : 0}s | Sampling: Dual Telephony RTP
              </span>
            </div>

            {/* Heat strip segments */}
            <div className="flex h-4 w-full rounded-md overflow-hidden bg-slate-900 border border-slate-800/80">
              {(session?.risk_heat_strip || []).map((point, idx) => {
                const score = point.score;
                let bgClass = 'bg-emerald-500';
                if (score >= 0.70) bgClass = 'bg-rose-500';
                else if (score >= 0.35) bgClass = 'bg-amber-500';

                return (
                  <div
                    key={idx}
                    className={`flex-1 ${bgClass} transition-all duration-300 relative group cursor-pointer hover:brightness-125`}
                    title={`Turn @ ${point.time_sec}s: Risk ${(point.score * 100).toFixed(1)}% (${point.level})`}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-20 px-2 py-1 bg-slate-950 text-[10px] text-slate-200 rounded border border-slate-700 whitespace-nowrap shadow-lg">
                      Time: {point.time_sec}s | Risk: {(point.score * 100).toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>00:00 (Call Connect)</span>
              <span>00:15 (Challenge Initiated)</span>
              <span>00:30+ (Voice Anomaly Confirmed)</span>
            </div>
          </div>

          {/* Dialogue Transcript & Co-Pilot Challenge Deck */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Split Dual-Channel Transcript */}
            <div className="lg:col-span-7 flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Live Conversational Turn Timeline
                </h3>
                <span className="text-[11px] text-slate-400">
                  {session?.turns?.length || 0} turns recorded
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4 max-h-[380px] overflow-y-auto">
                {session?.turns?.map((turn, idx) => {
                  const isAgent = turn.speaker === 'AGENT';
                  const isCallerAttack = turn.synthetic_prob >= 0.70;
                  const isCallerSuspicious = turn.synthetic_prob >= 0.35 && turn.synthetic_prob < 0.70;

                  return (
                    <div
                      key={turn.turn_id || idx}
                      className={`flex flex-col ${isAgent ? 'items-start' : 'items-end'}`}
                    >
                      <div className="flex items-center gap-2 mb-1 text-[11px]">
                        {isAgent ? (
                          <>
                            <span className="font-semibold text-indigo-300 flex items-center gap-1">
                              <Headphones className="w-3 h-3 text-indigo-400" /> Priya (Agent)
                            </span>
                            <span className="text-slate-400 font-mono">{turn.timestamp_offset_sec}s</span>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-400 font-mono">{turn.timestamp_offset_sec}s</span>
                            <span className={`font-semibold flex items-center gap-1 ${
                              isCallerAttack ? 'text-rose-400' : isCallerSuspicious ? 'text-amber-400' : 'text-emerald-400'
                            }`}>
                              <User className="w-3 h-3" /> Caller (+91-98201-XXXXX)
                            </span>
                          </>
                        )}
                      </div>

                      <div
                        className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                          isAgent
                            ? 'bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-tl-sm'
                            : isCallerAttack
                            ? 'bg-rose-950/40 text-rose-100 border border-rose-500/50 rounded-tr-sm'
                            : isCallerSuspicious
                            ? 'bg-amber-950/30 text-amber-100 border border-amber-500/40 rounded-tr-sm'
                            : 'bg-emerald-950/30 text-emerald-100 border border-emerald-500/40 rounded-tr-sm'
                        }`}
                      >
                        <p>{turn.text}</p>

                        {/* Metadata row */}
                        <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-700/50 text-[10px]">
                          <span className="font-mono text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Latency: <strong className={turn.latency_ms > 700 ? 'text-amber-300' : 'text-slate-200'}>{turn.latency_ms}ms</strong>
                          </span>

                          {!isAgent && (
                            <span className="font-mono text-slate-400">
                              Synth: <strong className={isCallerAttack ? 'text-rose-300' : 'text-slate-200'}>{(turn.synthetic_prob * 100).toFixed(0)}%</strong>
                            </span>
                          )}

                          {turn.acoustic_flags?.map((flag, fIdx) => (
                            <span
                              key={fIdx}
                              className="px-1.5 py-0.5 rounded bg-slate-900/80 text-[9px] font-mono text-rose-300 border border-rose-500/30"
                            >
                              {flag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Turn Simulator input bar */}
              <form onSubmit={handleSimulateTurn} className="flex gap-2 pt-1">
                <select
                  value={simSpeaker}
                  onChange={(e) => setSimSpeaker(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="CALLER">Caller (CH2)</option>
                  <option value="AGENT">Agent (CH1)</option>
                </select>

                <input
                  type="text"
                  placeholder="Simulate dialogue response or phonetic challenge..."
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />

                <button
                  type="submit"
                  disabled={simulatingTurn || !simText.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Evaluate
                </button>
              </form>
            </div>

            {/* Right: Dynamic Agent Challenge Guidance Deck */}
            <div className="lg:col-span-5 flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Dynamic Agent Guidance Deck
                </h3>
                <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {isCritical ? 'Tier 3: Attack Countermeasure' : isElevated ? 'Tier 2: Nonce Verification' : 'Tier 1: Standard Servicing'}
                </span>
              </div>

              <div className="space-y-3 max-h-[380px] overflow-y-auto">
                {(session?.active_prompts || []).map((prompt, idx) => (
                  <div
                    key={prompt.prompt_id || idx}
                    className={`p-4 rounded-xl border transition-all ${
                      prompt.severity === 'CRITICAL'
                        ? 'bg-rose-950/20 border-rose-500/40'
                        : prompt.severity === 'HIGH'
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-200">{prompt.display_title}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                        {prompt.category}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 text-xs font-medium text-slate-100 italic my-2">
                      "{prompt.script_text}"
                    </div>

                    <p className="text-[11px] text-slate-400 leading-normal">
                      <strong>Co-Pilot Rationale:</strong> {prompt.rationale}
                    </p>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/80">
                      <button
                        onClick={() => handleCopyPrompt(prompt)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors"
                      >
                        {copiedPromptId === prompt.prompt_id ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Copied Script!
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" /> Read Aloud to Caller
                          </>
                        )}
                      </button>

                      {prompt.prompt_id === 'CHALLENGE_NONCE_PHRASE' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleChallengeVerdict(true)}
                            className="px-2 py-1 text-[11px] font-semibold text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 rounded border border-emerald-500/40"
                          >
                            Passed
                          </button>
                          <button
                            onClick={() => handleChallengeVerdict(false)}
                            className="px-2 py-1 text-[11px] font-semibold text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 rounded border border-rose-500/40"
                          >
                            Failed
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Emergency Escalation & Incident Lockdown Docket */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  Emergency Fraud Supervisor Desk Escalation
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Immediately places caller on supervisory conference hold, freezes fund transfer authorizations, and logs an immutable evidence docket.
                </p>
              </div>

              {session?.supervisor_escalated ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs font-bold text-rose-300">
                  <Lock className="w-4 h-4" />
                  SUPERVISOR TAKEOVER ACTIVE
                </div>
              ) : (
                <button
                  onClick={handleEscalate}
                  disabled={escalating}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  <PhoneCall className="w-4 h-4 animate-bounce" />
                  {escalating ? 'Escalating to Supervisor...' : '🚨 Escalate to Fraud Desk'}
                </button>
              )}
            </div>

            {escalationResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-300">INCIDENT DOCKET REFERENCE:</span>
                  <span className="font-bold text-rose-300">{escalationResult.escalation_id}</span>
                </div>
                <div className="text-slate-400 font-mono text-[11px]">
                  TIMESTAMP: {escalationResult.timestamp} | AGENT: {session?.agent_id}
                </div>
                <div className="text-slate-300 text-[11px]">
                  <strong>Security Enforcement:</strong> Outbound wire transfers blocked, digital session invalidation requested, voice sample hash submitted to Inter-Bank Fraud Syndicate.
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/80 text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono">
            <span>ISO/IEC 30107-3</span>
            <span>•</span>
            <span>ITU-T G.107 E-Model</span>
            <span>•</span>
            <span>DPDP Act 2023 Sec 8(7)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            Close Co-Pilot
          </button>
        </div>
      </motion.div>
    </div>
  );
}
