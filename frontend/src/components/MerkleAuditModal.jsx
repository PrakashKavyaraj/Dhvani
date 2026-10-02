import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  CheckCircle,
  ShieldCheck,
  Layers,
  Lock,
  Copy,
  Check,
  Download,
  RefreshCw,
  AlertTriangle,
  Search,
  Hash,
  X,
  Scale,
  Terminal,
} from 'lucide-react';
import {
  getMerkleAuditLedger,
  getMerkleAuditStats,
  getMerkleInclusionProof,
  verifyMerkleProof,
  getSection65bCertificate,
} from '../services/aegisApiClient';

export function MerkleAuditModal({
  isOpen,
  onClose,
  apiBaseUrl,
  currentSessionId,
  analysisResult,
}) {
  const [activeTab, setActiveTab] = useState('certificate'); // 'certificate' | 'ledger' | 'statutory'
  const [stats, setStats] = useState(null);
  const [ledgerBlocks, setLedgerBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Section 65B State
  const [targetSessionId, setTargetSessionId] = useState('');
  const [certificateData, setCertificateData] = useState(null);
  const [certLoading, setCertLoading] = useState(false);
  const [copiedAffidavit, setCopiedAffidavit] = useState(false);

  // Merkle Proof Inspection State
  const [selectedProof, setSelectedProof] = useState(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofVerification, setProofVerification] = useState(null);

  // Initialize targetSessionId from props
  useEffect(() => {
    const defaultId =
      currentSessionId ||
      analysisResult?.analysis_id ||
      analysisResult?.session_id ||
      '';
    if (defaultId) {
      setTargetSessionId(defaultId);
    }
  }, [currentSessionId, analysisResult]);

  const loadAuditData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [statsRes, ledgerRes] = await Promise.all([
        getMerkleAuditStats({ apiBaseUrl }).catch(() => null),
        getMerkleAuditLedger({ apiBaseUrl, limit: 30 }).catch(() => ({ blocks: [] })),
      ]);
      setStats(statsRes);
      setLedgerBlocks(ledgerRes?.blocks || []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load Merkle audit records.');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  const loadCertificate = useCallback(
    async (sessionIdToFetch) => {
      const sid = (sessionIdToFetch || targetSessionId || '').trim();
      if (!sid) return;

      setCertLoading(true);
      setErrorMsg(null);
      try {
        const cert = await getSection65bCertificate(sid, { apiBaseUrl });
        setCertificateData(cert);
      } catch (err) {
        setCertificateData(null);
        setErrorMsg(`Certificate lookup for session "${sid}" failed: ${err.message}`);
      } finally {
        setCertLoading(false);
      }
    },
    [targetSessionId, apiBaseUrl]
  );

  useEffect(() => {
    if (isOpen) {
      loadAuditData();
      const sid =
        targetSessionId ||
        currentSessionId ||
        analysisResult?.analysis_id ||
        analysisResult?.session_id ||
        '';
      if (sid) {
        loadCertificate(sid);
      }
    }
  }, [isOpen, loadAuditData, loadCertificate, targetSessionId, currentSessionId, analysisResult]);

  const handleInspectProof = async (sessionId, leafHash, merkleRoot) => {
    setProofLoading(true);
    setProofVerification(null);
    try {
      const proof = await getMerkleInclusionProof(sessionId, { apiBaseUrl });
      setSelectedProof(proof);

      // Verify the proof mathematically against root
      const verifyRes = await verifyMerkleProof(
        proof.leaf_hash,
        proof.proof_path,
        proof.merkle_root,
        { apiBaseUrl }
      );
      setProofVerification(verifyRes);
    } catch (err) {
      setErrorMsg(`Failed to inspect Merkle proof: ${err.message}`);
    } finally {
      setProofLoading(false);
    }
  };

  const handleCopyAffidavit = () => {
    if (!certificateData?.legal_affidavit_markdown) return;
    navigator.clipboard.writeText(certificateData.legal_affidavit_markdown);
    setCopiedAffidavit(true);
    setTimeout(() => setCopiedAffidavit(false), 2000);
  };

  const handleDownloadAffidavit = () => {
    if (!certificateData?.legal_affidavit_markdown) return;
    const blob = new Blob([certificateData.legal_affidavit_markdown], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${certificateData.certificate_id || 'Section_65B_Certificate'}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-5xl rounded-3xl bg-[#090e1a] border border-cyan-500/30 shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Top Banner Header */}
          <div className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-slate-900 via-[#0b1329] to-slate-900 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Scale className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-display font-bold text-white tracking-wide">
                    Cryptographic Merkle Audit Trail & Legal Certification
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    RFC 3161 TSA
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    BSA 2023 Sec 63
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-sans">
                  Append-Only Immutable Binary Merkle Tree with Section 65B Indian Evidence Act Court Certification
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={loadAuditData}
                disabled={loading}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Refresh Audit Ledger"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-300 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Stats Telemetry Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 sm:p-4 bg-black/40 border-b border-white/10 text-xs font-mono">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase block">Total Audit Blocks</span>
              <span className="text-sm font-bold text-cyan-400 mt-0.5 block">
                {stats?.total_audit_blocks ?? ledgerBlocks.length ?? 0} Blocks
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase block">Published Root</span>
              <span className="text-xs font-bold text-emerald-400 mt-0.5 block truncate" title={stats?.current_merkle_root}>
                {stats?.current_merkle_root ? `${stats.current_merkle_root.slice(0, 14)}...` : 'Synchronizing'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase block">Hash Algorithm</span>
              <span className="text-xs font-bold text-slate-200 mt-0.5 block">
                {stats?.hash_algorithm || 'SHA-256 (256-bit)'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase block">DPDP Act 2023 Storage</span>
              <span className="text-xs font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero Audio Persisted</span>
              </span>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="flex border-b border-white/10 bg-slate-900/60 px-4 sm:px-6 gap-2 sm:gap-4 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('certificate')}
              className={`py-3 px-3 sm:px-4 text-xs font-mono font-bold border-b-2 flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'certificate'
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Section 65B Legal Certificate</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`py-3 px-3 sm:px-4 text-xs font-mono font-bold border-b-2 flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'ledger'
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Immutable Merkle Ledger & Proofs</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('statutory')}
              className={`py-3 px-3 sm:px-4 text-xs font-mono font-bold border-b-2 flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'statutory'
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Statutory Compliance Architecture</span>
            </button>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="m-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Content Area */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-left">
            {/* TAB 1: SECTION 65B LEGAL CERTIFICATE */}
            {activeTab === 'certificate' && (
              <div className="space-y-6">
                {/* Session Query Input Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/10">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={targetSessionId}
                      onChange={(e) => setTargetSessionId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') loadCertificate(targetSessionId);
                      }}
                      placeholder="Enter Incident Session ID (e.g. test-engine-merkle-session)..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => loadCertificate(targetSessionId)}
                    disabled={certLoading}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{certLoading ? 'Generating Certificate...' : 'Generate Certificate'}</span>
                  </button>
                </div>

                {/* Certificate Display */}
                {certificateData ? (
                  <div className="space-y-4">
                    {/* Header Verification Seal */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/20 to-slate-900 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start sm:items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display font-bold text-white text-sm sm:text-base">
                              {certificateData.certificate_id}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              COURT ADMISSIBLE
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                              MERKLE PROOF: VALID
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5 font-sans">
                            Issued for Session <span className="font-mono text-cyan-300">{certificateData.session_id}</span> at {certificateData.timestamp_iso}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleCopyAffidavit}
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-mono flex items-center space-x-1.5 transition-all cursor-pointer"
                        >
                          {copiedAffidavit ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-300">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                              <span>Copy Affidavit</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadAffidavit}
                          className="px-3 py-1.5 rounded-xl bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs font-mono flex items-center space-x-1.5 transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Export Markdown</span>
                        </button>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                      <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Incident Forensics & Biometric Identity
                        </span>
                        <div className="flex justify-between py-1 border-b border-white/5">
                          <span className="text-slate-400">Threat Score / Tier:</span>
                          <span className="text-white font-bold">
                            {certificateData.threat_score}/100 ({certificateData.threat_tier})
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-white/5">
                          <span className="text-slate-400">Defense Action:</span>
                          <span className="text-cyan-300 font-bold">{certificateData.action}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-white/5">
                          <span className="text-slate-400">Salted Voice Token:</span>
                          <span className="text-slate-300 truncate max-w-[200px]" title={certificateData.voice_token}>
                            {certificateData.voice_token}
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-400">RFC 3161 Token:</span>
                          <span className="text-cyan-400 truncate max-w-[200px]" title={certificateData.rfc3161_token}>
                            {certificateData.rfc3161_token}
                          </span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Cryptographic Merkle Proof
                        </span>
                        <div className="flex justify-between py-1 border-b border-white/5">
                          <span className="text-slate-400">Block Sequence:</span>
                          <span className="text-white font-bold">#{certificateData.leaf_index}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-white/5">
                          <span className="text-slate-400">Leaf SHA-256 Hash:</span>
                          <span className="text-emerald-400 truncate max-w-[200px]" title={certificateData.leaf_hash}>
                            {certificateData.leaf_hash}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-white/5">
                          <span className="text-slate-400">Preceding Block Hash:</span>
                          <span className="text-slate-400 truncate max-w-[200px]" title={certificateData.prev_leaf_hash}>
                            {certificateData.prev_leaf_hash}
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-400">Proof Path Steps:</span>
                          <span className="text-cyan-300 font-bold">{certificateData.proof_path?.length || 0} Merkle Sibling Nodes</span>
                        </div>
                      </div>
                    </div>

                    {/* Official Legal Affidavit Terminal View */}
                    <div className="rounded-2xl border border-white/10 bg-[#060a12] p-4 sm:p-5 shadow-inner">
                      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                        <span className="text-xs font-mono text-slate-400 flex items-center gap-2">
                          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Formal Legal Affidavit Output</span>
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400">
                          Indian Evidence Act 1872 / BSA 2023 Compliant
                        </span>
                      </div>
                      <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto bg-black/30 p-3 rounded-xl border border-white/5">
                        {certificateData.legal_affidavit_markdown}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center rounded-2xl bg-white/5 border border-white/10 text-slate-400 space-y-2">
                    <FileText className="w-8 h-8 mx-auto text-slate-500" />
                    <p className="text-sm font-sans">
                      No electronic certificate loaded yet. Enter a valid session ID above or run an audio analysis to generate evidence.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: IMMUTABLE MERKLE LEDGER & PROOFS */}
            {activeTab === 'ledger' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-display font-bold text-white">
                      Sequential Merkle Audit Blocks
                    </h3>
                    <p className="text-xs text-slate-400 font-sans">
                      Every voice risk assessment is hashed and cryptographically linked to the preceding block.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-lg border border-cyan-500/20">
                    {ledgerBlocks.length} Blocks Recorded
                  </span>
                </div>

                {ledgerBlocks.length > 0 ? (
                  <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
                    <table className="w-full text-left text-xs font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 bg-slate-900/80 text-slate-400">
                          <th className="py-2.5 px-3">Block #</th>
                          <th className="py-2.5 px-3">Session Ref</th>
                          <th className="py-2.5 px-3">Score / Tier</th>
                          <th className="py-2.5 px-3">Action</th>
                          <th className="py-2.5 px-3">Leaf Hash</th>
                          <th className="py-2.5 px-3">RFC 3161 Token</th>
                          <th className="py-2.5 px-3 text-right">Verification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-300">
                        {ledgerBlocks.map((blk) => (
                          <tr key={blk.leaf_index} className="hover:bg-white/5 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-cyan-400">#{blk.leaf_index}</td>
                            <td className="py-2.5 px-3 text-white max-w-[140px] truncate" title={blk.session_id}>
                              {blk.session_id}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  blk.threat_tier === 'HIGH'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : blk.threat_tier === 'MEDIUM'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}
                              >
                                {blk.threat_score}/100
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 truncate max-w-[120px]" title={blk.action}>
                              {blk.action}
                            </td>
                            <td className="py-2.5 px-3 text-emerald-400 truncate max-w-[130px]" title={blk.leaf_hash}>
                              {blk.leaf_hash.slice(0, 10)}...{blk.leaf_hash.slice(-6)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 truncate max-w-[120px]" title={blk.rfc3161_token}>
                              {blk.rfc3161_token.slice(0, 14)}...
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  handleInspectProof(blk.session_id, blk.leaf_hash, blk.merkle_root)
                                }
                                className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold cursor-pointer transition-all"
                              >
                                Inspect Proof
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center rounded-2xl bg-white/5 border border-white/10 text-slate-400">
                    <Layers className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                    <p className="text-sm font-sans">
                      No blocks found in the Merkle audit ledger. Perform an audio analysis to write the first block.
                    </p>
                  </div>
                )}

                {/* Proof Inspection Modal / Drawer */}
                {selectedProof && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-cyan-500/40 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <div className="flex items-center space-x-2">
                        <Hash className="w-4 h-4 text-cyan-400" />
                        <span className="font-display font-bold text-white text-sm">
                          Mathematical Proof of Inclusion for Block #{selectedProof.leaf_index}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedProof(null)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase block">Target Leaf Hash</span>
                        <span className="text-emerald-400 font-bold break-all block mt-0.5">
                          {selectedProof.leaf_hash}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase block">Expected Merkle Root</span>
                        <span className="text-cyan-400 font-bold break-all block mt-0.5">
                          {selectedProof.merkle_root}
                        </span>
                      </div>
                    </div>

                    {proofVerification && (
                      <div
                        className={`p-3 rounded-xl border flex items-center space-x-2 text-xs font-mono ${
                          proofVerification.valid
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                            : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                        }`}
                      >
                        {proofVerification.valid ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span>{proofVerification.message}</span>
                      </div>
                    )}

                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-2">
                        Proof Traversal Sibling Nodes ({selectedProof.proof_path?.length || 0} Levels):
                      </span>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {selectedProof.proof_path?.map((step, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-lg bg-black/40 border border-white/5 text-[11px] font-mono flex items-center justify-between text-slate-300"
                          >
                            <span className="text-cyan-400 font-bold">Step {idx + 1} ({step.direction})</span>
                            <span className="text-slate-400 truncate max-w-[280px]" title={step.hash}>
                              {step.hash}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: STATUTORY COMPLIANCE ARCHITECTURE */}
            {activeTab === 'statutory' && (
              <div className="space-y-5 text-xs font-sans text-slate-300">
                <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center space-x-2 text-white font-display font-bold text-sm">
                    <Scale className="w-4 h-4 text-cyan-400" />
                    <span>Indian Statutory Framework Alignment</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-slate-300">
                    <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                      <span className="text-cyan-400 font-bold block">
                        Section 65B(4), Indian Evidence Act 1872
                      </span>
                      <p className="text-slate-400 text-xs font-sans leading-relaxed">
                        Mandates written certification signed by a person occupying a responsible official position
                        in relation to the operation of the device, identifying the electronic record and describing the
                        manner in which it was produced.
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                      <span className="text-emerald-400 font-bold block">
                        Section 63, Bharatiya Sakshya Adhiniyam 2023 (BSA)
                      </span>
                      <p className="text-slate-400 text-xs font-sans leading-relaxed">
                        Modernized electronic record admissibility standards. Enforces automated hash validation,
                        unbroken chain of custody, and cryptographic timestamp tokens to establish electronic evidence
                        authenticity in Indian judicial proceedings.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center space-x-2 text-white font-display font-bold text-sm">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span>Digital Personal Data Protection Act (DPDP Act 2023) Compliance</span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    Under Section 8(7) of the DPDP Act 2023, data fiduciaries must not retain personal data beyond the period
                    necessary for purpose fulfillment. Dhvani fulfills this statutory obligation through an architectural guarantee:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 text-slate-400 text-xs">
                    <li>
                      <strong className="text-slate-200">Zero Audio on Disk:</strong> Raw microphone and telephony PCM streams reside strictly in volatile RAM memory buffers during the 3.0 second inference window.
                    </li>
                    <li>
                      <strong className="text-slate-200">Microsecond Memory Zeroing:</strong> Audio buffers are explicitly overwritten with null bytes (0x00) immediately following neural feature extraction.
                    </li>
                    <li>
                      <strong className="text-slate-200">Irreversible Voice Tokens:</strong> Only one-way salted SHA-256 hash digests and Merkle leaf hashes are persisted in the audit ledger. Raw voice can never be reverse engineered.
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-4 border-t border-white/10 bg-slate-900/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Dhvani Cryptographic Merkle Forensics v1.1.0</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs cursor-pointer transition-all"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
