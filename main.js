// ============================================
// SPACE INVADERS - TOGAF EDITION (Main)
// Build limpio con Sonidos + Quiz
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
    play(name) {
        if (this.muted || !this.sounds[name]) return;
        const a = this.sounds[name];
        try { a.currentTime = 0; a.play(); } catch {}
    }
    playLooping(name) {
        if (this.muted || !this.sounds[name]) return;
        if (this.currentLooping && this.currentLooping !== name) {
            const prev = this.sounds[this.currentLooping];
            prev.pause(); prev.currentTime = 0;
        }
        const a = this.sounds[name];
        a.loop = true; a.volume = 0.5; a.currentTime = 0;
        try { a.play(); } catch {}
        this.currentLooping = name;
    }
    stopLooping() {
        if (this.currentLooping && this.sounds[this.currentLooping]) {
            const a = this.sounds[this.currentLooping];
            a.pause(); a.currentTime = 0; this.currentLooping = null;
        }
    }
    stopAll() {
        Object.values(this.sounds).forEach(a=>{ try{a.pause(); a.currentTime=0;}catch{}});
        this.currentLooping = null;
    }
    setMuted(m) { this.muted = m; if (m) this.stopAll(); }
    ensureCtx(){ if(!this.audioCtx){ this.audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } return this.audioCtx; }
    playSequence(seq,{waveform='square',volume=0.25}={}){
        if (this.muted) return Promise.resolve();
        const ctx=this.ensureCtx(); const start=ctx.currentTime+0.01; let t=start;
        const master=ctx.createGain(); master.gain.value=volume; master.connect(ctx.destination);
        for(const step of seq){ const osc=ctx.createOscillator(); const env=ctx.createGain();
            osc.type=waveform; osc.frequency.value=step.freq; osc.connect(env); env.connect(master);
            const d=step.dur; env.gain.setValueAtTime(0.0001,t); env.gain.exponentialRampToValueAtTime(volume,t+0.01);
            env.gain.exponentialRampToValueAtTime(0.0001,t+d); osc.start(t); osc.stop(t+d+0.01);
            t += d + (step.gap||0.02);
        }
        return new Promise(res=>setTimeout(res, Math.ceil((t-start)*1000)));
    }
    playLevelStart(){
        const seq=[{freq:523.25,dur:0.12},{freq:659.25,dur:0.12},{freq:783.99,dur:0.14},{freq:1046.5,dur:0.10}];
        return this.playSequence(seq,{waveform:'square',volume:0.25});
    }
}

const GameState = {
    MENU:'menu', GAME:'game', PAUSE:'pause', LEVEL_COMPLETE:'levelComplete', GAME_OVER:'gameOver',
    CONTROLS:'controls', HIGHSCORES:'highscores', LEVEL_SELECT:'levelSelect', BOSS_WARNING:'bossWarning',
    QUIZ:'quiz'
};

class Game {
    constructor(){
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 900; this.canvas.height = 550;

        this.soundManager = new SoundManager();
        this.state = GameState.MENU; this.currentLevel = 1; this.score = 0; this.lives = 3; this.isMuted=false;

        this.player=null; this.enemies=[]; this.playerBullets=[]; this.enemyBullets=[]; this.powerUps=[]; this.particles=[]; this.boss=null;
        this.keys={}; this.mousePos={x:0,y:0};

        this.levelConfig={
            1:{enemyCount:5, enemySpeed:1, fireRate:0.015, waves:1, isBoss:false},
            2:{enemyCount:8, enemySpeed:1.3, fireRate:0.02, waves:1, isBoss:false},
            3:{enemyCount:10, enemySpeed:1.5, fireRate:0.025, waves:2, isBoss:true},
            4:{enemyCount:12, enemySpeed:1.7, fireRate:0.03, waves:2, isBoss:false},
            5:{enemyCount:14, enemySpeed:2.0, fireRate:0.035, waves:2, isBoss:false},
            6:{enemyCount:16, enemySpeed:2.2, fireRate:0.04, waves:3, isBoss:true},
            7:{enemyCount:18, enemySpeed:2.4, fireRate:0.045, waves:3, isBoss:false},
            8:{enemyCount:20, enemySpeed:2.6, fireRate:0.05, waves:3, isBoss:false},
            9:{enemyCount:22, enemySpeed:2.8, fireRate:0.055, waves:3, isBoss:true},
            10:{enemyCount:25, enemySpeed:3.0, fireRate:0.06, waves:4, isBoss:true}
        };

        this.gameData = { highScores:[], lastLevelPassed:1, canContinue:false };

        // Preguntas (embebidas para evitar CORS). Se pueden ampliar.
        this.questions=[
            {id:1, question:'¿Qué es TOGAF?', answers:[
                {text:'Un framework de arquitectura empresarial', correct:true},
                {text:'Un lenguaje de programación', correct:false},
                {text:'Un motor de base de datos', correct:false}
            ]},
            {id:2, question:'¿Qué significa ADM en TOGAF?', answers:[
                {text:'Architecture Development Method', correct:true},
                {text:'Application Delivery Model', correct:false},
                {text:'Asset Design Map', correct:false}
            ]},
            {id:3, question:'¿En qué fase se define la Arquitectura de Negocio?', answers:[
                {text:'Fase B', correct:true}, {text:'Fase D', correct:false}, {text:'Fase F', correct:false}
            ]}
        ];
        this.levelAsked = {}; // para no repetir pregunta por nivel
        this.quizQueueIndex = 0;

        this.setupEventListeners();
        this.loadGameData();
        this.showMenu();
        this.gameLoop();
    }

