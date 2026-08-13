import { C, ton } from '../palette.js'
import { texte, rect, bloc, lueur } from '../dessin.js'

const LARGEUR_COL = 20
const X_JOUEUR = 84
const TAILLE = 16
const POUSSEE = 620
const GRAVITE = 540
const VY_MAX = 250
/** Le pas de la marche aléatoire d'une colonne à la suivante. */
const DERIVE = 14
/** Ce que le tunnel ne mord jamais, sous le bandeau et au ras du bas. */
const MARGE = 20

/**
 * Toutes les hauteurs de ce jeu — ouverture, poussée, chute, dérive — sont
 * écrites pour la bande de manœuvre du portrait, 640 - 56. `facteur` les
 * ramène au gabarit courant : couché, la bande tombe à 304 px, et un vaisseau
 * qui garderait sa poussée d'origine la traverserait en un tiers de seconde.
 * Une distance mise à l'échelle et une accélération mise à la même échelle
 * donnent exactement la même trajectoire dans le même temps : c'est le portrait
 * aplati, pas un autre jeu. Vaut 1 tout rond en portrait, où rien ne bouge donc.
 */
const BANDE_REF = 584
const facteur = (j) => (j.H - j.HUD) / BANDE_REF

/**
 * L'ouverture du tunnel, à partir de la valeur réglée en portrait.
 *
 * Ce que le joueur sent n'est pas l'ouverture mais le jeu qui lui reste de part
 * et d'autre — et le vaisseau, lui, garde ses 16 px dans les deux gabarits. On
 * met donc à l'échelle ce passage-là seulement : à l'échelle brute, le paysage
 * aurait coupé la marge d'erreur en deux alors que rien n'a rétréci du côté du
 * joueur, et la fin de partie serait devenue nettement plus dure qu'en debout.
 */
const ouverture = (j, portrait) => TAILLE + (portrait - TAILLE) * facteur(j)

export default {
  id: 'voltige',
  nom: 'VOLTIGE',
  pitch: 'Maintiens pour monter, lâche pour descendre',
  couleur: C.cyan,
  unite: 'm',
  ciel: C.cyan,
  vies: 3,
  // Le seul défilement horizontal de la borne : c'est celui qui gagne le plus à
  // être couché. Le joueur est fixe en X, et voir 556 px de tunnel devant soi
  // au lieu de 276 double le temps d'anticipation.
  paysage: true,
  confort: 'paysage',

  init(j) {
    j.e.y = (j.HUD + j.H) / 2
    j.e.vy = 0
    j.e.ouverture = ouverture(j, 210)
    j.e.decalage = 0
    j.e.bande = j.H - j.HUD
    j.e.cols = []
    // On remplit l'écran de colonnes dès le départ, sinon le tunnel apparaît
    // progressivement et les premières secondes sont vides.
    for (let i = 0; i < j.W / LARGEUR_COL + 3; i++) ajoute(j)
  },

  maj(j, dt) {
    const ech = facteur(j)
    const vitesse = 145 + j.t * 3.6
    j.score += dt * 12

    j.e.vy += (j.maintenu ? -POUSSEE : GRAVITE) * ech * dt
    j.e.vy = Math.max(-VY_MAX * ech, Math.min(VY_MAX * ech, j.e.vy))
    j.e.y += j.e.vy * dt

    j.e.decalage += vitesse * dt
    while (j.e.decalage >= LARGEUR_COL) {
      j.e.decalage -= LARGEUR_COL
      j.e.cols.shift()
      ajoute(j)
    }

    // Le tunnel se resserre lentement : c'est toute la courbe de difficulté.
    j.e.ouverture = ouverture(j, Math.max(118, 220 - j.t * 1.1))

    // Réacteur : le seul retour visuel sur l'appui, et il montre la poussée.
    if (j.maintenu) {
      j.fx.jet(X_JOUEUR - 2, j.e.y + TAILLE / 2, C.rouge, { angle: Math.PI / 2, n: 2, vitesse: 130 })
    }
    j.fx.jet(X_JOUEUR - TAILLE, j.e.y, C.bord, { angle: Math.PI, ouverture: 0.3, n: 1, vitesse: 190 })

    const i = Math.floor((X_JOUEUR + j.e.decalage) / LARGEUR_COL)
    const col = j.e.cols[i]
    if (!col) return
    if (j.e.y - TAILLE / 2 < col.haut || j.e.y + TAILLE / 2 > col.bas) j.perdu()
  },

  /**
   * L'appareil a tourné en pleine partie. Tout l'état de ce jeu est en pixels
   * verticaux : on le rapporte à la nouvelle bande au lieu de le recalculer,
   * sinon le vaisseau se réveille hors du tunnel qu'il était en train de
   * franchir. Le rapport se prend depuis le bandeau, seul bord commun aux deux
   * gabarits.
   */
  redim(j) {
    const bande = j.H - j.HUD
    const k = bande / j.e.bande
    j.e.bande = bande
    j.e.y = j.HUD + (j.e.y - j.HUD) * k
    j.e.vy *= k
    j.e.ouverture *= k
    for (const col of j.e.cols) {
      col.centre = j.HUD + (col.centre - j.HUD) * k
      col.haut = j.HUD + (col.haut - j.HUD) * k
      col.bas = j.HUD + (col.bas - j.HUD) * k
    }
  },

  dessine(j, ctx) {
    j.e.cols.forEach((col, i) => {
      const x = i * LARGEUR_COL - j.e.decalage
      rect(ctx, x, j.HUD, LARGEUR_COL, col.haut - j.HUD, C.bord)
      rect(ctx, x, col.haut - 5, LARGEUR_COL, 5, C.cyan)
      rect(ctx, x, col.haut - 5, LARGEUR_COL, 2, ton(C.cyan, 0.5))
      rect(ctx, x, col.bas, LARGEUR_COL, j.H - col.bas, C.bord)
      rect(ctx, x, col.bas, LARGEUR_COL, 5, C.cyan)
      rect(ctx, x, col.bas + 3, LARGEUR_COL, 2, ton(C.cyan, -0.4))
    })

    lueur(ctx, X_JOUEUR - TAILLE / 2, j.e.y - TAILLE / 2, TAILLE, TAILLE, C.accent, 3)
    bloc(ctx, X_JOUEUR - TAILLE / 2, j.e.y - TAILLE / 2, TAILLE, TAILLE, C.accent, 3)

    if (j.t < 3) texte(ctx, 'maintiens appuyé', j.W / 2, j.H - 40, 13, C.faible, 700)
  },
}

function ajoute(j) {
  const ech = facteur(j)
  const derniere = j.e.cols[j.e.cols.length - 1]
  const bas = j.H - MARGE * ech
  const haut = j.HUD + MARGE * ech
  const amplitude = DERIVE * ech

  let centre = derniere ? derniere.centre + (Math.random() * 2 - 1) * amplitude : (j.HUD + j.H) / 2
  centre = Math.max(haut + j.e.ouverture / 2, Math.min(bas - j.e.ouverture / 2, centre))

  j.e.cols.push({
    centre,
    haut: centre - j.e.ouverture / 2,
    bas: centre + j.e.ouverture / 2,
  })
}
