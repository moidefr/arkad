/**
 * Les deux formats de la borne, et la question « faut-il tourner le
 * téléphone ? ».
 *
 * ARKAD a toujours dessiné dans un espace logique de 360 × 640. Certains jeux
 * — une carte hexagonale, une grille de démineur, un atelier qui s'étale —
 * respirent nettement mieux dans **640 × 360**. Plutôt que d'étirer le
 * portrait, on donne à ces jeux-là un second gabarit, et on laisse les autres
 * tranquilles.
 *
 * Un jeu déclare deux choses, et rien d'autre :
 *
 *   paysage: true        il **sait** se dessiner en 640 × 360
 *   confort: 'paysage'   et c'est **là qu'il est le mieux**
 *
 * Le premier autorise le format, le second déclenche la suggestion. Un jeu
 * qui n'a ni l'un ni l'autre reste en portrait pour toujours, et c'est très
 * bien : un jeu de chute ou d'escalade n'a rien à gagner à être couché.
 */

export const FORMATS = {
  portrait: { W: 360, H: 640 },
  paysage: { W: 640, H: 360 },
}

/** Le bandeau du haut ne change pas de hauteur : les jeux comptent dessus. */
export const HUD = 56

/**
 * L'orientation de l'appareil. La marge de 8 % évite qu'un écran presque
 * carré — une tablette en fenêtre, un ordinateur redimensionné — bascule à
 * chaque pixel.
 */
export function orientationAppareil(w, h) {
  const l = w ?? globalThis.innerWidth ?? FORMATS.portrait.W
  const haut = h ?? globalThis.innerHeight ?? FORMATS.portrait.H
  return l > haut * 1.08 ? 'paysage' : 'portrait'
}

/**
 * Vrai seulement si le pointeur principal est un doigt. Un PC dont la
 * fenêtre est large n'est pas « couché » — il est juste large, et rien ne
 * peut le faire tourner. C'est ce qui distingue « ce jeu se dessine en
 * portrait » (vrai partout, la toile reste nette dans une fenêtre large) de
 * « conseiller de tourner l'appareil » (n'a de sens que sur un appareil qui
 * peut vraiment tourner).
 */
export function estTactile() {
  return typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)').matches : true
}

/** Le format dans lequel ce jeu doit tourner, compte tenu de l'appareil. */
export function formatPour(def, orientation) {
  return orientation === 'paysage' && def?.paysage ? 'paysage' : 'portrait'
}

/** Le gabarit à utiliser : hors d'un jeu, c'est l'appareil qui décide seul. */
export const tailleDe = (format) => FORMATS[format] ?? FORMATS.portrait

/**
 * Faut-il conseiller de tourner l'appareil, et dans quel sens ?
 *
 * Deux cas seulement, et ils sont symétriques : on tient l'appareil couché
 * devant un jeu qui ne sait pas l'être — il va se retrouver dans une bande
 * étroite au milieu — ou bien on le tient droit devant un jeu qui serait
 * franchement mieux couché. Dans tous les autres cas on ne dit rien : un
 * conseil qu'on voit trois fois par jour n'est plus un conseil.
 */
export function suggestion(def, orientation) {
  if (!def) return null
  if (orientation === 'paysage' && !def.paysage) return 'portrait'
  if (orientation === 'portrait' && def.confort === 'paysage') return 'paysage'
  return null
}
