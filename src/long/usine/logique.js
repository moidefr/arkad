import {
  MACHINES,
  AMELIORATIONS,
  RECHERCHES,
  CONTRATS,
  SEUIL_LINGOT,
  OUVRIER_COUT,
  OUVRIER_SECONDES,
  OUVRIER_PENTE,
  POSTE_PENTE,
} from './donnees.js'

/**
 * Toute la règle de l'USINE, sans une ligne de dessin ni un seul son.
 *
 * C'est cette séparation qui permet de simuler dix heures de partie en une
 * seconde dans `node --test` : sans elle, la courbe d'un incrémental ne se
 * vérifie qu'en y jouant dix heures, c'est-à-dire jamais.
 */

export const VERSION = 2

const PANNE_PERIODE = 150 // une panne toutes les deux minutes et demie en moyenne
const PANNE_MAX = 2
const AUTO_REPARE = 25
const BOOST_DUREE = 300

// --- État --------------------------------------------------------------------

export function neuve() {
  return {
    v: VERSION,
    minerai: 0,
    n: MACHINES.map(() => 0),
    ame: [],
    rech: [],
    enCours: [],
    ouvriers: 0,
    total: 0,
    lingots: 0,
    fontes: 0,
    pannes: [],
    contrats: [],
    boost: 0,
    usure: PANNE_PERIODE,
    quand: 0,
  }
}

/**
 * Les cinq machines d'origine ne sont plus aux mêmes indices, et les
 * améliorations ont changé d'identifiant. Sans cette table, ajouter une
 * machine transformait une partie en `NaN` puis en partie vide — le jeu n'avait
 * aucun numéro de version.
 */
const V1_MACHINE = [0, 1, 2, 4, 6] // PIOCHE FOREUSE CONVOYEUR FONDERIE RÉACTEUR
const V1_AME = {
  g0: 'g0a',
  m1: 'm1',
  g1: 'g1a',
  h1: 'h1',
  g2: 'g2a',
  h2: 'h2',
  g3: 'g4a',
  g4: 'g6a',
  h3: 'h3',
}

export function migre(s) {
  if (!s || typeof s !== 'object') return null
  if (s.v === VERSION) return sain(s)
  if (s.v === undefined) {
    const e = neuve()
    e.minerai = nombreSur(s.minerai)
    e.total = nombreSur(s.total)
    e.lingots = Math.floor(nombreSur(s.lingots))
    e.fontes = Math.floor(nombreSur(s.fontes))
    if (Array.isArray(s.n)) s.n.forEach((v, i) => (e.n[V1_MACHINE[i] ?? i] = Math.max(0, Math.floor(nombreSur(v)))))
    if (Array.isArray(s.ame)) e.ame = s.ame.map((id) => V1_AME[id]).filter(Boolean)
    e.quand = nombreSur(s.quand)
    return e
  }
  // Version inconnue, venue d'un futur qu'on ne sait pas lire : on préfère
  // repartir de zéro plutôt que de jouer avec un état à moitié compris.
  return null
}

/** Un état relu doit rester un état : un champ absent ne doit pas propager NaN. */
function sain(s) {
  const e = neuve()
  for (const cle of ['minerai', 'total', 'boost', 'usure', 'quand']) e[cle] = nombreSur(s[cle], e[cle])
  for (const cle of ['ouvriers', 'lingots', 'fontes']) e[cle] = Math.max(0, Math.floor(nombreSur(s[cle])))
  if (Array.isArray(s.n)) MACHINES.forEach((_, i) => (e.n[i] = Math.max(0, Math.floor(nombreSur(s.n[i])))))
  if (Array.isArray(s.ame)) e.ame = s.ame.filter((id) => AMELIORATIONS.some((a) => a.id === id))
  if (Array.isArray(s.rech)) e.rech = s.rech.filter((id) => RECHERCHES.some((r) => r.id === id))
  if (Array.isArray(s.enCours)) {
    e.enCours = s.enCours
      .filter((c) => c && RECHERCHES.some((r) => r.id === c.id))
      .map((c) => ({ id: c.id, reste: Math.max(0, nombreSur(c.reste)) }))
  }
  if (Array.isArray(s.pannes)) {
    e.pannes = s.pannes
      .filter((p) => p && p.i >= 0 && p.i < MACHINES.length)
      .map((p) => ({ i: p.i | 0, reste: nombreSur(p.reste, -1) }))
  }
  if (Array.isArray(s.contrats)) {
    e.contrats = s.contrats
      .filter((c) => c && CONTRATS[c.m])
      .map((c) => ({
        m: c.m | 0,
        cible: nombreSur(c.cible, 1),
        fait: nombreSur(c.fait),
        reste: nombreSur(c.reste, 1),
      }))
  }
  return e
}

