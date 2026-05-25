(function () {
  "use strict";
  const CDN = "https://ddragon.leagueoflegends.com/cdn/";
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }
  function seededShuffle(n, seed) {
    const arr = []; for (let i = 0; i < n; i++) arr.push(i);
    let s = seed >>> 0;
    for (let i = n - 1; i > 0; i--) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const j = s % (i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }

  fetch("data/lol.json")
    .then(function (r) { if (!r.ok) throw new Error("lol " + r.status); return r.json(); })
    .then(function (data) {
      const champions = data.champions;
      const VER = data.version;

      const square = function (c) { return CDN + VER + "/img/champion/" + c.key + ".png"; };
      const splash = function (key, num) { return CDN + "img/champion/splash/" + key + "_" + (num == null ? 0 : num) + ".jpg"; };
      const spell = function (f) { return CDN + VER + "/img/spell/" + f; };
      const passive = function (f) { return CDN + VER + "/img/passive/" + f; };

      const quotePool = champions.filter(function (c) { return c.quote; });
      const base = { champions: champions, idKey: "key", nameKey: "name", searchKeys: ["name", "nameEn"], thumb: square };

      const classicCfg = {
        key: "loldle.classic", mount: "#lolMount", entities: champions,
        idKey: "key", nameKey: "name", entityLabel: "Champion", searchKeys: ["name", "nameEn"], imageUrl: square,
        attributes: [
          { key: "gender", label: "Genre", kind: "exact" },
          { key: "positions", label: "Position", kind: "set" },
          { key: "species", label: "Espece", kind: "set" },
          { key: "resource", label: "Ressource", kind: "exact" },
          { key: "rangeType", label: "Portee", kind: "set" },
          { key: "regions", label: "Region", kind: "set" },
          { key: "year", label: "Annee", kind: "numeric" }
        ]
      };

      function media(mode) {
        const cfg = Object.assign({ mount: "#lolMount", key: "loldle." + mode }, base);
        if (mode === "splash") {
          cfg.pool = champions;
          cfg.hint = "Trouve le champion, puis devine le skin. L'image se devoile a chaque essai.";
          cfg.pickVariant = function (t, seed) { return t.skins[seed % t.skins.length].num; };
          cfg.renderClue = function (t, wrong, full, variant) {
            const url = splash(t.key, variant);
            if (full) return '<div class="lol-splash solved" style="background-image:url(' + url + ')"></div>';
            const h = hashStr(t.key + "_" + variant);
            const fx = 18 + (h % 64), fy = 18 + ((h >> 8) % 64);
            const zoom = Math.max(135, 470 - wrong * 75);
            return '<div class="lol-splash" style="background-image:url(' + url + ');background-size:' + zoom + '%;background-position:' + fx + '% ' + fy + '%"></div>';
          };
          cfg.phase2 = {
            prompt: "Bien joue ! Quel skin est-ce ?",
            options: function (t) { return t.skins.map(function (s) { return { id: s.num, label: s.name }; }); },
            correctId: function (t, variant) { return variant == null ? 0 : variant; }
          };
        } else if (mode === "ability") {
          cfg.pool = champions;
          cfg.hint = "Sort grise et pivote. Un sort de plus est revele a chaque essai.";
          cfg.renderClue = function (t, wrong, full) {
            let html = "";
            if (full) {
              for (let i = 0; i < 4; i++) html += '<img src="' + spell(t.spells[i]) + '" alt="" />';
              html += '<img class="passive" src="' + passive(t.passive) + '" alt="" />';
            } else {
              const order = seededShuffle(4, hashStr(t.key));
              const n = Math.min(wrong + 1, 4);
              for (let i = 0; i < n; i++) {
                const si = order[i];
                const rot = (hashStr(t.key + "#" + si) % 4) * 90;
                html += '<img class="masked" style="transform:rotate(' + rot + 'deg)" src="' + spell(t.spells[si]) + '" alt="" />';
              }
            }
            return '<div class="lol-abilities">' + html + "</div>";
          };
        } else if (mode === "emoji") {
          cfg.pool = champions;
          cfg.hint = "Un emoji de plus est revele a chaque essai.";
          cfg.renderClue = function (t, wrong, full) {
            const e = t.emojis || [];
            const n = full ? e.length : Math.min(wrong + 1, e.length);
            return '<div class="lol-emojis">' + e.slice(0, n).map(function (x) { return "<span>" + x + "</span>"; }).join("") + "</div>";
          };
        } else { // quote
          cfg.pool = quotePool;
          cfg.hint = "Quel champion dit cela ?";
          cfg.renderClue = function (t) { return '<div class="lol-quote">« ' + t.quote + " »</div>"; };
        }
        return cfg;
      }

      const nav = document.querySelector(".lol-nav");
      function activate(mode) {
        nav.querySelectorAll("button").forEach(function (b) { b.classList.toggle("active", b.dataset.mode === mode); });
        if (mode === "classic") window.CharGuess(classicCfg);
        else window.MediaGuess(media(mode));
        try { localStorage.setItem("loldle.lastMode", mode); } catch (e) {}
      }
      nav.addEventListener("click", function (e) {
        const b = e.target.closest("button[data-mode]");
        if (b) activate(b.dataset.mode);
      });

      let start = "classic";
      try { start = localStorage.getItem("loldle.lastMode") || "classic"; } catch (e) {}
      activate(start);
    })
    .catch(function (e) {
      const m = document.querySelector("#lolMount");
      if (m) m.innerHTML = '<p class="cg-error">Erreur de chargement des donnees LoL (' + e.message + ').</p>';
    });
})();
