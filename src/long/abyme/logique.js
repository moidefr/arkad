import {
  LARGEUR,
  HAUTEUR,
  DIRS,
  VIE_DEPART,
  ATTAQUE_BASE,
  ECHO_MAX,
  PORTEE_ARC,
  PIEGE_DEGATS,
  PEAU_DURCIE_BONUS,
  ALLIE_DEGATS,
  ECHO_DEVORANT_COUT,
  ECHO_DEVORANT_SOIN,
  MONSTRES,
  APPARITION,
  RELIQUES,
  SYNERGIES,
  BASE_DEBLOQUEES,
  ORDRE_DEBLOCAGE,
  SEUIL_DEBLOCAGE,
} from './donnees.js'

/**
 * Toute la règle de l'ABYME, sans une ligne de dessin ni un seul son.
 *
 * Un étage est une grille de `LARGEUR × HAUTEUR` cases. Chaque appel à
 * `tour()` résout une action du joueur puis fait jouer les monstres, un tour
 * par un tour — jamais de temps réel, jamais de `Math.random` : le hasard
 * vient toujours du paramètre `hasard`, exactement comme dans
 * `expedition/logique.js`.
 */

export const VERSION = 1

const idx = (x, y) => y * LARGEUR + x

// --- État neuf et migration --------------------------------------------------------

/** Une descente neuve, au premier étage. `pool` fixe les reliques offrables cette partie. */
export function neuf(hasard, pool = RELIQUES.map((r) => r.id)) {
  const e = {
    v: VERSION,
    profondeur: 1,
    vie: VIE_DEPART,
    vieMax: VIE_DEPART,
    echo: 0,
    reliques: [],
    poolReliques: [...pool],
    meurtres: 0,
    embuscade: false,
    ralenti: false,
    chargesEtage: { fantome: false, bouclier: false, seuil: false, allie: false },
    offre: null,
    fin: null,
  }
  const salle = genereSalle(1, hasard)
  e.salle = salle
  e.joueur = { x: salle.depart.x, y: salle.depart.y }
  e.monstres = salle.monstres
  return e
}

const nombreSur = (v, defaut = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : defaut)
const entierSur = (v, defaut = 0) => (Number.isInteger(v) ? v : defaut)

function salleValide(s) {
  return (
    s &&
    Array.isArray(s.murs) &&
    s.murs.length === LARGEUR * HAUTEUR &&
    s.sortie &&
    Number.isInteger(s.sortie.x) &&
    Number.isInteger(s.sortie.y) &&
    s.depart &&
    Number.isInteger(s.depart.x) &&
    Number.isInteger(s.depart.y) &&
    Array.isArray(s.pieges)
  )
}

function migreMonstre(m) {
  if (!m || typeof m.type !== 'string' || !MONSTRES[m.type] || !Number.isInteger(m.x) || !Number.isInteger(m.y)) return null
  return {
    id: String(m.id ?? `${m.type}-${m.x}-${m.y}`),
    type: m.type,
    camp: m.camp === 'allie' ? 'allie' : 'ennemi',
    x: m.x,
    y: m.y,
    vie: nombreSur(m.vie, 1),
    vieMax: nombreSur(m.vieMax, nombreSur(m.vie, 1)),
    degats: Math.max(1, nombreSur(m.degats, 1)),
    etourdi: !!m.etourdi,
    tours: entierSur(m.tours, 0),
  }
}

/**
 * `null` si la sauvegarde n'est pas de ce format ou si la salle qu'elle
 * décrit est incohérente — plutôt que de rejouer une descente à moitié
 * comprise, on repart de la surface (voir `expedition/logique.js`).
 */
