// Pixel art do jogo, desenhada pixel a pixel em mapas de texto.
// Cada letra é uma cor da paleta do personagem; "." é transparente.
// Todos os personagens foram criados para este jogo; nenhuma imagem externa.
(function (BK) {
  "use strict";

  const T = BK.TILE;

  // ======================= ferramentas =======================
  function makeCanvas(w, h) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }

  // paint(w, h, (p) => p(x, y, largura, altura, cor))
  function paint(w, h, draw) {
    const canvas = makeCanvas(w, h);
    const g = canvas.getContext("2d");
    const p = (x, y, pw, ph, color) => {
      g.fillStyle = color;
      g.fillRect(x, y, pw, ph);
    };
    draw(p, g);
    return canvas;
  }

  function flipped(source) {
    const canvas = makeCanvas(source.width, source.height);
    const g = canvas.getContext("2d");
    g.translate(source.width, 0);
    g.scale(-1, 1);
    g.drawImage(source, 0, 0);
    return canvas;
  }

  // Silhueta de uma cor só (piscar branco ao levar dano, sombra do "estranho").
  function tinted(source, color) {
    const canvas = makeCanvas(source.width, source.height);
    const g = canvas.getContext("2d");
    g.drawImage(source, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = color;
    g.fillRect(0, 0, source.width, source.height);
    g.globalCompositeOperation = "source-over"; // volta ao normal para quem desenhar depois
    return canvas;
  }

  // Contorno automático de 1 px em volta de tudo que não é transparente.
  function addOutline(canvas, color) {
    const g = canvas.getContext("2d");
    const { width: w, height: h } = canvas;
    const alpha = g.getImageData(0, 0, w, h).data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && alpha[(y * w + x) * 4 + 3] > 0;
    g.fillStyle = color;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) {
          g.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  // Mapa de texto -> canvas. Com "outline", ganha 1 px de margem e contorno.
  function fromRows(rows, palette, outline) {
    const pad = outline ? 1 : 0;
    const width = Math.max(...rows.map((row) => row.length));
    const canvas = makeCanvas(width + pad * 2, rows.length + pad * 2);
    const g = canvas.getContext("2d");
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        const color = palette[row[x]];
        if (color) {
          g.fillStyle = color;
          g.fillRect(x + pad, y + pad, 1, 1);
        }
      }
    });
    if (outline) {
      addOutline(canvas, outline);
    }
    return canvas;
  }

  // Troca trechos de linhas: [linha, coluna, "texto"]. Espaço = mantém o pixel.
  function edit(rows, ...changeLists) {
    const out = rows.map((row) => row.split(""));
    for (const changes of changeLists) {
      for (const [y, x, text] of changes) {
        while (out.length <= y) {
          out.push([]);
        }
        [...text].forEach((ch, i) => {
          if (ch === " ") {
            return;
          }
          while (out[y].length < x + i) {
            out[y].push(".");
          }
          out[y][x + i] = ch;
        });
      }
    }
    return out.map((row) => row.join(""));
  }

  // Metade esquerda (24 colunas) + espelho = figura simétrica de 48 colunas.
  function mirror(rows) {
    return rows.map((row) => {
      const half = row.padStart(24, ".");
      return half + [...half].reverse().join("");
    });
  }

  function shade(hex, factor) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * factor))));
    return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  // ======================= SIR ALDRIC (alta resolução, montado por "esqueleto") =======================
  // O cavaleiro é desenhado a partir de juntas (quadril, joelho, tornozelo, ombro, cotovelo):
  // cada pose só muda os ângulos. A resolução é dobrada (KNIGHT_RES): cada pixel lógico do
  // jogo tem 2x2 pixels do desenho, então ele tem 4 vezes mais detalhe que o resto do cenário.
  // Coordenadas abaixo: x para a frente (direita), y para baixo, chão em y = 71.
  const KNIGHT_RES = 2;
  const KW = 112; // largura do quadro (sobra espaço para a espada esticada)
  const KH = 100;
  const OX = 24; // deslocamento do boneco dentro do quadro
  const OY = 28;
  const KN = {
    outline: "#16101a",
    steel: "#b9c1cd", steelL: "#eef2f7", steelD: "#737b8b", visor: "#08060a",
    gold: "#e0b54a", goldL: "#fff1b0", goldD: "#9a7428",
    white: "#ece6d6", whiteL: "#fbf8f0", whiteD: "#c4bba8", whiteDD: "#9e9582",
    red: "#c1272d", redD: "#86161c",
    mail: "#8b92a0", mailL: "#b3bac6", mailD: "#5d6370", mailDD: "#41464f",
    leather: "#5a3a22", leatherL: "#7d5634", leatherD: "#3a2416",
    blade: "#e9eef5", bladeD: "#97a3b3", shield: "#ece6d6"
  };

  // Preenche um polígono linha a linha (sem antisserrilhado: pixels "duros").
  function polygonSpans(points) {
    const ys = points.map((p) => p[1]);
    const spans = [];
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += 1) {
      const cy = y + 0.5;
      const xs = [];
      for (let i = 0; i < points.length; i += 1) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= cy && y2 > cy) || (y2 <= cy && y1 > cy)) {
          xs.push(x1 + ((cy - y1) / (y2 - y1)) * (x2 - x1));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const a = Math.round(xs[i]);
        const b = Math.round(xs[i + 1]);
        if (b > a) {
          spans.push([y, a, b]);
        }
      }
    }
    return spans;
  }

  function knightPainter(canvas) {
    const g = canvas.getContext("2d");
    let dy = OY;
    const place = (points) => points.map(([x, y]) => [x + OX, y + dy]);
    const fill = (points, color) => {
      g.fillStyle = color;
      for (const [y, a, b] of polygonSpans(place(points))) {
        g.fillRect(a, y, b - a, 1);
      }
    };
    return {
      fill,
      // contorno escuro de 1 px em volta de cada peça (separa perna da frente e de trás etc.)
      outlined(points, color) {
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          fill(points.map(([x, y]) => [x + ox, y + oy]), KN.outline);
        }
        fill(points, color);
      },
      // textura de cota de malha: pinta só os pixels que passam no teste
      texture(points, color, test) {
        g.fillStyle = color;
        for (const [y, a, b] of polygonSpans(place(points))) {
          for (let x = a; x < b; x += 1) {
            if (test(x, y)) {
              g.fillRect(x, y, 1, 1);
            }
          }
        }
      },
      setShift(shift) {
        dy = OY + shift;
      }
    };
  }

  const polar = (p, length, angle) => [p[0] + Math.sin(angle) * length, p[1] + Math.cos(angle) * length]; // ângulo a partir da vertical para baixo
  const circle = (cx, cy, r, n = 12) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r]);
  const rotateAround = (x, y, angle, origin) => [origin[0] + x * Math.cos(angle) - y * Math.sin(angle), origin[1] + x * Math.sin(angle) + y * Math.cos(angle)];
  const box = (x1, y1, x2, y2) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
  function limb(a, b, wa, wb) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    return [
      [a[0] + nx * wa / 2, a[1] + ny * wa / 2], [b[0] + nx * wb / 2, b[1] + ny * wb / 2],
      [b[0] - nx * wb / 2, b[1] - ny * wb / 2], [a[0] - nx * wa / 2, a[1] - ny * wa / 2]
    ];
  }
  const raise = (points, bob) => points.map(([x, y]) => [x, y + bob]);

  // membro com volume: cor base, faixa de luz, faixa de sombra e (opcional) malha
  function shadedLimb(P, a, b, wa, wb, colors, mail) {
    const poly = limb(a, b, wa, wb);
    P.outlined(poly, colors.base);
    if (mail) {
      P.texture(poly, colors.dark, (x, y) => (x + 2 * y) % 4 === 0);
      P.texture(poly, colors.light, (x, y) => (x + 2 * y) % 4 === 2 && y % 2 === 0);
    }
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    const offset = (p, w, k) => [p[0] + nx * w * k, p[1] + ny * w * k];
    P.fill(limb(offset(a, wa, 0.3), offset(b, wb, 0.3), wa * 0.28, wb * 0.28), colors.light);
    P.fill(limb(offset(a, wa, -0.32), offset(b, wb, -0.32), wa * 0.3, wb * 0.3), colors.dark);
  }

  const MAIL = { base: KN.mail, light: KN.mailL, dark: KN.mailD };
  const MAIL_BACK = { base: KN.mailD, light: KN.mail, dark: KN.mailDD };

  function legGeometry(hip, [thigh, shin]) {
    const knee = polar(hip, 15, thigh);
    const ankle = polar(knee, 14, shin);
    const footAngle = Math.max(-0.6, Math.min(0.7, -shin * 0.6));
    const boot = [[-3, -3], [3, -3], [4, 0], [8, 1], [9, 3.5], [-3.5, 3.5]].map(([x, y]) => rotateAround(x, y, footAngle, ankle));
    return { hip, knee, ankle, boot, footAngle };
  }

  function drawLeg(P, leg, back) {
    const colors = back ? MAIL_BACK : MAIL;
    shadedLimb(P, leg.hip, leg.knee, 7, 6, colors, true);
    shadedLimb(P, leg.knee, leg.ankle, 6, 5, colors, true);
    // joelheira de aço
    P.outlined(circle(leg.knee[0] + 0.5, leg.knee[1], 2.7, 10), back ? KN.steelD : KN.steel);
    P.fill(circle(leg.knee[0] - 0.2, leg.knee[1] - 0.9, 1.1, 8), back ? KN.steel : KN.steelL);
    // bota de couro com sola e espora
    P.outlined(leg.boot, back ? KN.leatherD : KN.leather);
    const sole = [[-3.5, 2.4], [9, 2.4], [9, 3.5], [-3.5, 3.5]].map(([x, y]) => rotateAround(x, y, leg.footAngle, leg.ankle));
    P.fill(sole, back ? KN.outline : KN.leatherD);
    const cuff = [[-3, -3], [3, -3], [3.2, -1.8], [-3.2, -1.8]].map(([x, y]) => rotateAround(x, y, leg.footAngle, leg.ankle));
    P.fill(cuff, back ? KN.leather : KN.leatherL);
    const spur = rotateAround(-4.6, 1, leg.footAngle, leg.ankle);
    P.fill(circle(spur[0], spur[1], 1.3, 6), back ? KN.goldD : KN.gold);
  }

  // saia da sobreveste: acompanha a coxa, então balança na corrida
  function drawSkirt(P, hip, thigh, front) {
    const angle = thigh * 0.8;
    const center = polar(hip, 12.5, angle);
    const perp = [Math.cos(angle), -Math.sin(angle)];
    const half = 5;
    const left = [center[0] - perp[0] * half, center[1] - perp[1] * half];
    const right = [center[0] + perp[0] * half, center[1] + perp[1] * half];
    const top = front ? [[30, 33.5], [38, 33.5]] : [[24.5, 33.5], [32, 33.5]];
    P.outlined([top[0], top[1], right, left], front ? KN.white : KN.whiteD);
    P.fill(limb(left, right, 1.6, 1.6), front ? KN.whiteD : KN.whiteDD);
    if (front) {
      P.fill([top[1], [top[1][0] - 2, top[1][1]], [right[0] - 2, right[1]], right], KN.whiteD);
    }
  }

  function drawShield(P, bob) {
    P.outlined(raise([[13, 18], [27, 18], [27, 29], [24.5, 35], [20, 39], [15.5, 35], [13, 29]], bob), KN.steelD);
    P.fill(raise([[14.5, 19.5], [25.5, 19.5], [25.5, 28.6], [23.3, 34], [20, 37.2], [16.7, 34], [14.5, 28.6]], bob), KN.shield);
    P.fill(raise([[22.5, 19.5], [25.5, 19.5], [25.5, 28.6], [23.3, 34], [20.5, 36.6]], bob), KN.whiteD);
    P.fill(raise(box(19, 20.5, 21.2, 36), bob), KN.red);
    P.fill(raise(box(15, 24.6, 25.2, 26.8), bob), KN.red);
    P.fill(raise(box(20.6, 20.5, 21.2, 36), bob), KN.redD);
  }

  function drawTorso(P, bob) {
    // ombros de cota de malha por baixo da sobreveste
    P.outlined(raise([[22.5, 18], [39.5, 18], [40.5, 24], [21.5, 24]], bob), KN.mail);
    // sobreveste branca
    P.outlined(raise([[24, 19], [38, 19], [39, 23], [37.5, 35], [24.5, 35], [23, 23]], bob), KN.white);
    P.fill(raise([[35.4, 19.4], [38, 19.4], [38.6, 23], [37.1, 34.6], [34.8, 34.6]], bob), KN.whiteD);
    P.fill(raise([[24.4, 19.4], [25.8, 19.4], [25.6, 34.6], [25, 34.6], [23.5, 23]], bob), KN.whiteL);
    // cruz pátea (pontas alargadas), símbolo da Ordem do Templo
    P.fill(raise([[29.5, 20.4], [33.5, 20.4], [32.4, 23.5], [32.4, 29.5], [33.5, 32.6], [29.5, 32.6], [30.6, 29.5], [30.6, 23.5]], bob), KN.red);
    P.fill(raise([[24.8, 23.5], [28, 24.6], [35, 24.6], [38.2, 23.5], [38.2, 28.5], [35, 27.4], [28, 27.4], [24.8, 28.5]], bob), KN.red);
    P.fill(raise([[32, 23.5], [32.4, 23.5], [32.4, 29.5], [33.5, 32.6], [32, 32.6]], bob), KN.redD);
    P.fill(raise([[28, 26.6], [35, 26.6], [38.2, 27.7], [38.2, 28.5], [35, 27.4], [28, 27.4], [24.8, 28.5], [24.8, 27.7]], bob), KN.redD);
    // cinto com fivela
    P.outlined(raise(box(24.5, 33, 37.5, 35.4), bob), KN.leather);
    P.fill(raise(box(30, 32.6, 33, 35.9), bob), KN.gold);
    P.fill(raise(box(31, 33.6, 32, 34.9), bob), KN.leatherD);
  }

  // elmo fechado (great helm) com fresta e cruz de reforço dourada
  function drawHelm(P, bob) {
    P.outlined(raise([[26.5, 13.5], [36.5, 13.5], [38, 19.5], [25, 19.5]], bob), KN.mail);
    P.texture(raise([[26.5, 13.5], [36.5, 13.5], [38, 19.5], [25, 19.5]], bob), KN.mailD, (x, y) => (x + 2 * y) % 4 === 0);
    P.outlined(raise([[25, 1.5], [38, 1.5], [38.6, 14.5], [24.6, 14.5]], bob), KN.steel);
    P.fill(raise([[25.4, 2], [27.4, 2], [27.2, 14], [25.2, 14]], bob), KN.steelL);
    P.fill(raise([[36.3, 2], [38, 2], [38.4, 14], [36.1, 14]], bob), KN.steelD);
    P.fill(raise(box(25, 1.5, 38, 3), bob), KN.steelD);
    P.fill(raise([[25, 12.9], [38.6, 12.9], [38.6, 14.5], [24.6, 14.5]], bob), KN.steelD);
    P.fill(raise(box(28.4, 6, 38.6, 7.8), bob), KN.visor);
    P.fill(raise(box(31.9, 3, 33.7, 12.9), bob), KN.gold);
    P.fill(raise(box(28, 8, 38.6, 9.7), bob), KN.gold);
    P.fill(raise(box(31.9, 3, 32.6, 12.9), bob), KN.goldL);
    P.fill(raise(box(28, 8, 38.6, 8.6), bob), KN.goldL);
    for (const [x, y] of [[35, 10.6], [37, 10.6], [36, 12]]) {
      P.fill(raise(box(x, y, x + 1, y + 1), bob), KN.visor);
    }
    for (const x of [26.4, 29.6, 35.4]) {
      P.fill(raise(box(x, 3.6, x + 1, 4.6), bob), KN.steelL);
    }
  }

  function drawArm(P, shoulder, elbow, hand, back) {
    shadedLimb(P, shoulder, elbow, 6, 5, back ? MAIL_BACK : MAIL, true);
    shadedLimb(P, elbow, hand, 5, 4, back ? MAIL_BACK : MAIL, true);
    P.outlined(circle(elbow[0], elbow[1], 2, 8), back ? KN.steelD : KN.steel);
  }

  function drawHand(P, hand, back) {
    P.outlined(circle(hand[0], hand[1], 2.6, 10), back ? KN.leatherD : KN.leather);
    P.fill(circle(hand[0] - 0.6, hand[1] - 0.8, 1, 6), back ? KN.leather : KN.leatherL);
  }

  // espada: pomo, empunhadura, guarda dourada e lâmina com sulco central
  function drawSword(P, hand, angle) {
    const d = [Math.cos(angle), Math.sin(angle)];
    const n = [-d[1], d[0]];
    const at = (t, s = 0) => [hand[0] + d[0] * t + n[0] * s, hand[1] + d[1] * t + n[1] * s];
    P.outlined([at(4, -1.8), at(25, -1.6), at(30, 0), at(25, 1.6), at(4, 1.8)], KN.blade);
    P.fill([at(5, 0), at(25, 0.2), at(29, 0), at(25, 1.4), at(5, 1.6)], KN.bladeD);
    P.fill(limb(at(6), at(23), 0.9, 0.7), KN.bladeD);
    P.outlined(limb(at(-4), at(3), 2.4, 2.4), KN.leatherD);
    P.outlined(circle(...at(-5.2), 1.9, 8), KN.gold);
    P.outlined(limb(at(3.6, -5.2), at(3.6, 5.2), 2.3, 2.3), KN.gold);
    P.fill(limb(at(3.2, -4.6), at(3.2, 4.6), 0.8, 0.8), KN.goldL);
  }

  const BACK_HIP = [29, 38];
  const FRONT_HIP = [33, 38];
  const lowestBoot = (legs) => Math.max(...legs.flatMap((leg) => leg.boot.map((p) => p[1])));
  const IDLE_LEGS = { back: [-0.12, 0.02], front: [0.14, -0.02] };
  const IDLE_SHIFT = 71 - lowestBoot([legGeometry(BACK_HIP, IDLE_LEGS.back), legGeometry(FRONT_HIP, IDLE_LEGS.front)]);

  // pose: { back, front: [coxa, canela], arm: [braço, antebraço, espada], backArm: [braço, antebraço], bob, air }
  function knightFrame(pose) {
    const canvas = makeCanvas(KW, KH);
    const P = knightPainter(canvas);
    const back = legGeometry(BACK_HIP, pose.back);
    const front = legGeometry(FRONT_HIP, pose.front);
    P.setShift(pose.air ? IDLE_SHIFT - 3 : 71 - lowestBoot([back, front]));
    const bob = pose.bob || 0;

    drawShield(P, bob);
    const backShoulder = [27.5, 21 + bob];
    const backElbow = polar(backShoulder, 8, pose.backArm[0]);
    const backHand = polar(backElbow, 8, pose.backArm[1]);
    drawArm(P, backShoulder, backElbow, backHand, true);
    drawHand(P, backHand, true);
    drawLeg(P, back, true);
    drawSkirt(P, BACK_HIP, pose.back[0], false);
    drawLeg(P, front, false);
    drawTorso(P, bob);
    drawSkirt(P, FRONT_HIP, pose.front[0], true);
    drawHelm(P, bob);

    const shoulder = [36, 21 + bob];
    const elbow = polar(shoulder, 8, pose.arm[0]);
    const hand = polar(elbow, 8, pose.arm[1]);
    drawSword(P, hand, pose.arm[2]);
    drawArm(P, shoulder, elbow, hand, false);
    drawHand(P, hand, false);

    addOutline(canvas, KN.outline);
    return canvas;
  }

  // corrida em 6 quadros: coxas balançam em oposição, o joelho dobra quando a perna volta
  function runPose(i) {
    const phase = (i / 6) * Math.PI * 2;
    const leg = (p) => {
      const thigh = 0.62 * Math.sin(p);
      return [thigh, thigh - (0.15 + 0.95 * Math.max(0, Math.cos(p)))];
    };
    return {
      front: leg(phase),
      back: leg(phase + Math.PI),
      arm: [0.75, 0.15 + 0.2 * Math.sin(phase), -0.75],
      backArm: [-0.5 * Math.sin(phase), -0.3 - 0.3 * Math.sin(phase)]
    };
  }

  const LUNGE = { back: [-0.45, -0.25], front: [0.45, 0.05] };
  const TUCK = { back: [0.35, -0.7], front: [0.95, -0.55], air: true };
  const KNIGHT_POSES = {
    idle: [
      { ...IDLE_LEGS, arm: [0.25, 0.1, 1.15], backArm: [-0.15, 0.1] },
      { ...IDLE_LEGS, arm: [0.25, 0.12, 1.12], backArm: [-0.15, 0.1], bob: 1 }
    ],
    run: [0, 1, 2, 3, 4, 5].map(runPose),
    jump: [{ ...TUCK, arm: [1.2, 0.6, -0.6], backArm: [-0.9, -0.6] }],
    fall: [{ back: [-0.35, -0.05], front: [0.3, 0.15], air: true, arm: [1.6, 1.3, -0.3], backArm: [-1.2, -1.0] }],
    // golpes: quadro 0 = preparação, quadro 1 = impacto
    attack: [
      { ...LUNGE, arm: [-2.3, -2.6, -2.2], backArm: [0.6, 0.9] },
      { ...LUNGE, arm: [1.5, 1.57, 0], backArm: [-0.8, -0.6] }
    ],
    attackUp: [
      { ...IDLE_LEGS, arm: [0.9, 1.6, 2.3], backArm: [-0.3, 0] },
      { ...IDLE_LEGS, arm: [2.75, 2.95, -1.57], backArm: [-0.4, -0.2] }
    ],
    attackDown: [
      { ...TUCK, arm: [2.6, 2.9, -1.9], backArm: [-0.6, -0.3] },
      { ...TUCK, arm: [0.15, 0.05, 1.57], backArm: [-0.9, -0.6] }
    ],
    hurt: [{ back: [-0.4, -0.1], front: [0.35, 0.2], arm: [-1.8, -2.2, -2.4], backArm: [-1.0, -1.2] }]
  };

  // ======================= DIABRETE (olha para a esquerda) =======================
  const IMP = {
    h: "#e8d8b0", H: "#a89878", d: "#6e1218", r: "#b3262e", R: "#e2524a", y: "#ffd23f",
    p: "#2a0505", t: "#fff6e0", c: "#e8d8b0", w: "#4a0d14", W: "#8a1c2a"
  };
  const IMP_BASE = [
    "...h..........h",
    "...hh........hh",
    "....hH......Hh",
    "....drrrrrrrrrd",
    "...dRRRRRRRRRrrd",
    "...dRyyRRRRyyrrd",
    "...dRpyRRRRpyrrd",
    "...ddRRRRRRRRrdd",
    "....drtpppppptrd",
    "....ddrrrrrrrrdd",
    ".....drRRRRRrd...dR",
    "...cdrRRRRRRrrdddd",
    "...cdrRRRRRRrrd",
    ".....drrrrrrrd"
  ];
  const IMP_FRAMES = [
    [
      [14, 0, "......dd...dd"], [15, 0, "......dd...dd"], [16, 0, ".....ccc..ccc"],
      [2, 0, "ww"], [3, 0, "wWw"], [4, 0, "wWw"], [5, 1, "ww"], [6, 2, "w"],
      [2, 17, "ww"], [3, 16, "wWw"], [4, 16, "wWw"], [5, 16, "ww"], [6, 16, "w"]
    ],
    [
      [14, 0, ".....dd.....dd"], [15, 0, "....dd.......dd"], [16, 0, "....cc........cc"],
      [6, 0, "w"], [7, 0, "wW"], [8, 0, "wWw"], [9, 1, "ww"],
      [6, 18, "w"], [7, 17, "Ww"], [8, 16, "wWw"], [9, 16, "ww"]
    ]
  ];

  // ======================= ALMA PENADA =======================
  const WRAITH = { a: "#2c1d45", m: "#5b4385", M: "#9a7fd0", f: "#120a1c", E: "#d8ffff", e: "#7ef9ff" };
  const WRAITH_BASE = [
    "......aaaaaa",
    "....aammmmmmaa",
    "...ammMMMmmmmma",
    "...amMffffffmma",
    "...amMfEffEffma",
    "...amMffffffmma",
    "...ammMffffmmma",
    "..ammMMmmmmmmmaa",
    ".aammMMmmmmmmmmaa",
    "aammMMMmmmmmmmmmaa",
    "a.amMMmmmmmmmmma.a",
    "e.amMMmmmmmmmmma.e",
    "...amMmmmmmmmmma",
    "...amMmmmmmmmmaa",
    "...ammmmmmmmmma"
  ];
  const WRAITH_FRAMES = [
    [[15, 0, "...am.mm.mm.ma"], [16, 0, "...a..ma..m..a"], [17, 0, "......a...a"]],
    [[15, 0, "...amm.mm.mma"], [16, 0, "....am..m.am"], [17, 0, ".....a....a"]]
  ];

  // ======================= TEMPLÁRIO CAÍDO (olha para a esquerda) =======================
  const CULTIST = { k: "#15101c", b: "#2b2236", B: "#463a58", f: "#07040a", e: "#ff4d2e", g: "#c99a3a", s: "#8c6a5a" };
  const CULTIST_BASE = [
    ".........kk",
    "........kbbk",
    ".......kbBbbk",
    "......kbBBbbbk",
    "......kbBffffbk",
    "......kbBefefbk",
    "......kbBffffbk",
    ".....kbBBbfffbbk",
    "....kbBBbbbbbbbbk",
    "....kbBbbbbgbbbbk",
    "...kbBBbbbbgbbbbbk",
    "...kbBbbbbbgbbbbbk",
    "...kbBbbbbbgbbbbbk",
    "...kbBbbbbbgbbbbbk",
    "...kbBbbgggggbbbbk",
    "...kbBbbbbbgbbbbbk",
    "...kbBbbbbbbbbbbbk",
    "..kbBBbbbbbbbbbbbbk",
    "..kbBbbbbbbbbbbbbbk",
    "..kbBbbbbbbbbbbbbbk",
    ".kbBBbbbbbbbbbbbbbbk",
    ".kbBbbbbbbbbbbbbbbbk",
    ".kbBbbbbbbbbbbbbbbbk",
    ".kkbbbbbbbbbbbbbbbkk",
    "..kkkkkkkkkkkkkkkkk",
    "......kk....kk"
  ];
  const CULTIST_FRAMES = [
    [[15, 1, "ss"], [15, 18, "ss"]],
    [[7, 0, "ss"], [8, 0, "sbbb"], [9, 1, "kbb"], [15, 18, "ss"]]
  ];

  // ======================= BELIAL (48x55, de frente, simétrico) =======================
  const BELIAL = {
    K: "#2a1d1a", k: "#5a4a40", r: "#a3202a", R: "#d8443e", d: "#5e0f16", y: "#ffe14a", Y: "#fff8c0",
    m: "#1a0507", f: "#fff3d6", a: "#24181d", A: "#4a3640", g: "#e0b54a", G: "#9a7428",
    w: "#2a0a10", W: "#4d1420", c: "#e8d8b0", h: "#1a1210"
  };
  const BELIAL_HEAD = [
    "......KK................",
    ".....KkK................",
    ".....KkK................",
    "......KkK...............",
    "......KkKK..............",
    ".......KkKK.............",
    "........KkKK...........g",
    ".........KkKK..g......gG",
    "..........KKKK.gG..g..gG",
    "...........KKKKgGg.gG.gG",
    "............KKgggggggggg",
    "............dGGGGGGGGGGG",
    "............drRRRRRRRRRR",
    "...........drRRrrrrrrrrr",
    "...........drrdddrrrrrrr",
    "...........drdyyYyddrrrr",
    "...........drddyyydrrrrr",
    "...........drrrdddrrrrrr",
    "............drrrrrrrrrdd",
    "............drrmmmmmmmmm",
    "............drrmfmmmfmmm",
    "............ddrrmmmmmmmm",
    ".............ddrrrrrrrrr",
    "..............dddddddddd"
  ];
  const BELIAL_WING_PART = ["ww..", "wWw.", "wWWw", "wWWw", "wWWw", "wWWw", "wWw.", "wWw.", "wWw.", "ww..", "ww..", "w...", "w...", "....", "....", "....", "...."];
  const BELIAL_ARM_PART = [".ddd", "rRRr", "rRRr", "rRrd", "rRrd", "rRrd", "rRrd", "rRrd", "rRrd", "rRrd", "drrd", "drrd", "dRrd", "dRrd", "dddd", "c.cc", "c..c"];
  const BELIAL_ARMOR = [
    "aaaaaaaaaaaaaaaa", "aAAAAAAaaaaaaaaa", "aAaaaaaaaaaaaaaa", "aAaaaaaaaaaaaaGg", "aAaaaaaaaaaaaaGg",
    "aAaaaaaaaaaaaaGg", "aAaaaaaaaaaaaaGg", "aAaaaaaaaaaaaaGg", "aAaaaaaaaaGGGGGg", "aAaaaaaaaaaaaaGg",
    "aAaaaaaaaaaaaaaa", "aaaaaaaaaaaaaaaa", "gGGGGGGGGGGGGGGG", "Gggggggggggggggy", "aaaaaaaaaaaaaaaa",
    ".aAaaaaaaaaaaaaa", "..aAaaaaaaaaaaaa"
  ];
  const BELIAL_LEGS = [
    "...........ddrrrrrd.....",
    "...........drRRrrrd.....",
    "...........drRrrrrd.....",
    "...........drRrrrrd.....",
    "............drRrrd......",
    "............ddrrdd......",
    "...........drRrrrd......",
    "...........drRrrrd......",
    "............drrrd.......",
    "............drrrd.......",
    "...........dhhhhhd......",
    "..........hhhhhhhh......",
    "..........hkkkkkhh......",
    "..........hhhhhhhh......"
  ];
  const BELIAL_WINGS = [
    [10, 0, "w"], [11, 0, "ww"], [12, 0, "wWw"], [13, 0, "wWWw"], [14, 0, "wWWWw"], [15, 0, "wWWWww"],
    [16, 0, "wWWWWw"], [17, 0, "wWwWWww"], [18, 0, "wWwWWWw"], [19, 0, "wWwwWWww"], [20, 0, "wWw wWWw"],
    [21, 0, "wWw  wWw"], [22, 0, "wWw   ww"], [23, 0, "wWw    w"]
  ];
  const BELIAL_RAISED_ARMS = [[4, 1, "c c"], [5, 1, "cccc"]];
  for (let y = 6; y <= 21; y += 1) {
    BELIAL_RAISED_ARMS.push([y, 1, y < 14 ? "rRRr" : "rRrd"]);
  }
  BELIAL_RAISED_ARMS.push([22, 1, "rRRrr"], [23, 1, "drRRrr"], [24, 4, "rrdd"]);

  function belialHalf(raised) {
    const body = BELIAL_ARMOR.map((armor, i) => BELIAL_WING_PART[i] + (raised && i > 0 ? "...." : BELIAL_ARM_PART[i]) + armor);
    const half = edit([...BELIAL_HEAD, ...body, ...BELIAL_LEGS], BELIAL_WINGS, raised ? BELIAL_RAISED_ARMS : []);
    return half.map((row) => row.padEnd(24, ".").slice(0, 24));
  }

  // ======================= ISOLDE =======================
  const ISOLDE = {
    h: "#a8752a", H: "#d9a441", j: "#f2cc6e", s: "#f1c7a5", S: "#d9a688", e: "#2a3a6a", l: "#c97a6a",
    D: "#3b5ba5", L: "#6d8fd6", K: "#253b70", g: "#e0b54a", k: "#2a1a14"
  };
  const ISOLDE_ROWS = [
    "......hhhh",
    "....hhjjHHhh",
    "...hjjHHHHHHh",
    "...hjHsssssHh",
    "...hHssssssSHh",
    "...hHsesssesHh",
    "...hHssssssSHh",
    "...hHsssllsSHh",
    "...hhHsssssHhh",
    "..hhHH.sSs.HHhh",
    "..hHHDDDDDDDHHh",
    "..hHDLLDDDDDKHh",
    "..hhDLDDgDDDKhh",
    "...hDLDDDDDDKh",
    "..sDDLDDDDDDKDs",
    "..sDLDDDDDDDDKs",
    "...DLggggggggK",
    "...DLDDDDDDDDK",
    "..DLLDDDDDDDDKK",
    "..DLDDDDDDDDDDK",
    "..DLDDDDDDDDDDK",
    ".DLLDDDDDDDDDDKK",
    ".DLDDDDDDDDDDDDK",
    ".DLDDDDDDDDDDDDK",
    "DLLDDDDDDDDDDDKK",
    "DLDDDDDDDDDDDDDK",
    "DLDDDDDDDDDDDDDK",
    "KKKKKKKKKKKKKKKK",
    "....kk....kk"
  ];

  // ======================= FREI ANSELMO (espírito) =======================
  const ANSELMO = {
    a: "#3f6f9e", b: "#7fb6e6", c: "#c8e6ff", s: "#dce9f2", S: "#b9cbd8", e: "#1d3550",
    w: "#f2f8ff", r: "#e8dcb0", R: "#b8a878"
  };
  const ANSELMO_ROWS = [
    "......aaaaaa",
    "....aabbbbbbaa",
    "...abbcccbbbbba",
    "...abcbssssssba",
    "...abcbsessesba",
    "...abcbsssssSba",
    "...abcbswwwwSba",
    "...abbcbwwwwbba",
    "..abbbcbbwwbbbba",
    "..abbccbbbbbbbbba",
    ".abbccbbbbbbbbbbba",
    ".abccbbcccccbbbbba",
    ".abccbcssssscbbbba",
    ".abcbbbcccccbbbbba",
    ".abcbbbbbbbbbbbbba",
    ".abcrrrrrrrrrrrrra",
    ".abcbbbbbbrRbbbbba",
    ".abcbbbbbbrRbbbbba",
    ".abcbbbbbbrRbbbbba",
    ".abcbbbbbbbrbbbbba",
    ".abcbbbbbbbbbbbbba",
    ".abcbbbbbbbbbbbbba",
    "abccbbbbbbbbbbbbba",
    "abcbbbbbbbbbbbbbbba",
    "abcbbbbbbbbbbbbbbba",
    ".abbb.bbbbb.bbbbba",
    "..ab...bbb...bbba",
    "...a....b.....ba"
  ];

  // ======================= itens e interface =======================
  const soul = (frame) => paint(10, 10, (p) => {
    p(4, frame ? 0 : 1, 2, 2, "#e9fbff");
    p(3, 3, 4, 3, "#9fe8ff");
    p(2, 5, 6, 4, "#5cc8f0");
    p(4, 5, 2, 3, "#ffffff");
    p(3, 9, 4, 1, "#2f86b8");
  });
  const relic = () => paint(10, 10, (p) => {
    p(3, 1, 4, 1, "#c8b9a0"); p(2, 2, 6, 6, "#f3ead7"); p(3, 8, 4, 1, "#c8b9a0");
    p(1, 3, 1, 4, "#c8b9a0"); p(8, 3, 1, 4, "#c8b9a0");
    p(3, 2, 2, 2, "#ffffff");
    p(5, 3, 1, 5, "#c1272d"); p(4, 4, 3, 1, "#c1272d");
  });
  const heartItem = () => paint(10, 9, (p) => {
    p(1, 0, 3, 1, "#ff5d6c"); p(6, 0, 3, 1, "#ff5d6c");
    p(0, 1, 10, 4, "#e01e37"); p(1, 5, 8, 1, "#e01e37"); p(2, 6, 6, 1, "#e01e37");
    p(3, 7, 4, 1, "#a3001b"); p(4, 8, 2, 1, "#a3001b");
    p(2, 1, 2, 2, "#ffc2c9");
  });
  const hudHeart = (full) => paint(9, 8, (p) => {
    const main = full ? "#e01e37" : "#3a2226";
    const light = full ? "#ff8a96" : "#4d3034";
    p(1, 0, 3, 1, main); p(5, 0, 3, 1, main);
    p(0, 1, 9, 3, main); p(1, 4, 7, 1, main); p(2, 5, 5, 1, main); p(3, 6, 3, 1, main); p(4, 7, 1, 1, main);
    p(1, 1, 2, 1, light);
  });
  const bead = (full) => paint(6, 6, (p) => {
    const main = full ? "#f3ead7" : "#3a3036";
    p(1, 0, 4, 6, main); p(0, 1, 6, 4, main);
    if (full) {
      p(1, 1, 2, 1, "#ffffff"); p(2, 2, 2, 2, "#c1272d");
    }
  });
  const helmIcon = () => paint(9, 9, (p) => {
    p(0, 0, 9, 9, KN.outline); p(1, 1, 7, 7, KN.steel); p(1, 1, 1, 6, KN.steelL);
    p(2, 3, 6, 1, KN.visor); p(5, 1, 1, 7, KN.gold); p(3, 4, 5, 1, KN.gold);
  });
  const checkpoint = (lit) => paint(16, 24, (p) => {
    p(2, 18, 12, 6, "#4a4048"); p(1, 17, 14, 1, "#6a5f68"); p(2, 23, 12, 1, "#2a2428");
    p(3, 19, 1, 4, "#5e5460"); p(12, 19, 1, 4, "#352e36");
    const wood = lit ? "#e0b54a" : "#6e6258";
    const light = lit ? "#fff1b0" : "#8a7e72";
    const dark = lit ? "#a8792a" : "#4a4038";
    p(7, 2, 2, 15, wood); p(4, 6, 8, 2, wood); p(7, 2, 1, 15, light); p(4, 6, 8, 1, light);
    p(8, 3, 1, 14, dark); p(4, 7, 8, 1, dark);
    p(2, 15, 2, 2, "#efe6d0"); p(12, 15, 2, 2, "#efe6d0");
  });

  // ======================= blocos do cenário (16x16) =======================
  // Pedra em tijolos com relevo: luz em cima/esquerda, sombra embaixo/direita.
  function groundTile(th, top, variant) {
    const rng = BK.util.seeded(variant * 97 + (top ? 13 : 0) + 5);
    const mortar = shade(th.stoneDark, 0.7);
    return paint(T, T, (p) => {
      p(0, 0, T, T, mortar);
      for (const [by, offset] of [[0, 0], [8, 4]]) {
        for (let bx = -8 + offset; bx < T; bx += 8) {
          const x0 = Math.max(0, bx);
          const x1 = Math.min(T, bx + 7);
          if (x1 <= x0) {
            continue;
          }
          p(x0, by, x1 - x0, 7, th.stone);
          p(x0, by, x1 - x0, 1, th.stoneLight);
          if (bx >= 0) {
            p(bx, by, 1, 7, th.stoneLight);
          }
          p(x0, by + 6, x1 - x0, 1, th.stoneDark);
          if (bx + 6 < T) {
            p(bx + 6, by + 1, 1, 6, th.stoneDark);
          }
        }
      }
      for (let i = 0; i < 6; i += 1) {
        p(Math.floor(rng() * T), Math.floor(rng() * T), 1, 1, i % 2 ? th.stoneLight : th.stoneDark);
      }
      if (rng() < 0.6) {
        const cx = 2 + Math.floor(rng() * 10);
        const cy = 9 + Math.floor(rng() * 3);
        p(cx, cy, 1, 1, mortar); p(cx + 1, cy + 1, 1, 1, mortar); p(cx + 1, cy + 2, 1, 1, mortar);
      }
      if (top) {
        p(0, 0, T, 4, th.crust);
        p(0, 0, T, 1, shade(th.crust, 1.35));
        p(0, 4, T, 1, mortar);
        for (let i = 0; i < 3; i += 1) {
          const dx = Math.floor(rng() * 14);
          p(dx, 4, 2, 1 + Math.floor(rng() * 2), th.crust);
        }
        for (let i = 0; i < 5; i += 1) {
          p(Math.floor(rng() * T), Math.floor(rng() * 3), 1, 1, th.glow);
        }
      }
    });
  }

  function crackedTile(th) {
    return paint(T, T, (p) => {
      p(0, 0, T, T, th.stone);
      p(0, 0, T, 1, th.stoneLight); p(0, 0, 1, T, th.stoneLight);
      p(0, 15, T, 1, th.stoneDark); p(15, 0, 1, T, th.stoneDark);
      p(1, 1, 14, 14, shade(th.stone, 1.12));
      const crack = [[3, 1], [4, 2], [5, 3], [6, 4], [6, 5], [7, 6], [8, 7], [8, 8], [9, 9], [10, 10], [10, 11], [11, 12], [12, 13],
        [6, 7], [5, 8], [4, 9], [3, 10], [9, 7], [10, 6], [11, 5], [12, 4]];
      for (const [x, y] of crack) {
        p(x, y, 1, 1, th.stoneDark);
      }
      // brilho nas rachaduras: sinal de que dá para quebrar
      for (const [x, y] of [[5, 3], [7, 6], [8, 8], [10, 10], [4, 9], [11, 5]]) {
        p(x, y, 1, 1, th.glow);
      }
    });
  }

  function altarTile(glow, used) {
    return paint(T, T, (p) => {
      if (used) {
        p(0, 0, T, T, "#3a2a24"); p(0, 0, T, 1, "#5a4434"); p(0, 0, 1, T, "#5a4434");
        p(0, 15, T, 1, "#21170f"); p(15, 0, 1, T, "#21170f");
        p(2, 2, 12, 12, "#2a1c18");
        p(7, 4, 2, 8, "#3a2a24"); p(4, 7, 8, 2, "#3a2a24");
        return;
      }
      p(0, 0, T, T, "#2a1a10");
      p(0, 0, T, 1, "#fff1b0"); p(0, 1, T, 1, "#e0b54a"); p(0, 0, 1, T, "#e0b54a"); p(1, 0, 1, T, "#c99a3a");
      p(0, 15, T, 1, "#6a4a18"); p(15, 0, 1, T, "#6a4a18"); p(0, 14, T, 1, "#8a6420"); p(14, 0, 1, T, "#8a6420");
      p(2, 2, 12, 12, "#4a1e22"); p(2, 2, 12, 1, "#5e2a2c");
      const cross = glow ? "#fff1b0" : "#ffd86a";
      p(7, 3, 2, 10, cross); p(4, 6, 8, 2, cross);
      p(7, 3, 1, 10, "#fff8dc"); p(4, 6, 8, 1, "#fff8dc");
      p(6, 6, 4, 2, glow ? "#ffffff" : "#fff1b0");
    });
  }

  const platformTile = () => paint(T, T, (p) => {
    p(0, 0, T, 5, "#cbbd9a");
    p(0, 0, T, 1, "#f3ead2");
    p(0, 4, T, 1, "#7a6a50");
    p(2, 2, 5, 1, "#b0a280"); p(9, 1, 4, 1, "#b0a280"); p(5, 3, 3, 1, "#b0a280");
    p(3, 0, 2, 5, "#5a4a3a"); p(11, 0, 2, 5, "#5a4a3a");
    p(3, 1, 2, 1, "#8a7a68"); p(11, 1, 2, 1, "#8a7a68");
    p(3, 5, 2, 3, "#5a4a3a"); p(11, 5, 2, 3, "#5a4a3a");
    p(4, 8, 1, 1, "#3a2e24"); p(12, 8, 1, 1, "#3a2e24");
  });

  const spikeTile = () => paint(T, T, (p) => {
    for (let i = 0; i < 4; i += 1) {
      const x = i * 4;
      p(x + 1, 6, 1, 1, "#7a1420");
      p(x + 1, 7, 2, 2, "#f3ead2");
      p(x + 1, 9, 2, 3, "#d8ccb0");
      p(x, 12, 4, 4, "#b0a284");
      p(x + 2, 9, 1, 7, "#8a7c62");
      p(x + 3, 12, 1, 4, "#5e5442");
    }
    p(0, 15, T, 1, "#3a3226");
  });

  function lavaTop(frame) {
    return paint(T, T, (p) => {
      for (let x = 0; x < T; x += 1) {
        const surface = 4 + Math.round(1.5 * Math.sin(((x / T) + frame / 3) * Math.PI * 2));
        p(x, surface, 1, T - surface, "#e8590c");
        p(x, surface + 3, 1, T - surface - 3, "#d24a0a");
        p(x, surface, 1, 2, "#ffb03a");
        p(x, surface, 1, 1, "#ffe8a3");
      }
      p((frame * 5 + 3) % 14, 10, 2, 2, "#ff922b");
      p((frame * 7 + 9) % 14, 13, 1, 1, "#ffb03a");
    });
  }
  function lavaBody(frame) {
    return paint(T, T, (p) => {
      p(0, 0, T, T, "#c2410c");
      p((frame * 7 + 2) % 12, 3, 4, 2, "#e8590c");
      p((frame * 3 + 9) % 12, 10, 3, 2, "#e8590c");
      p((frame * 5 + 5) % 13, 7, 2, 1, "#9a2a08");
      p((frame * 11 + 1) % 14, 13, 2, 1, "#ff922b");
    });
  }

  // ======================= registro =======================
  const frames = {};
  const resolution = {}; // pixels do desenho por pixel lógico (1 = normal)
  const cache = new Map();
  const register = (name, list) => { frames[name] = list; };

  // cavaleiro: quadros gerados a partir das poses, em resolução dobrada
  for (const [pose, list] of Object.entries(KNIGHT_POSES)) {
    register("knight." + pose, list.map(knightFrame));
    resolution["knight." + pose] = KNIGHT_RES;
  }

  register("imp", IMP_FRAMES.map((changes) => fromRows(edit(IMP_BASE, changes), IMP, "#14030a")));
  register("wraith", WRAITH_FRAMES.map((changes) => fromRows(edit(WRAITH_BASE, changes), WRAITH, "#0b0614")));
  register("cultist", CULTIST_FRAMES.map((changes) => fromRows(edit(CULTIST_BASE, changes), CULTIST, "#050308")));
  const belialIdle = fromRows(mirror(belialHalf(false)), BELIAL, "#0a0204");
  register("belial", [belialIdle, belialIdle, fromRows(mirror(belialHalf(true)), BELIAL, "#0a0204")]);
  register("stranger", [(() => {
    const dark = tinted(belialIdle, "#2a0c10");
    const g = dark.getContext("2d");
    g.fillStyle = "#ff2a2a";
    g.fillRect(15, 16, 4, 2);
    g.fillRect(31, 16, 4, 2);
    g.fillStyle = "#ffb0a0";
    g.fillRect(16, 16, 1, 1);
    g.fillRect(33, 16, 1, 1);
    return dark;
  })()]);
  register("isolde", [fromRows(ISOLDE_ROWS, ISOLDE, "#140a10")]);
  register("anselmo", [fromRows(ANSELMO_ROWS, ANSELMO, "#1a2c40")]);

  register("soul", [soul(0), soul(1)]);
  register("relic", [relic()]);
  register("heart", [heartItem()]);
  register("hud.heart", [hudHeart(false), hudHeart(true)]);
  register("hud.bead", [bead(false), bead(true)]);
  register("hud.helm", [helmIcon()]);
  register("checkpoint", [checkpoint(false), checkpoint(true)]);
  register("tile.platform", [platformTile()]);
  register("tile.spikes", [spikeTile()]);
  register("tile.lavaTop", [0, 1, 2].map(lavaTop));
  register("tile.lava", [0, 1].map(lavaBody));
  register("tile.altar", [altarTile(false, false), altarTile(true, false)]);
  register("tile.altarUsed", [altarTile(false, true)]);

  const themeTiles = {};

  BK.sprites = {
    // get("imp", 1, true) -> quadro 1, espelhado; white = silhueta branca
    get(name, frame = 0, flip = false, white = false) {
      const list = frames[name];
      const index = ((frame % list.length) + list.length) % list.length;
      const key = `${name}|${index}|${flip ? 1 : 0}|${white ? 1 : 0}`;
      let canvas = cache.get(key);
      if (!canvas) {
        canvas = list[index];
        if (white) {
          canvas = tinted(canvas, "#ffffff");
        }
        if (flip) {
          canvas = flipped(canvas);
        }
        cache.set(key, canvas);
      }
      return canvas;
    },
    count: (name) => frames[name].length,
    res: (name) => resolution[name] || 1,
    theme(themeName) {
      if (!themeTiles[themeName]) {
        const th = BK.THEMES[themeName];
        themeTiles[themeName] = {
          ground: [0, 1, 2].map((v) => groundTile(th, false, v)),
          groundTop: [0, 1, 2].map((v) => groundTile(th, true, v)),
          cracked: crackedTile(th)
        };
      }
      return themeTiles[themeName];
    },
    paint,
    makeCanvas
  };
})(window.BK);
