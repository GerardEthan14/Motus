(function () {
  "use strict";
  var SPRITE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";

  fetch("data/pokemon.json")
    .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
    .then(function (list) {
      window.CharGuess({
        key: "pokedle",
        title: "POKEDLE",
        mount: "#cgApp",
        entities: list,
        idKey: "id",
        nameKey: "name",
        entityLabel: "Pokemon",
        searchKeys: ["name", "nameEn"],
        imageUrl: function (e) { return SPRITE + e.id + ".png"; },
        attributes: [
          { key: "type1", label: "Type 1", kind: "exact", group: "types" },
          { key: "type2", label: "Type 2", kind: "exact", group: "types", empty: "Aucun" },
          { key: "color", label: "Couleur", kind: "exact" },
          { key: "habitat", label: "Habitat", kind: "exact" },
          { key: "stage", label: "Evolution", kind: "numeric" },
          { key: "gen", label: "Gen", kind: "numeric" },
          { key: "heightM", label: "Taille", kind: "numeric", unit: " m" },
          { key: "weightKg", label: "Poids", kind: "numeric", unit: " kg" }
        ]
      });
    })
    .catch(function (e) {
      var m = document.querySelector("#cgApp");
      if (m) m.innerHTML = '<p class="cg-error">Erreur de chargement des donnees Pokemon (' + e.message + ').</p>';
    });
})();
