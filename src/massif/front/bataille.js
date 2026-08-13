/**
 * Les règles de la bataille. **Aucun dessin, aucun stockage** — ce fichier
 * tourne sous `node --test` sans navigateur, et c'est ce qui permet de le
 * mesurer sur des milliers de batailles avant d'y croire.
 *
 * Deux partis pris tiennent tout le reste :
 *
 *  1. **La résolution n'a aucun aléa.** Les dégâts qu'annonce `prevision()`
 *     sont exactement ceux qu'applique `attaque()`. Sur un téléphone, un
 *     coup dont on ne sait pas ce qu'il va faire n'est pas une décision.
 *  2. **Le tour appartient à un camp entier.** On bouge ses troupes dans
 *     l'ordre qu'on veut, puis on passe la main. Une file d'initiative
 *     entrelacée oblige à retrouver l'unité active à chaque coup ; ici, on
 *     joue au rythme du doigt.
 */
import { distance, voisins, rayon, ligne, cle, versOffset } from './hex.js'
import { terrainA, poseTerrain, OBJ } from './carte.js'
import { couvert as couvertDe, haut as hautDe } from './terrain.js'
import { EFFICACITE, GRADES, AURA } from './donnees/classes.js'
import { APT } from './donnees/aptitudes.js'
import { fiche as ficheBase, passif, fichePassif, ordres, nomComplet } from './unites.js'

/** Le moral de départ, avant auras et aptitudes. */
export const MORAL_PLEIN = 100
export const MORAL_DEPART = 72
/** Sous ce seuil la troupe est ébranlée ; à zéro elle rompt. */
export const EBRANLE = 30

export const MALUS_EBRANLE = 0.25
export const BONUS_HAUTEUR = 0.15
export const MALUS_CONTREBAS = 0.1
export const FLANC = 0.12
export const FLANC_MAX = 0.36
/** Plus la défense est haute, plus chaque point suivant rapporte peu. */
export const DURETE = 14

// --- Mise en place --------------------------------------------------------------

/**
 * Fabrique un combattant à partir d'une troupe persistante. La troupe elle
 * même n'est jamais modifiée pendant la bataille : on recopie, on se bat, et
 * `bilan()` reporte ce qui doit survivre.
 */
export function engage(u, camp, q, r) {
  const f = ficheBase(u)
  return {
    ref: u.id,
    cl: u.cl,
    uq: u.uq,
    nom: u.nom,
    ini: u.ini,
    niv: u.niv,
    grade: u.grade,
    apt: [...u.apt],
    camp,
    q,
    r,
    pv: Math.min(u.pv > 0 ? u.pv : f.pvMax, f.pvMax),
    pvMax: f.pvMax,
    moral: MORAL_DEPART,
    pm: f.mvt,
    aAgi: false,
    parcouru: 0,
    depart: { q, r, pm: f.mvt },
    etats: [],
    froids: {},
    tenaceUse: false,
    blessePar: null,
    degats: 0,
    tues: 0,
  }
}

export function commence(carte, objectif, troupes0, troupes1, options = {}) {
  const bat = {
    carte,
    objectif,
    unites: [...troupes0, ...troupes1],
    camp: 0,
    tour: 1,
    toursMax: options.toursMax ?? 20,
    fumees: [],
    pieges: [],
    tenus: [0, 0],
    perces: 0,
    journal: [],
    fini: null,
  }
  // Le moral de départ tient compte des inspirateurs présents : c'est le seul
  // effet d'avant-bataille, et il rend une vivandière visible dès le tour 1.
  for (const camp of [0, 1]) {
    const inspire = Math.max(0, ...unitesDe(bat, camp).map((u) => passif(u, 'inspire')), 0)
    for (const u of unitesDe(bat, camp)) u.moral = Math.min(MORAL_PLEIN, u.moral + inspire)
  }
  ouvreTour(bat)
  return bat
}

export const unitesDe = (bat, camp) => bat.unites.filter((u) => u.camp === camp)
export const vivantes = (bat, camp) => bat.unites.filter((u) => u.camp === camp && u.pv > 0)
export const uniteA = (bat, q, r) => bat.unites.find((u) => u.pv > 0 && u.q === q && u.r === r) ?? null
export const parRef = (bat, ref) => bat.unites.find((u) => u.ref === ref) ?? null

