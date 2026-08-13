/**
 * RUÉE — les règles. Aucun dessin, aucun son, aucun stockage.
 *
 * Tout est ici pour qu'un automate puisse jouer un niveau entier sous
 * `node --test`, sans navigateur. C'est la seule façon d'affirmer qu'un niveau
 * est franchissable : dans un jeu qui s'apprend par cœur, un passage
 * impossible ne se voit pas à l'œil — il se confond avec un passage difficile,
 * et on ne l'apprend qu'en perdant la confiance du joueur.
 *
 * **Le pas est fixe.** `avance()` accumule le temps réel et appelle `pas()` par
 * tranches de 1/240 s. Un jeu de précision dont la physique dépend de la
 * cadence d'affichage n'est pas rejouable : le même appui au même endroit doit
 * donner le même saut sur un téléphone à 60 Hz et sur un écran à 120.
 */
import { RANGEES, SOL, NIVEAU_PAR_ID, PAR_ID } from './donnees.js'

export const CASE = 26
export const PAS = 1 / 240

/** Le cube est plus petit que sa case : sinon il ne passe dans aucun trou. */
export const TAILLE = 22

export const VITESSE = 286 // px/s, soit onze cases par seconde
/**
 * Le saut monte de 3,2 cases et en couvre 5,6.
 *
 * Ces deux nombres ne sont pas un réglage de confort, ils décident de ce qui
 * est dessinable : trois pics côte à côte font trois cases, plus la largeur du
 * cube, plus de quoi retomber ailleurs que dedans. Avec une gravité de 3230 —
 * le premier réglage — le saut couvrait 4,5 cases et la fenêtre d'appui pour
 * les franchir faisait **quatre pixels**, soit moins d'une image. Le banc
 * franchissait le passage, un doigt jamais. On garde donc de la marge par
 * construction, et `marge()` la mesure.
 */
export const GRAVITE = 2600
export const SAUT = 660
export const TREMPLIN = 900

// Le vaisseau : la poussée ne remplace pas la gravité, elle la dépasse. C'est
// ce qui rend le vol mou et continu au lieu de le rendre binaire.
export const GRAVITE_VOL = 1500
export const POUSSEE = 3000
export const VY_MAX_VOL = 420

/**
 * L'onde : le troisième véhicule. Elle ne subit aucune gravité — elle monte
 * ou elle descend, à quarante-cinq degrés, et rien entre les deux. C'est ce
 * qui la rend si différente du vaisseau : on ne corrige pas une trajectoire
 * d'onde, on la trace. Et elle meurt au moindre contact, y compris par le
 * dessus d'un bloc : il n'y a pas de sol pour elle.
 *
 * Sa pente est de 0,7 et non de 1. À quarante-cinq degrés pleins, tous les
 * couloirs d'onde tombaient à une image de marge dès qu'un niveau accélérait :
 * la décision se prend au soixantième, donc à 1,15× chaque décision couvre
 * quinze pour cent de distance en plus et le contrôle se dégrade d'autant.
 * Une pente plus douce redonne de la largeur là où on en a besoin, sans rien
 * changer à la sensation.
 */
export const VITESSE_ONDE = 0.7 // en multiples de la vitesse horizontale

/**
 * Assemble la grille d'un niveau : une colonne par case, chaque colonne étant
 * une chaîne de `RANGEES` lettres.
 */
export function construit(niveau) {
  const colonnes = []
  const pousse = (col) => colonnes.push(col)
  const vide = '.'.repeat(SOL) + '#'

  for (const item of niveau.suite) {
    if (typeof item === 'object' && item.repos) {
      const col = item.couvert ? '#' + '.'.repeat(SOL - 1) + '#' : vide
      for (let i = 0; i < item.repos; i++) pousse(col)
      continue
    }
    const motif = PAR_ID[item]
    if (!motif) throw new Error(`motif inconnu : ${item}`)
    for (let x = 0; x < motif.large; x++) {
      let col = ''
      for (let y = 0; y < RANGEES; y++) col += motif.cases[y][x]
      pousse(col)
    }
  }
  return colonnes
}

/** La lettre d'une case, ou du vide hors de la grille. */
export const caseA = (grille, cx, cy) => {
  if (cy < 0 || cy >= RANGEES) return '.'
  const col = grille[cx]
  return col ? col[cy] : '.'
}

