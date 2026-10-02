import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Scale,
  Building,
  ShieldAlert,
  Copy,
  Download,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  Hash,
  Send,
  Lock,
} from 'lucide-react';
import { generateFIRDocket, fetchStatutoryGuidelines } from '../services/aegisApiClient';

export function CyberCrimeDocketModal({
  isOpen,
  onClose,
  analysisResult,
  apiBaseUrl,
}) {
  const [activeTab, setActiveTab] = useState('POLICE_FIR'); // 'POLICE_FIR', 'RBI_CFR', 'STATUTORY_MATRIX', 'EVIDENCE_HASHES'
  const [docket, setDocket] = useState(null);
  const [guidelines, setGuidelines] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Form customizer state
  const [bankName, setBankName] = useState('State Bank of India (Priority Banking)');
  const [branchCode, setBranchCode] = useState('SBI-MUM-004');
  const [nodalOfficer, setNodalOfficer] = useState('Venkatesh Ramanathan');
  const [nodalTitle, setNodalTitle] = useState('Chief Information Security Officer (CISO)');
  const [callerAni, setCallerAni] = useState('+91-98201-XXXXX');
  const [claimedAccount, setClaimedAccount] = useState('SBI-PRIORITY-9104');
  const [attemptedAmount, setAttemptedAmount] = useState(1850000);

  useEffect(() => {
    if (isOpen) {
      loadDocketAndGuidelines();
    }
  }, [isOpen]);

  const loadDocketAndGuidelines = async () => {
    setLoading(true);
    try {
      const gRes = await fetchStatutoryGuidelines({ apiBaseUrl });
      setGuidelines(gRes.legislation_references || []);

      const payload = {
        analysis_result: analysisResult || {
          analysis_id: 'SBI-DEMO-ATTACK-01',
          synthetic_speech_probability: 0.94,
          risk_score: 93,
        },
        bank_name: bankName,
        branch_code: branchCode,
        nodal_officer_name: nodalOfficer,
        nodal_officer_title: nodalTitle,
        caller_ani: callerAni,
        claimed_account_id: claimedAccount,
        attempted_amount_inr: Number(attemptedAmount),
      };

      const dRes = await generateFIRDocket(payload, { apiBaseUrl });
      setDocket(dRes);
    } catch (err) {
      console.error('Failed to generate FIR docket:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyNarrative = () => {
    if (!docket?.police_fir_complaint_text) return;
    navigator.clipboard?.writeText(docket.police_fir_complaint_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadTxt = () => {
    if (!docket?.police_fir_complaint_text) return;
    const blob = new Blob([docket.police_fir_complaint_text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FIR_COMPLAINT_${docket.docket_id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    if (!docket) return;
    const blob = new Blob([JSON.stringify(docket, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `REGULATORY_EVIDENCE_DOCKET_${docket.docket_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <Scale className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Cyber Crime FIR & Regulatory Evidence Docket Generator
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  Section 66D IT Act / BNS 318-319
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automated legal evidence packet for National Cyber Crime Reporting Portal (I4C) & RBI Central Fraud Registry (CFR)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Status & Reference Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-3 bg-slate-950/40 border-b border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block font-mono">DOCKET REFERENCE</span>
            <span className="font-semibold text-rose-300 font-mono">{docket?.docket_id || 'Generating...'}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-mono">FINANCIAL LOSS AVERTED</span>
            <span className="font-semibold text-emerald-400">₹{(docket?.averted_amount_inr || attemptedAmount).toLocaleString('en-IN')}.00</span>
          </div>
          <div>
            <span className="text-slate-400 block font-mono">EVIDENTIARY CERTIFICATION</span>
            <span className="font-semibold text-slate-200">Sec 63 BSA 2023 / Sec 65B</span>
          </div>
          <div>
            <span className="text-slate-400 block font-mono">DPDP ACT PRIVACY SEAL</span>
            <span className="font-semibold text-emerald-400">Sec 8(7) Compliant Purge</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-800 bg-slate-900/50 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('POLICE_FIR')}
            className={`flex items-center gap-1.5 px-4 py-2 border-b-2 font-semibold transition-all ${
              activeTab === 'POLICE_FIR'
                ? 'border-rose-500 text-rose-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Police FIR Complaint Letter
          </button>
          <button
            onClick={() => setActiveTab('RBI_CFR')}
            className={`flex items-center gap-1.5 px-4 py-2 border-b-2 font-semibold transition-all ${
              activeTab === 'RBI_CFR'
                ? 'border-cyan-500 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            RBI Central Fraud Registry (CFR) Schedule
          </button>
          <button
            onClick={() => setActiveTab('STATUTORY_MATRIX')}
            className={`flex items-center gap-1.5 px-4 py-2 border-b-2 font-semibold transition-all ${
              activeTab === 'STATUTORY_MATRIX'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            Statutory Legal Framework
          </button>
          <button
            onClick={() => setActiveTab('EVIDENCE_HASHES')}
            className={`flex items-center gap-1.5 px-4 py-2 border-b-2 font-semibold transition-all ${
              activeTab === 'EVIDENCE_HASHES'
                ? 'border-emerald-500 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            Forensic Integrity Proofs
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'POLICE_FIR' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Ready-to-file formal complaint addressed to Cyber Crime Police Station & Superintendent of Police
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyNarrative}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors"
                  >
                    {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied to Clipboard!' : 'Copy FIR Text'}
                  </button>
                  <button
                    onClick={handleDownloadTxt}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download .TXT
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 font-mono text-xs text-slate-200 border border-slate-800 leading-relaxed whitespace-pre-wrap max-h-[420px] overflow-y-auto select-all">
                {docket?.police_fir_complaint_text}
              </div>
            </div>
          )}

          {activeTab === 'RBI_CFR' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Master Directions on Frauds (Circular RBI/DBS/DIR.BC.No.1/13.01.001/2016-17) reporting fields
                </span>
                <button
                  onClick={handleDownloadJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download CFR JSON
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 block font-mono text-[10px]">CFR FORMAT VERSION</span>
                    <span className="font-bold text-white">{docket?.rbi_cfr_schedule?.rbi_cfr_format_version}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-mono text-[10px]">FRAUD CLASSIFICATION</span>
                    <span className="font-bold text-amber-300">{docket?.rbi_cfr_schedule?.fraud_classification}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-mono text-[10px]">REPORTING BANK / BRANCH</span>
                    <span className="font-semibold text-slate-200">
                      {docket?.rbi_cfr_schedule?.reporting_bank_name} ({docket?.rbi_cfr_schedule?.bank_branch_identifier})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-mono text-[10px]">STATUTORY CATEGORY</span>
                    <span className="font-semibold text-slate-200">{docket?.rbi_cfr_schedule?.statutory_category}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-mono text-[10px]">LOSS AVERTED (INR)</span>
                    <span className="font-bold text-emerald-400 text-sm">
                      ₹{docket?.rbi_cfr_schedule?.loss_averted_inr?.toLocaleString('en-IN')}.00
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-mono text-[10px]">LOSS INCURRED (INR)</span>
                    <span className="font-bold text-slate-300">₹0.00 (Zero Loss)</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800">
                  <span className="text-slate-400 block font-mono text-[10px] mb-1">MODUS OPERANDI</span>
                  <p className="text-slate-300 text-xs leading-relaxed bg-slate-900 p-3 rounded-lg border border-slate-800">
                    {docket?.rbi_cfr_schedule?.modus_operandi}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'STATUTORY_MATRIX' && (
            <div className="space-y-3">
              <span className="text-xs text-slate-400 block">
                Statutory penal and evidentiary provisions under Indian law for AI voice cloning and financial personation
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(guidelines || []).map((ref, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{ref.act}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        {ref.section}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-300">{ref.title}</div>
                    <p className="text-[11px] text-slate-400">
                      <strong>Legal Sanction / Mandate:</strong> {ref.punishment}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'EVIDENCE_HASHES' && (
            <div className="space-y-4">
              <span className="text-xs text-slate-400 block">
                Cryptographic forensic proofs compliant with Section 63 Bharatiya Sakshya Adhiniyam, 2023
              </span>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">EPHEMERAL AUDIO SHA-256 DIGEST</span>
                  <span className="text-cyan-300 break-all">{docket?.forensic_integrity?.audio_sha256_digest}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">MERKLE AUDIT TREE ROOT HASH</span>
                  <span className="text-purple-300 break-all">{docket?.forensic_integrity?.merkle_root}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">ATTRIBUTED VOCODER</span>
                    <span className="text-rose-300 font-sans font-bold">{docket?.forensic_integrity?.vocoder_attributed}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">DPDP COMPLIANCE</span>
                    <span className="text-emerald-300 font-sans font-semibold">Zero Biometrics Persisted</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/80 text-xs">
          <div className="flex items-center gap-2">
            <a
              href="https://cybercrime.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <span>National Cyber Crime Portal</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            Close Docket
          </button>
        </div>
      </motion.div>
    </div>
  );
}
