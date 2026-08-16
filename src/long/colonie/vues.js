import { C, ton } from '../../palette.js'
import { texte, rect, cadre, bloc, lueur } from '../../dessin.js'
import { RESSOURCES, BATIMENTS, NOMS_PALIER, FAMINE_SEUIL_ABANDON, PALIERS } from './donnees.js'
import * as L from './logique.js'
import { zoneOnglet, zoneBatiment } from './dispo.js'

const signe = (v) => (v > 0 ? '+' : '')

/** Le prix d'un bâtiment, dans l'ordre où `donnees.js` l'écrit. */
function ditCout(c) {
  return Object.entries(c)
    .map(([res, v]) => `${v} ${RESSOURCES.find((r) => r.cle === res).nom.toLowerCase()}`)
    .join(' · ')
}

export function dessine(ctx, d, j, e, palier) {
  const capacite = L.logements(e)
  const taux = L.tauxRessources(e)
  const enFamine = e.famineDepuis > 0

  ctx.textAlign = 'left'
  texte(ctx, 'POPULATION', 20, 68, 12, C.faible, 700)
  ctx.textAlign = 'right'
  texte(ctx, `pic ${Math.floor(e.pic)}`, j.W - 20, 68, 12, C.faible, 700)
  ctx.textAlign = 'center'
  texte(ctx, `${Math.floor(e.population)} / ${capacite}`, j.W / 2, 68, 15, C.texte, 700)

  // La jauge de population : rouge, la couleur d'identité du jeu, parce que
  // c'est elle qui porte tout le risque de la partie.
  rect(ctx, d.pop.x, d.pop.y, d.pop.w, d.pop.h, C.panneau)
  const rempli = d.pop.w * Math.min(1, e.population / Math.max(1, capacite))
  if (rempli > 2) {
    lueur(ctx, d.pop.x, d.pop.y, rempli, d.pop.h, C.rouge, 2, 0.6)
    bloc(ctx, d.pop.x, d.pop.y, rempli, d.pop.h, C.rouge, 2)
  }

  // La famine ne se voit qu'en train de monter : une barre vide ne dit rien
  // qu'un joueur n'ait pas déjà compris.
  if (enFamine) {
    rect(ctx, d.famine.x, d.famine.y, d.famine.w, d.famine.h, C.panneau)
    const w = d.famine.w * Math.min(1, e.famineDepuis / FAMINE_SEUIL_ABANDON)
    rect(ctx, d.famine.x, d.famine.y, w, d.famine.h, C.rouge)
  }

  RESSOURCES.forEach((r, i) => {
    const y = d.ressources.y0 + i * d.ressources.pas
    const t = taux[r.cle]
    ctx.textAlign = 'left'
    texte(ctx, r.nom, d.ressources.x, y, 12, C.faible, 700)
    ctx.textAlign = 'right'
    texte(ctx, `${L.nombre(e[r.cle])}`, d.ressources.x + d.ressources.w * 0.6, y, 13, r.couleur, 700)
    texte(ctx, `${signe(t)}${t.toFixed(2)}/s`, d.ressources.x + d.ressources.w, y, 11, t < 0 ? C.rouge : C.faible, 700)
  })
  ctx.textAlign = 'center'

  const paliers = [0, 1, 2]
  paliers.forEach((p, k) => {
    const z = zoneOnglet(d, k)
    const actif = p === palier
    rect(ctx, z.x, z.y, z.w, z.h, actif ? ton(C.panneau, 0.2) : C.panneau)
    cadre(ctx, z.x, z.y, z.w, z.h, actif ? C.accent : C.bord)
    texte(ctx, NOMS_PALIER[p], z.x + z.w / 2, z.y + z.h / 2, 11, actif ? C.accent : C.faible, 700, z.w - 8)
  })

  const liste = BATIMENTS.map((b, i) => ({ b, i })).filter(({ b }) => b.palier === palier)
  liste.forEach(({ b, i }, k) => {
    const z = zoneBatiment(d, k)
    const ouvert = L.ouvert(e, i)
    const peut = ouvert && L.peutConstruire(e, i)
    rect(ctx, z.x, z.y, z.w, z.h, C.panneau)
    cadre(ctx, z.x, z.y, z.w, z.h, ouvert ? (peut ? b.couleur : C.bord) : C.bord)
    ctx.textAlign = 'left'
    texte(ctx, b.nom, z.x + 12, z.y + 18, 14, ouvert ? C.texte : C.faible, 700, z.w - 80)
    texte(ctx, b.dit, z.x + 12, z.y + 35, 10, C.faible, 700, z.w - 80)
    texte(
      ctx,
      ouvert ? ditCout(L.cout(e, i)) : `dès ${PALIERS[b.palier]} habitants`,
      z.x + 12,
      z.y + 51,
      10,
      peut ? C.faible : C.rouge,
      700,
      z.w - 80,
    )
    ctx.textAlign = 'right'
    texte(ctx, `× ${e.n[i]}`, z.x + z.w - 12, z.y + 33, 20, b.couleur, 700)
    ctx.textAlign = 'center'
  })

  if (!liste.length) texte(ctx, '—', j.W / 2, d.batiments.y0 + 20, 13, C.faible, 700)
}
