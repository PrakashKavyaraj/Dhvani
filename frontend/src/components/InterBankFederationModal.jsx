import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Building,
  ShieldAlert,
  ShieldCheck,
  Radio,
  Send,
  RotateCcw,
  CheckCircle,
  ExternalLink,
  Layers,
  Activity,
  Flame,
  Zap,
} from 'lucide-react';
import {
  fetchFederationStats,
  fetchFederationBulletins,
  broadcastFederationThreat,
} from '../services/aegisApiClient';

export function InterBankFederationModal({
  isOpen,
  onClose,
  analysisResult,
  apiBaseUrl,
}) {
  const [stats, setStats] = useState(null);
  const [bulletins, setBulletins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadFederationData();
    }
  }, [isOpen]);

  const loadFederationData = async () => {
    setLoading(true);
    try {
      const [sRes, bRes] = await Promise.all([
        fetchFederationStats({ apiBaseUrl }),
        fetchFederationBulletins({ apiBaseUrl }),
      ]);
      setStats(sRes);
      setBulletins(bRes.bulletins || []);
    } catch (err) {
      console.error('Failed to load federation data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBroadcastCurrentThreat = async () => {
    setBroadcasting(true);
    try {
      const payload = {
        originating_bank: 'SBI',
        syndicate_name: 'Jamtara RTGS Priority Impersonation Ring',
        attack_vector: 'HiFi-GAN Deepfake Clone with 890ms TTS Pipeline Hesitation',
        detected_vocoder: 'HiFi-GAN (ElevenLabs API Clone)',
        threat_level: 'CRITICAL',
        caller_ani_prefix: '+91-98201-XXXXX',
        attempted_amount_inr: 1850000.0,
      };

      const res = await broadcastFederationThreat(payload, { apiBaseUrl });
      setBroadcastSuccess(res);
      await loadFederationData();
    } catch (err) {
      console.error('Broadcast failed:', err);
      alert('Broadcast failed: ' + err.message);
    } finally {
      setBroadcasting(false);
    }
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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Globe className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Inter-Bank Fraud Syndicate Federation
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Federated Threat Exchange (FTX)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cross-institution collective defense: Anonymous voiceprint syndication, zero-knowledge DPDP proofs, and sub-5ms HNSW blacklist sync
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

        {/* Macro Federation Stats Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-3 bg-slate-950/40 border-b border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block font-mono">FEDERATION STATUS</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              OPERATIONAL ({stats?.protocol_version || 'FTX-V1.4'})
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-mono">CROSS-BANK LOSSES AVERTED</span>
            <span className="font-bold text-emerald-300 font-mono">
              ₹{((stats?.total_losses_averted_inr || 205500000) / 10000000).toFixed(2)} Crore
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-mono">PARTICIPATING NODES</span>
            <span className="font-semibold text-white">{stats?.participating_banks_count || 6} Tier-1 Banks & Regulators</span>
          </div>
          <div>
            <span className="text-slate-400 block font-mono">ACTIVE ATTACK CAMPAIGNS</span>
            <span className="font-bold text-rose-400">{stats?.active_attack_campaigns || 2} Syndicates Monitored</span>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Member Bank Nodes Grid */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-4 h-4 text-cyan-400" />
              Connected Member Banking Nodes
            </span>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {(stats?.member_nodes || []).map((node, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{node.bank_code}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="text-[11px] text-slate-300 font-medium truncate mt-1">
                    {node.bank_name.split(' ')[0]}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400">
                    <div>Threats: <strong className="text-cyan-300">{node.threats_shared}</strong></div>
                    <div className="text-emerald-400 font-mono">₹{(node.losses_averted_inr / 10000000).toFixed(1)} Cr</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Bulletins & Broadcast Action */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-400" />
                Live Federated Threat Bulletins (FTX Feed)
              </span>

              <button
                onClick={handleBroadcastCurrentThreat}
                disabled={broadcasting}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white transition-all shadow-md shadow-cyan-600/20"
              >
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                {broadcasting ? 'Publishing...' : '📡 Broadcast Local Incident'}
              </button>
            </div>

            {broadcastSuccess && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between"
              >
                <span>
                  ✓ <strong>Threat Published:</strong> Bulletin <code>{broadcastSuccess.bulletin?.bulletin_id}</code> synchronized across all {broadcastSuccess.synchronized_nodes_count} member nodes in {broadcastSuccess.distribution_latency_ms}ms.
                </span>
                <button
                  onClick={() => setBroadcastSuccess(null)}
                  className="text-emerald-400 hover:text-white ml-2 text-xs"
                >
                  ✕
                </button>
              </motion.div>
            )}

            <div className="space-y-3">
              {bulletins.map((item, idx) => (
                <div
                  key={item.bulletin_id || idx}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-cyan-400">{item.bulletin_id}</span>
                      <span className="text-slate-400">•</span>
                      <span className="font-bold text-white">{item.syndicate_name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-purple-300 border border-purple-500/20">
                        {item.syndicate_id}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                        Origin: {item.originating_bank}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.threat_level === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        {item.threat_level}
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-300 text-xs leading-relaxed">
                    <strong>Modus Operandi:</strong> {item.attack_vector}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                    <div>
                      <span>Detected Vocoder:</span>
                      <div className="text-purple-300 font-sans">{item.detected_vocoder}</div>
                    </div>
                    <div>
                      <span>Caller ANI Prefix:</span>
                      <div className="text-slate-200">{item.caller_ani_prefix}</div>
                    </div>
                    <div>
                      <span>Cross-Bank Attempts:</span>
                      <div className="text-amber-300 font-bold">{item.cross_bank_attempt_count} Attacks</div>
                    </div>
                    <div>
                      <span>Prevented Losses:</span>
                      <div className="text-emerald-400 font-bold">₹{(item.total_losses_averted_inr).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/80 text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono">
            <span>FTX-V1.4-DPDP</span>
            <span>•</span>
            <span>Zero-Knowledge Proofs</span>
            <span>•</span>
            <span>Sub-5ms HNSW Blacklist Ingestion</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            Close Federation
          </button>
        </div>
      </motion.div>
    </div>
  );
}
