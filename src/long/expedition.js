import { C } from '../palette.js'
import { texte, rect, cadre } from '../dessin.js'

const ARRIVEE = 900 // kilomètres
const JAUGES = [
  { cle: 'vivres', nom: 'VIVRES', couleur: C.accent },
  { cle: 'eau', nom: 'EAU', couleur: C.cyan },
  { cle: 'sante', nom: 'SANTÉ', couleur: C.vert },
]

/**
 * Chaque journée propose deux routes. Il n'y a pas de bon choix dans
 * l'absolu : seulement des échanges entre ce qu'on a et ce qu'il reste à
 * parcourir.
 */
const JOURNEES = [
  {
    texte: 'Une plaine ouverte, aucun abri en vue.',
    a: { l: 'MARCHER VITE', km: 26, vivres: -9, eau: -10, sante: -4 },
    b: { l: 'MÉNAGER LES FORCES', km: 13, vivres: -5, eau: -5, sante: 2 },
  },
  {
    texte: 'Un ruisseau clair descend de la crête.',
    a: { l: 'REMPLIR LES OUTRES', km: 8, eau: 34, vivres: -4 },
    b: { l: 'PASSER SANS S’ARRÊTER', km: 22, eau: -8, vivres: -6 },
  },
  {
    texte: 'Des traces de gibier dans la boue.',
    a: { l: 'CHASSER', km: 6, vivres: 30, eau: -6, sante: -3 },
    b: { l: 'CONTINUER', km: 20, vivres: -7, eau: -7 },
  },
  {
    texte: 'Le col est enneigé. En contrebas, un long détour.',
    a: { l: 'LE COL', km: 34, sante: -14, vivres: -8, eau: -6 },
    b: { l: 'LE DÉTOUR', km: 15, vivres: -6, eau: -6 },
  },
  {
    texte: 'Une carcasse de charrette, à moitié pillée.',
    a: { l: 'FOUILLER', km: 5, vivres: 18, eau: 10, sante: -2 },
    b: { l: 'NE PAS S’ATTARDER', km: 21, vivres: -6, eau: -6 },
  },
  {
    texte: 'La fièvre te prend au réveil.',
    a: { l: 'MARCHER QUAND MÊME', km: 18, sante: -12, vivres: -6, eau: -8 },
    b: { l: 'RESTER COUCHÉ', km: 0, sante: 14, vivres: -8, eau: -6 },
  },
  {
    texte: 'Un village, méfiant, propose un échange.',
    a: { l: 'DONNER DES VIVRES', km: 24, vivres: -16, sante: 10 },
    b: { l: 'REFUSER', km: 17, vivres: -6, eau: -6 },
  },
  {
    texte: 'Orage. Le sentier se transforme en torrent.',
    a: { l: 'AVANCER SOUS LA PLUIE', km: 20, eau: 16, sante: -9, vivres: -5 },
    b: { l: 'S’ABRITER', km: 4, eau: 12, vivres: -6, sante: 3 },
  },
  {
    texte: 'Une forêt dense, plus courte mais sans repères.',
    a: { l: 'COUPER À TRAVERS', km: 30, vivres: -10, eau: -8, sante: -5 },
    b: { l: 'LONGER LA LISIÈRE', km: 16, vivres: -6, eau: -6 },
  },
  {
    texte: 'Des fruits inconnus, en abondance.',
    a: { l: 'EN MANGER', km: 16, vivres: 22, sante: -7 },
    b: { l: 'S’EN PASSER', km: 18, vivres: -7, eau: -6 },
  },
  {
    texte: 'Le vent tourne. La nuit sera glaciale.',
    a: { l: 'MARCHER DE NUIT', km: 27, sante: -10, vivres: -8, eau: -5 },
    b: { l: 'FAIRE DU FEU', km: 6, sante: 8, vivres: -9, eau: -4 },
  },
  {
    texte: 'Une route pavée, droite, et parfaitement exposée.',
    a: { l: 'LA SUIVRE', km: 32, vivres: -8, eau: -11, sante: -3 },
    b: { l: 'RESTER COUVERT', km: 14, vivres: -5, eau: -5, sante: 1 },
  },
]

