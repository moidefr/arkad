/**
 * Toute la règle de GRIMOIRE, sans une ligne de dessin ni un seul son.
 *
 * Un état complet (`s`) porte deux choses de nature très différente : `meta`,
 * ce qui survit à la mort (les victoires à vie, qui débloquent le pool), et
 * `run`, la partie en cours — le deck, la main, le combat. Une défaite vide
 * `run` (voir `index.js`) mais ne touche jamais `meta` : c'est ce qui fait de
 * GRIMOIRE un jeu à méta-progression plutôt qu'un « recommence à zéro »
 * comme EXPÉDITION.
 *
 * Le hasard vient toujours du moteur (`hasard()` passé en paramètre), jamais
 * de `Math.random` — sans ça, ni les tests ni le banc ne rejouent à l'identique.
 */
import {
  CARTES,
  DEPART,
  POOL,
  ADVERSAIRES,
  ENERGIE_BASE,
  MAIN_TAILLE,
  PV_DEPART,
  SOIN_VICTOIRE,
  ECHELLE_PV,
  ECHELLE_ATTAQUE,
} from './donnees.js'

export const VERSION = 1

const nombreSur = (v, defaut = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : defaut)

export const carteDe = (id) => CARTES.find((c) => c.id === id)

// --- État ------------------------------------------------------------------------

export function neuf() {
  return { v: VERSION, meta: { victoires: 0 }, run: null }
}

/**
 * `null` si la sauvegarde n'est pas de ce format — repartir à neuf plutôt que
 * deviner. Un `run` du bon format est quand même assaini champ par champ : un
 * identifiant de carte qui n'existe plus (contenu retiré) ne doit jamais
 * planter la lecture, seulement disparaître du deck.
 */
export function migre(brut) {
  if (!brut || typeof brut !== 'object' || brut.v !== VERSION) return null
  const s = neuf()
  s.meta.victoires = Math.max(0, Math.floor(nombreSur(brut.meta?.victoires)))
  s.run = saneRun(brut.run)
  return s
}

const idValide = (id) => CARTES.some((c) => c.id === id)

function saneRun(r) {
  if (!r || typeof r !== 'object') return null
  const pioche = Array.isArray(r.pioche) ? r.pioche.filter(idValide) : []
  const main = Array.isArray(r.main) ? r.main.filter(idValide) : []
  const defausse = Array.isArray(r.defausse) ? r.defausse.filter(idValide) : []
  // Un deck qui a perdu toutes ses cartes valides ne veut plus rien dire :
  // mieux vaut une partie neuve qu'un deck vide qui ne pioche jamais rien.
  if (pioche.length + main.length + defausse.length === 0) return null

  const pvMax = Math.max(1, Math.floor(nombreSur(r.pvMax, PV_DEPART)))
  const pv = Math.max(0, Math.min(pvMax, Math.floor(nombreSur(r.pv, pvMax))))
  const profondeur = Math.max(0, Math.floor(nombreSur(r.profondeur)))
  const energie = Math.max(0, Math.floor(nombreSur(r.energie, ENERGIE_BASE)))
  const phase = r.phase === 'recompense' ? 'recompense' : 'combat'

  let combat = null
  let recompense = null
  if (phase === 'recompense') {
    recompense = Array.isArray(r.recompense) ? r.recompense.filter(idValide) : []
    if (!recompense.length) return null // rien à proposer : incohérent, on repart plutôt que de bloquer
  } else {
    combat = saneCombat(r.combat)
    if (!combat) return null
  }
  return { pv, pvMax, profondeur, energie, phase, pioche, main, defausse, combat, recompense }
}

function saneCombat(c) {
  if (!c || typeof c !== 'object') return null
  const modele = ADVERSAIRES.find((a) => a.nom === c.nom)
  if (!modele) return null
  const pvMax = Math.max(1, Math.floor(nombreSur(c.pvMax, 1)))
  const n = (cle, defaut = 0) => Math.max(0, Math.floor(nombreSur(c[cle], defaut)))
  return {
    nom: c.nom,
    pattern: modele.pattern,
    tour: n('tour'),
    pv: Math.max(0, Math.min(pvMax, Math.floor(nombreSur(c.pv, pvMax)))),
    pvMax,
    attaque: Math.max(0, nombreSur(c.attaque)),
    forceJoueur: n('forceJoueur'),
    fragileJoueur: n('fragileJoueur'),
    forceEnnemi: n('forceEnnemi'),
    vulnerableEnnemi: n('vulnerableEnnemi'),
    faibleEnnemi: n('faibleEnnemi'),
    poisonEnnemi: n('poisonEnnemi'),
    bloc: n('bloc'),
    blocEnnemi: n('blocEnnemi'),
    carteJoueesTour: n('carteJoueesTour'),
  }
}

// --- Le pool -----------------------------------------------------------------