export function migre(brut) {
  if (!brut || brut.v !== VERSION || !salleValide(brut.salle)) return null
  return {
    v: VERSION,
    profondeur: Math.max(1, entierSur(brut.profondeur, 1)),
    vie: nombreSur(brut.vie, VIE_DEPART),
    vieMax: Math.max(1, nombreSur(brut.vieMax, VIE_DEPART)),
    echo: Math.max(0, nombreSur(brut.echo, 0)),
    reliques: Array.isArray(brut.reliques) ? brut.reliques.filter((id) => RELIQUES.some((r) => r.id === id)) : [],
    poolReliques: Array.isArray(brut.poolReliques)
      ? brut.poolReliques.filter((id) => RELIQUES.some((r) => r.id === id))
      : RELIQUES.map((r) => r.id),
    meurtres: Math.max(0, entierSur(brut.meurtres, 0)),
    embuscade: !!brut.embuscade,
    ralenti: !!brut.ralenti,
    chargesEtage: {
      fantome: !!brut.chargesEtage?.fantome,
      bouclier: !!brut.chargesEtage?.bouclier,
      seuil: !!brut.chargesEtage?.seuil,
      allie: !!brut.chargesEtage?.allie,
    },
    offre: Array.isArray(brut.offre) ? brut.offre.filter((id) => RELIQUES.some((r) => r.id === id)) : null,
    fin: brut.fin === 'mort' ? 'mort' : null,
    salle: {
      murs: brut.salle.murs.map(Boolean),
      pieges: brut.salle.pieges
        .filter((p) => p && Number.isInteger(p.x) && Number.isInteger(p.y))
        .map((p) => ({ x: p.x, y: p.y, revele: !!p.revele })),
      sortie: { x: brut.salle.sortie.x, y: brut.salle.sortie.y },
      depart: { x: brut.salle.depart.x, y: brut.salle.depart.y },
      cadavres: Array.isArray(brut.salle.cadavres)
        ? brut.salle.cadavres.filter((c) => c && Number.isInteger(c.x) && Number.isInteger(c.y)).map((c) => ({ x: c.x, y: c.y }))
        : [],
    },
    joueur: { x: entierSur(brut.joueur?.x, 1), y: entierSur(brut.joueur?.y, Math.floor(HAUTEUR / 2)) },
    monstres: Array.isArray(brut.monstres) ? brut.monstres.map(migreMonstre).filter(Boolean) : [],
  }
}

// --- Génération d'un étage ----------------------------------------------------------

function grilleVide() {
  const murs = new Array(LARGEUR * HAUTEUR).fill(false)
  for (let x = 0; x < LARGEUR; x++) {
    murs[idx(x, 0)] = true
    murs[idx(x, HAUTEUR - 1)] = true
  }
  for (let y = 0; y < HAUTEUR; y++) {
    murs[idx(0, y)] = true
    murs[idx(LARGEUR - 1, y)] = true
  }
  return murs
}

/** Le départ et la sortie sont-ils encore joignables ? Sinon, une salle sans obstacle. */
function relie(murs, a, b) {
  const vus = new Array(LARGEUR * HAUTEUR).fill(false)
  const file = [a]
  vus[idx(a.x, a.y)] = true
  while (file.length) {
    const c = file.shift()
    if (c.x === b.x && c.y === b.y) return true
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = c.x + dx
      const ny = c.y + dy
      if (nx < 0 || ny < 0 || nx >= LARGEUR || ny >= HAUTEUR) continue
      const i = idx(nx, ny)
      if (murs[i] || vus[i]) continue
      vus[i] = true
      file.push({ x: nx, y: ny })
    }
  }
  return false
}

function tireType(candidats, hasard) {
  const total = candidats.reduce((s, c) => s + c.poids, 0)
  let t = hasard() * total
  for (const c of candidats) {
    t -= c.poids
    if (t <= 0) return c.type
  }
  return candidats[candidats.length - 1].type
}

function statsMonstre(type, profondeur) {
  const b = MONSTRES[type]
  return {
    vie: Math.max(1, Math.round(b.vie + b.croissanceVie * (profondeur - 1))),
    degats: Math.max(1, Math.round(b.degats + b.croissanceDegats * (profondeur - 1))),
  }
}

