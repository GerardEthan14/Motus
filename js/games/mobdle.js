(function () {
  "use strict";
  fetch("data/minecraft.json")
    .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
    .then(function (list) {
      window.CharGuess({
        key: "mobdle",
        title: "MOBDLE",
        mount: "#cgApp",
        entities: list,
        idKey: "nameEn",
        nameKey: "name",
        entityLabel: "Mob",
        searchKeys: ["name", "nameEn"],
        attributes: [
          { key: "category", label: "Categorie", kind: "exact" },
          { key: "type", label: "Type", kind: "exact" },
          { key: "dimensions", label: "Dimension", kind: "set" },
          { key: "hp", label: "PV", kind: "numeric" },
          { key: "flies", label: "Vole", kind: "exact" },
          { key: "tameable", label: "Domptable", kind: "exact" },
          { key: "ver", label: "Version", kind: "numeric", fmt: function (v) { return v < 100 ? "Beta" : "1." + (v - 100); } }
        ]
      });
    })
    .catch(function (e) {
      var m = document.querySelector("#cgApp");
      if (m) m.innerHTML = '<p class="cg-error">Erreur de chargement des donnees Minecraft (' + e.message + ').</p>';
    });
})();
