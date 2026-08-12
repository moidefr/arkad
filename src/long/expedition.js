import { C } from '../palette.js'
import { texte, rect, cadre, bloc, lueur } from '../dessin.js'

const ARRIVEE = 900 // kilomètres
const JAUGES = [
  { cle: 'vivres', nom: 'VIVRES', couleur: C.accent },
  { cle: 'eau', nom: 'EAU', couleur: C.cyan },
  { cle: 'sante', nom: 'SANTÉ', couleur: C.vert },
]

const OBJETS = {
  corde: 'CORDE',
  carte: 'CARTE',
  remede: 'REMÈDE',
}

/**
 * Le voyage traverse quatre pays, chacun avec ses propres journées. Aucun
 * choix n'est bon dans l'absolu : ce sont des échanges entre ce qu'on a et ce
 * qu'il reste à parcourir. Trois objets se trouvent en route et ouvrent des
 * options qui n'existent pas sans eux.
 */
const ETAPES = [
  {
    nom: 'LA PLAINE',
    jusqu: 230,
    couleur: C.vert,
    journees: [
      {
        texte: 'Une plaine ouverte, aucun abri en vue.',
        a: { l: 'MARCHER VITE', km: 28, vivres: -9, eau: -10, sante: -4 },
        b: { l: 'MÉNAGER LES FORCES', km: 14, vivres: -5, eau: -5, sante: 2 },
      },
      {
        texte: 'Un ruisseau clair descend d’une crête lointaine.',
        a: { l: 'REMPLIR LES OUTRES', km: 9, eau: 34, vivres: -4 },
        b: { l: 'PASSER SANS S’ARRÊTER', km: 24, eau: -9, vivres: -6 },
      },
      {
        texte: 'Des traces de gibier dans la boue séchée.',
        a: { l: 'CHASSER', km: 7, vivres: 30, eau: -6, sante: -3 },
        b: { l: 'CONTINUER', km: 22, vivres: -7, eau: -7 },
      },
      {
        texte: 'Une charrette renversée, à moitié pillée.',
        a: { l: 'FOUILLER', km: 6, vivres: 16, eau: 8, sante: -2, objet: 'corde' },
        b: { l: 'NE PAS S’ATTARDER', km: 23, vivres: -6, eau: -6 },
      },
      {
        texte: 'Un hameau méfiant. On te propose un échange.',
        a: { l: 'DONNER DES VIVRES', km: 25, vivres: -16, sante: 10, objet: 'remede' },
        b: { l: 'REFUSER POLIMENT', km: 18, vivres: -6, eau: -6 },
      },
      {
        texte: 'Un vieux te propose de recopier sa carte, contre un repas.',
        a: { l: 'ACCEPTER', km: 10, vivres: -14, objet: 'carte' },
        b: { l: 'SE FIER AU SOLEIL', km: 21, vivres: -6, eau: -7 },
      },
    ],
  },
  {
    nom: 'LA FORÊT',
    jusqu: 470,
    couleur: C.cyan,
    journees: [
      {
        texte: 'La forêt se referme. Le sentier disparaît sous les fougères.',
        a: { l: 'COUPER À TRAVERS', km: 30, vivres: -10, eau: -8, sante: -6 },
        b: { l: 'LONGER LA LISIÈRE', km: 17, vivres: -6, eau: -6 },
        c: { l: 'SUIVRE LA CARTE', km: 34, vivres: -7, eau: -6, exige: 'carte' },
      },
      {
        texte: 'Des baies inconnues, en abondance, d’un rouge trop vif.',
        a: { l: 'EN MANGER', km: 17, vivres: 24, sante: -8 },
        b: { l: 'S’EN PASSER', km: 19, vivres: -7, eau: -6 },
      },
      {
        texte: 'Un torrent large, aux berges glissantes.',
        a: { l: 'TRAVERSER À GUÉ', km: 16, eau: 20, sante: -10 },
        b: { l: 'REMONTER LE COURS', km: 8, eau: 26, vivres: -5 },
        c: { l: 'TENDRE LA CORDE', km: 24, eau: 22, sante: -2, exige: 'corde' },
      },
      {
        texte: 'Des champignons, un tapis de mousse, et un silence complet.',
        a: { l: 'CAMPER ICI', km: 5, sante: 12, vivres: -6, eau: -3 },
        b: { l: 'AVANCER ENCORE', km: 24, vivres: -8, eau: -8, sante: -3 },
      },
      {
        texte: 'Une cabane de charbonnier, vide depuis longtemps.',
        a: { l: 'FOUILLER LES RESTES', km: 7, vivres: 18, sante: 4 },
        b: { l: 'DORMIR AU SEC', km: 4, sante: 14, vivres: -7 },
      },
      {
        texte: 'Orage. Le sentier se transforme en torrent.',
        a: { l: 'AVANCER SOUS LA PLUIE', km: 21, eau: 18, sante: -10, vivres: -5 },
        b: { l: 'S’ABRITER', km: 5, eau: 14, vivres: -6, sante: 4 },
      },
    ],
  },
  {
    nom: 'LES CRÊTES',
    jusqu: 700,
    couleur: C.violet,
    journees: [
      {
        texte: 'Le col est enneigé. En contrebas, un long détour.',
        a: { l: 'LE COL', km: 36, sante: -16, vivres: -9, eau: -6 },
        b: { l: 'LE DÉTOUR', km: 16, vivres: -7, eau: -7 },
        c: { l: 'S’ENCORDER', km: 34, sante: -5, vivres: -8, exige: 'corde' },
      },
      {
        texte: 'Une paroi verticale coupe la route.',
        a: { l: 'LA CONTOURNER', km: 12, vivres: -8, eau: -8 },
        b: { l: 'GRIMPER', km: 30, sante: -18, vivres: -6 },
        c: { l: 'GRIMPER ENCORDÉ', km: 32, sante: -6, vivres: -6, exige: 'corde' },
      },
      {
        texte: 'De la neige propre, à perte de vue.',
        a: { l: 'LA FAIRE FONDRE', km: 9, eau: 32, vivres: -6, sante: -3 },
        b: { l: 'MARCHER TANT QU’IL FAIT JOUR', km: 26, eau: -10, vivres: -8 },
      },
      {
        texte: 'Le vent tourne. La nuit sera glaciale.',
        a: { l: 'MARCHER DE NUIT', km: 29, sante: -12, vivres: -9, eau: -5 },
        b: { l: 'FAIRE DU FEU', km: 6, sante: 10, vivres: -10, eau: -4 },
      },
      {
        texte: 'Un refuge de pierre, à demi effondré.',
        a: { l: 'Y PASSER LA NUIT', km: 5, sante: 16, vivres: -7, eau: -4 },
        b: { l: 'POUSSER JUSQU’AU SUIVANT', km: 27, sante: -8, vivres: -8, eau: -7 },
      },
      {
        texte: 'Un aigle tournoie au-dessus d’une carcasse fraîche.',
        a: { l: 'PRENDRE CE QU’IL RESTE', km: 11, vivres: 22, sante: -6 },
        b: { l: 'LAISSER', km: 22, vivres: -8, eau: -7 },
      },
    ],
  },
  {
    nom: 'LE DÉSERT',
    jusqu: ARRIVEE,
    couleur: C.accent,
    journees: [
      {
        texte: 'Le sable commence. La chaleur monte du sol.',
        a: { l: 'MARCHER LE JOUR', km: 27, eau: -20, sante: -8 },
        b: { l: 'MARCHER LA NUIT', km: 20, eau: -8, vivres: -9, sante: -3 },
      },
      {
        texte: 'Un puits. La corde a disparu.',
        a: { l: 'DESCENDRE À MAINS NUES', km: 6, eau: 22, sante: -12 },
        b: { l: 'RENONCER', km: 20, eau: -14, vivres: -6 },
        c: { l: 'UTILISER SA CORDE', km: 8, eau: 44, exige: 'corde' },
      },
      {
        texte: 'Une caravane croise ta route, pressée.',
        a: { l: 'ÉCHANGER DES VIVRES', km: 22, vivres: -18, eau: 30 },
        b: { l: 'DEMANDER LA DIRECTION', km: 30, eau: -12, vivres: -7 },
      },
      {
        texte: 'Tempête de sable à l’horizon.',
        a: { l: 'LUI TOURNER LE DOS', km: 8, sante: -4, eau: -6 },
        b: { l: 'LA TRAVERSER', km: 31, sante: -18, eau: -14 },
      },
      {
        texte: 'Des ruines basses, à moitié ensablées.',
        a: { l: 'FOUILLER', km: 7, eau: 18, vivres: 12, sante: -4 },
        b: { l: 'PASSER', km: 25, eau: -14, vivres: -7 },
      },
      {
        texte: 'Au loin, une ligne verte. Ce n’est peut-être rien.',
        a: { l: 'Y CROIRE', km: 33, eau: -16, sante: -6 },
        b: { l: 'GARDER LE CAP', km: 24, eau: -12, vivres: -7 },
        c: { l: 'VÉRIFIER SUR LA CARTE', km: 33, eau: 12, exige: 'carte' },
      },
    ],
  },
]

