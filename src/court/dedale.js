import { C, ton } from '../palette.js'
import { texte, rect, pastille, lueur, borne, vers } from '../dessin.js'

const R = 9 // rayon du point
const MARGE = 22 // marge minimale entre un mur et le bord de l'écran
const LARGEUR_DEP = 150
const LARGEUR_MIN = 62
const RETRECISSEMENT = 0.018 // largeur de couloir perdue par unité de distance
const VITESSE_DEP = 95
const VITESSE_MAX = 230
const ACCEL = 0.018 // px/s de défilement gagnés par unité de distance
const LISSE = 620 // vitesse de rattrapage du point vers le doigt, px/s
const PALIER = 260 // distance entre deux tics de score
const RECUL_CHUTE = 340 // recul de distance à la perte d'une vie — pas un retour à l'entrée
const PAS_Y = 8 // pas d'échantillonnage vertical du couloir

const largeur = (s) => Math.max(LARGEUR_MIN, LARGEUR_DEP - s * RETRECISSEMENT)
const vitesse = (dist) => Math.min(VITESSE_MAX, VITESSE_DEP + dist * ACCEL)

/**
 * Le centre du couloir à une distance donnée. Pure fonction de `s`, comme
 * dans TRACÉ : la forme du labyrinthe ne dépend jamais de l'instant où on le
 * dessine, seulement d'où on se trouve dedans — sinon le couloir changerait
 * de forme sous les pieds du joueur d'une image à l'autre.
 */
function centre(s, W) {
  const demi = largeur(s) / 2
  const ampMax = Math.max(0, W / 2 - MARGE - demi)
  const amp = Math.min(ampMax, 24 + s * 0.006)
  const decale = Math.sin(s * 0.0032) * amp + Math.sin(s * 0.011 + 1.4) * amp * 0.35
  return borne(W / 2 + decale, MARGE + demi, W - MARGE - demi)
}

export default {
  id: 'dedale',
  nom: 'DÉDALE',
  pitch: 'Le doigt est le mur. Le point suit, sans jamais le toucher',
  couleur: C.accent,
  unite: 'paliers',
  vies: 3,

  init(j) {
    j.e.dist = 0
    j.e.x = j.W / 2
    j.e.y = j.H / 2
    j.e.palier = 0
    j.e.eclat = 0
  },

  /**
   * Une vie perdue recule dans le labyrinthe plutôt que de renvoyer à
   * l'entrée — et repose le point au centre du couloir à l'endroit du recul,
   * sinon il resurgit exactement sur le mur qui vient de le tuer.
   */
  reprend(j) {
    j.e.dist = Math.max(0, j.e.dist - RECUL_CHUTE)
    j.e.y = j.H / 2
    j.e.x = centre(j.e.dist + (j.H - j.e.y), j.W)
    j.e.eclat = 0
  },

  maj(j, dt) {
    // Le labyrinthe défile tout seul : ignorer le doigt ne met pas la partie
    // en pause, ça la perd — c'est le seul jeu COURT du lot à punir l'immobilité
    // sur les deux axes à la fois.
    j.e.dist += vitesse(j.e.dist) * dt
    j.e.eclat = Math.max(0, j.e.eclat - dt * 3)

    if (j.maintenu) {
      j.e.x = vers(j.e.x, borne(j.pointer.x, R, j.W - R), LISSE * dt)
      j.e.y = vers(j.e.y, borne(j.pointer.y, j.HUD + R, j.H - R), LISSE * dt)
    }

    // Le point n'est pas jugé sur une ligne fixe : sa propre hauteur à l'écran
    // dit où il en est dans le couloir. Monter, c'est avancer ; descendre,
    // c'est regarder le passage qu'on vient de quitter.
    const s = j.e.dist + (j.H - j.e.y)
    const c = centre(s, j.W)
    const demi = largeur(s) / 2
    if (j.e.x - R < c - demi || j.e.x + R > c + demi) {
      j.son.rate()
      j.fx.secoue(5)
      return j.perdu()
    }

    const palier = Math.floor(j.e.dist / PALIER)
    if (palier > j.e.palier) {
      j.e.palier = palier
      j.score += 1
      j.e.eclat = 1
      j.son.touche(Math.min(9, 1 + palier))
      j.fx.eclat(j.e.x, j.e.y, C.accent, { n: 8, vitesse: 110, taille: 4 })
    }
  },

  dessine(j, ctx) {
    const W = j.W
    // Le couloir entier est visible d'un coup, pas seulement au niveau du
    // point : c'est ce qui permet de piloter à l'avance plutôt qu'au réflexe.
    for (let y = j.HUD; y < j.H; y += PAS_Y) {
      const s = j.e.dist + (j.H - y)
      const c = centre(s, W)
      const demi = largeur(s) / 2
      // Le mur le plus proche de la hauteur du point s'éclaire : l'œil sait
      // tout de suite où chercher le danger.
      const proche = Math.max(0, 1 - Math.abs(y - j.e.y) / 220)
      rect(ctx, 0, y, c - demi, PAS_Y, ton(C.bord, proche * 0.3))
      rect(ctx, c + demi, y, W - (c + demi), PAS_Y, ton(C.bord, proche * 0.3))
      rect(ctx, c - demi - 2, y, 2, PAS_Y, ton(C.accent, -0.15 + proche * 0.55))
      rect(ctx, c + demi, y, 2, PAS_Y, ton(C.accent, -0.15 + proche * 0.55))
    }

    lueur(ctx, j.e.x - R, j.e.y - R, R * 2, R * 2, C.accent, j.e.eclat > 0 ? 4 : 3)
    pastille(ctx, j.e.x, j.e.y, R, C.accent)
    pastille(ctx, j.e.x - 2, j.e.y - 2, R / 2, ton(C.accent, 0.5))

    if (j.t < 3) texte(ctx, 'pose le doigt, le point te suit', W / 2, j.H - 40, 13, C.faible, 700)
  },

  appui(j) {
    j.son.clic()
  },
}