const nombreSur = (v, defaut = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : defaut)

export const sauvegarde = (e) => ({
  v: VERSION,
  minerai: e.minerai,
  n: e.n,
  ame: e.ame,
  rech: e.rech,
  enCours: e.enCours,
  ouvriers: e.ouvriers,
  total: e.total,
  lingots: e.lingots,
  fontes: e.fontes,
  pannes: e.pannes,
  contrats: e.contrats,
  boost: e.boost,
  usure: e.usure,
  quand: Date.now(),
})

// --- Production ---------------------------------------------------------------

export const a = (e, id) => e.ame.includes(id)
export const su = (e, id) => e.rech.includes(id)

export const enPanne = (e, i) => e.pannes.some((p) => p.i === i)

export function multiplicateur(e, i) {
  return AMELIORATIONS.filter((x) => x.cible === i && a(e, x.id)).reduce((m, x) => m * x.facteur, 1)
}

/** Le multiplicateur global : améliorations, lingots, recherche, prime en cours. */
export function global(e) {
  const ame = AMELIORATIONS.filter((x) => x.global && a(e, x.id)).reduce((m, x) => m * x.global, 1)
  return ame * (1 + e.lingots * 0.25) * (su(e, 'h9') ? 3 : 1) * (e.boost > 0 ? 2 : 1)
}

/** Les postes à pourvoir : plus l'usine grandit, plus il faut de monde. */
export const postes = (e) => MACHINES.reduce((s, m, i) => s + m.postes * Math.pow(e.n[i], POSTE_PENTE), 0)

/** Ce qu'un ouvrier couvre : formation et primes rendent chacun plus utile. */
export const rendement = (e) =>
  (su(e, 'o4') ? 1.6 : 1) *
  (1 + AMELIORATIONS.filter((x) => x.ouvrier && a(e, x.id)).reduce((s, x) => s + x.ouvrier, 0))

export function couverture(e) {
  const besoin = postes(e)
  if (besoin <= 0) return 1
  return Math.min(1, (e.ouvriers * rendement(e)) / besoin)
}

/**
 * Une usine sans personne tourne quand même, au ralenti. C'est ce plancher qui
 * fait des ouvriers une dépense concurrente de l'achat de machines, et non un
 * péage : on peut toujours choisir d'acheter la machine d'abord.
 */
export const facteurOuvriers = (e) => {
  const plancher = su(e, 'o3') ? 0.55 : 0.35
  return plancher + (1 - plancher) * couverture(e)
}

/** Ce que produit une ligne, tout compris. Zéro si elle est en panne. */
export const productionMachine = (e, i) =>
  enPanne(e, i) ? 0 : MACHINES[i].prod * e.n[i] * multiplicateur(e, i) * global(e) * facteurOuvriers(e)

export const production = (e) => MACHINES.reduce((s, _, i) => s + productionMachine(e, i), 0)

/** Ce que rapporte un coup de pioche : la main reste utile, elle ne suffit jamais. */
export const mainMult = (e) => AMELIORATIONS.filter((x) => x.main && a(e, x.id)).reduce((m, x) => m * x.main, 1)
export const gainMain = (e) => (1 + production(e) * 0.04) * mainMult(e)

// --- Prix ---------------------------------------------------------------------

export const cout = (e, i) => Math.floor(MACHINES[i].cout * Math.pow(MACHINES[i].taux, e.n[i]))
export const coutOuvrier = (e) =>
  Math.floor(
    Math.max(OUVRIER_COUT, production(e) * OUVRIER_SECONDES) *
      (1 + e.ouvriers / OUVRIER_PENTE) *
      (su(e, 'o0') ? 0.7 : 1),
  )

/** Une machine apparaît quand la précédente est bien installée, ou sur recherche. */
export function machineOuverte(e, i) {
  const m = MACHINES[i]
  if (m.recherche) return su(e, m.recherche)
  return i === 0 || e.n[i - 1] >= 3 || e.n[i] > 0
}

export const machinesVisibles = (e) => MACHINES.map((_, i) => i).filter((i) => machineOuverte(e, i))

/** Les six prochaines améliorations : la liste entière découragerait. */
export function ameliorationsVisibles(e) {
  return AMELIORATIONS.filter((x) => {
    if (a(e, x.id)) return false
    if (x.cible !== undefined) return e.n[x.cible] > 0
    return true
  }).slice(0, 6)
}