    setupEventListeners(){
        document.addEventListener('keydown', e=>{
            this.keys[e.key.toLowerCase()]=true;
            if(e.key===' '){ e.preventDefault(); if(this.state===GameState.GAME) this.playerShoot(); }
            if(e.key.toLowerCase()==='p'){ if(this.state===GameState.GAME) this.togglePause(); else if(this.state===GameState.PAUSE) this.resume(); }
            if(e.key.toLowerCase()==='m'){ this.toggleMute(); }
        });
        document.addEventListener('keyup', e=>{ this.keys[e.key.toLowerCase()]=false; });

        const byId=id=>document.getElementById(id);
        byId('btn-new-game').addEventListener('click',()=>this.startNewGame());
        byId('btn-continue').addEventListener('click',()=>this.continueGame());
        byId('btn-select-level').addEventListener('click',()=>this.showLevelSelect());
        byId('btn-controls').addEventListener('click',()=>this.showControls());
        byId('btn-highscores').addEventListener('click',()=>this.showHighscores());
        byId('btn-back-controls').addEventListener('click',()=>this.showMenu());
        byId('btn-back-levels').addEventListener('click',()=>this.showMenu());
        byId('btn-back-scores').addEventListener('click',()=>this.showMenu());
        byId('btn-resume').addEventListener('click',()=>this.resume());
        byId('btn-restart').addEventListener('click',()=>this.restartLevel());
        byId('btn-quit').addEventListener('click',()=>this.showMenu());
        byId('btn-retry-level').addEventListener('click',()=>this.restartLevel());
        byId('btn-new-game-over').addEventListener('click',()=>this.startNewGame());
        byId('btn-menu').addEventListener('click',()=>this.showMenu());
        byId('btn-next-level').addEventListener('click',()=>this.nextLevel());

        this.canvas.addEventListener('mousemove', e=>{
            const r=this.canvas.getBoundingClientRect();
            this.mousePos.x=e.clientX-r.left; this.mousePos.y=e.clientY-r.top;
        });
    }

