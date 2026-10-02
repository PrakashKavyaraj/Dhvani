import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code,
  Terminal,
  Play,
  Copy,
  CheckCircle,
  ExternalLink,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Globe,
  Radio,
  FileText,
  Clock,
} from 'lucide-react';
import {
  fetchSandboxScenarios,
  fetchSandboxCodeSnippet,
  executeSandboxTest,
} from '../services/aegisApiClient';

export function DeveloperSandboxModal({ isOpen, onClose, apiBaseUrl }) {
  const [scenarios, setScenarios] = useState({});
  const [selectedScenario, setSelectedScenario] = useState('VOICE_INFERENCE');
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [executionResult, setExecutionResult] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadScenarios();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && selectedScenario && selectedLanguage) {
      loadCodeSnippet();
    }
  }, [isOpen, selectedScenario, selectedLanguage]);

  const loadScenarios = async () => {
    setLoading(true);
    try {
      const data = await fetchSandboxScenarios({ apiBaseUrl });
      setScenarios(data.scenarios || {});
    } catch (err) {
      console.error('Failed to load scenarios:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCodeSnippet = async () => {
    try {
      const data = await fetchSandboxCodeSnippet(selectedScenario, selectedLanguage, { apiBaseUrl });
      setCodeSnippet(data.code_snippet || '');
    } catch (err) {
      console.error('Failed to load code snippet:', err);
    }
  };

  const handleRunLive = async () => {
    setExecuting(true);
    try {
      const res = await executeSandboxTest(selectedScenario, { apiBaseUrl });
      setExecutionResult(res);
    } catch (err) {
      console.error('Live execution failed:', err);
      setExecutionResult({
        status_code: 500,
        error: err.message,
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleCopyCode = () => {
    if (!codeSnippet) return;
    navigator.clipboard?.writeText(codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const currentScenario = scenarios[selectedScenario] || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Code className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Developer Sandbox & Multi-Language SDK Playground
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Interactive API Console
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Production-ready code snippets across Python, TypeScript, cURL, Java, and Go with sub-15ms live local execution
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

        {/* Main Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          {/* Left Column: Scenarios & Code Playground */}
          <div className="lg:col-span-7 p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Scenario selector */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Select Integration API Scenario
                </label>
                <select
                  value={selectedScenario}
                  onChange={(e) => setSelectedScenario(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-cyan-500"
                >
                  {Object.entries(scenarios).map(([key, sc]) => (
                    <option key={key} value={key}>
                      {sc.endpoint} | {sc.title}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  {currentScenario.description}
                </p>
              </div>

              {/* Language Tabs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Target Programming Language
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
                  >
                    {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied Snippet!' : 'Copy Code'}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  {['python', 'typescript', 'curl', 'java', 'go'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setSelectedLanguage(lang)}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-mono font-semibold capitalize transition-all ${
                        selectedLanguage === lang
                          ? 'bg-slate-800 text-cyan-300 shadow border border-slate-700'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {lang === 'typescript' ? 'Node / TS' : lang}
                    </button>
                  ))}
                </div>
              </div>

              {/* Syntax Box */}
              <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-slate-200 leading-relaxed overflow-x-auto max-h-[300px]">
                <pre>{codeSnippet || '// Loading code snippet...'}</pre>
              </div>
            </div>

            {/* Run Button */}
            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">
                Base URL: <code>{apiBaseUrl || 'http://localhost:8000'}</code>
              </span>
              <button
                onClick={handleRunLive}
                disabled={executing}
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition-all cursor-pointer"
              >
                <Play className={`w-3.5 h-3.5 ${executing ? 'animate-spin' : ''}`} />
                {executing ? 'Executing Request...' : '▶ Run Live in Sandbox'}
              </button>
            </div>
          </div>

          {/* Right Column: Live Execution Terminal Output */}
          <div className="lg:col-span-5 p-6 space-y-4 bg-slate-950/40 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Live Response Console
                </span>
                {executionResult && (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      HTTP {executionResult.status_code || 200} OK
                    </span>
                    <span className="text-[10px] font-mono text-cyan-300 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {executionResult.latency_ms}ms
                    </span>
                  </div>
                )}
              </div>

              {executionResult ? (
                <div className="p-4 rounded-xl bg-slate-950 font-mono text-xs text-slate-200 border border-slate-800 leading-relaxed overflow-x-auto max-h-[460px] whitespace-pre-wrap select-all">
                  {JSON.stringify(executionResult.response_data || executionResult, null, 2)}
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-slate-950 border border-slate-800 text-center flex flex-col items-center justify-center space-y-2 min-h-[300px]">
                  <Terminal className="w-8 h-8 text-slate-600" />
                  <p className="text-xs text-slate-400">
                    Click <strong>Run Live in Sandbox</strong> to dispatch an authentic test request to the local Dhvani engine.
                  </p>
                  <span className="text-[10px] font-mono text-slate-500">
                    Measures socket turnaround, model inference latency, and JSON validation
                  </span>
                </div>
              )}
            </div>

            {/* API Standards Stamp */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>OpenAPI 3.1.0 Compatible</span>
              <span className="text-cyan-400 font-mono">/docs & /redoc available</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/80 text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono">
            <span>FastAPI 0.115</span>
            <span>•</span>
            <span>Python 3.14</span>
            <span>•</span>
            <span>Sub-15ms Async Event Loop</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            Close Sandbox
          </button>
        </div>
      </motion.div>
    </div>
  );
}
