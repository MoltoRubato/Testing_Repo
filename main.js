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
const linesDisplay = document.getElementById('lines-display');
const linesCountEl = document.getElementById('lines-count');
const shooterContainer = document.getElementById('shooter-container');
const gameArea = document.getElementById('game-area');
const scoreBoardEl = document.getElementById('score-board');
const controlsEl = document.getElementById('controls');
const tabs = document.querySelectorAll('.game-tab');

let currentGame = null;
let currentGameName = 'snake';

const games = {
    snake: SnakeGame,
    tetris: TetrisGame,
    shooter: ShooterGame,
};

const gameLabels = {
    snake: 'Snake',
    tetris: 'Tetris',
    shooter: 'Shooter',
};

function switchGame(name) {
    if (currentGame) {
        currentGame.stop();
    }

    currentGameName = name;
    currentGame = games[name];

    // Update UI
    tabs.forEach(t => t.classList.toggle('active', t.dataset.game === name));
    gameTitle.textContent = gameLabels[name];
    startBtn.textContent = 'Start Game';
    instructions.innerHTML = currentGame.getInstructions();

    // Hide everything first
    gameArea.style.display = 'none';
    shooterContainer.style.display = 'none';
    levelDisplay.style.display = 'none';
    nextPieceContainer.style.display = 'none';
    holdPieceContainer.style.display = 'none';
    linesDisplay.style.display = 'none';

    if (name === 'shooter') {
        // Shooter has its own container
        shooterContainer.style.display = '';
        scoreBoardEl.style.display = 'none';
        controlsEl.style.display = 'none';
        // Reset overlay
        const overlay = document.getElementById('shooter-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.querySelector('h2').textContent = 'FPS Shooter';
        }
        const deathScreen = document.getElementById('shooter-death-screen');
        if (deathScreen) deathScreen.style.display = 'none';
    } else {
        gameArea.style.display = 'flex';
        scoreBoardEl.style.display = 'flex';
        controlsEl.style.display = '';

        if (name === 'tetris') {
            canvas.width = 300;
            canvas.height = 600;
            levelDisplay.style.display = '';
            nextPieceContainer.style.display = '';
            holdPieceContainer.style.display = '';
            linesDisplay.style.display = '';
            levelEl.textContent = '1';
            linesCountEl.textContent = '0';
        } else {
            canvas.width = 400;
            canvas.height = 400;
        }
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
    currentGame.onLines = (lines) => { linesCountEl.textContent = lines; };

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
    // Don't intercept keys when shooter is active (it handles its own input)
    if (currentGameName === 'shooter') {
        if (e.key === 'Escape' && currentGame.running) {
            const result = currentGame.handleKey(e.key);
            if (result && result.pause) {
                startBtn.textContent = result.pause;
            }
        }
        return;
    }

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
