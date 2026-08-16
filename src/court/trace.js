import { C, ton } from '../palette.js'
import { texte, rect, cadre, lueur, pastille, borne } from '../dessin.js'

const LARGEUR = 74 // largeur du tube
const TOLERANCE = LARGEUR / 2 + 6 // un peu plus indulgent que le trait visible
const LIGNE = 540 // hauteur où le doigt est jugé, proche du bas de l'écran
const MARGE_BORD = 26
const PAS_Y = 8

const VITESSE_BASE = 130
const VITESSE_MAX = 260
const ACCEL = 0.03 // px/s gagnés par px de distance parcourue

const DRAIN = 0.55 // endurance perdue par seconde hors tolérance
const RECUP = 0.35 // endurance regagnée par seconde dedans, ou à l'arrêt
const RECUL_CHUTE = 420 // recul de distance à la perte d'une vie — pas un retour à zéro

const PALIER = 260 // distance entre deux tics de progression

/**
 * Le centre du tube à une distance donnée. Pure fonction de `s` : la forme du
 * tracé ne dépend que d'où on est dessus, jamais de l'instant où on le
 * dessine — sinon le même point du tracé changerait de forme d'une image à
 * l'autre, et suivre le tube deviendrait suivre un mensonge.
 */
function centre(s, W) {
  const cx = W / 2
  const amp = 55 + Math.min(35, s * 0.006)
  const decale = Math.sin(s * 0.0055) * amp + Math.sin(s * 0.016 + 1.7) * 24
  return borne(cx + decale, MARGE_BORD + LARGEUR / 2, W - MARGE_BORD - LARGEUR / 2)
}

const vitesse = (dist) => Math.min(VITESSE_MAX, VITESSE_BASE + dist * ACCEL)

export default {
  id: 'trace',
  nom: 'TRACÉ',
  pitch: 'Le doigt reste dans le tube tant qu’il glisse',
  couleur: C.cyan,
  unite: 'm',
  ciel: C.cyan,
  vies: 3,

  init(j) {
    j.e.dist = 0
    j.e.endurance = 1
    j.e.palier = 0
  },

  /**
   * Un recul, pas un retour au départ : la vitesse et l'amplitude dépendent de
   * la distance parcourue, donc repartir de zéro effacerait toute la
   * difficulté gagnée — exactement la faute que CORDE a déjà payée une fois.
   */
  reprend(j) {
    j.e.dist = Math.max(0, j.e.dist - RECUL_CHUTE)
    j.e.endurance = 1
  },

  maj(j, dt) {
    if (j.maintenu) {
      const v = vitesse(j.e.dist)
      j.e.dist += v * dt

      const c = centre(j.e.dist, j.W)
      const dedans = Math.abs(j.pointer.x - c) <= TOLERANCE
      if (dedans) {
        j.e.endurance = Math.min(1, j.e.endurance + RECUP * dt)
        j.score += v * dt * 0.12
      } else {
        j.e.endurance = Math.max(0, j.e.endurance - DRAIN * dt)
      }

      if (j.e.endurance <= 0) {
        j.son.rate()
        j.fx.secoue(5)
        return j.perdu()
      }

      const palier = Math.floor(j.e.dist / PALIER)
      if (palier > j.e.palier) {
        j.e.palier = palier
        j.son.touche(Math.min(9, 1 + palier))
        j.fx.eclat(j.pointer.x, LIGNE, C.cyan, { n: 6, vitesse: 90, taille: 3 })
      }
    } else {
      // Relâcher arrête le tracé, ça ne punit pas : l'endurance se refait
      // pendant la pause, comme le fait la marge de récupération pendant le jeu.
      j.e.endurance = Math.min(1, j.e.endurance + RECUP * dt)
    }
  },

  dessine(j, ctx) {
    const W = j.W

    // Le tube : une paroi de chaque côté, tracée en rangées. Elle s'éteint
    // loin de la ligne de jugement — c'est elle qui compte, le reste n'est
    // que du contexte pour anticiper le prochain virage.
    for (let y = j.HUD; y < j.H; y += PAS_Y) {
      const s = j.e.dist + (LIGNE - y)
      const c = centre(s, W)
      const loin = Math.min(1, Math.abs(y - LIGNE) / 260)
      const paroi = ton(C.cyan, -0.1 - loin * 0.55)
      rect(ctx, c - LARGEUR / 2 - 2, y, 2, PAS_Y, paroi)
      rect(ctx, c + LARGEUR / 2, y, 2, PAS_Y, paroi)
      if (Math.floor((y - j.HUD) / PAS_Y) % 3 === 0) rect(ctx, c - 1, y, 2, 2, ton(C.cyan, -0.35 - loin * 0.4))
    }

    // Le repère : le centre du tube exactement à la ligne de jugement.
    const cLigne = centre(j.e.dist, W)
    lueur(ctx, cLigne - 4, LIGNE - 4, 8, 8, C.accent, 2, 0.7)
    rect(ctx, cLigne - 4, LIGNE - 4, 8, 8, C.accent)

    // Le doigt : vert dedans, rouge dehors, terne si posé nulle part.
    const dedans = Math.abs(j.pointer.x - cLigne) <= TOLERANCE
    const couleurDoigt = !j.maintenu ? C.faible : dedans ? C.vert : C.rouge
    lueur(ctx, j.pointer.x - 8, LIGNE - 8, 16, 16, couleurDoigt, 2)
    pastille(ctx, j.pointer.x, LIGNE, 8, couleurDoigt)

    // La jauge d'endurance : elle seule décide de la vie, autant qu'elle soit lisible.
    const gx = 20
    const gy = j.HUD + 14
    const gw = W - 40
    const gh = 10
    rect(ctx, gx, gy, gw, gh, C.panneau)
    rect(ctx, gx, gy, gw * j.e.endurance, gh, j.e.endurance < 0.3 ? C.rouge : C.cyan)
    cadre(ctx, gx, gy, gw, gh, C.bord)

    if (j.t < 3) texte(ctx, 'glisse le doigt, reste dans le tube', W / 2, j.H - 40, 13, C.faible, 700)
  },
}