/** Une case intérieure libre, à distance raisonnable du départ — pas d'embuscade au réveil. */
function celluleLibre(murs, occupees, hasard, depart) {
  for (let t = 0; t < 80; t++) {
    const x = 1 + Math.floor(hasard() * (LARGEUR - 2))
    const y = 1 + Math.floor(hasard() * (HAUTEUR - 2))
    const i = idx(x, y)
    if (murs[i] || occupees.has(i)) continue
    if (Math.abs(x - depart.x) + Math.abs(y - depart.y) < 2) continue
    return { x, y, i }
  }
  return null
}

/**
 * Un étage : quelques obstacles (jamais assez pour couper le passage — sinon
 * une salle nue, plutôt qu'une salle où l'automate d'IA, volontairement
 * simple, se perdrait), un bestiaire et des pièges qui grandissent avec la
 * profondeur.
 */
export function genereSalle(profondeur, hasard) {
  const depart = { x: 1, y: Math.floor(HAUTEUR / 2) }
  const sortie = { x: LARGEUR - 2, y: Math.floor(HAUTEUR / 2) }

  let murs = grilleVide()
  const nObstacles = Math.min(5, Math.max(0, Math.floor(profondeur / 3)))
  for (let i = 0; i < nObstacles; i++) {
    const x = 1 + Math.floor(hasard() * (LARGEUR - 2))
    const y = 1 + Math.floor(hasard() * (HAUTEUR - 2))
    if ((x === depart.x && y === depart.y) || (x === sortie.x && y === sortie.y)) continue
    murs[idx(x, y)] = true
  }
  if (!relie(murs, depart, sortie)) murs = grilleVide()

  const occupees = new Set([idx(depart.x, depart.y), idx(sortie.x, sortie.y)])

  const nMonstres = Math.min(6, Math.max(1, 1 + Math.floor((profondeur - 1) / 3)))
  const candidats = APPARITION.filter((a) => profondeur >= a.depart)
  const monstres = []
  for (let i = 0; i < nMonstres; i++) {
    const type = tireType(candidats, hasard)
    const cel = celluleLibre(murs, occupees, hasard, depart)
    if (!cel) break
    occupees.add(cel.i)
    const stats = statsMonstre(type, profondeur)
    monstres.push({
      id: `m${profondeur}-${i}`,
      type,
      camp: 'ennemi',
      x: cel.x,
      y: cel.y,
      vie: stats.vie,
      vieMax: stats.vie,
      degats: stats.degats,
      etourdi: false,
      tours: 0,
    })
  }

  const nPieges = Math.min(4, Math.max(0, Math.floor(profondeur / 3)))
  const pieges = []
  for (let i = 0; i < nPieges; i++) {
    const cel = celluleLibre(murs, occupees, hasard, depart)
    if (!cel) break
    occupees.add(cel.i)
    pieges.push({ x: cel.x, y: cel.y, revele: false })
  }

  return { murs, pieges, sortie, depart, monstres, cadavres: [] }
}

// --- Lecture de l'état ---------------------------------------------------------------

export const aRelique = (e, id) => e.reliques.includes(id)
export const aSynergie = (e, id) => {
  const s = SYNERGIES.find((x) => x.id === id)
  return !!s && s.requises.every((r) => e.reliques.includes(r))
}

const mur = (e, x, y) => x < 0 || y < 0 || x >= LARGEUR || y >= HAUTEUR || e.salle.murs[idx(x, y)]
const monstreA = (e, x, y) => e.monstres.find((m) => m.x === x && m.y === y)
const piegeA = (e, x, y) => e.salle.pieges.find((p) => p.x === x && p.y === y)
const distanceCheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

/** Les ossements ramenés d'une descente : ce qui reste quand tout le reste s'efface. */
export const ossements = (e) => e.profondeur * 3 + e.meurtres

/** Les reliques offrables, selon les ossements ramenés des descentes précédentes. */
export function reliquesDeMeta(ossementsTotal) {
  const n = Math.max(0, Math.floor(nombreSur(ossementsTotal, 0) / SEUIL_DEBLOCAGE))
  return [...BASE_DEBLOQUEES, ...ORDRE_DEBLOCAGE.slice(0, n)]
}

// --- Dégâts, le point de passage unique -----------------------------------------------

