// Ciclo principal e máquina de estados do jogo:
// title -> cutscene (intro) -> card -> play <-> pause -> ... -> ending -> credits
(function (BK) {
  "use strict";

  const { CONFIG, util } = BK;
  const E = BK.entities;
  const fx = BK.fx;
  const T = BK.TILE;
  const W = BK.VIEW_W;
  const H = BK.VIEW_H;
  const STEP = 1 / 60; // lógica em passo fixo: mesma física em qualquer monitor
  const sfx = (name, ...args) => BK.audio.sfx(name, ...args);
  const input = BK.input;

  const canvas = document.getElementById("game");
  BK.render.init(canvas.getContext("2d"));
  input.attach(canvas);

  // ---------------- diálogos (com efeito de máquina de escrever) ----------------
  class Dialogue {
    constructor(lines, onDone, cutscene = false) {
      this.lines = lines;
      this.index = 0;
      this.chars = 0;
      this.onDone = onDone;
      this.cutscene = cutscene;
      this.done = false;
      this.scene = null;
      this.syncScene();
    }

    get line() {
      return this.lines[this.index];
    }

    get complete() {
      return this.chars >= this.line.text.length;
    }

    syncScene() {
      for (let i = this.index; i >= 0; i -= 1) {
        if (this.lines[i].scene) {
          this.scene = this.lines[i].scene;
          return;
        }
      }
    }

    update(dt) {
      if (input.pressed("back")) {
        this.done = true; // ESC pula a conversa inteira
        return;
      }
      const length = this.line.text.length;
      if (this.chars < length) {
        const before = Math.floor(this.chars / 3);
        this.chars = Math.min(length, this.chars + dt * 45);
        const speaker = BK.SPEAKERS[this.line.who];
        if (Math.floor(this.chars / 3) !== before && speaker && !speaker.narration) {
          sfx("text", speaker.pitch);
        }
      }
      if (input.pressed("confirm")) {
        if (this.chars < length) {
          this.chars = length;
        } else if (this.index + 1 >= this.lines.length) {
          this.done = true;
        } else {
          this.index += 1;
          this.chars = 0;
          this.syncScene();
          sfx("select");
        }
      }
    }
  }

  // ---------------- estado global ----------------
  const game = {
    state: "title",
    menuIndex: 0,
    session: null,
    level: null,
    dialogue: null,
    card: null,
    ending: null,
    creditsScroll: 0,
    creditsEnd: Infinity,
    highScore: Number(BK.storage.get("bk.highscore", "0")) || 0,
    audioHint: true,
    addScore(points) {
      const session = game.session;
      session.score += points;
      if (session.score > game.highScore) {
        game.highScore = session.score;
        BK.storage.set("bk.highscore", game.highScore);
      }
    },
    pauseItems() {
      return [
        "Continuar",
        game.session.slot === null ? "Salvar jogo (sem save)" : "Salvar jogo",
        "Reiniciar fase",
        BK.audio.isMuted() ? "Som: desligado" : "Som: ligado",
        "Menu principal"
      ];
    },
    titleItems() {
      const items = ["Novo jogo", "Como jogar", "Créditos"];
      return game.saves.some(Boolean) ? ["Continuar", ...items] : items;
    },
    // tela de saves
    saves: [],
    slotMode: "new", // "new" = escolher onde começar | "load" = escolher qual continuar
    slotConfirm: -1, // slot ocupado aguardando confirmação para sobrescrever
    toast: null
  };
  BK.game = game;

  function newSession() {
    return {
      score: 0,
      souls: 0,
      lives: CONFIG.startingLives,
      relics: new Set(),
      levelIndex: 0,
      snapshot: null,
      slot: null, // null = sem save (ex.: atalho 1-4 da apresentação)
      completed: null,
      highScoreAtStart: game.highScore
    };
  }

  // ---------------- saves (3 slots no localStorage do navegador) ----------------
  const SAVE_SLOTS = 3;
  const SAVE_VERSION = 1;
  const saveKey = (slot) => `bk.save.${slot}`;

  function readSave(slot) {
    try {
      const data = JSON.parse(BK.storage.get(saveKey(slot), "null"));
      return data && data.version === SAVE_VERSION ? data : null;
    } catch {
      return null; // save corrompido: tratado como vazio
    }
  }

  function refreshSaves() {
    game.saves = Array.from({ length: SAVE_SLOTS }, (_, slot) => readSave(slot));
  }

  // checkpoint = índice da cruz de pedra onde o jogo deve continuar (ou null = início da fase)
  function writeSave(checkpoint) {
    const s = game.session;
    if (!s || s.slot === null) {
      return false;
    }
    const pack = (values) => ({
      score: values.score,
      souls: values.souls,
      lives: values.lives,
      relics: [...values.relics]
    });
    const data = {
      version: SAVE_VERSION,
      levelIndex: s.levelIndex,
      checkpoint,
      current: pack(s),
      start: pack(s.snapshot || s), // progresso no começo da fase ("Reiniciar fase")
      completed: s.completed,
      savedAt: Date.now()
    };
    BK.storage.set(saveKey(s.slot), JSON.stringify(data));
    game.toast = { text: `JOGO SALVO · SAVE ${String(s.slot + 1).padStart(2, "0")}`, t: 2.2 };
    return true;
  }

  function loadSave(slot) {
    const data = readSave(slot);
    if (!data) {
      return;
    }
    const unpack = (values) => ({
      score: values.score,
      souls: values.souls,
      lives: Math.max(1, values.lives),
      relics: new Set(values.relics)
    });
    const s = newSession();
    Object.assign(s, unpack(data.current));
    s.slot = slot;
    s.levelIndex = data.levelIndex;
    s.completed = data.completed;
    s.snapshot = unpack(data.start);
    game.session = s;
    showCard(data.levelIndex, { fromSave: true, checkpoint: data.checkpoint });
  }

  function openSlots(mode) {
    refreshSaves();
    game.state = "slots";
    game.slotMode = mode;
    game.slotConfirm = -1;
    const firstUsed = game.saves.findIndex(Boolean);
    game.menuIndex = mode === "load" && firstUsed >= 0 ? firstUsed : 0;
  }

  // Foto do progresso no começo da fase, para "Reiniciar fase" e "Tentar de novo".
  function takeSnapshot() {
    const s = game.session;
    s.snapshot = { score: s.score, souls: s.souls, lives: s.lives, relics: new Set(s.relics) };
  }

  function restoreSnapshot(resetLives) {
    const s = game.session;
    s.score = s.snapshot.score;
    s.souls = s.snapshot.souls;
    s.relics = new Set(s.snapshot.relics);
    s.lives = resetLives ? CONFIG.startingLives : s.snapshot.lives;
  }

  // ---------------- transições de estado ----------------
  function goToTitle() {
    refreshSaves();
    game.state = "title";
    game.menuIndex = 0;
    game.dialogue = null;
    game.level = null;
    BK.audio.music("title");
  }

  function openDialogue(lines, onDone) {
    game.dialogue = new Dialogue(lines, onDone);
  }

  function startCutscene(lines, onDone, music) {
    game.state = "cutscene";
    game.dialogue = new Dialogue(lines, onDone, true);
    BK.audio.music(music);
  }

  function startNewGame(slot) {
    game.session = newSession();
    game.session.slot = slot;
    takeSnapshot();
    writeSave(null); // o slot já fica marcado, mesmo se sair durante a introdução
    game.toast = null;
    startCutscene(BK.STORY.intro, () => showCard(0), "title");
  }

  // opts.fromSave: progresso veio de um save (não tira nova foto nem salva de novo)
  // opts.checkpoint: índice da cruz de pedra onde o cavaleiro deve reaparecer
  function showCard(index, opts = {}) {
    game.session.levelIndex = index;
    if (!opts.fromSave) {
      takeSnapshot();
      writeSave(null); // salvamento automático no começo de cada fase
    }
    game.pendingCheckpoint = opts.checkpoint === undefined ? null : opts.checkpoint;
    game.state = "card";
    game.card = { index, t: 0 };
    game.level = null;
    BK.audio.music(null);
  }

  function startLevel(index) {
    const def = BK.LEVELS[index];
    const info = BK.STORY.levels[index];
    game.level = buildLevel(index);
    game.state = "play";
    BK.audio.music(def.boss ? null : def.music);

    // continuando de um save feito numa cruz de pedra
    const checkpoint = game.level.checkpoints[game.pendingCheckpoint];
    game.pendingCheckpoint = null;
    if (checkpoint) {
      const L = game.level;
      checkpoint.active = true;
      L.lastCheckpoint = L.checkpoints.indexOf(checkpoint);
      L.respawn = { x: checkpoint.x + 3, y: checkpoint.y + checkpoint.h - CONFIG.playerH };
      L.player.x = L.respawn.x;
      L.player.y = L.respawn.y;
      L.triggers.forEach((trigger) => {
        trigger.fired = trigger.fired || trigger.x <= checkpoint.x;
      });
      updateCamera(L, 0, true);
      return; // já ouviu a conversa de abertura desta fase
    }

    openDialogue(info.start, () => {
      if (def.boss) {
        game.level.boss.start();
        BK.audio.music("boss");
      }
    });
  }

  function completeLevel(L) {
    if (L.completed) {
      return;
    }
    L.completed = true;
    sfx("door");
    fx.score(L, 300, L.player.cx, L.player.y - 8);
    const next = () => showCard(L.index + 1);
    const end = BK.STORY.levels[L.index].end;
    if (end) {
      openDialogue(end, next);
    } else {
      next();
    }
  }

  function startEnding() {
    const s = game.session;
    const kind = s.relics.size >= CONFIG.relicsForGoodEnding ? "good" : "sacrifice";
    const ending = BK.STORY.endings[kind];
    s.completed = kind;
    writeSave(null);
    game.toast = null;
    startCutscene(ending.lines, () => {
      game.state = "ending";
      game.ending = { kind, title: ending.title, newRecord: s.score > s.highScoreAtStart };
      sfx("victory");
    }, "ending");
  }

  function gameOver() {
    game.state = "gameover";
    game.menuIndex = 0;
    BK.audio.music(null);
    sfx("defeat");
  }

  function pause() {
    if (game.state === "play" && !game.dialogue) {
      game.state = "pause";
      game.menuIndex = 0;
      BK.audio.music(null);
    }
  }

  function resume() {
    game.state = "play";
    const L = game.level;
    const def = L.def;
    BK.audio.music(def.boss ? (L.boss.state === "dormant" || L.boss.dead || L.boss.state === "dying" ? null : "boss") : def.music);
  }

  // ---------------- construção da fase ----------------
  function buildLevel(index) {
    const def = BK.LEVELS[index];
    const session = game.session;
    const world = new BK.World(def);
    const difficulty = [1, 1.15, 1.3, 1.3][index] || 1; // inimigos mais rápidos a cada círculo
    const L = {
      def, index, world,
      player: null, enemies: [], projectiles: [], pickups: [], particles: [], texts: [],
      platforms: [], checkpoints: [], decos: [], triggers: [],
      door: null, boss: null, isolde: null,
      cam: { x: 0, y: 0 }, shake: 0, hitstop: 0, flash: 0, time: 0,
      respawn: null, completed: false, bossDefeated: false, relicTotal: 0,
      lastCheckpoint: null
    };

    for (const spawn of world.spawns) {
      const x = spawn.tx * T;
      const y = spawn.ty * T;
      const bottom = y + T;
      switch (spawn.code) {
        case "P":
          L.player = new E.Player(x + 2, bottom - CONFIG.playerH);
          L.respawn = { x: x + 2, y: bottom - CONFIG.playerH };
          break;
        case "i": L.enemies.push(new E.Imp(x + 2, bottom - 13, difficulty)); break;
        case "w": L.enemies.push(new E.Wraith(x + 2, y + 2, difficulty)); break;
        case "c": L.enemies.push(new E.Cultist(x + 2, bottom - 24, difficulty)); break;
        case "K": L.boss = new E.Boss(x - 8, bottom - 50); break;
        case "o": L.pickups.push(new E.Pickup("soul", x + 3, y + 3)); break;
        case "H": L.pickups.push(new E.Pickup("heart", x + 3, y + 4)); break;
        case "R": {
          const id = `${index}-${L.relicTotal}`;
          L.relicTotal += 1;
          if (!session.relics.has(id)) {
            L.pickups.push(new E.Pickup("relic", x + 3, y + 3, { id }));
          }
          break;
        }
        case "C": L.checkpoints.push(new E.Checkpoint(x, bottom - 24)); break;
        case "E": L.door = new E.Door(x - 4, bottom - 32); break;
        case "M": L.platforms.push(new E.MovingPlatform(x, y, "x", 4 * T)); break;
        case "m": L.platforms.push(new E.MovingPlatform(x, y, "x", 2 * T)); break;
        case "V": L.platforms.push(new E.MovingPlatform(x, y, "y", 4 * T)); break;
        case "t": L.decos.push({ type: "torch", x: x + 8, y: bottom }); break;
        case "I": L.isolde = { x, y }; break;
        default:
          if (def.triggers[spawn.code]) {
            L.triggers.push({ x, key: def.triggers[spawn.code], fired: false });
          }
      }
    }

    // --- interações que as entidades pedem à fase ---
    L.addSouls = (count, x, y) => {
      session.souls += count;
      fx.score(L, 10 * count, x, y);
      sfx("soul");
      while (session.souls >= CONFIG.soulsForLife) {
        session.souls -= CONFIG.soulsForLife;
        session.lives += 1;
        sfx("oneUp");
        fx.text(L, L.player.cx, L.player.y - 20, "+1 VIDA", "#9fffb0");
      }
    };

    L.bumpTile = (tx, ty) => {
      if (world.tileAt(tx, ty) !== "?") {
        return;
      }
      world.setTile(tx, ty, "!");
      world.bumps.set(tx + "," + ty, 0.2);
      sfx("bump");
      const cx = tx * T + 8;
      const top = ty * T;
      if (L.player.hp < CONFIG.playerMaxHp && Math.random() < 0.35) {
        L.pickups.push(new E.Pickup("heart", cx - 5, top - 12, { hop: true }));
      } else {
        L.addSouls(5, cx, top - 10);
        fx.particles(L, cx, top - 4, 12, ["#9fe8ff", "#e9fbff", "#5cc8f0"], { angle: -Math.PI / 2, spread: 0.5, minSpeed: 90, maxSpeed: 200, gravity: 260 });
      }
      // inimigo em cima do altar é arremessado (como no Mario)
      for (const enemy of L.enemies) {
        const feet = enemy.y + enemy.h;
        if (!enemy.dead && Math.abs(feet - top) < 3 && enemy.x + enemy.w > tx * T && enemy.x < tx * T + T) {
          enemy.hurt(L, 99, { cx: cx });
        }
      }
    };

    L.breakTile = (tx, ty) => {
      world.setTile(tx, ty, ".");
      const th = BK.THEMES[def.theme];
      fx.particles(L, tx * T + 8, ty * T + 8, 14, [th.stoneLight, th.stone, th.stoneDark], { maxSpeed: 150, size: 3 });
      fx.shake(L, 3);
      sfx("breakBlock");
      fx.score(L, 5);
    };

    L.collect = (pickup) => {
      const cx = pickup.x + pickup.w / 2;
      if (pickup.kind === "soul") {
        L.addSouls(1, cx, pickup.y - 4);
      } else if (pickup.kind === "heart") {
        L.player.hp = Math.min(CONFIG.playerMaxHp, L.player.hp + 1);
        sfx("heal");
        fx.text(L, cx, pickup.y - 4, "+1 ♥", "#ff8a96");
      } else if (pickup.kind === "relic") {
        session.relics.add(pickup.id);
        sfx("relic");
        L.flash = 0.35;
        fx.score(L, 500);
        fx.text(L, cx, pickup.y - 6, "CONTA DO ROSÁRIO", "#fff1c4");
        fx.particles(L, cx, pickup.y + 5, 20, ["#fff1c4", "#ffffff", "#e0b54a"], { maxSpeed: 120, gravity: 0 });
      }
    };

    L.dropLoot = (x, y) => {
      const roll = Math.random();
      if (roll < 0.3) {
        L.pickups.push(new E.Pickup("soul", x - 5, y - 5, { hop: true }));
      } else if (roll < 0.42 && L.player.hp < CONFIG.playerMaxHp) {
        L.pickups.push(new E.Pickup("heart", x - 5, y - 5, { hop: true }));
      }
    };

    L.activateCheckpoint = (checkpoint) => {
      L.respawn = { x: checkpoint.x + 3, y: checkpoint.y + checkpoint.h - CONFIG.playerH };
      L.player.hp = CONFIG.playerMaxHp;
      sfx("checkpoint");
      fx.text(L, checkpoint.x + 8, checkpoint.y - 8, "CAMINHO CONSAGRADO", "#ffd86a");
      fx.particles(L, checkpoint.x + 8, checkpoint.y + 6, 18, ["#ffd86a", "#fff1b0"], { maxSpeed: 90, gravity: -30 });
      L.lastCheckpoint = L.checkpoints.indexOf(checkpoint);
      writeSave(L.lastCheckpoint); // salvamento automático na cruz de pedra
    };

    // Lava ou abismo: perde 1 coração e volta à última cruz consagrada.
    L.hazardRespawn = () => {
      const player = L.player;
      if (player.dead) {
        return;
      }
      player.hp -= 1;
      sfx("hurt");
      fx.shake(L, 6);
      if (player.hp <= 0) {
        player.die(L);
        return;
      }
      player.x = L.respawn.x;
      player.y = L.respawn.y;
      player.vx = 0;
      player.vy = 0;
      player.inv = 1.5;
      player.attack = null;
      player.platform = null;
      updateCamera(L, 0, true);
    };

    L.onBossPhase2 = () => {
      L.flash = 0.5;
      sfx("roar");
      openDialogue(BK.STORY.boss.phase2);
    };

    L.onBossDefeated = () => {
      L.bossDefeated = true;
      L.flash = 0.8;
      sfx("victory");
      openDialogue(BK.STORY.boss.defeat, startEnding);
    };

    updateCamera(L, 0, true);
    return L;
  }

  function respawnPlayer(L) {
    const old = L.player;
    L.player = new E.Player(L.respawn.x, L.respawn.y);
    L.player.facing = old.facing;
    L.player.inv = 1.5;
    L.projectiles.length = 0;
    if (L.boss && L.boss.isVulnerable()) {
      L.boss.recover(1.2);
    }
    updateCamera(L, 0, true);
  }

  function updateCamera(L, dt, snap) {
    const p = L.player;
    const maxX = Math.max(0, L.world.pixelW - W);
    const maxY = Math.max(0, L.world.pixelH - H);
    const targetX = util.clamp(p.cx - W / 2 + p.facing * 28, 0, maxX);
    const targetY = util.clamp(p.cy - H * 0.55, 0, maxY);
    if (snap) {
      L.cam.x = targetX;
      L.cam.y = targetY;
    } else {
      L.cam.x = util.lerp(L.cam.x, targetX, Math.min(1, dt * 5));
      L.cam.y = util.lerp(L.cam.y, targetY, Math.min(1, dt * 5));
    }
  }

  // ---------------- atualização por estado ----------------
  function menuNav(count) {
    if (input.pressed("up")) {
      game.menuIndex = (game.menuIndex + count - 1) % count;
      sfx("select");
    }
    if (input.pressed("down")) {
      game.menuIndex = (game.menuIndex + 1) % count;
      sfx("select");
    }
    if (input.pressed("confirm")) {
      sfx("confirm");
      return true;
    }
    return false;
  }

  function updateDialogue(dt) {
    const dialogue = game.dialogue;
    dialogue.update(dt);
    if (dialogue.done) {
      if (game.dialogue === dialogue) {
        game.dialogue = null;
      }
      if (dialogue.onDone) {
        dialogue.onDone();
      }
    }
  }

  function updatePlay(dt) {
    const L = game.level;
    const s = game.session;
    if (game.dialogue) {
      updateDialogue(dt);
      return;
    }
    if (input.pressed("pause")) {
      pause();
      return;
    }

    // efeitos que continuam mesmo durante o "congelamento" do impacto
    L.shake = Math.max(0, L.shake - dt * 25);
    L.flash = Math.max(0, L.flash - dt);
    for (const [key, value] of L.world.bumps) {
      if (value - dt <= 0) {
        L.world.bumps.delete(key);
      } else {
        L.world.bumps.set(key, value - dt);
      }
    }
    if (L.hitstop > 0) {
      L.hitstop -= dt; // pequena pausa no impacto: dá peso aos golpes
      return;
    }

    L.time += dt;
    for (const platform of L.platforms) {
      platform.update(L, dt);
    }
    L.player.update(L, dt);
    for (const enemy of L.enemies) {
      enemy.update(L, dt);
    }
    if (L.boss) {
      L.boss.update(L, dt);
    }
    for (const shot of L.projectiles) {
      shot.update(L, dt);
    }
    for (const pickup of L.pickups) {
      pickup.update(L, dt);
    }
    for (const checkpoint of L.checkpoints) {
      checkpoint.update(L, dt);
    }
    for (const particle of L.particles) {
      particle.age += dt;
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
    for (const t of L.texts) {
      t.age += dt;
    }
    L.enemies = L.enemies.filter((enemy) => !enemy.dead);
    L.projectiles = L.projectiles.filter((shot) => !shot.dead);
    L.pickups = L.pickups.filter((pickup) => !pickup.dead);
    L.particles = L.particles.filter((particle) => particle.age < particle.life);
    L.texts = L.texts.filter((t) => t.age < t.life);

    const player = L.player;
    if (!player.dead) {
      for (const trigger of L.triggers) {
        if (!trigger.fired && player.x >= trigger.x) {
          trigger.fired = true;
          const lines = BK.STORY.triggers[trigger.key];
          if (lines) {
            openDialogue(lines);
          }
        }
      }
      if (L.door && util.overlap(player, L.door)) {
        completeLevel(L);
      }
    }
    updateCamera(L, dt, false);

    if (player.dead && player.deadT > 1.4) {
      s.lives -= 1;
      if (s.lives <= 0) {
        gameOver();
      } else {
        respawnPlayer(L);
      }
    }
  }

  function update(dt) {
    if (input.pressed("mute")) {
      BK.audio.toggleMute();
    }
    if (game.toast && (game.state === "play" || game.state === "pause")) {
      game.toast.t -= dt;
      if (game.toast.t <= 0) {
        game.toast = null;
      }
    }
    switch (game.state) {
      case "title":
        for (let i = 0; i < BK.LEVELS.length; i += 1) {
          if (input.pressed("level" + (i + 1))) {
            game.session = newSession();
            showCard(i);
            return;
          }
        }
        if (menuNav(game.titleItems().length)) {
          const choice = game.titleItems()[game.menuIndex];
          if (choice === "Continuar") {
            openSlots("load");
          } else if (choice === "Novo jogo") {
            openSlots("new");
          } else if (choice === "Como jogar") {
            game.state = "howto";
          } else {
            game.state = "credits";
            game.creditsScroll = 0;
            game.creditsEnd = Infinity;
          }
        }
        break;
      case "slots": {
        const previous = game.menuIndex;
        if (input.pressed("back")) {
          sfx("confirm");
          const index = game.titleItems().indexOf(game.slotMode === "load" ? "Continuar" : "Novo jogo");
          goToTitle();
          game.menuIndex = Math.max(0, index);
          break;
        }
        const chosen = menuNav(SAVE_SLOTS);
        if (game.menuIndex !== previous) {
          game.slotConfirm = -1;
        }
        if (chosen) {
          const slot = game.menuIndex;
          const used = Boolean(game.saves[slot]);
          if (game.slotMode === "load") {
            if (used) {
              loadSave(slot);
            } else {
              sfx("bump"); // slot vazio: nada para continuar
            }
          } else if (used && game.slotConfirm !== slot) {
            game.slotConfirm = slot; // pede confirmação antes de apagar um save
          } else {
            startNewGame(slot);
          }
        }
        break;
      }
      case "howto":
        if (input.pressed("back") || input.pressed("confirm")) {
          sfx("confirm");
          game.state = "title";
        }
        break;
      case "credits":
        if (game.creditsEnd > 150) {
          game.creditsScroll += dt * 24;
        }
        if (input.pressed("back") || input.pressed("confirm")) {
          sfx("confirm");
          goToTitle();
        }
        break;
      case "cutscene":
        if (game.dialogue) {
          updateDialogue(dt);
        }
        break;
      case "card":
        game.card.t += dt;
        if ((game.card.t > 0.6 && input.pressed("confirm")) || game.card.t > 3.4) {
          startLevel(game.card.index);
        }
        break;
      case "play":
        updatePlay(dt);
        break;
      case "pause":
        if (input.pressed("pause")) {
          resume();
        } else if (menuNav(5)) {
          if (game.menuIndex === 0) {
            resume();
          } else if (game.menuIndex === 1) {
            if (!writeSave(game.level.lastCheckpoint)) {
              game.toast = { text: "SEM SAVE: COMECE PELO 'NOVO JOGO'", t: 2.2 };
            }
          } else if (game.menuIndex === 2) {
            restoreSnapshot(false);
            showCard(game.session.levelIndex);
          } else if (game.menuIndex === 3) {
            BK.audio.toggleMute();
          } else {
            goToTitle();
          }
        }
        break;
      case "gameover":
        if (menuNav(2)) {
          if (game.menuIndex === 0) {
            restoreSnapshot(true);
            showCard(game.session.levelIndex);
          } else {
            goToTitle();
          }
        }
        break;
      case "ending":
        if (input.pressed("confirm")) {
          sfx("confirm");
          game.state = "credits";
          game.creditsScroll = 0;
          game.creditsEnd = Infinity;
          BK.audio.music("ending");
        }
        break;
      default:
        break;
    }
  }

  // ---------------- laço principal ----------------
  input.onAnyKey(() => {
    BK.audio.unlock();
    game.audioHint = false;
  });
  input.onBlur(pause); // trocou de aba ou janela: pausa sozinho

  let last = performance.now();
  let accumulator = 0;
  let time = 0;

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) {
      dt = 0.25;
    }
    accumulator += dt;
    time += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      update(STEP);
      input.endStep();
      accumulator -= STEP;
      steps += 1;
    }
    if (steps === 5) {
      accumulator = 0;
    }
    BK.render.frame(game, dt, time);
    window.requestAnimationFrame(frame);
  }

  goToTitle();
  canvas.focus();
  window.requestAnimationFrame(frame);
})(window.BK);
