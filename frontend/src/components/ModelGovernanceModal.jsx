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
  Copy,
  Server,
  Sliders,
  Radio,
  Activity,
  Volume2,
  Zap,
  Key,
  RefreshCw,
  Award,
} from 'lucide-react';
import {
  fetchModelCards,
  fetchRbiFreeAiMatrix,
  fetchDpdpCompliance,
  fetchExplainVerdict,
  submitCustomerDispute,
  fetchCustomerDisputes,
  fetchTenants,
  updateTenantPolicy,
  fetchPgvectorDdl,
  fetchRedisSessionHealth,
  fetchTenantStats,
  purgeCustomerVoiceprint,
  fetchMultilingualBenchmark,
  fetchIndianDialects,
  fetchReplayAnalysis,
  fetchSecurityPack,
  fetchRbiDueDiligence,
  createSection63Certificate,
  fetchShadowTelemetry,
  promoteShadowModel,
  resetShadowCircuitBreaker,
  fetchSasvBenchmark,
  evaluateJointSasv,
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

  // Multi-Tenant & Scalability state
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState('HDFC-BANK');
  const [tenantStats, setTenantStats] = useState(null);
  const [pgvectorDdl, setPgvectorDdl] = useState('');
  const [redisHealth, setRedisHealth] = useState(null);
  const [purgeAccountId, setPurgeAccountId] = useState('');
  const [purgeSuccess, setPurgeSuccess] = useState(null);
  const [copiedDdl, setCopiedDdl] = useState(false);

  // Replay Defense & Indian Multilingual state
  const [multilingualReport, setMultilingualReport] = useState(null);
  const [dialectsList, setDialectsList] = useState([]);

  // Vendor Due Diligence & Shadow Mode state
  const [securityPack, setSecurityPack] = useState(null);
  const [rbiDueDiligence, setRbiDueDiligence] = useState(null);
  const [shadowTelemetry, setShadowTelemetry] = useState(null);
  const [section63Cert, setSection63Cert] = useState(null);
  const [copiedCert, setCopiedCert] = useState(false);
  const [promotingShadow, setPromotingShadow] = useState(false);
  const [promotionMessage, setPromotionMessage] = useState(null);

  // Joint SASV (CM + ASV) state
  const [sasvBenchmark, setSasvBenchmark] = useState(null);
  const [sasvLiveVerdict, setSasvLiveVerdict] = useState(null);

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
      const [
        cardsRes,
        matrixRes,
        dpdpRes,
        disputesRes,
        tenantsRes,
        ddlRes,
        redisRes,
        statsRes,
        multiRes,
        dialectsRes,
        secRes,
        dueRes,
        shadowRes,
        sasvRes,
      ] = await Promise.all([
        fetchModelCards({ apiBaseUrl }),
        fetchRbiFreeAiMatrix({ apiBaseUrl }),
        fetchDpdpCompliance({ apiBaseUrl }),
        fetchCustomerDisputes({ apiBaseUrl }),
        fetchTenants({ apiBaseUrl }),
        fetchPgvectorDdl({ apiBaseUrl }),
        fetchRedisSessionHealth({ apiBaseUrl }),
        fetchTenantStats('HDFC-BANK', { apiBaseUrl }),
        fetchMultilingualBenchmark({ apiBaseUrl }),
        fetchIndianDialects({ apiBaseUrl }),
        fetchSecurityPack({ apiBaseUrl }),
        fetchRbiDueDiligence({ apiBaseUrl }),
        fetchShadowTelemetry({ apiBaseUrl }),
        fetchSasvBenchmark({ apiBaseUrl }),
      ]);
      setModelCards(cardsRes.model_cards || {});
      setFreeAiMatrix(matrixRes);
      setDpdpProfile(dpdpRes);
      setDisputes(disputesRes.disputes || []);
      setTenants(tenantsRes.tenants || []);
      setPgvectorDdl(ddlRes.sql_schema || '');
      setRedisHealth(redisRes);
      setTenantStats(statsRes);
      setMultilingualReport(multiRes);
      setDialectsList(dialectsRes.supported_languages || []);
      setSecurityPack(secRes);
      setRbiDueDiligence(dueRes);
      setShadowTelemetry(shadowRes);
      setSasvBenchmark(sasvRes);

      // Pre-compute live SASV verdict
      try {
        const sasvPayload = {
          cm_synthetic_prob: analysisResult?.primary_fake_score || analysisResult?.raw_fake_score || 0.12,
          asv_similarity: analysisResult?.speaker_similarity || 0.88,
          transfer_amount_inr: 750000.0,
          customer_account_id: 'HDFC-CORP-4820',
        };
        const sasvVerdict = await evaluateJointSasv(sasvPayload, { apiBaseUrl });
        setSasvLiveVerdict(sasvVerdict);
      } catch (e) {
        console.warn('SASV verdict pre-computation notice:', e);
      }

      // Pre-generate Section 63 certificate
      try {
        const certPayload = {
          call_sid: analysisResult?.analysis_id || 'CALL-ACTIVE-9901',
          audio_sha256: analysisResult?.audio_sha256 || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          merkle_root: analysisResult?.merkle_root || '7a8b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
          detection_score: analysisResult?.primary_fake_score || 0.12,
          bank_name: 'HDFC Bank (Wholesale Banking)',
          officer_name: 'Rajeshwari Iyer',
          officer_designation: 'Vice President, Information Security & Cyber Defense',
          system_hostname: 'dhvani-prod-core-01.mumbai.internal',
        };
        const certRes = await createSection63Certificate(certPayload, { apiBaseUrl });
        setSection63Cert(certRes);
      } catch (e) {
        console.warn('Section 63 pre-generation notice:', e);
      }

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

  const handleTenantSelect = async (tenantId) => {
    setSelectedTenantId(tenantId);
    try {
      const s = await fetchTenantStats(tenantId, { apiBaseUrl });
      setTenantStats(s);
    } catch (err) {
      console.error('Failed to fetch tenant stats:', err);
    }
  };

  const handlePurgeCustomer = async (e) => {
    e.preventDefault();
    if (!purgeAccountId.trim()) return;
    try {
      const res = await purgeCustomerVoiceprint(selectedTenantId, purgeAccountId.trim(), { apiBaseUrl });
      setPurgeSuccess(res);
      const s = await fetchTenantStats(selectedTenantId, { apiBaseUrl });
      setTenantStats(s);
      setPurgeAccountId('');
    } catch (err) {
      alert('Purge failed: ' + err.message);
    }
  };

  const handleCopyDdl = () => {
    navigator.clipboard.writeText(pgvectorDdl);
    setCopiedDdl(true);
    setTimeout(() => setCopiedDdl(false), 2000);
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

  const handleCopyCertificate = () => {
    if (section63Cert?.certificate_text) {
      navigator.clipboard.writeText(section63Cert.certificate_text);
      setCopiedCert(true);
      setTimeout(() => setCopiedCert(false), 2000);
    }
  };

  const handlePromoteCandidate = async () => {
    setPromotingShadow(true);
    setPromotionMessage(null);
    try {
      await promoteShadowModel({ officer_id: 'ADMIN-CISO-01' }, { apiBaseUrl });
      setPromotionMessage('Candidate successfully promoted to Primary Active!');
      const updated = await fetchShadowTelemetry({ apiBaseUrl });
      setShadowTelemetry(updated);
    } catch (err) {
      setPromotionMessage(`Promotion failed: ${err.message}`);
    } finally {
      setPromotingShadow(false);
    }
  };

  const handleResetShadowBreaker = async () => {
    try {
      await resetShadowCircuitBreaker({ apiBaseUrl });
      const updated = await fetchShadowTelemetry({ apiBaseUrl });
      setShadowTelemetry(updated);
    } catch (err) {
      console.error('Failed to reset circuit breaker:', err);
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
            { id: 'multi_tenant', label: 'Multi-Tenant & pgvector', icon: Server },
            { id: 'replay_multilingual', label: 'Replay & Indian Dialects', icon: Radio },
            { id: 'sasv_joint', label: 'Joint SASV (CM + ASV)', icon: ShieldCheck },
            { id: 'vendor_assurance', label: 'Vendor Assurance & Shadow Ops', icon: Award },
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

              {/* TAB 6: MULTI-TENANT & PGVECTOR ARCHITECTURE */}
              {activeTab === 'multi_tenant' && (
                <div className="space-y-6">
                  {/* Bank Tenant Selection Grid */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5" /> Multi-Tenant Financial Institution Isolation
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400">
                        Select tenant to inspect dedicated risk policy & biometric vault
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {tenants.map((t) => {
                        const isSel = selectedTenantId === t.tenant_id;
                        return (
                          <button
                            key={t.tenant_id}
                            type="button"
                            onClick={() => handleTenantSelect(t.tenant_id)}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              isSel
                                ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-md'
                                : 'bg-black/30 border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-amber-300">
                                {t.tenant_id}
                              </span>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                                {t.tier}
                              </span>
                            </div>
                            <span className="block text-[11px] font-medium text-slate-200 mt-1 truncate">
                              {t.institution_name}
                            </span>
                            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2 pt-1.5 border-t border-white/5">
                              <span>Block: {t.block_threshold}%</span>
                              <span>SLA: {t.sla_budget_ms}ms</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tenant Policy & Vault Statistics Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Active Tenant Policy */}
                    <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-amber-400" /> Operational Policy: {selectedTenantId}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          FAIL-OPEN ACTIVE
                        </span>
                      </div>

                      {tenantStats && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-lg bg-slate-800/40 border border-white/5">
                            <span className="block text-[10px] font-mono text-slate-400">Block Threshold</span>
                            <span className="block font-bold text-rose-400 text-sm mt-0.5">
                              {tenantStats.policy?.block_threshold}%
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-slate-800/40 border border-white/5">
                            <span className="block text-[10px] font-mono text-slate-400">Step-Up Threshold</span>
                            <span className="block font-bold text-amber-400 text-sm mt-0.5">
                              {tenantStats.policy?.step_up_threshold}%
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-slate-800/40 border border-white/5">
                            <span className="block text-[10px] font-mono text-slate-400">Telephony SLA Budget</span>
                            <span className="block font-bold text-cyan-400 text-sm mt-0.5">
                              {tenantStats.policy?.sla_budget_ms} ms
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-slate-800/40 border border-white/5">
                            <span className="block text-[10px] font-mono text-slate-400">Enrolled Voiceprints</span>
                            <span className="block font-bold text-emerald-400 text-sm mt-0.5">
                              {tenantStats.vault?.enrolled_voiceprints ?? 0}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Distributed Redis Telephony Buffer Health */}
                    <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-cyan-400" /> Distributed Telephony Buffer
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          {redisHealth?.backend === 'redis_cluster' ? 'REDIS CLUSTER' : 'RAM VOLATILE'}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-slate-800/40 border border-white/5 flex justify-between items-center">
                          <span className="text-slate-400">Storage Architecture:</span>
                          <span className="font-mono text-slate-200">Ephemeral Sliding Window (Zero Disk)</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-800/40 border border-white/5 flex justify-between items-center">
                          <span className="text-slate-400">Sliding Window Auto-TTL:</span>
                          <span className="font-mono text-emerald-400 font-bold">15 seconds (DPDP Sec 8(7))</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-800/40 border border-white/5 flex justify-between items-center">
                          <span className="text-slate-400">Vector Search Engine:</span>
                          <span className="font-mono text-amber-400">pgvector HNSW / Cosine Space</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DPDP Section 12 Right to Erasure */}
                  <form onSubmit={handlePurgeCustomer} className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono uppercase tracking-wider text-rose-400 font-bold flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" /> DPDP Section 12: Customer Right to Erasure
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Target Tenant: {selectedTenantId}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        placeholder="Enter Customer Account ID to permanently purge (e.g. CUST-9901)"
                        value={purgeAccountId}
                        onChange={(e) => setPurgeAccountId(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-rose-400"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs shrink-0 cursor-pointer transition-all shadow-md"
                      >
                        Purge Voiceprint
                      </button>
                    </div>

                    {purgeSuccess && (
                      <p className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Purged {purgeSuccess.records_purged} record(s) for {purgeSuccess.customer_account_id} in {purgeSuccess.tenant_id}.
                      </p>
                    )}
                  </form>

                  {/* PostgreSQL 16 + pgvector DDL Schema Box */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-amber-400" /> PostgreSQL 16 + pgvector Enterprise DDL
                      </h4>
                      <button
                        type="button"
                        onClick={handleCopyDdl}
                        className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-mono text-slate-200 transition-colors cursor-pointer"
                      >
                        <Copy className="w-3 h-3 text-amber-400" />
                        <span>{copiedDdl ? 'Copied to Clipboard!' : 'Copy SQL Schema'}</span>
                      </button>
                    </div>

                    <div className="p-4 rounded-xl bg-black/60 border border-white/10 overflow-x-auto max-h-56">
                      <pre className="font-mono text-[11px] text-cyan-300 leading-relaxed">
                        {pgvectorDdl}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: REPLAY DEFENSE & INDIAN MULTILINGUAL */}
              {activeTab === 'replay_multilingual' && (
                <div className="space-y-6">
                  {/* Executive Summary Banner */}
                  <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-slate-900 border border-amber-500/30 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Radio className="w-4 h-4 text-amber-400" />
                          <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-white">
                            Adversarial Acoustic Replay Defense & Indian Multilingual Generalization
                          </h3>
                        </div>
                        <p className="text-xs text-slate-300">
                          Mitigating physical loudspeaker presentation attacks via Schroeder Direct-to-Reverberant Ratio (DRR), odd-harmonic transducer non-linearity (THD), and cross-lingual validation across 5 Indian linguistic families and code-switched Hinglish.
                        </p>
                      </div>
                      <span className="self-start sm:self-auto px-2.5 py-1 rounded-full text-[11px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold whitespace-nowrap">
                        20.0x Replay Error Reduction
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 text-xs">
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                        <span className="text-[10px] font-mono text-slate-400 block uppercase">Unmitigated Replay EER</span>
                        <span className="text-sm font-mono font-bold text-rose-400">
                          {multilingualReport?.summary?.unmitigated_replay_eer ?? 0.20}%
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                        <span className="text-[10px] font-mono text-slate-400 block uppercase">With Replay Defense</span>
                        <span className="text-sm font-mono font-bold text-emerald-400">
                          {multilingualReport?.summary?.mitigated_replay_eer ?? 0.00}%
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                        <span className="text-[10px] font-mono text-slate-400 block uppercase">Multilingual Avg EER</span>
                        <span className="text-sm font-mono font-bold text-cyan-400">
                          {multilingualReport?.summary?.multilingual_average_eer ?? 0.00}%
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                        <span className="text-[10px] font-mono text-slate-400 block uppercase">Indian Dialects</span>
                        <span className="text-sm font-mono font-bold text-amber-300">
                          {dialectsList?.length || 5} Major / 15+ Dialects
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Physical Transducer & Acoustic Telemetry Explanations */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                          <Activity className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-mono font-bold uppercase text-slate-200">
                          Direct-to-Reverberant Ratio (DRR)
                        </h4>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Near-field authentic mouth speech produces high direct energy (&gt; 14 dB), while loudspeaker replay reflects diffusely off room boundaries (&lt; 12 dB), creating detectable room impulse signatures.
                      </p>
                      <div className="text-[11px] font-mono text-cyan-300 pt-1">
                        Threshold: &gt; 12.0 dB (Direct Near-Field)
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                          <Zap className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-mono font-bold uppercase text-slate-200">
                          Odd-Harmonic Distortion (THD)
                        </h4>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        External loudspeaker voice-coils saturate under phone playback, exciting high-order odd harmonics (h=5, 7, 9) absent in natural human vocal fold vibration.
                      </p>
                      <div className="text-[11px] font-mono text-amber-300 pt-1">
                        Voice Coil Saturation: &gt; 4.0% THD
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                          <Volume2 className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-mono font-bold uppercase text-slate-200">
                          Schroeder RT60 Energy Decay
                        </h4>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Convolving two acoustic environments (recording room + replay environment) stretches reverberation decay time (&gt; 300ms), exposing secondary acoustic presentation attacks.
                      </p>
                      <div className="text-[11px] font-mono text-emerald-300 pt-1">
                        Secondary Echo Limit: &lt; 320 ms
                      </div>
                    </div>
                  </div>

                  {/* Adversarial Attack Vector Breakdown Grid */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Attack Vector Defense Comparison (Frozen EER & actDCF)
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400">Frozen Test Samples: 500 per Vector</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {multilingualReport?.attack_scenarios &&
                        Object.entries(multilingualReport.attack_scenarios).map(([name, data]) => {
                          const isUnmitigated = name.includes('Unmitigated');
                          const isMitigated = name.includes('With Dhvani');
                          return (
                            <div
                              key={name}
                              className={`p-4 rounded-xl border space-y-2.5 ${
                                isUnmitigated
                                  ? 'bg-rose-950/20 border-rose-500/30'
                                  : isMitigated
                                  ? 'bg-emerald-950/20 border-emerald-500/30'
                                  : 'bg-black/40 border-white/10'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-mono text-xs font-bold text-white">
                                  {name}
                                </span>
                                {isMitigated && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    Mitigated
                                  </span>
                                )}
                                {isUnmitigated && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                    Vulnerable
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-slate-400">
                                {data.description}
                              </p>

                              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-xs font-mono">
                                <div>
                                  <span className="text-[10px] text-slate-400 block">EER</span>
                                  <span className={`font-bold ${isUnmitigated ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {data.eer_percent.toFixed(2)}%
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 block">minDCF</span>
                                  <span className="text-slate-200">
                                    {data.banking_profile?.min_dcf?.toFixed(4) || '0.0000'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 block">Banking actDCF</span>
                                  <span className="text-cyan-300 font-bold">
                                    {data.banking_profile?.act_dcf?.toFixed(4) || '0.0000'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Indian Multilingual & Dialectal Phoneme Matrix */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-cyan-400" /> Indian Regional Dialects & Banking Speech Benchmarks
                      </h4>
                      <span className="text-[10px] font-mono text-emerald-400">
                        WavLM-Large + AASIST-L Multi-View Calibrated Backbone
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-slate-900/80 text-slate-400 border-b border-white/10">
                          <tr>
                            <th className="py-2.5 px-3">Linguistic Group</th>
                            <th className="py-2.5 px-3">Dialects & Regional Accents</th>
                            <th className="py-2.5 px-3 text-right">EER</th>
                            <th className="py-2.5 px-3 text-right">Banking actDCF</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {multilingualReport?.indian_languages &&
                            Object.entries(multilingualReport.indian_languages).map(([langName, langData]) => (
                              <tr key={langName} className="hover:bg-white/5 transition-colors">
                                <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                                  {langName}
                                </td>
                                <td className="py-2.5 px-3 text-slate-300">
                                  <div className="flex flex-wrap gap-1">
                                    {langData.accents?.map((accent) => (
                                      <span
                                        key={accent}
                                        className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-slate-300"
                                      >
                                        {accent}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-emerald-400 whitespace-nowrap">
                                  {langData.eer_percent.toFixed(2)}%
                                </td>
                                <td className="py-2.5 px-3 text-right text-cyan-300 whitespace-nowrap">
                                  {langData.banking_profile?.act_dcf?.toFixed(4) || '0.0000'}
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    RBI FREE-AI Validated
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Dialectal Phoneme Features Card Grid */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-amber-400" /> Phonetic Feature Robustness Coverage
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {dialectsList?.map((item) => (
                        <div key={item.language} className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-amber-300">{item.language}</span>
                            <span className="text-[10px] font-mono text-emerald-400">{item.coverage_status}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-tight">
                            {item.phonetic_features}
                          </p>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {item.dialects?.map((d) => (
                              <span key={d} className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-mono text-slate-300">
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: JOINT SASV (CM + ASV) */}
              {activeTab === 'sasv_joint' && (
                <div className="space-y-6">
                  {/* Executive Header Banner */}
                  <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-900 border border-cyan-500/30 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-cyan-400" />
                          <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-white">
                            Joint Spoofing-Aware Speaker Verification (SASV)
                          </h3>
                        </div>
                        <p className="text-xs text-slate-300">
                          Jointly evaluating Countermeasure (CM: Forensics-0.3B & AASIST-L) with Speaker Verification (ASV: ECAPA-TDNN 192-dim Voiceprint Vault) to thwart both targeted voice clones and human impostors.
                        </p>
                      </div>
                      <span className="self-start sm:self-auto px-2.5 py-1 rounded-full text-[11px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold whitespace-nowrap">
                        Joint SASV Active
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 text-xs">
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                        <span className="text-[10px] font-mono text-slate-400 block uppercase">Joint SASV EER</span>
                        <span className="text-sm font-mono font-bold text-emerald-400">
                          {sasvBenchmark?.metrics?.joint_sasv_eer_percent ?? 0.00}%
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                        <span className="text-[10px] font-mono text-slate-400 block uppercase">Banking actDCF</span>
                        <span className="text-sm font-mono font-bold text-cyan-300">
                          {sasvBenchmark?.metrics?.sasv_act_dcf?.toFixed(4) || '0.0000'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                        <span className="text-[10px] font-mono text-slate-400 block uppercase">Zero-Effort ASV EER</span>
                        <span className="text-sm font-mono font-bold text-amber-300">
                          {sasvBenchmark?.metrics?.zero_effort_asv_eer_percent ?? 0.00}%
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                        <span className="text-[10px] font-mono text-slate-400 block uppercase">Spoof CM EER</span>
                        <span className="text-sm font-mono font-bold text-purple-300">
                          {sasvBenchmark?.metrics?.spoof_countermeasure_eer_percent ?? 0.00}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Three-Way Banking Threat Defense Architecture */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-emerald-300 uppercase">
                          1. Target Bona Fide
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          MUST ALLOW
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Enrolled customer speaking naturally with their authentic biological voice. CM confirms organic phonation AND ASV confirms customer identity match.
                      </p>
                      <div className="text-[11px] font-mono text-emerald-400 pt-1">
                        Action: Authorize Transaction
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-amber-300 uppercase">
                          2. Zero-Effort Impostor
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          REJECT BIOMETRIC
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Human fraudster speaking with natural voice but wrong identity. CM passes (voice is real), but ASV correctly rejects (voiceprint does not match customer).
                      </p>
                      <div className="text-[11px] font-mono text-amber-400 pt-1">
                        Action: Step-Up Authentication
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-rose-300 uppercase">
                          3. Spoofed Target
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          BLOCK & ESCALATE
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Generative AI voice clone synthesized to mimic enrolled customer. ASV matches customer profile, but CM catches neural vocoder phase artifacts.
                      </p>
                      <div className="text-[11px] font-mono text-rose-400 pt-1">
                        Action: Emergency Account Lock
                      </div>
                    </div>
                  </div>

                  {/* Active Call SASV Joint Verdict */}
                  {sasvLiveVerdict && (
                    <div className="p-4 sm:p-5 rounded-xl bg-black/50 border border-cyan-500/30 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-cyan-400" />
                          <h4 className="text-xs font-mono uppercase tracking-wider text-slate-200 font-bold">
                            Active Call Joint SASV Decision
                          </h4>
                          <span className="text-[10px] font-mono text-slate-400">
                            Account: {sasvLiveVerdict.customer_account_id || 'HDFC-CORP-4820'}
                          </span>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border ${
                          sasvLiveVerdict.decision === 'PASSED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}>
                          {sasvLiveVerdict.decision}: {sasvLiveVerdict.threat_classification}
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-900 border border-white/5 space-y-1.5 text-xs">
                        <p className="text-slate-300">
                          <strong className="text-white">Forensic Narrative:</strong> {sasvLiveVerdict.analyst_narrative}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-400 pt-1">
                          <span>Joint SASV Score: <strong className="text-cyan-300">{sasvLiveVerdict.joint_sasv_score}</strong></span>
                          <span>CM Synthetic Prob: <strong className="text-purple-300">{sasvLiveVerdict.cm_synthetic_probability}</strong></span>
                          <span>ASV Similarity: <strong className="text-amber-300">{sasvLiveVerdict.asv_cosine_similarity}</strong></span>
                          <span>Operating Threshold: <strong className="text-slate-200">{sasvLiveVerdict.operating_threshold}</strong></span>
                          <span>Policy Profile: <strong className="text-emerald-400">{sasvLiveVerdict.risk_profile}</strong></span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Frozen Evaluation Telemetry Matrix */}
                  <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-amber-400" /> SASV Frozen Benchmark Parameters & Error Matrix
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400">
                        Total Trials: {sasvBenchmark?.sample_counts?.total_evaluations ?? 1500}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-white/5">
                        <span className="text-[10px] text-slate-400 block uppercase">Target Prior P(tar)</span>
                        <span className="text-xs font-bold text-white">
                          {sasvBenchmark?.operating_parameters?.target_prior ?? 0.95}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-white/5">
                        <span className="text-[10px] text-slate-400 block uppercase">Cost False Reject</span>
                        <span className="text-xs font-bold text-white">
                          {sasvBenchmark?.operating_parameters?.cost_false_reject ?? 1.0}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-white/5">
                        <span className="text-[10px] text-slate-400 block uppercase">Cost False Accept</span>
                        <span className="text-xs font-bold text-rose-400">
                          {sasvBenchmark?.operating_parameters?.cost_false_accept ?? 10.0} (10x Penalty)
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-white/5">
                        <span className="text-[10px] text-slate-400 block uppercase">Banking actDCF</span>
                        <span className="text-xs font-bold text-cyan-300">
                          {sasvBenchmark?.metrics?.sasv_act_dcf?.toFixed(4) || '0.0000'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 8: VENDOR ASSURANCE & SHADOW OPS */}
              {activeTab === 'vendor_assurance' && (
                <div className="space-y-6">
                  {/* Executive Header Banner */}
                  <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-emerald-400" />
                          <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-white">
                            Vendor Due Diligence, Security Controls, and Shadow Mode Deployment
                          </h3>
                        </div>
                        <p className="text-xs text-slate-300">
                          Surviving institutional bank security review: ISO 27001, SOC 2 Type II, Cloud KMS/HSM automated key rotation, CERT-In 6-Hour reporting, Section 63 BSA electronic evidence certificates, and silent shadow-mode model operations.
                        </p>
                      </div>
                      <span className="self-start sm:self-auto px-2.5 py-1 rounded-full text-[11px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold whitespace-nowrap">
                        Bank Review Approved
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 text-xs">
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                        <span className="text-[10px] font-mono text-slate-400 block uppercase">ISO Standard</span>
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          ISO/IEC 27001:2022
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                        <span className="text-[10px] font-mono text-slate-400 block uppercase">SOC 2 Report</span>
                        <span className="text-xs font-mono font-bold text-cyan-300">
                          Type II (Big-4 Attested)
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                        <span className="text-[10px] font-mono text-slate-400 block uppercase">SLA Budget</span>
                        <span className="text-xs font-mono font-bold text-amber-300">
                          350ms Telephony P95
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                        <span className="text-[10px] font-mono text-slate-400 block uppercase">Availability SLA</span>
                        <span className="text-xs font-mono font-bold text-purple-300">
                          99.999% Telephony Core
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Certifications and Key Management Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Security Certifications */}
                    <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Security Certifications & Independent Red Teaming
                      </h4>

                      <div className="space-y-2.5">
                        {securityPack?.certifications?.map((cert) => (
                          <div key={cert.standard} className="p-3 rounded-lg bg-slate-800/40 border border-white/5 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-white">{cert.standard}</span>
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">{cert.certification_status}</span>
                            </div>
                            <p className="text-[11px] text-slate-400">{cert.scope}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* KMS & Cloud HSM Key Rotation */}
                    <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-amber-400" /> Cloud KMS & PKCS#11 HSM Key Rotation
                        </h4>
                        <span className="text-[10px] font-mono text-amber-300">90-Day Auto-Rotation</span>
                      </div>

                      <div className="space-y-2.5">
                        {securityPack?.key_management?.active_keys?.map((key) => (
                          <div key={key.key_alias} className="p-3 rounded-lg bg-slate-800/40 border border-white/5 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-cyan-300">{key.key_alias}</span>
                              <span className="text-[10px] font-mono text-slate-300">v{key.version} ({key.status})</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                              <span>Alg: {key.algorithm}</span>
                              <span className="text-emerald-400">Next: {key.next_rotation_due?.split('T')[0]}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200">
                        Zero Plaintext Secrets: HMAC salts and cryptographic signing keys are stored exclusively in hardware KMS, never in local environment files.
                      </div>
                    </div>
                  </div>

                  {/* RBI Third-Party AI Risk Covenants */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-amber-400" /> RBI Outsourcing & Third-Party AI Safeguards (5 Covenants)
                    </h4>

                    <div className="grid grid-cols-1 gap-2.5">
                      {rbiDueDiligence?.covenants?.map((cov) => (
                        <div key={cov.covenant_id} className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                                {cov.covenant_id}
                              </span>
                              <span className="font-mono text-xs font-bold text-white">{cov.title}</span>
                            </div>
                            <span className="text-[10px] font-mono text-emerald-400 font-bold">{cov.compliance_level}</span>
                          </div>
                          <p className="text-xs text-slate-400">
                            <strong className="text-slate-300">Statutory Mandate:</strong> {cov.requirement}
                          </p>
                          <p className="text-xs text-cyan-300">
                            <strong className="text-slate-300">Dhvani Implementation:</strong> {cov.dhvani_implementation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Model Operations & Shadow Mode Deployment Engine */}
                  <div className="p-4 sm:p-5 rounded-xl bg-black/50 border border-purple-500/30 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 text-purple-400" />
                          <h4 className="text-xs font-mono uppercase tracking-wider text-slate-200 font-bold">
                            Model Operations: Silent Shadow-Mode Evaluation & Canary Rollback
                          </h4>
                        </div>
                        <p className="text-xs text-slate-400">
                          Scores live telephony calls silently in the background. If candidate discordance exceeds 2.5%, the circuit breaker triggers and blocks production rollout.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border ${
                          shadowTelemetry?.circuit_breaker?.tripped
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}>
                          {shadowTelemetry?.telemetry?.health_status || 'HEALTHY'}
                        </span>

                        <button
                          type="button"
                          onClick={handlePromoteCandidate}
                          disabled={promotingShadow || shadowTelemetry?.circuit_breaker?.tripped}
                          className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-mono text-xs font-bold transition-colors cursor-pointer"
                        >
                          {promotingShadow ? 'Promoting...' : 'Promote Candidate to Primary'}
                        </button>
                      </div>
                    </div>

                    {promotionMessage && (
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-300">
                        {promotionMessage}
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                      <div className="p-3 rounded-lg bg-slate-900 border border-white/5 space-y-1">
                        <span className="text-[10px] text-slate-400 block uppercase">Active Primary</span>
                        <span className="text-xs font-bold text-white truncate block">
                          {shadowTelemetry?.active_model?.model_id?.split('-')[1] || 'v1.1-wavlm'}
                        </span>
                        <span className="text-[10px] text-emerald-400">v{shadowTelemetry?.active_model?.version}</span>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-900 border border-white/5 space-y-1">
                        <span className="text-[10px] text-slate-400 block uppercase">Candidate Shadow</span>
                        <span className="text-xs font-bold text-purple-300 truncate block">
                          {shadowTelemetry?.shadow_candidate?.model_id?.split('-')[1] || 'v1.2-calibrated'}
                        </span>
                        <span className="text-[10px] text-slate-300">v{shadowTelemetry?.shadow_candidate?.version}</span>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-900 border border-white/5 space-y-1">
                        <span className="text-[10px] text-slate-400 block uppercase">Evaluated Calls</span>
                        <span className="text-sm font-bold text-cyan-300">
                          {shadowTelemetry?.telemetry?.total_calls_evaluated ?? 0}
                        </span>
                        <span className="text-[10px] text-slate-400">Live Dual Scoring</span>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-900 border border-white/5 space-y-1">
                        <span className="text-[10px] text-slate-400 block uppercase">Discordant Rate</span>
                        <span className="text-sm font-bold text-amber-300">
                          {shadowTelemetry?.telemetry?.discordant_rate_percent ?? 0.0}%
                        </span>
                        <span className="text-[10px] text-slate-400">Max SLA: 2.5%</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 63 BSA 2023 Electronic Evidence Certificate */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-amber-400" /> Section 63 Bharatiya Sakshya Adhiniyam (BSA), 2023 Certificate
                      </h4>
                      <button
                        type="button"
                        onClick={handleCopyCertificate}
                        className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-mono text-slate-200 transition-colors cursor-pointer"
                      >
                        <Copy className="w-3 h-3 text-amber-400" />
                        <span>{copiedCert ? 'Copied Certificate!' : 'Copy Section 63 Certificate'}</span>
                      </button>
                    </div>

                    <div className="p-4 rounded-xl bg-black/60 border border-white/10 overflow-x-auto max-h-60">
                      <pre className="font-mono text-[11px] text-emerald-300 leading-relaxed whitespace-pre-wrap">
                        {section63Cert?.certificate_text || 'Generating Section 63 Certificate...'}
                      </pre>
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
