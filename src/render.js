// Desenho: cenário com paralaxe, blocos, HUD, diálogos, cutscenes e telas.
// Tudo é desenhado em coordenadas lógicas 480x270 (o canvas real é 2x).
(function (BK) {
  "use strict";

  const { util, CONFIG } = BK;
  const W = BK.VIEW_W;
  const H = BK.VIEW_H;
  const T = BK.TILE;
  const FONT_MONO = '"Courier New", Courier, monospace';
  const FONT_SERIF = 'Georgia, "Times New Roman", serif';

  let ctx = null;
  const backgrounds = {};
  let vignette = null;
  const embers = Array.from({ length: 46 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    speed: util.rand(8, 26),
    size: Math.random() < 0.25 ? 2 : 1,
    phase: Math.random() * 6
  }));

  // ---------------- texto ----------------
  function setFont(o) {
    const style = `${o.italic ? "italic " : ""}${o.bold === false ? "" : "bold "}`;
    ctx.font = `${style}${o.size || 8}px ${o.serif ? FONT_SERIF : FONT_MONO}`;
  }

  function text(str, x, y, o = {}) {
    setFont(o);
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = o.baseline || "top";
    if (o.shadow !== false) {
      ctx.fillStyle = o.shadowColor || "rgba(0,0,0,0.85)";
      ctx.fillText(str, x + 1, y + 1);
    }
    ctx.fillStyle = o.color || "#f3ead7";
    ctx.fillText(str, x, y);
  }

  function wrap(str, maxWidth, o) {
    setFont(o);
    const lines = [];
    let line = "";
    for (const word of str.split(" ")) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      lines.push(line);
    }
    return lines;
  }

  // Cruz templária pequena feita de retângulos (marcador de menu).
  function templarCross(x, y, color = "#c1272d") {
    ctx.fillStyle = color;
    ctx.fillRect(x - 1, y - 4, 3, 9);
    ctx.fillRect(x - 4, y - 1, 9, 3);
  }

  // ---------------- efeitos reutilizáveis ----------------
  function glowOrb(g, x, y, r, color, alpha = 1) {
    g.save();
    g.globalAlpha = alpha;
    const gradient = g.createRadialGradient(x, y, 0, x, y, r * 2.2);
    gradient.addColorStop(0, "#fff8dc");
    gradient.addColorStop(0.25, color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gradient;
    g.beginPath();
    g.arc(x, y, r * 2.2, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function flame(g, x, y, scale, time) {
    const flicker = Math.sin(time * 18) * 0.8 + Math.sin(time * 31) * 0.5;
    const h = (6 + flicker) * scale;
    g.fillStyle = "#ff6a00";
    g.fillRect(Math.round(x - 2 * scale), Math.round(y - h), Math.ceil(4 * scale), Math.ceil(h));
    g.fillStyle = "#ffd54a";
    g.fillRect(Math.round(x - 1 * scale), Math.round(y - h * 0.7), Math.ceil(2 * scale), Math.ceil(h * 0.7));
    g.fillStyle = "#fff8dc";
    g.fillRect(Math.round(x - 0.5 * scale), Math.round(y - h * 0.35), Math.max(1, Math.ceil(scale)), Math.ceil(h * 0.3));
  }

  // Golpe da espada: lâmina girando + rastro em meia-lua.
  function drawSlash(g, player) {
    const attack = player.attack;
    const progress = Math.min(1, attack.t / (CONFIG.attackActive[1] + 0.04));
    const ease = 1 - Math.pow(1 - progress, 3);
    const f = player.facing;
    let cx = player.cx;
    let cy = player.y + 6; // altura do ombro do cavaleiro
    let from;
    let to;
    if (attack.kind === "side") {
      from = -1.4;
      to = 0.9;
      cx += f * 4;
    } else if (attack.kind === "up") {
      from = -Math.PI * 0.95;
      to = -Math.PI * 0.05;
      cy = player.y;
    } else {
      from = Math.PI * 0.05;
      to = Math.PI * 0.95;
      cy = player.y + player.h - 4;
    }
    const mirror = (angle) => (f < 0 ? Math.PI - angle : angle);
    const a0 = mirror(from);
    const a1 = mirror(from + (to - from) * ease);
    const ccw = f < 0;
    const outer = 25;
    const inner = 14;

    if (attack.t < CONFIG.attackActive[1] + 0.08) {
      g.save();
      g.globalAlpha = 0.75 * (1 - Math.max(0, progress - 0.6) / 0.4);
      g.beginPath();
      g.arc(cx, cy, outer, a0, a1, ccw);
      g.arc(cx, cy, inner, a1, a0, !ccw);
      g.closePath();
      g.fillStyle = "#fff8e6";
      g.fill();
      g.strokeStyle = "#e0b54a";
      g.lineWidth = 1;
      g.stroke();
      g.restore();
    }
    if (attack.kind === "side") {
      return; // no golpe lateral a espada já faz parte do desenho do cavaleiro
    }
    // lâmina
    const bx = cx + Math.cos(a1) * 4;
    const by = cy + Math.sin(a1) * 4;
    g.save();
    g.strokeStyle = "#e9eef5";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(cx + Math.cos(a1) * 24, cy + Math.sin(a1) * 24);
    g.stroke();
    g.strokeStyle = "#e0b54a";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(bx + Math.cos(a1 + Math.PI / 2) * 3, by + Math.sin(a1 + Math.PI / 2) * 3);
    g.lineTo(bx - Math.cos(a1 + Math.PI / 2) * 3, by - Math.sin(a1 + Math.PI / 2) * 3);
    g.stroke();
    g.restore();
  }

  function drawDoor(g, door, time) {
    const x = Math.round(door.x);
    const y = Math.round(door.y);
    g.fillStyle = "#1a1012";
    g.fillRect(x - 3, y + 6, door.w + 6, door.h - 6);
    g.beginPath();
    g.arc(x + door.w / 2, y + 12, door.w / 2 + 3, Math.PI, 0);
    g.fill();
    // interior: portal brilhante
    const gradient = g.createLinearGradient(0, y, 0, y + door.h);
    gradient.addColorStop(0, "#ffdf8a");
    gradient.addColorStop(1, "#ff5a1f");
    g.fillStyle = gradient;
    g.globalAlpha = 0.75 + Math.sin(time * 3) * 0.15;
    g.fillRect(x + 3, y + 12, door.w - 6, door.h - 12);
    g.beginPath();
    g.arc(x + door.w / 2, y + 12, door.w / 2 - 3, Math.PI, 0);
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = "#5a4a40";
    g.fillRect(x - 3, y + 10, 3, door.h - 10);
    g.fillRect(x + door.w, y + 10, 3, door.h - 10);
    g.fillStyle = "#e0b54a";
    g.fillRect(x + door.w / 2 - 1, y - 6, 2, 8);
    g.fillRect(x + door.w / 2 - 4, y - 3, 8, 2);
    glowOrb(g, x + door.w / 2, y + door.h / 2, 18, "#ffb347", 0.3);
  }

  // ---------------- fundos com paralaxe ----------------
  function silhouette(g, width, baseY, amp, color, seed, spires, spireGlow) {
    const rng = util.seeded(seed);
    const waves = [1, 2, 3, 5].map((k) => ({ k, a: (rng() * amp) / k, phase: rng() * Math.PI * 2 }));
    const ridgeY = (x) => waves.reduce((y, w) => y + Math.sin((x / width) * Math.PI * 2 * w.k + w.phase) * w.a, baseY);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= width; x += 4) {
      g.lineTo(x, ridgeY(x));
    }
    g.lineTo(width, H);
    g.closePath();
    g.fill();
    for (let i = 0; i < spires; i += 1) {
      const sx = rng() * width;
      const sh = 30 + rng() * 70;
      const sw = 6 + rng() * 10;
      for (const offset of [0, -width, width]) {
        const x = sx + offset;
        const y = ridgeY(sx) + 4;
        g.fillStyle = color;
        g.fillRect(x - sw / 2, y - sh, sw, sh);
        g.beginPath();
        g.moveTo(x - sw / 2 - 2, y - sh);
        g.lineTo(x, y - sh - sw * 1.6);
        g.lineTo(x + sw / 2 + 2, y - sh);
        g.fill();
        if (spireGlow) {
          g.fillStyle = spireGlow;
          g.fillRect(x - 1, y - sh + 8, 2, 3);
        }
      }
    }
  }

  function buildBackground(name) {
    const th = BK.THEMES[name];
    const sky = BK.sprites.paint(W, H, (p, g) => {
      const gradient = g.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, th.skyTop);
      gradient.addColorStop(1, th.skyBottom);
      g.fillStyle = gradient;
      g.fillRect(0, 0, W, H);
      const glow = g.createRadialGradient(W / 2, H + 40, 10, W / 2, H + 40, 320);
      glow.addColorStop(0, th.glow + "55");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = glow;
      g.fillRect(0, 0, W, H);
    });
    const far = BK.sprites.paint(960, H, (p, g) => {
      if (th.style === "cathedral") {
        for (let x = 0; x < 960; x += 120) {
          g.fillStyle = th.far;
          g.fillRect(x, 0, 120, H);
          const window = g.createLinearGradient(0, 40, 0, 200);
          window.addColorStop(0, "#6b3fb0");
          window.addColorStop(1, "#1d0f33");
          g.fillStyle = window;
          g.fillRect(x + 40, 70, 40, 130);
          g.beginPath();
          g.arc(x + 60, 70, 20, Math.PI, 0);
          g.fill();
          g.fillStyle = th.far;
          g.fillRect(x + 59, 50, 2, 150);
          g.fillRect(x + 40, 130, 40, 2);
          g.fillStyle = th.mid;
          g.fillRect(x, 0, 14, H);
        }
      } else if (th.style === "throne") {
        g.fillStyle = th.far;
        g.fillRect(0, 0, 960, H);
        for (let x = 20; x < 960; x += 160) {
          g.fillStyle = "#3a0a0c";
          g.fillRect(x, 0, 36, H);
          g.fillStyle = "#4d1014";
          g.fillRect(x + 4, 0, 6, H);
          g.fillStyle = "#7c1414";
          g.fillRect(x + 60, 20, 26, 90);
          g.beginPath();
          g.moveTo(x + 60, 110);
          g.lineTo(x + 73, 98);
          g.lineTo(x + 86, 110);
          g.fill();
          g.fillStyle = "#e0b54a";
          g.fillRect(x + 72, 40, 2, 30);
          g.fillRect(x + 66, 60, 14, 2);
        }
      } else {
        silhouette(g, 960, 160, 30, th.far, 7, 9, th.glow);
      }
    });
    const mid = BK.sprites.paint(960, H, (p, g) => {
      if (th.style === "cathedral") {
        // pináculos invertidos pendurados no teto
        const rng = util.seeded(31);
        g.fillStyle = th.mid;
        for (let i = 0; i < 14; i += 1) {
          const x = rng() * 960;
          const w = 10 + rng() * 14;
          const h = 40 + rng() * 80;
          for (const offset of [0, -960, 960]) {
            g.fillRect(x + offset - w / 2, 0, w, h);
            g.beginPath();
            g.moveTo(x + offset - w / 2 - 2, h);
            g.lineTo(x + offset, h + w * 1.8);
            g.lineTo(x + offset + w / 2 + 2, h);
            g.fill();
          }
        }
        silhouette(g, 960, 230, 10, th.mid, 5, 0);
      } else if (th.style === "throne") {
        g.strokeStyle = "#2a0606";
        g.lineWidth = 3;
        for (let x = 60; x < 960; x += 110) {
          g.beginPath();
          g.moveTo(x, 0);
          g.quadraticCurveTo(x + 30, 70, x + 60, 0);
          g.stroke();
        }
      } else {
        silhouette(g, 960, 205, 22, th.mid, 3, 5);
      }
    });
    return { sky, far, mid };
  }

  function background(name) {
    if (!backgrounds[name]) {
      backgrounds[name] = buildBackground(name);
    }
    return backgrounds[name];
  }

  function parallax(image, camX, factor) {
    const width = image.width;
    let x = -((camX * factor) % width);
    if (x > 0) {
      x -= width;
    }
    ctx.drawImage(image, Math.round(x), 0);
    ctx.drawImage(image, Math.round(x + width), 0);
  }

  function drawBackground(themeName, camX, dt, time) {
    const th = BK.THEMES[themeName];
    const bg = background(themeName);
    ctx.drawImage(bg.sky, 0, 0);
    parallax(bg.far, camX, 0.2);
    parallax(bg.mid, camX, 0.45);
    drawEmbers(th.ember, camX, dt, time);
  }

  function drawEmbers(color, camX, dt, time) {
    ctx.fillStyle = color;
    for (const ember of embers) {
      ember.y -= ember.speed * dt;
      if (ember.y < -4) {
        ember.y = H + 4;
        ember.x = Math.random() * W;
      }
      const x = (((ember.x - camX * 0.3 + Math.sin(time + ember.phase) * 6) % W) + W) % W;
      ctx.globalAlpha = 0.35 + Math.sin(time * 3 + ember.phase) * 0.25;
      ctx.fillRect(Math.round(x), Math.round(ember.y), ember.size, ember.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawVignette() {
    if (!vignette) {
      vignette = BK.sprites.paint(W, H, (p, g) => {
        const gradient = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0,0.6)");
        g.fillStyle = gradient;
        g.fillRect(0, 0, W, H);
      });
    }
    ctx.drawImage(vignette, 0, 0);
  }

  // ---------------- blocos ----------------
  const SOLID_LOOK = new Set(["#", "X", "?", "!"]);

  function drawTiles(L, time) {
    const world = L.world;
    const tiles = BK.sprites.theme(L.def.theme);
    const x1 = Math.max(0, Math.floor(L.cam.x / T));
    const x2 = Math.min(world.w - 1, Math.floor((L.cam.x + W) / T));
    const y1 = Math.max(0, Math.floor(L.cam.y / T));
    const y2 = Math.min(world.h - 1, Math.floor((L.cam.y + H) / T));
    const lavaFrame = Math.floor(time * 6);
    for (let ty = y1; ty <= y2; ty += 1) {
      for (let tx = x1; tx <= x2; tx += 1) {
        const code = world.tiles[ty][tx];
        if (code === ".") {
          continue;
        }
        let image;
        let offsetY = 0;
        const bump = world.bumps.get(tx + "," + ty);
        if (bump) {
          offsetY = -Math.sin((1 - bump / 0.2) * Math.PI) * 4;
        }
        switch (code) {
          case "#": {
            const variant = (tx * 7 + ty * 13) % 3;
            const top = !SOLID_LOOK.has(world.tileAt(tx, ty - 1));
            image = top ? tiles.groundTop[variant] : tiles.ground[variant];
            break;
          }
          case "X": image = tiles.cracked; break;
          case "?": image = BK.sprites.get("tile.altar", Math.floor(time * 3)); break;
          case "!": image = BK.sprites.get("tile.altarUsed"); break;
          case "=": image = BK.sprites.get("tile.platform"); break;
          case "^": image = BK.sprites.get("tile.spikes"); break;
          case "~": image = BK.sprites.get("tile.lavaTop", lavaFrame); break;
          case "L": image = BK.sprites.get("tile.lava", Math.floor(time * 3) + tx); break;
          default: continue;
        }
        ctx.drawImage(image, tx * T, ty * T + offsetY);
      }
    }
  }

  // ---------------- HUD ----------------
  function drawHud(L, session) {
    const player = L.player;
    for (let i = 0; i < CONFIG.playerMaxHp; i += 1) {
      ctx.drawImage(BK.sprites.get("hud.heart", i < player.hp ? 1 : 0), 8 + i * 11, 8);
    }
    ctx.drawImage(BK.sprites.get("hud.helm"), 8, 20);
    text("x" + session.lives, 19, 20, { size: 8 });
    ctx.drawImage(BK.sprites.get("soul", 0), 40, 19);
    text(String(session.souls), 52, 20, { size: 8, color: "#bfefff" });
    // contas do rosário desta fase
    for (let i = 0; i < L.relicTotal; i += 1) {
      const collected = session.relics.has(`${L.index}-${i}`);
      ctx.drawImage(BK.sprites.get("hud.bead", collected ? 1 : 0), 80 + i * 8, 21);
    }
    text("PONTOS " + String(session.score).padStart(6, "0"), W - 8, 8, { size: 8, align: "right" });
    const info = BK.STORY.levels[L.index];
    text(`${info.numeral} · ${info.name}`, W - 8, 19, { size: 7, align: "right", color: "#c9b79a", bold: false });
    if (BK.audio.isMuted()) {
      text("SOM DESLIGADO (M)", W - 8, H - 14, { size: 7, align: "right", color: "#8a7a70", bold: false });
    }
  }

  function drawBossBar(boss) {
    const x = 90;
    const y = H - 18;
    const width = W - 180;
    text("BELIAL, PRÍNCIPE DA MENTIRA", W / 2, y - 12, { size: 8, align: "center", color: "#ff8a7a", serif: true });
    ctx.fillStyle = "#e0b54a";
    ctx.fillRect(x - 2, y - 2, width + 4, 10);
    ctx.fillStyle = "#1a0507";
    ctx.fillRect(x - 1, y - 1, width + 2, 8);
    const fill = Math.max(0, boss.hp / boss.maxHp) * width;
    ctx.fillStyle = boss.phase === 2 ? "#ff2a1a" : "#b3202a";
    ctx.fillRect(x, y, fill, 6);
    ctx.fillStyle = "#ff8a7a";
    ctx.fillRect(x, y, fill, 1);
  }

  // ---------------- caixa de diálogo ----------------
  function drawPortrait(speaker, x, y, time) {
    ctx.fillStyle = "#1a0d10";
    ctx.fillRect(x, y, 52, 52);
    ctx.strokeStyle = "#b08a45";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, 51, 51);
    const image = BK.sprites.get(speaker.portrait, 0);
    const scale = speaker.scale / BK.sprites.res(speaker.portrait);
    const w = image.width * scale;
    const h = image.height * scale;
    // "focus" é o ponto do desenho (rosto/peito) que fica no centro do quadro
    const [fx, fy] = speaker.focus || [image.width / 2, image.height / 2];
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 1, y + 1, 50, 50);
    ctx.clip();
    const backdrop = ctx.createRadialGradient(x + 26, y + 22, 2, x + 26, y + 26, 36);
    backdrop.addColorStop(0, speaker.color + "33");
    backdrop.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = backdrop;
    ctx.fillRect(x, y, 52, 52);
    if (speaker.ghost) {
      ctx.globalAlpha = 0.75 + Math.sin(time * 3) * 0.15;
    }
    ctx.drawImage(image, Math.round(x + 26 - fx * scale), Math.round(y + 26 - fy * scale), w, h);
    ctx.restore();
  }

  function drawDialogue(dialogue, time) {
    const line = dialogue.line;
    if (!line) {
      return;
    }
    const speaker = BK.SPEAKERS[line.who] || BK.SPEAKERS.narrador;
    const boxX = 8;
    const boxY = H - 80;
    const boxW = W - 16;
    const boxH = 72;
    ctx.fillStyle = "rgba(10,4,8,0.93)";
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = "#b08a45";
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
    ctx.strokeStyle = "#4a2e18";
    ctx.strokeRect(boxX + 2.5, boxY + 2.5, boxW - 5, boxH - 5);
    templarCross(boxX + 6, boxY + 6, "#b08a45");
    templarCross(boxX + boxW - 7, boxY + 6, "#b08a45");

    const shown = Math.floor(dialogue.chars);
    if (speaker.narration) {
      const lines = wrap(line.text, boxW - 60, { size: 10, serif: true, italic: true });
      let remaining = shown;
      const startY = boxY + boxH / 2 - (lines.length * 13) / 2;
      lines.forEach((part, i) => {
        const visible = part.slice(0, Math.max(0, remaining));
        remaining -= part.length + 1;
        text(visible, W / 2, startY + i * 13, { size: 10, serif: true, italic: true, align: "center", color: "#e9dcc0", bold: false });
      });
    } else {
      drawPortrait(speaker, boxX + 10, boxY + 10, time);
      text(speaker.name, boxX + 70, boxY + 9, { size: 9, color: speaker.color, serif: true });
      const lines = wrap(line.text, boxW - 84, { size: 8 });
      let remaining = shown;
      lines.forEach((part, i) => {
        const visible = part.slice(0, Math.max(0, remaining));
        remaining -= part.length + 1;
        text(visible, boxX + 70, boxY + 24 + i * 11, { size: 8, color: "#f3ead7", bold: false });
      });
    }
    if (dialogue.complete && Math.floor(time * 3) % 2 === 0) {
      ctx.fillStyle = "#e0b54a";
      ctx.fillRect(boxX + boxW - 16, boxY + boxH - 11, 7, 2);
      ctx.fillRect(boxX + boxW - 15, boxY + boxH - 9, 5, 2);
      ctx.fillRect(boxX + boxW - 14, boxY + boxH - 7, 3, 2);
    }
    text("ENTER / ESPAÇO: avançar · ESC: pular", boxX + boxW - 22, boxY + boxH - 12, { size: 6, align: "right", color: "#7a6a5a", bold: false, shadow: false });
  }

  // ---------------- cutscenes ----------------
  function gradientFill(top, bottom) {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
  }

  function bigSprite(name, frame, x, y, scale, o = {}) {
    const image = BK.sprites.get(name, frame, !!o.flip);
    scale /= BK.sprites.res(name); // o cavaleiro tem resolução dobrada
    ctx.save();
    if (o.alpha !== undefined) {
      ctx.globalAlpha = o.alpha;
    }
    ctx.drawImage(image, Math.round(x - (image.width * scale) / 2), Math.round(y - image.height * scale), image.width * scale, image.height * scale);
    ctx.restore();
  }

  const SCENES = {
    acre(time) {
      gradientFill("#1a0703", "#a8380c");
      const wall = "#140805";
      ctx.fillStyle = wall;
      ctx.fillRect(0, 150, W, H);
      for (let x = 0; x < W; x += 12) {
        ctx.fillRect(x, 145, 7, 6);
      }
      for (let x = 20; x < W; x += 90) {
        ctx.fillStyle = wall; // flame() troca a cor: redefine a cada torre
        ctx.fillRect(x, 95, 40, 60);
        for (let i = 0; i < 5; i += 1) {
          ctx.fillRect(x + i * 9, 88, 5, 8);
        }
        flame(ctx, x + 20, 88, 3, time + x);
      }
      drawEmbers("#ffb347", time * 20, 1 / 60, time);
    },
    pacto(time) {
      gradientFill("#07030a", "#2a0606");
      bigSprite("knight.hurt", 0, 150, 182, 2);
      const pulse = 0.6 + Math.sin(time * 2) * 0.2;
      glowOrb(ctx, 330, 110, 60, "#5a0000", 0.5);
      bigSprite("stranger", 0, 330, 175, 2, { alpha: pulse + 0.2 });
      drawEmbers("#ff4d2e", 0, 1 / 60, time);
    },
    aldeia(time) {
      gradientFill("#0a0612", "#6b2008");
      ctx.fillStyle = "#0d0608";
      ctx.fillRect(0, 160, W, H);
      for (let i = 0; i < 6; i += 1) {
        const x = 20 + i * 78;
        const h = 40 + (i % 3) * 10;
        ctx.fillRect(x, 160 - h, 50, h);
        ctx.beginPath();
        ctx.moveTo(x - 6, 160 - h);
        ctx.lineTo(x + 25, 160 - h - 26);
        ctx.lineTo(x + 56, 160 - h);
        ctx.fill();
        flame(ctx, x + 25, 160 - h - 14, 3 + (i % 2), time + i);
        ctx.fillStyle = "#ffb347";
        ctx.fillRect(x + 18, 160 - h + 14, 6, 8);
        ctx.fillStyle = "#0d0608";
      }
      drawEmbers("#ffb347", time * 10, 1 / 60, time);
    },
    portal(time) {
      gradientFill("#050104", "#250308");
      for (let i = 6; i > 0; i -= 1) {
        ctx.save();
        ctx.translate(W / 2, 95);
        ctx.rotate(time * (0.3 + i * 0.1) * (i % 2 ? 1 : -1));
        ctx.globalAlpha = 0.12 + i * 0.06;
        ctx.fillStyle = i % 2 ? "#ff3b2e" : "#5a0000";
        ctx.beginPath();
        ctx.ellipse(0, 0, 30 + i * 18, 12 + i * 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      bigSprite("belial", 0, W / 2, 130, 1.5, { alpha: 0.85 });
      bigSprite("isolde", 0, W / 2 + 70 + Math.sin(time * 9), 175, 3);
      drawEmbers("#ff4d2e", 0, 1 / 60, time);
    },
    cavaleiro(time) {
      gradientFill("#050203", "#4a0a06");
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = "#ffcf8a";
      for (let i = -3; i <= 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(W / 2, 0);
        ctx.lineTo(W / 2 + i * 60 - 14, H);
        ctx.lineTo(W / 2 + i * 60 + 14, H);
        ctx.fill();
      }
      ctx.restore();
      glowOrb(ctx, W / 2, 120, 50, "#c1272d", 0.4);
      bigSprite("knight.idle", Math.floor(time * 2), W / 2, 196, 4);
      drawEmbers("#ff8a3d", 0, 1 / 60, time);
    },
    trono(time) {
      drawBackground("throne", time * 5, 1 / 60, time);
      ctx.fillStyle = "#1e0d0f";
      ctx.fillRect(0, 175, W, H);
      bigSprite("knight.idle", Math.floor(time * 2), 180, 179, 2);
      bigSprite("isolde", 0, 290, 178, 2, { flip: true });
      glowOrb(ctx, 290, 140, 30, "#fff1c4", 0.3);
    },
    luz(time) {
      gradientFill("#1a2a4a", "#f2b56b");
      glowOrb(ctx, W / 2, 175, 70, "#fff1c4", 0.7);
      ctx.fillStyle = "#3a2a20";
      ctx.fillRect(0, 175, W, H);
      ctx.fillStyle = "#5a7a3a";
      ctx.fillRect(0, 175, W, 4);
      bigSprite("knight.idle", 0, 210, 179, 2);
      bigSprite("isolde", 0, 262, 178, 2, { flip: true });
      ctx.fillStyle = "rgba(255,240,200,0.5)";
      for (let i = 0; i < 20; i += 1) {
        const x = (i * 53 + time * 12) % W;
        ctx.fillRect(x, 40 + ((i * 37) % 120), 1, 1);
      }
    },
    sombra(time) {
      gradientFill("#030102", "#3a0606");
      glowOrb(ctx, W / 2, 110, 70, "#7c1414", 0.5);
      // trono: encosto pontiagudo, braços e degraus
      ctx.fillStyle = "#1e0a0c";
      ctx.beginPath();
      ctx.moveTo(W / 2 - 34, 178);
      ctx.lineTo(W / 2 - 34, 70);
      ctx.lineTo(W / 2 - 20, 50);
      ctx.lineTo(W / 2, 22);
      ctx.lineTo(W / 2 + 20, 50);
      ctx.lineTo(W / 2 + 34, 70);
      ctx.lineTo(W / 2 + 34, 178);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#e0b54a";
      ctx.fillRect(W / 2 - 1, 34, 2, 20);
      ctx.fillRect(W / 2 - 6, 46, 12, 2);
      ctx.fillStyle = "#2a0e10";
      ctx.fillRect(W / 2 - 50, 130, 18, 48);
      ctx.fillRect(W / 2 + 32, 130, 18, 48);
      ctx.fillRect(W / 2 - 70, 178, 140, 8);
      ctx.fillRect(W / 2 - 90, 186, 180, 8);
      bigSprite("knight.idle", 0, W / 2, 179, 2);
      ctx.fillStyle = "#ff2a2a";
      ctx.globalAlpha = 0.6 + Math.sin(time * 2) * 0.3;
      ctx.fillRect(W / 2 + 1, 132, 12, 2);
      ctx.globalAlpha = 1;
      drawEmbers("#ff4d2e", 0, 1 / 60, time);
    }
  };

  // ---------------- telas ----------------
  function menu(items, index, y, time) {
    items.forEach((label, i) => {
      const selected = i === index;
      text(label, W / 2, y + i * 17, { size: 10, align: "center", serif: true, color: selected ? "#fff1c4" : "#8a7a70" });
      if (selected) {
        setFont({ size: 10, serif: true });
        const half = ctx.measureText(label).width / 2;
        const bob = Math.sin(time * 6) * 1.5;
        templarCross(W / 2 - half - 12 - bob, y + i * 17 + 6);
        templarCross(W / 2 + half + 12 + bob, y + i * 17 + 6);
      }
    });
  }

  function titleScreen(game, dt, time) {
    drawBackground("throne", time * 12, dt, time);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, W, H);
    glowOrb(ctx, W / 2, 230, 80, "#c1272d", 0.35);
    bigSprite("knight.idle", Math.floor(time * 2), W / 2, 268, 2);
    ctx.save();
    ctx.shadowColor = "#ff2a1a";
    ctx.shadowBlur = 10;
    text("BLASPHEMOUS", W / 2, 30, { size: 36, align: "center", serif: true, color: "#e9dcc0" });
    text("KNIGHT", W / 2, 70, { size: 28, align: "center", serif: true, color: "#c1272d" });
    ctx.restore();
    text("Uma descida ao Inferno por amor", W / 2, 106, { size: 9, align: "center", serif: true, italic: true, bold: false, color: "#c9b79a" });
    menu(game.titleItems(), game.menuIndex, 128, time);
    if (game.highScore > 0) {
      text("RECORDE " + String(game.highScore).padStart(6, "0"), 8, H - 14, { size: 7, color: "#e0b54a" });
    }
    text("↑↓ escolher · ENTER confirmar · M som", W - 8, H - 14, { size: 7, align: "right", color: "#8a7a70", bold: false });
    drawVignette();
  }

  function slotsScreen(game, dt, time) {
    drawBackground("throne", time * 12, dt, time);
    ctx.fillStyle = "rgba(5,2,3,0.7)";
    ctx.fillRect(0, 0, W, H);
    const loading = game.slotMode === "load";
    text(loading ? "CONTINUAR" : "NOVO JOGO", W / 2, 22, { size: 18, align: "center", serif: true, color: "#e9dcc0" });
    text(loading ? "Escolha o save para continuar a jornada" : "Escolha onde guardar a nova jornada",
      W / 2, 48, { size: 9, align: "center", serif: true, italic: true, bold: false, color: "#c9b79a" });

    game.saves.forEach((save, slot) => {
      const x = 80;
      const y = 70 + slot * 56;
      const w = W - 160;
      const h = 48;
      const selected = slot === game.menuIndex;
      const disabled = loading && !save;
      ctx.fillStyle = selected ? "rgba(60,14,16,0.92)" : "rgba(20,8,10,0.85)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = selected ? "#e0b54a" : "#4a2e18";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      if (selected) {
        templarCross(x - 10 - Math.sin(time * 6) * 1.5, y + h / 2);
      }
      const titleColor = disabled ? "#5a4a40" : selected ? "#fff1c4" : "#c9b79a";
      text("SAVE " + String(slot + 1).padStart(2, "0"), x + 10, y + 7, { size: 11, serif: true, color: titleColor });

      if (!save) {
        text("— vazio —", x + 10, y + 26, { size: 8, color: "#6a5a50", bold: false });
        return;
      }
      const info = BK.STORY.levels[save.levelIndex];
      const where = save.completed
        ? `Jornada concluída · ${save.completed === "good" ? "Final: Redenção" : "Final: Sacrifício"}`
        : `${info.boss ? "Último círculo" : "Círculo " + info.numeral} · ${info.name}${save.checkpoint !== null ? " (cruz de pedra)" : ""}`;
      text(where, x + 92, y + 9, { size: 8, color: disabled ? "#5a4a40" : "#e9dcc0", bold: false });
      const when = new Date(save.savedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      const c = save.current;
      text(`${String(c.score).padStart(6, "0")} pts · vidas ${c.lives} · contas ${c.relics.length}/${CONFIG.totalRelics} · ${when}`,
        x + 92, y + 23, { size: 7, color: "#a8988a", bold: false });
      if (game.slotConfirm === slot) {
        text("Este save será apagado. ENTER de novo para confirmar.", x + 92, y + 35, { size: 7, color: "#ff8a7a" });
      }
    });

    text("↑↓ escolher · ENTER confirmar · ESC voltar", W / 2, H - 16, { size: 7, align: "center", color: "#8a7a70", bold: false });
    text("Salva sozinho no início de cada fase e em cada cruz de pedra.", W / 2, H - 28, { size: 7, align: "center", color: "#8a7a70", bold: false });
  }

  function drawToast(toast) {
    const alpha = Math.min(1, toast.t * 3);
    ctx.globalAlpha = alpha;
    setFont({ size: 8 });
    const width = ctx.measureText(toast.text).width + 26;
    const x = W - width - 8;
    const y = 32; // logo abaixo do HUD, longe da caixa de diálogo
    ctx.fillStyle = "rgba(10,4,8,0.9)";
    ctx.fillRect(x, y, width, 16);
    ctx.strokeStyle = "#b08a45";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, 15);
    templarCross(x + 9, y + 8, "#e0b54a");
    text(toast.text, x + 18, y + 4, { size: 8, color: "#fff1c4" });
    ctx.globalAlpha = 1;
  }

  function howToScreen(time) {
    drawBackground("ash", time * 8, 1 / 60, time);
    ctx.fillStyle = "rgba(5,2,3,0.82)";
    ctx.fillRect(20, 14, W - 40, H - 28);
    text("COMO JOGAR", W / 2, 22, { size: 14, align: "center", serif: true, color: "#e0b54a" });
    const rows = [
      ["← → / A D", "mover o cavaleiro"],
      ["ESPAÇO / K / Z", "pular · de novo no ar: pulo duplo"],
      ["J / X / clique", "golpe de espada"],
      ["↑ + golpe", "golpe para cima"],
      ["↓ + golpe (no ar)", "golpe para baixo: quica nos inimigos"],
      ["↓ + pulo", "descer de uma plataforma"],
      ["P / ESC", "pausar"],
      ["M", "ligar ou desligar o som"],
      ["1 2 3 4 (no menu)", "começar direto numa fase"]
    ];
    rows.forEach(([key, action], i) => {
      text(key, 150, 46 + i * 12, { size: 8, align: "right", color: "#fff1c4" });
      text(action, 160, 46 + i * 12, { size: 8, color: "#c9b79a", bold: false });
    });
    const rules = [
      "Chegue ao portal de cada círculo do Inferno e derrote Belial.",
      "5 corações por vida e 3 vidas. Cair na lava ou no abismo custa 1 coração.",
      "Toque nas cruzes de pedra para salvar o caminho e se curar.",
      "Almas valem pontos; 50 almas dão uma vida extra.",
      "Recolha as contas do rosário de Isolde: elas decidem o final."
    ];
    rules.forEach((rule, i) => {
      text("•  " + rule, 40, 160 + i * 12, { size: 8, color: "#e9dcc0", bold: false });
    });
    text("ESC ou ENTER para voltar", W / 2, H - 30, { size: 7, align: "center", color: "#8a7a70", bold: false });
  }

  function creditsScreen(time, scroll) {
    gradientFill("#050203", "#2a0606");
    drawEmbers("#ff8a3d", 0, 1 / 60, time);
    let y = H - scroll;
    for (const [line, style] of BK.STORY.credits) {
      if (style === "title") {
        text(line, W / 2, y, { size: 18, align: "center", serif: true, color: "#e9dcc0" });
        y += 26;
      } else if (style === "head") {
        text(line, W / 2, y, { size: 9, align: "center", serif: true, color: "#e0b54a" });
        y += 14;
      } else if (style === "sub") {
        text(line, W / 2, y, { size: 9, align: "center", serif: true, italic: true, color: "#c9b79a", bold: false });
        y += 14;
      } else {
        text(line, W / 2, y, { size: 8, align: "center", color: "#c9b79a", bold: false });
        y += 12;
      }
    }
    text("ENTER para voltar ao menu", W - 8, H - 12, { size: 7, align: "right", color: "#8a7a70", bold: false });
    return y;
  }

  function cardScreen(card, time) {
    const info = BK.STORY.levels[card.index];
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const fade = Math.min(1, card.t * 1.5);
    ctx.globalAlpha = fade;
    glowOrb(ctx, W / 2, H / 2, 70, BK.THEMES[BK.LEVELS[card.index].theme].glow, 0.25);
    text(info.boss ? "O ÚLTIMO CÍRCULO" : `CÍRCULO ${info.numeral}`, W / 2, 88, { size: 9, align: "center", serif: true, color: "#e0b54a" });
    text(info.name, W / 2, 106, { size: 24, align: "center", serif: true, color: "#e9dcc0" });
    text(info.subtitle, W / 2, 146, { size: 9, align: "center", serif: true, italic: true, bold: false, color: "#c9b79a" });
    ctx.globalAlpha = 1;
    if (card.t > 1 && Math.floor(time * 2) % 2 === 0) {
      text("ENTER", W / 2, H - 30, { size: 7, align: "center", color: "#8a7a70" });
    }
  }

  function overlayMenu(title, items, index, time, subtitle) {
    ctx.fillStyle = "rgba(5,2,3,0.75)";
    ctx.fillRect(0, 0, W, H);
    text(title, W / 2, 70, { size: 22, align: "center", serif: true, color: "#e9dcc0" });
    if (subtitle) {
      text(subtitle, W / 2, 100, { size: 8, align: "center", color: "#c9b79a", bold: false });
    }
    menu(items, index, 124, time);
  }

  function gameOverScreen(game, time) {
    gradientFill("#030101", "#3a0505");
    glowOrb(ctx, W / 2, 70, 50, "#7c1414", 0.5);
    bigSprite("belial", Math.floor(time * 2) % 2, W / 2, 110, 1.5, { alpha: 0.8 });
    text("VOCÊ CAIU", W / 2, 118, { size: 24, align: "center", serif: true, color: "#c1272d" });
    const line = BK.STORY.gameOver;
    wrap(`"${line.text}"`, 380, { size: 9, serif: true, italic: true }).forEach((part, i) => {
      text(part, W / 2, 150 + i * 12, { size: 9, align: "center", serif: true, italic: true, bold: false, color: "#ff8a7a" });
    });
    text(`Pontos: ${game.session.score}   ·   Recorde: ${game.highScore}`, W / 2, 182, { size: 8, align: "center", color: "#c9b79a" });
    menu(["Tentar de novo", "Menu principal"], game.menuIndex, 204, time);
  }

  function endingScreen(game, time) {
    const ending = game.ending;
    const good = ending.kind === "good";
    if (good) {
      SCENES.luz(time);
    } else {
      SCENES.sombra(time);
    }
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, W, H);
    text(ending.title, W / 2, 34, { size: 20, align: "center", serif: true, color: good ? "#fff1c4" : "#ff8a7a" });
    const s = game.session;
    text(`Pontuação final: ${s.score}`, W / 2, 80, { size: 10, align: "center", color: "#e9dcc0" });
    text(`Contas do rosário: ${s.relics.size}/${CONFIG.totalRelics}`, W / 2, 96, { size: 9, align: "center", color: "#e9dcc0", bold: false });
    text(ending.newRecord ? "NOVO RECORDE!" : `Recorde: ${game.highScore}`, W / 2, 112, { size: 9, align: "center", color: "#e0b54a" });
    if (!good) {
      text(BK.STORY.endings.sacrifice.hint, W / 2, 140, { size: 8, align: "center", color: "#c9b79a", bold: false });
    }
    if (Math.floor(time * 2) % 2 === 0) {
      text("ENTER para os créditos", W / 2, H - 28, { size: 8, align: "center", color: "#8a7a70" });
    }
  }

  // ---------------- cena de jogo ----------------
  function drawPlay(game, dt, time) {
    const L = game.level;
    const shakeX = L.shake > 0 ? util.rand(-L.shake, L.shake) : 0;
    const shakeY = L.shake > 0 ? util.rand(-L.shake, L.shake) : 0;
    drawBackground(L.def.theme, L.cam.x, dt, time);

    ctx.save();
    ctx.translate(-Math.round(L.cam.x + shakeX), -Math.round(L.cam.y + shakeY));
    for (const deco of L.decos) {
      if (deco.type === "torch") {
        ctx.fillStyle = "#2a1d1a";
        ctx.fillRect(deco.x - 1, deco.y - 12, 3, 12);
        ctx.fillStyle = "#5a4a40";
        ctx.fillRect(deco.x - 3, deco.y - 14, 7, 3);
        glowOrb(ctx, deco.x, deco.y - 18, 12, "#ff8c32", 0.35);
        flame(ctx, deco.x + 0.5, deco.y - 14, 1.2, time + deco.x);
      }
    }
    if (L.isolde) {
      drawCage(L.isolde, time, L.bossDefeated);
    }
    if (L.door) {
      L.door.draw(ctx, time);
    }
    for (const checkpoint of L.checkpoints) {
      checkpoint.draw(ctx, time);
    }
    drawTiles(L, time);
    for (const platform of L.platforms) {
      platform.draw(ctx, time);
    }
    for (const pickup of L.pickups) {
      pickup.draw(ctx, time);
    }
    for (const enemy of L.enemies) {
      enemy.draw(ctx, time);
    }
    if (L.boss) {
      L.boss.draw(ctx, time);
    }
    L.player.draw(ctx, time);
    for (const shot of L.projectiles) {
      shot.draw(ctx, time);
    }
    for (const p of L.particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const t of L.texts) {
      ctx.globalAlpha = Math.max(0, 1 - t.age / t.life);
      text(t.str, t.x, t.y - t.age * 24, { size: 7, align: "center", color: t.color });
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (BK.THEMES[L.def.theme].lavaGlow) {
      const gradient = ctx.createLinearGradient(0, H - 70, 0, H);
      gradient.addColorStop(0, "rgba(255,90,20,0)");
      gradient.addColorStop(1, "rgba(255,90,20,0.18)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, H - 70, W, 70);
    }
    drawVignette();
    drawHud(L, game.session);
    if (L.boss && L.boss.state !== "dormant" && !L.boss.dead) {
      drawBossBar(L.boss);
    }
    if (L.flash > 0) {
      ctx.fillStyle = `rgba(255,240,210,${Math.min(0.6, L.flash)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawCage(cage, time, open) {
    const x = cage.x;
    const sway = Math.sin(time * 1.2) * 2;
    const y = cage.y + 16;
    ctx.strokeStyle = "#5a4a40";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 8, 0);
    ctx.lineTo(x + 8 + sway, y);
    ctx.stroke();
    const cx = x + sway - 8;
    if (!open) {
      glowOrb(ctx, cx + 16, y + 20, 18, "#6d8fd6", 0.3);
    }
    ctx.drawImage(BK.sprites.get("isolde"), Math.round(cx + 7), Math.round(y + 5));
    ctx.fillStyle = "#3a2e2a";
    ctx.fillRect(Math.round(cx), Math.round(y), 32, 3);
    ctx.fillRect(Math.round(cx), Math.round(y + 35), 32, 3);
    if (!open) {
      for (let i = 0; i <= 32; i += 6) {
        ctx.fillRect(Math.round(cx + i), Math.round(y), 2, 38);
      }
    }
  }

  BK.render = {
    init(context) {
      ctx = context;
      ctx.imageSmoothingEnabled = false;
    },
    drawSlash,
    drawDoor,
    glowOrb,
    flame,
    frame(game, dt, time) {
      ctx.setTransform(BK.SCALE, 0, 0, BK.SCALE, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      switch (game.state) {
        case "title":
          titleScreen(game, dt, time);
          break;
        case "howto":
          howToScreen(time);
          break;
        case "slots":
          slotsScreen(game, dt, time);
          break;
        case "credits":
          game.creditsEnd = creditsScreen(time, game.creditsScroll);
          break;
        case "cutscene": {
          const scene = (game.dialogue && game.dialogue.scene) || "cavaleiro";
          SCENES[scene](time);
          drawVignette();
          if (game.dialogue) {
            drawDialogue(game.dialogue, time);
          }
          break;
        }
        case "card":
          cardScreen(game.card, time);
          break;
        case "play":
        case "pause":
          drawPlay(game, game.state === "pause" ? 0 : dt, time);
          if (game.state === "pause") {
            overlayMenu("PAUSADO", game.pauseItems(), game.menuIndex, time, "As chamas esperam, cavaleiro.");
          } else if (game.dialogue) {
            drawDialogue(game.dialogue, time);
          }
          break;
        case "gameover":
          gameOverScreen(game, time);
          break;
        case "ending":
          endingScreen(game, time);
          break;
        default:
          break;
      }
      if (game.toast && (game.state === "play" || game.state === "pause")) {
        drawToast(game.toast);
      }
      if (game.audioHint) {
        text("Clique ou aperte uma tecla para ativar o som", W / 2, 4, { size: 7, align: "center", color: "#8a7a70", bold: false });
      }
    }
  };
})(window.BK);
