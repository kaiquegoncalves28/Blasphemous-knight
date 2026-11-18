// Roteiro do jogo: personagens, cenas, falas de cada fase e finais.
// "scene" troca a ilustração das cutscenes; "who" escolhe o retrato e o nome.
(function (BK) {
  "use strict";

  BK.SPEAKERS = {
    narrador: { name: "", narration: true },
    // focus = ponto do desenho (em pixels) que fica no centro do retrato
    aldric: { name: "Sir Aldric de Valmont", color: "#ece6d6", portrait: "knight.idle", scale: 2, focus: [16, 11], pitch: 0.8 },
    anselmo: { name: "Frei Anselmo", color: "#9fd3ff", portrait: "anselmo", scale: 2, focus: [10, 10], pitch: 1.1, ghost: true },
    isolde: { name: "Isolde", color: "#f2c46d", portrait: "isolde", scale: 2, focus: [9, 10], pitch: 1.4 },
    belial: { name: "Belial", color: "#ff4d3a", portrait: "belial", scale: 1, focus: [25, 24], pitch: 0.55 },
    estranho: { name: "Estranho de olhos rubros", color: "#c24a4a", portrait: "stranger", scale: 1, focus: [25, 24], pitch: 0.6 },
    alma: { name: "Alma Penada", color: "#b9a4e6", portrait: "wraith", scale: 2, focus: [10, 9], pitch: 1.2, ghost: true },
    cultista: { name: "Templário Caído", color: "#ff7a5c", portrait: "cultist", scale: 2, focus: [11, 10], pitch: 0.7 }
  };

  BK.STORY = {
    intro: [
      { scene: "acre", who: "narrador", text: "Acre, 1291. A última fortaleza cristã na Terra Santa arde em chamas." },
      { who: "narrador", text: "Sir Aldric de Valmont, cavaleiro do Templo, vê seus irmãos caírem um a um sobre as muralhas." },
      { scene: "pacto", who: "narrador", text: "Ferido e cercado, ele ouve uma voz que não vem de nenhum homem." },
      { who: "estranho", text: "Eu te tiro daqui com vida, templário. Em troca, prometa-me apenas... aquilo que você mais ama." },
      { who: "aldric", text: "Que seja. Juro por esta espada. Só me deixe voltar para casa." },
      { scene: "aldeia", who: "narrador", text: "Meses depois, Aldric enfim retorna à Provença. A aldeia de Valmont queima sob um céu vermelho." },
      { scene: "portal", who: "isolde", text: "Aldric! Aldric, não deixe que me levem!" },
      { who: "belial", text: "Uma dívida é uma dívida, cavaleiro. Você me prometeu o que mais ama. Ela agora pertence ao Inferno." },
      { who: "aldric", text: "ISOLDE!" },
      { scene: "cavaleiro", who: "narrador", text: "A Ordem do Templo declara Aldric blasfemo por ter pactuado com um demônio. Sem bênção e sem irmãos, só lhe resta a espada Misericórdia." },
      { who: "aldric", text: "Que me chamem de blasfemo. Nem o Céu nem o Inferno vão me separar dela." },
      { who: "narrador", text: "E assim o cavaleiro desce pela Fenda de Cinzas." }
    ],

    levels: [
      {
        numeral: "I",
        name: "Portões de Cinza",
        subtitle: "Onde chegam as almas que ainda não aceitaram a própria morte.",
        start: [
          { who: "anselmo", text: "Aldric... sou eu, Frei Anselmo. Morri naquela muralha em Acre, ao seu lado." },
          { who: "aldric", text: "Anselmo? Então é verdade. Eu estou no Inferno." },
          { who: "anselmo", text: "Ainda não, meu filho. Estes são só os portões. Mova-se com as SETAS ou A/D e pule com ESPAÇO. No ar, aperte ESPAÇO de novo para um segundo pulo." },
          { who: "anselmo", text: "Golpeie com J (ou X, ou clique). Segure ↑ ao atacar para golpear para cima." },
          { who: "anselmo", text: "Isolde deixou cair as contas do rosário pelo caminho. Recolha-as: elas guardam o que resta da alma dela." }
        ],
        end: [
          { who: "belial", text: "Está ouvindo, templário? Ela chama o seu nome... e eu adoro esse som." },
          { who: "aldric", text: "Guarde a voz, demônio. Vai precisar dela para implorar." }
        ]
      },
      {
        numeral: "II",
        name: "Fosso dos Lamentos",
        subtitle: "Aqui choram os que foram traídos por quem mais amavam.",
        start: [
          { who: "isolde", text: "(um eco distante) Aldric... você prometeu voltar antes da colheita." },
          { who: "aldric", text: "E voltei, Isolde. Tarde demais." },
          { who: "anselmo", text: "Os lamentos deste lugar são verdadeiros. Muitos aqui foram vendidos por juramentos como o seu." },
          { who: "anselmo", text: "Cuidado com a lava. No ar, segure ↓ e ataque: a espada quica sobre os demônios e as bolas de fogo." }
        ],
        end: [
          { who: "aldric", text: "Anselmo, por que me ajuda? Eu te deixei para trás naquela muralha." },
          { who: "anselmo", text: "Porque você ainda pode escolher, Aldric. Eu não posso mais." }
        ]
      },
      {
        numeral: "III",
        name: "Catedral Invertida",
        subtitle: "Uma igreja de ponta-cabeça, onde cada oração vira maldição.",
        start: [
          { who: "anselmo", text: "Esta é a catedral de Belial. Os que rezam aqui já foram irmãos do Templo." },
          { who: "aldric", text: "Templários... servindo a um demônio?" },
          { who: "anselmo", text: "Assim como você, eles pagaram um preço. A diferença é que pararam de lutar." }
        ],
        end: [
          { who: "belial", text: "Você chegou longe, cavaleiro. Venha. Ela está esperando... aos pés do meu trono." }
        ]
      },
      {
        numeral: "IV",
        name: "Trono de Belial",
        subtitle: "O fim da descida.",
        boss: true,
        start: [
          { who: "isolde", text: "Aldric! Você veio..." },
          { who: "belial", text: "Que comovente. O homem que vendeu a esposa vem comprá-la de volta." },
          { who: "aldric", text: "Eu não te vendi nada, Belial. Você mentiu." },
          { who: "belial", text: "Eu sou o Príncipe da Mentira. Você é que quis acreditar." },
          { who: "aldric", text: "Então acredite nisto: hoje quem cobra a dívida sou eu." }
        ]
      }
    ],

    // Falas disparadas ao passar por pontos marcados no mapa (dígitos).
    triggers: {
      altar: [
        { who: "anselmo", text: "Aqueles altares profanados ainda prendem almas. Acerte-os por baixo, com a cabeça, ou com a espada." }
      ],
      crack: [
        { who: "anselmo", text: "Pedras rachadas cedem ao aço. Golpeie-as. E toque nas cruzes de pedra: elas consagram o caminho e curam suas feridas." }
      ],
      alma: [
        { who: "alma", text: "Você também fez uma promessa que não cumpriu... fique conosco, cavaleiro. Fique..." },
        { who: "aldric", text: "Ainda tenho uma promessa a cumprir. Saia do meu caminho." }
      ],
      cultista: [
        { who: "cultista", text: "Irmão Aldric! Ajoelhe-se. Belial perdoa os que se rendem." },
        { who: "aldric", text: "Já me ajoelhei uma vez diante de um demônio. Nunca mais." }
      ]
    },

    boss: {
      phase2: [
        { who: "belial", text: "BASTA! Sinta o fogo que forjou este trono!" }
      ],
      defeat: [
        { who: "belial", text: "Impossível... um pecador... vencendo o próprio pecado..." },
        { who: "narrador", text: "O Príncipe da Mentira se desfaz em cinzas. As correntes da jaula de Isolde caem." }
      ]
    },

    endings: {
      good: {
        title: "FINAL: REDENÇÃO",
        lines: [
          { scene: "trono", who: "isolde", text: "Eu senti cada conta do rosário voltar às suas mãos. Eu sabia que você viria." },
          { who: "anselmo", text: "As contas guardaram a alma dela inteira. A dívida está paga, Aldric. Vocês dois estão livres." },
          { who: "aldric", text: "E você, Anselmo?" },
          { who: "anselmo", text: "Eu recebi a absolvição que esperava: ver você escolher o amor em vez do medo. Vão." },
          { scene: "luz", who: "narrador", text: "Aldric e Isolde subiram pela Fenda de Cinzas ao amanhecer." },
          { who: "narrador", text: "A Ordem nunca o perdoou. Ele nunca precisou." }
        ]
      },
      sacrifice: {
        title: "FINAL: SACRIFÍCIO",
        lines: [
          { scene: "trono", who: "anselmo", text: "Faltam contas do rosário, Aldric. Sem elas, a alma de Isolde não consegue atravessar sozinha." },
          { who: "aldric", text: "Então leve a minha no lugar dela." },
          { who: "isolde", text: "Não! Eu não aceito mais nenhuma promessa sua!" },
          { who: "aldric", text: "Esta eu vou cumprir. Volte para casa, Isolde. Lembre-se de mim quando a colheita chegar." },
          { scene: "sombra", who: "narrador", text: "Isolde despertou nos campos de Valmont, com o rosário incompleto entre os dedos." },
          { who: "narrador", text: "Nas profundezas, um novo guardião vigia os Portões de Cinza: o Cavaleiro Blasfemo." }
        ],
        hint: "Recolha pelo menos 7 das 9 contas do rosário para ver o final verdadeiro."
      }
    },

    gameOver: {
      who: "belial",
      text: "Mais uma alma para o meu trono. Ela vai esperar por você... para sempre."
    },

    credits: [
      ["BLASPHEMOUS KNIGHT", "title"],
      ["Uma descida ao Inferno por amor", "sub"],
      ["", ""],
      ["Disciplina", "head"],
      ["Usabilidade, desenvolvimento web, mobile e jogos", ""],
      ["Professor: Elzo Brito dos Santos Filho", ""],
      ["", ""],
      ["Integrantes", "head"],
      ["Pedro Henrique Espinosa Mantana — RA 825133461", ""],
      ["Kaique Gonçalves da Silva — RA 825152843", ""],
      ["Gustavo Trajano Dos Reis Padilha — RA 825157289", ""],
      ["João Paulo de Mattos Queiroz — RA 825148044", ""],
      ["Hyohan Mertz Santamaria — RA 825151448", ""],
      ["", ""],
      ["Arte, música e efeitos sonoros", "head"],
      ["Criados em código pelo grupo (pixel art e Web Audio)", ""],
      ["", ""],
      ["Inspiração", "head"],
      ["Dante's Inferno (Visceral Games, 2010)", ""],
      ["Super Mario Bros. (Nintendo, 1985)", ""]
    ]
  };
})(window.BK);
