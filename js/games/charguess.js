// Moteur reutilisable de jeu "devine le personnage par ses caracteristiques".
// Usage : CharGuess(config) apres avoir charge les donnees.
(function () {
  "use strict";

  function norm(s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0);
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
  }

  function CharGuess(cfg) {
    const mount = document.querySelector(cfg.mount);
    if (!mount) return;
    if (window.__activeGuess && window.__activeGuess.destroy) window.__activeGuess.destroy();
    const cleanups = [];
    const entities = cfg.entities;
    const byId = {};
    entities.forEach(function (e) { byId[e[cfg.idKey]] = e; });

    // Pre-compute group sets reference list
    const groups = {};
    cfg.attributes.forEach(function (a) { if (a.group) (groups[a.group] = groups[a.group] || []).push(a.key); });

    const state = {
      mode: "daily",
      target: null,
      guesses: [],
      solved: false
    };

    // ---------- UI ----------
    mount.innerHTML =
      '<div class="cg-modes">' +
        '<button class="btn cg-mode-btn active" data-mode="daily" type="button">Du jour</button>' +
        '<button class="btn cg-mode-btn" data-mode="training" type="button">Entrainement</button>' +
        '<button class="btn cg-stats-btn" type="button" aria-label="Statistiques">STATS</button>' +
      '</div>' +
      '<div class="cg-status"><span class="cg-tries">0 essai</span><span class="cg-hint"></span></div>' +
      '<div class="cg-search-wrap">' +
        '<input class="cg-search" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Tape un nom..." />' +
        '<div class="cg-dropdown" hidden></div>' +
      '</div>' +
      '<div class="cg-legend"></div>' +
      '<div class="cg-board-scroll"><div class="cg-head"></div><div class="cg-board"></div></div>' +
      '<div class="cg-modal" hidden><div class="cg-modal-card">' +
        '<div class="cg-modal-img"></div>' +
        '<h2 class="cg-modal-title"></h2>' +
        '<p class="cg-modal-sub"></p>' +
        '<button class="btn primary cg-again" type="button">Rejouer</button>' +
      '</div></div>';

    const el = {
      modeBtns: mount.querySelectorAll(".cg-mode-btn"),
      statsBtn: mount.querySelector(".cg-stats-btn"),
      tries: mount.querySelector(".cg-tries"),
      hint: mount.querySelector(".cg-hint"),
      search: mount.querySelector(".cg-search"),
      dropdown: mount.querySelector(".cg-dropdown"),
      legend: mount.querySelector(".cg-legend"),
      head: mount.querySelector(".cg-head"),
      board: mount.querySelector(".cg-board"),
      modal: mount.querySelector(".cg-modal"),
      modalImg: mount.querySelector(".cg-modal-img"),
      modalTitle: mount.querySelector(".cg-modal-title"),
      modalSub: mount.querySelector(".cg-modal-sub"),
      again: mount.querySelector(".cg-again")
    };

    el.legend.innerHTML =
      '<span><i class="lg correct"></i>Exact</span>' +
      '<span><i class="lg present"></i>Partiel</span>' +
      '<span><i class="lg absent"></i>Faux</span>' +
      '<span><i class="lg arrow">▲▼</i>Plus / moins</span>';

    // head columns
    var headHtml = '<div class="cg-cell cg-name-cell">' + cfg.entityLabel + '</div>';
    cfg.attributes.forEach(function (a) { headHtml += '<div class="cg-cell">' + a.label + '</div>'; });
    el.head.innerHTML = headHtml;
    el.head.style.setProperty("--cg-cols", cfg.attributes.length);
    el.board.style.setProperty("--cg-cols", cfg.attributes.length);

    // ---------- comparison ----------
    function groupSet(target, groupId) {
      const set = new Set();
      groups[groupId].forEach(function (k) { if (target[k] != null) set.add(target[k]); });
      return set;
    }

    function compare(attr, guess, target) {
      const gv = guess[attr.key];
      const tv = target[attr.key];
      if (attr.kind === "numeric") {
        if (gv === tv) return { state: "correct" };
        return { state: "absent", arrow: tv > gv ? "up" : "down" };
      }
      if (attr.kind === "set") {
        const ga = Array.isArray(gv) ? gv : (gv == null ? [] : [gv]);
        const ta = Array.isArray(tv) ? tv : (tv == null ? [] : [tv]);
        const tset = new Set(ta);
        const inter = ga.filter(function (x) { return tset.has(x); });
        if (inter.length === ga.length && ga.length === ta.length) return { state: "correct" };
        if (inter.length > 0) return { state: "present" };
        return { state: "absent" };
      }
      // exact (possibly grouped)
      if (gv === tv) return { state: "correct" };
      if (attr.group && gv != null && groupSet(target, attr.group).has(gv)) return { state: "present" };
      return { state: "absent" };
    }

    function fmtVal(attr, e) {
      var v = e[attr.key];
      if (Array.isArray(v)) return v.length ? v.join(", ") : (attr.empty || "Aucun");
      if (v == null || v === "") return attr.empty || "Aucun";
      if (attr.fmt) return attr.fmt(v);
      if (attr.kind === "numeric" && attr.unit) return v + attr.unit;
      return v;
    }

    // ---------- rendering ----------
    function renderRow(entity, animate) {
      const target = state.target;
      const row = document.createElement("div");
      row.className = "cg-row";
      row.style.setProperty("--cg-cols", cfg.attributes.length);

      const nameCell = document.createElement("div");
      nameCell.className = "cg-cell cg-name-cell";
      var img = cfg.imageUrl ? cfg.imageUrl(entity) : null;
      nameCell.innerHTML = (img ? '<img class="cg-thumb" src="' + img + '" alt="" loading="lazy" />' : "") +
        '<span class="cg-ename">' + entity[cfg.nameKey] + "</span>";
      row.appendChild(nameCell);

      cfg.attributes.forEach(function (attr, i) {
        const cmp = compare(attr, entity, target);
        const cell = document.createElement("div");
        cell.className = "cg-cell cg-attr " + cmp.state + (cmp.arrow ? " arrow-" + cmp.arrow : "");
        cell.innerHTML = '<span>' + fmtVal(attr, entity) + "</span>" +
          (cmp.arrow ? '<span class="cg-arrow">' + (cmp.arrow === "up" ? "▲" : "▼") + "</span>" : "");
        if (animate) {
          cell.style.animationDelay = (i * 90) + "ms";
          cell.classList.add("reveal");
        }
        row.appendChild(cell);
      });

      el.board.insertBefore(row, el.board.firstChild);
      return row;
    }

    function renderAll() {
      el.board.innerHTML = "";
      state.guesses.forEach(function (id) { renderRow(byId[id], false); });
    }

    function updateStatus() {
      const n = state.guesses.length;
      el.tries.textContent = n + " essai" + (n > 1 ? "s" : "");
      el.hint.textContent = state.mode === "daily" ? "Defi du jour" : "Entrainement";
    }

    // ---------- guessing ----------
    function makeGuess(entity) {
      if (state.solved || !entity) return;
      if (state.guesses.indexOf(entity[cfg.idKey]) !== -1) { flashSearch(); return; }
      state.guesses.push(entity[cfg.idKey]);
      const won = entity[cfg.idKey] === state.target[cfg.idKey];
      renderRow(entity, true);
      updateStatus();
      if (state.mode === "daily") persistDaily();
      if (won) onWin();
    }

    function onWin() {
      state.solved = true;
      el.search.disabled = true;
      el.search.placeholder = "Trouve !";
      burst();
      const tries = state.guesses.length;
      recordWin(tries);
      setTimeout(function () { showModal(tries); }, 700);
    }

    function showModal(tries) {
      const t = state.target;
      el.modalImg.innerHTML = cfg.imageUrl ? '<img src="' + cfg.imageUrl(t) + '" alt="" />' : "";
      el.modalTitle.textContent = t[cfg.nameKey];
      el.modalSub.textContent = "Trouve en " + tries + " essai" + (tries > 1 ? "s" : "") +
        (state.mode === "daily" ? " — reviens demain !" : "");
      el.again.style.display = state.mode === "training" ? "" : "none";
      el.modal.hidden = false;
    }

    // ---------- autocomplete ----------
    var acIndex = -1, acItems = [];
    function refreshDropdown() {
      const q = norm(el.search.value);
      el.dropdown.innerHTML = "";
      acIndex = -1; acItems = [];
      if (!q) { el.dropdown.hidden = true; return; }
      const guessed = new Set(state.guesses);
      const matches = [];
      for (var i = 0; i < entities.length && matches.length < 8; i++) {
        const e = entities[i];
        if (guessed.has(e[cfg.idKey])) continue;
        var hit = cfg.searchKeys.some(function (k) { return norm(e[k]).indexOf(q) !== -1; });
        if (hit) matches.push(e);
      }
      if (!matches.length) { el.dropdown.hidden = true; return; }
      matches.forEach(function (e) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "cg-ac-item";
        var img = cfg.imageUrl ? cfg.imageUrl(e) : null;
        item.innerHTML = (img ? '<img src="' + img + '" alt="" loading="lazy" />' : "") +
          "<span>" + e[cfg.nameKey] + "</span>";
        item.dataset.idx = String(acItems.length);
        el.dropdown.appendChild(item);
        acItems.push(e);
      });
      el.dropdown.hidden = false;
    }

    function select(e) {
      makeGuess(e);
      el.search.value = "";
      el.dropdown.hidden = true;
      if (!state.solved) el.search.focus();
    }

    function flashSearch() {
      el.search.classList.remove("shake");
      void el.search.offsetWidth;
      el.search.classList.add("shake");
    }

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
      if (e.key === "ArrowDown") { e.preventDefault(); acIndex = Math.min(acIndex + 1, items.length - 1); highlight(items); }
      else if (e.key === "ArrowUp") { e.preventDefault(); acIndex = Math.max(acIndex - 1, 0); highlight(items); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const pick = acIndex >= 0 ? acItems[acIndex] : acItems[0];
        if (pick) select(pick);
      } else if (e.key === "Escape") { el.dropdown.hidden = true; }
    });
    function highlight(items) {
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
    function pickDaily() {
      const idx = hashStr(cfg.key + "|" + todayKey()) % entities.length;
      return entities[idx];
    }
    function pickRandom() {
      return entities[Math.floor(Math.random() * entities.length)];
    }

    function persistDaily() {
      writeJSON("cg." + cfg.key + ".daily", {
        date: todayKey(),
        targetId: state.target[cfg.idKey],
        guesses: state.guesses,
        solved: state.solved
      });
    }

    function startDaily() {
      state.mode = "daily";
      const saved = readJSON("cg." + cfg.key + ".daily", null);
      const target = pickDaily();
      state.target = target;
      if (saved && saved.date === todayKey() && saved.targetId === target[cfg.idKey]) {
        state.guesses = (saved.guesses || []).filter(function (id) { return byId[id]; });
        state.solved = !!saved.solved;
      } else {
        state.guesses = [];
        state.solved = false;
      }
      resetUIForMode();
      renderAll();
      updateStatus();
      if (state.solved) { el.search.disabled = true; el.search.placeholder = "Defi resolu — demain !"; }
    }

    function startTraining() {
      state.mode = "training";
      state.target = pickRandom();
      state.guesses = [];
      state.solved = false;
      resetUIForMode();
      el.board.innerHTML = "";
      updateStatus();
    }

    function resetUIForMode() {
      el.modal.hidden = true;
      el.search.disabled = false;
      el.search.value = "";
      el.search.placeholder = "Tape un nom...";
      el.dropdown.hidden = true;
    }

    // ---------- stats ----------
    function statsKey() { return "cg." + cfg.key + ".stats"; }
    function getStats() {
      return readJSON(statsKey(), { played: 0, wins: 0, streak: 0, max: 0, last: "", bestTries: 0 });
    }
    function recordWin(tries) {
      const s = getStats();
      s.played += 1; s.wins += 1;
      if (state.mode === "daily") {
        const y = new Date(Date.now() - 86400000);
        const yKey = y.getFullYear() + "-" + (y.getMonth() + 1) + "-" + y.getDate();
        s.streak = (s.last === yKey || s.last === "") ? (s.streak + 1) : 1;
        if (s.last !== todayKey()) s.last = todayKey();
        if (s.streak > s.max) s.max = s.streak;
      }
      if (!s.bestTries || tries < s.bestTries) s.bestTries = tries;
      writeJSON(statsKey(), s);
    }
    function showStats() {
      const s = getStats();
      const pct = s.played ? Math.round(100 * s.wins / s.played) : 0;
      el.modalImg.innerHTML = "";
      el.modalTitle.textContent = "STATS";
      el.modalSub.innerHTML =
        "Parties : " + s.played + "<br>" +
        "Victoires : " + s.wins + " (" + pct + "%)<br>" +
        "Serie quotidienne : " + s.streak + " (max " + s.max + ")<br>" +
        "Meilleur score : " + (s.bestTries || "-") + " essais";
      el.again.style.display = "none";
      el.modal.hidden = false;
    }

    // ---------- effects ----------
    function burst() {
      const layer = document.getElementById("particles");
      if (!layer) return;
      const colors = ["#39ff14", "#fff700", "#ff3df0", "#39d2ff", "#ff6a00"];
      for (var i = 0; i < 60; i++) {
        const p = document.createElement("div");
        p.className = "particle big";
        p.style.left = (window.innerWidth / 2) + "px";
        p.style.top = (window.innerHeight / 2) + "px";
        p.style.background = colors[i % colors.length];
        const a = Math.random() * Math.PI * 2;
        const d = 100 + Math.random() * 300;
        p.style.setProperty("--dx", Math.cos(a) * d + "px");
        p.style.setProperty("--dy", Math.sin(a) * d + "px");
        p.style.setProperty("--dur", (700 + Math.random() * 900) + "ms");
        layer.appendChild(p);
        setTimeout(function (node) { return function () { node.remove(); }; }(p), 1700);
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
    el.again.addEventListener("click", function () {
      if (state.mode === "training") startTraining(); else el.modal.hidden = true;
    });
    el.modal.addEventListener("click", function (e) {
      if (e.target === el.modal) el.modal.hidden = true;
    });

    window.__activeGuess = { destroy: function () { cleanups.forEach(function (f) { f(); }); } };

    startDaily();
  }

  window.CharGuess = CharGuess;
})();
