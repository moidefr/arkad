import { C, ton } from '../../palette.js'
import { texte, rect, cadre, bloc, lueur, pastille, dist } from '../../dessin.js'
import { MARCHANDISES, MARCHES, ROUTES } from './donnees.js'
import * as L from './logique.js'
import { pointMarche, zoneOnglet, zoneMarchandise, zoneAchat, zoneVente, zoneRoute, dans } from './dispo.js'

const ONGLETS = [
  { id: 'marche', l: 'MARCHÉ' },
  { id: 'route', l: 'ROUTE' },
  { id: 'flotte', l: 'FLOTTE' },
]

export function dessine(ctx, d, j, e) {
  dessineEntete(ctx, d, j, e)
  dessineCarte(ctx, d, e)
  dessineOnglets(ctx, d, j)

  if (j.e.vue === 'marche') dessineMarche(ctx, d, j, e)
  else if (j.e.vue === 'route') dessineRoute(ctx, d, j, e)
  else dessineFlotte(ctx, d, j, e)

  if (j.e.avis) {
    ctx.globalAlpha = Math.min(1, j.e.avis.reste * 2)
    lueur(ctx, d.avis.x, d.avis.y, d.avis.w, d.avis.h, j.e.avis.couleur, 3, 0.7)
    rect(ctx, d.avis.x, d.avis.y, d.avis.w, d.avis.h, ton(C.fond, 0.15))
    texte(ctx, j.e.avis.texte, d.avis.x + d.avis.w / 2, d.avis.y + 11, 12, j.e.avis.couleur, 700, d.avis.w - 12)
    ctx.globalAlpha = 1
  }
}

function dessineEntete(ctx, d, j, e) {
  ctx.textAlign = 'left'
  texte(ctx, `${L.nombre(e.argent)} OR`, d.entete.x, d.entete.y, 20, C.accent, 700)
  ctx.textAlign = 'right'
  const lieu = e.enRoute
    ? `EN ROUTE · ${L.duree(Math.max(0, e.enRoute.restant))}`
    : MARCHES[e.marche].nom
  texte(ctx, lieu, j.W - 20, d.entete.y, 13, e.enRoute ? C.cyan : C.texte, 700, 200)
  ctx.textAlign = 'center'
}

/** Le réseau, en pastilles reliées — pas une ligne, un graphe. */
function dessineCarte(ctx, d, e) {
  rect(ctx, d.carte.x, d.carte.y, d.carte.w, d.carte.h, C.panneau)
  cadre(ctx, d.carte.x, d.carte.y, d.carte.w, d.carte.h, C.bord)

  // Une route est un `rect` tourné, pas un trait : `dessin.js` ne sait tracer
  // que des rectangles, jamais une ligne libre (voir sa règle « rien d'autre »).
  for (const r of ROUTES) {
    const a = pointMarche(d, r.a)
    const b = pointMarche(d, r.b)
    const long = dist(a.x, a.y, b.x, b.y)
    ctx.save()
    ctx.translate((a.x + b.x) / 2, (a.y + b.y) / 2)
    ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x))
    rect(ctx, -long / 2, -0.5, long, 1, C.bord)
    ctx.restore()
  }

  MARCHES.forEach((m, i) => {
    const p = pointMarche(d, i)
    const ici = i === e.marche
    const cible = e.enRoute?.vers === i
    if (ici) lueur(ctx, p.x - 4, p.y - 4, 8, 8, C.accent, 2, 0.8)
    pastille(ctx, p.x, p.y, ici ? 4 : 2.5, ici ? C.accent : cible ? C.cyan : C.faible)
  })
}

export function dessineOnglets(ctx, d, j) {
  ONGLETS.forEach((o, k) => {
    const z = zoneOnglet(d, k)
    const actif = j.e.vue === o.id
    rect(ctx, z.x, z.y, z.w - 4, z.h, actif ? ton(C.accent, -0.7) : C.panneau)
    cadre(ctx, z.x, z.y, z.w - 4, z.h, actif ? C.accent : C.bord)
    texte(ctx, o.l, z.x + (z.w - 4) / 2, z.y + z.h / 2 + 1, 12, actif ? C.accent : C.faible, 700)
  })
}

export function ongletTouche(d, p) {
  for (let k = 0; k < ONGLETS.length; k++) if (dans(p, zoneOnglet(d, k))) return ONGLETS[k].id
  return null
}

// --- Onglet MARCHÉ -------------------------------------------------------------

function fleche(ecart) {
  return ecart > 1.05 ? '▲' : ecart < 0.95 ? '▼' : '·'
}

