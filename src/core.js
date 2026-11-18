// Núcleo: namespace global BK, configurações e utilitários compartilhados.
// Os scripts são comuns (não módulos ES) para o jogo abrir com duplo clique.
window.BK = window.BK || {};

(function (BK) {
  "use strict";

  BK.TILE = 16;
  BK.VIEW_W = 480; // resolução lógica; o canvas real tem o dobro (SCALE)
  BK.VIEW_H = 270;
  BK.SCALE = 2;

  BK.CONFIG = {
    // Física (pixels lógicos por segundo)
    gravity: 1500,
    maxFall: 420,
    runSpeed: 115,
    groundAccel: 1100,
    airAccel: 800,
    friction: 1400,
    jumpSpeed: 440, // ~3,8 blocos de altura
    doubleJumpSpeed: 390, // segundo pulo no ar (~3 blocos a mais)
    airJumps: 1, // quantos pulos extras no ar
    jumpCutSpeed: 160, // soltar o pulo cedo deixa o salto mais baixo
    coyoteTime: 0.1, // ainda dá para pular logo depois de sair da borda
    jumpBuffer: 0.12, // pulo apertado pouco antes de tocar o chão vale
    pogoSpeed: 340, // impulso do golpe para baixo ao acertar algo

    // Jogador (área de colisão; o desenho tem ~35 px de altura, em resolução dobrada)
    playerW: 12,
    playerH: 30,
    playerMaxHp: 5,
    startingLives: 3,
    invulnTime: 1.0,
    attackDuration: 0.28,
    attackActive: [0.03, 0.16], // janela em que a espada causa dano
    attackCooldown: 0.08,
    soulsForLife: 50,

    // Chefe e final
    bossHp: 40,
    totalRelics: 9,
    relicsForGoodEnding: 7
  };

  // Paletas de cada círculo do Inferno (fundo, blocos e brasas).
  BK.THEMES = {
    ash: {
      skyTop: "#120405", skyBottom: "#5c1608", far: "#2b0c0c", mid: "#1b0707",
      stone: "#3b2d2c", stoneDark: "#241a1a", stoneLight: "#57423e",
      crust: "#6e3420", glow: "#ff7a2e", ember: "#ff8a3d", style: "spires"
    },
    lament: {
      skyTop: "#070304", skyBottom: "#6e2206", far: "#260a06", mid: "#170604",
      stone: "#302a30", stoneDark: "#1d1a1f", stoneLight: "#4a4250",
      crust: "#8a2f16", glow: "#ffb03a", ember: "#ffc04a", style: "spires", lavaGlow: true
    },
    cathedral: {
      skyTop: "#05030c", skyBottom: "#2a1048", far: "#1a0c2c", mid: "#100820",
      stone: "#2c2540", stoneDark: "#1a1528", stoneLight: "#463c63",
      crust: "#4d3780", glow: "#c49bff", ember: "#b98cff", style: "cathedral"
    },
    throne: {
      skyTop: "#0a0102", skyBottom: "#4d0707", far: "#250505", mid: "#160303",
      stone: "#33191c", stoneDark: "#1e0d0f", stoneLight: "#52292d",
      crust: "#7c1414", glow: "#ff3b2e", ember: "#ff4d2e", style: "throne"
    }
  };

  BK.util = {
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    approach(value, target, delta) {
      return value < target ? Math.min(value + delta, target) : Math.max(value - delta, target);
    },
    rand: (min, max) => min + Math.random() * (max - min),
    randInt: (min, max) => Math.floor(min + Math.random() * (max - min + 1)),
    pick: (list) => list[Math.floor(Math.random() * list.length)],
    overlap: (a, b) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
    // Gerador pseudoaleatório com semente (mulberry32): cenários sempre iguais.
    seeded(seed) {
      return function () {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
  };

  // localStorage pode falhar (modo privado, arquivo local bloqueado): nunca quebra o jogo.
  BK.storage = {
    get(key, fallback) {
      try {
        const value = window.localStorage.getItem(key);
        return value === null ? fallback : value;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, String(value));
      } catch {
        // Sem armazenamento: o valor vale só nesta sessão.
      }
    }
  };
})(window.BK);
