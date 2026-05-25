const MAX_ATTEMPTS = 6;
const FLIP_DELAY_MS = 220;

const state = {
  length: 7,
  target: "",
  currentRow: 0,
  currentGuess: "",
  finished: false,
  rows: []
};

function $(sel) { return document.querySelector(sel); }

function normalize(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

function buildBoard() {
  const board = $("#board");
  board.innerHTML = "";
  board.style.setProperty("--cols", state.length);
  state.rows = [];
  for (let r = 0; r < MAX_ATTEMPTS; r++) {
    const row = document.createElement("div");
    row.className = "row";
    const tiles = [];
    for (let c = 0; c < state.length; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.style.animationDelay = (r * state.length + c) * 18 + "ms";
      tile.classList.add("appear");
      row.appendChild(tile);
      tiles.push(tile);
    }
    board.appendChild(row);
    state.rows.push({ el: row, tiles });
  }
}

function startGame(length) {
  state.length = length;
  state.currentRow = 0;
  state.currentGuess = "";
  state.finished = false;
  const pick = window.MotusWords.pickRandomWord(length);
  if (!pick) { toast("Aucun mot disponible."); return; }
  state.target = pick.word;
  if (pick.cycled) {
    toast("BRAVO ! Tous les mots de " + length + " lettres vaincus. Recyclage !");
  }
  buildBoard();
  window.MotusKeyboard.resetKeyColors();
}

function addLetter(ch) {
  if (state.finished) return;
  if (state.currentGuess.length >= state.length) return;
  state.currentGuess += ch;
  paintCurrent();
  const tile = state.rows[state.currentRow].tiles[state.currentGuess.length - 1];
  tile.classList.remove("pop");
  void tile.offsetWidth;
  tile.classList.add("pop");
}

function removeLetter() {
  if (state.finished) return;
  if (state.currentGuess.length === 0) return;
  state.currentGuess = state.currentGuess.slice(0, -1);
  paintCurrent();
}

function paintCurrent() {
  const tiles = state.rows[state.currentRow].tiles;
  for (let i = 0; i < tiles.length; i++) {
    const ch = state.currentGuess[i] || "";
    tiles[i].textContent = ch;
    tiles[i].classList.toggle("filled", !!ch);
  }
}

function shakeRow() {
  const row = state.rows[state.currentRow].el;
  row.classList.remove("shake");
  void row.offsetWidth;
  row.classList.add("shake");
}

function evaluateGuess(guess, target) {
  const n = guess.length;
  const result = new Array(n).fill("absent");
  const remaining = {};
  for (let i = 0; i < n; i++) {
    if (guess[i] === target[i]) {
      result[i] = "correct";
    } else {
      remaining[target[i]] = (remaining[target[i]] || 0) + 1;
    }
  }
  for (let i = 0; i < n; i++) {
    if (result[i] === "correct") continue;
    const ch = guess[i];
    if (remaining[ch] > 0) {
      result[i] = "present";
      remaining[ch] -= 1;
    }
  }
  return result;
}

function submitGuess() {
  if (state.finished) return;
  if (state.currentGuess.length !== state.length) {
    shakeRow();
    toast("Mot trop court !");
    return;
  }
  const guess = normalize(state.currentGuess);
  if (!/^[A-Z]+$/.test(guess)) {
    shakeRow();
    toast("Lettres invalides");
    return;
  }
  if (window.MotusDict && !window.MotusDict.isValidGuess(guess)) {
    shakeRow();
    toast("Mot inconnu");
    return;
  }
  const result = evaluateGuess(guess, state.target);
  const tiles = state.rows[state.currentRow].tiles;
  const letterStates = {};
  const RANK = { absent: 1, present: 2, correct: 3 };

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const st = result[i];
    setTimeout(() => {
      tile.classList.add("flip");
      setTimeout(() => {
        tile.classList.remove("filled");
        tile.classList.add(st);
        spawnParticlesAt(tile, stColor(st), st === "correct" ? 10 : st === "present" ? 6 : 2);
      }, 180);
    }, i * FLIP_DELAY_MS);
    const prev = letterStates[guess[i]];
    if (!prev || RANK[st] > RANK[prev]) letterStates[guess[i]] = st;
  }

  const totalDelay = tiles.length * FLIP_DELAY_MS + 350;
  setTimeout(() => {
    window.MotusKeyboard.updateKeyColors(letterStates);
    const won = result.every(r => r === "correct");
    if (won) onWin();
    else if (state.currentRow >= MAX_ATTEMPTS - 1) onLose();
    else {
      state.currentRow += 1;
      state.currentGuess = "";
    }
  }, totalDelay);
}

function stColor(st) {
  if (st === "correct") return "#39ff14";
  if (st === "present") return "#fff700";
  return "#6a6a78";
}

function onWin() {
  state.finished = true;
  const rowTiles = state.rows[state.currentRow].tiles;
  rowTiles.forEach((t, i) => {
    setTimeout(() => t.classList.add("glow"), i * 80);
  });
  document.body.classList.add("victory");
  burstParticles(60);
  const attempts = state.currentRow + 1;
  window.MotusStats.recordResult(true, attempts, state.target, state.length);
  setTimeout(() => {
    showEndModal(true, state.target, attempts);
  }, 1300);
}

