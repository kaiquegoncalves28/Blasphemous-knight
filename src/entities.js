// Entidades do jogo: jogador, inimigos, chefe, projéteis, itens e cenário vivo.
// Cada uma tem update(L, dt) e draw(g, time), onde L é a fase em andamento.
(function (BK) {
  "use strict";

  const { CONFIG, util } = BK;
  const T = BK.TILE;
  const sfx = (name, ...args) => BK.audio.sfx(name, ...args);

  // ---------- efeitos visuais compartilhados ----------
  const fx = {
    particles(L, x, y, count, colors, o = {}) {
      for (let i = 0; i < count; i += 1) {
        const angle = o.angle !== undefined
          ? o.angle + util.rand(-(o.spread || 0.5), o.spread || 0.5)
          : util.rand(0, Math.PI * 2);
        const speed = util.rand(o.minSpeed || 30, o.maxSpeed || 130);
        L.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          age: 0,
          life: util.rand(o.minLife || 0.3, o.maxLife || 0.7),
          color: util.pick(colors),
          size: o.size || util.randInt(1, 3),
          gravity: o.gravity === undefined ? 320 : o.gravity
        });
      }
    },
    text(L, x, y, str, color = "#ffe9a8") {
      L.texts.push({ x, y, str, color, age: 0, life: 0.9 });
    },
    shake(L, amount) {
      L.shake = Math.max(L.shake, amount);
    },
    score(L, points, x, y) {
      BK.game.addScore(points);
      if (x !== undefined) {
        fx.text(L, x, y, "+" + points);
      }
    }
  };
  BK.fx = fx;

  function drawSprite(g, name, frame, x, y, flip, white) {
    g.drawImage(BK.sprites.get(name, frame, flip, white), Math.round(x), Math.round(y));
  }

  // Desenha com os pés do desenho no chão (bottom) e centralizado em cx.
  // O +1 compensa a margem de 1 px do contorno automático.
  function drawStanding(g, name, frame, cx, bottom, flip, white) {
    const image = BK.sprites.get(name, frame, flip, white);
    g.drawImage(image, Math.round(cx - image.width / 2), Math.round(bottom - image.height + 1));
    return image;
  }

  // ========================= JOGADOR =========================
  class Player {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.w = CONFIG.playerW;
      this.h = CONFIG.playerH;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.jumping = false;
      this.airJumps = CONFIG.airJumps;
      this.doubleJumpT = 0; // tempo do efeito dourado do pulo duplo
      this.dropTimer = 0;
      this.hp = CONFIG.playerMaxHp;
      this.inv = 0;
      this.hurtT = 0;
      this.attack = null;
      this.attackCd = 0;
      this.animT = 0;
      this.dead = false;
      this.deadT = 0;
      this.ridesPlatforms = true;
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }

    update(L, dt) {
      const input = BK.input;
      this.animT += dt;
      if (this.inv > 0) {
        this.inv -= dt;
      }
      if (this.dead) {
        this.deadT += dt;
        this.vx = util.approach(this.vx, 0, 400 * dt);
        this.vy = Math.min(this.vy + CONFIG.gravity * dt, CONFIG.maxFall);
        L.world.moveBody(this, dt, L);
        return;
      }

      // --- andar ---
      const dir = (input.down("right") ? 1 : 0) - (input.down("left") ? 1 : 0);
      if (this.hurtT > 0) {
        this.hurtT -= dt; // empurrão do dano: controle travado por um instante
      } else if (dir !== 0) {
        const accel = this.onGround ? CONFIG.groundAccel : CONFIG.airAccel;
        this.vx = util.approach(this.vx, dir * CONFIG.runSpeed, accel * dt);
        if (!this.attack) {
          this.facing = dir;
        }
      } else {
        const friction = this.onGround ? CONFIG.friction : CONFIG.airAccel * 0.4;
        this.vx = util.approach(this.vx, 0, friction * dt);
      }

      // --- pular (com "coyote time", buffer e pulo duplo) ---
      this.coyote = this.onGround ? CONFIG.coyoteTime : this.coyote - dt;
      if (this.onGround) {
        this.airJumps = CONFIG.airJumps;
      }
      if (this.doubleJumpT > 0) {
        this.doubleJumpT -= dt;
      }
      if (this.dropTimer > 0) {
        this.dropTimer -= dt;
      }
      const jumpPressed = input.pressed("jump");
      if (jumpPressed && this.coyote <= 0 && this.airJumps > 0 && this.hurtT <= 0) {
        // pulo duplo: no ar, depois do tempo de "coyote"
        this.airJumps -= 1;
        this.vy = -CONFIG.doubleJumpSpeed;
        this.jumping = true;
        this.jumpBuffer = 0;
        this.doubleJumpT = 0.35;
        sfx("doubleJump");
        fx.particles(L, this.cx, this.y + this.h, 14, ["#fff1b0", "#e0b54a", "#ffffff"], { angle: Math.PI / 2, spread: 1.3, minSpeed: 40, maxSpeed: 120, gravity: 60, maxLife: 0.45 });
      } else {
        this.jumpBuffer = jumpPressed ? CONFIG.jumpBuffer : this.jumpBuffer - dt;
      }
      if (this.jumpBuffer > 0 && this.coyote > 0 && this.hurtT <= 0) {
        this.jumpBuffer = 0;
        this.coyote = 0;
        if (input.down("down") && this.onOneWay(L)) {
          this.dropTimer = 0.25; // ↓ + pulo desce da plataforma
          this.y += 2;
        } else {
          this.vy = -CONFIG.jumpSpeed;
          this.jumping = true;
          sfx("jump");
          fx.particles(L, this.cx, this.y + this.h, 5, ["#8a7a70", "#5a4c46"], { angle: -Math.PI / 2, spread: 1.2, maxSpeed: 60, gravity: 100 });
        }
        this.onGround = false;
      }
      if (this.jumping && !input.down("jump") && this.vy < -CONFIG.jumpCutSpeed) {
        this.vy = -CONFIG.jumpCutSpeed;
      }
      this.vy = Math.min(this.vy + CONFIG.gravity * dt, CONFIG.maxFall);

      // --- atacar ---
      if (this.attackCd > 0) {
        this.attackCd -= dt;
      }
      if (input.pressed("attack") && !this.attack && this.attackCd <= 0 && this.hurtT <= 0) {
        let kind = "side";
        if (input.down("down") && !this.onGround) {
          kind = "down";
        } else if (input.down("up")) {
          kind = "up";
        }
        this.attack = { t: 0, kind, hits: new Set() };
        sfx("slash");
      }

      // --- mover e colidir ---
      const wasOnGround = this.onGround;
      const fallSpeed = this.vy;
      const result = L.world.moveBody(this, dt, L);
      if (result.ceiling.length) {
        this.jumping = false;
        for (const [tx, ty] of result.ceiling) {
          L.bumpTile(tx, ty);
        }
      }
      if (this.vy >= 0) {
        this.jumping = false;
      }
      if (!wasOnGround && this.onGround && fallSpeed > 200) {
        sfx("land");
        fx.particles(L, this.cx, this.y + this.h, 6, ["#8a7a70", "#5a4c46"], { angle: -Math.PI / 2, spread: 1.4, maxSpeed: 70, gravity: 150 });
      }

      if (this.attack) {
        this.attack.t += dt;
        const [start, end] = CONFIG.attackActive;
        if (this.attack.t >= start && this.attack.t <= end) {
          this.resolveAttack(L);
        }
        if (this.attack && this.attack.t >= CONFIG.attackDuration) {
          this.attack = null;
          this.attackCd = CONFIG.attackCooldown;
        }
      }

      this.checkHazards(L);
    }

    onOneWay(L) {
      if (this.platform) {
        return true;
      }
      const ty = Math.floor((this.y + this.h + 1) / T);
      const left = Math.floor(this.x / T);
      const right = Math.floor((this.x + this.w - 0.001) / T);
      let any = false;
      for (let tx = left; tx <= right; tx += 1) {
        const code = L.world.tileAt(tx, ty);
        if (code !== "=" && code !== ".") {
          return false; // tem chão sólido embaixo: não dá para descer
        }
        any = any || code === "=";
      }
      return any;
    }

    attackBox() {
      if (!this.attack) {
        return null;
      }
      if (this.attack.kind === "up") {
        return { x: this.x - 8, y: this.y - 22, w: 28, h: 24 };
      }
      if (this.attack.kind === "down") {
        return { x: this.x - 6, y: this.y + this.h - 4, w: 24, h: 24 };
      }
      return this.facing > 0
        ? { x: this.x + this.w - 2, y: this.y, w: 28, h: 20 }
        : { x: this.x - 26, y: this.y, w: 28, h: 20 };
    }

    resolveAttack(L) {
      const box = this.attackBox();
      const attack = this.attack;
      let connected = false;

      for (const enemy of L.enemies) {
        if (!enemy.dead && !attack.hits.has(enemy) && util.overlap(box, enemy)) {
          attack.hits.add(enemy);
          enemy.hurt(L, 1, this);
          connected = true;
        }
      }
      const boss = L.boss;
      if (boss && boss.isVulnerable() && !attack.hits.has(boss) && util.overlap(box, boss)) {
        attack.hits.add(boss);
        boss.hurt(L, 1);
        connected = true;
      }
      for (const shot of L.projectiles) {
        if (!shot.dead && shot.breakable && shot.armed() && util.overlap(box, shot)) {
          shot.dead = true;
          sfx("parry");
          fx.particles(L, shot.x + shot.w / 2, shot.y + shot.h / 2, 10, ["#fff1b8", "#ffb347", "#ffffff"], { maxSpeed: 160 });
          fx.score(L, 10, shot.x, shot.y);
          connected = true;
        }
      }
      for (const [tx, ty, code] of L.world.tilesInRect(box, ["X", "?"])) {
        if (code === "X") {
          L.breakTile(tx, ty);
        } else {
          L.bumpTile(tx, ty);
        }
        if (attack.kind === "down") {
          connected = true;
        }
      }

      if (connected && !attack.connected) {
        attack.connected = true;
        L.hitstop = Math.max(L.hitstop, 0.045);
        if (attack.kind === "down") {
          this.vy = -CONFIG.pogoSpeed; // "pogo": quica sobre o que acertou
          this.jumping = false;
          this.airJumps = CONFIG.airJumps; // e recupera o pulo duplo
        } else if (attack.kind === "side") {
          this.vx -= this.facing * 70;
        }
      }
    }

    checkHazards(L) {
      if (this.y > L.world.pixelH + 30) {
        L.hazardRespawn();
        return;
      }
      for (const [tx, ty, code] of L.world.tilesInRect(this, ["^", "~", "L"])) {
        if (code === "^") {
          const spike = { x: tx * T + 2, y: ty * T + 8, w: 12, h: 8 };
          if (util.overlap(this, spike)) {
            this.damage(L, 1, tx * T + 8);
            return;
          }
        } else {
          const lava = { x: tx * T, y: ty * T + (code === "~" ? 6 : 0), w: T, h: T };
          if (util.overlap(this, lava)) {
            fx.particles(L, this.cx, ty * T + 6, 16, ["#ffb03a", "#ff6a00", "#ffe8a3"], { angle: -Math.PI / 2, spread: 0.9, maxSpeed: 220 });
            L.hazardRespawn();
            return;
          }
        }
      }
    }

    damage(L, amount, sourceX) {
      if (this.inv > 0 || this.dead) {
        return false;
      }
      this.hp -= amount;
      this.inv = CONFIG.invulnTime;
      this.hurtT = 0.22;
      const dir = Math.sign(this.cx - sourceX) || -this.facing;
      this.vx = dir * 170;
      this.vy = -230;
      this.jumping = false;
      this.attack = null;
      fx.shake(L, 5);
      L.hitstop = Math.max(L.hitstop, 0.08);
      sfx("hurt");
      fx.particles(L, this.cx, this.cy, 10, ["#c1272d", "#ff5d6c", "#7a1420"], { maxSpeed: 140 });
      if (this.hp <= 0) {
        this.die(L);
      }
      return true;
    }

    die(L) {
      this.hp = 0;
      this.dead = true;
      this.deadT = 0;
      this.attack = null;
      this.vy = -260;
      sfx("death");
      fx.shake(L, 8);
    }

    sprite() {
      if (this.dead || this.hurtT > 0) {
        return ["knight.hurt", 0];
      }
      if (this.attack) {
        const name = { side: "knight.attack", up: "knight.attackUp", down: "knight.attackDown" }[this.attack.kind];
        return [name, 0];
      }
      if (!this.onGround) {
        return [this.vy < 0 ? "knight.jump" : "knight.fall", 0];
      }
      if (Math.abs(this.vx) > 12) {
        return ["knight.run", Math.floor(this.animT * 11)];
      }
      return ["knight.idle", Math.floor(this.animT * 2)];
    }

    draw(g) {
      if (this.inv > 0 && !this.dead && Math.floor(this.inv * 18) % 2 === 0) {
        return; // pisca enquanto está invulnerável
      }
      const [name, frame] = this.sprite();
      const image = BK.sprites.get(name, frame, this.facing < 0);
      const x = Math.round(this.cx - 16);
      const y = Math.round(this.y + this.h - 32);
      if (this.dead) {
        g.save();
        g.translate(x + 16, y + 26);
        g.rotate(-this.facing * Math.min(this.deadT * 5, Math.PI / 2));
        g.globalAlpha = Math.max(0, 1 - Math.max(0, this.deadT - 0.6));
        g.drawImage(image, -16, -26);
        g.restore();
        return;
      }
      if (this.doubleJumpT > 0) {
        // anel de luz sob os pés no pulo duplo
        const t = 1 - this.doubleJumpT / 0.35;
        g.save();
        g.globalAlpha = 1 - t;
        g.strokeStyle = "#ffe9a8";
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(this.cx, this.y + this.h + 2 + t * 6, 6 + t * 14, 2 + t * 3, 0, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
      g.drawImage(image, x, y);
      if (this.attack) {
        BK.render.drawSlash(g, this);
      }
    }
  }

  // ========================= INIMIGOS =========================
  class Enemy {
    constructor(x, y, w, h, hp) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.vx = 0;
      this.vy = 0;
      this.hp = hp;
      this.flash = 0;
      this.stun = 0;
      this.dead = false;
      this.facing = -1;
      this.t = Math.random() * 10;
      this.points = 50;
      this.colors = ["#ffffff"];
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }

    hurt(L, amount, source) {
      this.hp -= amount;
      this.flash = 0.12;
      sfx("hit");
      fx.particles(L, this.cx, this.cy, 6, this.colors, { maxSpeed: 110 });
      if (this.hp <= 0) {
        this.kill(L);
      } else {
        this.stun = 0.22;
        this.vx = (Math.sign(this.cx - source.cx) || 1) * 150;
      }
    }

    kill(L) {
      this.dead = true;
      sfx("enemyDie");
      fx.particles(L, this.cx, this.cy, 16, this.colors, { maxSpeed: 160 });
      fx.score(L, this.points, this.cx, this.y - 4);
      fx.shake(L, 2);
      L.dropLoot(this.cx, this.cy);
    }

    touchPlayer(L) {
      const player = L.player;
      if (!this.dead && !player.dead && util.overlap(this, player)) {
        player.damage(L, 1, this.cx);
      }
    }

    tickFlash(dt) {
      this.t += dt;
      if (this.flash > 0) {
        this.flash -= dt;
      }
    }
  }

  // Diabrete: patrulha o chão e acelera quando vê o cavaleiro.
  class Imp extends Enemy {
    constructor(x, y, difficulty) {
      super(x, y, 14, 13, 2);
      this.speed = 34 * difficulty;
      this.points = 50;
      this.colors = ["#b3262e", "#e2524a", "#6e1218"];
    }

    update(L, dt) {
      this.tickFlash(dt);
      if (this.stun > 0) {
        this.stun -= dt;
        this.vx = util.approach(this.vx, 0, 600 * dt);
      } else {
        const player = L.player;
        const dx = player.cx - this.cx;
        const chasing = !player.dead && Math.abs(dx) < 110 && Math.abs(player.cy - this.cy) < 28;
        if (chasing) {
          this.facing = Math.sign(dx) || this.facing;
        }
        const frontX = this.facing > 0 ? this.x + this.w + 1 : this.x - 1;
        const ledge = this.onGround && !L.world.standableAtPixel(frontX, this.y + this.h + 2);
        if (ledge) {
          if (chasing) {
            this.vx = 0;
          } else {
            this.facing *= -1;
          }
        } else {
          this.vx = this.facing * this.speed * (chasing ? 1.6 : 1);
        }
      }
      this.vy = Math.min(this.vy + CONFIG.gravity * dt, CONFIG.maxFall);
      const result = L.world.moveBody(this, dt, L);
      if (result.hitWall && this.stun <= 0) {
        this.facing *= -1;
      }
      if (this.y > L.world.pixelH + 40) {
        this.dead = true;
      }
      this.touchPlayer(L);
    }

    draw(g) {
      drawStanding(g, "imp", Math.floor(this.t * 6), this.cx, this.y + this.h, this.facing > 0, this.flash > 0);
    }
  }

  // Alma penada: voa em onda e persegue o cavaleiro quando ele chega perto.
  class Wraith extends Enemy {
    constructor(x, y, difficulty) {
      super(x, y, 14, 14, 1);
      this.homeX = x;
      this.baseY = y;
      this.speed = 42 * difficulty;
      this.points = 80;
      this.colors = ["#5b4385", "#9a7fd0", "#7ef9ff"];
    }

    update(L, dt) {
      this.tickFlash(dt);
      const player = L.player;
      const dx = player.cx - this.cx;
      const dy = player.cy - this.cy;
      if (this.stun > 0) {
        this.stun -= dt;
        this.vx = util.approach(this.vx, 0, 500 * dt);
      } else if (!player.dead && Math.abs(dx) < 150 && Math.abs(dy) < 110) {
        this.facing = Math.sign(dx) || 1;
        this.vx = util.approach(this.vx, this.facing * this.speed, 140 * dt);
        this.baseY = util.approach(this.baseY, player.cy - 10, 28 * dt);
      } else {
        if (Math.abs(this.x - this.homeX) > 48) {
          this.facing = this.x > this.homeX ? -1 : 1;
        }
        this.vx = util.approach(this.vx, this.facing * this.speed * 0.5, 140 * dt);
      }
      this.x += this.vx * dt;
      this.y = this.baseY + Math.sin(this.t * 3) * 8;
      this.touchPlayer(L);
    }

    draw(g) {
      BK.render.glowOrb(g, this.cx, this.cy - 2, 12, "#7ef9ff", 0.12);
      g.save();
      g.globalAlpha = 0.88;
      drawStanding(g, "wraith", Math.floor(this.t * 4), this.cx, this.y + this.h + 4, this.facing > 0, this.flash > 0);
      g.restore();
    }
  }

  // Templário caído: fica parado e lança bolas de fogo mirando no cavaleiro.
  class Cultist extends Enemy {
    constructor(x, y, difficulty) {
      super(x, y, 14, 24, 3);
      this.interval = 2.7 / difficulty;
      this.cooldown = 1 + Math.random();
      this.cast = 0;
      this.points = 120;
      this.colors = ["#2b2236", "#463a58", "#ff4d2e"];
    }

    update(L, dt) {
      this.tickFlash(dt);
      const player = L.player;
      const dx = player.cx - this.cx;
      const dy = player.cy - this.cy;
      this.facing = Math.sign(dx) || this.facing;
      const inRange = !player.dead && Math.abs(dx) < 230 && Math.abs(dy) < 130;
      if (this.cast > 0) {
        this.cast -= dt;
        if (this.cast <= 0) {
          const handX = this.cx + this.facing * 10;
          const handY = this.y + 6;
          const angle = Math.atan2(player.cy - handY, player.cx - handX);
          L.projectiles.push(new Fireball(handX, handY, Math.cos(angle) * 125, Math.sin(angle) * 125));
          sfx("fireball");
          this.cooldown = this.interval;
        }
      } else {
        this.cooldown -= dt;
        if (this.cooldown <= 0 && inRange) {
          this.cast = 0.55;
          sfx("charge");
        }
      }
      if (this.stun > 0) {
        this.stun -= dt;
      }
      this.vx = util.approach(this.vx, 0, 500 * dt);
      this.vy = Math.min(this.vy + CONFIG.gravity * dt, CONFIG.maxFall);
      L.world.moveBody(this, dt, L);
      this.touchPlayer(L);
    }

    draw(g, time) {
      const image = drawStanding(g, "cultist", this.cast > 0 ? 1 : 0, this.cx, this.y + this.h, this.facing > 0, this.flash > 0);
      if (this.cast > 0) {
        const hx = this.cx + this.facing * (image.width / 2 - 2);
        const hy = this.y + this.h - image.height + 9;
        const r = 2 + (0.55 - this.cast) * 6 + Math.sin(time * 40) * 0.6;
        BK.render.glowOrb(g, hx, hy, r, "#ffb347");
      }
    }
  }

  // ========================= BELIAL =========================
  class Boss {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.w = 34;
      this.h = 50;
      this.vx = 0;
      this.vy = 0;
      this.hp = CONFIG.bossHp;
      this.maxHp = CONFIG.bossHp;
      this.state = "dormant";
      this.t = 0;
      this.anim = 0;
      this.facing = -1;
      this.flash = 0;
      this.phase = 1;
      this.dead = false;
      this.ignoreOneWay = true;
      this.lastAttack = null;
      this.recoverTime = 0.6;
      this.explosionTimer = 0;
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }

    start() {
      this.state = "idle";
      this.t = 0;
      sfx("roar");
    }

    isVulnerable() {
      return this.state !== "dormant" && this.state !== "dying" && !this.dead;
    }

    setState(state) {
      this.state = state;
      this.t = 0;
    }

    update(L, dt) {
      this.anim += dt;
      if (this.flash > 0) {
        this.flash -= dt;
      }
      const player = L.player;
      const speed = this.phase === 2 ? 1.3 : 1;
      this.t += dt;

      if (this.state === "dying") {
        this.explosionTimer -= dt;
        if (this.explosionTimer <= 0) {
          this.explosionTimer = 0.12;
          const ex = this.x + Math.random() * this.w;
          const ey = this.y + Math.random() * this.h;
          fx.particles(L, ex, ey, 12, ["#fff7a1", "#ffd54a", "#ff8c32", "#f34b2b"], { maxSpeed: 180 });
          fx.shake(L, 5);
          sfx("hit");
        }
        if (this.t > 2.4 && !this.dead) {
          this.dead = true;
          fx.particles(L, this.cx, this.cy, 70, ["#fff7a1", "#ffd54a", "#ff8c32", "#f34b2b", "#1a0507"], { maxSpeed: 260, maxLife: 1.2 });
          fx.shake(L, 14);
          sfx("slam");
          L.onBossDefeated();
        }
        return;
      }

      if (this.state !== "dormant") {
        switch (this.state) {
          case "idle":
            this.vx = util.approach(this.vx, 0, 700 * dt);
            this.facing = Math.sign(player.cx - this.cx) || this.facing;
            if (this.t > (this.phase === 2 ? 0.5 : 0.85)) {
              this.chooseAttack(L);
            }
            break;
          case "dashWindup":
            this.vx = 0;
            if (this.t > 0.6 / speed) {
              this.setState("dash");
              this.vx = this.facing * 290 * speed;
              sfx("roar");
            }
            break;
          case "dash":
            this.vx = this.facing * 290 * speed;
            if (this.hitWall || this.t > 2.2) {
              this.vx = 0;
              fx.shake(L, 6);
              sfx("slam");
              this.recover(0.7);
            }
            break;
          case "leapWindup":
            this.vx = 0;
            if (this.t > 0.4 / speed) {
              const targetX = util.clamp(player.cx, 40, L.world.pixelW - 40);
              this.vy = -520;
              this.vx = util.clamp((targetX - this.cx) / 0.69, -320, 320);
              this.setState("leap");
            }
            break;
          case "leap":
            if (this.onGround && this.t > 0.1) {
              this.vx = 0;
              fx.shake(L, 9);
              sfx("slam");
              fx.particles(L, this.cx, this.y + this.h, 20, ["#8a7a70", "#ff8c32", "#5a4c46"], { angle: -Math.PI / 2, spread: 1.4, maxSpeed: 160 });
              for (const dir of [-1, 1]) {
                L.projectiles.push(new Fireball(this.cx + dir * 16, this.y + this.h - 6, dir * 170 * speed, 0, { kind: "wave", breakable: false }));
              }
              this.recover(0.6);
            }
            break;
          case "rainWindup":
            this.vx = 0;
            if (this.t > 0.7 / speed) {
              const count = this.phase === 2 ? 7 : 5;
              const xs = [player.cx];
              for (let i = 1; i < count; i += 1) {
                xs.push(util.rand(28, L.world.pixelW - 28));
              }
              xs.forEach((x, i) => {
                L.projectiles.push(new Fireball(x, -12, 0, 240, { kind: "meteor", delay: 0.7 + i * 0.13, life: 6 }));
              });
              sfx("roar");
              this.recover(1.1);
            }
            break;
          case "volleyWindup":
            this.vx = 0;
            if (this.t > 0.5 / speed) {
              const hx = this.cx;
              const hy = this.y + 12;
              const base = Math.atan2(player.cy - hy, player.cx - hx);
              const spread = this.phase === 2 ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.25, 0, 0.25];
              for (const offset of spread) {
                L.projectiles.push(new Fireball(hx, hy, Math.cos(base + offset) * 150, Math.sin(base + offset) * 150));
              }
              sfx("fireball");
              this.recover(0.8);
            }
            break;
          case "summon":
            this.vx = 0;
            if (this.t > 0.6) {
              const imps = L.enemies.filter((enemy) => enemy instanceof Imp && !enemy.dead).length;
              if (imps < 3) {
                L.enemies.push(new Imp(24, 40, 1.3));
                L.enemies.push(new Imp(L.world.pixelW - 36, 40, 1.3));
                fx.particles(L, 30, 48, 14, ["#ff4d2e", "#1a0507"], { maxSpeed: 90 });
                fx.particles(L, L.world.pixelW - 30, 48, 14, ["#ff4d2e", "#1a0507"], { maxSpeed: 90 });
              }
              this.recover(0.9);
            }
            break;
          case "recover":
            this.vx = util.approach(this.vx, 0, 700 * dt);
            if (this.t > this.recoverTime) {
              this.setState("idle");
            }
            break;
          default:
            break;
        }
      }

      this.vy = Math.min(this.vy + CONFIG.gravity * dt, 700);
      const result = L.world.moveBody(this, dt, L);
      this.hitWall = result.hitWall;
      if (this.state !== "dormant" && !player.dead && util.overlap(this, player)) {
        player.damage(L, 1, this.cx);
      }
    }

    recover(time) {
      this.recoverTime = time;
      this.setState("recover");
    }

    chooseAttack() {
      const options = this.phase === 2
        ? ["dash", "leap", "rain", "volley", "summon"]
        : ["dash", "leap", "rain", "volley"];
      const choices = options.filter((option) => option !== this.lastAttack);
      const attack = util.pick(choices);
      this.lastAttack = attack;
      this.setState(attack === "summon" ? "summon" : attack + "Windup");
      if (attack === "summon") {
        sfx("roar");
      } else {
        sfx("charge");
      }
    }

    hurt(L, amount) {
      this.hp -= amount;
      this.flash = 0.1;
      sfx("hit");
      fx.particles(L, this.cx, this.cy, 8, ["#a3202a", "#d8443e", "#ffe14a"], { maxSpeed: 140 });
      fx.score(L, 20);
      fx.shake(L, 2);
      if (this.hp <= 0) {
        this.hp = 0;
        this.setState("dying");
        this.vx = 0;
        L.projectiles.length = 0;
        L.enemies.forEach((enemy) => { enemy.dead = true; });
        BK.audio.music(null);
        sfx("roar");
        fx.score(L, 5000, this.cx, this.y - 10);
      } else if (this.phase === 1 && this.hp <= this.maxHp / 2) {
        this.phase = 2;
        L.onBossPhase2();
      }
    }

    draw(g, time) {
      if (this.dead) {
        return;
      }
      const winding = /Windup$/.test(this.state) || this.state === "summon" || this.state === "dash" || this.state === "leap";
      const frame = winding ? 2 : 0;
      const image = BK.sprites.get("belial", frame);
      let x = this.cx - image.width / 2;
      // respira (sobe e desce 1 px) quando está parado
      const y = this.y + this.h - image.height + 1 + (winding ? 0 : Math.round(Math.sin(this.anim * 3)));
      if (this.state === "dying" || /Windup$/.test(this.state)) {
        x += Math.sin(time * 60) * 1.5; // treme ao carregar o golpe
      }
      if (winding || this.phase === 2) {
        const pulse = 0.25 + Math.sin(time * 12) * 0.1;
        BK.render.glowOrb(g, this.cx, this.cy, 40, this.phase === 2 ? "#ff2a1a" : "#ff8c32", pulse);
      }
      const white = this.flash > 0 || (this.state === "dying" && Math.floor(time * 20) % 2 === 0);
      drawSprite(g, "belial", frame, x, y, false, white);
      if (this.state === "rainWindup" || this.state === "volleyWindup") {
        BK.render.glowOrb(g, x + 4, y + 6, 4 + Math.sin(time * 30), "#ffb347");
        BK.render.glowOrb(g, x + image.width - 4, y + 6, 4 + Math.cos(time * 30), "#ffb347");
      }
    }
  }

  // ========================= PROJÉTEIS =========================
  class Fireball {
    constructor(x, y, vx, vy, o = {}) {
      this.kind = o.kind || "orb";
      const size = this.kind === "wave" ? 10 : 8;
      this.w = size;
      this.h = this.kind === "wave" ? 12 : size;
      this.x = x - this.w / 2;
      this.y = y - this.h / 2;
      this.vx = vx;
      this.vy = vy;
      this.life = o.life || 5;
      this.delay = o.delay || 0; // meteoros esperam (com aviso no chão) antes de cair
      this.breakable = o.breakable !== false;
      this.dead = false;
      this.t = Math.random() * 10;
    }

    armed() {
      return this.delay <= 0;
    }

    update(L, dt) {
      this.t += dt;
      if (this.delay > 0) {
        this.delay -= dt;
        if (this.delay <= 0) {
          sfx("fireball");
        }
        return;
      }
      this.life -= dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (Math.random() < 0.5) {
        fx.particles(L, this.x + this.w / 2, this.y + this.h / 2, 1, ["#ffb347", "#ff6a00"], { minSpeed: 5, maxSpeed: 25, gravity: -40, minLife: 0.15, maxLife: 0.35 });
      }
      const centerX = this.x + this.w / 2;
      const centerY = this.y + this.h / 2;
      if (this.life <= 0 || (this.y > 0 && L.world.solidAtPixel(centerX, centerY)) || this.y > L.world.pixelH) {
        this.dead = true;
        fx.particles(L, centerX, centerY, 8, ["#ffb347", "#ff6a00", "#5a4c46"], { maxSpeed: 90 });
        return;
      }
      const player = L.player;
      if (!player.dead && util.overlap(this, player)) {
        if (player.damage(L, 1, centerX)) {
          this.dead = true;
        }
      }
    }

    draw(g, time) {
      const cx = this.x + this.w / 2;
      const cy = this.y + this.h / 2;
      if (this.delay > 0) {
        // aviso: marca pulsante no chão onde o meteoro vai cair
        const groundY = 13 * T;
        g.globalAlpha = 0.4 + Math.sin(time * 20) * 0.25;
        g.fillStyle = "#ff3b2e";
        g.fillRect(Math.round(cx - 8), groundY - 2, 16, 2);
        g.fillRect(Math.round(cx - 1), groundY - 10, 2, 6);
        g.globalAlpha = 1;
        return;
      }
      if (this.kind === "wave") {
        const flick = Math.sin(time * 40) * 1.5;
        g.fillStyle = "#ff6a00";
        g.fillRect(Math.round(this.x), Math.round(this.y + 3 - flick), this.w, this.h - 3 + flick);
        g.fillStyle = "#ffd54a";
        g.fillRect(Math.round(this.x + 2), Math.round(this.y + 6), this.w - 4, this.h - 6);
        return;
      }
      BK.render.glowOrb(g, cx, cy, this.kind === "meteor" ? 6 : 4.5, this.kind === "meteor" ? "#ff6a00" : "#ffb347");
    }
  }

  // ========================= ITENS =========================
  class Pickup {
    constructor(kind, x, y, o = {}) {
      this.kind = kind; // "soul" | "relic" | "heart"
      this.x = x;
      this.y = y;
      this.w = 10;
      this.h = 10;
      this.id = o.id;
      this.t = Math.random() * 6;
      this.dead = false;
      this.physics = !!o.hop;
      this.vx = o.hop ? util.rand(-40, 40) : 0;
      this.vy = o.hop ? -170 : 0;
      this.life = o.hop ? 9 : Infinity; // o que cai de inimigos some depois de um tempo
    }

    update(L, dt) {
      this.t += dt;
      if (this.physics) {
        this.vy = Math.min(this.vy + CONFIG.gravity * 0.7 * dt, 300);
        this.vx = util.approach(this.vx, 0, 60 * dt);
        L.world.moveBody(this, dt, L);
        this.life -= dt;
        if (this.life <= 0 || this.y > L.world.pixelH) {
          this.dead = true;
          return;
        }
      }
      if (!L.player.dead && util.overlap(this, L.player)) {
        this.dead = true;
        L.collect(this);
      }
    }

    draw(g, time) {
      if (this.life < 2 && Math.floor(time * 10) % 2 === 0) {
        return;
      }
      const bob = this.physics ? 0 : Math.round(Math.sin(this.t * 3) * 2);
      const cx = this.x + this.w / 2;
      const cy = this.y + this.h / 2 + bob;
      if (this.kind === "relic") {
        BK.render.glowOrb(g, cx, cy, 9 + Math.sin(this.t * 4), "#fff1c4", 0.35);
        drawSprite(g, "relic", 0, this.x, this.y + bob);
      } else if (this.kind === "heart") {
        drawSprite(g, "heart", 0, this.x, this.y + bob);
      } else {
        BK.render.glowOrb(g, cx, cy, 6, "#5cc8f0", 0.25);
        drawSprite(g, "soul", Math.floor(this.t * 6), this.x, this.y + bob);
      }
    }
  }

  // ========================= CENÁRIO VIVO =========================
  class Checkpoint {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.w = 16;
      this.h = 24;
      this.active = false;
    }

    update(L) {
      if (!this.active && !L.player.dead && util.overlap(this, L.player)) {
        this.active = true;
        L.activateCheckpoint(this);
      }
    }

    draw(g, time) {
      drawSprite(g, "checkpoint", this.active ? 1 : 0, this.x, this.y);
      if (this.active) {
        BK.render.glowOrb(g, this.x + 8, this.y + 8, 14 + Math.sin(time * 3) * 2, "#ffd86a", 0.25);
        BK.render.flame(g, this.x + 3, this.y + 15, 1, time);
        BK.render.flame(g, this.x + 13, this.y + 15, 1, time + 1.3);
      }
    }
  }

  class Door {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.w = 24;
      this.h = 32;
    }

    draw(g, time) {
      BK.render.drawDoor(g, this, time);
    }
  }

  class MovingPlatform {
    constructor(x, y, axis, range) {
      this.x0 = x;
      this.y0 = y;
      this.x = x;
      this.y = y;
      this.w = 48;
      this.h = 6;
      this.axis = axis;
      this.range = range;
      this.t = 0;
      this.period = range / 30; // segundos para ir de um lado ao outro
    }

    update(L, dt) {
      this.t += dt;
      const phase = (1 - Math.cos((this.t / this.period) * Math.PI)) / 2; // vai e volta suave
      const oldX = this.x;
      const oldY = this.y;
      if (this.axis === "x") {
        this.x = this.x0 + phase * this.range;
      } else {
        this.y = this.y0 - phase * this.range;
      }
      // leva junto quem está em cima
      const player = L.player;
      if (player.platform === this) {
        player.x += this.x - oldX;
        player.y += this.y - oldY;
      }
    }

    draw(g) {
      const x = Math.round(this.x);
      const y = Math.round(this.y);
      g.fillStyle = "#3a2a24";
      g.fillRect(x, y, this.w, this.h);
      g.fillStyle = "#d6c8a6";
      g.fillRect(x, y, this.w, 3);
      g.fillStyle = "#f3ead2";
      g.fillRect(x, y, this.w, 1);
      g.fillStyle = "#9c8d6e";
      for (let i = 4; i < this.w; i += 10) {
        g.fillRect(x + i, y + 3, 2, 3);
      }
      g.fillStyle = "#c1272d";
      g.fillRect(x + this.w / 2 - 1, y + 1, 2, 4);
    }
  }

  BK.entities = { Player, Imp, Wraith, Cultist, Boss, Fireball, Pickup, Checkpoint, Door, MovingPlatform };
})(window.BK);