/** L'officier d'un camp : le plus haut gradé, le plus expérimenté à égalité. */
export function officier(bat, camp) {
  const t = vivantes(bat, camp)
  if (!t.length) return null
  return t.reduce((a, b) => (b.grade > a.grade || (b.grade === a.grade && b.niv > a.niv) ? b : a))
}

// --- La fiche en bataille ---------------------------------------------------------

const sommeEtats = (u) => {
  const b = { att: 0, def: 0, couvert: 0, mvt: 0 }
  for (const e of u.etats) {
    b.att += e.att ?? 0
    b.def += e.def ?? 0
    b.couvert += e.couvert ?? 0
    b.mvt += e.mvt ?? 0
  }
  return b
}

/**
 * L'aura de commandement du meilleur officier à portée. Elle ne s'additionne
 * pas : deux sergents côte à côte ne valent pas un commandant, sinon aligner
 * des gradés serait la seule stratégie du jeu.
 */
export function aura(bat, u) {
  let meilleur = 0
  let source = null
  for (const a of vivantes(bat, u.camp)) {
    if (a === u) continue
    const fa = ficheBase(a)
    if (fa.aura <= 0 || a.grade <= 0) continue
    if (distance(a.q, a.r, u.q, u.r) > fa.aura) continue
    if (a.grade > meilleur) {
      meilleur = a.grade
      source = a
    }
  }
  return { grade: meilleur, source, att: AURA.att * meilleur, def: AURA.def * meilleur, moral: AURA.moral * meilleur }
}

export function fiche(bat, u) {
  const f = ficheBase(u)
  const b = sommeEtats(u)
  const a = aura(bat, u)
  return {
    ...f,
    att: f.att * (1 + b.att + a.att),
    def: f.def * (1 + b.def + a.def),
    mvt: f.mvt + b.mvt,
    couvertBonus: b.couvert,
    auraGrade: a.grade,
  }
}

export const terrainSous = (bat, u) => terrainA(bat.carte, u.q, u.r) ?? { cout: 1, couvert: 0 }

/** Le couvert réel d'une unité : son terrain, plus ce que lui donnent les ordres. */
export const couvertDeUnite = (bat, u) => couvertDe(terrainSous(bat, u)) + sommeEtats(u).couvert

export const ebranle = (u) => u.moral < EBRANLE
export const enDeroute = (u) => u.moral <= 0

// --- Déplacement -------------------------------------------------------------------

/** Ce que coûte l'entrée dans un hexagone pour cette unité, `Infinity` si interdit. */
export function coutEntree(bat, u, q, r) {
  const t = terrainA(bat.carte, q, r)
  if (!t || t.bloque) return Infinity
  const occupant = uniteA(bat, q, r)
  if (occupant && occupant.camp !== u.camp) return Infinity
  let c = t.cout
  if (passif(u, 'pontonnier') && (t.id === 'riviere' || t.id === 'gue' || t.id === 'marais')) c = 1
  if (passif(u, 'montagnard')) c = Math.min(c, 1)
  return c
}

/** Un hexagone sous zone de contrôle adverse : on peut y entrer, pas en repartir. */
export function sousControle(bat, u, q, r) {
  if (passif(u, 'insaisissable')) return false
  for (const e of bat.unites) {
    if (e.pv <= 0 || e.camp === u.camp || enDeroute(e)) continue
    const portee = 1 + (passif(e, 'zoneControle') ? 1 : 0)
    if (distance(e.q, e.r, q, r) <= portee) return true
  }
  return false
}

/**
 * Tous les hexagones atteignables avec les points de mouvement restants —
 * Dijkstra, parce que les coûts vont de 0,5 (route) à 3 (rivière) et qu'un
 * parcours en largeur donnerait des chemins plus courts mais plus chers.
 */
