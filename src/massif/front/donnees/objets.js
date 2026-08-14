/**
 * Les objets — ce qu'une troupe porte, en plus de sa classe.
 *
 * Même moule que `aptitudes.js`, tenu à l'identique : un vocabulaire fermé
 * de clés d'effet (`EFFETS_OBJET`), lu à un seul endroit (`unites.js fiche()`),
 * et un test qui refuse toute clé non consommée. Un objet à `passif` ne fait
 * qu'ajouter une **source** de plus à un passif déjà interprété par le
 * moteur — jamais une mécanique neuve.
 *
 * **Règle dure : un objet ne porte jamais d'ordre.** Le combat plafonne à
 * trois boutons d'ordre par troupe (deux de classe, un d'unique) ; laisser un
 * objet en ajouter un quatrième referait déborder ce plafond par la petite
 * porte, à chaque fois qu'on équipe quelque chose.
 */

/** Trois emplacements, et trois rôles distincts : offensif, défensif, utilitaire. */
export const EMPLACEMENTS = ['arme', 'armure', 'accessoire']

/** Le vocabulaire des bonus chiffrés. `passif` est à part : ce n'est pas un chiffre. */
export const EFFETS_OBJET = ['pv', 'att', 'def', 'mvt', 'vue', 'portee']

const o = (id, nom, emplacement, rang, prix, bonus, passif = null) => ({
  id,
  nom,
  emplacement,
  rang,
  prix,
  bonus,
  passif,
})

export const OBJETS = [
  // --- Armes -----------------------------------------------------------------
  o('lame_courte', 'LAME COURTE', 'arme', 1, 40, { att: 2 }),
  o('arc_leger', 'ARC LÉGER', 'arme', 1, 40, { att: 1, portee: 1 }),
  o('masse_cloutee', 'MASSE CLOUTÉE', 'arme', 3, 95, { att: 3, mvt: -1 }),
  o('arc_renforce', 'ARC RENFORCÉ', 'arme', 3, 90, { att: 1, portee: 1 }),
  o('lame_longue', 'LAME LONGUE', 'arme', 5, 140, { att: 4, def: -1 }),
  o('arbalete_lourde', 'ARBALÈTE LOURDE', 'arme', 6, 165, { att: 3, portee: 1 }),
  o('hallebarde_signee', 'HALLEBARDE SIGNÉE', 'arme', 9, 260, { att: 3 }, 'charge'),
  o('lame_a_deux_mains', 'LAME À DEUX MAINS', 'arme', 11, 310, { att: 6, mvt: -1 }),

  // --- Armures ---------------------------------------------------------------
  o('cuir_bouilli', 'CUIR BOUILLI', 'armure', 1, 35, { def: 1 }),
  o('bouclier_rond', 'BOUCLIER ROND', 'armure', 1, 35, { def: 1, pv: 3 }),
  o('cotte_maille', 'COTTE DE MAILLE', 'armure', 2, 70, { def: 3, mvt: -1 }),
  o('brassards_renforces', 'BRASSARDS RENFORCÉS', 'armure', 4, 115, { def: 2, pv: 5 }),
  o('plastron_grave', 'PLASTRON GRAVÉ', 'armure', 7, 220, { def: 5, pv: 8 }, 'cuirasse'),
  o('armure_lourde', 'ARMURE LOURDE', 'armure', 10, 290, { def: 7, pv: 10, mvt: -1 }),

  // --- Accessoires -------------------------------------------------------------
  o('bottes_marche', 'BOTTES DE MARCHE', 'accessoire', 1, 30, { mvt: 1 }),
  o('gourde_cuir', 'GOURDE DE CUIR', 'accessoire', 1, 30, { pv: 4 }),
  o('longue_vue', 'LONGUE-VUE', 'accessoire', 4, 110, { vue: 2 }),
  o('talisman_chance', 'TALISMAN', 'accessoire', 5, 130, { pv: 6, def: 1 }),
  o('cor_de_ralliement', 'COR DE RALLIEMENT', 'accessoire', 8, 240, null, 'discipline'),
  o('amulette_chef', 'AMULETTE DU CHEF', 'accessoire', 10, 300, null, 'commandement'),
]

export const OBJ = Object.fromEntries(OBJETS.map((x) => [x.id, x]))

/**
 * Trois paliers d'amélioration, appliqués au bonus chiffré (jamais au passif,
 * qui reste binaire — un passif « à moitié » n'a pas de sens).
 */
export const TIERS = [
  { id: 1, court: '', mult: 1 },
  { id: 2, court: '+', mult: 1.5 },
  { id: 3, court: '++', mult: 2.1 },
]
export const TIER_MAX = TIERS.length

/** Le nom affiché, avec son suffixe de tier. */
export const nomObjet = (inst) => `${OBJ[inst.id]?.nom ?? '?'}${TIERS[(inst.tier ?? 1) - 1]?.court ?? ''}`

/** Le prix suit l'échelle du niveau, comme tout le reste de la boutique. */
export const prixObjet = (obj, niveau, echelle) => Math.round((obj.prix * echelle(niveau)) / 5) * 5

/** Le coût pour améliorer une instance d'un tier — plus cher que l'objet neuf au tier visé. */
export const prixAmelioration = (obj, tierVise, niveau, echelle) =>
  Math.round((obj.prix * TIERS[tierVise - 1].mult * 0.6 * echelle(niveau)) / 5) * 5