/** Une partie neuve sur un niveau. `depart` sert au mode entraînement. */
export function nouvelle(niveauId, depart = 0) {
  const niveau = NIVEAU_PAR_ID[niveauId]
  if (!niveau) throw new Error(`niveau inconnu : ${niveauId}`)
  const grille = construit(niveau)
  return {
    niveau: niveauId,
    grille,
    long: grille.length,
    vitesse: niveau.vitesse ?? 1,
    x: depart * CASE,
    y: (SOL - 1) * CASE,
    vy: 0,
    mode: 'cube',
    // Le sens de la gravité : 1 vers le bas, -1 vers le haut.
    sens: 1,
    sol: true,
    mort: false,
    fini: false,
    // L'orbe qu'on touche en ce moment. Un appui la consomme ; la relâcher
    // sans appuyer ne la garde pas — sinon on pourrait la déclencher deux
    // écrans plus loin.
    orbe: null,
    orbesPrises: new Set(),
    rotation: 0,
    t: 0,
    depart,
  }
}

/** L'avancement, de 0 à 1. C'est le score du jeu, et le seul. */
export const avancement = (e) => Math.max(0, Math.min(1, e.x / (e.long * CASE)))

const cellules = (e) => {
  const g = TAILLE / 2
  return {
    x0: Math.floor((e.x - g) / CASE),
    x1: Math.floor((e.x + g - 0.001) / CASE),
    y0: Math.floor((e.y - g) / CASE),
    y1: Math.floor((e.y + g - 0.001) / CASE),
  }
}

const solide = (c) => c === '#'

/** Vrai si le carré du joueur, posé à (x, y), chevauche un bloc. */
function dansBloc(e, x, y) {
  const g = TAILLE / 2
  const cx0 = Math.floor((x - g) / CASE)
  const cx1 = Math.floor((x + g - 0.001) / CASE)
  const cy0 = Math.floor((y - g) / CASE)
  const cy1 = Math.floor((y + g - 0.001) / CASE)
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = cy0; cy <= cy1; cy++) if (solide(caseA(e.grille, cx, cy))) return true
  }
  return false
}

/**
 * Un pas de simulation. `appui` est l'état du doigt — maintenu, pas
 * l'évènement : en cube un doigt qui reste posé resaute à chaque atterrissage,
 * exactement comme dans le jeu dont celui-ci s'inspire, et c'est ce qui rend
 * les enchaînements de sauts jouables au lieu de demander un tapotement.
 */
