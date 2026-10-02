import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  X,
  Search,
  ShieldCheck,
  ShieldAlert,
  Mic,
  MicOff,
  Upload,
  RefreshCw,
  Lock,
  Layers,
} from 'lucide-react';
import {
  fetchEnrolledVoiceprints,
  enrollVoiceprint,
  verifyVoiceprint,
  deleteVoiceprint,
  AegisVoiceRecorder,
} from '../services/aegisApiClient';

export function VoiceprintVaultModal({ isOpen, onClose, apiBaseUrl }) {
  const [tenantId, setTenantId] = useState('default');
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'enroll' | 'verify'

  // Enrollment state
  const [newCustId, setNewCustId] = useState('');
  const [newName, setNewName] = useState('');
  const [enrollFile, setEnrollFile] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Verification state
  const [verifyCustId, setVerifyCustId] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);

  const recorderRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    }
  }, [isOpen, tenantId]);

  const loadProfiles = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchEnrolledVoiceprints(tenantId, { apiBaseUrl });
      setProfiles(data.profiles || []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to fetch enrolled voiceprints');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRecord = async () => {
    if (recording) {
      setRecording(false);
      try {
        const { blob } = await recorderRef.current.stop();
        recorderRef.current = null;
        setRecordedBlob(blob);
        setStatusMsg('Microphone sample captured successfully.');
      } catch (err) {
        setErrorMsg(err.message || 'Audio capture failed');
      }
    } else {
      setErrorMsg(null);
      setStatusMsg(null);
      try {
        recorderRef.current = new AegisVoiceRecorder();
        await recorderRef.current.start();
        setRecording(true);
      } catch (err) {
        setErrorMsg('Microphone permission denied');
      }
    }
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    if (!newCustId.trim()) {
      setErrorMsg('Customer ID is required');
      return;
    }
    const audioPayload = enrollFile || recordedBlob;
    if (!audioPayload) {
      setErrorMsg('Please record speech or upload a WAV file');
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    setStatusMsg(null);

    try {
      const res = await enrollVoiceprint(
        audioPayload,
        newCustId.trim(),
        newName.trim() || undefined,
        tenantId,
        { apiBaseUrl }
      );
      setStatusMsg(`Successfully enrolled ${res.customer_id} in vault!`);
      setNewCustId('');
      setNewName('');
      setEnrollFile(null);
      setRecordedBlob(null);
      loadProfiles();
      setActiveTab('list');
    } catch (err) {
      setErrorMsg(err.message || 'Enrollment failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!verifyCustId.trim()) {
      setErrorMsg('Select or enter a Customer ID to verify');
      return;
    }
    const audioPayload = enrollFile || recordedBlob;
    if (!audioPayload) {
      setErrorMsg('Please record live speech or upload audio to compare');
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    setVerifyResult(null);

    try {
      const res = await verifyVoiceprint(audioPayload, verifyCustId.trim(), tenantId, { apiBaseUrl });
      setVerifyResult(res);
    } catch (err) {
      setErrorMsg(err.message || 'Verification error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (custId) => {
    if (!window.confirm(`DPDP Act Section 12 Right to Erasure:\nAre you sure you want to permanently erase the voice biometric profile for '${custId}'? This action is irreversible.`)) {
      return;
    }
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await deleteVoiceprint(custId, tenantId, { apiBaseUrl });
      setStatusMsg(`Permanently erased biometric vector for ${custId}`);
      loadProfiles();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to erase voiceprint');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredProfiles = profiles.filter((p) =>
    p.customer_id.toLowerCase().includes(search.toLowerCase()) ||
    (p.speaker_name && p.speaker_name.toLowerCase().includes(search.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-950 p-6 shadow-2xl shadow-cyan-950/50 flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  Voice Biometric Vault
                  <span className="px-2 py-0.5 text-xs font-mono rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    DPDP COMPLIANT
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Dynamic multi-tenant speaker embeddings & identity verification
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav Tabs & Tenant Selector */}
          <div className="flex items-center justify-between mt-4 pb-2 border-b border-slate-800 text-xs">
            <div className="flex space-x-2">
              <button
                onClick={() => { setActiveTab('list'); setVerifyResult(null); }}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${activeTab === 'list' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:bg-slate-900'}`}
              >
                Enrolled Profiles ({profiles.length})
              </button>
              <button
                onClick={() => { setActiveTab('enroll'); setVerifyResult(null); }}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${activeTab === 'enroll' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:bg-slate-900'}`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Enroll Customer
              </button>
              <button
                onClick={() => { setActiveTab('verify'); setVerifyResult(null); }}
                className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${activeTab === 'verify' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:bg-slate-900'}`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Verify Caller
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-mono">Tenant:</span>
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="default">default</option>
                <option value="bank-alpha">bank-alpha</option>
                <option value="fintech-beta">fintech-beta</option>
              </select>
            </div>
          </div>

          {/* Feedback Banners */}
          {statusMsg && (
            <div className="mt-3 p-2.5 text-xs rounded-lg border border-emerald-500/40 bg-emerald-950/30 text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{statusMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="mt-3 p-2.5 text-xs rounded-lg border border-red-500/40 bg-red-950/30 text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Tab 1: Profile List */}
          {activeTab === 'list' && (
            <div className="mt-4 flex-1 overflow-y-auto space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter by customer ID or name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 placeholder-slate-500"
                />
              </div>

              {loading ? (
                <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  Loading cryptographic vault records...
                </div>
              ) : filteredProfiles.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  No voice biometric profiles found in tenant <span className="font-mono text-cyan-400">'{tenantId}'</span>.
                  <br />Click "Enroll Customer" to register the first customer voiceprint.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProfiles.map((p) => (
                    <div
                      key={p.customer_id}
                      className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 transition flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-100 text-xs">{p.customer_id}</span>
                          {p.speaker_name && (
                            <span className="text-[11px] text-slate-400">({p.speaker_name})</span>
                          )}
                          <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-cyan-300">
                            {p.embedding_dim}-dim ECAPA
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Lock className="w-3 h-3 text-slate-400" />
                            Token: {p.voice_token ? `${p.voice_token.slice(0, 16)}...` : 'N/A'}
                          </span>
                          <span>•</span>
                          <span>Enrolled: {new Date(p.enrolled_at * 1000).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setVerifyCustId(p.customer_id);
                            setActiveTab('verify');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition"
                        >
                          Verify Caller
                        </button>
                        <button
                          onClick={() => handleDelete(p.customer_id)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-950/40 hover:text-red-300 transition"
                          title="DPDP Section 12 Right to Erasure"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Enroll Form */}
          {activeTab === 'enroll' && (
            <form onSubmit={handleEnroll} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Customer Identifier *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CUST-90214"
                    value={newCustId}
                    onChange={(e) => setNewCustId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Customer Full Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Priya Sharma"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Audio Input Options */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
                <span className="block text-slate-300 font-medium">Enrollment Audio Sample (at least 2s speech)</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleToggleRecord}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition ${
                      recording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    {recording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    {recording ? 'Stop Recording' : 'Record Live Microphone'}
                  </button>

                  <span className="text-slate-500">or</span>

                  <label className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer flex items-center gap-2 transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload WAV File</span>
                    <input
                      type="file"
                      accept=".wav"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setEnrollFile(e.target.files[0]);
                          setStatusMsg(`Selected file: ${e.target.files[0].name}`);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                {(recordedBlob || enrollFile) && (
                  <p className="text-emerald-400 text-[11px] flex items-center gap-1 font-mono">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Audio payload ready ({enrollFile ? enrollFile.name : 'Live mic recording'})
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={actionLoading || recording}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium transition disabled:opacity-50"
                >
                  {actionLoading ? 'Extracting Vector Embedding...' : 'Commit to Biometric Vault'}
                </button>
              </div>
            </form>
          )}

          {/* Tab 3: Verify Caller */}
          {activeTab === 'verify' && (
            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Customer ID to Verify</label>
                <input
                  type="text"
                  placeholder="Select from enrolled list or type ID..."
                  value={verifyCustId}
                  onChange={(e) => setVerifyCustId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
                <span className="block text-slate-300 font-medium">Caller Audio Stream</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleToggleRecord}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition ${
                      recording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    {recording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    {recording ? 'Stop Recording' : 'Record Live Caller Voice'}
                  </button>
                  <span className="text-slate-500">or</span>
                  <label className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer flex items-center gap-2 transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Caller WAV</span>
                    <input
                      type="file"
                      accept=".wav"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setEnrollFile(e.target.files[0]);
                          setStatusMsg(`Selected file: ${e.target.files[0].name}`);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={actionLoading || recording}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-medium transition disabled:opacity-50"
                >
                  {actionLoading ? 'Computing Cosine Distance...' : 'Verify Voiceprint Match'}
                </button>
              </div>

              {/* Verification Result Display */}
              {verifyResult && (
                <div className={`p-4 rounded-xl border ${verifyResult.match_verified ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-red-500/40 bg-red-950/20'} space-y-2`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {verifyResult.match_verified ? (
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <ShieldAlert className="w-5 h-5 text-red-400" />
                      )}
                      <span className="font-semibold text-slate-100">{verifyResult.status}</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-slate-200">
                      Similarity: {Math.round((verifyResult.similarity || 0) * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{verifyResult.reason}</p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