/**
 * Tout dégât reçu par le joueur passe par ici, et par nulle part ailleurs —
 * comme `extrait()` dans `usine/logique.js`. C'est ce qui garantit que
 * BOUCLIER VIVANT, SYMBIOSE et SEUIL DE LA DOULEUR s'appliquent dans le bon
 * ordre, qu'ils viennent d'un monstre ou d'un piège.
 */
function subitDegats(e, montant, ev) {
  if (!(montant > 0)) return 0
  let m = montant
  if (aRelique(e, 'bouclier-vivant') && !e.chargesEtage.bouclier) {
    m = Math.min(m, 1)
    e.chargesEtage.bouclier = true
  }
  const vieAvant = e.vie
  e.vie -= m
  if (aRelique(e, 'symbiose')) e.echo = Math.min(ECHO_MAX, e.echo + m * 2)
  ev.degatsSubis = (ev.degatsSubis ?? 0) + m
  if (e.vie <= 0 && vieAvant > 0) {
    if (aRelique(e, 'seuil-de-la-douleur') && !e.chargesEtage.seuil) {
      e.chargesEtage.seuil = true
      e.vie = 1
      ev.sauve = true
    } else {
      e.vie = 0
    }
  } else if (e.vie < 0) {
    e.vie = 0
  }
  return m
}

function tueMonstre(e, cible, ev) {
  e.monstres = e.monstres.filter((m) => m !== cible)
  e.meurtres++
  ev.tues = (ev.tues ?? 0) + 1
  ev.tueType = cible.type
  if (aRelique(e, 'charnier')) e.salle.cadavres.push({ x: cible.x, y: cible.y })
  if (aRelique(e, 'echo-du-coup')) ev.bonusAction = true
  if (cible.camp === 'ennemi' && aRelique(e, 'vestige-ami') && !e.chargesEtage.allie) {
    e.chargesEtage.allie = true
    e.monstres.push({
      id: `${cible.id}-allie`,
      type: cible.type,
      camp: 'allie',
      x: cible.x,
      y: cible.y,
      vie: 3,
      vieMax: 3,
      degats: ALLIE_DEGATS,
      etourdi: false,
      tours: 0,
    })
    ev.allieInvoque = true
  }
}

function infligeDegats(e, cible, degats, ev) {
  cible.vie -= degats
  if (cible.vie <= 0) tueMonstre(e, cible, ev)
  else if (cible.camp === 'ennemi' && aRelique(e, 'desarmeur')) cible.etourdi = true
}

// --- L'attaque du joueur --------------------------------------------------------------

function degatsJoueur(e, cible) {
  let d = ATTAQUE_BASE
  if (aRelique(e, 'coeur-de-colosse')) d += cible.type === 'colosse' ? 2 : -1
  return Math.max(1, d)
}

/** Tous les monstres alignés depuis `depart` (inclus) jusqu'au premier mur. */
function monstresEnLigne(e, depart, v) {
  const liste = [depart]
  let x = depart.x + v.dx
  let y = depart.y + v.dy
  while (!mur(e, x, y)) {
    const m = monstreA(e, x, y)
    if (m) liste.push(m)
    x += v.dx
    y += v.dy
  }
  return liste
}

function resoutPoussee(e, cible, dir, d, ev) {
  const v = DIRS[dir]
  const chaine = aSynergie(e, 'percee') ? monstresEnLigne(e, cible, v) : [cible]
  for (const m of chaine) {
    if (!e.monstres.includes(m)) continue // déjà emporté par une poussée précédente de la chaîne
    const nx = m.x + v.dx
    const ny = m.y + v.dy
    const bloque = mur(e, nx, ny) || !!monstreA(e, nx, ny)
    if (bloque) infligeDegats(e, m, d * 2, ev)
    else {
      m.x = nx
      m.y = ny
      infligeDegats(e, m, Math.max(1, Math.round(d / 2)), ev)
    }
  }
}

