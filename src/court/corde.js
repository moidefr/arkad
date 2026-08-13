import { C, ton } from '../palette.js'
import { texte, rect, bloc, lueur } from '../dessin.js'

const SOL = 470
const TAILLE = 26
const SAUT = 0.44 // durée d'un saut, en secondes
const HAUTEUR = 46
// Ce que les pieds doivent avoir gagné pour passer au-dessus. C'est ce nombre,
// et lui seul, qui fixe la largeur de la fenêtre : 68 % de la durée d'un saut.
// Assez pour être jouable, assez peu pour que marteler le bouton ne suffise pas.
const DEGAGEMENT = 22
const TAMPON = 0.16 // un appui trop tôt est gardé en mémoire jusqu'à l'atterrissage

// La corde tourne sur une ellipse vue de côté. Le repère est au sol — sur les
// pieds, à l'aplomb du personnage — quand la phase vaut un entier, et c'est
// exactement l'instant que le jeu sanctionne. Dessin et règle décrivent la
// même chose : c'est toute la correction.
const LARGEUR = 120
const RAYON = 80
const AXE = SOL - RAYON

const hauteurDe = (saut) => (saut > 0 ? Math.sin((1 - saut / SAUT) * Math.PI) * HAUTEUR : 0)

// Combien de temps avant que la corde ne revienne au sol.
const attente = (e) => (1 - (e.phase - Math.floor(e.phase))) / e.cadence

// L'intervalle pendant lequel appuyer met les pieds assez haut au bon moment :
// on le résout une fois pour toutes plutôt que de le régler à l'oreille.
const MARGE = Math.asin(DEGAGEMENT / HAUTEUR) / Math.PI // 0.159 du saut
const TOT = SAUT * (1 - MARGE) // au plus tôt, 0.370 s avant le passage
const TARD = SAUT * MARGE // au plus tard, 0.070 s avant le passage
// Le repère affiché est plus prudent que la règle de deux images de chaque
// côté : appuyer pendant qu'il est allumé doit *toujours* passer, y compris
// quand le passage tombe entre deux images. Un indice qui ment est pire que
// pas d'indice — c'est exactement ce dont souffrait le jeu.
const SUR = 0.04

