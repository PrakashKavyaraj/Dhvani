import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sliders,
  Shield,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Save,
  X,
  Zap,
  Info,
  Layers,
  Bell,
  Lock,
  Flame,
  Check,
  Smartphone,
  Radio,
  FileText,
} from 'lucide-react';
import {
  fetchWorkflowRules,
  updateWorkflowRules,
  resetWorkflowRules,
  DEFAULT_AEGIS_API_URL,
} from '../services/aegisApiClient';

const ALL_AVAILABLE_ACTIONS = [
  {
    code: 'ALLOW_STREAM',
    label: 'Allow Stream',
    desc: 'Pass through with zero friction',
    icon: CheckCircle2,
    tiers: ['LOW'],
  },
  {
    code: 'REQUIRE_SECONDARY_VERIFICATION',
    label: 'Require Secondary Verification',
    desc: 'Prompt user for OTP / supervisor approval',
    icon: Lock,
    tiers: ['MODERATE', 'HIGH'],
  },
  {
    code: 'STEP_UP_LIVENESS_CHALLENGE',
    label: 'Step-up Liveness Challenge',
    desc: 'Enforce active biometric voice challenge',
    icon: Zap,
    tiers: ['MODERATE', 'HIGH'],
  },
  {
    code: 'DISPATCH_USER_SMS_ADVISORY',
    label: 'Dispatch User SMS Advisory',
    desc: 'Send out-of-band telecom alert to mobile',
    icon: Smartphone,
    tiers: ['MODERATE', 'HIGH'],
  },
  {
    code: 'PAUSE_TRANSACTION',
    label: 'Pause Transaction',
    desc: 'Hold financial clearing until released',
    icon: ShieldAlert,
    tiers: ['HIGH', 'MODERATE'],
  },
  {
    code: 'ALERT_FRAUD_DESK',
    label: 'Alert Frontline Fraud Desk',
    desc: 'Trigger urgent SOC Cyber Desk ticket',
    icon: Flame,
    tiers: ['HIGH'],
  },
  {
    code: 'DISPATCH_WEBHOOK',
    label: 'Dispatch SIEM Webhook',
    desc: 'Push event JSON to Core Banking SIEM',
    icon: Radio,
    tiers: ['HIGH', 'MODERATE'],
  },
  {
    code: 'TERMINATE_SESSION',
    label: 'Terminate Session',
    desc: 'Sever active VoIP / telephonic stream',
    icon: X,
    tiers: ['HIGH'],
  },
];

