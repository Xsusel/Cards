class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.5; // Default 50%
    }

    setVolume(value) {
        // value 0.0 to 1.0
        // Use time constant to prevent clicking
        this.masterGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
    }

    playTone(freq, type, duration, vol = 0.1) {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playClick() {
        this.playTone(800, 'sine', 0.1, 0.05);
    }

    playHover() {
        this.playTone(200, 'triangle', 0.05, 0.02);
    }

    playDeal() {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playWin() {
        const now = this.ctx.currentTime;
        [440, 554.37, 659.25, 880].forEach((freq, i) => {
            setTimeout(() => {
                this.playTone(freq, 'square', 0.5, 0.1);
            }, i * 100);
        });
    }

    playPop() {
        this.playTone(600, 'sine', 0.1, 0.1);
    }
}

const soundManager = new SoundManager();
