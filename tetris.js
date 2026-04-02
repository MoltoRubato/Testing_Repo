// Tetris game module — placeholder for initial game switcher commit
const TetrisGame = {
    running: false,
    paused: false,
    highScore: parseInt(localStorage.getItem('tetrisHighScore')) || 0,
    canvas: null,
    ctx: null,
    onScore: null,
    onEnd: null,
    onLevel: null,

    init(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.drawEmpty();
    },

    start() {
        this.drawEmpty();
        const ctx = this.ctx;
        ctx.fillStyle = '#888';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Tetris coming soon!', this.canvas.width / 2, this.canvas.height / 2);
        return { score: 0, btnText: 'Start Game' };
    },

    stop() {
        this.running = false;
    },

    handleKey() {},
    handleSwipe() {},

    drawEmpty() {
        this.ctx.fillStyle = '#0f0f23';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    },

    getInstructions() {
        return 'Arrow keys to move &bull; Up to rotate &bull; Space to hard drop &bull; P to pause';
    },
};
