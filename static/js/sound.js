class SoundManager {
    constructor() {
        this.enabled = true;
        this.ctx = null;
        this.masterGain = null;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
                this.masterGain = this.ctx.createGain();
                this.masterGain.connect(this.ctx.destination);
                this.masterGain.gain.value = 0.5; // Default 50%
            } else {
                console.warn('Web Audio API not supported.');
                this.enabled = false;
            }
        } catch (e) {
            console.error('Error initializing AudioContext:', e);
            this.enabled = false;
        }
    }

    // Helper to resume context on user gesture
    resumeContext() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(e => console.warn('Failed to resume AudioContext:', e));
        }
    }

    setVolume(value) {
        if (!this.enabled || !this.ctx || !this.masterGain) return;
        // value 0.0 to 1.0
        try {
            this.masterGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
        } catch (e) {
             console.warn('Error setting volume:', e);
        }
    }

    playTone(freq, type, duration, vol = 0.1) {
        if (!this.enabled || !this.ctx) return;

        this.resumeContext();

        try {
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
        } catch(e) {
            console.warn("Audio play failed", e);
        }
    }

    playClick() {
        this.playTone(800, 'sine', 0.1, 0.05);
    }

    playHover() {
        this.playTone(200, 'triangle', 0.05, 0.02);
    }

    playDeal() {
        if (!this.enabled || !this.ctx) return;
        this.resumeContext();

        try {
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
        } catch (e) {
            console.warn("Audio deal failed", e);
        }
    }

    playWin() {
        if (!this.enabled || !this.ctx) return;

        try {
            [440, 554.37, 659.25, 880].forEach((freq, i) => {
                setTimeout(() => {
                    this.playTone(freq, 'square', 0.5, 0.1);
                }, i * 100);
            });
        } catch(e) {
             console.warn("Win sound failed", e);
        }
    }

    playPop() {
        this.playTone(600, 'sine', 0.1, 0.1);
    }

    playTurnAlert() {
        // Distinct chime for "Your Turn"
        if (!this.enabled || !this.ctx) return;
        this.resumeContext();
        try {
            // Ding-Dong effect
            const now = this.ctx.currentTime;
            this.playTone(600, 'sine', 0.5, 0.2); // Ding
            setTimeout(() => this.playTone(450, 'sine', 0.8, 0.2), 300); // Dong
        } catch(e) {
            console.warn("Turn alert failed", e);
        }
    }

    playFanfare() {
        // Epic fanfare for "You are Czar"
        if (!this.enabled || !this.ctx) return;
        this.resumeContext();
        try {
            const now = this.ctx.currentTime;
            // Trumpet-like sequence: Ta-da-da-DAAA!
            const type = 'sawtooth';
            // Note frequencies roughly: C4, E4, G4, C5
            const vol = 0.15;

            this.playTone(523.25, type, 0.1, vol); // C5
            setTimeout(() => this.playTone(523.25, type, 0.1, vol), 150);
            setTimeout(() => this.playTone(523.25, type, 0.1, vol), 300);
            setTimeout(() => this.playTone(698.46, type, 0.6, vol), 450); // F5
        } catch(e) {
            console.warn("Fanfare failed", e);
        }
    }
}

const soundManager = new SoundManager();
