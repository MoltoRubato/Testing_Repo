// 3D FPS Shooter Game Module
const ShooterGame = {
    running: false,
    paused: false,
    highScore: parseInt(localStorage.getItem('shooterHighScore')) || 0,
    onScore: null,
    onEnd: null,
    onLevel: null,
    onLines: null,

    // Three.js
    scene: null,
    camera: null,
    renderer: null,
    clock: null,

    // Player
    player: {
        height: 1.7,
        speed: 5,
        sprintSpeed: 8,
        health: 100,
        maxHealth: 100,
        position: null,
        velocity: null,
        yaw: 0,
        pitch: 0,
        grounded: true,
    },

    // Input
    keys: {},
    mouse: { dx: 0, dy: 0 },
    mouseDown: false,
    sensitivity: 0.002,
    pointerLocked: false,

    // Weapon
    weapon: {
        ammo: 30,
        maxAmmo: 30,
        reserve: 90,
        fireRate: 100, // ms between shots
        lastShot: 0,
        reloading: false,
        reloadTime: 2000,
        damage: 25,
        range: 100,
    },

    // Game state
    score: 0,
    kills: 0,
    wave: 1,
    enemies: [],
    bullets: [],       // visual bullet tracers
    particles: [],
    spawnTimer: 0,
    enemiesPerWave: 3,
    enemiesSpawned: 0,
    enemiesAlive: 0,
    animationId: null,

    // DOM refs
    container: null,
    viewport: null,
    overlay: null,
    deathScreen: null,

    // Arena
    arenaSize: 40,
    wallHeight: 4,
    obstacles: [],

    init(canvas, ctx) {
        // Shooter doesn't use the shared canvas
    },

    getInstructions() {
        return 'WASD to move &bull; Mouse to aim &bull; Click to shoot &bull; R to reload &bull; Shift to sprint';
    },

    setup() {
        this.container = document.getElementById('shooter-container');
        this.viewport = document.getElementById('shooter-viewport');
        this.overlay = document.getElementById('shooter-overlay');
        this.deathScreen = document.getElementById('shooter-death-screen');

        // Ensure damage flash and muzzle flash elements exist
        if (!document.getElementById('damage-flash')) {
            const df = document.createElement('div');
            df.id = 'damage-flash';
            this.container.appendChild(df);
        }
        if (!document.getElementById('muzzle-flash')) {
            const mf = document.createElement('div');
            mf.id = 'muzzle-flash';
            this.container.appendChild(mf);
        }

        // Three.js setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        this.scene.fog = new THREE.Fog(0x1a1a2e, 30, 80);

        this.camera = new THREE.PerspectiveCamera(75, 800 / 500, 0.1, 200);
        this.camera.position.set(0, this.player.height, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(800, 500);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Clear previous renderer
        this.viewport.innerHTML = '';
        this.viewport.appendChild(this.renderer.domElement);

        this.clock = new THREE.Clock();

        this.buildArena();
        this.setupLighting();
        this.setupPointerLock();

        // Initial render
        this.renderer.render(this.scene, this.camera);
    },

    setupLighting() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0x404060, 0.6);
        this.scene.add(ambient);

        // Directional "sun" light
        const sun = new THREE.DirectionalLight(0xffeedd, 0.8);
        sun.position.set(20, 30, 10);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 1024;
        sun.shadow.mapSize.height = 1024;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 80;
        sun.shadow.camera.left = -30;
        sun.shadow.camera.right = 30;
        sun.shadow.camera.top = 30;
        sun.shadow.camera.bottom = -30;
        this.scene.add(sun);

        // Point lights around arena for atmosphere
        const colors = [0x00ff88, 0x0088ff, 0xff4444, 0xffaa00];
        for (let i = 0; i < 4; i++) {
            const pl = new THREE.PointLight(colors[i], 0.5, 25);
            const angle = (i / 4) * Math.PI * 2;
            pl.position.set(
                Math.cos(angle) * (this.arenaSize * 0.4),
                3,
                Math.sin(angle) * (this.arenaSize * 0.4)
            );
            this.scene.add(pl);
        }
    },

    buildArena() {
        const S = this.arenaSize;
        const H = this.wallHeight;

        // Floor
        const floorGeo = new THREE.PlaneGeometry(S, S);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x333344,
            roughness: 0.8,
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Floor grid
        const gridHelper = new THREE.GridHelper(S, S / 2, 0x444466, 0x2a2a3e);
        this.scene.add(gridHelper);

        // Walls
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x444466,
            roughness: 0.6,
        });

        const wallConfigs = [
            { pos: [0, H / 2, -S / 2], size: [S, H, 0.5] },  // North
            { pos: [0, H / 2, S / 2], size: [S, H, 0.5] },   // South
            { pos: [-S / 2, H / 2, 0], size: [0.5, H, S] },   // West
            { pos: [S / 2, H / 2, 0], size: [0.5, H, S] },    // East
        ];

        wallConfigs.forEach(w => {
            const geo = new THREE.BoxGeometry(...w.size);
            const mesh = new THREE.Mesh(geo, wallMat);
            mesh.position.set(...w.pos);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
        });

        // Obstacles (crates/pillars)
        this.obstacles = [];
        const obstacleMat = new THREE.MeshStandardMaterial({
            color: 0x665544,
            roughness: 0.7,
        });
        const pillarMat = new THREE.MeshStandardMaterial({
            color: 0x556677,
            roughness: 0.5,
        });

        // Place crates
        const cratePositions = [
            [-8, 0, -8], [8, 0, 8], [-6, 0, 10], [10, 0, -5],
            [-12, 0, 3], [5, 0, -12], [0, 0, 7], [-3, 0, -5],
            [14, 0, 2], [-10, 0, -12], [7, 0, 14], [-14, 0, -6],
        ];

        cratePositions.forEach(pos => {
            const size = 1.2 + Math.random() * 0.8;
            const h = size * (0.8 + Math.random() * 0.6);
            const geo = new THREE.BoxGeometry(size, h, size);
            const mesh = new THREE.Mesh(geo, obstacleMat.clone());
            mesh.position.set(pos[0], h / 2, pos[2]);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            this.obstacles.push({
                mesh,
                min: { x: pos[0] - size / 2, z: pos[2] - size / 2 },
                max: { x: pos[0] + size / 2, z: pos[2] + size / 2 },
            });
        });

        // Place pillars
        const pillarPositions = [
            [-4, 0, 4], [4, 0, -4], [12, 0, 12], [-12, 0, 12],
        ];

        pillarPositions.forEach(pos => {
            const geo = new THREE.CylinderGeometry(0.6, 0.6, H, 8);
            const mesh = new THREE.Mesh(geo, pillarMat);
            mesh.position.set(pos[0], H / 2, pos[2]);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            this.obstacles.push({
                mesh,
                min: { x: pos[0] - 0.6, z: pos[2] - 0.6 },
                max: { x: pos[0] + 0.6, z: pos[2] + 0.6 },
            });
        });
    },

    setupPointerLock() {
        const el = this.viewport;

        el.addEventListener('click', () => {
            if (!this.running) {
                this.startGame();
                return;
            }
            if (!this.pointerLocked) {
                el.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.pointerLocked = document.pointerLockElement === el;
            if (!this.pointerLocked && this.running && !this.paused) {
                // Show overlay when pointer lock is lost
                this.overlay.style.display = 'flex';
                this.overlay.querySelector('h2').textContent = 'Paused';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.pointerLocked || !this.running || this.paused) return;
            this.mouse.dx += e.movementX;
            this.mouse.dy += e.movementY;
        });

        document.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.mouseDown = true;
        });
        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouseDown = false;
        });
    },

    startGame() {
        this.running = true;
        this.paused = false;
        this.score = 0;
        this.kills = 0;
        this.wave = 1;
        this.enemiesSpawned = 0;
        this.enemiesAlive = 0;
        this.enemiesPerWave = 3;
        this.spawnTimer = 0;

        // Reset player
        this.player.health = this.player.maxHealth;
        this.player.position = new THREE.Vector3(0, this.player.height, 0);
        this.player.velocity = new THREE.Vector3();
        this.player.yaw = 0;
        this.player.pitch = 0;
        this.camera.position.set(0, this.player.height, 0);

        // Reset weapon
        this.weapon.ammo = this.weapon.maxAmmo;
        this.weapon.reserve = 90;
        this.weapon.reloading = false;

        // Clear enemies
        this.enemies.forEach(e => {
            if (e.mesh) this.scene.remove(e.mesh);
            if (e.healthBar) this.scene.remove(e.healthBar);
        });
        this.enemies = [];
        this.bullets = [];
        this.particles = [];

        // Update HUD
        this.updateHUD();

        // Hide overlays
        this.overlay.style.display = 'none';
        this.deathScreen.style.display = 'none';

        // Request pointer lock
        this.viewport.requestPointerLock();

        // Start loop
        this.clock.start();
        this.lastTime = performance.now();
        this.gameLoop();
    },

    start() {
        if (this.running) return null;
        this.setup();
        // Don't auto-start, wait for pointer lock click
        return { score: 0, btnText: 'Playing...' };
    },

    stop() {
        this.running = false;
        this.paused = false;
        cancelAnimationFrame(this.animationId);
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
        // Clear enemies
        if (this.enemies) {
            this.enemies.forEach(e => {
                if (e.mesh) this.scene.remove(e.mesh);
            });
        }
        this.enemies = [];
    },

    togglePause() {
        if (!this.running) return null;
        this.paused = !this.paused;
        if (this.paused) {
            this.overlay.style.display = 'flex';
            this.overlay.querySelector('h2').textContent = 'Paused';
            if (document.pointerLockElement) document.exitPointerLock();
            return 'Paused';
        } else {
            this.overlay.style.display = 'none';
            this.viewport.requestPointerLock();
            this.clock.start();
            this.gameLoop();
            return 'Playing...';
        }
    },

    handleKey(key) {
        // Shooter handles its own input via keydown/keyup listeners
        if (key === 'p' || key === 'P' || key === 'Escape') {
            if (this.running) return { pause: this.togglePause() };
        }
        return null;
    },

    handleSwipe() {},

    // ===== GAME LOOP =====
    gameLoop() {
        if (!this.running || this.paused) return;

        const delta = this.clock.getDelta();
        const now = performance.now();

        this.updatePlayer(delta);
        this.updateShooting(now);
        this.updateEnemies(delta, now);
        this.updateBullets(delta);
        this.updateParticles(delta);
        this.spawnEnemies(delta);
        this.checkWaveProgress();

        // Update camera
        this.camera.position.copy(this.player.position);
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.player.yaw;
        this.camera.rotation.x = this.player.pitch;

        this.renderer.render(this.scene, this.camera);
        this.animationId = requestAnimationFrame(() => this.gameLoop());
    },

    // ===== PLAYER MOVEMENT =====
    updatePlayer(delta) {
        // Mouse look
        this.player.yaw -= this.mouse.dx * this.sensitivity;
        this.player.pitch -= this.mouse.dy * this.sensitivity;
        this.player.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.player.pitch));
        this.mouse.dx = 0;
        this.mouse.dy = 0;

        // Movement
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.yaw);
        const right = new THREE.Vector3(1, 0, 0);
        right.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.yaw);

        const moveDir = new THREE.Vector3();
        if (this.keys['w'] || this.keys['W'] || this.keys['ArrowUp']) moveDir.add(forward);
        if (this.keys['s'] || this.keys['S'] || this.keys['ArrowDown']) moveDir.sub(forward);
        if (this.keys['a'] || this.keys['A'] || this.keys['ArrowLeft']) moveDir.sub(right);
        if (this.keys['d'] || this.keys['D'] || this.keys['ArrowRight']) moveDir.add(right);

        if (moveDir.length() > 0) moveDir.normalize();

        const isSprinting = this.keys['Shift'];
        const speed = isSprinting ? this.player.sprintSpeed : this.player.speed;

        const newPos = this.player.position.clone();
        newPos.x += moveDir.x * speed * delta;
        newPos.z += moveDir.z * speed * delta;

        // Collision with arena walls
        const half = this.arenaSize / 2 - 0.5;
        newPos.x = Math.max(-half, Math.min(half, newPos.x));
        newPos.z = Math.max(-half, Math.min(half, newPos.z));

        // Collision with obstacles
        const playerRadius = 0.4;
        let blocked = false;
        for (const obs of this.obstacles) {
            const closestX = Math.max(obs.min.x, Math.min(newPos.x, obs.max.x));
            const closestZ = Math.max(obs.min.z, Math.min(newPos.z, obs.max.z));
            const dx = newPos.x - closestX;
            const dz = newPos.z - closestZ;
            if (dx * dx + dz * dz < playerRadius * playerRadius) {
                blocked = true;
                break;
            }
        }

        if (!blocked) {
            this.player.position.x = newPos.x;
            this.player.position.z = newPos.z;
        }

        // Head bob
        if (moveDir.length() > 0) {
            const bobSpeed = isSprinting ? 12 : 8;
            const bobAmount = isSprinting ? 0.06 : 0.03;
            this.player.position.y = this.player.height + Math.sin(performance.now() / 1000 * bobSpeed) * bobAmount;
        } else {
            this.player.position.y = this.player.height;
        }
    },

    // ===== SHOOTING =====
    updateShooting(now) {
        if (this.weapon.reloading) return;

        if (this.mouseDown && this.pointerLocked && now - this.weapon.lastShot > this.weapon.fireRate) {
            if (this.weapon.ammo <= 0) {
                this.reload();
                return;
            }

            this.weapon.ammo--;
            this.weapon.lastShot = now;
            this.updateHUD();

            // Sound
            Sound.gunshot();

            // Muzzle flash
            const mf = document.getElementById('muzzle-flash');
            if (mf) {
                mf.style.opacity = '1';
                setTimeout(() => mf.style.opacity = '0', 50);
            }

            // Raycast for hit detection
            const raycaster = new THREE.Raycaster();
            raycaster.set(this.camera.position.clone(), this.getForwardDir());
            raycaster.far = this.weapon.range;

            // Check enemy hits
            const enemyMeshes = this.enemies.filter(e => e.alive).map(e => e.mesh);
            const hits = raycaster.intersectObjects(enemyMeshes, true);

            if (hits.length > 0) {
                const hitMesh = hits[0].object;
                const enemy = this.enemies.find(e => e.mesh === hitMesh || (e.mesh && e.mesh.children && e.mesh.children.includes(hitMesh)));
                if (enemy && enemy.alive) {
                    this.damageEnemy(enemy, this.weapon.damage, hits[0].point);
                }
            }

            // Bullet tracer
            this.createBulletTracer(hits.length > 0 ? hits[0].point : null);

            // Auto-reload when empty
            if (this.weapon.ammo === 0 && this.weapon.reserve > 0) {
                setTimeout(() => this.reload(), 500);
            }
        }
    },

    getForwardDir() {
        const dir = new THREE.Vector3(0, 0, -1);
        dir.applyQuaternion(this.camera.quaternion);
        return dir.normalize();
    },

    reload() {
        if (this.weapon.reloading || this.weapon.ammo === this.weapon.maxAmmo || this.weapon.reserve <= 0) return;

        this.weapon.reloading = true;
        document.getElementById('reload-indicator').style.display = '';

        setTimeout(() => {
            const needed = this.weapon.maxAmmo - this.weapon.ammo;
            const toLoad = Math.min(needed, this.weapon.reserve);
            this.weapon.ammo += toLoad;
            this.weapon.reserve -= toLoad;
            this.weapon.reloading = false;
            document.getElementById('reload-indicator').style.display = 'none';
            this.updateHUD();
        }, this.weapon.reloadTime);
    },

    createBulletTracer(hitPoint) {
        const start = this.camera.position.clone();
        const dir = this.getForwardDir();
        const end = hitPoint || start.clone().add(dir.multiplyScalar(this.weapon.range));

        const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
        const mat = new THREE.LineBasicMaterial({
            color: 0xffff88,
            transparent: true,
            opacity: 0.6,
        });
        const line = new THREE.Line(geo, mat);
        this.scene.add(line);
        this.bullets.push({ mesh: line, life: 0.08 });

        // Hit spark particles
        if (hitPoint) {
            this.createHitParticles(hitPoint);
        }
    },

    createHitParticles(point) {
        for (let i = 0; i < 6; i++) {
            const geo = new THREE.SphereGeometry(0.05, 4, 4);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });
            const spark = new THREE.Mesh(geo, mat);
            spark.position.copy(point);
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 4,
                Math.random() * 3,
                (Math.random() - 0.5) * 4
            );
            this.scene.add(spark);
            this.particles.push({ mesh: spark, vel, life: 0.3 + Math.random() * 0.2 });
        }
    },

    // ===== ENEMIES =====
    spawnEnemies(delta) {
        if (this.enemiesSpawned >= this.enemiesPerWave) return;

        this.spawnTimer += delta;
        if (this.spawnTimer < 1.5) return; // spawn every 1.5s
        this.spawnTimer = 0;

        this.spawnEnemy();
        this.enemiesSpawned++;
    },

    spawnEnemy() {
        const S = this.arenaSize;
        let x, z;
        // Spawn at arena edges, away from player
        do {
            const side = Math.floor(Math.random() * 4);
            switch (side) {
                case 0: x = -S / 2 + 2; z = (Math.random() - 0.5) * S * 0.8; break;
                case 1: x = S / 2 - 2; z = (Math.random() - 0.5) * S * 0.8; break;
                case 2: z = -S / 2 + 2; x = (Math.random() - 0.5) * S * 0.8; break;
                case 3: z = S / 2 - 2; x = (Math.random() - 0.5) * S * 0.8; break;
            }
        } while (this.player.position.distanceTo(new THREE.Vector3(x, 0, z)) < 8);

        // Enemy body
        const group = new THREE.Group();

        // Torso
        const bodyGeo = new THREE.BoxGeometry(0.7, 1.2, 0.5);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcc3333 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.8;
        body.castShadow = true;
        group.add(body);

        // Head
        const headGeo = new THREE.SphereGeometry(0.25, 8, 6);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xddaa88 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.6;
        head.castShadow = true;
        group.add(head);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.25, 0.6, 0.3);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x333366 });
        const leftLeg = new THREE.Mesh(legGeo, legMat);
        leftLeg.position.set(-0.18, 0.3, 0);
        const rightLeg = new THREE.Mesh(legGeo, legMat);
        rightLeg.position.set(0.18, 0.3, 0);
        group.add(leftLeg, rightLeg);

        group.position.set(x, 0, z);
        this.scene.add(group);

        // Enemy health (scales with wave)
        const baseHP = 50 + (this.wave - 1) * 10;
        const speed = 2 + Math.min(this.wave * 0.3, 3);

        const enemy = {
            mesh: group,
            body,
            alive: true,
            health: baseHP,
            maxHealth: baseHP,
            speed,
            attackRange: 2.0,
            attackCooldown: 0,
            attackRate: 1000, // ms
            damage: 10 + Math.floor(this.wave / 2) * 2,
            walkPhase: Math.random() * Math.PI * 2,
        };

        this.enemies.push(enemy);
        this.enemiesAlive++;
    },

    updateEnemies(delta, now) {
        this.enemies.forEach(enemy => {
            if (!enemy.alive) return;

            const toPlayer = new THREE.Vector3();
            toPlayer.subVectors(this.player.position, enemy.mesh.position);
            toPlayer.y = 0;
            const dist = toPlayer.length();
            toPlayer.normalize();

            // Face player
            enemy.mesh.lookAt(
                this.player.position.x,
                enemy.mesh.position.y,
                this.player.position.z
            );

            // Move toward player
            if (dist > enemy.attackRange) {
                const newX = enemy.mesh.position.x + toPlayer.x * enemy.speed * delta;
                const newZ = enemy.mesh.position.z + toPlayer.z * enemy.speed * delta;

                // Simple obstacle avoidance
                let canMove = true;
                for (const obs of this.obstacles) {
                    const cx = Math.max(obs.min.x, Math.min(newX, obs.max.x));
                    const cz = Math.max(obs.min.z, Math.min(newZ, obs.max.z));
                    const ddx = newX - cx;
                    const ddz = newZ - cz;
                    if (ddx * ddx + ddz * ddz < 0.5) {
                        canMove = false;
                        // Try to go around
                        const perpX = enemy.mesh.position.x + toPlayer.z * enemy.speed * delta;
                        const perpZ = enemy.mesh.position.z - toPlayer.x * enemy.speed * delta;
                        enemy.mesh.position.x = perpX;
                        enemy.mesh.position.z = perpZ;
                        break;
                    }
                }

                if (canMove) {
                    enemy.mesh.position.x = newX;
                    enemy.mesh.position.z = newZ;
                }

                // Walking animation
                enemy.walkPhase += delta * 8;
                const leftLeg = enemy.mesh.children[2];
                const rightLeg = enemy.mesh.children[3];
                if (leftLeg && rightLeg) {
                    leftLeg.rotation.x = Math.sin(enemy.walkPhase) * 0.5;
                    rightLeg.rotation.x = -Math.sin(enemy.walkPhase) * 0.5;
                }
            }

            // Attack player
            if (dist < enemy.attackRange) {
                enemy.attackCooldown -= delta * 1000;
                if (enemy.attackCooldown <= 0) {
                    enemy.attackCooldown = enemy.attackRate;
                    this.playerTakeDamage(enemy.damage);
                }
            }
        });
    },

    damageEnemy(enemy, damage, hitPoint) {
        if (!enemy.alive) return;

        enemy.health -= damage;

        // Flash red
        enemy.body.material.emissive = new THREE.Color(0xff0000);
        setTimeout(() => {
            if (enemy.body && enemy.body.material) {
                enemy.body.material.emissive = new THREE.Color(0x000000);
            }
        }, 100);

        if (enemy.health <= 0) {
            enemy.alive = false;
            this.enemiesAlive--;
            this.kills++;
            this.score += 100 * this.wave;

            // Death particles
            for (let i = 0; i < 12; i++) {
                const geo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
                const mat = new THREE.MeshBasicMaterial({ color: 0xcc3333 });
                const part = new THREE.Mesh(geo, mat);
                part.position.copy(enemy.mesh.position);
                part.position.y = 1;
                const vel = new THREE.Vector3(
                    (Math.random() - 0.5) * 6,
                    Math.random() * 5 + 2,
                    (Math.random() - 0.5) * 6
                );
                this.scene.add(part);
                this.particles.push({ mesh: part, vel, life: 1.0 + Math.random() * 0.5 });
            }

            // Remove enemy mesh
            this.scene.remove(enemy.mesh);

            this.updateHUD();
            if (this.onScore) this.onScore(this.score);

            Sound.enemyDeath();
        }
    },

    playerTakeDamage(amount) {
        this.player.health -= amount;

        // Damage flash
        const df = document.getElementById('damage-flash');
        if (df) {
            df.style.opacity = '1';
            setTimeout(() => df.style.opacity = '0', 200);
        }

        Sound.playerHit();

        if (this.player.health <= 0) {
            this.player.health = 0;
            this.die();
        }

        this.updateHUD();
    },

    die() {
        this.running = false;
        cancelAnimationFrame(this.animationId);

        if (document.pointerLockElement) document.exitPointerLock();

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('shooterHighScore', this.highScore);
        }

        document.getElementById('death-kills').textContent = this.kills;
        document.getElementById('death-waves').textContent = this.wave;
        this.deathScreen.style.display = 'flex';

        document.getElementById('respawn-btn').onclick = () => {
            this.deathScreen.style.display = 'none';
            this.startGame();
        };

        if (this.onEnd) this.onEnd(this.score, this.highScore);
    },

    // ===== WAVE SYSTEM =====
    checkWaveProgress() {
        if (this.enemiesSpawned >= this.enemiesPerWave && this.enemiesAlive <= 0) {
            this.wave++;
            this.enemiesPerWave = 3 + Math.floor(this.wave * 1.5);
            this.enemiesSpawned = 0;
            this.spawnTimer = -1; // delay before next wave

            // Bonus ammo between waves
            this.weapon.reserve += 30;
            this.player.health = Math.min(this.player.maxHealth, this.player.health + 25);

            Sound.levelUp();
            this.updateHUD();

            if (this.onLevel) this.onLevel(this.wave);
        }
    },

    // ===== BULLETS & PARTICLES =====
    updateBullets(delta) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            this.bullets[i].life -= delta;
            if (this.bullets[i].life <= 0) {
                this.scene.remove(this.bullets[i].mesh);
                this.bullets[i].mesh.geometry.dispose();
                this.bullets[i].mesh.material.dispose();
                this.bullets.splice(i, 1);
            }
        }
    },

    updateParticles(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.vel.y -= 9.8 * delta; // gravity
            p.mesh.position.add(p.vel.clone().multiplyScalar(delta));
            p.life -= delta;
            p.mesh.material.opacity = Math.max(0, p.life);
            p.mesh.material.transparent = true;

            if (p.life <= 0 || p.mesh.position.y < 0) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.particles.splice(i, 1);
            }
        }
    },

    // ===== HUD =====
    updateHUD() {
        const hb = document.getElementById('health-bar');
        const ht = document.getElementById('health-text');
        const ac = document.getElementById('ammo-current');
        const ar = document.getElementById('ammo-reserve');
        const wn = document.getElementById('wave-number');
        const kc = document.getElementById('kill-count');

        if (hb) hb.style.width = (this.player.health / this.player.maxHealth * 100) + '%';
        if (ht) ht.textContent = Math.max(0, Math.ceil(this.player.health));
        if (ac) ac.textContent = this.weapon.ammo;
        if (ar) ar.textContent = this.weapon.reserve;
        if (wn) wn.textContent = this.wave;
        if (kc) kc.textContent = this.kills;
    },

    drawEmpty() {},
};

// Keyboard listeners for shooter (always active, checked by game state)
document.addEventListener('keydown', (e) => {
    ShooterGame.keys[e.key] = true;
    if (e.key === 'r' || e.key === 'R') {
        if (ShooterGame.running && !ShooterGame.paused) {
            ShooterGame.reload();
        }
    }
});

document.addEventListener('keyup', (e) => {
    ShooterGame.keys[e.key] = false;
});
