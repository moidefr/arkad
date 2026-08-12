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
/**
 * Les fardeaux, décrits par un **effet** et une valeur plutôt qu'en dur.
 *
 * Écrits comme des identifiants testés un par un dans `applique()`, ils
 * étaient inertes dès qu'on en ajoutait un — et l'un des huit premiers, LATENCE
 * SYSTÈME, ne faisait rien du tout : sa ligne recopiait le tableau des
 * recharges sur lui-même.
 *
 * **Un seul fardeau par effet.** Deux fardeaux qui font la même chose avec un
 * chiffre différent ne sont pas un choix, et rien n'empêcherait d'en proposer
 * les deux moitiés dans la même offre de trois.
 */
export const FARDEAUX = [
  {
    id: 'f_pare',
    nom: 'PARE-FEU NATIF',
    dit: 'les processus commencent avec 12 de pare-feu',
    effet: 'pareProc',
    valeur: 12,
  },
  {
    id: 'f_trace',
    nom: 'SURVEILLANCE',
    dit: 'le traçage démarre à 40 à chaque combat',
    effet: 'tracageDepart',
    valeur: 40,
  },
  { id: 'f_cycles', nom: 'RATIONNEMENT', dit: 'un cycle maximum de moins', effet: 'cyclesMax', valeur: 1 },
  {
    id: 'f_soin',
    nom: 'PLAIES OUVERTES',
    dit: 'les ateliers ne rendent plus que 15 %',
    effet: 'soinReduit',
    valeur: 0.15,
  },
  { id: 'f_nombre', nom: 'NUÉE', dit: 'un processus de plus par rencontre', effet: 'nombrePlus', valeur: 1 },
  {
    id: 'f_vitesse',
    nom: 'HORLOGE FOLLE',
    dit: 'les processus ouvrent toujours le combat',
    effet: 'vitesseProc',
    valeur: 1,
  },
  {
    id: 'f_recharge',
    nom: 'LATENCE SYSTÈME',
    dit: 'toutes les recharges durent un tour de plus',
    effet: 'rechargePlus',
    valeur: 1,
  },
  {
    id: 'f_blindage',
    nom: 'DURCISSEMENT',
    dit: '+3 de blindage à tous les processus',
    effet: 'blindageProc',
    valeur: 3,
  },
  { id: 'f_debit', nom: 'DÉBIT RÉDUIT', dit: '+1 cycle par tour au lieu de +2', effet: 'cyclesTour', valeur: -1 },
  {
    id: 'f_sonde',
    nom: 'SONDE ACTIVE',
    dit: 'le traçage monte une fois et demie plus vite',
    effet: 'tracageVite',
    valeur: 1.5,
  },
  {
    id: 'f_charge',
    nom: 'MONTÉE EN CHARGE',
    dit: '+2 de puissance à tous les processus',
    effet: 'puissProc',
    valeur: 2,
  },
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

/** La valeur d'un effet parmi les fardeaux portés, ou 0. */
export const valeurDe = (fardeaux, effet) =>
  fardeaux.reduce((v, id) => (FARDEAU[id]?.effet === effet ? v + FARDEAU[id].valeur : v), 0)

/** Applique les fardeaux à un combat qui commence. */
export function applique(c, fardeaux) {
  if (!fardeaux?.length) return
  const v = (effet) => valeurDe(fardeaux, effet)

  if (v('cyclesMax')) c.cyclesMax = Math.max(4, c.cyclesMax - v('cyclesMax'))
  if (v('cyclesTour')) c.parTour = Math.max(1, Math.round(c.parTour * (1 - v('cyclesTour'))))
  if (v('tracageDepart')) c.tracage = Math.max(c.tracage, v('tracageDepart'))
  if (v('tracageVite')) c.tracageMult = 1 + v('tracageVite')

  const pare = v('pareProc')
  const blindage = v('blindageProc')
  const puiss = v('puissProc')
  const pv = v('pvProc')
  for (const p of c.proc) {
    if (pare) p.etats.pare = pare
    if (blindage) p.blindage += blindage
    if (puiss) p.puiss += puiss
    if (pv) {
      p.pvMax = Math.round(p.pvMax * (1 + pv))
      p.pv = p.pvMax
    }
    if (v('vitesseProc')) p.att = 0
  }
  // Les recharges : un tour de plus pour tout le monde, ce que l'ancienne
  // version prétendait faire en recopiant le tableau sur lui-même.
  const plus = v('rechargePlus')
  if (plus) c.rechargePlus = plus
}

export const nomDe = (id) => PROC[id]?.nom ?? id
