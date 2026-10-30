// =====================================================================
// CONFIG: todos los valores ajustables del juego en un solo lugar.
// Cambia un numero, guarda y recarga el navegador para sentir la diferencia.
// =====================================================================
const CONFIG = {
  TILE_SIZE: 32,
  USE_TEST_MAP: false,     // true = sala de prueba (TEST_LEVEL), false = nivel completo (LEVEL)
  GAME_TITLE: 'GANCHO',    // nombre en la pantalla de titulo
  RETURN_TIME_LIMIT: 60,   // segundos para volver a la puerta despues de tomar la llave
  SOUND_VOLUME: 0.15,      // 0 = sin sonido

  // --- Movimiento ---
  GRAVITY: 1400,           // + = caidas mas rapidas y pesadas
  MOVE_SPEED: 220,         // velocidad maxima caminando (px/s)
  GROUND_ACCEL: 2400,      // + = arranca y frena mas seco en el suelo
  AIR_ACCEL: 1100,         // + = mas control en el aire
  MAX_FALL_SPEED: 900,     // limite de velocidad de caida

  // --- Salto ---
  JUMP_VELOCITY: 480,      // altura del salto (480 = ~2.5 bloques)
  JUMP_CUT: 0.45,          // al soltar el salto antes, la subida se multiplica por esto (- = salto corto mas corto)
  COYOTE_TIME: 0.1,        // segundos que aun puedes saltar despues de dejar el borde
  JUMP_BUFFER: 0.12,       // segundos que se recuerda un salto presionado antes de tocar el suelo

  // --- Gancho ---
  HOOK_RANGE: 320,         // alcance en px (288 = 9 bloques)
  HOOK_UP_BIAS: 0.4,       // + = prefiere objetivos mas arriba sobre los mas cercanos
  HOOK_BOX_PRIORITY: 200,  // px de ventaja que tienen las cajas al elegir objetivo (si hay una a tu alcance, se elige primero)
  HOOK_PULL_SPEED: 420,    // velocidad al jalarte hacia un anclaje de muro
  SWING_GRAVITY: 1000,     // gravedad mientras cuelgas (+ = pendulo mas rapido)
  SWING_BOOST: 400,        // impulso al presionar izquierda/derecha colgado
  SWING_MAX_SPEED: 360,    // velocidad maxima colgado; tambien es la maxima al soltar
  SWING_MIN_LENGTH: 48,    // largo minimo de la cuerda
  ROPE_RETRACT: 0.4,       // al engancharte la cuerda se recoge hasta esta fraccion (te levanta del suelo)
  ROPE_REEL_SPEED: 220,    // px/s a los que se recoge la cuerda (+ = tiron inicial mas fuerte)
  ROPE_STIFFNESS: 2,      // que tan rapido se corrige la cuerda estirada (- = cuerda mas elastica)
  SWING_JUMP_BOOST: 0.7,   // saltar desde la cuerda: fraccion de JUMP_VELOCITY hacia arriba
  BOX_PULL_FORCE: 260,     // velocidad horizontal con la que sale la caja al jalarla
  BOX_PULL_LIFT: 160,      // pequeno brinco hacia arriba de la caja al jalarla

  // --- Camara y muerte ---
  CAMERA_LERP: 0.1,        // + = la camara alcanza al jugador mas rapido
  CAMERA_LOOKAHEAD: 80,    // px que la camara se adelanta hacia donde miras
  RESPAWN_DELAY: 250,      // ms entre morir y reaparecer
};

// Colores tomados del boceto.
const COLORS = {
  background: 0xf4f1e8,
  solid: 0x96ad8f,      // plataformas gris verdoso
  solidEdge: 0x7d9677,
  step: 0xa9bca3,
  green: 0x3cc43c,      // anclajes y bloques de balanceo
  greenDark: 0x1f7a1f,
  box: 0xf08a24,        // cajas naranjas
  boxDark: 0xa85410,
  enemy: 0x111111,      // monos negros
  spike: 0x333333,
  red: 0xd62828,        // llave y puerta
  player: 0x2f6fde,
  rope: 0x4a3626,
  gem: 0x9b4dff,
};

const T = CONFIG.TILE_SIZE;

// Une las secciones de level.js de izquierda a derecha en un solo arreglo de filas.
function buildMap(sections) {
  const rows = [];
  for (let y = 0; y < sections[0].rows.length; y++) {
    rows.push(sections.map(s => s.rows[y]).join(''));
  }
  return rows;
}

