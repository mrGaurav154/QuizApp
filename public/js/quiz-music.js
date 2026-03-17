/**
 * quiz-music.js
 * Procedurally generated ambient background music for the quiz.
 * Uses the Web Audio API — no external files needed.
 * 
 * API:
 *   window.startMusic()         - Start playing
 *   window.stopMusic()          - Stop playing
 *   window.toggleMusic()        - Toggle mute
 *   window.setUrgencyMode(bool) - Speed up music when timer is low
 */

(function() {
    let audioCtx = null;
    let masterGain = null;
    let muted = false;
    let playing = false;
    let urgency = false;
    let oscillators = [];
    let scheduledNotes = [];
    let nextNoteTime = 0;
    let timerInterval = null;

    // Musical scale: soft pentatonic in C (C D E G A)
    const C_PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00];

    function getAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            masterGain.gain.setValueAtTime(0.08, audioCtx.currentTime); // very soft
            masterGain.connect(audioCtx.destination);
        }
        return audioCtx;
    }

    function playNote(freq, startTime, duration) {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        // Smooth fade in/out (envelope)
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, startTime + duration);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.1);
    }

    function scheduleNotes() {
        const ctx = getAudioContext();
        const tempo = urgency ? 0.3 : 0.7; // faster notes in urgency mode
        
        while (nextNoteTime < ctx.currentTime + 0.5) {
            // Pick a random note from the scale
            const note = C_PENTATONIC[Math.floor(Math.random() * C_PENTATONIC.length)];
            // Occasionally go an octave up for variation
            const freq = Math.random() > 0.7 ? note * 2 : note;
            
            playNote(freq, nextNoteTime, tempo * 0.8);
            nextNoteTime += tempo;
        }
    }

    window.startMusic = function() {
        if (playing) return;
        playing = true;
        muted = false;

        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        nextNoteTime = ctx.currentTime + 0.1;
        timerInterval = setInterval(scheduleNotes, 200);

        // Show the music button now that quiz is active
        const btn = document.getElementById('musicMuteBtn');
        if (btn) btn.classList.replace('hidden', 'flex');
    };

    window.stopMusic = function() {
        if (!playing) return;
        playing = false;
        clearInterval(timerInterval);
        if (masterGain) {
            masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
        }
    };

    window.toggleMusic = function() {
        if (!audioCtx) return;
        muted = !muted;
        masterGain.gain.setValueAtTime(muted ? 0 : 0.08, audioCtx.currentTime);

        // Update icon
        const icon = document.getElementById('musicIcon');
        if (icon) {
            icon.setAttribute('data-lucide', muted ? 'volume-x' : 'volume-2');
            if (window.lucide) lucide.createIcons();
        }
    };

    window.setUrgencyMode = function(isUrgent) {
        urgency = isUrgent;
        // Also increase overall volume slightly for drama
        if (masterGain) {
            masterGain.gain.setValueAtTime(isUrgent ? 0.14 : 0.08, audioCtx.currentTime);
        }
    };
})();