/** Ces journées-là ne se tirent pas au sort : elles arrivent quand ça va mal. */
const URGENCES = [
  {
    quand: (h) => h.sante <= 32,
    texte: 'La fièvre te prend au réveil. Tu tiens à peine debout.',
    a: { l: 'MARCHER QUAND MÊME', km: 17, sante: -14, vivres: -6, eau: -8 },
    b: { l: 'RESTER COUCHÉ', km: 0, sante: 16, vivres: -9, eau: -7 },
    c: { l: 'PRENDRE LE REMÈDE', km: 14, sante: 34, exige: 'remede' },
  },
  {
    quand: (h) => h.vivres <= 14,
    texte: 'Le sac est presque vide. Tu comptes les bouchées.',
    a: { l: 'CHASSER TOUTE LA JOURNÉE', km: 4, vivres: 26, eau: -8, sante: -5 },
    b: { l: 'SERRER LA CEINTURE', km: 23, vivres: -4, sante: -9 },
  },
  {
    quand: (h) => h.eau <= 14,
    texte: 'Les outres sonnent creux depuis ce matin.',
    a: { l: 'CHERCHER UN POINT D’EAU', km: 5, eau: 28, vivres: -7, sante: -4 },
    b: { l: 'TENIR ENCORE UN JOUR', km: 24, eau: -3, sante: -12 },
  },
]