// Mueve un valor hacia el objetivo sin pasarse.
function approach(value, target, step) {
  if (value < target) return Math.min(value + step, target);
  return Math.max(value - step, target);
}

// Sonidos simples generados con Web Audio (sin archivos externos).
// Cada sonido: frecuencia inicial y final (Hz), duracion (s) y forma de onda.
const SOUNDS = {
  jump:  { from: 300, to: 520, dur: 0.10, wave: 'square' },
  hook:  { from: 900, to: 600, dur: 0.06, wave: 'triangle' },
  crush: { from: 180, to: 40,  dur: 0.25, wave: 'sawtooth' },
  death: { from: 400, to: 80,  dur: 0.30, wave: 'square' },
  key:   { from: 600, to: 1200, dur: 0.25, wave: 'triangle' },
  gem:   { from: 1000, to: 1600, dur: 0.20, wave: 'sine' },
  door:  { from: 300, to: 900, dur: 0.50, wave: 'triangle' },
  tick:  { from: 1000, to: 1000, dur: 0.04, wave: 'square' },
};
let audioCtx = null;
function playSound(name) {
  if (CONFIG.SOUND_VOLUME <= 0) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const s = SOUNDS[name], t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = s.wave;
    osc.frequency.setValueAtTime(s.from, t);
    osc.frequency.exponentialRampToValueAtTime(s.to, t + s.dur);
    gain.gain.setValueAtTime(CONFIG.SOUND_VOLUME, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + s.dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + s.dur);
  } catch (e) { /* sin audio disponible: el juego sigue */ }
}

// Dibuja todas las texturas con formas simples (sin archivos externos).
function makeTextures(scene) {
  if (scene.textures.exists('solid')) return;
  const g = scene.add.graphics();
  const tex = (key, w, h, draw) => { g.clear(); draw(g); g.generateTexture(key, w, h); };

  tex('solid', T, T, g => {
    g.fillStyle(COLORS.solid).fillRect(0, 0, T, T);
    g.fillStyle(COLORS.solidEdge).fillRect(0, T - 3, T, 3);
  });
  tex('step', T, T, g => {
    g.fillStyle(COLORS.step).fillRect(0, 0, T, T);
    g.fillStyle(COLORS.solidEdge).fillRect(0, 0, T, 4);
  });
  tex('wall', T, T, g => {
    g.fillStyle(COLORS.solid).fillRect(0, 0, T, T);
    g.fillStyle(COLORS.green).fillRect(0, 0, 5, T);       // cara verde = se sube con gancho
  });
  tex('anchor', T, T, g => {
    g.lineStyle(4, COLORS.green).strokeCircle(T / 2, T / 2, 9);
    g.fillStyle(COLORS.greenDark).fillCircle(T / 2, T / 2, 3);
  });
  tex('swing', T, T, g => {
    g.fillStyle(COLORS.greenDark).fillRect(4, 4, 24, 24);
    g.fillStyle(COLORS.green).fillRect(7, 7, 18, 18);
  });
  tex('box', 30, 30, g => {
    g.fillStyle(COLORS.boxDark).fillRect(0, 0, 30, 30);
    g.fillStyle(COLORS.box).fillRect(3, 3, 24, 24);
    g.lineStyle(3, COLORS.boxDark).lineBetween(3, 3, 27, 27).lineBetween(27, 3, 3, 27);
  });
  tex('enemy', T, 2 * T, g => {                            // mono de palitos
    g.fillStyle(COLORS.enemy).fillCircle(16, 10, 8);
    g.lineStyle(4, COLORS.enemy);
    g.lineBetween(16, 18, 16, 42).lineBetween(4, 26, 28, 26);
    g.lineBetween(16, 42, 6, 62).lineBetween(16, 42, 26, 62);
  });
  tex('spike', T, T, g => {
    g.fillStyle(COLORS.spike);
    for (let i = 0; i < 4; i++) g.fillTriangle(i * 8, T, i * 8 + 4, T - 14, i * 8 + 8, T);
  });
  tex('player', 22, 28, g => {
    g.fillStyle(COLORS.player).fillRoundedRect(0, 0, 22, 28, 5);
    g.fillStyle(0xffffff).fillRect(13, 7, 6, 6);           // ojo: muestra hacia donde mira
    g.fillStyle(0x000000).fillRect(16, 9, 3, 3);
  });
  tex('door', T, 2 * T, g => {
    g.fillStyle(COLORS.red).fillRoundedRect(2, 2, 28, 62, { tl: 14, tr: 14, bl: 0, br: 0 });
    g.fillStyle(0x7a1010).fillCircle(22, 36, 3);
  });
  tex('key', T, T, g => {
    g.lineStyle(4, COLORS.red).strokeCircle(10, 16, 6);
    g.fillStyle(COLORS.red).fillRect(15, 14, 15, 4).fillRect(24, 18, 4, 6);
  });
  tex('gem', T, T, g => {
    g.fillStyle(COLORS.gem).fillTriangle(16, 4, 28, 16, 16, 28).fillTriangle(16, 4, 4, 16, 16, 28);
  });
  tex('checkpoint', T, T, g => {
    g.fillStyle(0x888888).fillRect(8, 4, 3, 28);
    g.fillStyle(0xbbbbbb).fillTriangle(11, 4, 24, 9, 11, 14);
  });
  tex('pixel', 4, 4, g => g.fillStyle(0xffffff).fillRect(0, 0, 4, 4));
  g.destroy();
}

