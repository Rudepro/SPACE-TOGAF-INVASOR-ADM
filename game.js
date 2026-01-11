// ============================================
// SPACE INVADERS - TOGAF EDITION
// Motor completo del juego
// ============================================

class GameState {
    static MENU = 'menu';
    toggleMute() {
        this.isMuted = !this.isMuted;
        this.soundManager.setMuted(this.isMuted);
    }

    playSound(soundName) {
        if (!this.isMuted) {
            this.soundManager.play(soundName);
        }
    }
        };

        this.setupEventListeners();
        this.loadGameData();
        this.showMenu();
    }

    setupEventListeners() {
        // Teclado
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;

            if (e.key === ' ') {
                e.preventDefault();
                if (this.state === GameState.GAME) {
                    this.playerShoot();
                }
            }
            if (e.key.toLowerCase() === 'p') {
                if (this.state === GameState.GAME) {
                    this.togglePause();
                } else if (this.state === GameState.PAUSE) {
                    this.resume();
                }
            }
            if (e.key.toLowerCase() === 'm') {
                this.toggleMute();
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        // Botones del menú
        document.getElementById('btn-new-game').addEventListener('click', () => this.startNewGame());
        document.getElementById('btn-continue').addEventListener('click', () => this.continueGame());
        document.getElementById('btn-select-level').addEventListener('click', () => this.showLevelSelect());
        document.getElementById('btn-controls').addEventListener('click', () => this.showControls());
        document.getElementById('btn-highscores').addEventListener('click', () => this.showHighscores());

        document.getElementById('btn-back-controls').addEventListener('click', () => this.showMenu());
        document.getElementById('btn-back-levels').addEventListener('click', () => this.showMenu());
        document.getElementById('btn-back-scores').addEventListener('click', () => this.showMenu());

        document.getElementById('btn-resume').addEventListener('click', () => this.resume());
        document.getElementById('btn-restart').addEventListener('click', () => this.restartLevel());
        document.getElementById('btn-quit').addEventListener('click', () => this.showMenu());

        document.getElementById('btn-retry-level').addEventListener('click', () => this.restartLevel());
        document.getElementById('btn-new-game-over').addEventListener('click', () => this.startNewGame());
        document.getElementById('btn-menu').addEventListener('click', () => this.showMenu());

        document.getElementById('btn-next-level').addEventListener('click', () => this.nextLevel());

        // Canvas para detectar posición del mouse
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mousePos.x = e.clientX - rect.left;
            this.mousePos.y = e.clientY - rect.top;
        });
    }

    // ============================================
    // GESTIÓN DE PANTALLAS
    // ============================================

    showMenu() {
        this.state = GameState.MENU;
        this.showScreen('start-screen');
        
        // Actualizar disponibilidad de botones
        const canContinue = this.gameData.canContinue;
        const hasLevels = this.gameData.lastLevelPassed > 1;
        
        document.getElementById('btn-continue').disabled = !canContinue;
        document.getElementById('btn-select-level').disabled = !hasLevels;
        
        // Reproducir música de menú
        this.soundManager.stopLooping();
        this.soundManager.playLooping('Main_Menu');
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    showControls() {
        this.state = GameState.CONTROLS;
        this.showScreen('controls-screen');
    }

    showHighscores() {
        this.state = GameState.HIGHSCORES;
        this.renderHighscores();
        this.showScreen('highscores-screen');
    }

    showLevelSelect() {
        this.state = GameState.LEVEL_SELECT;
        this.renderLevelSelect();
        this.showScreen('level-select-screen');
    }

    renderLevelSelect() {
        const grid = document.getElementById('level-grid');
        grid.innerHTML = '';

        for (let i = 1; i <= 10; i++) {
            const btn = document.createElement('button');
            btn.className = 'level-btn';
            
            const unlocked = i <= this.gameData.lastLevelPassed + 1;
            const isBoss = this.levelConfig[i].isBoss;

            if (!unlocked) {
                btn.disabled = true;
            }

            if (isBoss) {
                btn.classList.add('boss-level');
                btn.innerHTML = `NIVEL ${i}<div class="star">⭐</div>`;
            } else {
                btn.innerHTML = `${i}`;
            }

            btn.addEventListener('click', () => {
                if (unlocked) {
                    this.currentLevel = i;
                    this.startGame();
                }
            });

            grid.appendChild(btn);
        }
    }

    renderHighscores() {
        const list = document.getElementById('highscores-list');
        list.innerHTML = '';

        const scores = this.gameData.highScores.slice(0, 10);

        if (scores.length === 0) {
            list.innerHTML = '<p style="color: #999;">NO HAY PUNTUACIONES AÚN</p>';
            return;
        }

        scores.forEach((score, index) => {
            const item = document.createElement('div');
            item.className = 'score-item';
            item.innerHTML = `
                <span class="rank">#${index + 1}</span>
                <span class="name">${score.name || 'JUGADOR'}</span>
                <span class="score">${score.score}</span>
            `;
            list.appendChild(item);
        });
    }

    // ============================================
    // GESTIÓN DEL JUEGO
    // ============================================

    startNewGame() {
        this.currentLevel = 1;
        this.score = 0;
        this.lives = 3;
        this.gameData.canContinue = true;
        this.startGame();
    }

    continueGame() {
        this.currentLevel = this.gameData.lastLevelPassed;
        this.startGame();
    }

    startGame() {
        this.state = GameState.GAME;
        this.showScreen('game-screen');
        this.initializeLevel();
        this.gameLoop();
    }

    initializeLevel() {
        this.enemies = [];
        this.playerBullets = [];
        this.enemyBullets = [];
        this.powerUps = [];
        this.particles = [];
        this.boss = null;

        // Crear jugador
        this.player = new Player(
            this.canvas.width / 2,
            this.canvas.height - 60,
            this
        );

        // Mostrar advertencia de jefe si es necesario
        if (this.levelConfig[this.currentLevel].isBoss) {
            this.showBossWarning();
        } else {
            this.spawnEnemies();
        }

        // Secuencia musical de inicio de nivel y luego música de fondo
        this.soundManager.stopLooping();
        this.soundManager.playLevelStart().then(() => {
            if (this.state !== GameState.GAME) return;
            if (this.levelConfig[this.currentLevel].isBoss) {
                this.soundManager.playLooping('Boss');
            } else {
                this.soundManager.playLooping('Game_Theme');
            }
        });

        this.updateHUD();
    }

    showBossWarning() {
        this.state = GameState.BOSS_WARNING;
        this.showScreen('boss-warning');
        this.playSound('UFO');
        
        setTimeout(() => {
            this.state = GameState.GAME;
            this.showScreen('game-screen');
            this.spawnBoss();
        }, 3000);
    }

    spawnEnemies() {
        const config = this.levelConfig[this.currentLevel];
        const enemyCount = config.enemyCount;
        const startY = 30;
        const spacingX = (this.canvas.width - 80) / (enemyCount - 1);

        for (let i = 0; i < enemyCount; i++) {
            const x = 40 + (i * spacingX);
            const y = startY;
            const type = i % 3; // 3 tipos de enemigos

            this.enemies.push(new Enemy(x, y, type, this));
        }
    }

    spawnBoss() {
        this.boss = new Boss(this.canvas.width / 2, 50, this);
    }

    updateHUD() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.currentLevel;
        
        let livesDisplay = '';
        for (let i = 0; i < this.lives; i++) {
            livesDisplay += '❤️';
        }
        document.getElementById('lives').textContent = livesDisplay;

        if (this.player && this.player.activePowerUp) {
            document.getElementById('active-powerup').textContent = 
                `⚡ ${this.player.activePowerUp.toUpperCase()}`;
        } else {
            document.getElementById('active-powerup').textContent = '';
        }
    }

    playerShoot() {
        if (this.player && this.state === GameState.GAME) {
            this.player.shoot();
            this.playSound('Shot');
        }
    }

    togglePause() {
        this.state = GameState.PAUSE;
        this.showScreen('pause-screen');
    }

    resume() {
        this.state = GameState.GAME;
        this.showScreen('game-screen');
    }

    restartLevel() {
        this.state = GameState.GAME;
        this.initializeLevel();
        this.showScreen('game-screen');
    }

    nextLevel() {
        if (this.currentLevel < 10) {
            this.currentLevel++;
            this.gameData.lastLevelPassed = Math.max(this.gameData.lastLevelPassed, this.currentLevel - 1);
            this.startGame();
        } else {
            this.showGameWon();
        }
    }

    gameOver() {
        this.state = GameState.GAME_OVER;
        this.gameData.canContinue = false;
        
        // Guardar puntuación
        this.addHighScore(this.score);
        this.saveGameData();

        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-level').textContent = this.currentLevel;
        
        this.showScreen('gameover-screen');
        this.playSound('gameover');
    }

    levelComplete() {
        this.state = GameState.LEVEL_COMPLETE;
        this.gameData.canContinue = true;
        this.gameData.lastLevelPassed = this.currentLevel;
        this.saveGameData();

        document.getElementById('level-score').textContent = this.score;
        document.getElementById('time-bonus').textContent = 500;
        document.getElementById('enemies-killed').textContent = 
            this.levelConfig[this.currentLevel].enemyCount;

        this.score += 500; // Bonus por completar nivel
        this.playSound('levelcomplete');
        
        this.showScreen('level-complete-screen');
    }

    showGameWon() {
        this.state = GameState.GAME_OVER;
        document.getElementById('gameover-screen').querySelector('.gameover-title').textContent = 
            '¡JUEGO COMPLETADO!';
        this.gameOver();
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.soundManager.setMuted(this.isMuted);
    }

    playSound(soundName) {
        if (!this.isMuted) {
            this.soundManager.play(soundName);
        }
    }

    // ============================================
    // DATOS PERSISTENTES
    // ============================================

    saveGameData() {
        localStorage.setItem('spaceInvadersData', JSON.stringify(this.gameData));
    }

    loadGameData() {
        const saved = localStorage.getItem('spaceInvadersData');
        if (saved) {
            this.gameData = JSON.parse(saved);
        }
    }

    addHighScore(score) {
        this.gameData.highScores.push({ score, name: 'JUGADOR', date: new Date().toLocaleDateString() });
        this.gameData.highScores.sort((a, b) => b.score - a.score);
        this.gameData.highScores = this.gameData.highScores.slice(0, 10);
        this.saveGameData();
    }

    // ============================================
    // LOOP PRINCIPAL
    // ============================================

    gameLoop() {
        if (this.state === GameState.GAME) {
            this.update();
            this.draw();
        }
        requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        if (!this.player) return;

        // Actualizar jugador
        this.player.update(this.keys);

        // Actualizar enemigos
        this.enemies.forEach(enemy => enemy.update());

        // Actualizar jefe
        if (this.boss) {
            this.boss.update();
        }

        // Actualizar proyectiles del jugador
        this.playerBullets = this.playerBullets.filter(bullet => {
            bullet.update();
            return bullet.y > 0;
        });

        // Actualizar proyectiles de enemigos
        this.enemyBullets = this.enemyBullets.filter(bullet => {
            bullet.update();
            return bullet.y < this.canvas.height;
        });

        // Actualizar power-ups
        this.powerUps = this.powerUps.filter(powerUp => {
            powerUp.update();
            return powerUp.y < this.canvas.height;
        });

        // Actualizar partículas
        this.particles = this.particles.filter(particle => {
            particle.update();
            return particle.life > 0;
        });

        // Colisiones: proyectiles del jugador con enemigos
        this.checkCollisions();

        // Colisiones: proyectiles de enemigos con jugador
        this.checkEnemyCollisions();

        // Colisiones: power-ups con jugador
        this.checkPowerUpCollisions();

        // Verificar si todos los enemigos fueron destruidos
        if (this.enemies.length === 0 && !this.boss) {
            this.levelComplete();
        }

        // Verificar si el jefe fue destruido
        if (this.boss && this.boss.health <= 0) {
            this.playSound('Boss_Explosion');
            this.createExplosion(this.boss.x + this.boss.width/2, this.boss.y + this.boss.height/2, 'player');
            this.createExplosion(this.boss.x, this.boss.y, 'enemy');
            this.boss = null;
            this.levelComplete();
        }

        this.updateHUD();
    }

    checkCollisions() {
        for (let i = this.playerBullets.length - 1; i >= 0; i--) {
            const bullet = this.playerBullets[i];

            // Colisión con enemigos
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const enemy = this.enemies[j];

                if (this.isColliding(bullet, enemy)) {
                    this.playerBullets.splice(i, 1);
                    enemy.takeDamage(1);

                    if (enemy.health <= 0) {
                        this.score += enemy.points;
                        this.enemies.splice(j, 1);
                        this.createExplosion(enemy.x, enemy.y, 'enemy');
                            this.playSound('Enemy_Died');

                        // Chance de soltar power-up
                        if (Math.random() < 0.15) {
                            const powerUpType = Math.random() < 0.5 ? 'shield' : 'rapidfire';
                            this.powerUps.push(new PowerUp(enemy.x, enemy.y, powerUpType, this));
                        }
                    }
                    break;
                }
            }

            // Colisión con jefe
            if (this.boss && i < this.playerBullets.length) {
                const bullet = this.playerBullets[i];
                if (this.isColliding(bullet, this.boss)) {
                    this.playerBullets.splice(i, 1);
                    this.boss.takeDamage(1);
                    this.score += 10;
                    this.createExplosion(bullet.x, bullet.y, 'hit');
                    this.playSound('Enemy_Died');
                }
            }
        }
    }

    checkEnemyCollisions() {
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const bullet = this.enemyBullets[i];

            if (this.isColliding(bullet, this.player)) {
                this.enemyBullets.splice(i, 1);

                if (!this.player.shieldActive) {
                    this.lives--;
                    this.createExplosion(this.player.x, this.player.y, 'player');
                        this.playSound('Player_Lost_Life');

                    if (this.lives <= 0) {
                        this.gameOver();
                    }
                } else {
                    this.player.shieldHealth--;
                    if (this.player.shieldHealth <= 0) {
                        this.player.shieldActive = false;
                    }
                }
            }
        }
    }

    checkPowerUpCollisions() {
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];

            if (this.isColliding(powerUp, this.player)) {
                this.powerUps.splice(i, 1);
                this.player.activatePowerUp(powerUp.type);
                this.createExplosion(powerUp.x, powerUp.y, 'powerup');
                if (powerUp.type === 'shield') {
                    this.playSound('Shield_Activate');
                } else {
                    this.playSound('Coin');
                }
                this.score += 100;
            }
        }
    }

    isColliding(obj1, obj2) {
        return obj1.x < obj2.x + obj2.width &&
               obj1.x + obj1.width > obj2.x &&
               obj1.y < obj2.y + obj2.height &&
               obj1.y + obj1.height > obj2.y;
    }

    createExplosion(x, y, type) {
        const particleCount = type === 'player' ? 20 : type === 'enemy' ? 12 : 5;
        for (let i = 0; i < particleCount; i++) {
            this.particles.push(new Particle(x, y, type));
        }
    }

    draw() {
        // Limpiar canvas
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Dibujar rejilla de fondo
        this.drawGrid();

        // Dibujar entidades
        if (this.player) this.player.draw(this.ctx);

        this.enemies.forEach(enemy => enemy.draw(this.ctx));
        this.playerBullets.forEach(bullet => bullet.draw(this.ctx));
        this.enemyBullets.forEach(bullet => bullet.draw(this.ctx));
        this.powerUps.forEach(powerUp => powerUp.draw(this.ctx));
        this.particles.forEach(particle => particle.draw(this.ctx));

        if (this.boss) this.boss.draw(this.ctx);
    }

    drawGrid() {
        const gridSize = 50;
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.03)';
        this.ctx.lineWidth = 1;

        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
}

