import { C, ton } from '../palette.js'
import { texte, rect, bloc, lueur, cadre, bandeTramee } from '../dessin.js'

// La piste où la jauge fait ses allers-retours. Elle sert aussi de règle : la
// hauteur du repère mesure directement la puissance, dessin et calcul lisent
// le même j.e.charge, il n'y a nulle part une deuxième valeur à faire dériver.
const PISTE_X = 150
const PISTE_HAUT = 130
const PISTE_BAS = 480
const PISTE_L = 60
const PISTE_H = PISTE_BAS - PISTE_HAUT

const CIBLE_Y = 90
const CIBLE_H = 30

const Y_VOYANT_TOUCHE = 540
const Y_VOYANT_PLEIN = 556

// Le seuil de touche part large et se resserre avec le score : c'est la seule
// chose qui monte en difficulté, la cadence ne fait que varier d'un tir à
// l'autre. Plafonné à 0.95 — sinon la fenêtre finirait par n'exister qu'à
// l'instant exact du sommet, ce qu'aucun doigt ne peut viser.
const SEUIL_BASE = 0.6
const SEUIL_PAS = 0.018
const SEUIL_MAX = 0.95
const seuilDe = (score) => Math.min(SEUIL_MAX, SEUIL_BASE + score * SEUIL_PAS)
// Le point plein n'est que la moitié haute de la fenêtre de touche : elle se
// resserre avec elle, sans paramètre séparé à désynchroniser.
const pleinDe = (seuil) => seuil + (1 - seuil) * 0.5

// Cadence de l'aller-retour, en cycles par seconde. Une cible qu'on annonce
// plus loin fait osciller la jauge plus vite — c'est elle qui rend chaque tir
// différent, pas le seuil.
const CADENCE_MIN = 0.5
const CADENCE_VAR = 0.35

const FONDU = 0.45 // durée d'affichage du dernier impact, en secondes

