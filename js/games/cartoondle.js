(function () {
  "use strict";
  fetch("data/cartoons.json")
    .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
    .then(function (list) {
      window.CharGuess({
        key: "cartoondle",
        title: "CARTOONDLE",
        mount: "#cgApp",
        entities: list,
        idKey: "name",
        nameKey: "name",
        entityLabel: "Perso",
        searchKeys: ["name", "show"],
        attributes: [
          { key: "gender", label: "Sexe", kind: "exact" },
          { key: "role", label: "Role", kind: "exact" },
          { key: "color", label: "Couleur", kind: "exact" },
          { key: "channel", label: "Chaine", kind: "exact" },
          { key: "show", label: "Serie", kind: "exact" },
          { key: "year", label: "Annee", kind: "numeric" }
        ]
      });
    })
    .catch(function (e) {
      var m = document.querySelector("#cgApp");
      if (m) m.innerHTML = '<p class="cg-error">Erreur de chargement des donnees (' + e.message + ').</p>';
    });
})();