    // Pantallas
    showScreen(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); document.getElementById(id).classList.add('active'); }
    showMenu(){
        this.state=GameState.MENU; this.showScreen('start-screen');
        const canContinue=this.gameData.canContinue; const hasLevels=this.gameData.lastLevelPassed>1;
        document.getElementById('btn-continue').disabled=!canContinue; document.getElementById('btn-select-level').disabled=!hasLevels;
        this.soundManager.stopLooping(); this.soundManager.playLooping('Main_Menu');
    }
    showControls(){ this.state=GameState.CONTROLS; this.showScreen('controls-screen'); }
    showHighscores(){ this.state=GameState.HIGHSCORES; this.renderHighscores(); this.showScreen('highscores-screen'); }
    showLevelSelect(){ this.state=GameState.LEVEL_SELECT; this.renderLevelSelect(); this.showScreen('level-select-screen'); }

    renderLevelSelect(){
        const grid=document.getElementById('level-grid'); grid.innerHTML='';
        for(let i=1;i<=10;i++){ const btn=document.createElement('button'); btn.className='level-btn';
            const unlocked=i<=this.gameData.lastLevelPassed+1; const isBoss=this.levelConfig[i].isBoss;
            if(!unlocked) btn.disabled=true; if(isBoss){ btn.classList.add('boss-level'); btn.innerHTML=`NIVEL ${i}<div class="star">⭐</div>`;} else { btn.innerHTML=`${i}`; }
            btn.addEventListener('click',()=>{ if(unlocked){ this.currentLevel=i; this.startGame(); } }); grid.appendChild(btn);
        }
    }
    renderHighscores(){ const list=document.getElementById('highscores-list'); list.innerHTML=''; const scores=this.gameData.highScores.slice(0,10);
        if(scores.length===0){ list.innerHTML='<p style="color:#999;">NO HAY PUNTUACIONES AÚN</p>'; return; }
        scores.forEach((s,idx)=>{ const item=document.createElement('div'); item.className='score-item'; item.innerHTML=`<span class="rank">#${idx+1}</span><span class="name">${s.name||'JUGADOR'}</span><span class="score">${s.score}</span>`; list.appendChild(item); }); }

    // Juego
    startNewGame(){ this.currentLevel=1; this.score=0; this.lives=3; this.gameData.canContinue=true; this.levelAsked={}; this.startGame(); }
    continueGame(){ this.currentLevel=this.gameData.lastLevelPassed; this.startGame(); }
    startGame(){ this.state=GameState.GAME; this.showScreen('game-screen'); this.initializeLevel(); }

    initializeLevel(){
        this.enemies=[]; this.playerBullets=[]; this.enemyBullets=[]; this.powerUps=[]; this.particles=[]; this.boss=null;
        this.player=new Player(this.canvas.width/2, this.canvas.height-60, this);
        if(this.levelConfig[this.currentLevel].isBoss){ this.showBossWarning(); } else { this.spawnEnemies(); }
        // Música de inicio de nivel → loop de nivel
        this.soundManager.stopLooping();
        this.soundManager.playLevelStart().then(()=>{ if(this.state!==GameState.GAME) return; if(this.levelConfig[this.currentLevel].isBoss){ this.soundManager.playLooping('Boss'); } else { this.soundManager.playLooping('Game_Theme'); } });
        this.updateHUD();
    }

    showBossWarning(){ this.state=GameState.BOSS_WARNING; this.showScreen('boss-warning'); this.soundManager.play('UFO'); setTimeout(()=>{ this.state=GameState.GAME; this.showScreen('game-screen'); this.spawnBoss(); },3000); }
    spawnEnemies(){ const cfg=this.levelConfig[this.currentLevel]; const n=cfg.enemyCount; const startY=30; const spacing=(this.canvas.width-80)/(n-1);
        for(let i=0;i<n;i++){ const x=40+i*spacing; const y=startY; const type=i%3; this.enemies.push(new Enemy(x,y,type,this)); } }
    spawnBoss(){ this.boss=new Boss(this.canvas.width/2,50,this); }

    updateHUD(){ document.getElementById('score').textContent=this.score; document.getElementById('level').textContent=this.currentLevel;
        document.getElementById('lives').textContent=''.padEnd(this.lives,'❤️');
        document.getElementById('active-powerup').textContent=this.player&&this.player.activePowerUp?`⚡ ${this.player.activePowerUp.toUpperCase()}`:''; }

    playerShoot(){ if(this.player && this.state===GameState.GAME){ this.player.shoot(); this.soundManager.play('Shot'); } }
    togglePause(){ this.state=GameState.PAUSE; this.showScreen('pause-screen'); }
    resume(){ this.state=GameState.GAME; this.showScreen('game-screen'); }
    restartLevel(){ this.state=GameState.GAME; this.initializeLevel(); this.showScreen('game-screen'); }
    nextLevel(){ if(this.currentLevel<10){ this.currentLevel++; this.gameData.lastLevelPassed=Math.max(this.gameData.lastLevelPassed,this.currentLevel-1); this.startGame(); } else { this.showGameWon(); } }

    gameOver(){ this.state=GameState.GAME_OVER; this.gameData.canContinue=false; this.addHighScore(this.score); this.saveGameData();
        document.getElementById('final-score').textContent=this.score; document.getElementById('final-level').textContent=this.currentLevel; this.showScreen('gameover-screen'); this.soundManager.stopAll(); this.soundManager.play('Game_Over'); }
    levelComplete(){ this.state=GameState.LEVEL_COMPLETE; this.gameData.canContinue=true; this.gameData.lastLevelPassed=this.currentLevel; this.saveGameData();
        document.getElementById('level-score').textContent=this.score; document.getElementById('time-bonus').textContent=500; document.getElementById('enemies-killed').textContent=this.levelConfig[this.currentLevel].enemyCount;
        this.score+=500; this.soundManager.stopAll(); this.soundManager.play('Level_Win'); this.showScreen('level-complete-screen'); }
    showGameWon(){ this.state=GameState.GAME_OVER; document.querySelector('#gameover-screen .gameover-title').textContent='¡JUEGO COMPLETADO!'; this.soundManager.stopAll(); this.soundManager.play('Game_Win'); this.gameOver(); }

    toggleMute(){ this.isMuted=!this.isMuted; this.soundManager.setMuted(this.isMuted); }

    // Datos
    saveGameData(){ localStorage.setItem('spaceInvadersData', JSON.stringify(this.gameData)); }
    loadGameData(){ const s=localStorage.getItem('spaceInvadersData'); if(s){ this.gameData=JSON.parse(s); } }
    addHighScore(score){ this.gameData.highScores.push({score,name:'JUGADOR',date:new Date().toLocaleDateString()}); this.gameData.highScores.sort((a,b)=>b.score-a.score); this.gameData.highScores=this.gameData.highScores.slice(0,10); this.saveGameData(); }

    // Loop
    gameLoop(){ if(this.state===GameState.GAME){ this.update(); this.draw(); } requestAnimationFrame(()=>this.gameLoop()); }

    update(){ if(!this.player) return; this.player.update(this.keys);
        this.enemies.forEach(e=>e.update()); if(this.boss) this.boss.update();
        this.playerBullets=this.playerBullets.filter(b=>{ b.update(); return b.y>0; });
        this.enemyBullets=this.enemyBullets.filter(b=>{ b.update(); return b.y<this.canvas.height; });
        this.powerUps=this.powerUps.filter(p=>{ p.update(); return p.y<this.canvas.height; });
        this.particles=this.particles.filter(p=>{ p.update(); return p.life>0; });
        this.checkCollisions(); this.checkEnemyCollisions(); this.checkPowerUpCollisions();
        if(this.enemies.length===0 && !this.boss){ this.askQuestionThenComplete(); }
        if(this.boss && this.boss.health<=0){ this.soundManager.play('Boss_Explosion'); this.createExplosion(this.boss.x+this.boss.width/2, this.boss.y+this.boss.height/2,'player'); this.createExplosion(this.boss.x,this.boss.y,'enemy'); this.boss=null; this.levelComplete(); }
        this.updateHUD();
    }

    askQuestionThenComplete(){
        if(this.levelConfig[this.currentLevel].isBoss) { this.levelComplete(); return; }
        if(this.levelAsked[this.currentLevel]){ this.levelComplete(); return; }
        const q=this.questions[this.quizQueueIndex % this.questions.length]; this.quizQueueIndex++; this.levelAsked[this.currentLevel]=true; this.showQuiz(q);
    }

    showQuiz(q){
        this.state=GameState.QUIZ; this.showScreen('quiz-screen');
        const qEl=document.getElementById('quiz-question'); const optEl=document.getElementById('quiz-options'); const fb=document.getElementById('quiz-feedback');
        qEl.textContent=q.question; optEl.innerHTML=''; fb.textContent='';
        q.answers.forEach(ans=>{ const b=document.createElement('button'); b.className='quiz-option-btn'; b.textContent=ans.text; b.addEventListener('click',()=>{ this.handleAnswer(ans.correct,b, optEl, fb); }); optEl.appendChild(b); });
    }

    handleAnswer(correct, btn, optEl, fb){
        Array.from(optEl.children).forEach(c=>c.disabled=true);
        if(correct){ btn.classList.add('correct'); fb.textContent='¡Correcto! +500 puntos'; this.score+=500; this.lives=Math.min(this.lives+1,5); this.soundManager.play('Correct_Answer'); this.soundManager.play('Player_Win_Life'); }
        else { btn.classList.add('incorrect'); fb.textContent='Incorrecto... -200 puntos'; this.score=Math.max(0,this.score-200); this.soundManager.play('Incorrect_Answer'); }
        setTimeout(()=>{ this.state=GameState.GAME; this.levelComplete(); }, 1200);
    }

    checkCollisions(){
        for(let i=this.playerBullets.length-1;i>=0;i--){ const b=this.playerBullets[i];
            for(let j=this.enemies.length-1;j>=0;j--){ const e=this.enemies[j]; if(this.isColliding(b,e)){ this.playerBullets.splice(i,1); e.takeDamage(1);
                    if(e.health<=0){ this.score+=e.points; this.enemies.splice(j,1); this.createExplosion(e.x,e.y,'enemy'); this.soundManager.play('Enemy_Died'); if(Math.random()<0.15){ const t=Math.random()<0.5?'shield':'rapidfire'; this.powerUps.push(new PowerUp(e.x,e.y,t,this)); } }
                    break; }
            }
            if(this.boss && i<this.playerBullets.length){ const bb=this.playerBullets[i]; if(this.isColliding(bb,this.boss)){ this.playerBullets.splice(i,1); this.boss.takeDamage(1); this.score+=10; this.createExplosion(bb.x,bb.y,'hit'); this.soundManager.play('Enemy_Died'); } }
        }
    }

    checkEnemyCollisions(){ for(let i=this.enemyBullets.length-1;i>=0;i--){ const b=this.enemyBullets[i]; if(this.isColliding(b,this.player)){ this.enemyBullets.splice(i,1); if(!this.player.shieldActive){ this.lives--; this.createExplosion(this.player.x,this.player.y,'player'); this.soundManager.play('Player_Lost_Life'); if(this.lives<=0){ this.gameOver(); } } else { this.player.shieldHealth--; if(this.player.shieldHealth<=0){ this.player.shieldActive=false; } } } } }
    checkPowerUpCollisions(){ for(let i=this.powerUps.length-1;i>=0;i--){ const p=this.powerUps[i]; if(this.isColliding(p,this.player)){ this.powerUps.splice(i,1); this.player.activatePowerUp(p.type); this.createExplosion(p.x,p.y,'powerup'); if(p.type==='shield'){ this.soundManager.play('Shield_Activate'); } else { this.soundManager.play('Coin'); } this.score+=100; } } }

    isColliding(a,b){ return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }
    createExplosion(x,y,type){ const n= type==='player'?20: type==='enemy'?12: 5; for(let i=0;i<n;i++){ this.particles.push(new Particle(x,y,type)); } }

    draw(){ this.ctx.fillStyle='rgba(0,0,0,0.2)'; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); this.drawGrid();
        if(this.player) this.player.draw(this.ctx); this.enemies.forEach(e=>e.draw(this.ctx)); this.playerBullets.forEach(b=>b.draw(this.ctx)); this.enemyBullets.forEach(b=>b.draw(this.ctx)); this.powerUps.forEach(p=>p.draw(this.ctx)); this.particles.forEach(p=>p.draw(this.ctx)); if(this.boss) this.boss.draw(this.ctx); }
    drawGrid(){ const g=50; this.ctx.strokeStyle='rgba(0,255,0,0.03)'; this.ctx.lineWidth=1; for(let x=0;x<this.canvas.width;x+=g){ this.ctx.beginPath(); this.ctx.moveTo(x,0); this.ctx.lineTo(x,this.canvas.height); this.ctx.stroke(); } for(let y=0;y<this.canvas.height;y+=g){ this.ctx.beginPath(); this.ctx.moveTo(0,y); this.ctx.lineTo(this.canvas.width,y); this.ctx.stroke(); } }
}

