import { C, ton } from '../palette.js'
import { texte, rect, cadre, bloc, lueur, pastille, dist } from '../dessin.js'

/**
 * Le calcul pur : générer un code et juger une tentative, sans un pixel.
 * C'est ce qui permet d'éprouver l'algorithme classique en deux passes
 * (bien placés, puis mal placés sans compter deux fois le même pion) sous
 * `node --test`, sans canvas ni moteur.
 */
const N = 4
const COULEURS = [C.vert, C.cyan, C.violet, C.rouge, C.accent]

export function genereSecret(hasard = Math.random, n = N, k = COULEURS.length) {
  return Array.from({ length: n }, () => Math.floor(hasard() * k))
}

/**
 * Le décompte classique du mastermind : d'abord les pions bien placés, puis,
 * sur ce qui reste des deux côtés, les pions de la bonne couleur mais mal
 * placés — chaque pion du secret ne peut servir qu'une fois à ce second
 * passage, sinon une couleur en triple dans la tentative compterait trois
 * fois pour un seul pion du secret.
 */
export function feedback(secret, essai) {
  const secRestants = []
  const essRestants = []
  let bien = 0
  for (let i = 0; i < secret.length; i++) {
    if (essai[i] === secret[i]) bien++
    else {
      secRestants.push(secret[i])
      essRestants.push(essai[i])
    }
  }
  const compte = new Map()
  for (const c of secRestants) compte.set(c, (compte.get(c) ?? 0) + 1)
  let mal = 0
  for (const c of essRestants) {
    const reste = compte.get(c) ?? 0
    if (reste > 0) {
      mal++
      compte.set(c, reste - 1)
    }
  }
  return { bien, mal }
}

// --- Jeu -------------------------------------------------------------------

// Une série grandit la difficulté en resserrant les tentatives, jamais en
// changeant les règles : dix essais pour la première série, six au plancher —
// en dessous, le hasard prendrait le pas sur la déduction.
const TENTATIVES_DEPART = 10
const TENTATIVES_PAS = 1
const TENTATIVES_MIN = 6

const Y0 = 96 // sous la ligne d'info, haut du plateau
const ZONE_BAS = 150 // palette + bouton + indice, réservés en bas d'écran

const X_PEG0 = 44
const ESP_PEG = 36
const FB_X = 210 // les quatre pastilles d'indice, en carré, à droite des pions
const FB_S = 9
const FB_GAP = 4
const PALETTE_R = 20
const VALIDER_W = 160
const VALIDER_H = 34

export default {
  id: 'code',
  nom: 'CODE',
  pitch: 'Compose quatre couleurs, affine avec les indices, perce le code secret',
  couleur: C.accent,
  unite: 'pts',

  finTitre: (j) => ({ texte: `CODE ÉPUISÉ · SÉRIE ${j.e.serie}`, couleur: C.rouge }),

  init(j) {
    j.e.serie = 1
    j.e.fanfare = 0
    poseSerie(j)
  },

  maj(j, dt) {
    j.e.fanfare = Math.max(0, j.e.fanfare - dt)
  },

  dessine(j, ctx) {
    const d = dispo(j)

    ctx.textAlign = 'left'
    texte(ctx, `SÉRIE ${j.e.serie}`, 14, 74, 16, C.accent, 700)
    ctx.textAlign = 'right'
    texte(ctx, `${j.e.essais.length}/${j.e.tentatives}`, j.W - 14, 74, 14, C.faible, 700)
    ctx.textAlign = 'center'

    const rayon = Math.max(8, Math.min(15, d.rowH / 2 - 8))

    for (let r = 0; r < j.e.tentatives; r++) {
      const y = d.y0 + r * d.rowH
      const cy = y + d.rowH / 2
      const essai = j.e.essais[r]
      const courante = r === j.e.essais.length

      if (courante) cadre(ctx, 6, y + 2, j.W - 12, d.rowH - 4, C.accent, 2)

      ctx.textAlign = 'left'
      texte(ctx, `${r + 1}`, 16, cy, 12, C.faible, 700)
      ctx.textAlign = 'center'

      for (let i = 0; i < N; i++) {
        const x = X_PEG0 + i * ESP_PEG
        const idx = essai ? essai.code[i] : courante && i < j.e.courant.length ? j.e.courant[i] : null
        pastille(ctx, x, cy, rayon, idx === null ? ton(C.panneau, 0.3) : COULEURS[idx])
      }

      // Les indices, en petit carré 2×2 : un pion clair par bon emplacement,
      // un pion sombre par bonne couleur égarée — jamais mélangés au fil du
      // décompte, pour ne pas laisser croire qu'une position est connue.
      if (essai) {
        for (let k = 0; k < N; k++) {
          const couleur = k < essai.bien ? C.texte : k < essai.bien + essai.mal ? C.faible : ton(C.panneau, 0.22)
          const col = k % 2
          const lig = Math.floor(k / 2)
          rect(ctx, FB_X + col * (FB_S + FB_GAP), cy - FB_S - FB_GAP / 2 + lig * (FB_S + FB_GAP), FB_S, FB_S, couleur)
        }
      }
    }

    // La palette : cinq couleurs, jamais plus — au-delà, deux pastilles
    // deviendraient trop proches pour se distinguer d'un coup d'œil au doigt.
    const marge = 40
    const pas = (j.W - marge * 2) / (COULEURS.length - 1)
    for (let i = 0; i < COULEURS.length; i++) {
      const x = marge + i * pas
      lueur(ctx, x - PALETTE_R, d.paletteY - PALETTE_R, PALETTE_R * 2, PALETTE_R * 2, COULEURS[i], 2, 0.5)
      pastille(ctx, x, d.paletteY, PALETTE_R, COULEURS[i])
    }

    const complet = j.e.courant.length === N
    bloc(ctx, d.valider.x, d.valider.y, d.valider.w, d.valider.h, complet ? C.accent : ton(C.panneau, 0.24), 3)
    texte(
      ctx,
      'VALIDER',
      d.valider.x + d.valider.w / 2,
      d.valider.y + d.valider.h / 2,
      15,
      complet ? C.fond : C.faible,
      700,
    )

    const indice = complet ? 'appuie sur VALIDER' : 'touche une couleur pour composer'
    texte(ctx, indice, j.W / 2, d.hintY, 12, C.faible, 700)

    if (j.e.fanfare > 0) {
      ctx.globalAlpha = Math.min(0.8, j.e.fanfare)
      rect(ctx, 0, 0, j.W, j.H, C.fond)
      ctx.globalAlpha = 1
      texte(ctx, `CODE TROUVÉ · SÉRIE ${j.e.serie - 1}`, j.W / 2, j.H / 2 - 16, 22, C.accent, 700)
      texte(ctx, `${j.e.tentatives} tentatives maintenant`, j.W / 2, j.H / 2 + 18, 15, C.texte, 700)
    }
  },

  appui(j, p) {
    if (j.e.fanfare > 0) return

    const ic = indexPalette(j, p)
    if (ic !== null) {
      if (j.e.courant.length < N) {
        j.e.courant.push(ic)
        j.son.clic()
      }
      return
    }

    if (dansValider(j, p)) {
      if (j.e.courant.length === N) valide(j)
      return
    }

    const ip = indexPegCourant(j, p)
    if (ip !== null && ip < j.e.courant.length) {
      j.e.courant.splice(ip, 1)
      j.son.rebond()
    }
  },
}

