import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Skull,
  Search,
  PlusCircle,
  Trash2,
  CheckCircle,
  AlertTriangle,
  X,
  ShieldAlert,
  ShieldCheck,
  Mic,
  MicOff,
  Upload,
  RefreshCw,
  Cpu,
  Layers,
  Database,
  Radio,
} from 'lucide-react';
import {
  fetchBlacklistEntries,
  fetchBlacklistStats,
  matchBlacklistVoiceprint,
  enrollBlacklistVoiceprint,
  deleteBlacklistEntry,
  AegisVoiceRecorder,
} from '../services/aegisApiClient';

export function FraudBlacklistModal({ isOpen, onClose, apiBaseUrl }) {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'match' | 'enroll'
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 1:N Match State
  const [matchFile, setMatchFile] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [threshold, setThreshold] = useState(0.72);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  // Enroll State
  const [newSyndicateId, setNewSyndicateId] = useState('');
  const [newSyndicateName, setNewSyndicateName] = useState('');
  const [newCategory, setNewCategory] = useState('DIGITAL_ARREST');
  const [newThreatLevel, setNewThreatLevel] = useState('CRITICAL');
  const [newNotes, setNewNotes] = useState('');

  const recorderRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [listData, statsData] = await Promise.all([
        fetchBlacklistEntries(50, 0, { apiBaseUrl }),
        fetchBlacklistStats({ apiBaseUrl }),
      ]);
      setEntries(listData.entries || []);
      setStats(statsData);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load blacklist database');
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
        setStatusMsg('Audio sample recorded for blacklist scan.');
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

  const handleMatch = async (e) => {
    e.preventDefault();
    const payload = matchFile || recordedBlob;
    if (!payload) {
      setErrorMsg('Please upload a WAV file or record audio first');
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    setMatchResult(null);

    try {
      const result = await matchBlacklistVoiceprint(payload, threshold, { apiBaseUrl });
      setMatchResult(result);
    } catch (err) {
      setErrorMsg(err.message || 'Blacklist vector search failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    const payload = matchFile || recordedBlob;
    if (!payload) {
      setErrorMsg('Please upload or record the suspect voiceprint');
      return;
    }
    if (!newSyndicateId.trim() || !newSyndicateName.trim()) {
      setErrorMsg('Syndicate ID and Syndicate Name are required');
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    try {
      await enrollBlacklistVoiceprint(
        payload,
        {
          syndicate_id: newSyndicateId.trim(),
          syndicate_name: newSyndicateName.trim(),
          fraud_category: newCategory,
          threat_level: newThreatLevel,
          notes: newNotes,
        },
        { apiBaseUrl }
      );
      setStatusMsg(`Successfully enrolled ${newSyndicateName} into HNSW Blacklist.`);
      setNewSyndicateId('');
      setNewSyndicateName('');
      setNewNotes('');
      setMatchFile(null);
      setRecordedBlob(null);
      await loadData();
      setActiveTab('list');
    } catch (err) {
      setErrorMsg(err.message || 'Enrollment failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (entryId, name) => {
    if (!window.confirm(`Deactivate blacklist voiceprint for "${name}"?`)) return;
    try {
      await deleteBlacklistEntry(entryId, { apiBaseUrl });
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to deactivate entry');
    }
  };

  if (!isOpen) return null;

  const filteredEntries = entries.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.syndicate_name?.toLowerCase().includes(q) ||
      r.syndicate_id?.toLowerCase().includes(q) ||
      r.fraud_category?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-4xl bg-[#080d1a] border border-rose-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Skull className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-display font-bold text-lg text-white">
                  1:N Fraudster Blacklist Search Vault
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  HNSW Sub-Millisecond
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  Pindrop Pulse Benchmark
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Multi-tenant repeat offender database scanning 192-dim ECAPA-TDNN embeddings in &lt; 2ms.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-black/20 px-6">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`py-3 px-4 text-xs font-mono font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'list'
                ? 'border-rose-400 text-rose-300 bg-rose-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Blacklisted Syndicates ({entries.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('match')}
            className={`py-3 px-4 text-xs font-mono font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'match'
                ? 'border-rose-400 text-rose-300 bg-rose-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>1:N Vector Search Scan</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('enroll')}
            className={`py-3 px-4 text-xs font-mono font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'enroll'
                ? 'border-rose-400 text-rose-300 bg-rose-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Enroll Suspect Voiceprint</span>
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}
        {statusMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: LIST */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by syndicate name, ID, or fraud category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadData}
                  disabled={loading}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-slate-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs font-mono text-slate-400">
                  Loading HNSW Blacklist index...
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="py-12 text-center text-xs font-mono text-slate-500">
                  No blacklisted fraudster voiceprints found.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredEntries.map((rec) => (
                    <div
                      key={rec.entry_id}
                      className="p-4 rounded-2xl bg-[#0c1222]/80 border border-white/10 hover:border-rose-500/30 transition-all space-y-2.5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold text-white text-sm">
                              {rec.syndicate_name}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-rose-400 mt-0.5">
                            {rec.syndicate_id}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                          {rec.threat_level}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-black/40 border border-white/5">
                          {rec.fraud_category}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-black/40 border border-white/5 text-amber-400">
                          {rec.incident_count} Incidents
                        </span>
                        <span className="px-2 py-0.5 rounded bg-black/40 border border-white/5 text-slate-400 truncate max-w-[120px]">
                          Token: {rec.voice_token.slice(0, 8)}...
                        </span>
                      </div>

                      {rec.notes && (
                        <p className="text-[11px] text-slate-400 font-sans line-clamp-2">
                          {rec.notes}
                        </p>
                      )}

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
                        <span className="text-slate-500">
                          Last Seen: {new Date(rec.last_seen_at * 1000).toLocaleDateString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(rec.entry_id, rec.syndicate_name)}
                          className="text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Deactivate</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: 1:N MATCH SCAN */}
          {activeTab === 'match' && (
            <div className="space-y-5">
              <form onSubmit={handleMatch} className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#0c1222]/80 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                      Input Live Caller Audio
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400">
                      Target SR: 16000 Hz WAV
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Record Button */}
                    <button
                      type="button"
                      onClick={handleToggleRecord}
                      className={`p-4 rounded-xl border flex flex-col items-center justify-center space-y-2 transition-all cursor-pointer ${
                        recording
                          ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                          : 'bg-black/40 border-white/10 hover:border-cyan-500/40 text-slate-300'
                      }`}
                    >
                      {recording ? <MicOff className="w-6 h-6 text-rose-400" /> : <Mic className="w-6 h-6 text-cyan-400" />}
                      <span className="text-xs font-mono font-bold">
                        {recording ? 'Stop Recording' : 'Record Caller Voice'}
                      </span>
                    </button>

                    {/* Upload Input */}
                    <label className="p-4 rounded-xl border border-white/10 bg-black/40 hover:border-cyan-500/40 flex flex-col items-center justify-center space-y-2 cursor-pointer transition-all">
                      <Upload className="w-6 h-6 text-slate-400" />
                      <span className="text-xs font-mono font-bold text-slate-300 truncate max-w-[200px]">
                        {matchFile ? matchFile.name : 'Upload WAV Audio'}
                      </span>
                      <input
                        type="file"
                        accept="audio/wav,audio/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) setMatchFile(e.target.files[0]);
                        }}
                      />
                    </label>
                  </div>

                  {/* Threshold Slider */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Cosine Match Threshold:</span>
                      <span className="text-rose-400 font-bold">{(threshold * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.50"
                      max="0.90"
                      step="0.01"
                      value={threshold}
                      onChange={(e) => setThreshold(parseFloat(e.target.value))}
                      className="w-full accent-rose-500 cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-3 rounded-xl font-mono font-bold text-xs bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Execute Sub-Millisecond 1:N HNSW Scan</span>
                </button>
              </form>

              {/* Match Result Display */}
              {matchResult && (
                <div className={`p-5 rounded-2xl border space-y-4 ${
                  matchResult.is_match
                    ? 'bg-rose-950/30 border-rose-500/50 shadow-lg shadow-rose-950/30'
                    : 'bg-emerald-950/20 border-emerald-500/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {matchResult.is_match ? (
                        <ShieldAlert className="w-5 h-5 text-rose-400" />
                      ) : (
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      )}
                      <h4 className="font-display font-bold text-sm text-white">
                        Scan Verdict: {matchResult.verdict.replace(/_/g, ' ')}
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      Search Latency: {matchResult.latency_ms} ms
                    </span>
                  </div>

                  {matchResult.matched_syndicate ? (
                    <div className="p-4 rounded-xl bg-black/40 border border-rose-500/30 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-rose-300 text-sm">
                            {matchResult.matched_syndicate.syndicate_name}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            ID: {matchResult.matched_syndicate.syndicate_id} • Category: {matchResult.matched_syndicate.fraud_category}
                          </div>
                        </div>
                        <span className="text-xl font-mono font-bold text-rose-400">
                          {(matchResult.similarity * 100).toFixed(1)}% match
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-sans">
                        {matchResult.matched_syndicate.notes}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-300 font-sans">
                      No repeat-offender voiceprints matched above the {(threshold * 100).toFixed(0)}% cosine threshold.
                    </p>
                  )}

                  {/* Nearest Candidates */}
                  {matchResult.candidates && matchResult.candidates.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-white/5">
                      <span className="text-[10px] font-mono text-slate-400">Top-3 Nearest Vector Neighbors:</span>
                      <div className="grid grid-cols-3 gap-2">
                        {matchResult.candidates.map((c, i) => (
                          <div key={i} className="p-2 rounded-lg bg-black/40 border border-white/5 text-[10px] font-mono">
                            <div className="text-slate-300 font-bold truncate">{c.entry_id}</div>
                            <div className="text-cyan-400">Sim: {(c.similarity * 100).toFixed(1)}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ENROLL */}
          {activeTab === 'enroll' && (
            <form onSubmit={handleEnroll} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Syndicate ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SYN-MUMBAI-ARREST-12"
                    value={newSyndicateId}
                    onChange={(e) => setNewSyndicateId(e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Syndicate Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Digital Arrest CBI Extortionists"
                    value={newSyndicateName}
                    onChange={(e) => setNewSyndicateName(e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Fraud Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="DIGITAL_ARREST">Digital Arrest Extortion</option>
                    <option value="CUSTOMS_FRAUD">FedEx Customs Narcotics</option>
                    <option value="EXECUTIVE_IMPERSONATION">Executive CEO Wire Clone</option>
                    <option value="KYC_PHISHING">KYC Account Takeover</option>
                    <option value="VIRTUAL_KIDNAPPING">Virtual Kidnapping Ransom</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Threat Level</label>
                  <select
                    value={newThreatLevel}
                    onChange={(e) => setNewThreatLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="ELEVATED">ELEVATED</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Case Investigation Notes</label>
                <textarea
                  rows={2}
                  placeholder="FIR numbers, law enforcement agency, attack modus operandi..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Audio Upload */}
              <div className="p-4 rounded-2xl bg-[#0c1222]/80 border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-bold">Suspect Audio Evidence *</span>
                  <span className="text-slate-400">16kHz WAV format</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleToggleRecord}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-mono cursor-pointer ${
                      recording ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-black/40 border-white/10 text-slate-300'
                    }`}
                  >
                    <Mic className="w-4 h-4 text-cyan-400" />
                    <span>{recording ? 'Stop Capture' : 'Record Sample'}</span>
                  </button>
                  <label className="p-3 rounded-xl border border-white/10 bg-black/40 hover:border-cyan-500/40 flex items-center justify-center gap-2 text-xs font-mono text-slate-300 cursor-pointer truncate">
                    <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{matchFile ? matchFile.name : 'Choose File'}</span>
                    <input
                      type="file"
                      accept="audio/wav,audio/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) setMatchFile(e.target.files[0]);
                      }}
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-3 rounded-xl font-mono font-bold text-xs bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                <span>Enroll into 1:N HNSW Vector Blacklist</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer Statistics */}
        <div className="p-4 border-t border-white/10 bg-black/40 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-400">
          <div className="flex items-center space-x-3">
            <span>Index: <strong className="text-cyan-400">{stats?.index_technology || 'HNSW'}</strong></span>
            <span>Dim: <strong className="text-slate-200">192-d</strong></span>
            <span>Total Voiceprints: <strong className="text-rose-400">{stats?.total_blacklisted_voiceprints ?? entries.length}</strong></span>
          </div>
          <div className="text-emerald-400 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>DPDP Act 2023 Compliant (Zero Raw Biometric Persistence)</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