export default {
  id: 'expedition',
  nom: 'EXPÉDITION',
  pitch: 'Neuf cents kilomètres, quatre pays, un choix par jour',
  couleur: C.violet,
  unite: 'km',
  ciel: C.accent,
  persistant: true,

  finTitre: (j) =>
    j.e.h.km >= ARRIVEE ? { texte: 'ARRIVÉ', couleur: C.accent } : { texte: 'PERDU EN ROUTE', couleur: C.rouge },

  init(j) {
    const s = j.charge()
    j.e.h = s ?? { jour: 1, km: 0, vivres: 72, eau: 72, sante: 100, sac: [] }
    j.e.dernier = s ? 'tu reprends la route' : 'premier jour de marche'
    j.e.journee = tire(j.e.h)
    j.score = Math.floor(j.e.h.km)
  },

  dessine(j, ctx) {
    const h = j.e.h
    const etape = etapeDe(h.km)

    ctx.textAlign = 'left'
    texte(ctx, `JOUR ${h.jour}`, 20, 74, 15, C.faible, 700)
    texte(ctx, etape.nom, 20, 96, 19, etape.couleur, 700)
    ctx.textAlign = 'right'
    texte(ctx, `${Math.floor(h.km)} / ${ARRIVEE} km`, j.W - 20, 74, 14, C.texte, 700)
    if (h.sac.length) {
      texte(ctx, h.sac.map((o) => OBJETS[o]).join(' · '), j.W - 20, 96, 12, C.accent, 700, 220)
    }
    ctx.textAlign = 'center'

    // La route, avec les frontières des quatre pays.
    rect(ctx, 20, 110, 320, 10, C.panneau)
    const avance = 320 * Math.min(1, h.km / ARRIVEE)
    if (avance > 4) {
      lueur(ctx, 20, 110, avance, 10, etape.couleur, 2, 0.7)
      bloc(ctx, 20, 110, avance, 10, etape.couleur, 2)
    }
    for (const e of ETAPES) rect(ctx, 20 + (e.jusqu / ARRIVEE) * 320 - 1, 106, 2, 18, C.bord)

    JAUGES.forEach((g, i) => {
      const y = 136 + i * 28
      const v = Math.max(0, Math.min(100, h[g.cle]))
      ctx.textAlign = 'left'
      texte(ctx, g.nom, 20, y + 8, 12, C.faible, 700)
      rect(ctx, 96, y + 2, 244, 12, C.panneau)
      if (v > 0) bloc(ctx, 96, y + 2, 244 * (v / 100), 12, v > 25 ? g.couleur : C.rouge, 2)
      ctx.textAlign = 'center'
    })

    rect(ctx, 20, 226, 320, 84, C.panneau)
    cadre(ctx, 20, 226, 320, 84, j.e.journee.urgence ? C.rouge : C.bord)
    ctx.textAlign = 'left'
    lignes(ctx, j.e.journee.texte, 34, 252, 292, 14, C.texte)
    ctx.textAlign = 'center'
    texte(ctx, j.e.dernier, j.W / 2, 326, 13, C.faible, 700, 320)

    options(j).forEach((o, i) => {
      const y = 348 + i * 84
      const ouvert = !o.exige || h.sac.includes(o.exige)
      rect(ctx, 20, y, 320, 74, C.panneau)
      cadre(ctx, 20, y, 320, 74, ouvert ? (o.exige ? C.accent : i === 0 ? C.vert : C.cyan) : C.bord)
      texte(ctx, o.l, j.W / 2, y + 26, 16, ouvert ? C.texte : C.bord, 700, 296)
      texte(
        ctx,
        ouvert ? resume(o) : `il te faudrait : ${OBJETS[o.exige]}`,
        j.W / 2,
        y + 52,
        12,
        ouvert ? C.faible : C.bord,
        700,
        296
      )
    })
  },

  appui(j, p) {
    const liste = options(j)
    const i = Math.floor((p.y - 348) / 84)
    if (i < 0 || i >= liste.length || p.y < 348) return
    const o = liste[i]
    if (o.exige && !j.e.h.sac.includes(o.exige)) return j.son.rate()
    choisis(j, o)
  },
}