/**
 * La disposition du plateau, calculée une seule fois par image et par appui —
 * c'est elle qui garantit que le bouton dessiné et le bouton touché sont
 * exactement le même rectangle.
 */
function dispo(j) {
  const bas = j.H - ZONE_BAS
  const rowH = Math.max(26, Math.floor((bas - Y0) / j.e.tentatives))
  return {
    y0: Y0,
    bas,
    rowH,
    paletteY: bas + 40,
    valider: { x: j.W / 2 - VALIDER_W / 2, y: bas + 76, w: VALIDER_W, h: VALIDER_H },
    hintY: bas + 132,
  }
}

function indexPalette(j, p) {
  const d = dispo(j)
  const marge = 40
  const pas = (j.W - marge * 2) / (COULEURS.length - 1)
  for (let i = 0; i < COULEURS.length; i++) {
    const x = marge + i * pas
    if (dist(p.x, p.y, x, d.paletteY) <= PALETTE_R + 8) return i
  }
  return null
}

function dansValider(j, p) {
  const b = dispo(j).valider
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h
}

/** L'index du pion touché dans la tentative en cours — pour l'effacer d'un appui. */
function indexPegCourant(j, p) {
  const d = dispo(j)
  const r = j.e.essais.length
  if (r >= j.e.tentatives) return null
  const y = d.y0 + r * d.rowH
  if (p.y < y || p.y > y + d.rowH) return null
  const cy = y + d.rowH / 2
  for (let i = 0; i < N; i++) {
    const x = X_PEG0 + i * ESP_PEG
    if (dist(p.x, p.y, x, cy) <= 18) return i
  }
  return null
}

function poseSerie(j) {
  j.e.tentatives = Math.max(TENTATIVES_MIN, TENTATIVES_DEPART - (j.e.serie - 1) * TENTATIVES_PAS)
  j.e.secret = genereSecret(j.hasard ?? Math.random)
  j.e.essais = []
  j.e.courant = []
  j.e.debut = j.t
}

function valide(j) {
  const { bien, mal } = feedback(j.e.secret, j.e.courant)
  j.e.essais.push({ code: j.e.courant.slice(), bien, mal })
  j.e.courant = []

  if (bien === N) return victoire(j)

  j.son.touche(Math.min(9, 1 + bien + mal))
  if (j.e.essais.length >= j.e.tentatives) defaite(j)
}

function victoire(j) {
  // La prime récompense la sobriété — moins de tentatives, moins de temps —
  // et grandit avec la série, comme partout ailleurs dans le dépôt.
  const duree = j.t - j.e.debut
  const restantes = j.e.tentatives - j.e.essais.length
  const prime = Math.max(150, 200 + restantes * 220 - Math.floor(duree) * 3) * j.e.serie
  j.score += prime
  j.son.record()
  j.fx.eclat(j.W / 2, j.H / 2, C.accent, { n: 32, vitesse: 260 })
  j.e.serie++
  poseSerie(j)
  j.e.fanfare = 1.6
}

function defaite(j) {
  j.son.rate()
  j.fx.secoue(8)
  j.fx.eclat(j.W / 2, j.H / 2, C.rouge, { n: 24, vitesse: 220 })
  j.perdu()
}
