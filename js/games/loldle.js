(function () {
  "use strict";
  const CDN = "https://ddragon.leagueoflegends.com/cdn/";
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }

  Promise.all([
    fetch("data/lol.json").then(function (r) { if (!r.ok) throw new Error("lol " + r.status); return r.json(); }),
    fetch("data/lol-extra.json").then(function (r) { if (!r.ok) throw new Error("extra " + r.status); return r.json(); })
  ]).then(function (res) {
    const data = res[0], extra = res[1];
    const champions = data.champions;
    const VER = data.version;

    const square = function (c) { return CDN + VER + "/img/champion/" + c.key + ".png"; };
    const splash = function (key) { return CDN + "img/champion/splash/" + key + "_0.jpg"; };
    const spell = function (f) { return CDN + VER + "/img/spell/" + f; };
    const passive = function (f) { return CDN + VER + "/img/passive/" + f; };

    const emojiPool = champions.filter(function (c) { return extra[c.key] && extra[c.key].emojis; });
    const quotePool = champions.filter(function (c) { return extra[c.key] && extra[c.key].quote; });

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
        cfg.hint = "L'image se devoile a chaque essai.";
        cfg.renderClue = function (t, wrong, solved) {
          const url = splash(t.key);
          if (solved) return '<div class="lol-splash solved" style="background-image:url(' + url + ')"></div>';
          const h = hashStr(t.key);
          const fx = 18 + (h % 64), fy = 18 + ((h >> 8) % 64);
          const zoom = Math.max(135, 470 - wrong * 75);
          return '<div class="lol-splash" style="background-image:url(' + url + ');background-size:' + zoom + '%;background-position:' + fx + '% ' + fy + '%"></div>';
        };
      } else if (mode === "ability") {
        cfg.pool = champions;
        cfg.hint = "Un sort de plus est revele a chaque essai (Q, W, E, R).";
        cfg.renderClue = function (t, wrong, solved) {
          const n = solved ? 4 : Math.min(wrong + 1, 4);
          let html = "";
          for (let i = 0; i < n; i++) html += '<img src="' + spell(t.spells[i]) + '" alt="" />';
          if (solved) html += '<img class="passive" src="' + passive(t.passive) + '" alt="" />';
          return '<div class="lol-abilities">' + html + "</div>";
        };
      } else if (mode === "emoji") {
        cfg.pool = emojiPool;
        cfg.hint = "Un emoji de plus est revele a chaque essai.";
        cfg.renderClue = function (t, wrong, solved) {
          const e = extra[t.key].emojis;
          const n = solved ? e.length : Math.min(wrong + 1, e.length);
          return '<div class="lol-emojis">' + e.slice(0, n).map(function (x) { return "<span>" + x + "</span>"; }).join("") + "</div>";
        };
      } else { // quote
        cfg.pool = quotePool;
        cfg.hint = "Quel champion dit cela ?";
        cfg.renderClue = function (t) { return '<div class="lol-quote">« ' + extra[t.key].quote + " »</div>"; };
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
  }).catch(function (e) {
    const m = document.querySelector("#lolMount");
    if (m) m.innerHTML = '<p class="cg-error">Erreur de chargement des donnees LoL (' + e.message + ').</p>';
  });
})();