// ============================================
// CLASES DE ENTIDADES
// ============================================

class Player {
    constructor(x, y, game) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 40;
        this.speed = 5;
        this.game = game;

        this.fireRate = 0.08;
        this.fireTimer = 0;

        this.activePowerUp = null;
        this.powerUpTimer = 0;
        this.shieldActive = false;
        this.shieldHealth = 3;
        this.rapidFireActive = false;
    }

    update(keys) {
        if (keys['arrowleft'] || keys['a']) {
            this.x = Math.max(0, this.x - this.speed);
        }
        if (keys['arrowright'] || keys['d']) {
            this.x = Math.min(this.game.canvas.width - this.width, this.x + this.speed);
        }

        this.fireTimer--;

        // Actualizar power-up
        if (this.activePowerUp) {
            this.powerUpTimer--;
            if (this.powerUpTimer <= 0) {
                this.activePowerUp = null;
                this.rapidFireActive = false;
            }
        }
    }

    shoot() {
        if (this.fireTimer <= 0) {
            this.game.playerBullets.push(new PlayerBullet(this.x + this.width / 2, this.y, this.game));
            
            if (this.rapidFireActive) {
                this.fireTimer = 2;
            } else {
                this.fireTimer = Math.floor(this.fireRate * 60);
            }
        }
    }

    activatePowerUp(type) {
        if (type === 'shield') {
            this.shieldActive = true;
            this.shieldHealth = 3;
            this.activePowerUp = 'ESCUDO';
            this.powerUpTimer = 300; // 5 segundos a 60fps
        } else if (type === 'rapidfire') {
            this.rapidFireActive = true;
            this.activePowerUp = 'FUEGO RÁPIDO';
            this.powerUpTimer = 240; // 4 segundos
        }
    }

    draw(ctx) {
        // Nave del jugador
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.lineTo(this.x + this.width - 10, this.y + this.height - 10);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height - 5);
        ctx.lineTo(this.x + 10, this.y + this.height - 10);
        ctx.lineTo(this.x, this.y + this.height);
        ctx.closePath();
        ctx.fill();

        // Escudo si está activo
        if (this.shieldActive) {
            ctx.strokeStyle = `rgba(0, 150, 255, ${0.3 + (this.shieldHealth / 3) * 0.4})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width + 20, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Indicador de fuego rápido
        if (this.rapidFireActive) {
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.moveTo(this.x + 10, this.y + this.height);
            ctx.lineTo(this.x + 15, this.y + this.height + 8);
            ctx.lineTo(this.x + 20, this.y + this.height);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(this.x + this.width - 10, this.y + this.height);
            ctx.lineTo(this.x + this.width - 15, this.y + this.height + 8);
            ctx.lineTo(this.x + this.width - 20, this.y + this.height);
            ctx.closePath();
            ctx.fill();
        }
    }
}

class PlayerBullet {
    constructor(x, y, game) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 15;
        this.speed = 7;
        this.game = game;
    }

    update() {
        this.y -= this.speed;
    }

    draw(ctx) {
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
        
        // Brillo
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.strokeRect(this.x - this.width / 2, this.y, this.width, this.height);
        ctx.globalAlpha = 1;
    }
}

class Enemy {
    constructor(x, y, type, game) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.game = game;
        this.width = 30;
        this.height = 30;
        this.health = 1;
        this.points = 40;

        const config = game.levelConfig[game.currentLevel];
        this.baseSpeed = config.enemySpeed;
        this.fireRate = config.fireRate;
        this.fireTimer = Math.random() * 100;

        // Movimiento
        this.direction = 1;
        this.moveCounter = 0;
        this.moveDistance = 30;

        switch (type) {
            case 0: // Patrón lineal
                this.movePattern = 'linear';
                break;
            case 1: // Patrón sinusoidal
                this.movePattern = 'sine';
                this.amplitude = 20;
                this.frequency = 0.05;
                this.phase = 0;
                break;
            case 2: // Patrón de zigzag
                this.movePattern = 'zigzag';
                break;
        }
    }

    update() {
        // Movimiento específico según patrón
        if (this.movePattern === 'linear') {
            this.x += this.baseSpeed * this.direction;
            this.moveCounter++;

            if (this.moveCounter > this.moveDistance) {
                this.moveCounter = 0;
                this.direction *= -1;
                this.y += 20;
            }
        } else if (this.movePattern === 'sine') {
            this.x += this.baseSpeed * this.direction;
            this.phase += this.frequency;
            this.y += Math.sin(this.phase) * 0.5;
        } else if (this.movePattern === 'zigzag') {
            this.x += this.baseSpeed * this.direction;
            this.moveCounter++;

            if (this.moveCounter > 20) {
                this.moveCounter = 0;
                this.direction *= -1;
            }
            this.y += 0.3;
        }

        // Mantener dentro de límites
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > this.game.canvas.width) {
            this.x = this.game.canvas.width - this.width;
        }

        // Disparar
        this.fireTimer--;
        if (this.fireTimer <= 0) {
            this.game.enemyBullets.push(new EnemyBullet(this.x + this.width / 2, this.y + this.height, this.game));
            this.fireTimer = Math.floor(1 / this.fireRate);
        }

        // Game over si el enemigo llega a la base
        if (this.y > this.game.canvas.height) {
            this.game.gameOver();
        }
    }

    takeDamage(damage) {
        this.health -= damage;
    }

    draw(ctx) {
        ctx.fillStyle = '#ff3333';
        
        // Dibujar enemigo con formas diferentes según tipo
        if (this.type === 0) {
            // Forma cuadrada
            ctx.fillRect(this.x, this.y, this.width, this.height);
        } else if (this.type === 1) {
            // Forma de cruz
            ctx.fillRect(this.x + 10, this.y, 10, this.height);
            ctx.fillRect(this.x, this.y + 10, this.width, 10);
        } else {
            // Forma de triángulo
            ctx.beginPath();
            ctx.moveTo(this.x + this.width / 2, this.y);
            ctx.lineTo(this.x + this.width, this.y + this.height);
            ctx.lineTo(this.x, this.y + this.height);
            ctx.closePath();
            ctx.fill();
        }

        // Ojos
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(this.x + 8, this.y + 8, 4, 4);
        ctx.fillRect(this.x + 18, this.y + 8, 4, 4);
    }
}

class EnemyBullet {
    constructor(x, y, game) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 12;
        this.speed = 4;
        this.game = game;
    }

    update() {
        this.y += this.speed;
    }

    draw(ctx) {
        ctx.fillStyle = '#ff6666';
        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
    }
}

class Boss {
    constructor(x, y, game) {
        this.x = x;
        this.y = y;
        this.width = 80;
        this.height = 60;
        this.game = game;
        this.health = 30;
        this.maxHealth = 30;

        this.fireRate = 0.04;
        this.fireTimer = 0;

        this.moveDirection = 1;
        this.moveCounter = 0;
    }

    update() {
        // Movimiento
        this.x += this.moveDirection * 2;
        if (this.x < 50 || this.x + this.width > this.game.canvas.width - 50) {
            this.moveDirection *= -1;
        }

        // Patrón de disparo múltiple
        this.fireTimer--;
        if (this.fireTimer <= 0) {
            for (let i = -2; i <= 2; i++) {
                this.game.enemyBullets.push(
                    new EnemyBullet(this.x + this.width / 2 + (i * 15), this.y + this.height, this.game)
                );
            }
            this.fireTimer = Math.floor(1 / this.fireRate);
        }
    }

    takeDamage(damage) {
        this.health -= damage;
    }

    draw(ctx) {
        // Cuerpo principal
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Decoración
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(this.x + 10, this.y + 5, 15, 15);
        ctx.fillRect(this.x + this.width - 25, this.y + 5, 15, 15);

        // Ojos
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(this.x + 25, this.y + 20, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x + 55, this.y + 20, 5, 0, Math.PI * 2);
        ctx.fill();

        // Barra de salud
        const healthBarWidth = 80;
        const healthBarHeight = 8;
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y - 15, healthBarWidth, healthBarHeight);

        ctx.fillStyle = '#00ff00';
        const healthPercent = this.health / this.maxHealth;
        ctx.fillRect(this.x, this.y - 15, healthBarWidth * healthPercent, healthBarHeight);
    }
}

class PowerUp {
    constructor(x, y, type, game) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.game = game;
        this.width = 20;
        this.height = 20;
        this.speed = 2;
        this.rotation = 0;
    }

    update() {
        this.y += this.speed;
        this.rotation += 0.1;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation);

        if (this.type === 'shield') {
            ctx.fillStyle = '#0099ff';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#00ccff';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (this.type === 'rapidfire') {
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(-8, -8, 16, 16);
            ctx.fillStyle = '#ff9900';
            ctx.fillRect(-5, -5, 10, 10);
        }

        ctx.restore();
    }
}

class Particle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.life = 1;
        this.maxLife = 1;

        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;

        if (type === 'player') {
            this.color = '#00ff00';
        } else if (type === 'enemy') {
            this.color = '#ff3333';
        } else if (type === 'powerup') {
            this.color = '#ffcc00';
        } else {
            this.color = '#ffffff';
        }

        this.size = Math.random() * 3 + 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // Gravedad
        this.life -= 0.02;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// ============================================
// INICIALIZAR JUEGO
// ============================================

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
});

    checkPowerUpCollisions() {
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];

            if (this.isColliding(powerUp, this.player)) {
                this.powerUps.splice(i, 1);
                this.player.activatePowerUp(powerUp.type);
                this.createExplosion(powerUp.x, powerUp.y, 'powerup');
                this.playSound('Coin');
                this.score += 100;
            }
        }
    }

    gameOver() {
        this.state = GameState.GAME_OVER;
        this.gameData.canContinue = false;
        this.soundManager.stopAll();
        
        // Guardar puntuación
        this.addHighScore(this.score);
        this.saveGameData();

        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-level').textContent = this.currentLevel;
        
        this.showScreen('gameover-screen');
        this.playSound('Game_Over');
    }

    levelComplete() {
        this.state = GameState.LEVEL_COMPLETE;
        this.gameData.canContinue = true;
        this.gameData.lastLevelPassed = this.currentLevel;
        this.saveGameData();

        document.getElementById('level-score').textContent = this.score;
        document.getElementById('time-bonus').textContent = 500;
        document.getElementById('enemies-killed').textContent = 
            this.levelConfig[this.currentLevel].enemyCount;

        this.score += 500; // Bonus por completar nivel
        this.soundManager.stopAll();
        this.playSound('Level_Win');
        
        this.showScreen('level-complete-screen');
    }

    showGameWon() {
        this.state = GameState.GAME_OVER;
        document.getElementById('gameover-screen').querySelector('.gameover-title').textContent = 
            '¡JUEGO COMPLETADO!';
        this.soundManager.stopAll();
        this.playSound('Game_Win');
        this.gameOver();
    }

// ============================================
// GESTOR DE SONIDOS
// ============================================

class SoundManager {
    constructor() {
        this.sounds = {};
        this.currentLooping = null;
        this.muted = false;
        this.audioCtx = null;
        this.initializeSounds();
    }

    initializeSounds() {
        const soundNames = [
            'Boss', 'Coin', 'Correct_Answer', 'Incorrect_Answer', 'Enemy_Died',
            'Game_Over', 'Game_Theme', 'Game_Win', 'Level_Win', 'Main_Menu',
            'Player_Lost_Life', 'Player_Win_Life', 'Shot', 'UFO',
            'Boss_Explosion', 'Shield_Activate'
        ];

        soundNames.forEach(name => {
            const audio = new Audio(`sounds/${name}.mp3`);
            audio.preload = 'auto';
            this.sounds[name] = audio;
        });
    }

    play(soundName) {
        if (this.muted || !this.sounds[soundName]) return;

        try {
            const audio = this.sounds[soundName];
            audio.currentTime = 0;
            audio.play().catch(err => {
                console.log('No se pudo reproducir sonido:', soundName, err);
            });
        } catch (e) {
            console.log('Error al reproducir sonido:', e);
        }
    }

    playLooping(soundName) {
        if (this.muted || !this.sounds[soundName]) return;

        try {
            // Detener sonido anterior
            if (this.currentLooping && this.currentLooping !== soundName) {
                this.sounds[this.currentLooping].pause();
                this.sounds[this.currentLooping].currentTime = 0;
            }

            const audio = this.sounds[soundName];
            audio.loop = true;
            audio.volume = 0.5;
            audio.currentTime = 0;
            audio.play().catch(err => {
                console.log('No se pudo reproducir sonido:', soundName, err);
            });
            this.currentLooping = soundName;
        } catch (e) {
            console.log('Error al reproducir sonido looping:', e);
        }
    }

    stopLooping() {
        if (this.currentLooping && this.sounds[this.currentLooping]) {
            this.sounds[this.currentLooping].pause();
            this.sounds[this.currentLooping].currentTime = 0;
            this.currentLooping = null;
        }
    }

    stopAll() {
        Object.values(this.sounds).forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        this.currentLooping = null;
    }

    setMuted(muted) {
        this.muted = muted;
        if (muted) {
            this.stopAll();
        }
    }

    // --- Síntesis para Level_Start ---
    ensureCtx() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioCtx;
    }

    playSequence(sequence, options = {}) {
        if (this.muted) return Promise.resolve();
        const ctx = this.ensureCtx();
        const waveform = options.waveform || 'square';
        const volume = options.volume ?? 0.3;

        const startAt = ctx.currentTime + 0.01;
        let t = startAt;
        const master = ctx.createGain();
        master.gain.value = volume;
        master.connect(ctx.destination);

        sequence.forEach(step => {
            const osc = ctx.createOscillator();
            const env = ctx.createGain();
            osc.type = waveform;
            osc.frequency.value = step.freq;
            osc.connect(env);
            env.connect(master);

            const d = step.dur;
            env.gain.setValueAtTime(0.0001, t);
            env.gain.exponentialRampToValueAtTime(volume, t + 0.01);
            env.gain.exponentialRampToValueAtTime(0.0001, t + d);

            osc.start(t);
            osc.stop(t + d + 0.01);
            t += d + (step.gap || 0.02);
        });

        return new Promise(resolve => setTimeout(resolve, Math.ceil((t - startAt) * 1000)));
    }

    playLevelStart() {
        // Pequeña fanfarria estilo arcade (original, no del juego)
        const seq = [
            { freq: 523.25, dur: 0.12 }, // C5
            { freq: 659.25, dur: 0.12 }, // E5
            { freq: 783.99, dur: 0.14 }, // G5
            { freq: 1046.5, dur: 0.10 }, // C6
        ];
        return this.playSequence(seq, { waveform: 'square', volume: 0.25 });
    }
}

class GameState {