/** Les cartes proposables en récompense : jamais les cartes de départ, et
 * seulement celles débloquées par les victoires à vie. */
export const cartesDebloquees = (s) => POOL.filter((c) => c.debloqueA <= s.meta.victoires)

// --- Mélange et pioche ----------------------------------------------------------

function melange(liste, hasard) {
  const a = [...liste]
  for (let i = a.length - 1; i > 0; i--) {
    const k = Math.floor(hasard() * (i + 1))
    ;[a[i], a[k]] = [a[k], a[i]]
  }
  return a
}

/** Pioche `n` cartes ; reforme la pioche depuis la défausse si elle se vide. */
export function piocher(run, n, hasard) {
  for (let i = 0; i < n; i++) {
    if (run.pioche.length === 0) {
      if (run.defausse.length === 0) break
      run.pioche = melange(run.defausse, hasard)
      run.defausse = []
    }
    run.main.push(run.pioche.pop())
  }
}

// --- Cycle d'un combat ----------------------------------------------------------

export function demarrer(s, hasard) {
  s.run = {
    pv: PV_DEPART,
    pvMax: PV_DEPART,
    profondeur: 0,
    energie: ENERGIE_BASE,
    phase: 'combat',
    pioche: melange(DEPART, hasard),
    main: [],
    defausse: [],
    combat: null,
    recompense: null,
  }
  nouveauCombat(s, hasard)
}

function nouveauCombat(s, hasard) {
  const modele = ADVERSAIRES[Math.floor(hasard() * ADVERSAIRES.length)]
  const profondeur = s.run.profondeur
  const pv = Math.max(1, Math.round(modele.pv * (1 + profondeur * ECHELLE_PV)))
  s.run.combat = {
    nom: modele.nom,
    pattern: modele.pattern,
    tour: 0,
    pv,
    pvMax: pv,
    attaque: modele.attaque * (1 + profondeur * ECHELLE_ATTAQUE),
    forceJoueur: 0,
    fragileJoueur: 0,
    forceEnnemi: 0,
    vulnerableEnnemi: 0,
    faibleEnnemi: 0,
    poisonEnnemi: 0,
    bloc: 0,
    blocEnnemi: 0,
    carteJoueesTour: 0,
  }
  debutTourJoueur(s, hasard)
}

function debutTourJoueur(s, hasard) {
  const run = s.run
  run.energie = ENERGIE_BASE
  run.combat.bloc = 0
  run.combat.carteJoueesTour = 0
  piocher(run, MAIN_TAILLE, hasard)
}

export const estJouable = (run, carte) => run.phase === 'combat' && run.energie >= carte.cout

/** Les dégâts d'une carte, au moment présent — la force, la combo et
 * l'exécution dépendent toutes de l'état courant du combat. */
function degatsCarte(run, carte) {
  const co = run.combat
  let d = (carte.degats ?? 0) + co.forceJoueur
  if (carte.comboParCarte) d += carte.comboParCarte * co.carteJoueesTour
  if (carte.finisseur && co.pv <= co.pvMax * 0.3) d += carte.finisseurBonus
  if (co.vulnerableEnnemi > 0) d *= 1.5
  return Math.max(0, Math.round(d))
}

/** Le bloc adverse absorbe en premier ; l'excédent seul touche ses points de vie. */
function infligerEnnemi(co, brut) {
  let reste = brut
  if (co.blocEnnemi > 0) {
    const absorbe = Math.min(co.blocEnnemi, reste)
    co.blocEnnemi -= absorbe
    reste -= absorbe
  }
  co.pv -= reste
  return reste
}

function resoudreCarte(s, carte, hasard, ev) {
  const run = s.run
  const co = run.combat

  if (carte.degats !== undefined) {
    const coups = carte.fois ?? 1
    let total = 0
    for (let k = 0; k < coups && co.pv > 0; k++) total += infligerEnnemi(co, degatsCarte(run, carte))
    ev.degatsInfliges = (ev.degatsInfliges ?? 0) + total
  }
  if (carte.bloc) co.bloc += carte.bloc
  if (carte.soin) run.pv = Math.min(run.pvMax, run.pv + carte.soin)
  if (carte.recul) run.pv = Math.max(0, run.pv - carte.recul)
  if (carte.pioche) piocher(run, carte.pioche, hasard)
  if (carte.energieBonus) run.energie += carte.energieBonus
  if (carte.force) co.forceJoueur += carte.force
  if (carte.fragile) co.fragileJoueur += carte.fragile
  if (carte.vulnerable) co.vulnerableEnnemi += carte.vulnerable
  if (carte.faible) co.faibleEnnemi += carte.faible
  if (carte.poison) co.poisonEnnemi += carte.poison
}

