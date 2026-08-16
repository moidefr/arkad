/**
 * La géométrie partagée entre le dessin et le tap. COLONIE reste portrait —
 * comme EXPÉDITION — donc une seule disposition, calée sur `j.W`.
 */
export function dispo(j) {
  return {
    pop: { x: 20, y: 84, w: j.W - 40, h: 14 },
    famine: { x: 20, y: 104, w: j.W - 40, h: 5 },
    ressources: { x: 20, y0: 140, w: j.W - 40, h: 24, pas: 28 },
    onglets: { x: 20, y: 262, w: 106, h: 30, pas: 110 },
    batiments: { x: 20, y0: 306, w: j.W - 40, h: 66, pas: 74 },
  }
}

export const zoneOnglet = (d, k) => ({ x: d.onglets.x + k * d.onglets.pas, y: d.onglets.y, w: d.onglets.w, h: d.onglets.h })
export const zoneBatiment = (d, k) => ({ x: d.batiments.x, y: d.batiments.y0 + k * d.batiments.pas, w: d.batiments.w, h: d.batiments.h })

export const dans = (p, z) => z && p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h
