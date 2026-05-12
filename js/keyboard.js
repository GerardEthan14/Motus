const KB_ROWS = [
  ["A","Z","E","R","T","Y","U","I","O","P"],
  ["Q","S","D","F","G","H","J","K","L","M"],
  ["ENTER","W","X","C","V","B","N","BACK"]
];

const STATE_RANK = { absent: 1, present: 2, correct: 3 };
const keyState = {};

function buildKeyboard(container) {
  container.innerHTML = "";
  for (const row of KB_ROWS) {
    const rowEl = document.createElement("div");
    rowEl.className = "kb-row";
    for (const k of row) {
      const btn = document.createElement("button");
      btn.className = "kb-key";
      btn.type = "button";
      if (k === "ENTER") {
        btn.classList.add("kb-wide");
        btn.textContent = "ENTREE";
        btn.dataset.key = "ENTER";
      } else if (k === "BACK") {
        btn.classList.add("kb-wide");
        btn.textContent = "<--";
        btn.dataset.key = "BACK";
      } else {
        btn.textContent = k;
        btn.dataset.key = k;
      }
      btn.addEventListener("click", () => handleKey(btn.dataset.key));
      rowEl.appendChild(btn);
    }
    container.appendChild(rowEl);
  }
}

function handleKey(k) {
  if (!window.MotusGame) return;
  if (k === "ENTER") window.MotusGame.submitGuess();
  else if (k === "BACK") window.MotusGame.removeLetter();
  else if (/^[A-Z]$/.test(k)) window.MotusGame.addLetter(k);
}

function updateKeyColors(letterStates) {
  for (const [letter, state] of Object.entries(letterStates)) {
    const cur = keyState[letter];
    if (!cur || STATE_RANK[state] > STATE_RANK[cur]) {
      keyState[letter] = state;
      const btn = document.querySelector(`.kb-key[data-key="${letter}"]`);
      if (btn) {
        btn.classList.remove("correct","present","absent");
        btn.classList.add(state);
      }
    }
  }
}

function resetKeyColors() {
  for (const k of Object.keys(keyState)) delete keyState[k];
  document.querySelectorAll(".kb-key").forEach(btn => {
    btn.classList.remove("correct","present","absent");
  });
}

function bindPhysicalKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === "Enter") { e.preventDefault(); handleKey("ENTER"); }
    else if (e.key === "Backspace") { e.preventDefault(); handleKey("BACK"); }
    else if (/^[a-zA-Z]$/.test(e.key)) { handleKey(e.key.toUpperCase()); }
  });
}

window.MotusKeyboard = { buildKeyboard, updateKeyColors, resetKeyColors, bindPhysicalKeyboard };
