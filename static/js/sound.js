class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
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
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playClick() {
        // Short high blip
        this.playTone(800, 'sine', 0.1, 0.05);
    }

    playHover() {
        // Very soft low tick
        this.playTone(200, 'triangle', 0.05, 0.02);
    }

    playDeal() {
        // Whoosh effect (noise is hard, simulating with slide)
        // Using a rapid sweep
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playWin() {
        // Major chord arpeggio
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
