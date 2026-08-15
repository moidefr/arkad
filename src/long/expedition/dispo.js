/**
 * La géométrie partagée entre le dessin et le tap. EXPÉDITION reste
 * portrait — comme USINE — donc une seule disposition, calée sur `j.W`.
 */
export function dispo(j) {
  return {
    route: { x: 20, y: 110, w: j.W - 40, h: 10 },
    jauges: { x: 20, y0: 136, pas: 28, xBarre: 96, wBarre: j.W - 96 - 20, h: 12 },
    carte: { x: 20, y: 226, w: j.W - 40, h: 84 },
    options: { x: 20, y0: 348, w: j.W - 40, h: 74, pas: 84 },
  }
}

export const zoneOption = (d, i) => ({ x: d.options.x, y: d.options.y0 + i * d.options.pas, w: d.options.w, h: d.options.h })

export const dans = (p, z) => z && p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h
