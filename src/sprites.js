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

  // ======================= SIR ALDRIC (32x32) =======================
  const KNIGHT = {
    O: "#1a1218", L: "#eef2f7", S: "#b9c1cd", D: "#6f7787", V: "#0b080d",
    G: "#e0b54a", g: "#9a7428", W: "#ece6d6", w: "#c4bba8", s: "#9e9582",
    R: "#c1272d", r: "#8a1a20", k: "#b3bac6", C: "#8b92a0", c: "#5d6370",
    m: "#d9d2c2", n: "#8f8676", B: "#5a3a22", b: "#3a2416", H: "#4a3a30",
    E: "#e9eef5", e: "#97a3b3"
  };
  const KNIGHT_BASE = [
    "................................",
    "...........OOOOOOOOO............",
    "..........OLLSSSSSSDO...........",
    "..........OLSSSSGSSDO..E........",
    "..........OLSSSSGSSDO..Ee.......",
    "..........OLSVVVGVVVO..Ee.......",
    "..........OLSGGGGGGGO..Ee.......",
    "..........OLSSSSGSDDO..Ee.......",
    "..........OLSSSSGSVDO..Ee.......",
    "..........OLSSSSGSDDO..Ee.......",
    "..........OSSSSSSSVDO..Ee.......",
    "...........OkCCCCCcO...Ee.......",
    ".....OmnnOkCCCCCCCCCCO.Ee.......",
    ".....OmnnOwWWWWWWWWkCO.Ee.......",
    ".....OmnnOwWWWRRWWWkCO.Ee.......",
    ".....OmnnOwWWWRRWWWCcO.Ee.......",
    "....OmmnnOwRRRRRRRWCcO.Ee.......",
    "....OmmnnOwrrRRRRrWCcO.Ee.......",
    "....OmmnnOwWWWRRWWWCcgGGGGg.....",
    "....OmmnnOBBBBGBBBBCcHHH........",
    "....OmmnnOwWWWRRWWWCcHHH........",
    "....OmmnnOwWWWRRWWWO...G........",
    "...OmmmnnOwWWWWWWWWO............",
    "...OmmmnnOswwWWWwwsO............",
    "...Ommnn..OCCcOCCcO.............",
    "....Omnn..OCCcOCCcO.............",
    ".....OOO..OCCcOCCcO.............",
    "..........OkCcOkCcO.............",
    "..........OCCcOCCcO.............",
    "..........ObBBObBBO.............",
    "..........ObBBBObBBBO...........",
    "..........OOOOOOOOOOO..........."
  ];

  const NO_SWORD = [];
  for (let y = 2; y <= 17; y += 1) {
    NO_SWORD.push([y, 22, ".........."]);
  }
  NO_SWORD.push([18, 21, "O.........."], [19, 21, "O.........."], [20, 21, "O.........."], [21, 22, ".........."]);

  // braço longe do corpo: a lateral vira túnica
  const ARM_AWAY = [];
  for (let y = 13; y <= 21; y += 1) {
    ARM_AWAY.push([y, 19, y === 19 ? "BO." : "WO."]);
  }

  // manto esvoaçando (correndo, pulando)
  const CAPE_FLY = [
    [12, 0, ".....OmnnO"], [13, 0, "....OmmnnO"], [14, 0, "...OmmmnnO"], [15, 0, "..OmmmmnnO"],
    [16, 0, ".OmmmmnnnO"], [17, 0, "OmmmmmnnnO"], [18, 0, "OmmmmnnnnO"], [19, 0, ".OOmmmnnnO"],
    [20, 0, "...OOmmnnO"], [21, 0, ".....OmnnO"], [22, 0, "......OnnO"], [23, 0, "......OOnO"],
    [24, 0, ".........."], [25, 0, ".........."], [26, 0, ".........."]
  ];
  const CAPE_SWAY = [[24, 0, "..Ommmnn.."], [25, 0, "...Ommn..."], [26, 0, "....OOO..."]];

  const LEGS = {
    spread: [
      [26, 9, "OCCcO.OCCcO"], [27, 8, ".OkCcO..OkCcO.."], [28, 8, "OCCcO....OCCcO."],
      [29, 8, "ObBBO....ObBBO."], [30, 8, "ObBBBO...ObBBBO"], [31, 8, "OOOOOO...OOOOOO"]
    ],
    passA: [
      [27, 8, "..OkCcO.OkCcO.."], [28, 8, "..OCCcO.ObBBBO."], [29, 8, "..ObBBO.OOOOOO."],
      [30, 8, "..ObBBBO......."], [31, 8, "..OOOOOO......."]
    ],
    passB: [
      [27, 8, "..OkCcO.OkCcO.."], [28, 8, ".ObBBBO.OCCcO.."], [29, 8, ".OOOOOO.ObBBO.."],
      [30, 8, "........ObBBBO."], [31, 8, "........OOOOOO."]
    ],
    tuck: [
      [26, 8, "..OkCcOkCcO...."], [27, 8, "..ObBBObBBO...."], [28, 8, "..ObBBBObBBBO.."],
      [29, 8, "..OOOOOOOOOOO.."], [30, 8, "..............."], [31, 8, "..............."]
    ]
  };

  const ARMS = {
    // golpe lateral: braço estendido, espada na horizontal
    forward: [
      [13, 19, "kCO"], [14, 19, "kCCCCHHH"], [15, 19, "CccccHHH"],
      [12, 26, "G"], [13, 26, "G"], [14, 26, "gEEEEE"], [15, 26, "geeeee"], [16, 26, "G"], [17, 26, "G"], [14, 31, "L"]
    ],
    up: [
      [12, 19, "kCCO"], [4, 21, "CcO"], [5, 21, "CcO"], [6, 21, "CcO"], [7, 21, "CcO"], [8, 21, "CcO"],
      [9, 21, "CcO"], [10, 21, "CcO"], [11, 21, "CcO"], [2, 21, "HHO"], [3, 21, "HHO"], [1, 21, "OO"]
    ],
    down: [[21, 19, "CcO"], [22, 19, "CcO"], [23, 19, "HHO"], [24, 19, "HHO"], [25, 19, "OO"]],
    hurt: [
      [12, 19, "kCCO"], [7, 21, "CcO"], [8, 21, "CcO"], [9, 21, "CcO"], [10, 21, "CcO"], [11, 21, "CcO"],
      [5, 21, "HHO"], [6, 21, "HHO"], [4, 21, "OO"]
    ]
  };

  const knight = (...changes) => fromRows(edit(KNIGHT_BASE, ...changes), KNIGHT);

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
    p(0, 0, 9, 9, KNIGHT.O); p(1, 1, 7, 7, KNIGHT.S); p(1, 1, 1, 6, KNIGHT.L);
    p(2, 3, 6, 1, KNIGHT.V); p(5, 1, 1, 7, KNIGHT.G); p(3, 4, 5, 1, KNIGHT.G);
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
  const cache = new Map();
  const register = (name, list) => { frames[name] = list; };

  register("knight.idle", [knight(), knight(CAPE_SWAY, [[6, 23, "L"]])]);
  register("knight.run", [LEGS.spread, LEGS.passA, LEGS.spread, LEGS.passB].map((legs) => knight(CAPE_FLY, legs)));
  register("knight.jump", [knight(CAPE_FLY, LEGS.tuck)]);
  register("knight.fall", [knight(LEGS.spread)]);
  register("knight.attack", [knight(NO_SWORD, ARM_AWAY, ARMS.forward, LEGS.spread)]);
  register("knight.attackUp", [knight(NO_SWORD, ARM_AWAY, ARMS.up)]);
  register("knight.attackDown", [knight(NO_SWORD, ARMS.down, CAPE_FLY, LEGS.tuck)]);
  register("knight.hurt", [knight(NO_SWORD, ARM_AWAY, ARMS.hurt, CAPE_FLY, LEGS.spread)]);

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