function joueurAttaque(e, cible, dir, ev, hasard) {
  if (cible.type === 'spectre' && !aRelique(e, 'chasse-fantome') && hasard() < MONSTRES.spectre.esquive) {
    ev.esquive = true
    return
  }
  let d = degatsJoueur(e, cible)
  if (e.embuscade) {
    d *= 2
    e.embuscade = false
    ev.embuscade = true
  }
  if (aRelique(e, 'poigne-de-fer')) return resoutPoussee(e, cible, dir, d, ev)

  infligeDegats(e, cible, d, ev)
  if (aRelique(e, 'lame-fourchue')) {
    const v = DIRS[dir]
    const derriere = monstreA(e, cible.x + v.dx, cible.y + v.dy)
    if (derriere) infligeDegats(e, derriere, d, ev)
  }
}

function ligneDeVue(e, ax, ay, bx, by) {
  const dx = Math.sign(bx - ax)
  const dy = Math.sign(by - ay)
  let x = ax + dx
  let y = ay + dy
  while (x !== bx || y !== by) {
    if (mur(e, x, y)) return false
    if (aRelique(e, 'charnier') && e.salle.cadavres.some((c) => c.x === x && c.y === y)) return false
    x += dx
    y += dy
  }
  return true
}

function chercheAligne(e, dir) {
  const v = DIRS[dir]
  for (let dist = 2; dist <= PORTEE_ARC; dist++) {
    const x = e.joueur.x + v.dx * dist
    const y = e.joueur.y + v.dy * dist
    if (mur(e, x, y)) return null
    const m = monstreA(e, x, y)
    if (m) return m
  }
  return null
}

function tireDistance(e, cible, ev, hasard) {
  if (cible.type === 'spectre' && !aRelique(e, 'chasse-fantome') && hasard() < MONSTRES.spectre.esquive) {
    ev.esquive = true
    return
  }
  let d = Math.max(1, degatsJoueur(e, cible) - 1)
  if (aSynergie(e, 'tir-du-sacrifice')) {
    d += e.echo
    e.echo = 0
    ev.sacrifice = true
  }
  if (e.embuscade) {
    d *= 2
    e.embuscade = false
    ev.embuscade = true
  }
  infligeDegats(e, cible, d, ev)
  ev.tir = true
}

// --- Les pièges ------------------------------------------------------------------------

function declenchePiege(e, piege, ev) {
  if (aRelique(e, 'pieges-mous')) {
    e.ralenti = true
    ev.ralenti = true
  } else {
    subitDegats(e, PIEGE_DEGATS, ev)
  }
  e.salle.pieges = e.salle.pieges.filter((p) => p !== piege)
  ev.piege = true
}

// --- L'intelligence des monstres --------------------------------------------------------

/** Se rapproche de `(cx, cy)` d'une case, en respectant les murs sauf si `ignoreMurs`. */
function avanceVers(e, m, cx, cy, ignoreMurs) {
  const dx = Math.sign(cx - m.x)
  const dy = Math.sign(cy - m.y)
  const essais = Math.abs(cx - m.x) >= Math.abs(cy - m.y) ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]]
  for (const [ex, ey] of essais) {
    if (!ex && !ey) continue
    const nx = m.x + ex
    const ny = m.y + ey
    if (!ignoreMurs && mur(e, nx, ny)) continue
    if (ignoreMurs && (nx < 0 || ny < 0 || nx >= LARGEUR || ny >= HAUTEUR)) continue
    if (monstreA(e, nx, ny)) continue
    if (nx === e.joueur.x && ny === e.joueur.y) continue // l'attaque passe par la branche d'à côté, pas par un pas en avant
    m.x = nx
    m.y = ny
    return true
  }
  return false
}

function chasseSimple(e, m, ev) {
  if (Math.abs(m.x - e.joueur.x) + Math.abs(m.y - e.joueur.y) === 1) {
    subitDegats(e, m.degats, ev)
    return
  }
  avanceVers(e, m, e.joueur.x, e.joueur.y, false)
}

function agitSpectre(e, m, ev) {
  if (Math.abs(m.x - e.joueur.x) + Math.abs(m.y - e.joueur.y) === 1) {
    subitDegats(e, m.degats, ev)
    return
  }
  avanceVers(e, m, e.joueur.x, e.joueur.y, true)
}

