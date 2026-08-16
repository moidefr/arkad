import { MARCHANDISES, MARCHES } from './donnees.js'

/**
 * La géométrie partagée entre le dessin et le tap. CARAVANE reste portrait —
 * comme EXPÉDITION — donc une seule disposition, calée sur `j.W`. La carte
 * est la seule zone qui n'est pas tapable : le réseau se lit dessus, il se
 * parcourt dans l'onglet ROUTE, en dessous.
 */
export function dispo(j) {
  const onglets = { x: 20, y: 178, w: j.W - 40, h: 30, pas: (j.W - 40) / 3 }
  const corps = { x: 20, y: 216, w: j.W - 40, h: 384 }
  return {
    entete: { x: 20, y: 68 },
    carte: { x: 20, y: 100, w: j.W - 40, h: 70 },
    onglets,
    corps,
    marchandises: { x: corps.x, y0: corps.y + 34, w: corps.w, h: 44, pas: 50 },
    routes: { x: corps.x, y0: corps.y + 8, w: corps.w, h: 50, pas: 56 },
    enRoute: { x: corps.x, y: corps.y + 8, w: corps.w, h: 130 },
    flotte: { x: corps.x, y: corps.y + 8 },
    boutonCharrette: { x: corps.x, y: corps.y + 150, w: corps.w, h: 46 },
    avis: { x: 20, y: 606, w: j.W - 40, h: 22 },
  }
}

/** Le point d'un marché sur la carte, à partir de ses coordonnées relatives. */
export const pointMarche = (d, i) => ({ x: d.carte.x + MARCHES[i].x * d.carte.w, y: d.carte.y + MARCHES[i].y * d.carte.h })

export const dans = (p, z) => z && p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h

export const zoneOnglet = (d, k) => ({ x: d.onglets.x + k * d.onglets.pas, y: d.onglets.y, w: d.onglets.pas, h: d.onglets.h })

export const zoneMarchandise = (d, i) => ({
  x: d.marchandises.x,
  y: d.marchandises.y0 + i * d.marchandises.pas,
  w: d.marchandises.w,
  h: d.marchandises.h,
})

/** La rangée d'une marchandise se coupe en deux : achat à gauche, vente à droite. */
export function zoneAchat(d, i) {
  const r = zoneMarchandise(d, i)
  return { x: r.x, y: r.y + 21, w: r.w / 2 - 4, h: 21 }
}
export function zoneVente(d, i) {
  const r = zoneMarchandise(d, i)
  return { x: r.x + r.w / 2 + 4, y: r.y + 21, w: r.w / 2 - 4, h: 21 }
}

export const zoneRoute = (d, i) => ({ x: d.routes.x, y: d.routes.y0 + i * d.routes.pas, w: d.routes.w, h: d.routes.h })

export const NB_MARCHANDISES = MARCHANDISES.length