function onLose() {
  state.finished = true;
  document.body.classList.add("defeat");
  document.querySelector(".app").classList.add("screen-shake");
  setTimeout(() => document.querySelector(".app").classList.remove("screen-shake"), 700);
  window.MotusStats.recordResult(false, 0, state.target, state.length);
  setTimeout(() => {
    showEndModal(false, state.target, MAX_ATTEMPTS);
  }, 800);
}

function showEndModal(won, word, attempts) {
  const modal = $("#endModal");
  $("#endTitle").textContent = won ? "VICTOIRE !" : "DEFAITE";
  $("#endWord").textContent = word;
  $("#endSub").textContent = won
    ? "Trouve en " + attempts + " essai" + (attempts > 1 ? "s" : "")
    : "Le mot etait :";
  modal.classList.toggle("won", won);
  modal.classList.add("open");
}

function closeEndModal() {
  $("#endModal").classList.remove("open");
  document.body.classList.remove("victory","defeat");
}

function newGame() {
  closeEndModal();
  const length = parseInt(document.querySelector("#lengthSelect").value, 10);
  startGame(length);
}

let toastTimer = null;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

function spawnParticlesAt(el, color, count) {
  const rect = el.getBoundingClientRect();
  const layer = $("#particles");
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    p.style.left = (rect.left + rect.width / 2) + "px";
    p.style.top = (rect.top + rect.height / 2) + "px";
    p.style.background = color;
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 60;
    p.style.setProperty("--dx", Math.cos(angle) * dist + "px");
    p.style.setProperty("--dy", Math.sin(angle) * dist + "px");
    p.style.setProperty("--dur", (500 + Math.random() * 500) + "ms");
    layer.appendChild(p);
    setTimeout(() => p.remove(), 1000);
  }
}

function burstParticles(count) {
  const layer = $("#particles");
  const colors = ["#39ff14","#fff700","#ff3df0","#39d2ff","#ff6a00"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle big";
    p.style.left = (window.innerWidth / 2) + "px";
    p.style.top = (window.innerHeight / 2) + "px";
    p.style.background = colors[i % colors.length];
    const angle = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 300;
    p.style.setProperty("--dx", Math.cos(angle) * dist + "px");
    p.style.setProperty("--dy", Math.sin(angle) * dist + "px");
    p.style.setProperty("--dur", (700 + Math.random() * 900) + "ms");
    layer.appendChild(p);
    setTimeout(() => p.remove(), 1700);
  }
}

function openStats() {
  const s = window.MotusStats.getStats();
  const counts = window.MotusStats.getWonCounts();
  $("#stPlayed").textContent = s.played;
  $("#stWon").textContent = s.won;
  $("#stRate").textContent = s.played ? Math.round(100 * s.won / s.played) + "%" : "0%";
  $("#stStreak").textContent = s.currentStreak;
  $("#stMax").textContent = s.maxStreak;
  const dist = $("#stDist");
  dist.innerHTML = "";
  const max = Math.max(1, ...Object.values(s.distribution));
  for (let i = 1; i <= 6; i++) {
    const v = s.distribution[i] || 0;
    const row = document.createElement("div");
    row.className = "dist-row";
    row.innerHTML = `<span class="dist-i">${i}</span><span class="dist-bar" style="width:${(v/max)*100}%">${v}</span>`;
    dist.appendChild(row);
  }
  const wd = $("#stWords");
  wd.innerHTML = "";
  for (const k of ["5","6","7","8","9"]) {
    const total = window.MotusWords.WORDS[k].length;
    const div = document.createElement("div");
    div.className = "won-line";
    div.textContent = k + " lettres : " + counts[k] + " / " + total + " mots vaincus";
    wd.appendChild(div);
  }
  $("#statsModal").classList.add("open");
}

function closeStats() {
  $("#statsModal").classList.remove("open");
}

function resetWonConfirm() {
  if (confirm("Reinitialiser TOUS les mots deja vaincus ? (les stats sont conservees)")) {
    window.MotusStats.resetWonWords();
    openStats();
    toast("Mots vaincus reinitialises");
  }
}

function init() {
  window.MotusKeyboard.buildKeyboard(document.querySelector("#keyboard"));
  window.MotusKeyboard.bindPhysicalKeyboard();
  $("#newGameBtn").addEventListener("click", newGame);
  $("#lengthSelect").addEventListener("change", newGame);
  $("#statsBtn").addEventListener("click", openStats);
  $("#statsClose").addEventListener("click", closeStats);
  $("#endClose").addEventListener("click", closeEndModal);
  $("#endAgain").addEventListener("click", newGame);
  $("#resetWonBtn").addEventListener("click", resetWonConfirm);
  document.addEventListener("click", (e) => {
    if (e.target.classList && e.target.classList.contains("modal-backdrop")) {
      e.target.parentElement.classList.remove("open");
    }
  });
  startGame(parseInt($("#lengthSelect").value, 10));
}

window.MotusGame = { addLetter, removeLetter, submitGuess, startGame, newGame };

document.addEventListener("DOMContentLoaded", init);
