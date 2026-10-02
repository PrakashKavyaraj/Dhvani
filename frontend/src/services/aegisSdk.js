/**
 * AEGIS Developer Integration Client
 * 
 * Demonstrates the tiny integration abstraction for external developers:
 * 
 * 1. Configure API Key in backend environment:
 *    AEGIS_API_KEY=your_aegis_key (in .env.institution)
 * 
 * 2. Integrate in code:
 *    import { aegis } from './services/aegisSdk';
 *    const result = await aegis.analyze(audioFile);
 */
import { analyzeAudio, DEFAULT_AEGIS_API_URL } from './aegisApiClient';

export class AegisClient {
  constructor(config = {}) {
    this.endpoint = config.endpoint || DEFAULT_AEGIS_API_URL;
  }

  /**
   * Fetches backend integration configuration status live.
   *
   * @returns {Promise<{ configured: boolean, endpoint: string, hasKey: boolean, maskedKey: string }>}
   */
  async getConfig() {
    try {
      const res = await fetch('/api/institution/config');
      if (res.ok) {
        return await res.json();
      }
    } catch (_) {}
    return { configured: false, endpoint: this.endpoint, hasKey: false, maskedKey: '' };
  }

  /**
   * Fetches the active API key from the backend environment.
   *
   * @returns {Promise<string>}
   */
  async getActiveKey() {
    try {
      const res = await fetch('/api/institution/key');
      if (res.ok) {
        const data = await res.json();
        return data.apiKey || '';
      }
    } catch (_) {}
    return '';
  }

  /**
   * Submits an audio recording to AEGIS and returns the complete multi-modal forensic analysis.
   *
   * @param {File|Blob} audioFileOrBlob - .wav audio recording
   * @param {Object} [options] - Optional progress callbacks
   * @returns {Promise<Object>} Complete AEGIS analysis result payload
   */
  async analyze(audioFileOrBlob, options = {}) {
    // Read live key configured in backend environment
    const key = (await this.getActiveKey()) || options.apiKey;
    if (!key || !key.trim()) {
      throw new Error(
        'AEGIS API Key is not configured in backend environment (.env.institution). Please configure AEGIS_API_KEY in the backend part before running analysis.'
      );
    }

    return await analyzeAudio(audioFileOrBlob, {
      apiBaseUrl: options.apiBaseUrl || this.endpoint,
      apiKey: key.trim(),
      ...options,
    });
  }
}

// Default singleton instance ready for immediate use
export const aegis = new AegisClient();
export default aegis;
