const MAX_ATTEMPTS = 6;
const FLIP_DELAY_MS = 220;

const ENDLESS_LENGTHS = [5, 6, 7, 8, 9];
const ENDLESS_TIMER_SECS = 60;

const state = {
  length: 7,
  target: "",
  currentRow: 0,
  currentGuess: "",
  finished: false,
  revealing: false,
  rows: [],
  // endless
  endless: false,
  endLoop: 1,
  endIdx: 0,
  endStreak: 0,
  timerEnd: 0,
  timerId: 0
};

function endlessFlags(loop) {
  return {
    hideAttempts: loop >= 2,
    timer: loop >= 3,
    partial: loop >= 4,
    attempts: loop >= 5 ? 5 : 6
  };
}

function maxAttempts() {
  return state.endless ? endlessFlags(state.endLoop).attempts : MAX_ATTEMPTS;
}

function $(sel) { return document.querySelector(sel); }

function normalize(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

function buildBoard() {
  const board = $("#board");
  board.innerHTML = "";
  board.style.setProperty("--cols", state.length);
  state.rows = [];
  const rowsCount = maxAttempts();
  for (let r = 0; r < rowsCount; r++) {
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
  state.revealing = false;
  const pick = window.MotusWords.pickRandomWord(length);
  if (!pick) { toast("Aucun mot disponible."); return; }
  state.target = pick.word;
  if (pick.cycled) {
    toast("BRAVO ! Tous les mots de " + length + " lettres vaincus. Recyclage !");
  }
  buildBoard();
  window.MotusKeyboard.resetKeyColors();
  updateEnterState();
}

function addLetter(ch) {
  if (state.finished || state.revealing) return;
  if (state.currentGuess.length >= state.length) return;
  state.currentGuess += ch;
  paintCurrent();
  const tile = state.rows[state.currentRow].tiles[state.currentGuess.length - 1];
  tile.classList.remove("pop");
  void tile.offsetWidth;
  tile.classList.add("pop");
}

function removeLetter() {
  if (state.finished || state.revealing) return;
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
  updateEnterState();
}

function updateEnterState() {
  let ready = false;
  if (!state.finished && !state.revealing && state.currentGuess.length === state.length) {
    const guess = normalize(state.currentGuess);
    ready = /^[A-Z]+$/.test(guess) && (!window.MotusDict || window.MotusDict.isValidGuess(guess));
  }
  if (window.MotusKeyboard && window.MotusKeyboard.setEnterReady) {
    window.MotusKeyboard.setEnterReady(ready);
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
  if (state.finished || state.revealing) return;
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
  state.revealing = true;
  updateEnterState();
  const rawResult = evaluateGuess(guess, state.target);
  const won = rawResult.every(r => r === "correct");
  const partial = state.endless && endlessFlags(state.endLoop).partial && !won;
  const result = partial ? rawResult.map(r => r === "present" ? "absent" : r) : rawResult;
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
    state.revealing = false;
    if (won) onWin();
    else if (state.currentRow >= maxAttempts() - 1) onLose();
    else {
      if (state.endless && endlessFlags(state.endLoop).hideAttempts) {
        state.rows[state.currentRow].el.classList.add("past-attempt");
      }
      state.currentRow += 1;
      state.currentGuess = "";
    }
    updateEnterState();
  }, totalDelay);
}

function stColor(st) {
  if (st === "correct") return "#39ff14";
  if (st === "present") return "#fff700";
  return "#6a6a78";
}

function onWin() {
  state.finished = true;
  stopTimer();
  const rowTiles = state.rows[state.currentRow].tiles;
  rowTiles.forEach((t, i) => {
    setTimeout(() => t.classList.add("glow"), i * 80);
  });
  document.body.classList.add("victory");
  const attempts = state.currentRow + 1;
  if (state.endless) return onWinEndless(attempts);
  const s = window.MotusStats.recordResult(true, attempts, state.target, state.length);
  const streak = s.currentStreak;
  updateStreakHud(streak, { pop: true });

  const milestone = streak > 0 && streak % 10 === 0;
  if (milestone) {
    flashScreen("rgba(255,106,0,0.85)");
    shockwave();
    burstParticles(150);
    const app = document.querySelector(".app");
    app.classList.add("screen-shake");
    setTimeout(() => app.classList.remove("screen-shake"), 700);
    showCombo("EN FEU !  x" + streak, "milestone");
  } else {
    burstParticles(50 + Math.min(streak, 12) * 9);
    if (streak >= 2) showCombo("SERIE  x" + streak, "");
  }
  setTimeout(() => {
    showEndModal(true, state.target, attempts);
  }, milestone ? 1900 : 1300);
}

function onLose() {
  state.finished = true;
  stopTimer();
  document.body.classList.add("defeat");
  document.body.classList.remove("on-fire");
  const app = document.querySelector(".app");
  app.classList.add("screen-shake");
  setTimeout(() => app.classList.remove("screen-shake"), 700);
  flashScreen("rgba(255,40,60,0.6)");
  if (state.endless) return onLoseEndless();
  const prevStreak = window.MotusStats.getStats().currentStreak;
  window.MotusStats.recordResult(false, 0, state.target, state.length);
  updateStreakHud(0, { broke: prevStreak >= 1 });
  if (prevStreak >= 3) {
    showCombo("SERIE PERDUE !  x" + prevStreak, "broken");
  }
  setTimeout(() => {
    showEndModal(false, state.target, maxAttempts());
  }, 900);
}

// ========== Mode sans fin ==========

function toggleEndless() {
  if (state.endless) exitEndless();
  else enterEndless();
}

function enterEndless() {
  state.endless = true;
  state.endLoop = 1;
  state.endIdx = 0;
  state.endStreak = 0;
  document.body.classList.add("endless");
  document.body.classList.remove("victory", "defeat");
  $("#endlessBtn").classList.add("active");
  $("#endlessBtn").textContent = "QUITTER";
  $("#newGameBtn").textContent = "Nouvelle run";
  $("#lengthSelect").disabled = true;
  $("#lengthSelect").style.display = "none";
  $("#streakHud").style.display = "none";
  $("#endlessHud").hidden = false;
  closeEndModal();
  startEndlessWord();
}

function exitEndless() {
  state.endless = false;
  stopTimer();
  document.body.classList.remove("endless");
  $("#endlessBtn").classList.remove("active");
  $("#endlessBtn").textContent = "SANS FIN";
  $("#newGameBtn").textContent = "Nouvelle partie";
  $("#lengthSelect").disabled = false;
  $("#lengthSelect").style.display = "";
  $("#streakHud").style.display = "";
  $("#endlessHud").hidden = true;
  closeEndModal();
  startGame(parseInt($("#lengthSelect").value, 10));
}

function startEndlessWord() {
  state.length = ENDLESS_LENGTHS[state.endIdx];
  state.currentRow = 0;
  state.currentGuess = "";
  state.finished = false;
  state.revealing = false;
  const pick = window.MotusWords.pickRandomWord(state.length);
  if (!pick) { toast("Aucun mot disponible."); return; }
  state.target = pick.word;
  buildBoard();
  window.MotusKeyboard.resetKeyColors();
  document.body.classList.remove("victory", "defeat");
  updateEnterState();
  updateEndlessHud();
  const flags = endlessFlags(state.endLoop);
  if (flags.timer) startTimer(ENDLESS_TIMER_SECS);
}

function updateEndlessHud() {
  $("#ehStreak").textContent = state.endStreak;
  $("#ehLoop").textContent = state.endLoop;
  $("#ehLength").textContent = state.length;
  const flags = endlessFlags(state.endLoop);
  $("#ehTimerCell").hidden = !flags.timer;
}

function startTimer(secs) {
  stopTimer();
  state.timerEnd = Date.now() + secs * 1000;
  tickTimer();
  state.timerId = setInterval(tickTimer, 200);
}
function stopTimer() {
  if (state.timerId) { clearInterval(state.timerId); state.timerId = 0; }
}
function tickTimer() {
  const remain = Math.max(0, state.timerEnd - Date.now());
  const s = Math.ceil(remain / 1000);
  const el = $("#ehTimer");
  if (el) {
    el.textContent = s;
    el.classList.toggle("warn", s <= 10);
    el.classList.toggle("crit", s <= 5);
  }
  if (remain <= 0 && !state.finished && !state.revealing) {
    stopTimer();
    toast("Temps ecoule !");
    onLose();
  }
}

function effectTier(attempts, streak) {
  let t = 0;
  if (attempts === 1) t += 3;
  else if (attempts === 2) t += 2;
  else if (attempts <= 4) t += 1;
  if (streak >= 25) t += 3;
  else if (streak >= 10) t += 2;
  else if (streak >= 5) t += 1;
  return Math.min(t, 5);
}

const TIER_DELAY_MS = [900, 1100, 1300, 1500, 1800, 2200];
const TIER_LABELS = ["", "Bien !", "Super !", "Excellent !", "Incroyable !", "LEGENDAIRE !"];

function triggerWinEffects(tier, streak) {
  const particles = 40 + tier * 50;
  burstParticles(particles);
  if (tier >= 1) {
    const kind = tier >= 4 ? "milestone" : "";
    showCombo(TIER_LABELS[tier] + (streak >= 2 ? "   x" + streak : ""), kind);
  }
  if (tier >= 2) shockwave();
  if (tier >= 3) {
    flashScreen("rgba(255,247,0,0.55)");
    const app = document.querySelector(".app");
    app.classList.add("screen-shake");
    setTimeout(() => app.classList.remove("screen-shake"), 600);
  }
  if (tier >= 4) {
    setTimeout(() => burstParticles(120), 200);
    setTimeout(() => shockwave(), 350);
  }
  if (tier >= 5) {
    flashScreen("rgba(255,106,0,0.85)");
    document.body.classList.add("legendary");
    setTimeout(() => document.body.classList.remove("legendary"), 1600);
  }
}

function onWinEndless(attempts) {
  state.endStreak += 1;
  const tier = effectTier(attempts, state.endStreak);
  triggerWinEffects(tier, state.endStreak);
  // advance
  state.endIdx += 1;
  if (state.endIdx >= ENDLESS_LENGTHS.length) {
    state.endIdx = 0;
    state.endLoop += 1;
  }
  const delay = TIER_DELAY_MS[tier];
  setTimeout(() => {
    if (state.endless) startEndlessWord();
  }, delay);
}

function onLoseEndless() {
  const finalStreak = state.endStreak;
  const finalLoop = state.endLoop;
  const finalLen = state.length;
  state.endStreak = 0;
  state.endLoop = 1;
  state.endIdx = 0;
  updateEndlessHud();
  setTimeout(() => {
    showEndlessRunModal(finalStreak, finalLoop, finalLen, state.target);
  }, 900);
}

function showEndlessRunModal(streak, loop, len, word) {
  const modal = $("#endModal");
  $("#endTitle").textContent = "RUN TERMINEE";
  $("#endSub").innerHTML = "Mots resolus : <b>" + streak + "</b><br>Tour atteint : <b>" + loop + "</b><br>Longueur : <b>" + len + "</b><br><br>Le mot etait :";
  $("#endWord").textContent = word;
  modal.classList.remove("won");
  modal.classList.add("open");
}

function updateStreakHud(value, opts) {
  const hud = $("#streakHud");
  const val = $("#streakValue");
  if (!hud || !val) return;
  val.textContent = value;
  hud.classList.toggle("active", value > 0);
  document.body.classList.toggle("on-fire", value >= 10);
  if (opts && opts.pop) {
    hud.classList.remove("pop");
    void hud.offsetWidth;
    hud.classList.add("pop");
  }
  if (opts && opts.broke) {
    hud.classList.remove("broke");
    void hud.offsetWidth;
    hud.classList.add("broke");
  }
}

function showCombo(text, kind) {
  const b = $("#comboBanner");
  if (!b) return;
  b.textContent = text;
  b.className = "combo-banner " + (kind || "");
  void b.offsetWidth;
  b.classList.add("show");
  const dur = kind === "milestone" ? 2200 : kind === "broken" ? 1600 : 1400;
  setTimeout(() => b.classList.remove("show"), dur);
}

function flashScreen(color) {
  const f = $("#flash");
  if (!f) return;
  f.style.background = color || "rgba(255,255,255,0.7)";
  f.classList.remove("go");
  void f.offsetWidth;
  f.classList.add("go");
}

function shockwave() {
  const layer = $("#particles");
  if (!layer) return;
  const w = document.createElement("div");
  w.className = "shockwave";
  w.style.left = (window.innerWidth / 2) + "px";
  w.style.top = (window.innerHeight / 2) + "px";
  layer.appendChild(w);
  setTimeout(() => w.remove(), 1000);
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
  if (state.endless) {
    state.endLoop = 1;
    state.endIdx = 0;
    state.endStreak = 0;
    startEndlessWord();
    return;
  }
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
  $("#endlessBtn").addEventListener("click", toggleEndless);
  $("#statsBtn").addEventListener("click", openStats);
  $("#statsClose").addEventListener("click", closeStats);
  $("#endClose").addEventListener("click", closeEndModal);
  $("#endAgain").addEventListener("click", newGame);
  $("#resetWonBtn").addEventListener("click", resetWonConfirm);
  $("#streakHud").addEventListener("click", openStats);
  document.addEventListener("click", (e) => {
    if (e.target.classList && e.target.classList.contains("modal-backdrop")) {
      e.target.parentElement.classList.remove("open");
    }
  });
  updateStreakHud(window.MotusStats.getStats().currentStreak);
  startGame(parseInt($("#lengthSelect").value, 10));
}

window.MotusGame = { addLetter, removeLetter, submitGuess, startGame, newGame };

document.addEventListener("DOMContentLoaded", init);