export default {
  id: 'visee',
  nom: 'VISÉE',
  pitch: 'Maintiens pour charger, lâche pour tirer. La bonne puissance, pas la max.',
  couleur: C.rouge,
  ciel: C.violet,
  unite: 'pts',
  vies: 3,

  init(j) {
    j.e.dernier = null
    nouvelleCible(j)
  },

  /**
   * `j.maintenu` est la seule source de vérité pendant la charge : la jauge
   * doit continuer d'osciller tant que le doigt reste posé, même si `appui`
   * n'a été appelé qu'une fois au tout début du geste.
   */
  maj(j, dt) {
    if (j.e.dernier) {
      j.e.dernier.t += dt
      if (j.e.dernier.t > FONDU) j.e.dernier = null
    }

    if (!j.e.chargeant || !j.maintenu) return

    // Aller-retour 0→1→0 en boucle : tenir plus longtemps ne charge pas plus
    // fort, ça fait juste manquer le sommet une fois de plus.
    j.e.charge += j.e.dir * j.e.cadence * 2 * dt
    if (j.e.charge >= 1) {
      j.e.charge = 1
      j.e.dir = -1
    } else if (j.e.charge <= 0) {
      j.e.charge = 0
      j.e.dir = 1
    }
  },

  dessine(j, ctx) {
    const cx = j.W / 2
    const seuil = seuilDe(j.score)
    const plein = pleinDe(seuil)
    const yDe = (v) => PISTE_BAS - v * PISTE_H

    rect(ctx, PISTE_X, PISTE_HAUT, PISTE_L, PISTE_H, C.panneau)
    cadre(ctx, PISTE_X, PISTE_HAUT, PISTE_L, PISTE_H, C.bord)

    // La fenêtre de touche, et sa moitié haute qui vaut le point plein.
    rect(ctx, PISTE_X, PISTE_HAUT, PISTE_L, yDe(seuil) - PISTE_HAUT, ton(C.rouge, -0.5))
    rect(ctx, PISTE_X, PISTE_HAUT, PISTE_L, yDe(plein) - PISTE_HAUT, ton(C.accent, -0.35))

    // La jauge elle-même : tramée, dense à la base et plus légère vers le
    // sommet, jamais un aplat.
    const h = j.e.charge * PISTE_H
    if (h > 0) bandeTramee(ctx, PISTE_X, PISTE_BAS - h, PISTE_L, h, C.rouge, 0.3, 0.95)

    // Le repère de charge courante : sa hauteur est j.e.charge, exactement la
    // valeur que relache() gèlera. Rien d'autre ne mesure la puissance.
    const my = yDe(j.e.charge)
    lueur(ctx, PISTE_X - 4, my - 2, PISTE_L + 8, 4, C.accent, 2)
    rect(ctx, PISTE_X - 4, my - 2, PISTE_L + 8, 4, C.accent)

    bloc(ctx, cx - 35, CIBLE_Y, 70, CIBLE_H, C.rouge, 3)
    texte(ctx, `${Math.round(40 + j.e.d * 200)} m`, cx, CIBLE_Y + CIBLE_H / 2, 13, C.fond, 700)

    bloc(ctx, cx - 13, PISTE_BAS + 10, 26, 26, C.texte, 3)

    // Les voyants : ce que le joueur regarde pour savoir quand lâcher, lus
    // sur l'état courant de la jauge — jamais recalculés autrement qu'elle.
    const toucheOuverte = j.e.charge >= seuil
    const pleinOuvert = j.e.charge >= plein
    rect(ctx, cx - 45, Y_VOYANT_TOUCHE, 90, 6, toucheOuverte ? C.accent : C.bord)
    rect(ctx, cx - 20, Y_VOYANT_PLEIN, 40, 6, pleinOuvert ? C.accent : C.bord)

    if (j.e.dernier) {
      const d = j.e.dernier
      ctx.globalAlpha = Math.max(0, 1 - d.t / FONDU)
      rect(ctx, PISTE_X - 6, yDe(d.puissance) - 2, PISTE_L + 12, 4, d.couleur)
      ctx.globalAlpha = 1
    }

    if (j.t < 3) texte(ctx, 'maintiens, lâche au sommet', cx, j.H - 40, 13, C.faible, 700)
  },

  appui(j) {
    j.e.chargeant = true
    j.e.charge = 0
    j.e.dir = 1
    j.son.clic()
  },

  relache(j) {
    if (!j.e.chargeant) return
    j.e.chargeant = false
    tire(j, j.e.charge)
  },
}

function nouvelleCible(j) {
  j.e.d = j.hasard()
  j.e.cadence = CADENCE_MIN + j.e.d * CADENCE_VAR
  j.e.charge = 0
  j.e.dir = 1
  j.e.chargeant = false
}

function tire(j, puissance) {
  const seuil = seuilDe(j.score)
  const plein = puissance >= pleinDe(seuil)
  const touche = puissance >= seuil
  j.e.dernier = { puissance, t: 0, couleur: plein ? C.accent : touche ? C.rouge : C.faible }

  if (touche) {
    j.score += plein ? 2 : 1
    j.son.touche(plein ? 7 : 3)
    const cx = j.W / 2
    j.fx.eclat(cx, CIBLE_Y + CIBLE_H / 2, plein ? C.accent : C.rouge, {
      n: plein ? 16 : 8,
      vitesse: 140,
      gravite: 40,
    })
    if (plein) {
      j.fx.jet(cx, CIBLE_Y + CIBLE_H / 2, C.accent, { angle: -Math.PI / 2, ouverture: 3, n: 10, vitesse: 150, duree: 0.3 })
    }
    nouvelleCible(j)
    return
  }

  j.son.rate()
  j.fx.eclat(j.W / 2, PISTE_BAS + 20, C.faible, { n: 10, vitesse: 90 })
  j.fx.secoue(5)
  j.perdu()
}
