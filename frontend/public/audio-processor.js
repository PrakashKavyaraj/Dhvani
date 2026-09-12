/**
 * Dhvani AudioWorkletProcessor
 *
 * Real-Time 16kHz Mono PCM Audio Streamer.
 * Buffers microphone audio into 250ms chunks with 50% overlap (125ms stride),
 * converts Float32 -> Int16, and transfers binary ArrayBuffers to the main thread.
 */
class DhvaniAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleRate = 16000;
    this.chunkSize = 4000; // 250ms at 16kHz
    this.strideSize = 2000; // 125ms stride (50% overlap)

    // Internal accumulator buffer
    this.buffer = new Float32Array(this.chunkSize * 2);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const channelData = input[0]; // Mono channel 0

    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i];

      // When we have accumulated 250ms (4000 samples)
      if (this.bufferIndex >= this.chunkSize) {
        // Convert Float32 to 16-bit signed PCM (Int16)
        const int16Array = new Int16Array(this.chunkSize);
        for (let j = 0; j < this.chunkSize; j++) {
          const s = Math.max(-1, Math.min(1, this.buffer[j]));
          int16Array[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Transfer raw binary ArrayBuffer chunk to main thread
        this.port.postMessage(int16Array.buffer, [int16Array.buffer]);

        // Slide window forward by stride (50% overlap: keep last 2000 samples)
        const remaining = this.chunkSize - this.strideSize; // 2000 samples
        this.buffer.copyWithin(0, this.strideSize, this.chunkSize);
        this.bufferIndex = remaining;
      }
    }

    return true;
  }
}

registerProcessor('dhvani-audio-processor', DhvaniAudioProcessor);
