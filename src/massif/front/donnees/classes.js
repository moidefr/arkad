/**
 * Les classes de troupe, et ce qui les fait se craindre les unes les autres.
 *
 * Six types, une table d'efficacité, et rien d'autre : aucune règle spéciale
 * n'est écrite pour une classe. Une compagnie qui n'aligne qu'un type finit
 * toujours par tomber sur son contre — sans qu'aucune règle ne l'interdise.
 */
import { C } from '../../../palette.js'

export const TYPES = [
  { id: 'INF', nom: 'INFANTERIE', court: 'INF', couleur: C.texte },
  { id: 'LEG', nom: 'TROUPE LÉGÈRE', court: 'LEG', couleur: C.vert },
  { id: 'MON', nom: 'MONTÉ', court: 'MON', couleur: C.accent },
  { id: 'TIR', nom: 'TIR', court: 'TIR', couleur: C.cyan },
  { id: 'ENG', nom: 'ENGIN', court: 'ENG', couleur: C.violet },
  { id: 'SOU', nom: 'SOUTIEN', court: 'SOU', couleur: C.faible },
]

export const TYPE = Object.fromEntries(TYPES.map((t) => [t.id, t]))

/**
 * `EFFICACITE[attaquant][cible]`. Lue une seule fois, dans la formule de
 * dégâts. Le triangle est volontairement franc : à ×1,5 contre ×0,7, choisir
 * qui frappe qui compte plus que le niveau des troupes.
 */
export const EFFICACITE = {
  INF: { INF: 1.0, LEG: 0.85, MON: 1.35, TIR: 1.15, ENG: 1.2, SOU: 1.1 },
  LEG: { INF: 1.25, LEG: 1.0, MON: 0.7, TIR: 1.2, ENG: 1.35, SOU: 1.2 },
  MON: { INF: 0.7, LEG: 1.3, MON: 1.0, TIR: 1.5, ENG: 1.5, SOU: 1.35 },
  TIR: { INF: 0.8, LEG: 1.25, MON: 1.15, TIR: 1.0, ENG: 1.1, SOU: 1.15 },
  ENG: { INF: 1.5, LEG: 0.6, MON: 0.65, TIR: 1.1, ENG: 1.3, SOU: 1.0 },
  SOU: { INF: 0.85, LEG: 0.85, MON: 0.8, TIR: 0.9, ENG: 0.9, SOU: 1.0 },
}

/**
 * Les grades. Ils ne sont pas qu'un titre : chacun porte un multiplicateur de
 * fiche **et une aura** qui déborde sur les voisins. C'est ce qui fait qu'une
 * escouade vaut plus que la somme de ses hommes — et qu'abattre le sergent
 * adverse est une manœuvre, pas un dégât de plus.
 */
export const GRADES = [
  { id: 0, nom: 'SOLDAT', court: '', pv: 1, att: 1, def: 1, aura: 0, niveau: 1 },
  { id: 1, nom: 'CAPORAL', court: '•', pv: 1.06, att: 1.05, def: 1.04, aura: 1, niveau: 3 },
  { id: 2, nom: 'SERGENT', court: '••', pv: 1.12, att: 1.1, def: 1.08, aura: 1, niveau: 6 },
  { id: 3, nom: 'LIEUTENANT', court: '▲', pv: 1.18, att: 1.16, def: 1.12, aura: 2, niveau: 10 },
  { id: 4, nom: 'CAPITAINE', court: '▲▲', pv: 1.26, att: 1.22, def: 1.18, aura: 2, niveau: 15 },
  { id: 5, nom: 'COMMANDANT', court: '★', pv: 1.34, att: 1.3, def: 1.24, aura: 3, niveau: 20 },
]

/** Un gradé générique plafonne à lieutenant : les grades supérieurs ont un nom. */
export const GRADE_MAX_GENERIQUE = 3

/** Force de l'aura, par point de grade : ce que gagne un voisin commandé. */
export const AURA = { att: 0.04, def: 0.035, moral: 4 }

const c = (id, nom, court, type, rang, pv, att, def, portee, mvt, vue, prix, apt = []) => ({
  id,
  nom,
  court,
  type,
  rang,
  pv,
  att,
  def,
  portee,
  mvt,
  vue,
  prix,
  apt,
})

/**
 * `rang` est le niveau de compagnie à partir duquel la classe apparaît à la
 * caserne. C'est le seul verrou de progression du recrutement générique : on
 * n'achète pas un cuirassier au premier engagement, quel que soit l'or.
 */
