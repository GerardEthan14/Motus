// Moteur "devine le personnage a partir d'un indice media" (splash, icone, emoji, citation).
// Les mauvaises reponses s'affichent en cartes rouges ; l'indice se devoile a chaque essai.
// Supporte une 2e phase optionnelle (cfg.phase2), ex. choisir le skin une fois le champion trouve.
(function () {
  "use strict";

  function norm(s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }
  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  function readJSON(k, f) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (e) { return f; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function MediaGuess(cfg) {
    const mount = document.querySelector(cfg.mount);
    if (!mount) return;
    if (window.__activeGuess && window.__activeGuess.destroy) window.__activeGuess.destroy();
    const cleanups = [];

    const all = cfg.champions;
    const pool = cfg.pool || all;
    const byId = {};
    all.forEach(function (c) { byId[c[cfg.idKey]] = c; });

    const state = { mode: "daily", target: null, guesses: [], solved: false, championFound: false, variant: null };

    mount.innerHTML =
      '<div class="cg-modes">' +
        '<button class="btn cg-mode-btn active" data-mode="daily" type="button">Du jour</button>' +
        '<button class="btn cg-mode-btn" data-mode="training" type="button">Entrainement</button>' +
        '<button class="btn cg-stats-btn" type="button" aria-label="Statistiques">STATS</button>' +
      '</div>' +
      '<div class="mg-clue"></div>' +
      (cfg.hint ? '<p class="mg-hint">' + cfg.hint + '</p>' : '') +
      '<div class="cg-status"><span class="cg-tries">0 essai</span><span class="cg-hint"></span></div>' +
      '<div class="cg-search-wrap">' +
        '<input class="cg-search" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Tape un champion..." />' +
        '<div class="cg-dropdown" hidden></div>' +
      '</div>' +
      '<div class="mg-phase2" hidden></div>' +
      '<div class="mg-guesses"></div>' +
      '<div class="cg-modal" hidden><div class="cg-modal-card">' +
        '<div class="cg-modal-img"></div>' +
        '<h2 class="cg-modal-title"></h2>' +
        '<p class="cg-modal-sub"></p>' +
        '<button class="btn primary cg-again" type="button">Rejouer</button>' +
      '</div></div>';

    const el = {
      modeBtns: mount.querySelectorAll(".cg-mode-btn"),
      statsBtn: mount.querySelector(".cg-stats-btn"),
      clue: mount.querySelector(".mg-clue"),
      tries: mount.querySelector(".cg-tries"),
      hint: mount.querySelector(".cg-status .cg-hint"),
      searchWrap: mount.querySelector(".cg-search-wrap"),
      search: mount.querySelector(".cg-search"),
      dropdown: mount.querySelector(".cg-dropdown"),
      phase2: mount.querySelector(".mg-phase2"),
      guesses: mount.querySelector(".mg-guesses"),
      modal: mount.querySelector(".cg-modal"),
      modalImg: mount.querySelector(".cg-modal-img"),
      modalTitle: mount.querySelector(".cg-modal-title"),
      modalSub: mount.querySelector(".cg-modal-sub"),
      again: mount.querySelector(".cg-again")
    };

    const revealFull = function () { return state.solved || state.championFound; };
    function wrongCount() { return state.guesses.length - (revealFull() ? 1 : 0); }
    function renderClue() { el.clue.innerHTML = cfg.renderClue(state.target, wrongCount(), revealFull(), state.variant); }

    function updateStatus() {
      const n = state.guesses.length;
      el.tries.textContent = n + " essai" + (n > 1 ? "s" : "");
      el.hint.textContent = state.mode === "daily" ? "Defi du jour" : "Entrainement";
    }

    function renderGuesses() {
      el.guesses.innerHTML = "";
      state.guesses.forEach(function (id) { addCard(byId[id], false); });
    }
    function addCard(c, animate) {
      const correct = c[cfg.idKey] === state.target[cfg.idKey];
      const card = document.createElement("div");
      card.className = "mg-card " + (correct ? "correct" : "wrong") + (animate ? " reveal" : "");
      const img = cfg.thumb ? cfg.thumb(c) : null;
      card.innerHTML = (img ? '<img src="' + img + '" alt="" loading="lazy" />' : "") +
        '<span class="mg-cname">' + c[cfg.nameKey] + "</span>";
      el.guesses.insertBefore(card, el.guesses.firstChild);
    }

    function makeGuess(c) {
      if (state.solved || state.championFound || !c) return;
      if (state.guesses.indexOf(c[cfg.idKey]) !== -1) { flashSearch(); return; }
      const correct = c[cfg.idKey] === state.target[cfg.idKey];
      state.guesses.push(c[cfg.idKey]);
      addCard(c, true);
      if (correct) {
        if (cfg.phase2) {
          state.championFound = true;
          renderClue(); updateStatus();
          if (state.mode === "daily") persistDaily();
          enterPhase2();
          return;
        }
        state.solved = true;
        renderClue(); updateStatus();
        if (state.mode === "daily") persistDaily();
        onWin();
        return;
      }
      renderClue(); updateStatus();
      if (state.mode === "daily") persistDaily();
    }

    // ---------- phase 2 (ex. choix du skin) ----------
    function enterPhase2() {
      el.searchWrap.style.display = "none";
      const opts = cfg.phase2.options(state.target);
      el.phase2.innerHTML = '<p class="mg-p2-prompt">' + cfg.phase2.prompt + "</p>" +
        '<div class="mg-skins">' +
        opts.map(function (o) { return '<button type="button" class="mg-skin" data-id="' + o.id + '">' + o.label + "</button>"; }).join("") +
        "</div>";
      el.phase2.hidden = false;
    }
    function markSolvedSkin() {
      const id = cfg.phase2.correctId(state.target, state.variant);
      const b = el.phase2.querySelector('.mg-skin[data-id="' + id + '"]');
      if (b) b.classList.add("correct");
    }
    if (cfg.phase2) {
      el.phase2.addEventListener("click", function (ev) {
        const b = ev.target.closest(".mg-skin");
        if (!b || state.solved || b.disabled) return;
        const id = parseInt(b.dataset.id, 10);
        if (id === cfg.phase2.correctId(state.target, state.variant)) {
          b.classList.add("correct");
          state.solved = true;
          renderClue();
          if (state.mode === "daily") persistDaily();
          onWin();
        } else {
          b.classList.add("wrong"); b.disabled = true;
          state.skinMisses = (state.skinMisses || 0) + 1;
          if (state.mode === "daily") persistDaily();
        }
      });
    }

    function onWin() {
      el.search.disabled = true;
      burst();
      recordWin(state.guesses.length);
      setTimeout(function () { showModal(state.guesses.length); }, 700);
    }
    function showModal(tries) {
      const t = state.target;
      el.modalImg.innerHTML = cfg.thumb ? '<img src="' + cfg.thumb(t) + '" alt="" />' : "";
      el.modalTitle.textContent = t[cfg.nameKey];
      el.modalSub.textContent = "Trouve en " + tries + " essai" + (tries > 1 ? "s" : "") +
        (state.mode === "daily" ? " — reviens demain !" : "");
      el.again.style.display = state.mode === "training" ? "" : "none";
      el.modal.hidden = false;
    }

    // ---------- autocomplete ----------
    let acItems = [], acIndex = -1;
    function refreshDropdown() {
      const q = norm(el.search.value);
      el.dropdown.innerHTML = ""; acItems = []; acIndex = -1;
      if (!q) { el.dropdown.hidden = true; return; }
      const guessed = new Set(state.guesses);
      const matches = [];
      for (let i = 0; i < all.length && matches.length < 8; i++) {
        const c = all[i];
        if (guessed.has(c[cfg.idKey])) continue;
        if (cfg.searchKeys.some(function (k) { return norm(c[k]).indexOf(q) !== -1; })) matches.push(c);
      }
      if (!matches.length) { el.dropdown.hidden = true; return; }
      matches.forEach(function (c) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "cg-ac-item";
        const img = cfg.thumb ? cfg.thumb(c) : null;
        item.innerHTML = (img ? '<img src="' + img + '" alt="" loading="lazy" />' : "") + "<span>" + c[cfg.nameKey] + "</span>";
        item.dataset.idx = String(acItems.length);
        el.dropdown.appendChild(item);
        acItems.push(c);
      });
      el.dropdown.hidden = false;
    }
    function select(c) {
      makeGuess(c);
      el.search.value = "";
      el.dropdown.hidden = true;
      if (!revealFull()) el.search.focus();
    }
    function flashSearch() { el.search.classList.remove("shake"); void el.search.offsetWidth; el.search.classList.add("shake"); }
    el.dropdown.addEventListener("click", function (ev) {
      const item = ev.target.closest(".cg-ac-item");
      if (!item) return;
      const idx = parseInt(item.dataset.idx, 10);
      if (!isNaN(idx) && acItems[idx]) select(acItems[idx]);
    });
    el.search.addEventListener("input", refreshDropdown);
    el.search.addEventListener("keydown", function (e) {
      if (el.dropdown.hidden) return;
      const items = el.dropdown.querySelectorAll(".cg-ac-item");
      if (e.key === "ArrowDown") { e.preventDefault(); acIndex = Math.min(acIndex + 1, items.length - 1); hl(items); }
      else if (e.key === "ArrowUp") { e.preventDefault(); acIndex = Math.max(acIndex - 1, 0); hl(items); }
      else if (e.key === "Enter") { e.preventDefault(); const p = acIndex >= 0 ? acItems[acIndex] : acItems[0]; if (p) select(p); }
      else if (e.key === "Escape") { el.dropdown.hidden = true; }
    });
    function hl(items) {
      items.forEach(function (it, i) { it.classList.toggle("active", i === acIndex); });
      if (items[acIndex]) items[acIndex].scrollIntoView({ block: "nearest" });
    }
    function onDocDown(e) {
      const wrap = mount.querySelector(".cg-search-wrap");
      if (wrap && !wrap.contains(e.target)) el.dropdown.hidden = true;
    }
    document.addEventListener("pointerdown", onDocDown);
    cleanups.push(function () { document.removeEventListener("pointerdown", onDocDown); });

    // ---------- modes ----------
    function pickDaily() { return pool[hashStr(cfg.key + "|" + todayKey()) % pool.length]; }
    function pickRandom() { return pool[Math.floor(Math.random() * pool.length)]; }
    function persistDaily() {
      writeJSON("cg." + cfg.key + ".daily", {
        date: todayKey(), targetId: state.target[cfg.idKey], variant: state.variant,
        guesses: state.guesses, championFound: state.championFound, solved: state.solved
      });
    }
    function startDaily() {
      state.mode = "daily";
      const saved = readJSON("cg." + cfg.key + ".daily", null);
      state.target = pickDaily();
      const seed = hashStr(cfg.key + "|" + todayKey() + "|v");
      state.variant = cfg.pickVariant ? cfg.pickVariant(state.target, seed) : null;
      state.championFound = false; state.solved = false; state.guesses = [];
      if (saved && saved.date === todayKey() && saved.targetId === state.target[cfg.idKey]) {
        state.guesses = (saved.guesses || []).filter(function (id) { return byId[id]; });
        if (saved.variant != null) state.variant = saved.variant;
        state.championFound = !!saved.championFound || !!saved.solved;
        state.solved = !!saved.solved;
      }
      resetUI();
      renderGuesses(); renderClue(); updateStatus();
      if (cfg.phase2 && state.championFound) { enterPhase2(); if (state.solved) markSolvedSkin(); }
      if (revealFull()) { el.search.disabled = true; }
      if (state.solved && !cfg.phase2) el.search.placeholder = "Defi resolu — demain !";
    }
    function startTraining() {
      state.mode = "training";
      state.target = pickRandom();
      state.variant = cfg.pickVariant ? cfg.pickVariant(state.target, Math.floor(Math.random() * 1e9)) : null;
      state.guesses = []; state.solved = false; state.championFound = false;
      resetUI();
      el.guesses.innerHTML = ""; renderClue(); updateStatus();
    }
    function resetUI() {
      el.modal.hidden = true; el.search.disabled = false; el.search.value = "";
      el.search.placeholder = "Tape un champion..."; el.dropdown.hidden = true;
      el.phase2.hidden = true; el.phase2.innerHTML = ""; el.searchWrap.style.display = "";
    }

    // ---------- stats ----------
    function statsKey() { return "cg." + cfg.key + ".stats"; }
    function getStats() { return readJSON(statsKey(), { played: 0, wins: 0, streak: 0, max: 0, last: "", bestTries: 0 }); }
    function recordWin(tries) {
      const s = getStats(); s.played += 1; s.wins += 1;
      if (state.mode === "daily") {
        const y = new Date(Date.now() - 86400000);
        const yKey = y.getFullYear() + "-" + (y.getMonth() + 1) + "-" + y.getDate();
        s.streak = (s.last === yKey || s.last === "") ? s.streak + 1 : 1;
        if (s.last !== todayKey()) s.last = todayKey();
        if (s.streak > s.max) s.max = s.streak;
      }
      if (!s.bestTries || tries < s.bestTries) s.bestTries = tries;
      writeJSON(statsKey(), s);
    }
    function showStats() {
      const s = getStats(); const pct = s.played ? Math.round(100 * s.wins / s.played) : 0;
      el.modalImg.innerHTML = "";
      el.modalTitle.textContent = "STATS";
      el.modalSub.innerHTML = "Parties : " + s.played + "<br>Victoires : " + s.wins + " (" + pct + "%)<br>" +
        "Serie quotidienne : " + s.streak + " (max " + s.max + ")<br>Meilleur score : " + (s.bestTries || "-") + " essais";
      el.again.style.display = "none"; el.modal.hidden = false;
    }

    // ---------- effets ----------
    function burst() {
      const layer = document.getElementById("particles");
      if (!layer) return;
      const colors = ["#39ff14", "#fff700", "#ff3df0", "#39d2ff", "#ff6a00"];
      for (let i = 0; i < 60; i++) {
        const p = document.createElement("div");
        p.className = "particle big";
        p.style.left = (window.innerWidth / 2) + "px";
        p.style.top = (window.innerHeight / 2) + "px";
        p.style.background = colors[i % colors.length];
        const a = Math.random() * Math.PI * 2, d = 100 + Math.random() * 300;
        p.style.setProperty("--dx", Math.cos(a) * d + "px");
        p.style.setProperty("--dy", Math.sin(a) * d + "px");
        p.style.setProperty("--dur", (700 + Math.random() * 900) + "ms");
        layer.appendChild(p);
        setTimeout(function (n) { return function () { n.remove(); }; }(p), 1700);
      }
    }

    // ---------- wire ----------
    el.modeBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        el.modeBtns.forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        if (b.dataset.mode === "daily") startDaily(); else startTraining();
      });
    });
    el.statsBtn.addEventListener("click", showStats);
    el.again.addEventListener("click", function () { if (state.mode === "training") startTraining(); else el.modal.hidden = true; });
    el.modal.addEventListener("click", function (e) { if (e.target === el.modal) el.modal.hidden = true; });

    window.__activeGuess = { destroy: function () { cleanups.forEach(function (f) { f(); }); } };

    startDaily();
  }

  window.MediaGuess = MediaGuess;
})();
