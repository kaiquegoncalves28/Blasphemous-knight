// Teclado e mouse. As ações têm nomes (jump, attack...) para o resto do jogo
// não depender de teclas específicas.
(function (BK) {
  "use strict";

  const BINDINGS = {
    left: ["ArrowLeft", "KeyA"],
    right: ["ArrowRight", "KeyD"],
    up: ["ArrowUp", "KeyW"],
    down: ["ArrowDown", "KeyS"],
    jump: ["Space", "KeyK", "KeyZ"],
    attack: ["KeyJ", "KeyX", "Mouse0"],
    confirm: ["Enter", "NumpadEnter", "Space", "KeyJ", "KeyX", "KeyZ", "KeyK", "Mouse0"],
    pause: ["KeyP", "Escape"],
    back: ["Escape", "Backspace"],
    mute: ["KeyM"],
    // Atalho de apresentação: 1-4 na tela inicial começam direto na fase.
    level1: ["Digit1", "Numpad1"],
    level2: ["Digit2", "Numpad2"],
    level3: ["Digit3", "Numpad3"],
    level4: ["Digit4", "Numpad4"]
  };
  const BLOCK_DEFAULT = new Set(Object.values(BINDINGS).flat());

  const held = new Set();
  const pressed = new Set();
  const blurListeners = [];
  const anyListeners = [];

  function press(code) {
    held.add(code);
    pressed.add(code);
    anyListeners.forEach((listener) => listener());
  }

  window.addEventListener("keydown", (event) => {
    if (BLOCK_DEFAULT.has(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) {
      press(event.code);
    }
  });
  window.addEventListener("keyup", (event) => {
    held.delete(event.code);
  });

  function releaseAll() {
    held.clear();
    blurListeners.forEach((listener) => listener());
  }
  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      releaseAll();
    }
  });

  BK.input = {
    attach(canvas) {
      canvas.addEventListener("pointerdown", (event) => {
        canvas.focus();
        if (event.button === 0) {
          press("Mouse0");
        }
      });
      window.addEventListener("pointerup", () => held.delete("Mouse0"));
      canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    },
    down: (action) => BINDINGS[action].some((code) => held.has(code)),
    pressed: (action) => BINDINGS[action].some((code) => pressed.has(code)),
    // Chamado depois de cada passo de lógica: cada toque vale uma vez só.
    endStep: () => pressed.clear(),
    onBlur: (listener) => blurListeners.push(listener),
    onAnyKey: (listener) => anyListeners.push(listener)
  };
})(window.BK);
