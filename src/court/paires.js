import { C, ton } from '../palette.js'
import { texte, rect, bloc, cadre, pastille, lueur, trame } from '../dessin.js'

const MARGE = 8
const HAUT = 112 // sous le bandeau, au-dessus de la grille
const BAS = 46 // laisse la place à l'indice du bas

const CHRONO_DEPART = 45
const CHRONO_CAP = 90
const CHRONO_VISUEL = 40 // référence d'échelle pour la barre, pas une limite dure
const BONUS_PAIRE = 3.5
const DELAI_COMPARAISON = 0.5 // le temps de mémoriser la deuxième carte avant verdict

// Dix couleur+forme, jamais plus : au-delà, deux cartes deviendraient trop
// proches pour se distinguer d'un coup d'œil. Ça borne la vague finale à
// vingt cases (dix paires), et c'est très bien ainsi pour un format court.
const SYMB = [
  { c: C.vert, f: 'carre' },
  { c: C.vert, f: 'anneau' },
  { c: C.cyan, f: 'rond' },
  { c: C.cyan, f: 'anneauRond' },
  { c: C.violet, f: 'plus' },
  { c: C.violet, f: 'x' },
  { c: C.rouge, f: 'duo' },
  { c: C.rouge, f: 'coins' },
  { c: C.accent, f: 'carre' },
  { c: C.accent, f: 'rond' },
]

export default {
  id: 'paires',
  nom: 'PAIRES',
  pitch: 'Retourne deux cases. Si ça matche, elles restent ouvertes',
  couleur: C.violet,
  unite: 'paires',
  ciel: C.violet,
  // Pas de vies ici : un seul chrono continu qui tranche, comme CIBLES. Une
  // partie en trois vies redonnerait une grille neuve à chaque erreur, ce qui
  // n'a pas de sens pour un jeu de mémoire — la sanction doit porter sur le
  // temps, jamais sur un retour en arrière.

  init(j) {
    j.e.vague = 0
    j.e.chrono = CHRONO_DEPART
    suivante(j)
  },

  maj(j, dt) {
    j.e.chrono -= dt
    if (j.e.chrono <= 0) {
      j.son.rate()
      return j.perdu()
    }

    if (j.e.attente > 0) {
      j.e.attente -= dt
      if (j.e.attente <= 0) resout(j)
    }
  },

  dessine(j, ctx) {
    const cellules = cases(j)

    // Le chrono, en segments : le seul repère qui compte, il ne doit jamais
    // se confondre avec le reste de l'écran.
    const SEGMENTS = 24
    const part = Math.max(0, Math.min(j.e.chrono / CHRONO_VISUEL, 1))
    const pleins = Math.round(part * SEGMENTS)
    for (let i = 0; i < SEGMENTS; i++) {
      const couleur = i < pleins ? (part > 0.25 ? C.violet : C.rouge) : C.bord
      rect(ctx, 22 + i * 13, HAUT - 30, 9, 12, couleur)
    }
    ctx.textAlign = 'left'
    texte(ctx, 'CHRONO', 22, HAUT - 46, 13, C.faible, 700)
    ctx.textAlign = 'right'
    const total = (j.e.cols * j.e.rows) / 2
    texte(ctx, `VAGUE ${j.e.vague} · ${j.e.trouvees}/${total}`, j.W - 22, HAUT - 46, 13, C.faible, 700)
    ctx.textAlign = 'center'

    cellules.forEach((z, i) => {
      const etat = j.e.etat[i]
      if (etat === 'cachee') {
        bloc(ctx, z.x, z.y, z.w, z.h, C.panneau, 3)
        trame(ctx, z.x + 6, z.y + 6, z.w - 12, z.h - 12, 10, C.bord)
        return
      }
      const sym = SYMB[j.e.symboles[i]]
      const fond = etat === 'trouvee' ? ton(C.panneau, 0.12) : ton(C.panneau, 0.24)
      lueur(ctx, z.x, z.y, z.w, z.h, etat === 'trouvee' ? C.vert : C.violet, 2, etat === 'trouvee' ? 0.6 : 0.8)
      bloc(ctx, z.x, z.y, z.w, z.h, fond, 3)
      if (etat === 'trouvee') cadre(ctx, z.x, z.y, z.w, z.h, C.vert)
      dessineSymbole(ctx, z.x, z.y, z.w, z.h, sym, fond)
    })

    if (j.t < 4) texte(ctx, 'retourne deux cases, trouve la paire', j.W / 2, j.H - 18, 12, C.faible, 700)
  },

  appui(j, p) {
    // Deux cartes déjà retournées : on attend le verdict, une troisième
    // n'entre pas en jeu tant que les deux premières ne se sont pas refermées.
    if (j.e.attente > 0 || j.e.retournees.length >= 2) return
    const i = cases(j).findIndex((z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h)
    if (i === -1 || j.e.etat[i] !== 'cachee') return

    j.e.etat[i] = 'visible'
    j.e.retournees.push(i)
    j.son.clic()
    if (j.e.retournees.length === 2) j.e.attente = DELAI_COMPARAISON
  },
}

/** Dispose la grille en cases presque carrées, centrées dans leur zone. */
function cases(j) {
  const cols = j.e.cols
  const rows = j.e.rows
  const w = (j.W - MARGE * (cols + 1)) / cols
  const disponible = j.H - BAS - HAUT
  // Une carte ne dépasse jamais 1,35 fois sa largeur en hauteur : passé ce
  // ratio, la vague à quatre colonnes ferait des cases trop étroites pour
  // que le symbole s'y lise.
  const h = Math.min((disponible - MARGE * (rows + 1)) / rows, w * 1.35)
  const y0 = HAUT + Math.max(0, (disponible - (h * rows + MARGE * (rows + 1))) / 2)

  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ x: MARGE + c * (w + MARGE), y: y0 + MARGE + r * (h + MARGE), w, h })
    }
  }
  return cells
}

