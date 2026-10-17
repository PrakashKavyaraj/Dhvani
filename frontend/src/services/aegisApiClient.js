/**
 * AEGIS External Integration API Client & In-Browser Audio Utility
 *
 * Provides third-party websites and institutions a zero-dependency, production-grade
 * integration library to submit audio to the AEGIS Voice Integrity Backend, poll
 * for the complete multi-modal analysis, and convert microphone recordings to valid 16kHz WAV.
 */

export const DEFAULT_AEGIS_API_URL = 'http://127.0.0.1:8000';

/**
 * Checks connectivity and operational status of the AEGIS Backend.
 */
export async function checkAegisHealth(apiBaseUrl = DEFAULT_AEGIS_API_URL) {
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/health`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`AEGIS health check failed with HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Submits an audio File or Blob to AEGIS, polls until completion, and returns
 * the complete multi-modal analysis payload.
 *
 * @param {File|Blob} audioFileOrBlob - WAV audio file or recorded Blob
 * @param {Object} [options]
 * @param {string} [options.apiBaseUrl] - Target AEGIS backend URL
 * @param {Function} [options.onProgress] - Callback for progress status messages
 * @param {AbortSignal} [options.signal] - Abort controller signal
 * @param {number} [options.pollIntervalMs] - Delay between status polls (default 1000ms)
 * @param {number} [options.maxAttempts] - Maximum polling attempts (default 60 = 60s)
 * @returns {Promise<Object>} Complete AEGIS AnalysisStatusResponse
 */
export async function analyzeAudio(audioFileOrBlob, options = {}) {
  const {
    apiBaseUrl = DEFAULT_AEGIS_API_URL,
    onProgress = () => {},
    signal,
    pollIntervalMs = 1000,
    maxAttempts = 60,
  } = options;

  const base = apiBaseUrl.replace(/\/$/, '');
  const formData = new FormData();

  // Ensure file has a proper filename ending in .wav
  if (audioFileOrBlob instanceof File) {
    formData.append('file', audioFileOrBlob, audioFileOrBlob.name);
  } else {
    formData.append('file', audioFileOrBlob, 'recording.wav');
  }

  onProgress('Submitting audio payload to AEGIS...');

  // 1. Initial Submission: POST /api/v1/analyses
  const headers = {};
  if (options.apiKey) {
    headers['X-API-Key'] = options.apiKey;
  }

  const submitRes = await fetch(`${base}/api/v1/analyses`, {
    method: 'POST',
    headers,
    body: formData,
    signal,
  });

  if (!submitRes.ok) {
    let errData = null;
    try {
      errData = await submitRes.json();
    } catch (_) {}

    const detail = errData?.detail || errData?.error;
    const msg =
      typeof detail === 'string'
        ? detail
        : detail?.message || `Submission failed with HTTP ${submitRes.status}`;
    throw new Error(msg);
  }

  const submitData = await submitRes.json();
  const analysisId = submitData.analysis_id;
  if (!analysisId) {
    throw new Error('Backend response did not contain an analysis_id.');
  }

  onProgress(submitData.message || 'Queued for acoustic processing...');

  // 2. Poll Status: GET /api/v1/analyses/{analysis_id}
  let attempts = 0;
  while (attempts < maxAttempts) {
    if (signal?.aborted) {
      throw new Error('Analysis polling aborted by user.');
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    attempts += 1;

    onProgress(`Acoustic pipeline analyzing (step ${attempts}/${maxAttempts})...`);

    const pollRes = await fetch(`${base}/api/v1/analyses/${analysisId}`, {
      headers: { Accept: 'application/json' },
      signal,
    });

    if (!pollRes.ok) {
      // Allow transient non-200 while worker finishes
      continue;
    }

    const pollData = await pollRes.json();

    if (pollData.status === 'completed') {
      onProgress('Analysis completed successfully.');
      return pollData;
    }

    if (pollData.status === 'failed') {
      const err = pollData.error || {};
      throw new Error(err.message || 'AEGIS synthetic speech detector reported analysis failure.');
    }
  }

  throw new Error('Analysis timed out waiting for backend worker response.');
}

/**
 * Encodes an AudioBuffer into a standard 16kHz mono 16-bit linear PCM WAV Blob.
 * Guarantees compatibility with AEGIS validation_service and DSP preprocessors.
 *
 * @param {AudioBuffer} buffer
 * @returns {Blob} Audio/WAV Blob
 */
export function encodeAudioBufferToWav(buffer) {
  const targetSampleRate = 16000;
  // Downmix to mono if multi-channel
  let monoSamples;
  if (buffer.numberOfChannels === 1) {
    monoSamples = buffer.getChannelData(0);
  } else {
    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.getChannelData(1);
    monoSamples = new Float32Array(ch0.length);
    for (let i = 0; i < ch0.length; i++) {
      monoSamples[i] = (ch0[i] + ch1[i]) * 0.5;
    }
  }

  // Resample to 16000 Hz if necessary
  let resampled;
  if (buffer.sampleRate === targetSampleRate) {
    resampled = monoSamples;
  } else {
    const ratio = buffer.sampleRate / targetSampleRate;
    const newLength = Math.round(monoSamples.length / ratio);
    resampled = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const srcIndex = Math.floor(i * ratio);
      resampled[i] = monoSamples[srcIndex] || 0;
    }
  }

  // Create 16-bit PCM WAV container
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = targetSampleRate * blockAlign;
  const dataSize = resampled.length * bytesPerSample;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  // Helper to write ASCII strings
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  /* RIFF identifier */
  writeString(0, 'RIFF');
  /* file length minus 8 bytes */
  view.setUint32(4, 36 + dataSize, true);
  /* RIFF type & format */
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format: 1 = linear PCM */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, targetSampleRate, true);
  /* byte rate */
  view.setUint32(28, byteRate, true);
  /* block align */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitsPerSample, true);
  /* data chunk identifier */
  writeString(36, 'data');
  /* data chunk length */
  view.setUint32(40, dataSize, true);

  // Write 16-bit clamped PCM samples
  let offset = 44;
  for (let i = 0; i < resampled.length; i++) {
    const s = Math.max(-1, Math.min(1, resampled[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * High-level microphone recorder class for institutions.
 * Captures live audio from microphone and exports standard 16kHz WAV Blob.
 */
export class AegisVoiceRecorder {
  constructor(options = {}) {
    this.onVolume = options.onVolume || (() => {});
    this.audioContext = null;
    this.mediaStream = null;
    this.processor = null;
    this.source = null;
    this.analyser = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.animFrameId = null;
  }

  async start() {
    this.recordedChunks = [];
    this.isRecording = true;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;

    // Buffer chunk collector (4096 samples per callback)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const inputData = e.inputBuffer.getChannelData(0);
      this.recordedChunks.push(new Float32Array(inputData));
    };

    this.source.connect(this.analyser);
    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    // Audio level meter loop
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    const checkVolume = () => {
      if (!this.isRecording) return;
      this.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      this.onVolume(Math.min(100, Math.round((avg / 128) * 100)));
      this.animFrameId = requestAnimationFrame(checkVolume);
    };
    checkVolume();
  }

  async stop() {
    this.isRecording = false;
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.onVolume(0);

    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
    }
    if (this.source) this.source.disconnect();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
    }

    // Merge recorded chunks into a single AudioBuffer
    const totalLength = this.recordedChunks.reduce((acc, c) => acc + c.length, 0);
    if (totalLength === 0 || !this.audioContext) {
      if (this.audioContext) await this.audioContext.close();
      throw new Error('No audio data captured. Please ensure microphone permissions are granted.');
    }

    const mergedBuffer = this.audioContext.createBuffer(
      1,
      totalLength,
      this.audioContext.sampleRate
    );
    const channelData = mergedBuffer.getChannelData(0);
    let offset = 0;
    for (const chunk of this.recordedChunks) {
      channelData.set(chunk, offset);
      offset += chunk.length;
    }

    await this.audioContext.close();
    this.audioContext = null;

    // Convert into 16kHz WAV Blob
    const wavBlob = encodeAudioBufferToWav(mergedBuffer);
    const duration = totalLength / (mergedBuffer.sampleRate || 16000);

    return {
      blob: wavBlob,
      duration,
      url: URL.createObjectURL(wavBlob),
    };
  }
}

/**
 * Retrieves recent multi-channel security alerts from the outbox.
 */
export async function fetchAlerts(options = {}) {
  const {
    apiBaseUrl = DEFAULT_AEGIS_API_URL,
    analysisId,
    channel,
    limit = 20,
  } = options;

  const base = apiBaseUrl.replace(/\/$/, '');
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (analysisId) params.set('analysis_id', analysisId);
  if (channel) params.set('channel', channel);

  const res = await fetch(`${base}/api/v1/alerts?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch alerts: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Triggers a test alert across one or all channels for live demonstration.
 */
export async function triggerTestAlert(payload = {}, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/alerts/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      channel: payload.channel || 'ALL',
      risk_score: payload.risk_score ?? 85,
      analysis_id: payload.analysis_id,
      custom_message: payload.custom_message,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to trigger test alert: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Clears the alert outbox.
 */
export async function clearAlerts(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/alerts/clear`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to clear alerts: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Submits secondary verification (OTP or supervisor override) to release a paused transaction.
 */
export async function submitSecondaryVerification(payload, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/alerts/secondary-verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      analysis_id: payload.analysis_id,
      method: payload.method || 'OTP',
      verified_by: payload.verified_by || 'CUSTOMER_MOBILE',
      verification_code: payload.verification_code,
      reason: payload.reason,
      transaction_amount_inr: payload.transaction_amount_inr || 50000,
    }),
  });

  if (!res.ok) {
    throw new Error(`Secondary verification failed: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Fetches active configurable workflow rules from the backend.
 */
export async function fetchWorkflowRules(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/workflow/rules`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch workflow rules: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Updates dynamic risk thresholds and automated response actions.
 * Takes effect immediately on all subsequent analyses without server restarts.
 */
export async function updateWorkflowRules(rules, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/workflow/rules`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ rules }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Failed to update workflow rules: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Resets workflow rules to factory SIH defaults.
 */
export async function resetWorkflowRules(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/workflow/rules/reset`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to reset workflow rules: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Voice Biometric Vault: Lists enrolled customer profiles for a tenant.
 */
export async function fetchEnrolledVoiceprints(tenantId = 'default', options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/voiceprint/enrolled?tenant_id=${encodeURIComponent(tenantId)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch enrolled voiceprints: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Voice Biometric Vault: Enrolls a new customer voiceprint embedding.
 */
export async function enrollVoiceprint(fileOrBlob, customerId, speakerName = '', tenantId = 'default', options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const formData = new FormData();
  if (fileOrBlob instanceof File) {
    formData.append('file', fileOrBlob, fileOrBlob.name);
  } else {
    formData.append('file', fileOrBlob, 'enrollment.wav');
  }
  formData.append('customer_id', customerId);
  if (speakerName) formData.append('speaker_name', speakerName);
  formData.append('tenant_id', tenantId);

  const res = await fetch(`${base}/api/v1/voiceprint/enroll`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Enrollment failed with HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Voice Biometric Vault: Verifies live audio against enrolled customer profile.
 */
export async function verifyVoiceprint(fileOrBlob, customerId, tenantId = 'default', options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const formData = new FormData();
  if (fileOrBlob instanceof File) {
    formData.append('file', fileOrBlob, fileOrBlob.name);
  } else {
    formData.append('file', fileOrBlob, 'verification.wav');
  }
  formData.append('customer_id', customerId);
  formData.append('tenant_id', tenantId);

  const res = await fetch(`${base}/api/v1/voiceprint/verify`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Voice verification failed with HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Voice Biometric Vault: DPDP Act Section 12 Right to Erasure.
 */
export async function deleteVoiceprint(customerId, tenantId = 'default', options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/voiceprint/${encodeURIComponent(customerId)}?tenant_id=${encodeURIComponent(tenantId)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Biometric profile deletion failed with HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Active Liveness: Issues an unpredictable, signed phonetic challenge.
 */
export async function createLivenessChallenge(sessionId = 'live-session', options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const formData = new FormData();
  formData.append('session_id', sessionId);

  const res = await fetch(`${base}/api/v1/liveness/challenge`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    throw new Error(`Failed to generate liveness challenge: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Active Liveness: Verifies spoken audio against challenge token and evaluates acoustic latency.
 */
export async function verifyLivenessChallenge(fileOrBlob, challengeToken, transcript = '', options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const formData = new FormData();
  if (fileOrBlob instanceof File) {
    formData.append('file', fileOrBlob, fileOrBlob.name);
  } else {
    formData.append('file', fileOrBlob, 'challenge_response.wav');
  }
  formData.append('challenge_token', challengeToken);
  if (transcript) formData.append('transcript', transcript);

  const res = await fetch(`${base}/api/v1/liveness/verify`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Liveness verification failed with HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Core Banking: Evaluates pre-auth transaction risk against voice analysis (ISO 8583).
 */
export async function evaluateBankingPreAuth(payload, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/banking/pre-auth-evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Banking pre-auth evaluation failed with HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Core Banking: Simulates carrier SIP/RTP packetized audio stream.
 */
export async function simulateTelephonyStream(durationSeconds = 2.0, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/banking/simulate-telephony`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ duration_seconds: durationSeconds, sample_rate: 16000, packet_duration_ms: 20 }),
  });
  if (!res.ok) {
    throw new Error(`Telephony simulation failed with HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * 1:N Fraudster Blacklist: Fetch paginated registered fraudster voiceprints.
 */
export async function fetchBlacklistEntries(limit = 50, offset = 0, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/blacklist/list?limit=${limit}&offset=${offset}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch blacklist records: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * 1:N Fraudster Blacklist: Fetch aggregate syndicate statistics.
 */
export async function fetchBlacklistStats(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/blacklist/stats`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch blacklist statistics: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * 1:N Fraudster Blacklist: Scan live audio against known repeat offender voiceprints.
 */
export async function matchBlacklistVoiceprint(fileOrBlob, matchThreshold = 0.72, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const formData = new FormData();
  if (fileOrBlob instanceof File) {
    formData.append('file', fileOrBlob, fileOrBlob.name);
  } else {
    formData.append('file', fileOrBlob, 'caller_sample.wav');
  }
  formData.append('match_threshold', String(matchThreshold));
  formData.append('top_k', '3');
  formData.append('user_consent_granted', 'true');

  const res = await fetch(`${base}/api/v1/blacklist/match`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Blacklist vector search failed with HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * 1:N Fraudster Blacklist: Enroll a new flagged suspect into the blacklist database.
 */
export async function enrollBlacklistVoiceprint(fileOrBlob, syndicateData, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const formData = new FormData();
  if (fileOrBlob instanceof File) {
    formData.append('file', fileOrBlob, fileOrBlob.name);
  } else {
    formData.append('file', fileOrBlob, 'suspect_sample.wav');
  }
  formData.append('syndicate_id', syndicateData.syndicate_id);
  formData.append('syndicate_name', syndicateData.syndicate_name);
  formData.append('fraud_category', syndicateData.fraud_category || 'DIGITAL_ARREST');
  formData.append('threat_level', syndicateData.threat_level || 'CRITICAL');
  if (syndicateData.notes) formData.append('notes', syndicateData.notes);

  const res = await fetch(`${base}/api/v1/blacklist/enroll`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Blacklist enrollment failed with HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * 1:N Fraudster Blacklist: Deactivate an entry.
 */
export async function deleteBlacklistEntry(entryId, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/blacklist/${entryId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to delete blacklist entry: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Merkle Audit Ledger: Fetch recent immutable audit blocks.
 */
export async function getMerkleAuditLedger(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL, limit = 50, offset = 0 } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/audit/ledger?limit=${limit}&offset=${offset}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Merkle audit ledger: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Merkle Audit Ledger: Get aggregate tree metrics and compliance status.
 */
export async function getMerkleAuditStats(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/audit/stats`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Merkle audit stats: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Merkle Audit Ledger: Fetch mathematical proof of inclusion for a session.
 */
export async function getMerkleInclusionProof(sessionId, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/audit/proof/${encodeURIComponent(sessionId)}`);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Failed to fetch Merkle proof: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Merkle Audit Ledger: Mathematically verify inclusion proof against root.
 */
export async function verifyMerkleProof(leafHash, proofPath, expectedRoot, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/audit/verify-proof`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leaf_hash: leafHash,
      proof_path: proofPath,
      expected_root: expectedRoot,
    }),
  });
  if (!res.ok) {
    throw new Error(`Proof verification failed with HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Section 65B / BSA Section 63: Generate court-admissible legal certificate for a session.
 */
export async function getSection65bCertificate(sessionId, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/audit/section-65b/${encodeURIComponent(sessionId)}`);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Failed to retrieve Section 65B certificate: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Telephony Resilience: Analyze audio for PLC artifacts and ITU-T G.107 QoS.
 */
export async function analyzeTelephonyChannel(fileOrBlob, params = {}, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const formData = new FormData();

  if (fileOrBlob instanceof File || fileOrBlob instanceof Blob) {
    formData.append('file', fileOrBlob, fileOrBlob.name || 'telephony_audio.wav');
  }
  if (params.packet_loss_rate != null) formData.append('packet_loss_rate', String(params.packet_loss_rate));
  if (params.jitter_ms != null) formData.append('jitter_ms', String(params.jitter_ms));
  if (params.codec) formData.append('codec', params.codec);

  const res = await fetch(`${base}/api/v1/telephony/analyze-channel`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Channel analysis failed: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Telephony Resilience: Simulate Gilbert-Elliott network loss and PLC extrapolation.
 */
export async function simulateTelephonyDegradation(fileOrBlob, params = {}, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const formData = new FormData();

  if (fileOrBlob instanceof File || fileOrBlob instanceof Blob) {
    formData.append('file', fileOrBlob, fileOrBlob.name || 'input_audio.wav');
  }
  formData.append('target_loss_rate', String(params.target_loss_rate ?? 0.08));
  formData.append('jitter_ms', String(params.jitter_ms ?? 30.0));
  formData.append('burst_length_avg', String(params.burst_length_avg ?? 2.0));
  formData.append('apply_plc', String(params.apply_plc ?? true));
  formData.append('codec', params.codec || 'G.711');

  const res = await fetch(`${base}/api/v1/telephony/simulate-degradation`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Degradation simulation failed: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Telephony Resilience: Get supported carrier codecs and ITU-T G.107 equipment impairment profiles.
 */
export async function getTelephonyCodecs(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/telephony/codecs`);
  if (!res.ok) {
    throw new Error(`Failed to fetch telephony codecs: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Telephony Resilience: Get aggregate telephony standards compliance stats.
 */
export async function getTelephonyStats(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/telephony/stats`);
  if (!res.ok) {
    throw new Error(`Failed to fetch telephony stats: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Forensic Spectrogram: Generate 2D Mel Spectrogram and temporal splicing segmentation.
 */
export async function fetchSpectrogramData(fileOrBlob, params = {}, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const formData = new FormData();

  if (fileOrBlob instanceof File || fileOrBlob instanceof Blob) {
    formData.append('file', fileOrBlob, fileOrBlob.name || 'audio.wav');
  }
  if (params.synthetic_prob != null) formData.append('synthetic_prob', String(params.synthetic_prob));
  if (params.target_time_bins != null) formData.append('target_time_bins', String(params.target_time_bins));

  const res = await fetch(`${base}/api/v1/spectrogram/generate`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Spectrogram generation failed: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Forensic Spectrogram: Get palette and dimension metadata.
 */
export async function fetchSpectrogramInfo(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');

  const res = await fetch(`${base}/api/v1/spectrogram/info`);
  if (!res.ok) {
    throw new Error(`Failed to fetch spectrogram info: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Call Center Co-Pilot: Fetch pre-configured sample dual-channel session.
 */
export async function fetchCopilotSampleSession(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/copilot/sample-session`);
  if (!res.ok) {
    throw new Error(`Failed to fetch copilot sample session: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Call Center Co-Pilot: Fetch live session by ID.
 */
export async function fetchCopilotSession(sessionId, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/copilot/session/${encodeURIComponent(sessionId)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch copilot session: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Call Center Co-Pilot: Evaluate single dialogue turn with latency and speech parameters.
 */
export async function evaluateCopilotTurn(data, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/copilot/evaluate-turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Failed to evaluate turn: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Call Center Co-Pilot: Trigger emergency supervisor escalation and account lock.
 */
export async function escalateCopilotSupervisor(data, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/copilot/supervisor-escalate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Failed to trigger escalation: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Call Center Co-Pilot: Reset session state.
 */
export async function resetCopilotSession(sessionId, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const formData = new FormData();
  formData.append('session_id', sessionId);
  const res = await fetch(`${base}/api/v1/copilot/reset-session`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    throw new Error(`Failed to reset copilot session: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Neural Vocoder: Fetch known vocoder threat intelligence catalog.
 */
export async function fetchVocoderCatalog(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/vocoder/catalog`);
  if (!res.ok) {
    throw new Error(`Failed to fetch vocoder catalog: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Neural Vocoder: Attribute audio file to neural vocoder architecture.
 */
export async function attributeVocoderAudio(fileOrBlob, params = {}, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const formData = new FormData();
  formData.append('file', fileOrBlob, fileOrBlob.name || 'sample.wav');
  if (params.synthetic_prob != null) {
    formData.append('synthetic_prob', String(params.synthetic_prob));
  }

  const res = await fetch(`${base}/api/v1/vocoder/attribute`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Vocoder attribution failed: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Neural Vocoder: Attribute vocoder from telemetry metrics.
 */
export async function attributeVocoderFromMetrics(metrics, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/vocoder/attribute-from-metrics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metrics),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Failed to attribute vocoder: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Edge-Defense: Fetch known virtual driver signatures.
 */
export async function fetchEdgeSignatures(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/edge/signatures`);
  if (!res.ok) {
    throw new Error(`Failed to fetch edge signatures: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Edge-Defense: Verify client device metadata and noise floor telemetry.
 */
export async function verifyEdgeDevice(data, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/edge/verify-device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Failed to verify edge device: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Cyber Crime FIR Docket: Fetch statutory guidelines under BNS and IT Act.
 */
export async function fetchStatutoryGuidelines(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/docket/statutory-guidelines`);
  if (!res.ok) {
    throw new Error(`Failed to fetch statutory guidelines: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Cyber Crime FIR Docket: Generate complete police complaint and RBI CFR dossier.
 */
export async function generateFIRDocket(data, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/docket/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Failed to generate FIR docket: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Inter-Bank Federation: Fetch network stats and member banking nodes.
 */
export async function fetchFederationStats(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/federation/stats`);
  if (!res.ok) {
    throw new Error(`Failed to fetch federation stats: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Inter-Bank Federation: Fetch active cross-bank threat bulletins.
 */
export async function fetchFederationBulletins(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/federation/bulletins`);
  if (!res.ok) {
    throw new Error(`Failed to fetch federation bulletins: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Inter-Bank Federation: Broadcast threat bulletin across member banks.
 */
export async function broadcastFederationThreat(data, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/federation/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Failed to broadcast threat: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Developer Sandbox: Fetch available scenarios and supported languages.
 */
export async function fetchSandboxScenarios(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/sandbox/scenarios`);
  if (!res.ok) {
    throw new Error(`Failed to fetch sandbox scenarios: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Developer Sandbox: Fetch code snippet for scenario and language.
 */
export async function fetchSandboxCodeSnippet(scenario, language, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(
    `${base}/api/v1/sandbox/code-snippet?scenario=${encodeURIComponent(scenario)}&language=${encodeURIComponent(language)}&base_url=${encodeURIComponent(base)}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch code snippet: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Developer Sandbox: Execute live test in sandbox console.
 */
export async function executeSandboxTest(scenario, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/sandbox/execute-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Sandbox test execution failed: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Model Governance & Risk Management: Fetch model cards.
 */
export async function fetchModelCards(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/governance/model-cards`);
  if (!res.ok) {
    throw new Error(`Failed to fetch model cards: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Model Governance: Fetch RBI FREE-AI 26-recommendation matrix.
 */
export async function fetchRbiFreeAiMatrix(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/governance/rbi-free-ai`);
  if (!res.ok) {
    throw new Error(`Failed to fetch RBI FREE-AI matrix: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Model Governance: Fetch DPDP Act 2023 & Rules 2025 compliance profile.
 */
export async function fetchDpdpCompliance(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/governance/dpdp-compliance`);
  if (!res.ok) {
    throw new Error(`Failed to fetch DPDP compliance profile: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Model Governance: Generate plain-language explainability narrative.
 */
export async function fetchExplainVerdict(payload, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/governance/explain-verdict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Failed to explain verdict: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Model Governance: Submit customer dispute under FREE-AI Pillar 4.
 */
export async function submitCustomerDispute(payload, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/governance/customer-dispute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Dispute registration failed: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Model Governance: Fetch registered customer disputes.
 */
export async function fetchCustomerDisputes(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/governance/customer-disputes`);
  if (!res.ok) {
    throw new Error(`Failed to fetch customer disputes: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Multi-Tenant Enterprise: Fetch all configured bank tenants and policies.
 */
export async function fetchTenants(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/tenants`);
  if (!res.ok) {
    throw new Error(`Failed to fetch tenants: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Multi-Tenant Enterprise: Update or register bank tenant policy.
 */
export async function updateTenantPolicy(payload, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Policy update failed: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Multi-Tenant Enterprise: Fetch PostgreSQL 16 + pgvector DDL deployment script.
 */
export async function fetchPgvectorDdl(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/tenants/pgvector-ddl`);
  if (!res.ok) {
    throw new Error(`Failed to fetch pgvector DDL: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Multi-Tenant Enterprise: Fetch Redis ephemeral session buffer health.
 */
export async function fetchRedisSessionHealth(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/tenants/redis-session/health`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Redis session health: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Multi-Tenant Enterprise: Fetch tenant biometric vault statistics.
 */
export async function fetchTenantStats(tenantId, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/tenants/${encodeURIComponent(tenantId)}/stats`);
  if (!res.ok) {
    throw new Error(`Failed to fetch tenant stats: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Multi-Tenant Enterprise: DPDP Section 12 Right to Erasure customer voiceprint purge.
 */
export async function purgeCustomerVoiceprint(tenantId, customerAccountId, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/tenants/${encodeURIComponent(tenantId)}/purge-customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_account_id: customerAccountId }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Customer purge failed: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Adversarial Replay Defense: Inspect audio for acoustic loudspeaker replay attacks.
 */
export async function fetchReplayAnalysis(audioSamples, options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/replay-defense/inspect-acoustic-replay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_samples: audioSamples, sample_rate: options.sampleRate || 16000 }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Replay inspection failed: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Adversarial & Multilingual: Fetch frozen benchmark report.
 */
export async function fetchMultilingualBenchmark(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/replay-defense/multilingual-benchmark`);
  if (!res.ok) {
    throw new Error(`Failed to fetch multilingual benchmark: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Indian Dialects: Fetch regional dialect coverage and phonetic features.
 */
export async function fetchIndianDialects(options = {}) {
  const { apiBaseUrl = DEFAULT_AEGIS_API_URL } = options;
  const base = apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/replay-defense/dialects`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Indian dialects: HTTP ${res.status}`);
  }
  return await res.json();
}