export function accessibles(bat, u) {
  const depart = cle(u.q, u.r)
  const vus = new Map([[depart, { cout: 0, de: null, q: u.q, r: u.r }]])
  if (enDeroute(u) || u.pm <= 0) return vus
  const file = [{ q: u.q, r: u.r, cout: 0 }]
  while (file.length) {
    file.sort((a, b) => a.cout - b.cout)
    const n = file.shift()
    if (n.cout > (vus.get(cle(n.q, n.r))?.cout ?? Infinity) + 1e-9) continue
    // On n'étend pas depuis un hexagone tenu par l'adversaire : y entrer
    // consomme la fin du mouvement. C'est ce qui rend une ligne infranchissable.
    if (n.cout > 0 && sousControle(bat, u, n.q, n.r)) continue
    for (const v of voisins(n.q, n.r)) {
      const c = coutEntree(bat, u, v.q, v.r)
      if (!Number.isFinite(c)) continue
      const total = n.cout + c
      if (total > u.pm + 1e-9) continue
      const k = cle(v.q, v.r)
      if (total < (vus.get(k)?.cout ?? Infinity) - 1e-9) {
        vus.set(k, { cout: total, de: cle(n.q, n.r), q: v.q, r: v.r })
        file.push({ q: v.q, r: v.r, cout: total })
      }
    }
  }
  // Une case occupée par un allié se **traverse** mais ne s'occupe pas. On la
  // marque au lieu de la retirer : elle reste un maillon des chemins qui
  // passent par elle, et `deplace` refusera de s'y arrêter.
  for (const [k, n] of vus) {
    if (k === depart) continue
    if (uniteA(bat, n.q, n.r)) n.occupe = true
  }
  return vus
}

/** Les hexagones où l'unité peut réellement finir son mouvement. */
export function destinations(bat, u, table) {
  const vus = table ?? accessibles(bat, u)
  const t = []
  for (const [k, n] of vus) if (!n.occupe && n.cout > 0) t.push({ ...n, k })
  return t
}

export function chemin(bat, u, q, r, table) {
  const vus = table ?? accessibles(bat, u)
  const t = []
  let k = cle(q, r)
  while (k && vus.has(k)) {
    const n = vus.get(k)
    t.unshift({ q: n.q, r: n.r })
    k = n.de
  }
  return t.length > 1 ? t : []
}

/** Déplace, en payant le terrain et en déclenchant ce qui traîne au sol. */
export function deplace(bat, u, q, r) {
  if (u.aAgi && !passif(u, 'tirailleur')) return null
  const vus = accessibles(bat, u)
  const dest = vus.get(cle(q, r))
  if (!dest || dest.cout <= 0 || dest.occupe) return null
  const route = chemin(bat, u, q, r, vus)
  u.pm = Math.max(0, u.pm - dest.cout)
  u.parcouru += route.length - 1
  u.q = q
  u.r = r
  const piege = declenchePiege(bat, u)
  if (sousControle(bat, u, q, r)) u.pm = 0
  return { chemin: route, cout: dest.cout, piege }
}

/** Revenir sur ses pas — gratuit tant qu'on n'a pas agi. C'est ce qui rend le doigt sûr. */
export function annuleDeplacement(bat, u) {
  if (u.aAgi) return false
  u.q = u.depart.q
  u.r = u.depart.r
  u.pm = u.depart.pm
  u.parcouru = 0
  return true
}

function declenchePiege(bat, u) {
  const i = bat.pieges.findIndex((p) => p.q === u.q && p.r === u.r && p.camp !== u.camp)
  if (i < 0) return null
  const p = bat.pieges[i]
  bat.pieges.splice(i, 1)
  blesse(bat, u, p.degats, null)
  note(bat, `${nomComplet(u)} saute sur une mine · ${p.degats}`)
  return p.degats
}

// --- Vue ----------------------------------------------------------------------------

const fumeeSur = (bat, q, r) => bat.fumees.some((f) => f.q === q && f.r === r)

/** Ligne de vue : un obstacle opaque coupe, sauf si on le domine. */
export function voitCase(bat, u, q, r) {
  const l = ligne(u.q, u.r, q, r)
  const hu = hautDe(terrainA(bat.carte, u.q, u.r) ?? {})
  for (let i = 1; i < l.length; i++) {
    if (fumeeSur(bat, l[i].q, l[i].r)) return false
    if (i === l.length - 1) break
    const t = terrainA(bat.carte, l[i].q, l[i].r)
    if (!t) continue
    if (t.opaque && hautDe(t) >= hu) return false
  }
  return true
}

/** Les hexagones qu'un camp voit ce tour-ci. */
export function visibles(bat, camp) {
  const vus = new Set()
  for (const u of vivantes(bat, camp)) {
    const f = fiche(bat, u)
    const t = terrainA(bat.carte, u.q, u.r)
    const portee = f.vue + (t?.vue ?? 0)
    for (const h of rayon(u.q, u.r, portee)) {
      if (!terrainA(bat.carte, h.q, h.r)) continue
      const k = cle(h.q, h.r)
      if (vus.has(k)) continue
      if (voitCase(bat, u, h.q, h.r)) vus.add(k)
    }
  }
  return vus
}