function caseFuite(e, m) {
  let meilleure = null
  let meilleureDist = -1
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nx = m.x + dx
    const ny = m.y + dy
    if (mur(e, nx, ny) || monstreA(e, nx, ny) || (nx === e.joueur.x && ny === e.joueur.y)) continue
    const d = Math.abs(nx - e.joueur.x) + Math.abs(ny - e.joueur.y)
    if (d > meilleureDist) {
      meilleureDist = d
      meilleure = { x: nx, y: ny }
    }
  }
  return meilleureDist > 1 ? meilleure : null
}

/**
 * Fuit trois fois sur quatre : une fuite garantie face à un poursuivant qui
 * revient toujours par le même axe recrée une diagonale symétrique et
 * enchaîne indéfiniment — mesuré au banc, où l'automate s'y enfermait sans
 * jamais combattre ni mourir. Une chance sur quatre de rester au corps à
 * corps suffit à casser le cycle sans dénaturer « garde ses distances ».
 */
const CHANCE_FUITE = 0.75

function agitTireur(e, m, ev, hasard) {
  const dist = Math.abs(m.x - e.joueur.x) + Math.abs(m.y - e.joueur.y)
  const aligne = m.x === e.joueur.x || m.y === e.joueur.y
  if (aligne && dist > 1 && dist <= MONSTRES.tireur.portee && ligneDeVue(e, m.x, m.y, e.joueur.x, e.joueur.y)) {
    subitDegats(e, m.degats, ev)
    ev.tirEnnemi = true
    return
  }
  if (dist === 1) {
    const loin = hasard() < CHANCE_FUITE ? caseFuite(e, m) : null
    if (loin) {
      m.x = loin.x
      m.y = loin.y
      return
    }
    subitDegats(e, m.degats, ev)
    return
  }
  avanceVers(e, m, e.joueur.x, e.joueur.y, false)
}

function agitMonstre(e, m, ev, hasard) {
  if (m.etourdi) {
    m.etourdi = false
    return
  }
  const comportement = MONSTRES[m.type].comportement
  if (comportement === 'rodeur') chasseSimple(e, m, ev)
  else if (comportement === 'spectre') agitSpectre(e, m, ev)
  else if (comportement === 'tireur') agitTireur(e, m, ev, hasard)
  else if (comportement === 'colosse') {
    m.tours++
    if (m.tours % 2 === 0) chasseSimple(e, m, ev)
  }
}

function ennemiLePlusProche(e, m) {
  let meilleur = null
  let meilleureDist = Infinity
  for (const c of e.monstres) {
    if (c.camp !== 'ennemi') continue
    const d = Math.abs(c.x - m.x) + Math.abs(c.y - m.y)
    if (d < meilleureDist) {
      meilleureDist = d
      meilleur = c
    }
  }
  return meilleur
}

function agitAllie(e, m, ev) {
  const cible = ennemiLePlusProche(e, m)
  if (!cible) return
  if (Math.abs(m.x - cible.x) + Math.abs(m.y - cible.y) === 1) {
    infligeDegats(e, cible, m.degats, ev)
    return
  }
  avanceVers(e, m, cible.x, cible.y, false)
}

// --- Le tour ---------------------------------------------------------------------------

/** Passe à l'étage suivant : nouvelle salle, charges d'étage remises à zéro. */
function descend(e, hasard) {
  e.profondeur++
  e.chargesEtage = { fantome: false, bouclier: false, seuil: false, allie: false }
  e.embuscade = false
  const salle = genereSalle(e.profondeur, hasard)
  if (aRelique(e, 'oeil-grand-ouvert')) for (const p of salle.pieges) p.revele = true
  e.salle = salle
  e.joueur = { x: salle.depart.x, y: salle.depart.y }
  e.monstres = salle.monstres
}

/** Les trois reliques offertes en fin d'étage, tirées de ce qui reste dans le pool. */
export function offreReliques(e, hasard) {
  const dispo = e.poolReliques.filter((id) => !e.reliques.includes(id))
  const n = Math.min(3, dispo.length)
  const restants = [...dispo]
  const choix = []
  for (let i = 0; i < n; i++) {
    const k = Math.floor(hasard() * restants.length)
    choix.push(restants.splice(k, 1)[0])
  }
  return choix
}