// Texto permitido solo aqui (titulo) y en la pantalla final.
const TEXT_STYLE = { fontFamily: 'monospace', color: '#2b2d2a' };

class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    makeTextures(this);
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.add.text(480, 200, CONFIG.GAME_TITLE, { ...TEXT_STYLE, fontSize: '72px', fontStyle: 'bold' }).setOrigin(0.5);
    const hint = this.add.text(480, 330, 'presiona cualquier tecla', { ...TEXT_STYLE, fontSize: '22px' }).setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
    this.add.image(400, 420, 'player');
    this.add.image(560, 412, 'swing');
    const start = () => { playSound('door'); this.scene.start('Game'); };
    this.input.keyboard.once('keydown', start);
    this.input.once('pointerdown', start);
  }
}

class EndScene extends Phaser.Scene {
  constructor() { super('End'); }

  create(data) {
    this.cameras.main.setBackgroundColor(COLORS.background);
    const secs = data.time;
    const m = Math.floor(secs / 60), s = (secs % 60).toFixed(1).padStart(4, '0');
    this.add.text(480, 140, 'ESCAPASTE', { ...TEXT_STYLE, fontSize: '56px', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(480, 240, `Tiempo: ${m}:${s}`, { ...TEXT_STYLE, fontSize: '30px' }).setOrigin(0.5);
    const gem = this.add.image(440, 310, 'gem').setScale(1.5);
    if (!data.gem) gem.setTint(0xbbbbbb).setAlpha(0.5);
    this.add.text(470, 310, data.gem ? 'gema obtenida' : 'gema no obtenida', { ...TEXT_STYLE, fontSize: '22px' }).setOrigin(0, 0.5);
    const hint = this.add.text(480, 420, 'presiona cualquier tecla para jugar de nuevo', { ...TEXT_STYLE, fontSize: '20px' }).setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
    // Pequena pausa para que una tecla que aun estaba presionada no reinicie de golpe.
    this.time.delayedCall(600, () => {
      this.input.keyboard.once('keydown', () => this.scene.start('Game'));
      this.input.once('pointerdown', () => this.scene.start('Game'));
    });
  }
}

class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    makeTextures(this);
    this.map = buildMap(CONFIG.USE_TEST_MAP ? TEST_LEVEL : LEVEL);
    this.mapW = this.map[0].length * T;
    this.mapH = this.map.length * T;
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.physics.world.setBounds(0, 0, this.mapW, this.mapH + 400);

    this.hasKey = false;
    this.gotGem = false;
    this.won = false;
    this.elapsed = 0;
    this.returnTime = CONFIG.RETURN_TIME_LIMIT;

    this.buildLevel();
    this.createPlayer();
    this.createInput();

    this.ropeGfx = this.add.graphics().setDepth(10);
    this.timerGfx = this.add.graphics().setScrollFactor(0).setDepth(20);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.mapW, this.mapH);
    cam.startFollow(this.player, true, CONFIG.CAMERA_LERP, CONFIG.CAMERA_LERP);

