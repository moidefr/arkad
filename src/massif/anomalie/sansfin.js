import { melange32, sousGraine, pioche } from './rng.js'
import { PROCESSUS, NOYAUX, PROC } from './donnees/ennemis.js'

/**
 * Le mode INFINI, débloqué en purgeant le système.
 *
 * Un seul nombre gouverne l'escalade — la **pression** — et le joueur choisit
 * *comment* ça devient dur : tous les trois actes, un fardeau parmi trois. La
 * pression ne redescend jamais et la partie s'arrête à la mort, donc il
 * n'existe aucune boucle qui rapporte sans risque. C'est la différence de fond
 * avec ASCENSION, où l'on pouvait recommencer un rang facile indéfiniment.
 */

export const pressionDe = (acte) => Math.max(0, acte - 1)

/** Ce que la pression fait aux processus. Quatre lignes, et l'escalade est écrite. */
export function durcis(modele, p) {
  return {
    ...modele,
    pv: Math.round(modele.pv * (1 + 0.18 * p)),
    blindage: modele.blindage + Math.floor(p / 2),
    vit: modele.vit + Math.floor(p / 4),
    puiss: modele.puiss + Math.floor(p / 3),
  }
}

/**
 * Les fardeaux. Chacun rend la descente plus dure d'une façon différente, et
 * on en choisit un parmi trois : la difficulté est un choix, pas une courbe
 * qu'on subit.
 */
export const FARDEAUX = [
  { id: 'f_pare', nom: 'PARE-FEU NATIF', dit: 'les processus commencent avec 12 de pare-feu' },
  { id: 'f_trace', nom: 'SURVEILLANCE', dit: 'le traçage démarre à 40 à chaque combat' },
  { id: 'f_cycles', nom: 'RATIONNEMENT', dit: 'un cycle maximum de moins' },
  { id: 'f_soin', nom: 'PLAIES OUVERTES', dit: 'les ateliers ne rendent plus que 15 %' },
  { id: 'f_nombre', nom: 'NUÉE', dit: 'un processus de plus par rencontre' },
  { id: 'f_vitesse', nom: 'HORLOGE FOLLE', dit: 'les processus ouvrent toujours le combat' },
  { id: 'f_recharge', nom: 'LATENCE SYSTÈME', dit: 'toutes les recharges durent un tour de plus' },
  { id: 'f_blindage', nom: 'DURCISSEMENT', dit: '+3 de blindage à tous les processus' },
]

export const FARDEAU = Object.fromEntries(FARDEAUX.map((f) => [f.id, f]))

/** Trois fardeaux proposés, un à prendre. Jamais un déjà porté. */
export const offreFardeaux = (graine, acte, portes) =>
  pioche(
    melange32(sousGraine(graine, acte, 77)),
    FARDEAUX.filter((f) => !portes.includes(f.id)).map((f) => f.id),
    3,
  )

/** L'acte courant du mode infini, engendré à la volée depuis les tables. */
export function acteInfini(acte) {
  const p = pressionDe(acte)
  const bassin = PROCESSUS.filter((x) => x.acte <= Math.min(5, 1 + Math.floor(acte / 2)))
  return {
    n: acte,
    nom: `PROFONDEUR ${acte}`,
    large: [1, 3, 3, 3, 2, 1],
    bassin: bassin.map((x) => x.id),
    noyaux: [NOYAUX[(acte - 1) % NOYAUX.length].id],
    force: 2 + p,
    pression: p,
    dit: 'Plus bas. Le système ne remonte pas.',
  }
}

/** Applique les fardeaux à un combat qui commence. */
export function applique(c, fardeaux) {
  if (fardeaux.includes('f_cycles')) c.cyclesMax = Math.max(4, c.cyclesMax - 1)
  if (fardeaux.includes('f_trace')) c.tracage = Math.max(c.tracage, 40)
  for (const p of c.proc) {
    if (fardeaux.includes('f_pare')) p.etats.pare = 12
    if (fardeaux.includes('f_blindage')) p.blindage += 3
    if (fardeaux.includes('f_vitesse')) p.att = 0
  }
  if (fardeaux.includes('f_recharge')) {
    for (const u of [...c.ops, ...c.proc]) u.rech = u.rech.map((r) => r)
  }
}

export const nomDe = (id) => PROC[id]?.nom ?? id