/**
 * Une troupe dans un couvert furtif — une forêt — ne se voit qu'à un pas.
 * C'est ce qui donne un métier aux éclaireurs et une valeur aux bois.
 */
export function voitUnite(bat, camp, cible, vus) {
  if (cible.camp === camp) return true
  if (cible.pv <= 0) return false
  const t = terrainA(bat.carte, cible.q, cible.r)
  if (t?.furtif) return vivantes(bat, camp).some((u) => distance(u.q, u.r, cible.q, cible.r) <= 1)
  return (vus ?? visibles(bat, camp)).has(cle(cible.q, cible.r))
}

// --- Attaque -------------------------------------------------------------------------

export function porteeDe(bat, u) {
  const f = fiche(bat, u)
  const t = terrainA(bat.carte, u.q, u.r)
  return [f.portee[0], f.portee[1] + (t?.portee ?? 0)]
}

export function peutAttaquer(bat, u, cible) {
  if (u.aAgi || u.pv <= 0 || cible.pv <= 0 || cible.camp === u.camp || enDeroute(u)) return false
  const d = distance(u.q, u.r, cible.q, cible.r)
  const [min, max] = porteeDe(bat, u)
  if (d < min || d > max) return false
  return d <= 1 || voitCase(bat, u, cible.q, cible.r)
}

export function cibles(bat, u) {
  const vus = visibles(bat, u.camp)
  return bat.unites.filter((c) => peutAttaquer(bat, u, c) && voitUnite(bat, u.camp, c, vus))
}

/**
 * La formule, en un seul endroit. Elle rend le détail en plus du total : c'est
 * ce détail que l'écran affiche avant de confirmer, et c'est pour ça qu'on
 * peut jouer sans deviner.
 */
export function calcule(bat, u, cible, options = {}) {
  const fu = fiche(bat, u)
  const fc = fiche(bat, cible)
  const d = distance(u.q, u.r, cible.q, cible.r)
  const contact = d <= 1
  const detail = []

  let m = 1
  const eff = EFFICACITE[fu.type][fc.type]
  if (eff !== 1) detail.push({ nom: eff > 1 ? 'AVANTAGE' : 'MAUVAISE CIBLE', v: eff - 1 })
  m *= eff

  if (contact) {
    const ch = passif(u, 'charge') * Math.min(4, u.parcouru)
    if (ch > 0) {
      detail.push({ nom: 'CHARGE', v: ch })
      m *= 1 + ch
    }
  }
  const emb = passif(u, 'embuscade')
  if (emb > 0 && terrainA(bat.carte, u.q, u.r)?.furtif) {
    detail.push({ nom: 'EMBUSCADE', v: emb })
    m *= 1 + emb
  }
  const fan = passif(u, 'fanatique')
  if (fan > 0 && u.pv < u.pvMax * 0.4) {
    detail.push({ nom: 'FUREUR', v: fan })
    m *= 1 + fan
  }
  const ven = passif(u, 'vengeance')
  if (ven > 0 && u.blessePar === cible.ref) {
    detail.push({ nom: 'VENGEANCE', v: ven })
    m *= 1 + ven
  }
  const sni = passif(u, 'sniper')
  if (sni > 0 && d >= porteeDe(bat, u)[1] && d > 1) {
    detail.push({ nom: 'TIR TENDU', v: sni })
    m *= 1 + sni
  }
  const tq = fichePassif(u, 'traqueur')
  if (tq && tq.contre === fc.type) {
    detail.push({ nom: tq.court, v: tq.valeur })
    m *= 1 + tq.valeur
  }

  const hu = hautDe(terrainA(bat.carte, u.q, u.r) ?? {})
  const hc = hautDe(terrainA(bat.carte, cible.q, cible.r) ?? {})
  if (hu > hc) {
    detail.push({ nom: 'HAUTEUR', v: BONUS_HAUTEUR })
    m *= 1 + BONUS_HAUTEUR
  } else if (hc > hu) {
    detail.push({ nom: 'CONTREBAS', v: -MALUS_CONTREBAS })
    m *= 1 - MALUS_CONTREBAS
  }

  const flanc = Math.min(
    FLANC_MAX,
    FLANC *
      voisins(cible.q, cible.r).filter((v) => {
        const a = uniteA(bat, v.q, v.r)
        return a && a.camp === u.camp && a !== u
      }).length,
  )
  if (flanc > 0) {
    detail.push({ nom: 'PRIS À REVERS', v: flanc })
    m *= 1 + flanc
  }

  if (ebranle(u)) {
    detail.push({ nom: 'ÉBRANLÉ', v: -MALUS_EBRANLE })
    m *= 1 - MALUS_EBRANLE
  }

  const mult = options.mult ?? 1
  const brut = fu.att * m * mult

  const durete = DURETE / (DURETE + fc.def)
  const cvBrut = couvertDeUnite(bat, cible)
  const perce = options.perce ? 1 : passif(u, 'perce')
  const cv = cvBrut > 0 ? cvBrut * (1 - perce) : cvBrut
  const blindage = contact ? passif(cible, 'cuirasse') : passif(cible, 'bouclier')

  const final = Math.max(1, Math.round(brut * durete * (1 - cv) * (1 - blindage)))
  return {
    final,
    brut,
    detail,
    couvert: cv,
    blindage,
    contact,
    distance: d,
    mortelle: final >= cible.pv && !(passif(cible, 'tenace') && !cible.tenaceUse),
  }
}