    // Modo debug (F1): hitboxes y alcance del gancho. Apagado por defecto.
    this.debug = false;
    this.physics.world.drawDebug = false;
    this.physics.world.debugGraphic.setVisible(false);
  }

  // ---------------------------------------------------------------
  // Construccion del nivel a partir del mapa de texto
  // ---------------------------------------------------------------
  buildLevel() {
    this.solids = this.physics.add.staticGroup();
    this.spikes = this.physics.add.staticGroup();
    this.checkpoints = this.physics.add.staticGroup();
    this.solidGrid = this.map.map(row => [...row].map(c => '#=|'.includes(c)));
    this.anchors = [];       // A y G: puntos donde se engancha
    this.boxSpawns = [];
    this.enemySpawns = [];

    this.map.forEach((row, ty) => [...row].forEach((c, tx) => {
      const x = tx * T + T / 2, y = ty * T + T / 2;
      if (c === '#') this.add.image(x, y, 'solid');
      else if (c === '=') this.add.image(x, y, 'step');
      else if (c === '|') this.add.image(x, y, 'wall');
      else if (c === '^') {
        const s = this.spikes.create(x, y, 'spike');
        s.body.setSize(26, 12, false);
        s.body.setOffset(3, 20);
      }
      else if (c === 'A' || c === 'G') {
        this.add.image(x, y, c === 'A' ? 'anchor' : 'swing');
        this.anchors.push({ type: c, x, y, tx, ty });
      }
      else if (c === 'B') this.boxSpawns.push({ x, y });
      else if (c === 'E' && this.map[ty - 1]?.[tx] !== 'E') {
        // Las E apiladas forman un solo enemigo alto.
        let h = 1;
        while (this.map[ty + h]?.[tx] === 'E') h++;
        this.enemySpawns.push({ x, y: ty * T + (h * T) / 2, h });
      }
      else if (c === 'P') this.spawnPoint = { x, y };
      else if (c === 'C') this.checkpoints.create(x, y, 'checkpoint');
      else if (c === 'D') {
        // Brillo detras de la puerta: solo se enciende cuando tienes la llave.
        this.doorGlow = this.add.rectangle(x, y - T / 2, T + 16, 2 * T + 16, 0xffd84a).setAlpha(0);
        this.door = this.physics.add.staticImage(x, y - T / 2, 'door');
      }
      else if (c === 'K') {
        this.key = this.physics.add.staticImage(x, y, 'key');
        this.tweens.add({ targets: this.key, y: y - 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
      else if (c === '*') {
        this.gem = this.physics.add.staticImage(x, y, 'gem');
        this.tweens.add({ targets: this.gem, angle: 15, duration: 500, yoyo: true, repeat: -1 });
      }
    }));

    // Puntos para el teletransporte de debug (F2-F6): inicio de cada seccion y la llave.
    this.warps = [];
    let offset = 0;
    const sections = CONFIG.USE_TEST_MAP ? TEST_LEVEL : LEVEL;
    for (const s of sections) {
      const tx = offset + 2;
      let ty = 0;
      while (ty < this.map.length - 1 && !'#=|'.includes(this.map[ty + 1][tx])) ty++;
      this.warps.push({ x: tx * T + T / 2, y: ty * T + T / 2 });
      offset += s.rows[0].length;
    }
    if (this.key) this.warps.push({ x: this.key.x - T, y: this.key.y });

    this.mergeSolids();
    this.boxes = this.physics.add.group();
    this.enemies = this.physics.add.staticGroup();
    this.resetEntities(0);
    this.physics.add.collider(this.boxes, this.solids);
    this.physics.add.overlap(this.boxes, this.enemies, (box, enemy) => this.crushEnemy(box, enemy));
  }

  // Une los bloques solidos en rectangulos grandes para la fisica.
  // Con un cuerpo por bloque el jugador se atora en las uniones al subir un muro.
  mergeSolids() {
    const grid = this.solidGrid, H = grid.length, W = grid[0].length;
    const used = grid.map(row => row.map(() => false));
    const free = (x, y) => grid[y][x] && !used[y][x];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!free(x, y)) continue;
        let w = 1;
        while (x + w < W && free(x + w, y)) w++;
        let h = 1;
        while (y + h < H && [...Array(w).keys()].every(i => free(x + i, y + h))) h++;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) used[y + j][x + i] = true;
        const zone = this.add.zone(x * T + (w * T) / 2, y * T + (h * T) / 2, w * T, h * T);
        this.solids.add(zone);
      }
    }
  }

  // Restaura cajas y enemigos a su estado inicial, solo a la derecha de minX
  // (lo que esta delante del checkpoint). Lo que ya dejaste atras no cambia.
  resetEntities(minX) {
    this.boxSpawns.forEach(s => {
      if (s.x < minX) return;
      if (s.obj) s.obj.destroy();
      s.obj = this.boxes.create(s.x, s.y + 1, 'box');
      s.obj.setDragX(600);
      s.obj.pulled = false;
    });
    this.enemySpawns.forEach(s => {
      if (s.x < minX) return;
      if (s.obj) s.obj.destroy();
      s.obj = this.enemies.create(s.x, s.y, 'enemy');
      s.obj.setDisplaySize(T, s.h * T);
      s.obj.refreshBody();
      s.obj.body.setSize(18, s.h * T - 4);
    });
  }

  crushEnemy(box, enemy) {
    if (!box.pulled) return;
    playSound('crush');
    this.cameras.main.shake(100, 0.004);
    const p = this.add.particles(enemy.x, enemy.y, 'pixel', {
      speed: { min: 80, max: 280 }, lifespan: 500, gravityY: 600,
      tint: [COLORS.enemy, COLORS.box], emitting: false,
    });
    p.explode(24);
    this.time.delayedCall(800, () => p.destroy());
    enemy.destroy();
    box.destroy();       // la caja se rompe al aplastar al enemigo
  }

  // ---------------------------------------------------------------
  // Jugador
  // ---------------------------------------------------------------
  createPlayer() {
    this.respawnPoint = { ...this.spawnPoint };
    this.player = this.physics.add.sprite(this.spawnPoint.x, this.spawnPoint.y, 'player');
    this.player.setMaxVelocity(1200, CONFIG.MAX_FALL_SPEED);
    this.player.setDepth(5);
    this.facing = 1;
    this.state = 'normal';    // normal | pull (jalandose a un muro) | swing (colgado)
    this.dead = false;
    this.lastGrounded = -1e9;
    this.lastJumpPress = -1e9;
    this.jumping = false;
    this.lookahead = 0;

    this.physics.add.collider(this.player, this.solids);
    this.physics.add.overlap(this.player, this.enemies, () => this.die());
    this.physics.add.overlap(this.player, this.spikes, () => this.die());
    this.physics.add.overlap(this.player, this.checkpoints, (pl, cp) => {
      if (!this.hasKey) this.respawnPoint = { x: cp.x, y: cp.y };
    });
    if (this.key) this.physics.add.overlap(this.player, this.key, () => this.takeKey());
    if (this.gem) this.physics.add.overlap(this.player, this.gem, () => this.takeGem());
    if (this.door) this.physics.add.overlap(this.player, this.door, () => this.tryDoor());
  }

  // Tomar la llave: empieza el regreso con limite de tiempo. La llave es el nuevo checkpoint.
  takeKey() {
    if (this.hasKey) return;
    this.hasKey = true;
    this.returnTime = CONFIG.RETURN_TIME_LIMIT;
    this.respawnPoint = { x: this.key.x, y: this.key.y };
    this.key.disableBody(true, true);
    playSound('key');
    this.cameras.main.flash(200, 255, 220, 120);
    this.tweens.add({ targets: this.doorGlow, alpha: { from: 0.15, to: 0.8 }, duration: 400, yoyo: true, repeat: -1 });
  }

  takeGem() {
    if (this.gotGem) return;
    this.gotGem = true;
    playSound('gem');
    const p = this.add.particles(this.gem.x, this.gem.y, 'pixel', {
      speed: { min: 60, max: 180 }, lifespan: 400, tint: COLORS.gem, emitting: false,
    });
    p.explode(16);
    this.time.delayedCall(600, () => p.destroy());
    this.gem.disableBody(true, true);
  }

  tryDoor() {
    if (!this.hasKey || this.won) return;
    this.won = true;
    playSound('door');
    this.cameras.main.fadeOut(400, 244, 241, 232);
    this.time.delayedCall(450, () => this.scene.start('End', { time: this.elapsed, gem: this.gotGem }));
  }

  createInput() {
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard.addKeys({
      left: K.LEFT, right: K.RIGHT, a: K.A, d: K.D,
      up: K.UP, w: K.W, space: K.SPACE,
      x: K.X, j: K.J, r: K.R, f1: K.F1,
      f2: K.F2, f3: K.F3, f4: K.F4, f5: K.F5, f6: K.F6,
    });
    this.input.keyboard.addCapture([K.F1, K.F2, K.F3, K.F4, K.F5, K.F6, K.SPACE, K.UP, K.DOWN, K.LEFT, K.RIGHT]);
    this.mouseHookPressed = false;
    this.input.on('pointerdown', () => { this.mouseHookPressed = true; });
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.releaseHook();
    this.player.setVisible(false);
    this.player.body.enable = false;
    playSound('death');
    this.cameras.main.shake(150, 0.008);
    this.cameras.main.flash(120, 255, 90, 90);
    this.time.delayedCall(CONFIG.RESPAWN_DELAY, () => this.respawn());
  }

  // Reaparece en el ultimo checkpoint. Antes de la llave se restauran las cajas y
  // enemigos que hay delante; despues de la llave el nivel se queda como esta
  // (los enemigos eliminados siguen eliminados) y el tiempo vuelve a empezar.
  respawn() {
    if (this.hasKey) this.returnTime = CONFIG.RETURN_TIME_LIMIT;
    else this.resetEntities(this.respawnPoint.x - T);
    this.player.body.enable = true;
    this.player.body.reset(this.respawnPoint.x, this.respawnPoint.y);
    this.player.setVisible(true);
    this.state = 'normal';
    this.dead = false;
  }

  // ---------------------------------------------------------------
  // Gancho
  // ---------------------------------------------------------------

  // Hay linea de vista si ningun bloque solido se interpone.
  // Los bloques justo debajo del objetivo se ignoran (el muro bajo un anclaje,
  // la cornisa bajo una caja), porque el objetivo esta apoyado en ellos.
  hasLineOfSight(x0, y0, target) {
    const dist = Phaser.Math.Distance.Between(x0, y0, target.x, target.y);
    const ttx = Math.floor(target.x / T), tty = Math.floor(target.y / T);
    for (let d = 0; d < dist - 12; d += 8) {
      const x = x0 + (target.x - x0) * d / dist;
      const y = y0 + (target.y - y0) * d / dist;
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (tx === ttx && ty > tty) continue;
      if (this.solidGrid[ty]?.[tx]) return false;
    }
    return true;
  }

  // Auto-apuntado: el objetivo valido mas cercano, arriba y hacia donde miras.
  findTarget() {
    const px = this.player.x, py = this.player.y;
    const candidates = [
      ...this.anchors,
      ...this.boxes.getChildren().filter(b => !b.pulled).map(b => ({ type: 'B', x: b.x, y: b.y, box: b })),
    ];
    let best = null, bestScore = Infinity;
    for (const t of candidates) {
      const dx = t.x - px, dy = t.y - py;
      const dist = Math.hypot(dx, dy);
      if (dist > CONFIG.HOOK_RANGE) continue;
      if (dy > -8) continue;                    // solo objetivos arriba del jugador
      if (dx * this.facing < -20) continue;     // no hacia atras
      if (!this.hasLineOfSight(px, py, t)) continue;
      let score = dist + CONFIG.HOOK_UP_BIAS * dy;
      if (t.type === 'B') score -= CONFIG.HOOK_BOX_PRIORITY;
      if (score < bestScore) { best = t; bestScore = score; }
    }
    return best;
  }

  useHook(t) {
    const body = this.player.body;
    playSound('hook');
    if (t.type === 'A') {
      this.state = 'pull';
      this.hook = t;
      this.pullTimer = 1.2;
      body.setAllowGravity(false);
    } else if (t.type === 'G') {
      this.state = 'swing';
      this.hook = t;
      this.ropeLength = Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y);
      this.ropeTarget = Math.max(CONFIG.SWING_MIN_LENGTH, CONFIG.ROPE_RETRACT * this.ropeLength);
      body.setGravityY(CONFIG.SWING_GRAVITY - CONFIG.GRAVITY);
    } else if (t.type === 'B') {
      const dir = Math.sign(this.player.x - t.x) || -1;
      t.box.pulled = true;
      t.box.body.setVelocity(dir * CONFIG.BOX_PULL_FORCE, -CONFIG.BOX_PULL_LIFT);
      this.ropeFlash = { box: t.box, until: this.time.now + 150 };
    }
  }

  releaseHook() {
    this.player.body.setAllowGravity(true);
    this.player.body.setGravityY(0);
    this.state = 'normal';
    this.hook = null;
    this.jumping = false;
  }

  updatePull(dt) {
    const body = this.player.body;
    const dx = this.hook.x - this.player.x, dy = this.hook.y - this.player.y;
    const dist = Math.hypot(dx, dy);
    this.pullTimer -= dt;
    if (dist < 8 || this.pullTimer <= 0) {
      body.setVelocity(0, 0);
      this.releaseHook();
      return;
    }
    const speed = Math.min(CONFIG.HOOK_PULL_SPEED, dist / dt);
    body.setVelocity(dx / dist * speed, dy / dist * speed);
  }

  // Pendulo: cuerda de largo fijo. Se quita la velocidad que estira la cuerda
  // y se corrige poco a poco cualquier exceso de largo.
  updateSwing(dt, input) {
    const body = this.player.body;
    this.ropeLength = approach(this.ropeLength, this.ropeTarget, CONFIG.ROPE_REEL_SPEED * dt);
    const rx = this.player.x - this.hook.x, ry = this.player.y - this.hook.y;
    const dist = Math.hypot(rx, ry) || 1;
    const nx = rx / dist, ny = ry / dist;
    let vx = body.velocity.x, vy = body.velocity.y;

    // Impulso tangencial con izquierda/derecha.
    let tx = -ny, ty = nx;
    if (tx < 0) { tx = -tx; ty = -ty; }
    vx += tx * input * CONFIG.SWING_BOOST * dt;
    vy += ty * input * CONFIG.SWING_BOOST * dt;

    if (dist >= this.ropeLength - 1) {
      const radial = vx * nx + vy * ny;
      if (radial > 0) { vx -= nx * radial; vy -= ny * radial; }
      const stretch = dist - this.ropeLength;
      if (stretch > 0) { vx -= nx * stretch * CONFIG.ROPE_STIFFNESS; vy -= ny * stretch * CONFIG.ROPE_STIFFNESS; }
    }
    const speed = Math.hypot(vx, vy);
    if (speed > CONFIG.SWING_MAX_SPEED) {
      vx *= CONFIG.SWING_MAX_SPEED / speed;
      vy *= CONFIG.SWING_MAX_SPEED / speed;
    }
    body.setVelocity(vx, vy);
    if (Math.abs(vx) > 20) this.facing = Math.sign(vx);
  }

  // ---------------------------------------------------------------
  // Ciclo principal
  // ---------------------------------------------------------------
  update(time, delta) {
    const dt = Math.min(delta / 1000, 1 / 30);
    const k = this.keys;
    const JD = Phaser.Input.Keyboard.JustDown;

    if (this.won) return;
    if (JD(k.f1)) this.toggleDebug();
    if (this.debug) {
      ['f2', 'f3', 'f4', 'f5', 'f6'].forEach((name, i) => {
        if (JD(k[name]) && this.warps[i]) {
          this.releaseHook();
          this.player.body.reset(this.warps[i].x, this.warps[i].y);
        }
      });
    }
    if (JD(k.r) && !this.dead) { this.releaseHook(); this.respawn(); }

    this.elapsed += dt;
    this.drawTimer(time);
    if (this.dead) { this.ropeGfx.clear(); return; }
    if (this.hasKey) {
      this.returnTime -= dt;
      if (this.returnTime <= 0) { this.die(); return; }
    }

    const body = this.player.body;
    const input = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    const jumpPressed = JD(k.space) || JD(k.w) || JD(k.up);
    const jumpHeld = k.space.isDown || k.w.isDown || k.up.isDown;
    const hookPressed = JD(k.x) || JD(k.j) || this.mouseHookPressed;
    const hookHeld = k.x.isDown || k.j.isDown || this.input.activePointer.isDown;
    this.mouseHookPressed = false;

    const grounded = body.blocked.down || body.touching.down;
    if (grounded) this.lastGrounded = time;
    if (jumpPressed) this.lastJumpPress = time;
    if (input !== 0 && this.state === 'normal') this.facing = input;

    if (this.state === 'pull') {
      this.updatePull(dt);
    } else if (this.state === 'swing') {
      if (jumpPressed) {
        const vy = Math.min(body.velocity.y, 0) - CONFIG.JUMP_VELOCITY * CONFIG.SWING_JUMP_BOOST;
        playSound('jump');
        this.releaseHook();
        body.setVelocityY(vy);
      } else if (!hookHeld) {
        this.releaseHook();      // soltar conserva la velocidad del balanceo
      } else {
        this.updateSwing(dt, input);
      }
    } else {
      this.updateMovement(dt, time, input, grounded, jumpHeld);
    }

    this.target = this.state === 'normal' ? this.findTarget() : null;
    if (hookPressed && this.target) this.useHook(this.target);

    if (this.player.y > this.mapH + 32) this.die();     // caer fuera del mapa
    this.boxes.getChildren().forEach(b => { if (b.y > this.mapH + 64) b.destroy(); });

    // Camara: se adelanta suavemente hacia donde miras.
    this.lookahead = approach(this.lookahead, this.facing * CONFIG.CAMERA_LOOKAHEAD, 200 * dt);
    this.cameras.main.setFollowOffset(-this.lookahead, 0);

    this.player.setFlipX(this.facing < 0);
    this.drawHook(time);
  }

  updateMovement(dt, time, input, grounded, jumpHeld) {
    const body = this.player.body;
    let vx = body.velocity.x;
    const target = input * CONFIG.MOVE_SPEED;
    if (grounded) {
      vx = approach(vx, target, CONFIG.GROUND_ACCEL * dt);
    } else if (input !== 0) {
      // En el aire se conserva el impulso extra de un balanceo si vas en la misma direccion.
      const keepMomentum = Math.sign(vx) === input && Math.abs(vx) > CONFIG.MOVE_SPEED;
      if (!keepMomentum) vx = approach(vx, target, CONFIG.AIR_ACCEL * dt);
    }
    body.setVelocityX(vx);

    // Salto con coyote time y buffer.
    const canJump = time - this.lastGrounded <= CONFIG.COYOTE_TIME * 1000;
    const buffered = time - this.lastJumpPress <= CONFIG.JUMP_BUFFER * 1000;
    if (canJump && buffered) {
      body.setVelocityY(-CONFIG.JUMP_VELOCITY);
      playSound('jump');
      this.lastGrounded = -1e9;
      this.lastJumpPress = -1e9;
      this.jumping = true;
    }
    // Altura variable: soltar el salto antes corta la subida.
    if (this.jumping && body.velocity.y < 0 && !jumpHeld) {
      body.setVelocityY(body.velocity.y * CONFIG.JUMP_CUT);
      this.jumping = false;
    }
    if (body.velocity.y >= 0) this.jumping = false;
  }

  drawHook(time) {
    const g = this.ropeGfx;
    g.clear();
    const p = this.player;
    if (this.hook) {
      g.lineStyle(3, COLORS.rope).lineBetween(p.x, p.y, this.hook.x, this.hook.y);
    }
    if (this.ropeFlash && time < this.ropeFlash.until && this.ropeFlash.box.active) {
      g.lineStyle(3, COLORS.rope).lineBetween(p.x, p.y, this.ropeFlash.box.x, this.ropeFlash.box.y);
    }
    // Indicador del objetivo actual: un marco que late, sin texto.
    if (this.target) {
      const a = 0.45 + 0.35 * Math.sin(time / 120);
      g.lineStyle(2, 0x222222, a).strokeRect(this.target.x - 18, this.target.y - 18, 36, 36);
    }
    if (this.debug) {
      g.lineStyle(1, 0x0066ff, 0.6).strokeCircle(p.x, p.y, CONFIG.HOOK_RANGE);
      if (this.target) g.lineStyle(1, 0x0066ff, 0.6).lineBetween(p.x, p.y, this.target.x, this.target.y);
    }
  }

  // Barra del regreso: se vacia y pasa de verde a amarillo a rojo. Parpadea los ultimos 10 s.
  drawTimer(time) {
    const g = this.timerGfx;
    g.clear();
    if (!this.hasKey) return;
    const frac = Phaser.Math.Clamp(this.returnTime / CONFIG.RETURN_TIME_LIMIT, 0, 1);
    const color = frac > 0.5 ? 0x3cc43c : frac > 0.2 ? 0xf2c230 : 0xd62828;
    const blinkOff = this.returnTime < 10 && Math.floor(time / 150) % 2 === 0;
    const w = 400, x = 480 - w / 2, y = 16;
    g.fillStyle(0x000000, 0.25).fillRect(x - 3, y - 3, w + 6, 18);
    if (!blinkOff) g.fillStyle(color).fillRect(x, y, w * frac, 12);
    // Tic cada segundo en los ultimos 10 s.
    const sec = Math.ceil(this.returnTime);
    if (this.returnTime < 10 && sec !== this.lastTickSec && !this.dead) { this.lastTickSec = sec; playSound('tick'); }
  }

  toggleDebug() {
    this.debug = !this.debug;
    this.physics.world.drawDebug = this.debug;
    this.physics.world.debugGraphic.setVisible(this.debug);
    if (!this.debug) this.physics.world.debugGraphic.clear();
  }
}

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#f4f1e8',
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: CONFIG.GRAVITY }, debug: true },
  },
  scene: [TitleScene, GameScene, EndScene],
});
