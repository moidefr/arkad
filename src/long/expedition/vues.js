import { C } from '../../palette.js'
import { texte, rect, cadre, bloc, lueur, pastille } from '../../dessin.js'
import { JAUGES, OBJETS, ETAPES, FATIGUE_MAX, FATIGUE_SEUIL } from './donnees.js'
import * as L from './logique.js'
import { zoneOption } from './dispo.js'

/** Le résumé chiffré d'une option, dans l'ordre où les jauges sont listées. */
export function resume(o) {
  const bouts = [`+${o.km} km`]
  for (const g of JAUGES) {
    const v = o[g.cle]
    if (v) bouts.push(`${v > 0 ? '+' : ''}${v}`)
  }
  if (o.objet) bouts.push(OBJETS[o.objet])
  if (o.chance) bouts.push(`risqué · ${Math.round(o.chance.p * 100)}%`)
  return bouts.join('   ')
}

/** Découpe un texte en lignes qui tiennent dans la largeur donnée. */
export function lignes(ctx, phrase, x, y, large, taille, couleur) {
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

export function dessine(ctx, d, j, h, journee) {
  const etape = L.etapeDe(h)
  const arrivee = L.arriveeDe(h)

  ctx.textAlign = 'left'
  texte(ctx, `JOUR ${h.jour}`, 20, 74, 15, C.faible, 700)
  const routeChoisie = h.embranchements[L.etapeIndexDe(h)]
  const suffixe = routeChoisie === 'sur' ? ' · ROUTE SÛRE' : routeChoisie === 'risque' ? ' · RACCOURCI' : ''
  texte(ctx, etape.nom + suffixe, 20, 96, 19, etape.couleur, 700)
  ctx.textAlign = 'right'
  texte(ctx, `${Math.floor(h.km)} / ${Math.round(arrivee)} km`, j.W - 20, 74, 14, C.texte, 700)
  if (h.sac.length) {
    texte(ctx, h.sac.map((o) => OBJETS[o]).join(' · '), j.W - 20, 96, 12, C.accent, 700, 220)
  }
  ctx.textAlign = 'center'

  // La route, avec les frontières des pays (décalées si une route a été choisie).
  rect(ctx, d.route.x, d.route.y, d.route.w, d.route.h, C.panneau)
  const avance = d.route.w * Math.min(1, h.km / arrivee)
  if (avance > 4) {
    lueur(ctx, d.route.x, d.route.y, avance, d.route.h, etape.couleur, 2, 0.7)
    bloc(ctx, d.route.x, d.route.y, avance, d.route.h, etape.couleur, 2)
  }
  for (let i = 0; i < ETAPES.length; i++) {
    rect(ctx, d.route.x + (L.limiteDe(h, i) / arrivee) * d.route.w - 1, d.route.y - 4, 2, d.route.h + 8, C.bord)
  }

  JAUGES.forEach((g, i) => {
    const y = d.jauges.y0 + i * d.jauges.pas
    const v = Math.max(0, Math.min(100, h[g.cle]))
    ctx.textAlign = 'left'
    texte(ctx, g.nom, d.jauges.x, y + 8, 12, C.faible, 700)
    rect(ctx, d.jauges.xBarre, y + 2, d.jauges.wBarre, d.jauges.h, C.panneau)
    if (v > 0) bloc(ctx, d.jauges.xBarre, y + 2, d.jauges.wBarre * (v / 100), d.jauges.h, v > 25 ? g.couleur : C.rouge, 2)
    ctx.textAlign = 'center'
  })

  // Fatigue : une rangée de pastilles, silencieuse tant qu'elle n'influe sur rien.
  const yFatigue = d.jauges.y0 + JAUGES.length * d.jauges.pas + 2
  for (let i = 0; i < FATIGUE_MAX; i++) {
    const rempli = i < h.fatigue
    pastille(ctx, d.jauges.x + 8 + i * 16, yFatigue, 5, rempli ? (h.fatigue >= FATIGUE_SEUIL ? C.rouge : C.faible) : C.panneau)
  }
  ctx.textAlign = 'left'
  texte(ctx, 'FATIGUE', d.jauges.x + 8 + FATIGUE_MAX * 16 + 8, yFatigue, 10, C.faible, 700)
  ctx.textAlign = 'center'

  rect(ctx, d.carte.x, d.carte.y, d.carte.w, d.carte.h, C.panneau)
  cadre(ctx, d.carte.x, d.carte.y, d.carte.w, d.carte.h, journee.urgence ? C.rouge : journee.embranchement ? C.accent : C.bord)
  ctx.textAlign = 'left'
  lignes(ctx, journee.texte, d.carte.x + 14, d.carte.y + 26, d.carte.w - 28, 14, C.texte)
  ctx.textAlign = 'center'
  texte(ctx, j.e.dernier, j.W / 2, d.carte.y + 100, 13, C.faible, 700, 320)

  L.optionsDe(journee).forEach((o, i) => {
    const z = zoneOption(d, i)
    const ouverte = L.ouverte(h, o)
    rect(ctx, z.x, z.y, z.w, z.h, C.panneau)
    cadre(ctx, z.x, z.y, z.w, z.h, ouverte ? (o.exige ? C.accent : i === 0 ? C.vert : C.cyan) : C.bord)
    texte(ctx, o.l, j.W / 2, z.y + 26, 16, ouverte ? C.texte : C.bord, 700, 296)
    texte(
      ctx,
      ouverte ? resume(o) : `il te faudrait : ${OBJETS[o.exige]}`,
      j.W / 2,
      z.y + 52,
      12,
      ouverte ? C.faible : C.bord,
      700,
      296,
    )
  })
}