const etapeDe = (km) => ETAPES.find((e) => km < e.jusqu) ?? ETAPES[ETAPES.length - 1]
const options = (j) => [j.e.journee.a, j.e.journee.b, j.e.journee.c].filter(Boolean)

function tire(h) {
  const urgence = URGENCES.filter((u) => u.quand(h))
  // Une urgence passe avant tout le reste : c'est elle qui donne le rythme.
  if (urgence.length && Math.random() < 0.8) {
    return { ...urgence[Math.floor(Math.random() * urgence.length)], urgence: true }
  }
  const pool = etapeDe(h.km).journees
  return pool[Math.floor(Math.random() * pool.length)]
}

function resume(o) {
  const bouts = [`+${o.km} km`]
  for (const g of JAUGES) {
    const v = o[g.cle]
    if (v) bouts.push(`${v > 0 ? '+' : ''}${v}`)
  }
  if (o.objet) bouts.push(OBJETS[o.objet])
  return bouts.join('   ')
}

function choisis(j, o) {
  const h = j.e.h
  const avant = etapeDe(h.km)

  h.km += o.km
  for (const g of JAUGES) h[g.cle] = Math.min(100, h[g.cle] + (o[g.cle] ?? 0))
  if (o.exige) h.sac.splice(h.sac.indexOf(o.exige), 1)
  if (o.objet && !h.sac.includes(o.objet)) h.sac.push(o.objet)

  // La faim et la soif ne tuent pas directement : elles rongent la santé.
  let mal = ''
  if (h.vivres <= 0) (h.sante -= 10), (h.vivres = 0), (mal = 'la faim te ronge')
  if (h.eau <= 0) (h.sante -= 13), (h.eau = 0), (mal = 'la soif te brûle')

  h.jour++
  j.score = Math.floor(h.km)
  j.e.journee = tire(h)
  j.e.dernier = mal || (o.objet ? `tu ramasses : ${OBJETS[o.objet]}` : `${o.km} km parcourus`)
  j.son.touche(Math.min(9, 1 + Math.floor(o.km / 6)))
  j.fx.bulle(j.W / 2, 150, `+${o.km} km`, C.accent, 16)

  const apres = etapeDe(h.km)
  if (apres !== avant && h.km < ARRIVEE) {
    j.e.dernier = `tu entres dans ${apres.nom.toLowerCase()}`
    j.son.niveau()
    j.fx.eclat(j.W / 2, 115, apres.couleur, { n: 20, vitesse: 180 })
  }

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
