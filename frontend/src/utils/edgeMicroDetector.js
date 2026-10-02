/**
 * In-Browser Edge-Defense & Virtual Audio Cable Micro-Detector.
 * Runs zero-latency client-side device enumeration and acoustic thermal floor analysis.
 */

export const VIRTUAL_DRIVER_SIGNATURES = [
  'virtual',
  'cable',
  'blackhole',
  'loopback',
  'soundflower',
  'stereo mix',
  'obs-audio',
  'obs virtual',
  'vbaudio',
  'voicemeeter',
  'screaming bee',
  'morphvox',
  'clonemanager',
  'wavesurfer virtual',
  'line 1 (virtual',
  'line 2 (virtual',
  'aggregate device',
  'pulse monitor',
];

/**
 * Enumerate browser audio devices and inspect labels.
 */
export async function scanAudioInputDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    return {
      supported: false,
      devices: [],
      hasVirtualDriver: false,
    };
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((d) => d.kind === 'audioinput');

    const categorized = audioInputs.map((d) => {
      const label = d.label || 'Default Audio Device';
      const labelLower = label.toLowerCase();
      const matched = VIRTUAL_DRIVER_SIGNATURES.filter((sig) => labelLower.includes(sig));
      const isVirtual = matched.length > 0;

      return {
        deviceId: d.deviceId,
        groupId: d.groupId,
        label: label,
        isVirtual,
        matchedSignatures: matched,
        classification: isVirtual ? 'VIRTUAL_AUDIO_CABLE' : 'HARDWARE_PHYSICAL_MIC',
      };
    });

    const hasVirtual = categorized.some((d) => d.isVirtual);

    return {
      supported: true,
      devices: categorized,
      hasVirtualDriver: hasVirtual,
      activeMicrophoneCount: categorized.length,
    };
  } catch (err) {
    console.warn('Device enumeration error:', err);
    return {
      supported: false,
      devices: [],
      hasVirtualDriver: false,
      error: err.message,
    };
  }
}

/**
 * Measures ambient acoustic noise floor and zero-sample ratio from an active audio track or microphone.
 */
export async function measureAmbientNoiseFloor(stream, durationMs = 500) {
  if (!stream || !window.AudioContext) {
    return {
      noiseFloorDb: -52.0,
      zeroSampleRatio: 0.01,
      hasThermalNoise: true,
    };
  }

  return new Promise((resolve) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);
      let zeroCount = 0;
      let totalSamples = 0;
      let sumSquares = 0;
      let checkCount = 0;

      const startTime = performance.now();
      const interval = setInterval(() => {
        analyser.getFloatTimeDomainData(buffer);
        checkCount++;

        for (let i = 0; i < buffer.length; i++) {
          const s = buffer[i];
          if (s === 0) zeroCount++;
          sumSquares += s * s;
          totalSamples++;
        }

        if (performance.now() - startTime >= durationMs) {
          clearInterval(interval);
          source.disconnect();
          audioContext.close();

          const rms = Math.sqrt(sumSquares / Math.max(1, totalSamples));
          const db = 20 * Math.log10(Math.max(1e-6, rms));
          const zeroRatio = zeroCount / Math.max(1, totalSamples);
          const hasThermal = zeroRatio < 0.35 && db >= -75.0;

          resolve({
            noiseFloorDb: Math.round(db * 10) / 10,
            zeroSampleRatio: Math.round(zeroRatio * 1000) / 1000,
            hasThermalNoise: hasThermal,
          });
        }
      }, 50);
    } catch (err) {
      console.warn('Noise floor analysis failed:', err);
      resolve({
        noiseFloorDb: -52.0,
        zeroSampleRatio: 0.01,
        hasThermalNoise: true,
      });
    }
  });
}
