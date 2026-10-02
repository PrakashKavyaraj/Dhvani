import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  Smartphone,
  Globe,
  Mail,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Send,
  Terminal,
} from 'lucide-react';
import { fetchAlerts, triggerTestAlert, DEFAULT_AEGIS_API_URL } from '../services/aegisApiClient';

export function MultiChannelAlertOutbox({
  analysisId,
  riskScore = 0,
  apiBaseUrl = DEFAULT_AEGIS_API_URL,
  className = '',
}) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedAlertId, setExpandedAlertId] = useState(null);
  const [isTestFiring, setIsTestFiring] = useState(false);
  const [testChannel, setTestChannel] = useState('ALL');
  const [testRisk, setTestRisk] = useState(riskScore > 0 ? riskScore : 88);
  const [showTestPanel, setShowTestPanel] = useState(false);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await fetchAlerts({ apiBaseUrl, analysisId, limit: 15 });
      setAlerts(data.alerts || []);
    } catch (err) {
      console.warn('Failed to load alerts from backend:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    // Periodically poll every 3 seconds if an analysisId is present
    const interval = setInterval(loadAlerts, 3000);
    return () => clearInterval(interval);
  }, [analysisId, apiBaseUrl]);

  const handleTestDispatch = async () => {
    setIsTestFiring(true);
    try {
      await triggerTestAlert(
        {
          channel: testChannel,
          risk_score: Number(testRisk),
          analysis_id: analysisId || undefined,
          custom_message: `Live Jury SIH Demonstration — ${testChannel} Channel Trigger`,
        },
        { apiBaseUrl }
      );
      await loadAlerts();
    } catch (err) {
      console.error('Failed to trigger test alert:', err);
    } finally {
      setIsTestFiring(false);
    }
  };

  const getChannelMeta = (channel) => {
    switch (channel?.toUpperCase()) {
      case 'FRAUD_DESK':
        return {
          icon: ShieldAlert,
          label: 'Cyber Fraud Desk',
          tag: 'SOC Incident Queue',
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
          badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        };
      case 'SMS':
        return {
          icon: Smartphone,
          label: 'Customer SMS / WhatsApp',
          tag: 'Out-of-Band Warning',
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        };
      case 'WEBHOOK':
        return {
          icon: Globe,
          label: 'SIEM / Core Banking Webhook',
          tag: 'HTTPS Event Stream',
          color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
          badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        };
      case 'EMAIL':
        return {
          icon: Mail,
          label: 'Compliance & Forensics',
          tag: 'Audit Incident Outbox',
          color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
          badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        };
      default:
        return {
          icon: Zap,
          label: channel,
          tag: 'Security Channel',
          color: 'text-slate-400 bg-white/5 border-white/10',
          badgeColor: 'bg-white/10 text-slate-300 border-white/20',
        };
    }
  };

  const isCritical = riskScore >= 71;
  const isModerate = riskScore >= 35 && riskScore < 71;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl border border-white/10 bg-[#070b14]/90 backdrop-blur-xl p-5 sm:p-7 shadow-2xl space-y-6 ${className}`}
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Send className="w-4 h-4" />
            </div>
            <h3 className="font-display font-bold text-lg text-white">
              Multi-Channel Security Alert Outbox
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
              4 Channels Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Autonomous multi-channel notification engine dispatching real-time countermeasures to frontline staff and end-users.
          </p>
        </div>

        {/* Quick Action Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowTestPanel(!showTestPanel)}
            className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-mono font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{showTestPanel ? 'Close Test Panel' : '⚡ Fire Test Alert'}</span>
          </button>

          <button
            type="button"
            onClick={loadAlerts}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            title="Refresh alerts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Interactive Test Dispatch Panel (for Jury Demo) */}
      <AnimatePresence>
        {showTestPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                Live Jury Interactive Dispatcher
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Tests immediate multi-channel delivery without restarting servers
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-1">Target Channel:</label>
                <select
                  value={testChannel}
                  onChange={(e) => setTestChannel(e.target.value)}
                  className="w-full text-xs font-mono bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400"
                >
                  <option value="ALL">ALL (4 Channels Concurrently)</option>
                  <option value="FRAUD_DESK">Cyber Fraud Desk (SOC)</option>
                  <option value="SMS">Customer SMS / WhatsApp</option>
                  <option value="WEBHOOK">SIEM Core Webhook (HTTP POST)</option>
                  <option value="EMAIL">Compliance & Forensics Email</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-1">
                  Threat Score: <span className="text-amber-400 font-bold">{testRisk}/100</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={testRisk}
                  onChange={(e) => setTestRisk(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 mt-2"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleTestDispatch}
                  disabled={isTestFiring}
                  className="w-full py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-mono font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <Zap className={`w-3.5 h-3.5 ${isTestFiring ? 'animate-bounce' : ''}`} />
                  <span>{isTestFiring ? 'Dispatching...' : 'Execute Dispatch'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4 Multi-Channel Operational Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Channel 1: Fraud Desk */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isCritical
            ? 'bg-rose-950/30 border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.2)] ring-1 ring-rose-500/30'
            : isModerate
            ? 'bg-amber-950/20 border-amber-500/40'
            : 'bg-black/40 border-white/10'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="w-7 h-7 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              isCritical
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                : isModerate
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-white/5 text-slate-400 border-white/10'
            }`}>
              {isCritical ? 'ALERT DISPATCHED' : isModerate ? 'MONITORING' : 'STANDBY'}
            </span>
          </div>
          <h4 className="text-xs font-bold text-slate-200 font-sans">Frontline Cyber Fraud Desk</h4>
          <p className="text-[11px] text-slate-400 mt-1 font-sans">
            Direct socket feed to SOC operator console. Auto-pauses high-risk transactions.
          </p>
          <div className="mt-3 pt-2 border-t border-white/5 text-[10px] font-mono text-slate-400">
            Target: <span className="text-slate-200">Fraud Desk 04</span>
          </div>
        </div>

        {/* Channel 2: Customer SMS */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isCritical || isModerate
            ? 'bg-amber-950/20 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30'
            : 'bg-black/40 border-white/10'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              isCritical
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : isModerate
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-white/5 text-slate-400 border-white/10'
            }`}>
              {isCritical ? 'CRITICAL SMS' : isModerate ? 'ADVISORY SENT' : 'STANDBY'}
            </span>
          </div>
          <h4 className="text-xs font-bold text-slate-200 font-sans">Customer Out-of-Band</h4>
          <p className="text-[11px] text-slate-400 mt-1 font-sans">
            Instant SMS / WhatsApp warning urging user to verify or freeze unauthorized activity.
          </p>
          <div className="mt-3 pt-2 border-t border-white/5 text-[10px] font-mono text-slate-400">
            Target: <span className="text-slate-200">+91-98765-XXXXX</span>
          </div>
        </div>

        {/* Channel 3: Banking SIEM Webhook */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isCritical || isModerate
            ? 'bg-cyan-950/20 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
            : 'bg-black/40 border-white/10'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              isCritical || isModerate
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-white/5 text-slate-400 border-white/10'
            }`}>
              {isCritical || isModerate ? 'POST 200 OK' : 'LISTENING'}
            </span>
          </div>
          <h4 className="text-xs font-bold text-slate-200 font-sans">Core Banking SIEM</h4>
          <p className="text-[11px] text-slate-400 mt-1 font-sans">
            Structured JSON webhook streamed to bank central fraud correlation engine.
          </p>
          <div className="mt-3 pt-2 border-t border-white/5 text-[10px] font-mono text-slate-400 truncate">
            Target: <span className="text-slate-200">/api/v1/alerts/mock-webhook</span>
          </div>
        </div>

        {/* Channel 4: Compliance Email */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isCritical
            ? 'bg-purple-950/20 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
            : 'bg-black/40 border-white/10'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              isCritical
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-white/5 text-slate-400 border-white/10'
            }`}>
              {isCritical ? 'AUDIT QUEUED' : 'STANDBY'}
            </span>
          </div>
          <h4 className="text-xs font-bold text-slate-200 font-sans">Compliance & Legal</h4>
          <p className="text-[11px] text-slate-400 mt-1 font-sans">
            Formal tamper-proof audit log with cryptographic voice token for regulatory archive.
          </p>
          <div className="mt-3 pt-2 border-t border-white/5 text-[10px] font-mono text-slate-400 truncate">
            Target: <span className="text-slate-200">incident-response@bank.org</span>
          </div>
        </div>
      </div>

      {/* Real-Time Outbox Activity Feed */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold uppercase text-slate-300 tracking-wider flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            Dispatched Alert Log ({alerts.length} Records)
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Click any row to inspect transmission payload
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className="p-6 rounded-2xl border border-white/5 bg-black/30 text-center space-y-2">
            <p className="text-xs text-slate-400">
              No alert dispatches currently queued. Elevate risk or click{' '}
              <span className="text-amber-400 font-semibold cursor-pointer" onClick={() => setShowTestPanel(true)}>
                '⚡ Fire Test Alert'
              </span>{' '}
              to simulate live notifications.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {alerts.map((alert) => {
              const meta = getChannelMeta(alert.channel);
              const IconComp = meta.icon;
              const isExpanded = expandedAlertId === alert.alert_id;

              return (
                <div
                  key={alert.alert_id}
                  className="rounded-2xl border border-white/10 bg-black/40 hover:bg-white/[0.04] transition-all overflow-hidden"
                >
                  <div
                    onClick={() => setExpandedAlertId(isExpanded ? null : alert.alert_id)}
                    className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${meta.color}`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-200 truncate">
                            {alert.title || meta.label}
                          </span>
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${meta.badgeColor}`}>
                            {alert.channel}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">
                            {alert.iso_timestamp ? new Date(alert.iso_timestamp).toLocaleTimeString() : 'Recent'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5 font-sans">
                          {alert.message || `Dispatched to ${alert.recipient}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      <span className="inline-flex items-center space-x-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>{alert.status}</span>
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* Expanded JSON Inspector */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-white/5 p-4 bg-black/60 font-mono text-[11px] space-y-2 text-slate-300"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pb-1 border-b border-white/5">
                          <span>Alert ID: {alert.alert_id}</span>
                          <span>Recipient: {alert.recipient}</span>
                        </div>
                        <pre className="overflow-x-auto text-[10px] text-cyan-300/90 leading-relaxed bg-black/40 p-2.5 rounded-xl border border-white/5">
                          {JSON.stringify(alert, null, 2)}
                        </pre>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
