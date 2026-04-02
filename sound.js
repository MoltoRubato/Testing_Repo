// Shared audio system for all games
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(freq, duration, type = 'square') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.1;
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const Sound = {
    eat() { playSound(600, 0.1); playSound(800, 0.15); },
    gameOver() {
        playSound(300, 0.2, 'sawtooth');
        setTimeout(() => playSound(200, 0.3, 'sawtooth'), 150);
    },
    lineClear() { playSound(500, 0.1); playSound(700, 0.1); playSound(900, 0.15); },
    tetrisDrop() { playSound(150, 0.05, 'triangle'); },
    levelUp() {
        playSound(400, 0.1);
        setTimeout(() => playSound(600, 0.1), 100);
        setTimeout(() => playSound(800, 0.15), 200);
    },
};
