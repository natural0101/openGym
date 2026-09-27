class GymVoiceCapture extends AudioWorkletProcessor {
  constructor() { super(); this.samples = new Int16Array(2048); this.offset = 0 }
  process(inputs) {
    const samples = inputs[0]?.[0]
    if (samples) for (const value of samples) {
      this.samples[this.offset++] = Math.round(Math.max(-1, Math.min(1, value)) * 32767)
      if (this.offset === this.samples.length) {
        this.port.postMessage(this.samples.buffer, [this.samples.buffer])
        this.samples = new Int16Array(2048); this.offset = 0
      }
    }
    return true
  }
}
registerProcessor('gym-voice-capture', GymVoiceCapture)
