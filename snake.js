// Snake game module
const SnakeGame = {
    GRID_SIZE: 20,
    TILE_COUNT: 20,
    snake: [],
    food: { x: 0, y: 0 },
    dx: 0,
    dy: 0,
    score: 0,
    highScore: parseInt(localStorage.getItem('snakeHighScore')) || 0,
    gameLoop: null,
    running: false,
    paused: false,
    speed: 120,
    canvas: null,
    ctx: null,

    init(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.TILE_COUNT = canvas.width / this.GRID_SIZE;
        this.drawEmpty();
    },

    start() {
        if (this.running) return;
        this.running = true;
        this.paused = false;
        this.snake = [
            { x: 10, y: 10 },
            { x: 9, y: 10 },
            { x: 8, y: 10 },
        ];
        this.dx = 1;
        this.dy = 0;
        this.score = 0;
        this.speed = 120;
        this.placeFood();
        this.draw();
        this.gameLoop = setInterval(() => this.update(), this.speed);
        return { score: this.score, btnText: 'Playing...' };
    },

    stop() {
        clearInterval(this.gameLoop);
        this.running = false;
        this.paused = false;
    },

    togglePause() {
        if (!this.running) return null;
        this.paused = !this.paused;
        if (this.paused) {
            clearInterval(this.gameLoop);
            const ctx = this.ctx;
            const w = this.canvas.width, h = this.canvas.height;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#00ff88';
            ctx.font = 'bold 32px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('PAUSED', w / 2, h / 2);
            ctx.fillStyle = '#aaa';
            ctx.font = '16px sans-serif';
            ctx.fillText('Press P or Escape to resume', w / 2, h / 2 + 30);
            return 'Paused';
        } else {
            this.gameLoop = setInterval(() => this.update(), this.speed);
            return 'Playing...';
        }
    },

    handleKey(key) {
        switch (key) {
            case 'ArrowUp': case 'w': case 'W':
                if (this.dy !== 1) { this.dx = 0; this.dy = -1; } break;
            case 'ArrowDown': case 's': case 'S':
                if (this.dy !== -1) { this.dx = 0; this.dy = 1; } break;
            case 'ArrowLeft': case 'a': case 'A':
                if (this.dx !== 1) { this.dx = -1; this.dy = 0; } break;
            case 'ArrowRight': case 'd': case 'D':
                if (this.dx !== -1) { this.dx = 1; this.dy = 0; } break;
            case 'p': case 'P': case 'Escape':
                return { pause: this.togglePause() };
        }
        return null;
    },

    handleSwipe(diffX, diffY) {
        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0 && this.dx !== -1) { this.dx = 1; this.dy = 0; }
            else if (diffX < 0 && this.dx !== 1) { this.dx = -1; this.dy = 0; }
        } else {
            if (diffY > 0 && this.dy !== -1) { this.dx = 0; this.dy = 1; }
            else if (diffY < 0 && this.dy !== 1) { this.dx = 0; this.dy = -1; }
        }
    },

    placeFood() {
        let f;
        do {
            f = {
                x: Math.floor(Math.random() * this.TILE_COUNT),
                y: Math.floor(Math.random() * this.TILE_COUNT),
            };
        } while (this.snake.some(s => s.x === f.x && s.y === f.y));
        this.food = f;
    },

    update() {
        const head = { x: this.snake[0].x + this.dx, y: this.snake[0].y + this.dy };
        const T = this.TILE_COUNT;

        if (head.x < 0 || head.x >= T || head.y < 0 || head.y >= T) {
            this.onGameOver(); return;
        }
        if (this.snake.some(s => s.x === head.x && s.y === head.y)) {
            this.onGameOver(); return;
        }

        this.snake.unshift(head);

        if (head.x === this.food.x && head.y === this.food.y) {
            this.score++;
            Sound.eat();
            this.placeFood();
            if (this.speed > 60) this.speed -= 2;
            clearInterval(this.gameLoop);
            this.gameLoop = setInterval(() => this.update(), this.speed);
            if (this.onScore) this.onScore(this.score);
        } else {
            this.snake.pop();
        }

        this.draw();
    },

    onGameOver() {
        clearInterval(this.gameLoop);
        this.running = false;
        this.paused = false;
        Sound.gameOver();

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('snakeHighScore', this.highScore);
        }

        const ctx = this.ctx;
        const w = this.canvas.width, h = this.canvas.height;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over!', w / 2, h / 2 - 10);
        ctx.fillStyle = '#eee';
        ctx.font = '20px sans-serif';
        ctx.fillText(`Score: ${this.score}`, w / 2, h / 2 + 25);

        if (this.onEnd) this.onEnd(this.score, this.highScore);
    },

    draw() {
        const ctx = this.ctx;
        const G = this.GRID_SIZE, T = this.TILE_COUNT;
        const w = this.canvas.width, h = this.canvas.height;

        ctx.fillStyle = '#0f0f23';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < T; i++) {
            ctx.beginPath(); ctx.moveTo(i * G, 0); ctx.lineTo(i * G, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i * G); ctx.lineTo(w, i * G); ctx.stroke();
        }

        ctx.fillStyle = '#ff4444';
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(this.food.x * G + G / 2, this.food.y * G + G / 2, G / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        this.snake.forEach((seg, i) => {
            const b = Math.max(0.4, 1 - i * 0.03);
            if (i === 0) {
                ctx.fillStyle = '#00ff88';
                ctx.shadowColor = '#00ff88';
                ctx.shadowBlur = 6;
            } else {
                ctx.fillStyle = `rgba(0, 255, 136, ${b})`;
                ctx.shadowBlur = 0;
            }
            const p = i === 0 ? 1 : 2;
            ctx.fillRect(seg.x * G + p, seg.y * G + p, G - p * 2, G - p * 2);
        });
        ctx.shadowBlur = 0;
    },

    drawEmpty() {
        const ctx = this.ctx;
        ctx.fillStyle = '#0f0f23';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    },

    getInstructions() {
        return 'Arrow keys / WASD to move &bull; P or Esc to pause &bull; Swipe on mobile';
    },
};