function dessineMarche(ctx, d, j, e) {
  const i = e.marche
  ctx.textAlign = 'left'
  texte(
    ctx,
    `cargaison ${L.cargaisonTotale(e)} / ${L.capacite(e)}`,
    d.corps.x,
    d.corps.y + 12,
    12,
    C.faible,
    700,
  )
  ctx.textAlign = 'center'

  if (e.enRoute) {
    texte(ctx, 'le marché attend ton retour', j.W / 2, d.corps.y + 60, 13, C.faible, 700, d.corps.w)
    return
  }

  MARCHANDISES.forEach((m, g) => {
    const z = zoneMarchandise(d, g)
    const p = L.prix(e, i, g)
    rect(ctx, z.x, z.y, z.w, z.h, C.panneau)
    cadre(ctx, z.x, z.y, z.w, z.h, C.bord)

    ctx.textAlign = 'left'
    texte(ctx, m.nom, z.x + 10, z.y + 12, 13, m.couleur, 700)
    texte(ctx, `${e.cargaison[g]} en cale`, z.x + 10, z.y + 26, 10, C.faible, 700)
    ctx.textAlign = 'right'
    texte(ctx, `${Math.round(p)} ${fleche(e.ecarts[i][g])}`, z.x + z.w - 10, z.y + 12, 13, C.texte, 700)
    ctx.textAlign = 'center'

    const za = zoneAchat(d, g)
    const zv = zoneVente(d, g)
    const peutAcheter = e.argent >= p && L.placeLibre(e) > 0
    const peutVendre = e.cargaison[g] > 0
    rect(ctx, za.x, za.y, za.w, za.h, C.panneau)
    cadre(ctx, za.x, za.y, za.w, za.h, peutAcheter ? C.vert : C.bord)
    texte(ctx, 'ACHETER', za.x + za.w / 2, za.y + za.h / 2 + 1, 10, peutAcheter ? C.vert : C.bord, 700)
    rect(ctx, zv.x, zv.y, zv.w, zv.h, C.panneau)
    cadre(ctx, zv.x, zv.y, zv.w, zv.h, peutVendre ? C.rouge : C.bord)
    texte(ctx, 'VENDRE', zv.x + zv.w / 2, zv.y + zv.h / 2 + 1, 10, peutVendre ? C.rouge : C.bord, 700)
  })
}

export function appuiMarche(j, p, d, e) {
  if (e.enRoute) return null
  for (let g = 0; g < MARCHANDISES.length; g++) {
    if (dans(p, zoneAchat(d, g))) return { action: 'achat', g }
    if (dans(p, zoneVente(d, g))) return { action: 'vente', g }
  }
  return null
}

// --- Onglet ROUTE ----------------------------------------------------------------

function dessineRoute(ctx, d, j, e) {
  if (e.enRoute) {
    const r = e.enRoute
    const av = 1 - Math.max(0, r.restant) / r.duree
    ctx.textAlign = 'center'
    texte(ctx, `vers ${MARCHES[r.vers].nom}`, j.W / 2, d.enRoute.y + 20, 16, C.cyan, 700)
    texte(ctx, L.duree(Math.max(0, r.restant)) + ' restant', j.W / 2, d.enRoute.y + 44, 13, C.faible, 700)
    rect(ctx, d.enRoute.x, d.enRoute.y + 64, d.enRoute.w, 12, C.panneau)
    if (av > 0.02) bloc(ctx, d.enRoute.x, d.enRoute.y + 64, d.enRoute.w * Math.min(1, av), 12, C.cyan, 2)
    texte(
      ctx,
      `risque en chemin : ${Math.round(r.risque * 100)} %`,
      j.W / 2,
      d.enRoute.y + 100,
      11,
      C.faible,
      700,
    )
    return
  }

  const conn = L.connexions(e.marche)
  conn.forEach((c, k) => {
    const z = zoneRoute(d, k)
    rect(ctx, z.x, z.y, z.w, z.h, C.panneau)
    cadre(ctx, z.x, z.y, z.w, z.h, c.risque > 0.08 ? C.rouge : C.bord)
    ctx.textAlign = 'left'
    texte(ctx, MARCHES[c.vers].nom, z.x + 10, z.y + 18, 14, C.texte, 700, z.w - 120)
    ctx.textAlign = 'right'
    texte(ctx, L.duree(c.duree), z.x + z.w - 10, z.y + 14, 12, C.faible, 700)
    texte(ctx, `risque ${Math.round(c.risque * 100)} %`, z.x + z.w - 10, z.y + 32, 11, c.risque > 0.08 ? C.rouge : C.faible, 700)
    ctx.textAlign = 'center'
  })
  if (!conn.length) texte(ctx, 'aucune route ne part d’ici', j.W / 2, d.routes.y0 + 20, 13, C.faible, 700)
}

export function appuiRoute(j, p, d, e) {
  if (e.enRoute) return null
  const conn = L.connexions(e.marche)
  for (let k = 0; k < conn.length; k++) if (dans(p, zoneRoute(d, k))) return conn[k].vers
  return null
}

// --- Onglet FLOTTE -----------------------------------------------------------------

function dessineFlotte(ctx, d, j, e) {
  ctx.textAlign = 'left'
  texte(ctx, `${e.charrettes} charrette${e.charrettes > 1 ? 's' : ''}`, d.flotte.x, d.flotte.y + 12, 15, C.texte, 700)
  texte(ctx, `capacité totale : ${L.capacite(e)}`, d.flotte.x, d.flotte.y + 32, 12, C.faible, 700)
  texte(ctx, `entretien : ${(e.charrettes * 0.018).toFixed(3)} or / s`, d.flotte.x, d.flotte.y + 50, 12, C.faible, 700)
  if (e.dette > 0) texte(ctx, `dette : ${L.nombre(e.dette)} or`, d.flotte.x, d.flotte.y + 70, 12, C.rouge, 700)
  ctx.textAlign = 'center'

  const cout = L.coutCharrette(e)
  const peut = e.argent >= cout && !e.enRoute
  const zb = d.boutonCharrette
  rect(ctx, zb.x, zb.y, zb.w, zb.h, C.panneau)
  cadre(ctx, zb.x, zb.y, zb.w, zb.h, peut ? C.accent : C.bord)
  texte(ctx, 'NOUVELLE CHARRETTE', zb.x + zb.w / 2, zb.y + 18, 13, peut ? C.accent : C.bord, 700)
  texte(ctx, `${L.nombre(cout)} or`, zb.x + zb.w / 2, zb.y + 34, 12, peut ? C.faible : C.bord, 700)
}

export function appuiFlotte(j, p, d, e) {
  if (e.enRoute) return false
  return dans(p, d.boutonCharrette)
}
