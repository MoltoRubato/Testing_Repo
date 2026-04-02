// Game Switcher Controller
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const startBtn = document.getElementById('start-btn');
const gameTitle = document.getElementById('game-title');
const instructions = document.getElementById('instructions');
const levelDisplay = document.getElementById('level-display');
const levelEl = document.getElementById('level');
const nextPieceContainer = document.getElementById('next-piece-container');
const holdPieceContainer = document.getElementById('hold-piece-container');
const tabs = document.querySelectorAll('.game-tab');

let currentGame = null;
let currentGameName = 'snake';

const games = {
    snake: SnakeGame,
    tetris: TetrisGame,
};

function switchGame(name) {
    if (currentGame) {
        currentGame.stop();
    }

    currentGameName = name;
    currentGame = games[name];

    // Update UI
    tabs.forEach(t => t.classList.toggle('active', t.dataset.game === name));
    gameTitle.textContent = name === 'snake' ? 'Snake' : 'Tetris';
    startBtn.textContent = 'Start Game';
    instructions.innerHTML = currentGame.getInstructions();

    // Snake uses 400x400, Tetris uses 300x600
    if (name === 'tetris') {
        canvas.width = 300;
        canvas.height = 600;
        levelDisplay.style.display = '';
        nextPieceContainer.style.display = '';
        holdPieceContainer.style.display = '';
        levelEl.textContent = '1';
    } else {
        canvas.width = 400;
        canvas.height = 400;
        levelDisplay.style.display = 'none';
        nextPieceContainer.style.display = 'none';
        holdPieceContainer.style.display = 'none';
    }

    scoreEl.textContent = '0';
    highScoreEl.textContent = currentGame.highScore || 0;

    // Wire callbacks
    currentGame.onScore = (score) => { scoreEl.textContent = score; };
    currentGame.onEnd = (score, high) => {
        scoreEl.textContent = score;
        highScoreEl.textContent = high;
        startBtn.textContent = 'Play Again';
    };
    currentGame.onLevel = (level) => { levelEl.textContent = level; };

    currentGame.init(canvas, ctx);
}

// Tab click handlers
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        switchGame(tab.dataset.game);
    });
});

// Start button
startBtn.addEventListener('click', () => {
    const result = currentGame.start();
    if (result) {
        scoreEl.textContent = result.score || 0;
        startBtn.textContent = result.btnText || 'Playing...';
    }
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }

    if (e.key === ' ' && !currentGame.running) {
        const result = currentGame.start();
        if (result) {
            scoreEl.textContent = result.score || 0;
            startBtn.textContent = result.btnText || 'Playing...';
        }
        return;
    }

    const result = currentGame.handleKey(e.key);
    if (result && result.pause) {
        startBtn.textContent = result.pause;
    }
});

// Touch controls
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffY = e.changedTouches[0].clientY - touchStartY;

    if (Math.abs(diffX) < 10 && Math.abs(diffY) < 10) {
        if (!currentGame.running) {
            const result = currentGame.start();
            if (result) {
                scoreEl.textContent = result.score || 0;
                startBtn.textContent = result.btnText || 'Playing...';
            }
        }
        return;
    }

    currentGame.handleSwipe(diffX, diffY);
    e.preventDefault();
}, { passive: false });

// Initialize with Snake
switchGame('snake');