export default {
  id: 'corde',
  nom: 'CORDE',
  pitch: 'Saute quand la corde revient sous tes pieds',
  couleur: C.vert,
  unite: 'sauts',
  ciel: C.vert,
  vies: 3,

  init(j) {
    j.e.phase = 0
    j.e.cadence = 0.72 // tours par seconde
    j.e.saut = 0
    j.e.tampon = 0
    j.e.eclat = 0
  },

  /**
   * Une vie perdue ne doit pas annuler la montée en cadence : quarante
   * secondes de jeu s'effaçaient d'un coup. On recule de quelques marches,
   * pas jusqu'au départ.
   */
  reprend(j) {
    j.e.phase = 0
    j.e.saut = 0
    j.e.tampon = 0
    j.e.eclat = 0
    j.e.cadence = Math.max(0.72, j.e.cadence - 0.09)
  },

  maj(j, dt) {
    j.e.saut = Math.max(0, j.e.saut - dt)
    j.e.tampon = Math.max(0, j.e.tampon - dt)
    j.e.eclat = Math.max(0, j.e.eclat - dt * 3)

    // L'appui gardé en mémoire part dès que les pieds touchent le sol.
    if (j.e.saut <= 0 && j.e.tampon > 0) {
      j.e.tampon = 0
      saute(j)
    }

    const avant = j.e.phase
    j.e.phase += j.e.cadence * dt

    // Le tour se boucle quand la corde touche le sol : c'est le seul instant
    // qui compte de toute la partie.
    if (Math.floor(j.e.phase) > Math.floor(avant)) {
      // Le verdict lit la géométrie, pas un drapeau : si les pieds ne sont pas
      // passés au-dessus, la corde accroche. La hauteur du saut compte enfin.
      if (hauteurDe(j.e.saut) < DEGAGEMENT) {
        j.son.rate()
        return j.perdu()
      }
      j.score += 1
      j.e.cadence = Math.min(1.7, j.e.cadence + 0.021)
      j.e.eclat = 1
      j.son.touche(Math.min(9, 1 + Math.floor(j.score / 3)))
      j.fx.jet(j.W / 2, SOL, C.vert, {
        angle: -Math.PI / 2,
        ouverture: 2.8,
        n: 8,
        vitesse: 110,
        gravite: 400,
        duree: 0.3,
      })
    }
  },

  dessine(j, ctx) {
    const cx = j.W / 2
    const a = j.e.phase * Math.PI * 2
    const rx = cx + Math.sin(a) * LARGEUR
    const ry = AXE + Math.cos(a) * RAYON
    const proche = Math.max(0, Math.cos(a)) // 1 quand la corde est au sol

    rect(ctx, 0, SOL, j.W, 4, C.bord)

    // La fenêtre d'appui, écrite au sol. Elle s'ouvre quand appuyer met les
    // pieds assez haut, et se ferme quand il est trop tard : c'est le repère
    // qui manquait pour savoir *quand*.
    const reste = attente(j.e)
    const ouverte = reste <= TOT - SUR && reste > TARD + SUR
    if (ouverte) lueur(ctx, cx - 34, SOL + 8, 68, 5, C.accent, 3, 0.8)
    rect(ctx, cx - 34, SOL + 8, 68, 5, ouverte ? C.accent : C.panneau)

    // Le rail de la corde, et son ombre portée qui glisse au sol et se resserre
    // à l'approche : on voit arriver le passage avant qu'il n'arrive.
    for (let k = 0; k < 40; k++) {
      const t = (k / 40) * Math.PI * 2
      // Le rail s'éteint vers le haut : le bas est la seule partie du tour qui
      // décide de quelque chose, autant que l'œil y aille tout seul.
      const rail = ton(C.vert, -0.62 + 0.4 * Math.max(0, Math.cos(t)))
      rect(ctx, cx + Math.sin(t) * LARGEUR - 1, AXE + Math.cos(t) * RAYON - 1, 2, 2, rail)
    }
    // L'ombre au sol : large et sourde quand la corde est haute, étroite et
    // vive quand elle arrive. C'est le compte à rebours, sans chiffres.
    const large = 44 - 30 * proche
    rect(ctx, rx - large / 2, SOL + 1, large, 3, ton(proche > 0.5 ? C.accent : C.vert, proche * 0.9 - 0.55))

    const monte = hauteurDe(j.e.saut)
    const y = SOL - TAILLE - monte
    const teinte = j.e.eclat > 0 ? C.accent : C.vert

    // Les deux brins partent des mains, pas d'un point flottant au-dessus de
    // la tête : la corde appartient enfin au personnage.
    const mains = y + 13
    for (const cote of [-1, 1]) {
      const hx = cx + cote * (TAILLE / 2 + 3)
      for (let k = 1; k < 8; k++) {
        rect(ctx, hx + ((rx - hx) * k) / 8 - 1, mains + ((ry - mains) * k) / 8 - 1, 2, 2, C.faible)
      }
    }

    lueur(ctx, rx - 5, ry - 5, 10, 10, C.accent, 2)
    bloc(ctx, rx - 5, ry - 5, 10, 10, C.accent, 2)

    lueur(ctx, cx - TAILLE / 2, y, TAILLE, TAILLE, teinte, 3)
    bloc(ctx, cx - TAILLE / 2, y, TAILLE, TAILLE, teinte, 3)
    rect(ctx, cx - 7, y + 7, 4, 5, C.fond)
    rect(ctx, cx + 3, y + 7, 4, 5, C.fond)

    if (j.t < 5) texte(ctx, 'appuie quand le sol s’allume', j.W / 2, j.H - 60, 13, C.faible, 700)
  },

  appui(j) {
    // Un appui pendant le saut n'est plus avalé : il est gardé et rejoué à
    // l'atterrissage. Sans ça, la fenêtre réelle est impossible à cadence haute.
    if (j.e.saut > 0) {
      j.e.tampon = TAMPON
      return
    }
    saute(j)
  },
}

function saute(j) {
  j.e.saut = SAUT
  j.son.rebond()
}