/** Ce que l'écran montre avant de confirmer : le coup, et ce qui revient. */
export function prevision(bat, u, cible) {
  const coup = calcule(bat, u, cible)
  const rip = riposteDe(bat, u, cible, coup)
  return {
    ...coup,
    reste: Math.max(0, cible.pv - coup.final),
    riposte: rip ? rip.final : 0,
    resteSoi: Math.max(0, u.pv - (rip ? rip.final : 0)),
    ripostePossible: !!rip,
  }
}

function riposteDe(bat, u, cible, coup) {
  if (coup.mortelle) return null
  if (passif(u, 'sansRiposte')) return null
  if (enDeroute(cible)) return null
  const [min, max] = porteeDe(bat, cible)
  const d = coup.distance
  if (d < min || d > max) return null
  const mult = passif(cible, 'riposteFerme') ? 1 : 0.5
  return calcule(bat, cible, u, { mult })
}

/** Encaisse des dégâts. Le point de vie de secours de `tenace` est ici, et nulle part ailleurs. */
export function blesse(bat, cible, degats, source) {
  let d = degats
  if (d >= cible.pv && passif(cible, 'tenace') && !cible.tenaceUse) {
    cible.tenaceUse = true
    d = cible.pv - 1
    note(bat, `${nomComplet(cible)} tient encore debout`)
  }
  cible.pv = Math.max(0, cible.pv - d)
  if (source) cible.blessePar = source.ref
  const perte = Math.round((d / cible.pvMax) * 45 * (1 - passif(cible, 'discipline')))
  cible.moral = Math.max(0, cible.moral - perte)
  if (cible.pv <= 0) tombe(bat, cible, source)
  return d
}

function tombe(bat, cible, source) {
  note(bat, `${nomComplet(cible)} est hors de combat`)
  if (source) {
    source.tues++
    source.moral = Math.min(MORAL_PLEIN, source.moral + 8)
  }
  // La chute d'un gradé se paie sur tout ce qu'il commandait. C'est la vraie
  // raison de viser les officiers plutôt que le plus faible.
  const onde = cible.grade >= 2 ? 22 : 10
  const portee = cible.grade >= 2 ? 4 : 2
  for (const a of vivantes(bat, cible.camp)) {
    if (distance(a.q, a.r, cible.q, cible.r) > portee) continue
    a.moral = Math.max(0, a.moral - Math.round(onde * (1 - passif(a, 'discipline'))))
  }
}

export function attaque(bat, u, cible) {
  if (!peutAttaquer(bat, u, cible)) return null
  const coup = calcule(bat, u, cible)
  const rip = riposteDe(bat, u, cible, coup)

  const inflige = blesse(bat, cible, coup.final, u)
  u.degats += inflige
  const eclats = []

  const vol = passif(u, 'volee')
  if (vol > 0) {
    for (const v of voisins(cible.q, cible.r)) {
      const autre = uniteA(bat, v.q, v.r)
      if (!autre || autre.camp === u.camp) continue
      const d = Math.max(1, Math.round(coup.final * vol))
      blesse(bat, autre, d, u)
      u.degats += d
      eclats.push({ cible: autre, degats: d })
    }
  }

  let retour = 0
  if (rip && cible.pv > 0) {
    retour = blesse(bat, u, rip.final, cible)
    cible.degats += retour
  }

  note(bat, `${nomComplet(u)} → ${nomComplet(cible)} · ${inflige}${retour ? ` (riposte ${retour})` : ''}`)
  depense(bat, u, !passif(u, 'tirailleur'))
  verifieFin(bat)
  return { degats: inflige, riposte: retour, eclats, mort: cible.pv <= 0 }
}