export const CLASSES = [
  // --- Infanterie -----------------------------------------------------------
  c('milicien', 'MILICIEN', 'MIL', 'INF', 1, 26, 9, 5, [1, 1], 4, 3, 40),
  c('piquier', 'PIQUIER', 'PIQ', 'INF', 1, 28, 10, 6, [1, 1], 4, 3, 55, ['traque_monte']),
  c('fantassin', 'FANTASSIN', 'FAN', 'INF', 2, 32, 11, 7, [1, 1], 4, 3, 75),
  c('hallebardier', 'HALLEBARDIER', 'HAL', 'INF', 4, 34, 13, 8, [1, 1], 4, 3, 110, ['zone_controle']),
  c('legionnaire', 'LÉGIONNAIRE', 'LEG', 'INF', 6, 38, 14, 10, [1, 1], 4, 3, 160, ['bouclier']),
  c('garde', 'GARDE', 'GAR', 'INF', 9, 44, 15, 13, [1, 1], 3, 3, 225, ['cuirasse', 'zone_controle']),
  c('grenadier', 'GRENADIER', 'GRE', 'INF', 12, 40, 18, 9, [1, 1], 4, 3, 275, ['grenade']),
  c('brise_ligne', 'BRISE-LIGNE', 'BRL', 'INF', 15, 48, 20, 12, [1, 1], 4, 3, 360, ['charge', 'brise_ligne']),

  // --- Troupes légères ------------------------------------------------------
  c('eclaireur', 'ÉCLAIREUR', 'ECL', 'LEG', 1, 22, 8, 4, [1, 1], 6, 5, 45, ['insaisissable', 'guetteur']),
  c('traqueur', 'TRAQUEUR', 'TRQ', 'LEG', 2, 24, 10, 4, [1, 2], 5, 4, 70, ['embuscade']),
  c('voltigeur', 'VOLTIGEUR', 'VLT', 'LEG', 4, 26, 12, 5, [1, 1], 6, 4, 105, ['tirailleur']),
  c('sapeur', 'SAPEUR', 'SAP', 'LEG', 5, 28, 11, 6, [1, 1], 5, 3, 125, ['pontonnier', 'mine']),
  c('rodeur', 'RÔDEUR', 'ROD', 'LEG', 8, 28, 14, 5, [1, 1], 6, 4, 190, ['embuscade', 'montagnard']),
  c('ombre', 'OMBRE', 'OMB', 'LEG', 13, 30, 18, 6, [1, 1], 7, 5, 310, ['embuscade_maitre', 'brise_ligne']),

  // --- Montés ---------------------------------------------------------------
  c('cavalier', 'CAVALIER', 'CAV', 'MON', 2, 30, 11, 6, [1, 1], 7, 4, 85, ['charge']),
  c('lancier', 'LANCIER', 'LAN', 'MON', 4, 32, 14, 7, [1, 1], 7, 4, 130, ['charge_lourde']),
  c('dragon', 'DRAGON', 'DRA', 'MON', 6, 32, 12, 8, [1, 2], 6, 4, 175, ['tirailleur']),
  c('hussard', 'HUSSARD', 'HUS', 'MON', 8, 30, 15, 6, [1, 1], 8, 5, 205, ['charge', 'insaisissable']),
  c('cuirassier', 'CUIRASSIER', 'CUI', 'MON', 11, 40, 17, 12, [1, 1], 6, 4, 285, ['charge', 'cuirasse']),
  c('chevalier', 'CHEVALIER', 'CHV', 'MON', 15, 46, 20, 14, [1, 1], 6, 4, 395, ['charge_lourde', 'zone_controle']),

  // --- Tir ------------------------------------------------------------------
  c('frondeur', 'FRONDEUR', 'FRO', 'TIR', 1, 20, 8, 3, [1, 2], 5, 4, 42),
  c('archer', 'ARCHER', 'ARC', 'TIR', 1, 22, 9, 4, [1, 3], 4, 4, 60),
  c('arbaletrier', 'ARBALÉTRIER', 'ARB', 'TIR', 3, 24, 13, 5, [1, 3], 4, 4, 100, ['perce_armure']),
  c('tirailleur', 'TIRAILLEUR', 'TRA', 'TIR', 5, 24, 11, 4, [1, 3], 5, 4, 120, ['tirailleur']),
  c('fusilier', 'FUSILIER', 'FUS', 'TIR', 8, 28, 15, 6, [1, 4], 4, 4, 200, ['perce_armure']),
  c('marqueur', 'MARQUEUR', 'MRQ', 'TIR', 11, 26, 17, 5, [2, 5], 4, 5, 265, ['sniper', 'precision']),

  // --- Engins ---------------------------------------------------------------
  c('baliste', 'BALISTE', 'BAL', 'ENG', 4, 26, 16, 5, [2, 4], 2, 3, 140, ['volee']),
  c('catapulte', 'CATAPULTE', 'CAT', 'ENG', 7, 30, 20, 6, [3, 5], 2, 3, 215, ['volee_lourde']),
  c('mortier', 'MORTIER', 'MOR', 'ENG', 10, 28, 22, 5, [3, 6], 2, 3, 280, ['barrage']),
  c('canon', 'CANON', 'CAN', 'ENG', 14, 34, 26, 8, [2, 6], 2, 3, 380, ['perce_total', 'volee']),

  // --- Soutien --------------------------------------------------------------
  c('infirmier', 'INFIRMIER', 'INF', 'SOU', 1, 22, 5, 4, [1, 1], 5, 3, 65, ['soigneur', 'soin']),
  c('porte_ordre', 'PORTE-ORDRE', 'POR', 'SOU', 3, 24, 6, 5, [1, 1], 6, 4, 105, ['commandement', 'ralliement']),
  c('ingenieur', 'INGÉNIEUR', 'ING', 'SOU', 6, 26, 8, 6, [1, 1], 4, 3, 150, ['pontonnier', 'ponton', 'retranchement']),
  c('vivandier', 'VIVANDIÈRE', 'VIV', 'SOU', 9, 26, 6, 6, [1, 1], 5, 3, 200, ['soigneur_chef', 'inspire']),
  c('tambour', 'TAMBOUR', 'TAM', 'SOU', 12, 26, 7, 6, [1, 1], 5, 3, 260, ['commandement_large', 'cri_guerre']),
]

export const CL = Object.fromEntries(CLASSES.map((x) => [x.id, x]))

/** Les classes ouvertes à la caserne pour une compagnie de ce niveau. */
export const offreCaserne = (niveau) => CLASSES.filter((x) => x.rang <= niveau)
