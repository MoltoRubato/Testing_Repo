const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const startBtn = document.getElementById('start-btn');

const GRID_SIZE = 20;
const TILE_COUNT = canvas.width / GRID_SIZE;

let snake = [];
let food = { x: 0, y: 0 };
let dx = 0;
let dy = 0;
let score = 0;
let highScore = parseInt(localStorage.getItem('snakeHighScore')) || 0;
let gameLoop = null;
let gameRunning = false;
let speed = 120;

highScoreEl.textContent = highScore;

function initGame() {
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
    ];
    dx = 1;
    dy = 0;
    score = 0;
    speed = 120;
    scoreEl.textContent = score;
    placeFood();
}

function placeFood() {
    let newFood;
    do {
        newFood = {
            x: Math.floor(Math.random() * TILE_COUNT),
            y: Math.floor(Math.random() * TILE_COUNT),
        };
    } while (snake.some(seg => seg.x === newFood.x && seg.y === newFood.y));
    food = newFood;
}

function update() {
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // Wall collision
    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
        gameOver();
        return;
    }

    // Self collision
    if (snake.some(seg => seg.x === head.x && seg.y === head.y)) {
        gameOver();
        return;
    }

    snake.unshift(head);

    // Eat food
    if (head.x === food.x && head.y === food.y) {
        score++;
        scoreEl.textContent = score;
        placeFood();
        // Speed up slightly
        if (speed > 60) {
            speed -= 2;
        }
        clearInterval(gameLoop);
        gameLoop = setInterval(update, speed);
    } else {
        snake.pop();
    }

    draw();
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#0f0f23';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines (subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < TILE_COUNT; i++) {
        ctx.beginPath();
        ctx.moveTo(i * GRID_SIZE, 0);
        ctx.lineTo(i * GRID_SIZE, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * GRID_SIZE);
        ctx.lineTo(canvas.width, i * GRID_SIZE);
        ctx.stroke();
    }

    // Draw food
    ctx.fillStyle = '#ff4444';
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(
        food.x * GRID_SIZE + GRID_SIZE / 2,
        food.y * GRID_SIZE + GRID_SIZE / 2,
        GRID_SIZE / 2 - 2,
        0,
        Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw snake
    snake.forEach((segment, index) => {
        const brightness = Math.max(0.4, 1 - index * 0.03);
        if (index === 0) {
            ctx.fillStyle = '#00ff88';
            ctx.shadowColor = '#00ff88';
            ctx.shadowBlur = 6;
        } else {
            ctx.fillStyle = `rgba(0, 255, 136, ${brightness})`;
            ctx.shadowBlur = 0;
        }
        const padding = index === 0 ? 1 : 2;
        ctx.fillRect(
            segment.x * GRID_SIZE + padding,
            segment.y * GRID_SIZE + padding,
            GRID_SIZE - padding * 2,
            GRID_SIZE - padding * 2
        );
    });
    ctx.shadowBlur = 0;
}

function gameOver() {
    clearInterval(gameLoop);
    gameRunning = false;
    startBtn.textContent = 'Play Again';

    if (score > highScore) {
        highScore = score;
        highScoreEl.textContent = highScore;
        localStorage.setItem('snakeHighScore', highScore);
    }

    // Draw game over overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillStyle = '#eee';
    ctx.font = '20px sans-serif';
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 25);
}

function startGame() {
    if (gameRunning) return;
    gameRunning = true;
    startBtn.textContent = 'Playing...';
    initGame();
    draw();
    gameLoop = setInterval(update, speed);
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            if (dy !== 1) { dx = 0; dy = -1; }
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            if (dy !== -1) { dx = 0; dy = 1; }
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            if (dx !== 1) { dx = -1; dy = 0; }
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            if (dx !== -1) { dx = 1; dy = 0; }
            break;
    }

    // Prevent scrolling with arrow keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }
});

startBtn.addEventListener('click', startGame);

// Touch controls for mobile
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
        if (!gameRunning) startGame();
        return;
    }

    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0 && dx !== -1) { dx = 1; dy = 0; }
        else if (diffX < 0 && dx !== 1) { dx = -1; dy = 0; }
    } else {
        if (diffY > 0 && dy !== -1) { dx = 0; dy = 1; }
        else if (diffY < 0 && dy !== 1) { dx = 0; dy = -1; }
    }
    e.preventDefault();
}, { passive: false });

// Spacebar to start/restart
document.addEventListener('keydown', (e) => {
    if (e.key === ' ' && !gameRunning) {
        startGame();
    }
});

// Draw initial empty board
draw();