/** Consomme l'action. `bloque` coupe aussi le mouvement restant. */
function depense(bat, u, bloque) {
  u.aAgi = true
  if (bloque) u.pm = 0
  u.depart = { q: u.q, r: u.r, pm: u.pm }
}

/** Tenir sa position : on renonce à agir, et on se retranche un peu. */
export function tient(bat, u) {
  if (u.aAgi) return false
  u.etats.push({ couvert: 0.1, duree: 1, nom: 'EN POSITION' })
  u.moral = Math.min(MORAL_PLEIN, u.moral + 6)
  depense(bat, u, true)
  return true
}

export const aFini = (u) => u.pv <= 0 || (u.aAgi && u.pm <= 0) || enDeroute(u)
export const restantes = (bat, camp) => vivantes(bat, camp).filter((u) => !aFini(u))

// --- Ordres ---------------------------------------------------------------------------

export const froidDe = (u, id) => u.froids[id] ?? 0

export function ordresJouables(bat, u) {
  if (u.aAgi || enDeroute(u)) return []
  return ordres(u).filter((a) => froidDe(u, a.id) <= 0)
}

/** Les cibles légales d'un ordre : c'est la `forme` qui décide, jamais un cas particulier. */
export function ciblesOrdre(bat, u, apt) {
  const o = apt.ordre
  const [min, max] = o.portee ?? [0, 0]
  if (o.forme === 'soi') return [{ q: u.q, r: u.r }]
  const t = []
  for (const h of rayon(u.q, u.r, max)) {
    const d = distance(u.q, u.r, h.q, h.r)
    if (d < min || !terrainA(bat.carte, h.q, h.r)) continue
    const occ = uniteA(bat, h.q, h.r)
    if (o.forme === 'allie' && (!occ || occ.camp !== u.camp || occ === u)) continue
    if (o.forme === 'ennemi' && (!occ || occ.camp === u.camp)) continue
    if (o.forme === 'hex' && d > 0 && !voitCase(bat, u, h.q, h.r)) continue
    t.push(h)
  }
  return t
}

/**
 * L'interpréteur d'ordres — le seul endroit où un effet se produit. Toute
 * aptitude active passe par ici, donc aucune ne peut être inerte sans qu'un
 * test le voie.
 */