export function jouerCarte(s, index, hasard, ev = {}) {
  const run = s.run
  if (!run || run.phase !== 'combat' || index < 0 || index >= run.main.length) {
    ev.rate = true
    return ev
  }
  const id = run.main[index]
  const carte = carteDe(id)
  if (!carte || !estJouable(run, carte)) {
    ev.rate = true
    return ev
  }

  run.main.splice(index, 1)
  run.energie -= carte.cout
  run.combat.carteJoueesTour++
  ev.carte = id

  resoudreCarte(s, carte, hasard, ev)

  run.defausse.push(id)
  if (carte.defausseMain) {
    run.defausse.push(...run.main)
    run.main = []
    ev.mainDefaussee = true
  }

  if (run.pv <= 0) return defaite(s, ev)
  if (run.combat.pv <= 0) versRecompense(s, hasard, ev)
  return ev
}

function tourEnnemi(s, hasard, ev) {
  const run = s.run
  const co = run.combat

  if (co.poisonEnnemi > 0) {
    const d = Math.min(co.pv, co.poisonEnnemi)
    co.pv -= d
    co.poisonEnnemi = Math.max(0, co.poisonEnnemi - 1)
    ev.poison = d
  }
  if (co.pv <= 0) return versRecompense(s, hasard, ev)

  co.blocEnnemi = 0 // un blocage ne dure qu'un tour joueur, il ne s'accumule pas
  const coup = co.pattern[co.tour % co.pattern.length]
  co.tour++

  if (coup.type === 'attaque') {
    let d = (co.attaque + co.forceEnnemi) * coup.mult
    if (co.faibleEnnemi > 0) d *= 0.75
    if (co.fragileJoueur > 0) d *= 1.5
    d = Math.max(0, Math.round(d - co.bloc))
    run.pv = Math.max(0, run.pv - d)
    ev.subis = d
  } else if (coup.type === 'buff') {
    co.forceEnnemi += coup.force ?? 0
    ev.buffEnnemi = true
  } else if (coup.type === 'soin') {
    co.pv = Math.min(co.pvMax, co.pv + (coup.soin ?? 0))
    ev.soinEnnemi = coup.soin
  } else if (coup.type === 'bloc') {
    co.blocEnnemi += coup.bloc ?? 0
    ev.blocEnnemi = true
  }

  co.vulnerableEnnemi = Math.max(0, co.vulnerableEnnemi - 1)
  co.faibleEnnemi = Math.max(0, co.faibleEnnemi - 1)
  co.fragileJoueur = Math.max(0, co.fragileJoueur - 1)

  if (run.pv <= 0) return defaite(s, ev)
  debutTourJoueur(s, hasard)
}

export function finirTour(s, hasard, ev = {}) {
  const run = s.run
  if (!run || run.phase !== 'combat') return ev
  run.defausse.push(...run.main)
  run.main = []
  tourEnnemi(s, hasard, ev)
  return ev
}

function defaite(s, ev) {
  ev.defaite = true
  ev.profondeur = s.run.profondeur
  return ev
}

/** Trois cartes du pool débloqué, sans doublon — moins s'il n'y en a pas assez. */
function tirerRecompense(s, hasard) {
  const bassin = cartesDebloquees(s)
  const pris = []
  for (let i = 0; i < 3 && bassin.length; i++) {
    const k = Math.floor(hasard() * bassin.length)
    pris.push(bassin.splice(k, 1)[0].id)
  }
  return pris
}

function versRecompense(s, hasard, ev) {
  const run = s.run
  // Un combat peut se gagner en plein tour, main non vidée : sans ce
  // nettoyage, le prochain `debutTourJoueur` empilerait une pioche neuve
  // par-dessus les cartes restantes plutôt que de partir d'une main vide.
  run.defausse.push(...run.main)
  run.main = []

  run.profondeur++
  s.meta.victoires++
  run.pv = Math.min(run.pvMax, run.pv + SOIN_VICTOIRE)
  run.phase = 'recompense'
  run.recompense = tirerRecompense(s, hasard)
  run.combat = null
  ev.victoire = true
  ev.profondeur = run.profondeur
}

/** `id` nul ou absent de la proposition : on n'ajoute rien, un deck lean reste
 * un choix — jamais imposé, comme le veut la règle du jeu. */
export function choisirRecompense(s, id, hasard, ev = {}) {
  const run = s.run
  if (!run || run.phase !== 'recompense') return ev
  if (id && run.recompense.includes(id)) {
    run.defausse.push(id)
    ev.ajoute = id
  } else {
    ev.ajoute = null
  }
  run.recompense = null
  run.phase = 'combat'
  nouveauCombat(s, hasard)
  return ev
}

// --- Lecture pour l'affichage ---------------------------------------------------

export const mainDe = (run) => run.main.map(carteDe)
export const tailleDeck = (run) => run.pioche.length + run.main.length + run.defausse.length