export function WorkflowConfigModal({
  isOpen,
  onClose,
  apiBaseUrl = DEFAULT_AEGIS_API_URL,
  onRulesUpdated = () => {},
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', text: '' }

  // Boundary thresholds:
  // LOW: 0 .. lowMax
  // MODERATE: (lowMax + 1) .. modMax
  // HIGH: (modMax + 1) .. 100
  const [lowMax, setLowMax] = useState(34);
  const [modMax, setModMax] = useState(70);

  // Selected actions per tier
  const [lowActions, setLowActions] = useState(['ALLOW_STREAM']);
  const [modActions, setModActions] = useState([
    'REQUIRE_SECONDARY_VERIFICATION',
    'DISPATCH_USER_SMS_ADVISORY',
    'STEP_UP_LIVENESS_CHALLENGE',
  ]);
  const [highActions, setHighActions] = useState([
    'PAUSE_TRANSACTION',
    'ALERT_FRAUD_DESK',
    'DISPATCH_WEBHOOK',
    'TERMINATE_SESSION',
  ]);

  const [isCustomized, setIsCustomized] = useState(false);
  const [testScore, setTestScore] = useState(45);

  useEffect(() => {
    if (isOpen) {
      loadRules();
    }
  }, [isOpen, apiBaseUrl]);

  const loadRules = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const data = await fetchWorkflowRules({ apiBaseUrl });
      if (data && Array.isArray(data.rules)) {
        setIsCustomized(Boolean(data.is_customized));
        const rLow = data.rules.find((r) => r.tier === 'LOW');
        const rMod = data.rules.find((r) => r.tier === 'MODERATE');
        const rHigh = data.rules.find((r) => r.tier === 'HIGH');

        if (rLow) {
          setLowMax(rLow.max_score);
          if (rLow.actions) setLowActions(rLow.actions);
        }
        if (rMod) {
          setModMax(rMod.max_score);
          if (rMod.actions) setModActions(rMod.actions);
        }
        if (rHigh) {
          if (rHigh.actions) setHighActions(rHigh.actions);
        }
      }
    } catch (err) {
      setFeedback({ type: 'error', text: `Failed to load rules: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleLowMaxChange = (val) => {
    const num = Math.max(5, Math.min(val, modMax - 5));
    setLowMax(num);
  };

  const handleModMaxChange = (val) => {
    const num = Math.max(lowMax + 5, Math.min(val, 95));
    setModMax(num);
  };

  const toggleAction = (tier, actionCode) => {
    if (tier === 'LOW') {
      setLowActions((prev) =>
        prev.includes(actionCode) ? prev.filter((a) => a !== actionCode) : [...prev, actionCode]
      );
    } else if (tier === 'MODERATE') {
      setModActions((prev) =>
        prev.includes(actionCode) ? prev.filter((a) => a !== actionCode) : [...prev, actionCode]
      );
    } else if (tier === 'HIGH') {
      setHighActions((prev) =>
        prev.includes(actionCode) ? prev.filter((a) => a !== actionCode) : [...prev, actionCode]
      );
    }
  };

  const applyPreset = (preset) => {
    if (preset === 'DEFAULT') {
      setLowMax(34);
      setModMax(70);
      setLowActions(['ALLOW_STREAM']);
      setModActions([
        'REQUIRE_SECONDARY_VERIFICATION',
        'DISPATCH_USER_SMS_ADVISORY',
        'STEP_UP_LIVENESS_CHALLENGE',
      ]);
      setHighActions([
        'PAUSE_TRANSACTION',
        'ALERT_FRAUD_DESK',
        'DISPATCH_WEBHOOK',
        'TERMINATE_SESSION',
      ]);
    } else if (preset === 'STRICT') {
      // Stricter: Moderate begins at 20, High begins at 50
      setLowMax(19);
      setModMax(49);
      setLowActions(['ALLOW_STREAM']);
      setModActions([
        'REQUIRE_SECONDARY_VERIFICATION',
        'STEP_UP_LIVENESS_CHALLENGE',
        'PAUSE_TRANSACTION',
        'DISPATCH_USER_SMS_ADVISORY',
      ]);
      setHighActions([
        'PAUSE_TRANSACTION',
        'ALERT_FRAUD_DESK',
        'DISPATCH_WEBHOOK',
        'TERMINATE_SESSION',
      ]);
    } else if (preset === 'PERMISSIVE') {
      // Permissive: Moderate begins at 45, High begins at 80
      setLowMax(44);
      setModMax(79);
      setLowActions(['ALLOW_STREAM']);
      setModActions(['REQUIRE_SECONDARY_VERIFICATION', 'DISPATCH_USER_SMS_ADVISORY']);
      setHighActions([
        'PAUSE_TRANSACTION',
        'ALERT_FRAUD_DESK',
        'DISPATCH_WEBHOOK',
        'TERMINATE_SESSION',
      ]);
    }
    setFeedback({ type: 'info', text: `Loaded preset: ${preset}. Click 'Save Policy' to apply.` });
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const payloadRules = [
        {
          tier: 'LOW',
          min_score: 0,
          max_score: lowMax,
          actions: lowActions.length > 0 ? lowActions : ['ALLOW_STREAM'],
          description: `Permissive stream channel for authenticated natural human speech (0-${lowMax}).`,
        },
        {
          tier: 'MODERATE',
          min_score: lowMax + 1,
          max_score: modMax,
          actions: modActions,
          description: `Elevated vigilance zone (${lowMax + 1}-${modMax}). Enforces advisory notice & optional secondary challenge.`,
        },
        {
          tier: 'HIGH',
          min_score: modMax + 1,
          max_score: 100,
          actions: highActions,
          description: `Critical biometric fraud threshold (${modMax + 1}-100). Triggers immediate transaction pause and incident dispatch.`,
        },
      ];

      const res = await updateWorkflowRules(payloadRules, { apiBaseUrl });
      setIsCustomized(true);
      setFeedback({
        type: 'success',
        text: '✅ Dynamic policy saved! All subsequent analyses will use these thresholds immediately without server restart.',
      });
      onRulesUpdated(res.config);
    } catch (err) {
      setFeedback({ type: 'error', text: `Save failed: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setFeedback(null);
    try {
      const res = await resetWorkflowRules({ apiBaseUrl });
      setIsCustomized(false);
      setLowMax(34);
      setModMax(70);
      setLowActions(['ALLOW_STREAM']);
      setModActions([
        'REQUIRE_SECONDARY_VERIFICATION',
        'DISPATCH_USER_SMS_ADVISORY',
        'STEP_UP_LIVENESS_CHALLENGE',
      ]);
      setHighActions([
        'PAUSE_TRANSACTION',
        'ALERT_FRAUD_DESK',
        'DISPATCH_WEBHOOK',
        'TERMINATE_SESSION',
      ]);
      setFeedback({
        type: 'success',
        text: '🔄 Reset to factory defaults (0-34 LOW, 35-70 MODERATE, 71-100 HIGH).',
      });
      onRulesUpdated(res.config);
    } catch (err) {
      setFeedback({ type: 'error', text: `Reset failed: ${err.message}` });
    } finally {
      setResetting(false);
    }
  };

  // Live evaluation simulation
  const getSimulatedTier = (score) => {
    if (score <= lowMax) return { tier: 'LOW', actions: lowActions, color: 'emerald' };
    if (score <= modMax) return { tier: 'MODERATE', actions: modActions, color: 'amber' };
    return { tier: 'HIGH', actions: highActions, color: 'rose' };
  };
  const sim = getSimulatedTier(testScore);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700/70 rounded-2xl shadow-2xl overflow-hidden font-sans text-slate-100"
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold font-display text-white tracking-wide">
                  Enterprise Workflow & Response Policy
                </h2>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    isCustomized
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                  }`}
                >
                  {isCustomized ? 'CUSTOM POLICY ACTIVE' : 'SIH FACTORY DEFAULT'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Real-time rule engine • Dynamic threshold tuning with instant zero-restart activation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FEEDBACK BANNER */}
        {feedback && (
          <div
            className={`px-6 py-2.5 text-xs font-mono flex items-center justify-between border-b ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                : feedback.type === 'error'
                ? 'bg-rose-950/60 text-rose-300 border-rose-500/30'
                : 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30'
            }`}
          >
            <span>{feedback.text}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-white ml-3"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* QUICK PRESETS */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
            <div className="flex items-center space-x-2 text-xs text-slate-300">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold">Quick Policy Profiles:</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => applyPreset('DEFAULT')}
                className="px-3 py-1 text-xs font-mono rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200 border border-slate-600/50 transition-colors"
              >
                Standard (35 / 71)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('STRICT')}
                className="px-3 py-1 text-xs font-mono rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors"
              >
                🛡️ High-Security (20 / 50)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('PERMISSIVE')}
                className="px-3 py-1 text-xs font-mono rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-colors"
              >
                Permissive Sandbox (45 / 80)
              </button>
            </div>
          </div>

          {/* DYNAMIC THRESHOLD RANGE SLIDERS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono tracking-wider text-slate-300 uppercase">
                Score Threshold Partitioning (0 — 100)
              </span>
              <span className="text-xs font-mono text-slate-400">
                Continuous coverage: No blindspots
              </span>
            </div>

            {/* Visual Continuous Range Bar */}
            <div className="h-6 rounded-xl overflow-hidden flex font-mono text-[10px] font-bold text-center leading-6 select-none border border-slate-700/70 shadow-inner">
              <div
                style={{ width: `${lowMax}%` }}
                className="bg-emerald-600/60 text-emerald-200 flex items-center justify-center transition-all"
              >
                LOW [0 - {lowMax}]
              </div>
              <div
                style={{ width: `${modMax - lowMax}%` }}
                className="bg-amber-600/60 text-amber-200 flex items-center justify-center transition-all"
              >
                MODERATE [{lowMax + 1} - {modMax}]
              </div>
              <div
                style={{ width: `${100 - modMax}%` }}
                className="bg-rose-600/60 text-rose-200 flex items-center justify-center transition-all"
              >
                HIGH [{modMax + 1} - 100]
              </div>
            </div>

            {/* Range Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-emerald-400 font-semibold font-mono">
                    Low / Moderate Boundary:
                  </span>
                  <span className="font-mono font-bold text-white bg-slate-700/60 px-2 py-0.5 rounded border border-slate-600">
                    {lowMax}
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={60}
                  value={lowMax}
                  onChange={(e) => handleLowMaxChange(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>10 (Strict)</span>
                  <span>60 (Permissive)</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-rose-400 font-semibold font-mono">
                    Moderate / High Boundary:
                  </span>
                  <span className="font-mono font-bold text-white bg-slate-700/60 px-2 py-0.5 rounded border border-slate-600">
                    {modMax}
                  </span>
                </div>
                <input
                  type="range"
                  min={lowMax + 5}
                  max={90}
                  value={modMax}
                  onChange={(e) => handleModMaxChange(Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>{lowMax + 5} (Tight)</span>
                  <span>90 (Loose)</span>
                </div>
              </div>
            </div>
          </div>

          {/* CONFIGURE ACTIONS PER TIER */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold font-mono tracking-wider text-slate-300 uppercase">
              Automated Response Action Triggers
            </h3>

            {/* 1. LOW TIER CARD */}
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-sm text-emerald-300 font-display">
                    Tier 1: LOW RISK (Score 0 — {lowMax})
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  Natural Speech
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans">
                Standard processing for verified authentic speech. No secondary friction or alerts.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {ALL_AVAILABLE_ACTIONS.filter((a) => a.tiers.includes('LOW')).map((act) => {
                  const isChecked = lowActions.includes(act.code);
                  return (
                    <button
                      key={act.code}
                      type="button"
                      onClick={() => toggleAction('LOW', act.code)}
                      className={`text-xs font-mono px-3 py-1.5 rounded-lg border flex items-center space-x-1.5 transition-all ${
                        isChecked
                          ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/50 shadow-sm'
                          : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <act.icon className="w-3.5 h-3.5" />
                      <span>{act.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. MODERATE TIER CARD */}
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-sm text-amber-300 font-display">
                    Tier 2: MODERATE RISK (Score {lowMax + 1} — {modMax})
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  Step-Up Challenge
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans">
                Ambiguous phonation, telephony codec distortion, or borderline synthetic markers.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {ALL_AVAILABLE_ACTIONS.filter((a) => a.tiers.includes('MODERATE')).map((act) => {
                  const isChecked = modActions.includes(act.code);
                  return (
                    <button
                      key={act.code}
                      type="button"
                      onClick={() => toggleAction('MODERATE', act.code)}
                      className={`text-xs font-mono px-3 py-1.5 rounded-lg border flex items-center space-x-1.5 transition-all ${
                        isChecked
                          ? 'bg-amber-500/20 text-amber-200 border-amber-500/50 shadow-sm'
                          : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <act.icon className="w-3.5 h-3.5" />
                      <span>{act.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. HIGH TIER CARD */}
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span className="font-bold text-sm text-rose-300 font-display">
                    Tier 3: HIGH / CRITICAL RISK (Score {modMax + 1} — 100)
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30">
                  Active Cybersecurity Intercept
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans">
                Confirmed synthetic speech, replay attack, or social engineering extortion attempt.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {ALL_AVAILABLE_ACTIONS.filter((a) => a.tiers.includes('HIGH')).map((act) => {
                  const isChecked = highActions.includes(act.code);
                  return (
                    <button
                      key={act.code}
                      type="button"
                      onClick={() => toggleAction('HIGH', act.code)}
                      className={`text-xs font-mono px-3 py-1.5 rounded-lg border flex items-center space-x-1.5 transition-all ${
                        isChecked
                          ? 'bg-rose-500/20 text-rose-200 border-rose-500/50 shadow-sm'
                          : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <act.icon className="w-3.5 h-3.5" />
                      <span>{act.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* INTERACTIVE POLICY SIMULATOR */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-cyan-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold font-mono text-cyan-300">
                <Zap className="w-4 h-4" />
                <span>Live Policy Evaluation Simulator</span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Test Score:{' '}
                <strong className="text-white bg-slate-700 px-2 py-0.5 rounded">
                  {testScore} / 100
                </strong>
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={100}
              value={testScore}
              onChange={(e) => setTestScore(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
            />

            <div
              className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono ${
                sim.color === 'emerald'
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : sim.color === 'amber'
                  ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
              }`}
            >
              <div>
                <span className="font-bold">Active Tier: {sim.tier}</span>
                <span className="text-slate-400 ml-2">
                  (Challenge Required:{' '}
                  {sim.tier === 'LOW' ? 'NO' : 'YES'})
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-400">Actions:</span>
                {sim.actions.map((act) => (
                  <span
                    key={act}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-white/10 border border-white/20 text-white"
                  >
                    {act}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/90 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting || saving}
            className="flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-xs font-mono font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
            <span>Reset Factory Baseline</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || resetting}
              className="flex items-center justify-center space-x-2 px-5 py-2 rounded-xl text-xs font-mono font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
              <span>{saving ? 'Saving Policy...' : 'Save & Activate Policy'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default WorkflowConfigModal;