export function lanceOrdre(bat, u, apt, cible) {
  if (u.aAgi || enDeroute(u) || froidDe(u, apt.id) > 0) return null
  const e = apt.ordre.effets
  const r = { degats: [], soignes: [], nom: apt.nom }
  const zone = e.rayon != null ? rayon(cible.q, cible.r, e.rayon) : [{ q: cible.q, r: cible.r }]

  if (e.mvt) {
    u.pm += e.mvt
    r.mvt = e.mvt
  }

  if (e.degats != null) {
    for (const h of zone) {
      const c = uniteA(bat, h.q, h.r)
      if (!c || c.camp === u.camp) continue
      const coup = calcule(bat, u, c, { mult: e.degats, perce: !!e.perce })
      const d = blesse(bat, c, coup.final, u)
      u.degats += d
      r.degats.push({ cible: c, degats: d })
      // Un ordre offensif appelle la riposte comme un coup ordinaire — c'est
      // ce qui rend une grenade lancée au contact risquée. `e.sansRiposte` est
      // exactement ce qu'on paie plus cher pour ne pas la subir.
      if (!e.sansRiposte && c.pv > 0) {
        const rip = riposteDe(bat, u, c, coup)
        if (rip) {
          const retour = blesse(bat, u, rip.final, c)
          c.degats += retour
          r.ripostes = (r.ripostes ?? 0) + retour
        }
      }
    }
  }

  if (e.soin) {
    const vise = e.cible === 'allies' ? zone : [{ q: cible.q, r: cible.r }]
    for (const h of vise) {
      const c = uniteA(bat, h.q, h.r)
      if (!c || c.camp !== u.camp) continue
      const avant = c.pv
      c.pv = Math.min(c.pvMax, c.pv + e.soin)
      r.soignes.push({ cible: c, soin: c.pv - avant })
    }
  }

  if (e.moral != null) {
    for (const c of bat.unites) {
      if (c.pv <= 0) continue
      const amis = e.cible === 'ennemis' ? c.camp !== u.camp : c.camp === u.camp
      if (!amis) continue
      if (distance(u.q, u.r, c.q, c.r) > (e.rayon ?? 0)) continue
      const v = e.moral < 0 ? Math.round(e.moral * (1 - passif(c, 'discipline'))) : e.moral
      c.moral = Math.max(0, Math.min(MORAL_PLEIN, c.moral + v))
    }
  }

  if (e.etat) {
    const vise =
      e.cible === 'allies' ? vivantes(bat, u.camp).filter((c) => distance(u.q, u.r, c.q, c.r) <= (e.rayon ?? 0)) : [u]
    for (const c of vise) c.etats.push({ ...e.etat, duree: e.duree ?? 1, nom: apt.court })
    r.touches = vise.length
  }

  if (e.fumee != null) {
    for (const h of rayon(cible.q, cible.r, e.fumee)) {
      if (terrainA(bat.carte, h.q, h.r)) bat.fumees.push({ q: h.q, r: h.r, duree: e.duree ?? 2, camp: u.camp })
    }
  }

  if (e.terrain) {
    poseTerrain(bat.carte, cible.q, cible.r, e.terrain)
    r.terrain = e.terrain
  }

  if (e.piege) bat.pieges.push({ q: cible.q, r: cible.r, camp: u.camp, degats: e.piege })

  u.froids[apt.id] = apt.ordre.froid ?? 3
  note(bat, `${nomComplet(u)} · ${apt.nom}`)
  if (e.rejoue) {
    // Un ordre qui rend l'action : on remet la troupe en état de jouer, mais
    // le refroidissement, lui, court. Sans ça, on rejouerait sans fin.
    u.aAgi = false
    u.pm = Math.max(u.pm, fiche(bat, u).mvt)
  } else depense(bat, u, e.finTour !== false)
  verifieFin(bat)
  return r
}

// --- Tours ---------------------------------------------------------------------------

/** Remet le camp qui prend la main en état de jouer. */
export function ouvreTour(bat) {
  for (const u of vivantes(bat, bat.camp)) {
    const f = fiche(bat, u)
    u.pm = f.mvt
    u.aAgi = false
    u.parcouru = 0
    u.depart = { q: u.q, r: u.r, pm: u.pm }
    for (const id of Object.keys(u.froids)) if (u.froids[id] > 0) u.froids[id]--
  }
}

/**
 * Fin du tour d'un camp : le terrain soigne, les soigneurs soignent, les
 * états s'usent, le moral remonte auprès des chefs. Puis on passe la main.
 */
export function finTour(bat) {
  if (bat.fini) return bat.fini
  const camp = bat.camp

  for (const u of vivantes(bat, camp)) {
    const t = terrainA(bat.carte, u.q, u.r)
    if (t?.soin) u.pv = Math.min(u.pvMax, u.pv + t.soin)
    const s = passif(u, 'soigneur')
    if (s > 0) {
      const blesses = voisins(u.q, u.r)
        .map((v) => uniteA(bat, v.q, v.r))
        .filter((c) => c && c.camp === camp && c.pv < c.pvMax)
      if (blesses.length) {
        const c = blesses.reduce((a, b) => (a.pv / a.pvMax <= b.pv / b.pvMax ? a : b))
        c.pv = Math.min(c.pvMax, c.pv + s)
      }
    }
    const a = aura(bat, u)
    u.moral = Math.min(MORAL_PLEIN, u.moral + 4 + a.moral)
    u.etats = u.etats.filter((e) => --e.duree > 0)
  }

  bat.fumees = bat.fumees.filter((f) => --f.duree > 0)
  compteObjectif(bat, camp)

  bat.camp = camp === 0 ? 1 : 0
  if (bat.camp === 0) {
    bat.tour++
    if (bat.tour > bat.toursMax) finDeTemps(bat)
  }
  ouvreTour(bat)
  verifieFin(bat)
  return bat.fini
}

// --- Objectifs et fin ------------------------------------------------------------------