export default {
  id: 'expedition',
  nom: 'EXPÉDITION',
  pitch: 'Neuf cents kilomètres, un choix par jour',
  couleur: C.violet,
  unite: 'km',
  persistant: true,

  finTitre: (j) => (j.e.h.km >= ARRIVEE ? { texte: 'ARRIVÉ', couleur: C.accent } : { texte: 'PERDU EN ROUTE', couleur: C.rouge }),

  init(j) {
    const s = j.charge()
    j.e.h = s ?? { jour: 1, km: 0, vivres: 70, eau: 70, sante: 100, n: 0 }
    j.e.journee = JOURNEES[j.e.h.n % JOURNEES.length]
    j.e.dernier = s ? 'tu reprends la route' : 'premier jour de marche'
    j.score = Math.floor(j.e.h.km)
  },

  dessine(j, ctx) {
    const h = j.e.h

    ctx.textAlign = 'left'
    texte(ctx, `JOUR ${h.jour}`, 20, 78, 16, C.accent, 700)
    ctx.textAlign = 'right'
    texte(ctx, `${Math.floor(h.km)} / ${ARRIVEE} km`, j.W - 20, 78, 14, C.faible, 700)
    ctx.textAlign = 'center'

    // La route : c'est la seule chose qui compte vraiment.
    rect(ctx, 20, 96, 320, 10, C.panneau)
    rect(ctx, 20, 96, 320 * Math.min(1, h.km / ARRIVEE), 10, C.accent)

    JAUGES.forEach((g, i) => {
      const y = 124 + i * 30
      const v = Math.max(0, Math.min(100, h[g.cle]))
      ctx.textAlign = 'left'
      texte(ctx, g.nom, 20, y + 8, 12, C.faible, 700)
      rect(ctx, 96, y + 2, 244, 12, C.panneau)
      rect(ctx, 96, y + 2, 244 * (v / 100), 12, v > 25 ? g.couleur : C.rouge)
      ctx.textAlign = 'center'
    })

    rect(ctx, 20, 226, 320, 96, C.panneau)
    cadre(ctx, 20, 226, 320, 96, C.bord)
    ctx.textAlign = 'left'
    lignes(ctx, j.e.journee.texte, 34, 254, 292, 15, C.texte)
    ctx.textAlign = 'center'
    texte(ctx, j.e.dernier, j.W / 2, 340, 13, C.faible, 700, 320)

    ;[j.e.journee.a, j.e.journee.b].forEach((o, i) => {
      const y = 366 + i * 108
      rect(ctx, 20, y, 320, 96, C.panneau)
      cadre(ctx, 20, y, 320, 96, i === 0 ? C.accent : C.cyan)
      texte(ctx, o.l, j.W / 2, y + 30, 17, i === 0 ? C.accent : C.cyan, 700, 296)
      texte(ctx, resume(o), j.W / 2, y + 62, 13, C.faible, 700, 296)
    })
  },

  appui(j, p) {
    if (p.y >= 366 && p.y <= 462) return choisis(j, j.e.journee.a)
    if (p.y >= 474 && p.y <= 570) return choisis(j, j.e.journee.b)
  },
}

function resume(o) {
  const bouts = [`+${o.km} km`]
  for (const g of JAUGES) {
    const v = o[g.cle]
    if (v) bouts.push(`${v > 0 ? '+' : ''}${v} ${g.nom.toLowerCase()}`)
  }
  return bouts.join('  ')
}

function choisis(j, o) {
  const h = j.e.h
  h.km += o.km
  for (const g of JAUGES) h[g.cle] = Math.min(100, h[g.cle] + (o[g.cle] ?? 0))

  // La faim et la soif ne tuent pas directement : elles rongent la santé.
  let mal = ''
  if (h.vivres <= 0) (h.sante -= 9), (h.vivres = 0), (mal = 'la faim te ronge')
  if (h.eau <= 0) (h.sante -= 12), (h.eau = 0), (mal = 'la soif te brûle')

  h.jour++
  h.n++
  j.score = Math.floor(h.km)
  j.e.journee = JOURNEES[Math.floor(Math.random() * JOURNEES.length)]
  j.e.dernier = mal || `${o.km} km parcourus`
  j.son.touche(Math.min(9, 1 + Math.floor(o.km / 6)))
  j.fx.bulle(j.W / 2, 130, `+${o.km} km`, C.accent, 16)

  if (h.km >= ARRIVEE) {
    j.son.record()
    j.fx.eclat(j.W / 2, j.H / 2, C.accent, { n: 34, vitesse: 260 })
    j.efface()
    return j.perdu()
  }
  if (h.sante <= 0) {
    h.sante = 0
    j.son.rate()
    j.efface()
    return j.perdu()
  }

  // Chaque journée est écrite : on peut fermer entre deux choix.
  j.sauve(h)
}

/** Découpe un texte en lignes qui tiennent dans la largeur donnée. */
function lignes(ctx, phrase, x, y, large, taille, couleur) {
  const mots = phrase.split(' ')
  let ligne = ''
  let n = 0
  for (const mot of mots) {
    const essai = ligne ? ligne + ' ' + mot : mot
    ctx.font = `700 ${taille}px ui-monospace, monospace`
    if (ctx.measureText(essai).width > large && ligne) {
      texte(ctx, ligne, x, y + n * (taille + 6), taille, couleur, 700)
      n++
      ligne = mot
    } else ligne = essai
  }
  if (ligne) texte(ctx, ligne, x, y + n * (taille + 6), taille, couleur, 700)
}
