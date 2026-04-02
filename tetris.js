// Tetris game module
const TetrisGame = {
    // Board dimensions
    COLS: 10,
    ROWS: 20,
    BLOCK_SIZE: 30,
    board: [],
    currentPiece: null,
    nextPiece: null,
    score: 0,
    level: 1,
    lines: 0,
    highScore: parseInt(localStorage.getItem('tetrisHighScore')) || 0,
    gameLoop: null,
    running: false,
    paused: false,
    speed: 800,
    canvas: null,
    ctx: null,
    nextCanvas: null,
    nextCtx: null,
    onScore: null,
    onEnd: null,
    onLevel: null,
    holdPiece: null,
    canHold: true,
    dropTimer: 0,
    lastTime: 0,
    animationId: null,
    clearingLines: [],
    clearAnimFrame: 0,

    // Tetromino shapes and colors
    PIECES: [
        { shape: [[1,1,1,1]], color: '#00f5ff' },           // I - cyan
        { shape: [[1,1],[1,1]], color: '#ffff00' },          // O - yellow
        { shape: [[0,1,0],[1,1,1]], color: '#aa00ff' },      // T - purple
        { shape: [[0,1,1],[1,1,0]], color: '#00ff00' },      // S - green
        { shape: [[1,1,0],[0,1,1]], color: '#ff0000' },      // Z - red
        { shape: [[1,0,0],[1,1,1]], color: '#ff8800' },      // L - orange
        { shape: [[0,0,1],[1,1,1]], color: '#0088ff' },      // J - blue
    ],

    init(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.nextCanvas = document.getElementById('next-piece-canvas');
        this.nextCtx = this.nextCanvas.getContext('2d');
        this.holdCanvas = document.getElementById('hold-piece-canvas');
        this.holdCtx = this.holdCanvas.getContext('2d');
        this.drawEmpty();
    },

    createBoard() {
        this.board = [];
        for (let r = 0; r < this.ROWS; r++) {
            this.board.push(new Array(this.COLS).fill(0));
        }
    },

    randomPiece() {
        const idx = Math.floor(Math.random() * this.PIECES.length);
        const p = this.PIECES[idx];
        return {
            shape: p.shape.map(row => [...row]),
            color: p.color,
            x: Math.floor(this.COLS / 2) - Math.ceil(p.shape[0].length / 2),
            y: 0,
        };
    },

    start() {
        if (this.running) return null;
        this.running = true;
        this.paused = false;
        this.createBoard();
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.speed = 800;
        this.currentPiece = this.randomPiece();
        this.nextPiece = this.randomPiece();
        this.holdPiece = null;
        this.canHold = true;
        this.clearingLines = [];
        this.clearAnimFrame = 0;
        this.drawNextPiece();
        this.drawHoldPiece();
        this.lastTime = performance.now();
        this.dropTimer = 0;

        if (this.onLevel) this.onLevel(this.level);

        const loop = (time) => {
            if (!this.running || this.paused) return;
            const delta = time - this.lastTime;
            this.lastTime = time;
            this.dropTimer += delta;

            if (this.dropTimer >= this.speed) {
                this.dropTimer = 0;
                this.moveDown();
            }

            this.draw();
            this.animationId = requestAnimationFrame(loop);
        };
        this.animationId = requestAnimationFrame(loop);

        return { score: 0, btnText: 'Playing...' };
    },

    stop() {
        this.running = false;
        this.paused = false;
        cancelAnimationFrame(this.animationId);
    },

    togglePause() {
        if (!this.running) return null;
        this.paused = !this.paused;
        if (this.paused) {
            cancelAnimationFrame(this.animationId);
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
            this.lastTime = performance.now();
            this.dropTimer = 0;
            const loop = (time) => {
                if (!this.running || this.paused) return;
                const delta = time - this.lastTime;
                this.lastTime = time;
                this.dropTimer += delta;
                if (this.dropTimer >= this.speed) {
                    this.dropTimer = 0;
                    this.moveDown();
                }
                this.draw();
                this.animationId = requestAnimationFrame(loop);
            };
            this.animationId = requestAnimationFrame(loop);
            return 'Playing...';
        }
    },

    collides(piece, offsetX, offsetY, shape) {
        const s = shape || piece.shape;
        for (let r = 0; r < s.length; r++) {
            for (let c = 0; c < s[r].length; c++) {
                if (!s[r][c]) continue;
                const newX = piece.x + c + offsetX;
                const newY = piece.y + r + offsetY;
                if (newX < 0 || newX >= this.COLS || newY >= this.ROWS) return true;
                if (newY >= 0 && this.board[newY][newX]) return true;
            }
        }
        return false;
    },

    lockPiece() {
        const p = this.currentPiece;
        for (let r = 0; r < p.shape.length; r++) {
            for (let c = 0; c < p.shape[r].length; c++) {
                if (!p.shape[r][c]) continue;
                const y = p.y + r;
                const x = p.x + c;
                if (y < 0) {
                    this.gameOver();
                    return;
                }
                this.board[y][x] = p.color;
            }
        }
        Sound.tetrisDrop();
        this.canHold = true;
        this.clearLines();
        this.currentPiece = this.nextPiece;
        this.nextPiece = this.randomPiece();
        this.drawNextPiece();

        if (this.collides(this.currentPiece, 0, 0)) {
            this.gameOver();
        }
    },

    holdSwap() {
        if (!this.canHold || !this.running || this.paused) return;
        this.canHold = false;

        // Find the original piece definition to reset shape
        const currentColor = this.currentPiece.color;
        const originalPiece = this.PIECES.find(p => p.color === currentColor);

        if (this.holdPiece) {
            const held = this.holdPiece;
            this.holdPiece = {
                shape: originalPiece.shape.map(row => [...row]),
                color: currentColor,
            };
            this.currentPiece = {
                shape: held.shape.map(row => [...row]),
                color: held.color,
                x: Math.floor(this.COLS / 2) - Math.ceil(held.shape[0].length / 2),
                y: 0,
            };
        } else {
            this.holdPiece = {
                shape: originalPiece.shape.map(row => [...row]),
                color: currentColor,
            };
            this.currentPiece = this.nextPiece;
            this.nextPiece = this.randomPiece();
            this.drawNextPiece();
        }
        this.drawHoldPiece();
    },

    clearLines() {
        let cleared = 0;
        for (let r = this.ROWS - 1; r >= 0; r--) {
            if (this.board[r].every(cell => cell !== 0)) {
                this.board.splice(r, 1);
                this.board.unshift(new Array(this.COLS).fill(0));
                cleared++;
                r++; // re-check this row
            }
        }

        if (cleared > 0) {
            const points = [0, 100, 300, 500, 800];
            this.score += (points[cleared] || 800) * this.level;
            this.lines += cleared;
            Sound.lineClear();

            if (this.onScore) this.onScore(this.score);

            // Level up every 10 lines
            const newLevel = Math.floor(this.lines / 10) + 1;
            if (newLevel > this.level) {
                this.level = newLevel;
                this.speed = Math.max(100, 800 - (this.level - 1) * 75);
                Sound.levelUp();
                if (this.onLevel) this.onLevel(this.level);
            }
        }
    },

    moveDown() {
        if (!this.collides(this.currentPiece, 0, 1)) {
            this.currentPiece.y++;
        } else {
            this.lockPiece();
        }
    },

    moveLeft() {
        if (!this.collides(this.currentPiece, -1, 0)) {
            this.currentPiece.x--;
        }
    },

    moveRight() {
        if (!this.collides(this.currentPiece, 1, 0)) {
            this.currentPiece.x++;
        }
    },

    rotate() {
        const shape = this.currentPiece.shape;
        const rows = shape.length, cols = shape[0].length;
        const rotated = [];
        for (let c = 0; c < cols; c++) {
            rotated.push([]);
            for (let r = rows - 1; r >= 0; r--) {
                rotated[c].push(shape[r][c]);
            }
        }

        // Wall kick: try offsets if rotation causes collision
        const kicks = [0, -1, 1, -2, 2];
        for (const kick of kicks) {
            if (!this.collides(this.currentPiece, kick, 0, rotated)) {
                this.currentPiece.shape = rotated;
                this.currentPiece.x += kick;
                return;
            }
        }
    },

    hardDrop() {
        while (!this.collides(this.currentPiece, 0, 1)) {
            this.currentPiece.y++;
            this.score += 2;
        }
        if (this.onScore) this.onScore(this.score);
        this.lockPiece();
    },

    getGhostY() {
        let ghostY = this.currentPiece.y;
        while (!this.collides(this.currentPiece, 0, ghostY - this.currentPiece.y + 1)) {
            ghostY++;
        }
        return ghostY;
    },

    handleKey(key) {
        if (!this.running) return null;

        switch (key) {
            case 'ArrowLeft': case 'a': case 'A':
                this.moveLeft(); break;
            case 'ArrowRight': case 'd': case 'D':
                this.moveRight(); break;
            case 'ArrowDown': case 's': case 'S':
                this.moveDown();
                this.score += 1;
                if (this.onScore) this.onScore(this.score);
                break;
            case 'ArrowUp': case 'w': case 'W':
                this.rotate(); break;
            case ' ':
                this.hardDrop(); break;
            case 'c': case 'C':
                this.holdSwap(); break;
            case 'p': case 'P': case 'Escape':
                return { pause: this.togglePause() };
        }
        return null;
    },

    handleSwipe(diffX, diffY) {
        if (!this.running || this.paused) return;
        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0) this.moveRight();
            else this.moveLeft();
        } else {
            if (diffY > 0) this.hardDrop();
            else this.rotate();
        }
    },

    gameOver() {
        this.running = false;
        this.paused = false;
        cancelAnimationFrame(this.animationId);
        Sound.gameOver();

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('tetrisHighScore', this.highScore);
        }

        this.draw();
        const ctx = this.ctx;
        const w = this.canvas.width, h = this.canvas.height;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over!', w / 2, h / 2 - 20);
        ctx.fillStyle = '#eee';
        ctx.font = '20px sans-serif';
        ctx.fillText(`Score: ${this.score}`, w / 2, h / 2 + 15);
        ctx.fillText(`Lines: ${this.lines}`, w / 2, h / 2 + 45);

        if (this.onEnd) this.onEnd(this.score, this.highScore);
    },

    draw() {
        const ctx = this.ctx;
        const B = this.BLOCK_SIZE;
        const w = this.canvas.width, h = this.canvas.height;

        // Background
        ctx.fillStyle = '#0f0f23';
        ctx.fillRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 0.5;
        for (let c = 0; c <= this.COLS; c++) {
            ctx.beginPath(); ctx.moveTo(c * B, 0); ctx.lineTo(c * B, h); ctx.stroke();
        }
        for (let r = 0; r <= this.ROWS; r++) {
            ctx.beginPath(); ctx.moveTo(0, r * B); ctx.lineTo(w, r * B); ctx.stroke();
        }

        // Locked blocks
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (this.board[r][c]) {
                    this.drawBlock(c, r, this.board[r][c]);
                }
            }
        }

        if (!this.currentPiece) return;

        // Ghost piece
        const ghostY = this.getGhostY();
        const p = this.currentPiece;
        for (let r = 0; r < p.shape.length; r++) {
            for (let c = 0; c < p.shape[r].length; c++) {
                if (p.shape[r][c]) {
                    const gx = p.x + c, gy = ghostY + r;
                    if (gy >= 0) {
                        ctx.strokeStyle = p.color;
                        ctx.globalAlpha = 0.3;
                        ctx.strokeRect(gx * B + 1, gy * B + 1, B - 2, B - 2);
                        ctx.globalAlpha = 1;
                    }
                }
            }
        }

        // Current piece
        for (let r = 0; r < p.shape.length; r++) {
            for (let c = 0; c < p.shape[r].length; c++) {
                if (p.shape[r][c]) {
                    this.drawBlock(p.x + c, p.y + r, p.color);
                }
            }
        }
    },

    drawBlock(x, y, color) {
        if (y < 0) return;
        const ctx = this.ctx;
        const B = this.BLOCK_SIZE;

        ctx.fillStyle = color;
        ctx.fillRect(x * B + 1, y * B + 1, B - 2, B - 2);

        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(x * B + 1, y * B + 1, B - 2, 4);
        ctx.fillRect(x * B + 1, y * B + 1, 4, B - 2);

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(x * B + 1, y * B + B - 5, B - 2, 4);
        ctx.fillRect(x * B + B - 5, y * B + 1, 4, B - 2);
    },

    drawNextPiece() {
        const ctx = this.nextCtx;
        const canvas = this.nextCanvas;
        ctx.fillStyle = '#0f0f23';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!this.nextPiece) return;

        const shape = this.nextPiece.shape;
        const blockSize = 20;
        const offsetX = (canvas.width - shape[0].length * blockSize) / 2;
        const offsetY = (canvas.height - shape.length * blockSize) / 2;

        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    ctx.fillStyle = this.nextPiece.color;
                    ctx.fillRect(offsetX + c * blockSize + 1, offsetY + r * blockSize + 1,
                        blockSize - 2, blockSize - 2);
                    ctx.fillStyle = 'rgba(255,255,255,0.2)';
                    ctx.fillRect(offsetX + c * blockSize + 1, offsetY + r * blockSize + 1,
                        blockSize - 2, 3);
                }
            }
        }
    },

    drawHoldPiece() {
        const ctx = this.holdCtx;
        const canvas = this.holdCanvas;
        ctx.fillStyle = '#0f0f23';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!this.holdPiece) return;

        const shape = this.holdPiece.shape;
        const blockSize = 20;
        const offsetX = (canvas.width - shape[0].length * blockSize) / 2;
        const offsetY = (canvas.height - shape.length * blockSize) / 2;
        const alpha = this.canHold ? 1 : 0.4;

        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = this.holdPiece.color;
                    ctx.fillRect(offsetX + c * blockSize + 1, offsetY + r * blockSize + 1,
                        blockSize - 2, blockSize - 2);
                    ctx.fillStyle = 'rgba(255,255,255,0.2)';
                    ctx.fillRect(offsetX + c * blockSize + 1, offsetY + r * blockSize + 1,
                        blockSize - 2, 3);
                    ctx.globalAlpha = 1;
                }
            }
        }
    },

    drawEmpty() {
        this.ctx.fillStyle = '#0f0f23';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    },

    getInstructions() {
        return 'Arrow keys to move &bull; Up to rotate &bull; Space to hard drop &bull; C to hold &bull; P to pause';
    },
};
