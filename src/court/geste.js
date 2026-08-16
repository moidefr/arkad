import { C } from '../palette.js'
import { texte, rect, bloc, dist, borne } from '../dessin.js'

const CY = 260 // le signe est toujours dessiné à cette hauteur, fixe
const TIP = 36 // distance du repère de direction au centre du signe

// Même seuil que BRÈCHE (src/long/breche/index.js) pour distinguer un tap
// d'un vrai geste : en dessous, le doigt n'a pas assez bougé pour qu'on sache
// ce qu'il visait, donc ça ne doit jamais valider un sens au hasard.
const SEUIL = 8

const DIRS = [
  { id: 'haut', dx: 0, dy: -1 },
  { id: 'bas', dx: 0, dy: 1 },
  { id: 'gauche', dx: -1, dy: 0 },
  { id: 'droite', dx: 1, dy: 0 },
]

// La forme d'une flèche pointant vers le haut : trois barreaux qui
// s'élargissent puis une hampe. Les trois autres sens s'en déduisent par
// symétrie (voir `transforme`) plutôt que d'être redessinés à la main —
// sinon les quatre finissent par ne plus avoir tout à fait la même largeur.
const FORME = [
  { x: -6, y: -28, w: 12, h: 8 },
  { x: -12, y: -20, w: 24, h: 8 },
  { x: -18, y: -12, w: 36, h: 8 },
  { x: -8, y: -4, w: 16, h: 28 },
]

function transforme(seg, id) {
  let { x, y, w, h } = seg
  if (id === 'bas') {
    y = -(y + h)
  } else if (id === 'gauche' || id === 'droite') {
    ;[x, y, w, h] = [y, x, h, w]
    if (id === 'droite') x = -(x + w)
  }
  return { x, y, w, h }
}

// Le rythme se resserre avec le score : c'est la seule chose qui rend la
// partie plus dure, jamais une nouvelle règle qui tombe sans prévenir.
const fenetre = (score) => Math.max(0.55, 1.4 - score * 0.035)

function manche(j) {
  j.e.dir = j.entier(0, DIRS.length)
  j.e.depart = null
  j.e.limite = fenetre(j.score)
  j.e.temps = j.e.limite
}

export default {
  id: 'geste',
  nom: 'GESTE',
  pitch: 'Un signe rapide du doigt, dans le bon sens',
  couleur: C.rouge,
  unite: 'gestes',
  vies: 3,

  init(j) {
    j.e.pause = 0
    manche(j)
  },

  maj(j, dt) {
    // La pause après une réussite n'est pas chronométrée par la fenêtre :
    // sinon le temps de fêter le point mange sur le temps de jouer le suivant.
    if (j.e.pause > 0) {
      j.e.pause = Math.max(0, j.e.pause - dt)
      if (j.e.pause === 0) manche(j)
      return
    }

    j.e.temps -= dt
    if (j.e.temps <= 0) {
      j.son.rate()
      return j.perdu()
    }
  },

  dessine(j, ctx) {
    const cx = j.W / 2
    const dir = DIRS[j.e.dir]
    const couleur = j.e.pause > 0 ? C.vert : C.rouge

    for (const seg of FORME) {
      const t = transforme(seg, dir.id)
      bloc(ctx, cx + t.x, CY + t.y, t.w, t.h, couleur, 3)
    }

    // Le repère du sens à jouer : un carré plein d'accent, seul de sa taille
    // à l'écran, planté à la pointe de la flèche.
    rect(ctx, cx + dir.dx * TIP - 3, CY + dir.dy * TIP - 3, 6, 6, C.accent)

    // La fenêtre qui se referme, sans chiffre : une barre qui se vide.
    const large = 80
    const reste = borne(j.e.temps / j.e.limite, 0, 1)
    rect(ctx, cx - large / 2, CY + 50, large, 4, C.panneau)
    rect(ctx, cx - large / 2, CY + 50, large * reste, 4, reste < 0.25 ? C.rouge : C.accent)

    if (j.t < 4) texte(ctx, 'un geste net, dans le bon sens', cx, j.H - 60, 13, C.faible, 700)
  },

  appui(j, p) {
    // Un appui pendant la pause de fête n'engage rien : le prochain signe
    // n'est même pas encore choisi.
    if (j.e.pause > 0) return
    j.e.depart = { x: p.x, y: p.y }
    j.son.clic()
  },

  relache(j, p) {
    if (j.e.pause > 0) return
    const d = j.e.depart
    j.e.depart = null
    if (!d) return

    // Sous le seuil, c'est un tap manqué — jamais un sens validé au hasard.
    if (dist(d.x, d.y, p.x, p.y) < SEUIL) {
      j.son.rate()
      return j.perdu()
    }

    const dx = p.x - d.x
    const dy = p.y - d.y
    const sens = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : dy > 0 ? 1 : 0
    if (sens !== j.e.dir) {
      j.son.rate()
      return j.perdu()
    }

    j.score += 1
    j.son.touche(Math.min(9, 1 + Math.floor(j.score / 4)))
    const dir = DIRS[j.e.dir]
    j.fx.jet(j.W / 2, CY, C.vert, {
      angle: Math.atan2(dir.dy, dir.dx),
      ouverture: 1.6,
      n: 8,
      vitesse: 140,
      duree: 0.3,
    })
    j.e.pause = 0.22
  },
}