export const rechercheOuverte = (e, r) => !su(e, r.id) && r.requis.every((id) => su(e, id))
export const recherchesVisibles = (e) => RECHERCHES.filter((r) => rechercheOuverte(e, r))
export const placesRecherche = (e) => (su(e, 'b0') ? 2 : 1)
export const placesContrat = (e) => (su(e, 'c1') ? 2 : su(e, 'c0') ? 1 : 0)
export const horsLigneMax = (e) => (su(e, 'r1') ? 24 : su(e, 'r0') ? 12 : 8) * 3600

// --- Achats -------------------------------------------------------------------

export function acheteMachine(e, i) {
  const prix = cout(e, i)
  if (e.minerai < prix) return false
  e.minerai -= prix
  e.n[i]++
  return true
}

export function embauche(e) {
  const prix = coutOuvrier(e)
  if (e.minerai < prix) return false
  e.minerai -= prix
  e.ouvriers++
  return true
}

export function acheteAmelioration(e, id) {
  const x = AMELIORATIONS.find((y) => y.id === id)
  if (!x || a(e, id) || e.minerai < x.cout) return false
  e.minerai -= x.cout
  e.ame.push(id)
  return true
}

export function lanceRecherche(e, id) {
  const r = RECHERCHES.find((y) => y.id === id)
  if (!r || !rechercheOuverte(e, r) || e.enCours.some((c) => c.id === id)) return false
  if (e.enCours.length >= placesRecherche(e) || e.minerai < r.cout) return false
  e.minerai -= r.cout
  e.enCours.push({ id, reste: r.duree })
  return true
}

/** Réparer : un geste, et l'atelier mécanique en fait une petite avance. */
export function repare(e, i) {
  const k = e.pannes.findIndex((p) => p.i === i)
  if (k < 0) return 0
  e.pannes.splice(k, 1)
  if (!su(e, 'p2')) return 0
  const prime = productionMachine(e, i) * 30
  e.minerai += prime
  e.total += prime
  return prime
}

// --- Refonte ------------------------------------------------------------------

/**
 * Les lingots suivent une puissance 0,22 de l'extrait.
 *
 * L'exposant est le seul réglage qui compte de tout le jeu, et il a été trouvé
 * au banc : il faut **multiplier l'extrait par 23** pour doubler ses lingots.
 * Plus haut, la partie s'emballe et tout le contenu tombe en une soirée ;
 * plus bas, refondre ne rapporte rien — c'était le défaut de la version
 * précédente, où récupérer le multiplicateur déjà acquis coûtait plus cher que
 * la dernière amélioration du jeu.
 */
const PENTE = 0.22

export const lingotsSi = (e) =>
  Math.max(0, Math.floor(Math.pow(Math.max(0, e.total) / SEUIL_LINGOT, PENTE) * (su(e, 'f0') ? 1.25 : 1)))

export const coutProchainLingot = (e) =>
  Math.pow((lingotsSi(e) + 1) / (su(e, 'f0') ? 1.25 : 1), 1 / PENTE) * SEUIL_LINGOT

export function refond(e) {
  const gain = lingotsSi(e)
  if (gain <= 0) return 0
  e.lingots += gain
  e.fontes++
  e.minerai = 0
  e.total = 0
  // Le savoir reste entier, l'équipe se disperse un peu : on démonte l'usine,
  // une partie des ouvriers va voir ailleurs. Sans cette perte, l'embauche est
  // définitivement réglée après la première refonte et cesse d'être un choix.
  e.ouvriers = Math.floor(e.ouvriers * 0.6)
  e.n = MACHINES.map((_, i) => (su(e, 'f1') && e.n[i] > 0 ? 1 : 0))
  e.ame = []
  e.pannes = []
  e.contrats = []
  e.boost = 0
  return gain
}

// --- Le temps qui passe --------------------------------------------------------

/** Une image de jeu. `hasard` vient du moteur, jamais de `Math.random`. */
export function avance(e, dt, hasard, evenements = {}) {
  const p = production(e) * dt
  e.minerai += p
  e.total += p
  e.contrats.forEach((c) => (c.fait += p))

  if (e.boost > 0) e.boost = Math.max(0, e.boost - dt)

  majPannes(e, dt, hasard, evenements)
  majRecherche(e, dt, evenements)
  majContrats(e, dt, hasard, evenements)
  return p
}