/**
 * La comparaison, après le délai de mémorisation. Match : les deux cases
 * restent ouvertes, comptent au score, et gagnent un peu de chrono. Sinon,
 * elles se referment — c'est tout ce que voit le joueur, l'état interne ne
 * garde jamais de trace d'un échec.
 */
function resout(j) {
  const [i1, i2] = j.e.retournees
  const memeSymbole = j.e.symboles[i1] === j.e.symboles[i2]

  if (memeSymbole) {
    j.e.etat[i1] = 'trouvee'
    j.e.etat[i2] = 'trouvee'
    j.e.trouvees++
    j.score += 1
    j.e.chrono = Math.min(CHRONO_CAP, j.e.chrono + BONUS_PAIRE)
    j.son.touche(Math.min(9, 1 + j.e.trouvees))
    const cellules = cases(j)
    for (const i of [i1, i2]) {
      const z = cellules[i]
      j.fx.eclat(z.x + z.w / 2, z.y + z.h / 2, SYMB[j.e.symboles[i]].c, { n: 10, vitesse: 120, duree: 0.35 })
    }

    const total = (j.e.cols * j.e.rows) / 2
    if (j.e.trouvees >= total) {
      // Vague finale bouclée : c'est la victoire. Le score porte déjà tout
      // ce qu'il faut dire — pas besoin d'un écran à part.
      if (j.e.finale) return j.perdu()
      suivante(j)
    }
  } else {
    j.e.etat[i1] = 'cachee'
    j.e.etat[i2] = 'cachee'
    j.son.rate()
  }

  j.e.retournees = []
}

/**
 * Pose la vague suivante : 4×4 pour ouvrir, puis une grille plus dense pour
 * la partie qui tient bon. Le chrono n'est jamais remis à zéro entre deux
 * vagues — seule la fin de partie compte.
 */
function suivante(j) {
  j.e.vague += 1
  const dims = j.e.vague === 1 ? { cols: 4, rows: 4 } : { cols: 4, rows: 5 }
  j.e.finale = j.e.vague >= 2
  j.e.cols = dims.cols
  j.e.rows = dims.rows

  const n = dims.cols * dims.rows
  const paires = n / 2
  const ids = []
  for (let k = 0; k < paires; k++) ids.push(k, k)
  melange(ids, j.hasard)

  j.e.symboles = ids
  j.e.etat = new Array(n).fill('cachee')
  j.e.retournees = []
  j.e.attente = 0
  j.e.trouvees = 0

  if (j.e.vague > 1) {
    j.fx.bulle(j.W / 2, j.H / 2 - 40, `VAGUE ${j.e.vague}`, C.violet, 20)
    j.son.niveau()
  }
}

function melange(tab, hasard) {
  for (let i = tab.length - 1; i > 0; i--) {
    const k = Math.floor(hasard() * (i + 1))
    ;[tab[i], tab[k]] = [tab[k], tab[i]]
  }
}

function dessineSymbole(ctx, x, y, w, h, sym, fond) {
  const cx = x + w / 2
  const cy = y + h / 2
  const t = Math.min(w, h) * 0.5

  if (sym.f === 'carre') bloc(ctx, cx - t / 2, cy - t / 2, t, t, sym.c, 3)
  else if (sym.f === 'anneau') cadre(ctx, cx - t / 2, cy - t / 2, t, t, sym.c, 3)
  else if (sym.f === 'rond') pastille(ctx, cx, cy, t / 2, sym.c)
  else if (sym.f === 'anneauRond') {
    pastille(ctx, cx, cy, t / 2, sym.c)
    pastille(ctx, cx, cy, t / 2 - 5, fond)
  } else if (sym.f === 'plus') {
    rect(ctx, cx - t / 2, cy - t / 6, t, t / 3, sym.c)
    rect(ctx, cx - t / 6, cy - t / 2, t / 3, t, sym.c)
  } else if (sym.f === 'x') diagonale(ctx, cx, cy, t, sym.c)
  else if (sym.f === 'duo') {
    rect(ctx, cx - t / 2, cy - t / 2, t / 2 - 2, t / 2 - 2, sym.c)
    rect(ctx, cx + 2, cy + 2, t / 2 - 2, t / 2 - 2, sym.c)
  } else if (sym.f === 'coins') coins(ctx, cx, cy, t, sym.c)
}

/** Une croix en diagonale, tracée en petits pixels plutôt qu'en trait — même
 * grammaire que le rail de CORDE : aucune ligne oblique lissée sur la borne. */
function diagonale(ctx, cx, cy, t, couleur) {
  const n = 6
  for (let k = -n; k <= n; k++) {
    const p = (k / n) * (t / 2)
    rect(ctx, cx + p - 1, cy + p - 1, 2, 2, couleur)
    rect(ctx, cx + p - 1, cy - p - 1, 2, 2, couleur)
  }
}

/** Quatre coins de viseur, pour une forme qui ne ressemble à aucune autre. */
function coins(ctx, cx, cy, t, couleur) {
  const b = t / 2
  const l = t * 0.32
  const e = 3
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      rect(ctx, cx + sx * b - (sx > 0 ? l : 0), cy + sy * b - (sy > 0 ? e : 0), l, e, couleur)
      rect(ctx, cx + sx * b - (sx > 0 ? e : 0), cy + sy * b - (sy > 0 ? l : 0), e, l, couleur)
    }
  }
}