/** Choisit une relique de l'offre en cours, et fait immédiatement descendre d'un étage. */
export function choisis(e, id, hasard) {
  if (!e.offre || !e.offre.includes(id)) return false
  e.reliques.push(id)
  if (id === 'peau-durcie') {
    e.vieMax += PEAU_DURCIE_BONUS
    e.vie += PEAU_DURCIE_BONUS
  }
  e.offre = null
  descend(e, hasard)
  return true
}

/**
 * Résout un tour complet : l'action du joueur (`'haut'|'bas'|'gauche'|'droite'|'attendre'`),
 * puis les alliés, puis les ennemis — sauf si ÉCHO DU COUP vient de les court-circuiter.
 * Renvoie un évènement que l'appelant lit pour choisir sons et effets, jamais l'inverse.
 */
export function tour(e, dir, hasard) {
  const ev = {}
  if (e.fin || e.offre) return ev

  const force = e.ralenti
  if (force) {
    e.ralenti = false
    ev.ralentiJoue = true
  } else if (dir === 'attendre') {
    if (aRelique(e, 'echo-devorant') && e.echo >= ECHO_DEVORANT_COUT) {
      e.echo -= ECHO_DEVORANT_COUT
      e.vie = Math.min(e.vieMax, e.vie + ECHO_DEVORANT_SOIN)
      ev.echoDevore = true
    } else if (aRelique(e, 'sang-froid')) {
      e.vie = Math.min(e.vieMax, e.vie + 1)
      ev.repos = true
    }
  } else {
    const v = DIRS[dir]
    if (!v) return ev
    const nx = e.joueur.x + v.dx
    const ny = e.joueur.y + v.dy
    const cible = monstreA(e, nx, ny)
    if (cible) {
      joueurAttaque(e, cible, dir, ev, hasard)
    } else if (mur(e, nx, ny)) {
      if (aRelique(e, 'pas-fantome') && !e.chargesEtage.fantome) {
        e.chargesEtage.fantome = true
        const dx2 = e.joueur.x + v.dx * 2
        const dy2 = e.joueur.y + v.dy * 2
        if (!mur(e, dx2, dy2) && !monstreA(e, dx2, dy2)) {
          e.joueur.x = dx2
          e.joueur.y = dy2
        }
        ev.traverse = true
        if (aSynergie(e, 'embuscade')) e.embuscade = true
      } else {
        ev.bloque = true
        return ev // un mur qui ne cède pas ne consomme pas le tour
      }
    } else {
      const distante = aRelique(e, 'arc-improvise') ? chercheAligne(e, dir) : null
      if (distante) {
        tireDistance(e, distante, ev, hasard)
      } else {
        e.joueur.x = nx
        e.joueur.y = ny
        const piege = piegeA(e, nx, ny)
        if (piege) declenchePiege(e, piege, ev)
      }
    }
  }

  for (const p of e.salle.pieges) if (!p.revele && distanceCheb(p, e.joueur) <= 1) p.revele = true

  for (const m of [...e.monstres]) if (m.camp === 'allie' && e.monstres.includes(m)) agitAllie(e, m, ev)

  if (ev.bonusAction) ev.repit = true
  else for (const m of [...e.monstres]) if (m.camp === 'ennemi' && e.monstres.includes(m)) agitMonstre(e, m, ev, hasard)

  if (e.vie <= 0 && !e.fin) {
    e.fin = 'mort'
    ev.mort = true
    return ev
  }

  const sortie = e.salle.sortie
  if (e.joueur.x === sortie.x && e.joueur.y === sortie.y && e.monstres.every((m) => m.camp === 'allie')) {
    ev.etageFranchi = true
    const offre = offreReliques(e, hasard)
    if (offre.length) e.offre = offre
    else descend(e, hasard) // plus rien à proposer : la descente continue quand même
  }

  return ev
}