function majPannes(e, dt, hasard, ev) {
  // `reste < 0` veut dire « il faut y aller à la main ». Sinon, c'est un
  // compte à rebours de maintenance automatique.
  const gardees = []
  for (const p of e.pannes) {
    if (p.reste < 0) {
      gardees.push(p)
      continue
    }
    p.reste -= dt
    if (p.reste > 0) gardees.push(p)
    else ev.reparee?.(p.i)
  }
  e.pannes = gardees

  // On ne casse rien tant que l'usine est un tas de cailloux : la panne est un
  // évènement, pas une taxe sur les débutants.
  const lignes = MACHINES.map((_, i) => i).filter((i) => e.n[i] > 0)
  if (lignes.length < 2) return

  e.usure -= dt
  if (e.usure > 0) return
  e.usure = PANNE_PERIODE * (su(e, 'p0') ? 2 : 1) * (0.6 + hasard() * 0.8)
  if (e.pannes.length >= PANNE_MAX) return

  const libres = lignes.filter((i) => !enPanne(e, i))
  if (!libres.length) return
  const i = libres[Math.floor(hasard() * libres.length)]
  e.pannes.push({ i, reste: su(e, 'p1') ? AUTO_REPARE : -1 })
  ev.panne?.(i)
}

function majRecherche(e, dt, ev) {
  if (!e.enCours.length) return
  const restantes = []
  for (const c of e.enCours) {
    c.reste -= dt
    if (c.reste > 0) restantes.push(c)
    else {
      e.rech.push(c.id)
      ev.trouve?.(c.id)
    }
  }
  e.enCours = restantes
}

function majContrats(e, dt, hasard, ev) {
  const places = placesContrat(e)
  if (!places) {
    e.contrats = []
    return
  }

  const gardes = []
  for (const c of e.contrats) {
    c.reste -= dt
    if (c.fait >= c.cible) {
      encaisse(e, c)
      ev.contrat?.(c, true)
    } else if (c.reste <= 0) {
      ev.contrat?.(c, false)
    } else gardes.push(c)
  }
  e.contrats = gardes

  while (e.contrats.length < places) e.contrats.push(tire(e, hasard))
}

/** Un contrat se mesure en secondes de production, jamais en nombres absolus. */
export function tire(e, hasard) {
  const m = Math.floor(hasard() * CONTRATS.length)
  const modele = CONTRATS[m]
  const rythme = Math.max(1, production(e))
  return { m, cible: rythme * modele.charge, fait: 0, reste: modele.delai }
}

function encaisse(e, c) {
  const modele = CONTRATS[c.m]
  const x2 = su(e, 'c2') ? 2 : 1
  if (modele.prime === 'minerai') {
    const gain = c.cible * 1.5 * x2
    e.minerai += gain
    e.total += gain
  } else if (modele.prime === 'lingot') {
    e.lingots += (1 + Math.floor(modele.delai / 3600)) * x2
  } else {
    e.boost = Math.min(BOOST_DUREE * 2, e.boost + BOOST_DUREE * x2)
  }
}

/**
 * Le crédit d'absence. Une horloge reculée ne rapporte rien : c'était la
 * triche la plus facile du jeu, et elle marchait.
 */
export function credite(e, maintenant = Date.now()) {
  const depuis = e.quand
  e.quand = maintenant
  if (!depuis || maintenant <= depuis) return 0
  const ecoule = Math.min(horsLigneMax(e), (maintenant - depuis) / 1000)
  // Une usine sans surveillance tombe en panne et personne ne répare.
  const rendement = su(e, 'p1') ? 0.92 : 0.78
  const gagne = production(e) * ecoule * rendement
  if (gagne <= 1) return 0
  e.minerai += gagne
  e.total += gagne
  e.contrats.forEach((c) => {
    c.fait += gagne
    c.reste -= ecoule
  })
  for (const c of e.enCours) c.reste -= ecoule
  return gagne
}

// --- Affichage ------------------------------------------------------------------

/** 1.2k, 34.5M… sinon les grands nombres débordent de l'écran. */
export function nombre(v) {
  if (!Number.isFinite(v)) return '0'
  if (v < 1000) return v < 10 ? v.toFixed(1) : String(Math.floor(v))
  const suffixes = ['k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']
  let i = -1
  while (v >= 1000 && i < suffixes.length - 1) {
    v /= 1000
    i++
  }
  return v.toFixed(v < 10 ? 2 : 1) + suffixes[i]
}

/** 4 min 20, 2 h 05 : une durée doit se lire sans compter les zéros. */
export function duree(s) {
  s = Math.max(0, Math.round(s))
  if (s < 60) return `${s} s`
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`
}
