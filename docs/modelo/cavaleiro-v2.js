// Modelo 2 do cavaleiro templário (32x32 pixels, olhando para a direita).
// Cada letra é um pixel com a cor da paleta; "." é transparente.
// Ainda não está no jogo: é a proposta para aprovação.
window.KNIGHT_V2 = (function () {
  "use strict";

  const palette = {
    O: ["#1a1218", "contorno"],
    L: ["#eef2f7", "aço (brilho)"],
    S: ["#b9c1cd", "aço"],
    D: ["#6f7787", "aço (sombra)"],
    V: ["#0b080d", "fresta do elmo"],
    G: ["#e0b54a", "ouro"],
    g: ["#9a7428", "ouro (sombra)"],
    W: ["#ece6d6", "túnica branca"],
    w: ["#c4bba8", "túnica (sombra)"],
    s: ["#9e9582", "túnica (sombra funda)"],
    R: ["#c1272d", "cruz vermelha"],
    r: ["#8a1a20", "cruz (sombra)"],
    k: ["#b3bac6", "cota de malha (brilho)"],
    C: ["#8b92a0", "cota de malha"],
    c: ["#5d6370", "cota de malha (sombra)"],
    m: ["#d9d2c2", "manto"],
    n: ["#8f8676", "manto (sombra)"],
    B: ["#5a3a22", "couro"],
    b: ["#3a2416", "couro (sombra)"],
    H: ["#4a3a30", "luva"],
    E: ["#e9eef5", "lâmina"],
    e: ["#97a3b3", "lâmina (sombra)"]
  };

  const idle = [
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

  // Troca um trecho de uma linha (para montar as outras poses a partir da parada).
  function edit(rows, changes) {
    const out = rows.map((row) => row.split(""));
    for (const [y, x, text] of changes) {
      [...text].forEach((ch, i) => { out[y][x + i] = ch; });
    }
    return out.map((row) => row.join(""));
  }

  // Andando: pernas abertas e manto mais solto.
  const walk = edit(idle, [
    [24, 0, "..Ommmnn..OCCcOCCcO............."],
    [25, 0, "...Ommnn..OCCcOCCcO............."],
    [26, 0, "....OOO..OCCcO.OCCcO............"],
    [27, 0, ".........OkCcO..OkCcO..........."],
    [28, 0, "........OCCcO....OCCcO.........."],
    [29, 0, "........ObBBO....ObBBO.........."],
    [30, 0, "........ObBBBO...ObBBBO........."],
    [31, 0, "........OOOOOO...OOOOOO........."]
  ]);

  // Ataque: braço estendido e a espada na horizontal (o rastro do golpe é desenhado à parte).
  const attackClear = [];
  for (let y = 3; y <= 21; y += 1) {
    attackClear.push([y, 22, ".........."]);
  }
  const attack = edit(idle, [
    ...attackClear,
    [13, 19, "kCO"],
    [14, 19, "kCCCCHHH"],
    [15, 19, "CccccHHH"],
    [16, 19, "WO."],
    [17, 19, "WO."],
    [18, 19, "WO."],
    [19, 19, "BO."],
    [20, 19, "WO."],
    [12, 26, "G"],
    [13, 26, "G"],
    [14, 26, "gEEEEE"],
    [15, 26, "geeeee"],
    [16, 26, "G"],
    [17, 26, "G"],
    [14, 31, "L"]
  ]);

  const frames = { idle, walk, attack };
  for (const [name, rows] of Object.entries(frames)) {
    if (rows.length !== 32 || rows.some((row) => row.length !== 32)) {
      throw new Error(`Quadro "${name}" fora de 32x32`);
    }
  }

  // Desenha um quadro num canvas novo (scale = tamanho de cada pixel).
  function render(name, scale = 1) {
    const canvas = document.createElement("canvas");
    canvas.width = 32 * scale;
    canvas.height = 32 * scale;
    const g = canvas.getContext("2d");
    frames[name].forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (palette[ch]) {
          g.fillStyle = palette[ch][0];
          g.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });
    return canvas;
  }

  return { palette, frames, render };
})();
