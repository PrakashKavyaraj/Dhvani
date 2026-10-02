import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle2,
  Smartphone,
  UserCheck,
  X,
  Zap,
  ArrowRight,
  RefreshCw,
  FileText,
  BadgeAlert,
} from 'lucide-react';
import { submitSecondaryVerification, DEFAULT_AEGIS_API_URL } from '../services/aegisApiClient';

export function PreTransactionWarningModal({
  isOpen,
  onClose,
  analysisId,
  riskScore = 0,
  recommendation = '',
  scenario,
  onVerificationSuccess = () => {},
  transactionAmount = 50000,
  apiBaseUrl = DEFAULT_AEGIS_API_URL,
}) {
  const [activeTab, setActiveTab] = useState('OTP'); // 'OTP' or 'SUPERVISOR'
  const [otpValue, setOtpValue] = useState('');
  const [supervisorBadge, setSupervisorBadge] = useState('SOC-LEAD-8842');
  const [overrideReason, setOverrideReason] = useState('CUSTOMER_IN_BRANCH_VERIFIED');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const isCritical = riskScore >= 71;
  const demoOtp = '749210';

  if (!isOpen) return null;

  const handleVerifyOtp = async (codeToVerify) => {
    const code = codeToVerify || otpValue;
    if (!code || code.length < 4) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const res = await submitSecondaryVerification(
        {
          analysis_id: analysisId || 'DEMO-STREAM',
          method: 'OUT_OF_BAND_SMS_OTP',
          verified_by: 'CUSTOMER_MOBILE (+91-98765-XXXXX)',
          verification_code: code,
          transaction_amount_inr: transactionAmount,
        },
        { apiBaseUrl }
      );

      setIsVerified(true);
      setVerificationResult(res);
      onVerificationSuccess(res);
    } catch (err) {
      setErrorMessage(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSupervisorOverride = async () => {
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const res = await submitSecondaryVerification(
        {
          analysis_id: analysisId || 'DEMO-STREAM',
          method: 'SUPERVISOR_FRAUD_DESK_OVERRIDE',
          verified_by: supervisorBadge,
          reason: overrideReason,
          transaction_amount_inr: transactionAmount,
        },
        { apiBaseUrl }
      );

      setIsVerified(true);
      setVerificationResult(res);
      onVerificationSuccess(res);
    } catch (err) {
      setErrorMessage(err.message || 'Override failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoFillAndSubmit = () => {
    setOtpValue(demoOtp);
    handleVerifyOtp(demoOtp);
  };

  const handleModalClose = () => {
    setIsVerified(false);
    setOtpValue('');
    setErrorMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xl overflow-y-auto text-left">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`w-full max-w-2xl rounded-3xl border ${
          isCritical
            ? 'border-rose-500/50 bg-[#0c0509]/95 shadow-[0_0_60px_rgba(244,63,94,0.35)] ring-1 ring-rose-500/30'
            : 'border-amber-500/50 bg-[#0d0903]/95 shadow-[0_0_60px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/30'
        } p-6 sm:p-8 space-y-6 text-white`}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-start space-x-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                isVerified
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : isCritical
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.4)] animate-pulse'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
              }`}
            >
              {isVerified ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : isCritical ? (
                <ShieldAlert className="w-6 h-6" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    isVerified
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : isCritical
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {isVerified
                    ? 'VERIFICATION SATISFIED'
                    : isCritical
                    ? 'PRE-TRANSACTION INTERCEPT (PAUSED)'
                    : 'ADVISORY STEP-UP CHALLENGE'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Risk Score: <strong className={isCritical ? 'text-rose-400' : 'text-amber-400'}>{riskScore}/100</strong>
                </span>
              </div>

              <h2 className="text-lg sm:text-xl font-display font-bold text-white mt-1">
                {isVerified
                  ? 'Transaction Authorization Released'
                  : isCritical
                  ? 'Critical Security Intercept: Voice Deepfake Detected'
                  : 'Pre-Transaction Warning: Voice Authenticity Anomaly'}
              </h2>

              <p className="text-xs text-slate-400 font-sans mt-0.5">
                {isVerified
                  ? `Secondary verification satisfied. Funds have been cleared for settlement.`
                  : isCritical
                  ? 'Direct transaction paused to protect customer funds under TRAI/RBI cybersecurity directives.'
                  : 'Acoustic phonic divergence detected. Independent secondary verification recommended before funds release.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleModalClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transaction & Risk Context Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs font-mono">
          <div>
            <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Transaction Amount</span>
            <span className="text-emerald-400 font-bold text-sm">₹{transactionAmount.toLocaleString('en-IN')}.00</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Beneficiary Account</span>
            <span className="text-slate-200 font-semibold">HDFC-0091 • ****4912</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Intercept Status</span>
            <span className={`font-bold ${isVerified ? 'text-emerald-400' : isCritical ? 'text-rose-400' : 'text-amber-400'}`}>
              {isVerified ? '✓ UNLOCKED & RELEASED' : '⏸ PAYMENT PAUSED'}
            </span>
          </div>
        </div>

        {/* VERIFIED SUCCESS SCREEN */}
        {isVerified ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-center space-y-4 shadow-lg shadow-emerald-950/40"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Unlock className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white font-display">
                Secondary Verification Succeeded
              </h3>
              <p className="text-xs text-slate-300 font-sans max-w-md mx-auto">
                Payment of ₹{transactionAmount.toLocaleString('en-IN')}.00 was unlocked and queued for settlement.
                Tamper-proof audit receipt signed and archived into DPDP vault.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-[11px] font-mono text-slate-400 text-left space-y-1 max-w-md mx-auto">
              <div>Audit Ref: <span className="text-emerald-400">{verificationResult?.audit_record?.alert_id}</span></div>
              <div>Method: <span className="text-slate-200">{verificationResult?.audit_record?.delivery_metadata?.method}</span></div>
              <div>Verified By: <span className="text-slate-200">{verificationResult?.audit_record?.delivery_metadata?.verified_by}</span></div>
            </div>

            <button
              type="button"
              onClick={handleModalClose}
              className="py-2.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-mono font-bold text-xs inline-flex items-center space-x-2 transition-all shadow-lg shadow-emerald-500/25 cursor-pointer"
            >
              <span>Return to Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        ) : (
          /* UNVERIFIED: CHALLENGE INTERFACE */
          <div className="space-y-5">
            {/* Mode Selection Tabs */}
            <div className="flex items-center space-x-2 p-1 rounded-2xl bg-black/50 border border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab('OTP')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-mono font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                  activeTab === 'OTP'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Out-of-Band Customer OTP</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('SUPERVISOR')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-mono font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                  activeTab === 'SUPERVISOR'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Fraud Desk Supervisor Override</span>
              </button>
            </div>

            {/* TAB 1: Out-of-Band OTP */}
            {activeTab === 'OTP' && (
              <div className="space-y-4 p-4 rounded-2xl bg-black/30 border border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-200 font-sans block">
                      Customer Two-Factor Authentication Challenge
                    </span>
                    <span className="text-[11px] text-slate-400 font-sans">
                      A 6-digit verification PIN has been dispatched via SMS to registered mobile{' '}
                      <strong className="text-slate-300">+91-98765-XXXXX</strong>.
                    </span>
                  </div>
                </div>

                {/* Jury Demo Helper Quick-Action */}
                <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 text-[11px] font-mono text-cyan-300">
                    <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>SIH Jury Demo Code: <strong>{demoOtp}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoFillAndSubmit}
                    disabled={isSubmitting}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-[10px] font-mono font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    ⚡ Auto-fill Demo OTP
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
                    Enter 6-Digit Verification PIN:
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpValue}
                      onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full text-center text-lg font-mono tracking-[0.35em] font-bold bg-black/60 border border-white/20 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleVerifyOtp()}
                      disabled={isSubmitting || otpValue.length < 4}
                      className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-mono font-bold text-xs shrink-0 flex items-center space-x-1.5 transition-all disabled:opacity-40 cursor-pointer shadow-lg shadow-amber-500/20"
                    >
                      {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                      <span>{isSubmitting ? 'Verifying...' : 'Authorize'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Supervisor Override */}
            {activeTab === 'SUPERVISOR' && (
              <div className="space-y-4 p-4 rounded-2xl bg-black/30 border border-white/10">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-200 font-sans block">
                    SOC Frontline Supervisor Incident Sign-Off
                  </span>
                  <span className="text-[11px] text-slate-400 font-sans">
                    Allows an authorized fraud analyst or branch supervisor to override acoustic pause with signed justification.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-1">Supervisor ID Badge:</label>
                    <input
                      type="text"
                      value={supervisorBadge}
                      onChange={(e) => setSupervisorBadge(e.target.value)}
                      className="w-full text-xs font-mono bg-black/60 border border-white/20 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-1">Override Justification:</label>
                    <select
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      className="w-full text-xs font-mono bg-black/60 border border-white/20 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-purple-400"
                    >
                      <option value="CUSTOMER_IN_BRANCH_VERIFIED">Customer physically present in branch</option>
                      <option value="VIDEO_KYC_CONFIRMED">Live Video-KYC Liveness passed</option>
                      <option value="REGISTERED_LANDLINE_CALL_BACK">Callback to registered landline completed</option>
                      <option value="VIP_EXCEPTION_AUTHORIZED">Executive Fraud Committee Exception</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSupervisorOverride}
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-mono font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-lg shadow-purple-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                  <span>{isSubmitting ? 'Signing Audit Trail...' : 'Execute Supervisor Override'}</span>
                </button>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono">
                {errorMessage}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer / Legal Protocol */}
        <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] font-mono text-slate-500">
          <span>Protected by Dhvani Active Fraud Prevention Engine</span>
          <span>DPDP Act 2023 § 8(7) • RBI Master Direction 2024</span>
        </div>
      </motion.div>
    </div>
  );
}