function compteObjectif(bat, camp) {
  const o = bat.objectif
  if (o.id === 'capture') {
    const pris = (o.points ?? []).filter((p) => {
      const u = uniteA(bat, p.q, p.r)
      return u && u.camp === camp
    }).length
    const total = (o.points ?? []).length
    if (total && pris * 2 > total) bat.tenus[camp]++
    else bat.tenus[camp] = 0
  }
  if (o.id === 'percee' && camp === 0) {
    bat.perces = vivantes(bat, 0).filter((u) => versOffset(u.q, u.r).col >= bat.carte.cols - 1).length
  }
}

/**
 * Le temps écoulé n'est pas une défaite automatique : on compte les forces
 * qui restent debout et le camp le plus entier tient le terrain. Une défaite
 * sèche sur un compteur, sans qu'on comprenne pourquoi, est exactement le
 * genre de règle qu'on subit au lieu de la jouer.
 */
export function forceRestante(bat, camp) {
  return vivantes(bat, camp).reduce((s, u) => s + u.pv, 0)
}

function finDeTemps(bat) {
  if (bat.fini) return
  const o = bat.objectif
  if (o.id === 'survie') return void (bat.fini = 'gagne')
  const mienne = forceRestante(bat, 0)
  const sienne = forceRestante(bat, 1)
  bat.fini = mienne > sienne ? 'gagne' : 'perdu'
  note(bat, mienne > sienne ? 'L’ENNEMI ROMPT LE CONTACT' : 'LA COMPAGNIE DÉCROCHE')
}

export function verifieFin(bat) {
  if (bat.fini) return bat.fini
  const o = bat.objectif
  const miens = vivantes(bat, 0)
  const siens = vivantes(bat, 1)
  if (!miens.length) return (bat.fini = 'perdu')
  if (!siens.length) return (bat.fini = 'gagne')

  if (o.id === 'decapitation') {
    const chef = siens.find((u) => u.ref === o.chef)
    if (!chef) return (bat.fini = 'gagne')
    const mien = miens.find((u) => u.ref === o.chefAllie)
    if (o.chefAllie && !mien) return (bat.fini = 'perdu')
  }
  if (o.id === 'capture' && bat.tenus[0] >= (o.besoin ?? 3)) return (bat.fini = 'gagne')
  if (o.id === 'capture' && bat.tenus[1] >= (o.besoin ?? 3)) return (bat.fini = 'perdu')
  if (o.id === 'percee' && bat.perces >= (o.besoin ?? 2)) return (bat.fini = 'gagne')
  return null
}

export const fini = (bat) => bat.fini

/**
 * Décrocher.
 *
 * C'est la soupape qui rend la persistance supportable : une bataille perdue
 * jusqu'au bout coûte **toute** la troupe engagée, parce qu'à la fin plus
 * personne n'est debout. Rompre le combat au bon moment, c'est renoncer à la
 * prime pour ramener ceux qui tiennent encore. Sans ce bouton, une mauvaise
 * bataille efface vingt heures de campagne sans qu'on ait pu rien décider.
 */
export function retraite(bat) {
  if (bat.fini) return bat.fini
  note(bat, 'LA COMPAGNIE ROMPT LE COMBAT')
  return (bat.fini = 'retraite')
}

/** L'avancement de l'objectif, en clair, pour le bandeau du haut. */
export function etatObjectif(bat) {
  const o = bat.objectif
  const nom = OBJ[o.id]?.court ?? o.id
  if (o.id === 'capture') {
    const pris = (o.points ?? []).filter((p) => uniteA(bat, p.q, p.r)?.camp === 0).length
    return `${nom} ${pris}/${(o.points ?? []).length} · ${bat.tenus[0]}/${o.besoin ?? 3}`
  }
  if (o.id === 'percee') return `${nom} ${bat.perces}/${o.besoin ?? 2}`
  if (o.id === 'survie') return `${nom} ${bat.tour}/${bat.toursMax}`
  if (o.id === 'decapitation') {
    const chef = vivantes(bat, 1).find((u) => u.ref === o.chef)
    return `${nom} ${chef ? nomComplet(chef) : '—'}`
  }
  return `${nom} ${vivantes(bat, 1).length}`
}

function note(bat, ligne) {
  bat.journal.push(ligne)
  if (bat.journal.length > 24) bat.journal.shift()
}

export { note }
