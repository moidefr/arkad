import { C } from '../palette.js'
import { texte, rect, borne, bloc, lueur } from '../dessin.js'

const LARGEUR_J = 22
const HAUTEUR_J = 22
const PLAT_W = 62
const PLAT_H = 10
const REBOND = 470
const GRAVITE = 1000
const ECART = 78 // distance verticale moyenne entre deux plateformes

export default {
  id: 'grimpe',
  nom: 'GRIMPE',
  pitch: 'Ça rebondit tout seul. Le doigt dirige',
  couleur: C.vert,
  unite: 'm',
  vies: 3,

  init(j) {
    j.e.x = j.W / 2
    j.e.y = 460
    j.e.vy = 0
    j.e.cam = 0
    j.e.haut = 0
    j.e.plats = [{ x: j.W / 2 - PLAT_W / 2, y: 500 }]
    // On remplit jusqu'en haut de l'écran dès le départ.
    while (j.e.plats[j.e.plats.length - 1].y > -200) ajoute(j)
  },

  maj(j, dt) {
    j.e.x = borne(j.pointer.x, LARGEUR_J / 2, j.W - LARGEUR_J / 2)

    j.e.vy += GRAVITE * dt
    j.e.y += j.e.vy * dt

    // On ne rebondit qu'en descendant, et seulement sur le dessus : sinon on
    // s'accroche aux plateformes en montant, ce qui est illisible.
    if (j.e.vy > 0) {
      for (const p of j.e.plats) {
        const pieds = j.e.y + HAUTEUR_J / 2
        if (
          pieds >= p.y &&
          pieds <= p.y + PLAT_H + j.e.vy * dt &&
          j.e.x + LARGEUR_J / 2 > p.x &&
          j.e.x - LARGEUR_J / 2 < p.x + PLAT_W
        ) {
          j.e.vy = -REBOND
          j.son.rebond()
          // Les grains vivent dans le repère de l'écran : on convertit.
          j.fx.jet(j.e.x, p.y - j.e.cam, C.vert, { angle: Math.PI / 2, ouverture: 2.4, n: 6, vitesse: 90, duree: 0.3 })
          break
        }
      }
    }

    // La caméra ne redescend jamais : on ne perd pas ce qu'on a gagné.
    const cible = j.e.y - 420
    if (cible < j.e.cam) j.e.cam = cible
    j.e.haut = Math.max(j.e.haut, -j.e.cam)
    j.score = Math.max(j.score, Math.floor(j.e.haut / 10))

    while (j.e.plats[j.e.plats.length - 1].y > j.e.cam - 120) ajoute(j)
    j.e.plats = j.e.plats.filter((p) => p.y < j.e.cam + j.H + 80)

    if (j.e.y - j.e.cam > j.H + 40) j.perdu()
  },

  dessine(j, ctx) {
    const dy = -j.e.cam

    for (const p of j.e.plats) {
      const y = p.y + dy
      if (y < j.HUD - 20 || y > j.H + 20) continue
      bloc(ctx, p.x, y, PLAT_W, PLAT_H, C.vert, 3)
    }

    const x = j.e.x - LARGEUR_J / 2
    const y = j.e.y - HAUTEUR_J / 2 + dy
    lueur(ctx, x, y, LARGEUR_J, HAUTEUR_J, C.accent, 3)
    bloc(ctx, x, y, LARGEUR_J, HAUTEUR_J, C.accent, 3)
    rect(ctx, x + 5, y + 6, 4, 5, C.fond)
    rect(ctx, x + 13, y + 6, 4, 5, C.fond)

    if (j.t < 3) texte(ctx, 'glisse le doigt', j.W / 2, j.H - 40, 13, C.faible, 700)
  },
}

function ajoute(j) {
  const derniere = j.e.plats[j.e.plats.length - 1]
  // Un rebond fait monter de 110 px (470² / 2·1000) : l'écart grandit avec
  // l'altitude mais reste sous cette limite, sinon le jeu devient impossible.
  const monte = ECART + Math.min(28, j.e.haut / 140) * Math.random()
  j.e.plats.push({
    x: Math.random() * (j.W - PLAT_W),
    y: derniere.y - monte,
  })
}