export function pas(e, appui, dt = PAS) {
  if (e.mort || e.fini) return e

  const v = VITESSE * e.vitesse
  e.t += dt

  // --- Vertical -----------------------------------------------------------------
  //
  // Tout est multiplié par `e.sens`. Une gravité inversée n'est pas un mode de
  // plus à écrire : c'est le même code lu à l'envers, et c'est pour ça qu'elle
  // se combine avec les trois véhicules sans un seul cas particulier.
  const sens = e.sens
  if (e.mode === 'onde') {
    // Ni gravité ni inertie : la pente est celle qu'on tient.
    e.vy = (appui ? -1 : 1) * sens * VITESSE_ONDE * v
    e.sol = false
  } else if (e.mode === 'cube') {
    if (appui && e.sol) {
      e.vy = -SAUT * sens
      e.sol = false
    } else if (appui && e.orbe && !e.orbesPrises.has(e.orbe.cle)) {
      e.orbesPrises.add(e.orbe.cle)
      if (e.orbe.type === 'inverse') e.sens = -sens
      e.vy = -SAUT * e.sens
    }
    e.vy += GRAVITE * sens * dt
  } else {
    e.vy += (appui ? GRAVITE_VOL - POUSSEE : GRAVITE_VOL) * sens * dt
    e.vy = Math.max(-VY_MAX_VOL, Math.min(VY_MAX_VOL, e.vy))
  }

  const yAvant = e.y
  e.y += e.vy * dt

  // Résolution verticale : on retombe sur le dessus d'un bloc, on bute sous
  // son dessous. Le cube ne meurt pas d'un plafond — il s'y cogne.
  e.sol = false
  if (dansBloc(e, e.x, e.y)) {
    // L'onde n'a pas de sol : toucher un bloc, par n'importe quelle face, la
    // termine. C'est ce qui fait qu'un couloir d'onde se lit comme un fil et
    // pas comme une pièce où l'on peut se poser.
    if (e.mode === 'onde') return ((e.mort = true), e)
    const g = TAILLE / 2
    const descend = e.vy > 0
    if (descend) {
      const cy = Math.floor((e.y + g - 0.001) / CASE)
      e.y = cy * CASE - g
    } else {
      const cy = Math.floor((e.y - g) / CASE)
      e.y = (cy + 1) * CASE + g
    }
    // On est posé quand on s'appuie sur la surface vers laquelle on tombe —
    // le plafond fait un très bon sol quand la gravité est inversée.
    e.sol = descend === sens > 0
    e.vy = 0
    // Un bloc traversé d'un pas à l'autre alors qu'on montait vite : on
    // n'aurait pas dû passer. Sans ce garde, un vaisseau rapide franchit une
    // dalle d'une case en un pas.
    if (yAvant !== e.y && dansBloc(e, e.x, e.y)) return ((e.mort = true), e)
  }

  // --- Horizontal ---------------------------------------------------------------
  const xAvant = e.x
  e.x += v * dt
  if (dansBloc(e, e.x, e.y)) {
    // Toucher un bloc par le flanc tue. C'est la règle qui fait tout le jeu :
    // sans elle on pousse les murs au lieu de les sauter.
    e.x = xAvant
    return ((e.mort = true), e)
  }

  // --- Ce qu'on traverse ---------------------------------------------------------
  const c = cellules(e)
  e.orbe = null
  for (let cx = c.x0; cx <= c.x1; cx++) {
    for (let cy = c.y0; cy <= c.y1; cy++) {
      const q = caseA(e.grille, cx, cy)
      if (q === '^') return ((e.mort = true), e)
      if (q === 'o') e.orbe = { cle: cx + ':' + cy, type: 'saut' }
      if (q === 'b') e.orbe = { cle: cx + ':' + cy, type: 'inverse' }
      if (q === '_') {
        e.vy = -TREMPLIN * e.sens
        e.sol = false
      }
      if (q === 'S') e.mode = 'vaisseau'
      if (q === 'W') e.mode = 'onde'
      if (q === 'C') {
        e.mode = 'cube'
        // On sort d'un portail sans vitesse acquise : garder celle du vaisseau
        // ferait retomber le cube comme une pierre juste après.
        e.vy = 0
      }
      // Le portail d'inversion ne se déclenche qu'une fois : le traverser sur
      // plusieurs images le ferait basculer à chaque pas.
      if (q === 'G' && e.portail !== cx) {
        e.portail = cx
        e.sens = -e.sens
        e.sol = false
      }
      if (q === '>') e.vitesse = Math.min(2, e.vitesse * 1.3)
      if (q === '<') e.vitesse = Math.max(0.6, e.vitesse / 1.3)
    }
  }

  // Tomber hors de la grille, ou monter au-dessus : c'est fini.
  if (e.y > (RANGEES + 2) * CASE || e.y < -3 * CASE) return ((e.mort = true), e)

  // La rotation du cube n'est pas décorative : elle dit d'un coup d'œil si on
  // est en l'air, ce qu'on ne lit pas assez vite à la seule hauteur.
  if (e.mode === 'cube') e.rotation = e.sol ? Math.round(e.rotation / 90) * 90 : e.rotation + 430 * sens * dt
  else if (e.mode === 'onde') e.rotation = e.vy > 0 ? 45 : -45
  else e.rotation = Math.max(-28, Math.min(28, (e.vy / VY_MAX_VOL) * 28))

  if (e.x >= e.long * CASE) e.fini = true
  return e
}

/**
 * Avance de `dt` secondes réelles, en pas fixes. Rend le nombre de pas joués,
 * dont le dessin se sert pour ne pas interpoler dans le vide.
 */
export function avance(e, dt, appui) {
  e.reste = (e.reste ?? 0) + Math.min(dt, 0.25)
  let n = 0
  while (e.reste >= PAS && !e.mort && !e.fini) {
    pas(e, appui, PAS)
    e.reste -= PAS
    n++
  }
  if (e.mort || e.fini) e.reste = 0
  return n
}

// --- Sauvegarde -------------------------------------------------------------------

export const VERSION = 1

export const sauvegarde = (p) => ({
  v: VERSION,
  niveau: p.niveau,
  records: p.records,
  essais: p.essais,
  finis: [...p.finis],
  reperes: p.reperes,
})

export function migre(brut) {
  if (!brut || brut.v !== VERSION) return null
  return {
    niveau: brut.niveau ?? NIVEAUX_ORDRE[0],
    records: brut.records ?? {},
    essais: brut.essais ?? {},
    finis: new Set(brut.finis ?? []),
    reperes: brut.reperes ?? {},
  }
}

export const NIVEAUX_ORDRE = Object.keys(NIVEAU_PAR_ID)

/** La progression neuve : rien de fini, rien tenté. */
export const progressionNeuve = () => ({
  niveau: NIVEAUX_ORDRE[0],
  records: {},
  essais: {},
  finis: new Set(),
  reperes: {},
})

/**
 * Un niveau est ouvert si c'est le premier, ou si le précédent est fini. On ne
 * verrouille pas pour faire durer : on verrouille pour que les mécaniques
 * arrivent une par une, comme le jeu les enseigne.
 */
export const ouvert = (p, id) => {
  const i = NIVEAUX_ORDRE.indexOf(id)
  return i === 0 || p.finis.has(NIVEAUX_ORDRE[i - 1])
}
