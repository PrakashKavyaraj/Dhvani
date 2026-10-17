import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Landmark,
  ShieldCheck,
  FileText,
  Lock,
  Layers,
  HelpCircle,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  Send,
  Scale,
  Clock,
  ExternalLink,
  ChevronRight,
  Database,
  Cpu,
  UserCheck,
  FileCheck,
} from 'lucide-react';
import {
  fetchModelCards,
  fetchRbiFreeAiMatrix,
  fetchDpdpCompliance,
  fetchExplainVerdict,
  submitCustomerDispute,
  fetchCustomerDisputes,
} from '../services/aegisApiClient';

export function ModelGovernanceModal({
  isOpen,
  onClose,
  analysisResult,
  apiBaseUrl,
}) {
  const [activeTab, setActiveTab] = useState('model_cards');
  const [modelCards, setModelCards] = useState(null);
  const [selectedModelKey, setSelectedModelKey] = useState('forensics_0_3b');
  const [freeAiMatrix, setFreeAiMatrix] = useState(null);
  const [dpdpProfile, setDpdpProfile] = useState(null);
  const [explainResult, setExplainResult] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dispute Form state
  const [disputeForm, setDisputeForm] = useState({
    call_sid: analysisResult?.analysis_id || 'CALL-' + Date.now().toString(36).toUpperCase(),
    customer_account_id: 'HDFC-CORP-4820',
    customer_name: 'Aditi Sharma',
    contact_number: '+91 98201 44819',
    reason: 'Legitimate authorized wire transfer flagged by automated system. Voice authentic.',
  });
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [disputeSuccess, setDisputeSuccess] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadGovernanceData();
    }
  }, [isOpen]);

  const loadGovernanceData = async () => {
    setLoading(true);
    try {
      const [cardsRes, matrixRes, dpdpRes, disputesRes] = await Promise.all([
        fetchModelCards({ apiBaseUrl }),
        fetchRbiFreeAiMatrix({ apiBaseUrl }),
        fetchDpdpCompliance({ apiBaseUrl }),
        fetchCustomerDisputes({ apiBaseUrl }),
      ]);
      setModelCards(cardsRes.model_cards || {});
      setFreeAiMatrix(matrixRes);
      setDpdpProfile(dpdpRes);
      setDisputes(disputesRes.disputes || []);

      // If we have an analysis result, generate plain-language explanation
      if (analysisResult) {
        const payload = {
          call_sid: analysisResult.analysis_id || 'CALL-ACTIVE',
          risk_score: (analysisResult.risk_score || analysisResult.overall_risk || 0.15) * (analysisResult.risk_score <= 1 ? 100 : 1),
          primary_fake_score: analysisResult.primary_fake_score || analysisResult.raw_fake_score || 0.12,
          raw_aasist_score: analysisResult.raw_aasist_score || analysisResult.raw_spoof_score || 0.08,
          speaker_similarity: analysisResult.speaker_similarity || 0.88,
          channel_status: analysisResult.channel_status || 'HD_VOIP_OPUS',
          decision_action: analysisResult.recommendation?.action || 'ALLOW',
          vocoder_attribution: analysisResult.vocoder_attribution?.detected_vocoder || 'None (Natural Acoustic Phonation)',
        };
        const explainRes = await fetchExplainVerdict(payload, { apiBaseUrl });
        setExplainResult(explainRes);
      }
    } catch (err) {
      console.error('Failed to load governance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisputeSubmit = async (e) => {
    e.preventDefault();
    setSubmittingDispute(true);
    try {
      const res = await submitCustomerDispute(disputeForm, { apiBaseUrl });
      setDisputeSuccess(res);
      const updated = await fetchCustomerDisputes({ apiBaseUrl });
      setDisputes(updated.disputes || []);
    } catch (err) {
      alert('Dispute submission failed: ' + err.message);
    } finally {
      setSubmittingDispute(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-5xl bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto text-slate-100"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-b border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold font-display text-white">
                  Model Governance & Regulatory Compliance
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                  RBI FREE-AI & DPDP 2025
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Model cards, 26 FREE-AI recommendations, zero-retention privacy architecture, and customer contestation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 bg-black/40 px-4 overflow-x-auto">
          {[
            { id: 'model_cards', label: 'Model Cards (MRM)', icon: Cpu },
            { id: 'rbi_free_ai', label: 'RBI FREE-AI (26 Recs)', icon: Landmark },
            { id: 'dpdp_compliance', label: 'DPDP Act & Rules 2025', icon: Lock },
            { id: 'plain_xai', label: 'Plain-Language XAI', icon: HelpCircle },
            { id: 'customer_dispute', label: 'Customer Contestation', icon: UserCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-4 text-xs font-mono font-medium border-b-2 flex items-center space-x-2 whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-sm">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-mono text-slate-400">Loading regulatory governance data...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: MODEL CARDS */}
              {activeTab === 'model_cards' && modelCards && (
                <div className="space-y-6">
                  {/* Selector Tabs for Models */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.keys(modelCards).map((key) => {
                      const m = modelCards[key];
                      const isSel = selectedModelKey === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedModelKey(key)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            isSel
                              ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-md'
                              : 'bg-black/30 border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
                          }`}
                        >
                          <span className="block text-[10px] font-mono text-amber-400 uppercase font-bold">
                            {m.parameters}
                          </span>
                          <span className="block text-xs font-bold font-display mt-0.5 text-white truncate">
                            {m.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Model Details */}
                  {modelCards[selectedModelKey] && (
                    <div className="p-5 rounded-2xl bg-black/40 border border-white/10 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-white font-display">
                              {modelCards[selectedModelKey].name}
                            </h4>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                              {modelCards[selectedModelKey].version}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">
                            Architecture: {modelCards[selectedModelKey].architecture}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Parameters: {modelCards[selectedModelKey].parameters}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-3.5 rounded-xl bg-slate-800/50 border border-white/5 space-y-1">
                          <span className="font-mono text-[10px] text-amber-400 uppercase font-bold flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5" /> Intended Banking Use
                          </span>
                          <p className="text-slate-300 leading-relaxed font-sans">
                            {modelCards[selectedModelKey].intended_use}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-800/50 border border-white/5 space-y-1">
                          <span className="font-mono text-[10px] text-cyan-400 uppercase font-bold flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5" /> Training & Calibration Corpus
                          </span>
                          <p className="text-slate-300 leading-relaxed font-sans">
                            {modelCards[selectedModelKey].training_data}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-800/50 border border-white/5 space-y-1">
                          <span className="font-mono text-[10px] text-emerald-400 uppercase font-bold flex items-center gap-1.5">
                            <FileCheck className="w-3.5 h-3.5" /> 8 kHz Telephony Codec Robustness
                          </span>
                          <p className="text-slate-300 leading-relaxed font-sans">
                            {modelCards[selectedModelKey].telephony_robustness}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-800/50 border border-white/5 space-y-1">
                          <span className="font-mono text-[10px] text-purple-400 uppercase font-bold flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5" /> Indian Dialect & Accent Fairness
                          </span>
                          <p className="text-slate-300 leading-relaxed font-sans">
                            {modelCards[selectedModelKey].bias_and_fairness}
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/20 space-y-1">
                        <span className="font-mono text-[10px] text-rose-400 uppercase font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" /> Known Operational Limitations
                        </span>
                        <p className="text-xs text-slate-300 leading-relaxed font-sans">
                          {modelCards[selectedModelKey].limitations}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          <Scale className="w-4 h-4 text-amber-400" />
                          <span className="font-mono text-slate-300">Probability Calibration:</span>
                          <span className="font-mono font-bold text-amber-300">
                            {modelCards[selectedModelKey].calibration_status}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          Platt Scaling Logistic Regression (L-BFGS-B)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: RBI FREE-AI MATRIX */}
              {activeTab === 'rbi_free_ai' && freeAiMatrix && (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-white text-sm font-display">
                        RBI FREE-AI Framework Alignment
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Framework for Responsible and Ethical Enablement of AI in Financial Services (26 Recommendations across 6 Pillars)
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0 self-start sm:self-auto">
                      26 of 26 Documented
                    </span>
                  </div>

                  <div className="space-y-4">
                    {freeAiMatrix.pillars?.map((pillar) => (
                      <div
                        key={pillar.pillar_id}
                        className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <div className="flex items-center space-x-2.5">
                            <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold flex items-center justify-center">
                              {pillar.pillar_id}
                            </span>
                            <h5 className="font-bold text-white text-sm font-display">
                              Pillar {pillar.pillar_id}: {pillar.title}
                            </h5>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {pillar.recommendations?.length} Recommendations
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5">
                          {pillar.recommendations?.map((rec) => (
                            <div
                              key={rec.rec_id}
                              className="p-3 rounded-xl bg-slate-800/40 border border-white/5 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 text-xs hover:border-white/10 transition-colors"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span className="font-mono font-bold text-amber-400 text-[11px]">
                                    {rec.rec_id}
                                  </span>
                                  <span className="font-semibold text-slate-200">
                                    {rec.title}
                                  </span>
                                </div>
                                <p className="text-slate-400 pl-6 leading-relaxed font-sans text-[11px]">
                                  {rec.dhvani_evidence}
                                </p>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 self-start sm:self-auto ${
                                  rec.status === 'COMPLIANT'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : rec.status === 'AUDITED'
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                }`}
                              >
                                {rec.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: DPDP ACT & RULES 2025 */}
              {activeTab === 'dpdp_compliance' && dpdpProfile && (
                <div className="space-y-6">
                  {/* Timeline Card */}
                  <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-indigo-400" />
                      <h4 className="font-bold text-white text-sm font-display">
                        DPDP Rules 2025 Phased Implementation Schedule
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                        <span className="block font-mono text-[10px] text-slate-400">Rules Notification</span>
                        <span className="block font-bold text-slate-200">Mid-November 2025</span>
                        <p className="text-[10px] text-slate-400">Draft notified for industry alignment</p>
                      </div>
                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                        <span className="block font-mono text-[10px] text-amber-400">Consent Managers</span>
                        <span className="block font-bold text-amber-300">14 November 2026</span>
                        <p className="text-[10px] text-slate-400">Registration of Consent Managers commences</p>
                      </div>
                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                        <span className="block font-mono text-[10px] text-emerald-400">Full Enforcement</span>
                        <span className="block font-bold text-emerald-300">14 May 2027</span>
                        <p className="text-[10px] text-slate-400">Mandatory compliance for Significant Data Fiduciaries</p>
                      </div>
                    </div>
                  </div>

                  {/* 3-Tier Data Flow */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-400" /> Three-Tier Voice Data Flow & Protection
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {dpdpProfile.data_tiers?.map((tier) => (
                        <div
                          key={tier.tier}
                          className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2 flex flex-col justify-between"
                        >
                          <div>
                            <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              {tier.tier}
                            </span>
                            <h5 className="font-bold text-white text-xs mt-2">
                              {tier.data_type}
                            </h5>
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                              {tier.description}
                            </p>
                          </div>
                          <div className="pt-2 border-t border-white/5 space-y-1 text-[10px] font-mono">
                            <div className="flex justify-between text-slate-400">
                              <span>Retention:</span>
                              <span className="text-emerald-400 font-bold">{tier.retention_policy}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>Protection:</span>
                              <span className="text-cyan-400">{tier.protection_mechanism}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Incident Notification & Compliance Summary */}
                  <div className="p-4 rounded-xl bg-black/30 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <div className="flex items-center space-x-3">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-200">Statutory Breach Notification SLA:</span>
                        <p className="text-slate-400 mt-0.5">
                          {dpdpProfile.incident_notification_sla}
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-lg text-xs font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shrink-0">
                      DPDP Section 8(7) Compliant
                    </span>
                  </div>
                </div>
              )}

              {/* TAB 4: PLAIN-LANGUAGE EXPLAINABILITY */}
              {activeTab === 'plain_xai' && (
                <div className="space-y-6">
                  {explainResult ? (
                    <div className="space-y-4">
                      <div className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-amber-500/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                            <HelpCircle className="w-3.5 h-3.5" /> Plain-Language Analyst Summary
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            Verdict: {explainResult.verdict_summary}
                          </span>
                        </div>
                        <p className="text-sm text-slate-200 leading-relaxed font-sans bg-black/50 p-4 rounded-xl border border-white/5">
                          {explainResult.plain_language_narrative}
                        </p>
                      </div>

                      {/* Contributing Factors Breakdown */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold">
                          Multi-Model Contributing Evidentiary Factors
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {explainResult.contributing_factors?.map((f, i) => (
                            <div
                              key={i}
                              className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-white">{f.model}</span>
                                <span className="text-[10px] font-mono text-cyan-400">
                                  Score: {(f.score * 100).toFixed(1)}%
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-300 leading-relaxed">
                                {f.observation}
                              </p>
                              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 pt-1 border-t border-white/5">
                                <span>Impact Weight:</span>
                                <span className="text-amber-400 font-semibold">{f.impact_weight}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Plain-Language Audit Statement */}
                      <div className="p-3.5 rounded-xl bg-slate-800/40 border border-white/10 text-xs text-slate-300 flex items-center justify-between">
                        <span className="font-mono text-slate-400">Cryptographic Audit Chain:</span>
                        <span className="font-mono font-bold text-cyan-300">{explainResult.audit_statement}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center space-y-2">
                      <HelpCircle className="w-8 h-8 text-slate-500 mx-auto" />
                      <p className="text-xs font-mono text-slate-400">
                        Run an audio or stream analysis to inspect plain-language explainability narratives.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: CUSTOMER CONTESTATION & DISPUTES */}
              {activeTab === 'customer_dispute' && (
                <div className="space-y-6">
                  {/* Top Advisory */}
                  <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-start space-x-3 text-xs">
                    <UserCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <p className="text-slate-300 leading-relaxed font-sans">
                      <span className="text-cyan-300 font-bold">RBI FREE-AI Pillar 4 (Contestability): </span>
                      Account holders have the statutory right to contest automated AI-driven fraud blocks and request secondary human verification by a certified banking operations officer.
                    </p>
                  </div>

                  {/* Dispute Submission Form */}
                  <form onSubmit={handleDisputeSubmit} className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-white/10 space-y-4">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
                      Register AI Decision Contest / Dispute Ticket
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] font-mono text-slate-400 mb-1">Call SID / Session ID</label>
                        <input
                          type="text"
                          value={disputeForm.call_sid}
                          onChange={(e) => setDisputeForm({ ...disputeForm, call_sid: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-slate-400 mb-1">Customer Account / CIF ID</label>
                        <input
                          type="text"
                          value={disputeForm.customer_account_id}
                          onChange={(e) => setDisputeForm({ ...disputeForm, customer_account_id: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-slate-400 mb-1">Customer Full Name</label>
                        <input
                          type="text"
                          value={disputeForm.customer_name}
                          onChange={(e) => setDisputeForm({ ...disputeForm, customer_name: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-slate-400 mb-1">Registered Contact Number</label>
                        <input
                          type="text"
                          value={disputeForm.contact_number}
                          onChange={(e) => setDisputeForm({ ...disputeForm, contact_number: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">Grounds for Contestation / Rationale</label>
                      <textarea
                        rows={2}
                        value={disputeForm.reason}
                        onChange={(e) => setDisputeForm({ ...disputeForm, reason: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-white/10 text-white font-sans text-xs focus:outline-none focus:border-amber-400"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {disputeSuccess && (
                        <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Registered {disputeSuccess.dispute_id} (Status: {disputeSuccess.status})
                        </span>
                      )}
                      <button
                        type="submit"
                        disabled={submittingDispute}
                        className="ml-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs flex items-center space-x-1.5 cursor-pointer transition-all shadow-md"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{submittingDispute ? 'Submitting Ticket...' : 'File Contestation Ticket'}</span>
                      </button>
                    </div>
                  </form>

                  {/* Registered Disputes List */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold">
                      Active Customer Contestation Tickets ({disputes.length})
                    </h4>
                    <div className="space-y-2">
                      {disputes.map((d) => (
                        <div
                          key={d.dispute_id}
                          className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-amber-400 text-xs">
                                {d.dispute_id}
                              </span>
                              <span className="text-slate-300 font-semibold">
                                {d.customer_account_id}
                              </span>
                              <span className="text-slate-400 font-mono text-[10px]">
                                ({d.customer_name})
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300">
                              Reason: {d.reason}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              {d.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-black/60 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Audit Trail: Section 63 BSA Tamper-Evident SHA-256 Chain</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs transition-colors cursor-pointer"
          >
            Close Governance Panel
          </button>
        </div>
      </motion.div>
    </div>
  );
}