// ENTIDADES
class Player{ constructor(x,y,game){ this.x=x; this.y=y; this.width=40; this.height=40; this.speed=5; this.game=game; this.fireRate=0.08; this.fireTimer=0; this.activePowerUp=null; this.powerUpTimer=0; this.shieldActive=false; this.shieldHealth=3; this.rapidFireActive=false; }
    update(keys){ if(keys['arrowleft']||keys['a']) this.x=Math.max(0,this.x-this.speed); if(keys['arrowright']||keys['d']) this.x=Math.min(this.game.canvas.width-this.width,this.x+this.speed); this.fireTimer--; if(this.activePowerUp){ this.powerUpTimer--; if(this.powerUpTimer<=0){ this.activePowerUp=null; this.rapidFireActive=false; } } }
    shoot(){ if(this.fireTimer<=0){ this.game.playerBullets.push(new PlayerBullet(this.x+this.width/2,this.y,this.game)); this.fireTimer= this.rapidFireActive?2: Math.floor(this.fireRate*60); } }
    activatePowerUp(type){ if(type==='shield'){ this.shieldActive=true; this.shieldHealth=3; this.activePowerUp='ESCUDO'; this.powerUpTimer=300; } else if(type==='rapidfire'){ this.rapidFireActive=true; this.activePowerUp='FUEGO RÁPIDO'; this.powerUpTimer=240; } }
    draw(ctx){ ctx.fillStyle='#00ff00'; ctx.beginPath(); ctx.moveTo(this.x+this.width/2,this.y); ctx.lineTo(this.x+this.width,this.y+this.height); ctx.lineTo(this.x+this.width-10,this.y+this.height-10); ctx.lineTo(this.x+this.width/2,this.y+this.height-5); ctx.lineTo(this.x+10,this.y+this.height-10); ctx.lineTo(this.x,this.y+this.height); ctx.closePath(); ctx.fill(); if(this.shieldActive){ ctx.strokeStyle=`rgba(0,150,255,${0.3+(this.shieldHealth/3)*0.4})`; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(this.x+this.width/2,this.y+this.height/2,this.width+20,0,Math.PI*2); ctx.stroke(); } if(this.rapidFireActive){ ctx.fillStyle='#ffcc00'; ctx.beginPath(); ctx.moveTo(this.x+10,this.y+this.height); ctx.lineTo(this.x+15,this.y+this.height+8); ctx.lineTo(this.x+20,this.y+this.height); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(this.x+this.width-10,this.y+this.height); ctx.lineTo(this.x+this.width-15,this.y+this.height+8); ctx.lineTo(this.x+this.width-20,this.y+this.height); ctx.closePath(); ctx.fill(); } }
}
class PlayerBullet{ constructor(x,y,game){ this.x=x; this.y=y; this.width=4; this.height=15; this.speed=7; this.game=game; } update(){ this.y-=this.speed; } draw(ctx){ ctx.fillStyle='#00ff00'; ctx.fillRect(this.x-this.width/2,this.y,this.width,this.height); ctx.strokeStyle='#00ff00'; ctx.lineWidth=1; ctx.globalAlpha=0.5; ctx.strokeRect(this.x-this.width/2,this.y,this.width,this.height); ctx.globalAlpha=1; } }
class Enemy{ constructor(x,y,type,game){ this.x=x; this.y=y; this.type=type; this.game=game; this.width=30; this.height=30; this.health=1; this.points=40; const cfg=game.levelConfig[game.currentLevel]; this.baseSpeed=cfg.enemySpeed; this.fireRate=cfg.fireRate; this.fireTimer=Math.random()*100; this.direction=1; this.moveCounter=0; this.moveDistance=30; if(type===0){ this.movePattern='linear'; } else if(type===1){ this.movePattern='sine'; this.amplitude=20; this.frequency=0.05; this.phase=0; } else { this.movePattern='zigzag'; } }
    update(){ if(this.movePattern==='linear'){ this.x+=this.baseSpeed*this.direction; this.moveCounter++; if(this.moveCounter>this.moveDistance){ this.moveCounter=0; this.direction*=-1; this.y+=20; } } else if(this.movePattern==='sine'){ this.x+=this.baseSpeed*this.direction; this.phase+=this.frequency; this.y+=Math.sin(this.phase)*0.5; } else { this.x+=this.baseSpeed*this.direction; this.moveCounter++; if(this.moveCounter>20){ this.moveCounter=0; this.direction*=-1; } this.y+=0.3; } if(this.x<0) this.x=0; if(this.x+this.width>this.game.canvas.width) this.x=this.game.canvas.width-this.width; this.fireTimer--; if(this.fireTimer<=0){ this.game.enemyBullets.push(new EnemyBullet(this.x+this.width/2,this.y+this.height,this.game)); this.fireTimer=Math.floor(1/this.fireRate); } if(this.y>this.game.canvas.height){ this.game.gameOver(); } }
    takeDamage(d){ this.health-=d; }
    draw(ctx){ ctx.fillStyle='#ff3333'; if(this.type===0){ ctx.fillRect(this.x,this.y,this.width,this.height); } else if(this.type===1){ ctx.fillRect(this.x+10,this.y,10,this.height); ctx.fillRect(this.x,this.y+10,this.width,10); } else { ctx.beginPath(); ctx.moveTo(this.x+this.width/2,this.y); ctx.lineTo(this.x+this.width,this.y+this.height); ctx.lineTo(this.x,this.y+this.height); ctx.closePath(); ctx.fill(); } ctx.fillStyle='#ffff00'; ctx.fillRect(this.x+8,this.y+8,4,4); ctx.fillRect(this.x+18,this.y+8,4,4); }
}
class EnemyBullet{ constructor(x,y,game){ this.x=x; this.y=y; this.width=4; this.height=12; this.speed=4; this.game=game; } update(){ this.y+=this.speed; } draw(ctx){ ctx.fillStyle='#ff6666'; ctx.fillRect(this.x-this.width/2,this.y,this.width,this.height); } }
class Boss{ constructor(x,y,game){ this.x=x; this.y=y; this.width=80; this.height=60; this.game=game; this.health=30; this.maxHealth=30; this.fireRate=0.04; this.fireTimer=0; this.moveDirection=1; this.moveCounter=0; }
    update(){ this.x+=this.moveDirection*2; if(this.x<50||this.x+this.width>this.game.canvas.width-50){ this.moveDirection*=-1; } this.fireTimer--; if(this.fireTimer<=0){ for(let i=-2;i<=2;i++){ this.game.enemyBullets.push(new EnemyBullet(this.x+this.width/2+(i*15), this.y+this.height, this.game)); } this.fireTimer=Math.floor(1/this.fireRate); } }
    takeDamage(d){ this.health-=d; }
    draw(ctx){ ctx.fillStyle='#ff0000'; ctx.fillRect(this.x,this.y,this.width,this.height); ctx.fillStyle='#ffcc00'; ctx.fillRect(this.x+10,this.y+5,15,15); ctx.fillRect(this.x+this.width-25,this.y+5,15,15); ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(this.x+25,this.y+20,5,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(this.x+55,this.y+20,5,0,Math.PI*2); ctx.fill(); const barW=80, barH=8; ctx.strokeStyle='#00ff00'; ctx.lineWidth=2; ctx.strokeRect(this.x,this.y-15,barW,barH); ctx.fillStyle='#00ff00'; const hp=this.health/this.maxHealth; ctx.fillRect(this.x,this.y-15,barW*hp,barH); }
}
class PowerUp{ constructor(x,y,type,game){ this.x=x; this.y=y; this.type=type; this.game=game; this.width=20; this.height=20; this.speed=2; this.rotation=0; }
    update(){ this.y+=this.speed; this.rotation+=0.1; }
    draw(ctx){ ctx.save(); ctx.translate(this.x+this.width/2,this.y+this.height/2); ctx.rotate(this.rotation); if(this.type==='shield'){ ctx.fillStyle='#0099ff'; ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#00ccff'; ctx.lineWidth=2; ctx.stroke(); } else { ctx.fillStyle='#ffcc00'; ctx.fillRect(-8,-8,16,16); ctx.fillStyle='#ff9900'; ctx.fillRect(-5,-5,10,10); } ctx.restore(); }
}
class Particle{ constructor(x,y,type){ this.x=x; this.y=y; this.type=type; this.life=1; this.maxLife=1; this.vx=(Math.random()-0.5)*4; this.vy=(Math.random()-0.5)*4; this.color= type==='player'?'#00ff00': type==='enemy'?'#ff3333': type==='powerup'?'#ffcc00':'#ffffff'; this.size=Math.random()*3+2; }
    update(){ this.x+=this.vx; this.y+=this.vy; this.vy+=0.1; this.life-=0.02; }
    draw(ctx){ ctx.fillStyle=this.color; ctx.globalAlpha=this.life; ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
}

window.addEventListener('DOMContentLoaded',()=>{ new Game(); });
