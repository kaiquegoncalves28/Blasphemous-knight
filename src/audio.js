// Som 100% sintetizado com a Web Audio API: efeitos e trilhas são gerados em
// código, então não há arquivos de áudio de terceiros (nem licenças a citar).
(function (BK) {
  "use strict";

  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let noiseBuffer = null;
  let muted = BK.storage.get("bk.muted", "0") === "1";

  // ---------- utilidades ----------
  const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(name) {
    const match = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!match) {
      throw new Error("Nota inválida: " + name);
    }
    const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
    return 12 * (Number(match[3]) + 1) + NOTE_INDEX[match[1]] + accidental;
  }
  const freq = (note) => 440 * Math.pow(2, (note - 69) / 12);

  function unlock() {
    if (!ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return;
      }
      ctx = new AudioContextClass();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.55;
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.32;
      musicBus.connect(master);

      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    if (wantedSong && !currentSong) {
      startSong(wantedSong);
    }
  }

  function tone(o, bus = sfxBus, when = 0) {
    if (!ctx) {
      return;
    }
    const start = (when || ctx.currentTime) + (o.delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = o.type || "square";
    osc.frequency.setValueAtTime(o.freq, start);
    if (o.endFreq) {
      osc.frequency.exponentialRampToValueAtTime(o.endFreq, start + o.dur);
    }
    const attack = o.attack || 0.005;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(o.vol, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + o.dur);
    let node = osc;
    if (o.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = o.filter;
      osc.connect(filter);
      node = filter;
    }
    node.connect(gain);
    gain.connect(bus);
    osc.start(start);
    osc.stop(start + o.dur + 0.02);
  }

  function noise(o, bus = sfxBus, when = 0) {
    if (!ctx) {
      return;
    }
    const start = (when || ctx.currentTime) + (o.delay || 0);
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = o.filterType || "bandpass";
    filter.frequency.setValueAtTime(o.freq || 1000, start);
    if (o.endFreq) {
      filter.frequency.exponentialRampToValueAtTime(o.endFreq, start + o.dur);
    }
    filter.Q.value = o.q || 1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(o.vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + o.dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    source.start(start);
    source.stop(start + o.dur + 0.02);
  }

  // ---------- efeitos sonoros ----------
  const SFX = {
    jump: () => tone({ type: "square", freq: 280, endFreq: 560, dur: 0.12, vol: 0.12, filter: 2400 }),
    land: () => noise({ freq: 400, filterType: "lowpass", dur: 0.06, vol: 0.12 }),
    doubleJump() {
      tone({ type: "triangle", freq: 520, endFreq: 1040, dur: 0.16, vol: 0.12 });
      tone({ type: "sine", freq: 1568, dur: 0.22, vol: 0.06, delay: 0.05 });
      noise({ freq: 6000, filterType: "highpass", dur: 0.12, vol: 0.05 });
    },
    slash() {
      noise({ freq: 3200, endFreq: 700, dur: 0.14, vol: 0.32, q: 0.8 });
      tone({ type: "sawtooth", freq: 900, endFreq: 260, dur: 0.08, vol: 0.04, filter: 3000 });
    },
    hit() {
      noise({ freq: 900, filterType: "lowpass", dur: 0.09, vol: 0.45 });
      tone({ type: "square", freq: 180, endFreq: 70, dur: 0.1, vol: 0.18 });
    },
    enemyDie() {
      noise({ freq: 1400, endFreq: 200, dur: 0.3, vol: 0.3 });
      tone({ type: "sawtooth", freq: 420, endFreq: 60, dur: 0.32, vol: 0.1, filter: 1800 });
    },
    hurt() {
      tone({ type: "sawtooth", freq: 360, endFreq: 110, dur: 0.3, vol: 0.18, filter: 1600 });
      noise({ freq: 600, filterType: "lowpass", dur: 0.15, vol: 0.25 });
    },
    death() {
      tone({ type: "sawtooth", freq: 300, endFreq: 40, dur: 1.1, vol: 0.2, filter: 1200 });
      tone({ type: "square", freq: 150, endFreq: 30, dur: 1.2, vol: 0.08, delay: 0.1 });
    },
    soul() {
      tone({ type: "square", freq: 988, dur: 0.07, vol: 0.07, filter: 4000 });
      tone({ type: "square", freq: 1319, dur: 0.12, vol: 0.07, delay: 0.06, filter: 4000 });
    },
    relic() {
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        tone({ type: "triangle", freq: f, dur: 0.35, vol: 0.14, delay: i * 0.07 })
      );
    },
    heal() {
      [440, 554, 659].forEach((f, i) => tone({ type: "triangle", freq: f, dur: 0.25, vol: 0.12, delay: i * 0.06 }));
    },
    oneUp() {
      [523, 659, 784, 659, 784, 1047].forEach((f, i) =>
        tone({ type: "square", freq: f, dur: 0.12, vol: 0.07, delay: i * 0.08, filter: 3000 })
      );
    },
    checkpoint() {
      [330, 494, 659, 988].forEach((f, i) =>
        tone({ type: "sine", freq: f, dur: 1.2, vol: 0.12, delay: i * 0.05, attack: 0.01 })
      );
    },
    bump: () => tone({ type: "square", freq: 190, endFreq: 120, dur: 0.09, vol: 0.14, filter: 1500 }),
    breakBlock() {
      noise({ freq: 1200, filterType: "lowpass", dur: 0.25, vol: 0.45 });
      tone({ type: "square", freq: 120, endFreq: 50, dur: 0.15, vol: 0.12 });
    },
    parry() {
      tone({ type: "triangle", freq: 1568, dur: 0.18, vol: 0.12 });
      noise({ freq: 5000, dur: 0.08, vol: 0.15 });
    },
    fireball() {
      noise({ freq: 500, filterType: "lowpass", dur: 0.3, vol: 0.22 });
      tone({ type: "sawtooth", freq: 140, endFreq: 60, dur: 0.25, vol: 0.06, filter: 800 });
    },
    charge: () => tone({ type: "sawtooth", freq: 110, endFreq: 330, dur: 0.45, vol: 0.05, filter: 1200 }),
    roar() {
      tone({ type: "sawtooth", freq: 110, endFreq: 45, dur: 1.1, vol: 0.25, filter: 900 });
      tone({ type: "square", freq: 82, endFreq: 41, dur: 1.2, vol: 0.12, filter: 600 });
      noise({ freq: 300, filterType: "lowpass", dur: 1.0, vol: 0.3 });
    },
    slam() {
      noise({ freq: 250, filterType: "lowpass", dur: 0.45, vol: 0.6 });
      tone({ type: "sine", freq: 90, endFreq: 30, dur: 0.4, vol: 0.4 });
    },
    door() {
      tone({ type: "sine", freq: 196, dur: 1.4, vol: 0.18, attack: 0.05 });
      tone({ type: "sine", freq: 294, dur: 1.4, vol: 0.12, attack: 0.05, delay: 0.15 });
      tone({ type: "sine", freq: 392, dur: 1.4, vol: 0.1, attack: 0.05, delay: 0.3 });
    },
    text: (pitch = 1) => tone({ type: "square", freq: 520 * pitch, dur: 0.025, vol: 0.025, filter: 2000 }),
    select: () => tone({ type: "square", freq: 660, dur: 0.05, vol: 0.06, filter: 3000 }),
    confirm() {
      tone({ type: "square", freq: 660, dur: 0.07, vol: 0.06, filter: 3000 });
      tone({ type: "square", freq: 990, dur: 0.1, vol: 0.06, delay: 0.06, filter: 3000 });
    },
    victory() {
      [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) =>
        tone({ type: "triangle", freq: f, dur: 0.4, vol: 0.14, delay: i * 0.13 })
      );
    },
    defeat() {
      [392, 370, 349, 330, 220].forEach((f, i) =>
        tone({ type: "triangle", freq: f, dur: i === 4 ? 1.2 : 0.35, vol: 0.14, delay: i * 0.3 })
      );
    }
  };

  // ---------- trilhas ----------
  // Cada trilha: "NOTA:duração" em passos (colcheias). "-" é pausa.
  // Bateria: k = bumbo, s = caixa, h = chimbal.
  function seq(source) {
    const events = [];
    let step = 0;
    for (const token of source.trim().split(/\s+/)) {
      const [name, length = "1"] = token.split(":");
      const len = Number(length);
      if (name !== "-") {
        events.push({ step, note: /^[ksh]$/.test(name) ? name : midi(name), len });
      }
      step += len;
    }
    return { events, length: step };
  }

  const SONGS = {
    // Órgão gótico, lento, em ré menor.
    title: {
      bpm: 70,
      tracks: [
        ["organ", "D3:8 Bb2:8 G2:8 A2:8"],
        ["organ", "F3:8 D3:8 Bb2:8 C#3:8"],
        ["organ", "A3:8 F3:8 D3:8 E3:8"],
        ["lead", "D5:2 F5:2 E5:2 D5:2 D5:2 C5:2 Bb4:4 G4:2 Bb4:2 D5:2 C5:2 A4:4 C#5:4"]
      ]
    },
    // Fases: baixo pulsante e melodia heroica, ainda sombria.
    level: {
      bpm: 138,
      tracks: [
        ["bass", ("D2 D3 ".repeat(4) + "Bb1 Bb2 ".repeat(4) + "C2 C3 ".repeat(4) + "A1 A2 ".repeat(4)).repeat(2)],
        ["lead",
          "D5:2 A4:2 F4:2 A4:2 Bb4:2 F4:2 D4:2 F4:2 C5:2 G4:2 E4:2 G4:2 A4:2 E4:2 C#5:2 E5:2 " +
          "F5:3 E5:1 D5:2 A4:2 D5:3 C5:1 Bb4:2 F4:2 E5:3 D5:1 C5:2 G4:2 A4:4 C#5:2 E5:2"],
        ["drums", "k h s h k k s h ".repeat(8)]
      ]
    },
    // Chefe: rápido, cromático e ameaçador.
    boss: {
      bpm: 160,
      tracks: [
        ["bass", ("D2 D2 D3 D2 Eb2 D2 Ab2 G2 ".repeat(2)) + "Bb1 Bb1 Bb2 Bb1 B1 Bb1 E2 Eb2 " + "A1 A1 A2 A1 Bb1 A1 C#2 E2"],
        ["lead", "D5 - D5 - Eb5:2 D5:2 Ab5:2 G5:2 F5:2 Eb5:2 D5 - D5 - F5:2 Eb5:2 D5:4 C#5:4"],
        ["drums", "k h s k k h s h ".repeat(4)]
      ]
    },
    // Final: mais claro, em ré maior.
    ending: {
      bpm: 84,
      tracks: [
        ["organ", "D3:8 A2:8 B2:8 G2:8"],
        ["organ", "F#3:8 E3:8 D3:8 B2:8"],
        ["organ", "A3:8 C#4:8 F#3:8 D4:8"],
        ["lead", "F#5:2 E5:2 D5:4 E5:2 C#5:2 A4:4 D5:2 F#5:2 B5:4 A5:2 G5:2 F#5:4"]
      ]
    }
  };

  const INSTRUMENTS = {
    organ(note, time, dur) {
      tone({ type: "sine", freq: freq(note), dur, vol: 0.07, attack: 0.08 }, songBus, time);
      tone({ type: "triangle", freq: freq(note + 12), dur, vol: 0.03, attack: 0.08 }, songBus, time);
    },
    lead(note, time, dur) {
      tone({ type: "square", freq: freq(note), dur: dur * 0.95, vol: 0.045, attack: 0.01, filter: 2200 }, songBus, time);
    },
    bass(note, time, dur) {
      tone({ type: "triangle", freq: freq(note), dur: dur * 0.9, vol: 0.16, attack: 0.005 }, songBus, time);
      tone({ type: "square", freq: freq(note), dur: dur * 0.5, vol: 0.03, filter: 500 }, songBus, time);
    },
    drums(kind, time) {
      if (kind === "k") {
        tone({ type: "sine", freq: 150, endFreq: 45, dur: 0.16, vol: 0.4 }, songBus, time);
      } else if (kind === "s") {
        noise({ freq: 1800, filterType: "highpass", dur: 0.12, vol: 0.16 }, songBus, time);
      } else {
        noise({ freq: 7000, filterType: "highpass", dur: 0.04, vol: 0.05 }, songBus, time);
      }
    }
  };

  let wantedSong = null;
  let currentSong = null;
  let songBus = null;
  let schedulerId = 0;
  let nextTime = 0;
  let step = 0;

  function prepare(name) {
    const song = SONGS[name];
    if (!song.parsed) {
      song.parsed = song.tracks.map(([instrument, source]) => ({ instrument, ...seq(source) }));
      song.length = Math.max(...song.parsed.map((track) => track.length));
      song.byStep = Array.from({ length: song.length }, () => []);
      for (const track of song.parsed) {
        for (const event of track.events) {
          song.byStep[event.step % song.length].push({ instrument: track.instrument, ...event });
        }
      }
    }
    return song;
  }

  function stopSong() {
    window.clearInterval(schedulerId);
    schedulerId = 0;
    if (songBus && ctx) {
      const bus = songBus;
      bus.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      window.setTimeout(() => bus.disconnect(), 600);
    }
    songBus = null;
    currentSong = null;
  }

  function startSong(name) {
    stopSong();
    if (!ctx || !name) {
      return;
    }
    const song = prepare(name);
    currentSong = name;
    songBus = ctx.createGain();
    songBus.gain.value = 1;
    songBus.connect(musicBus);
    step = 0;
    nextTime = ctx.currentTime + 0.08;
    const stepDuration = 60 / song.bpm / 2;
    schedulerId = window.setInterval(() => {
      while (nextTime < ctx.currentTime + 0.2) {
        for (const event of song.byStep[step]) {
          INSTRUMENTS[event.instrument](event.note, nextTime, event.len * stepDuration);
        }
        nextTime += stepDuration;
        step = (step + 1) % song.length;
      }
    }, 30);
  }

  BK.audio = {
    unlock,
    sfx(name, ...args) {
      if (ctx && ctx.state === "running" && SFX[name]) {
        SFX[name](...args);
      }
    },
    music(name) {
      if (name === wantedSong && (currentSong === name || !ctx)) {
        return;
      }
      wantedSong = name;
      if (ctx) {
        startSong(name);
      }
    },
    isMuted: () => muted,
    toggleMute() {
      muted = !muted;
      BK.storage.set("bk.muted", muted ? "1" : "0");
      if (master) {
        master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
      }
      return muted;
    }
  };
})(window.BK);
