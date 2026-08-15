/**
 * Où tombe chaque chose, dans les deux gabarits.
 *
 * Un seul endroit décide des rectangles, et le dessin comme l'appui le lisent.
 * C'est la règle qui a manqué une fois à ce jeu : les lignes posées au dessin
 * étaient recalculées au moment du doigt, plus rien n'était achetable, et
 * aucune erreur n'était levée — un écart de disposition ne plante pas, il rend
 * le jeu muet.
 *
 * **Debout**, la scène et la liste se partagent la hauteur. Les valeurs de ce
 * cas-là sont celles d'avant, écrites en clair et pas recalculées : l'usine
 * était réglée, elle ne bouge pas d'un pixel.
 *
 * **Couché**, elles se partagent la largeur. L'atelier cesse d'être une frise
 * de 186 px et redevient une usine haute de 244 ; la liste perd une ligne de
 * fenêtre — quatre pleines au lieu de cinq — et gagne d'être visible en même
 * temps que la machine qu'on y achète. Le marché est bon : dans un incrémental,
 * voir ce qu'on bâtit pendant qu'on l'achète est tout l'intérêt.
 */

export function dispo(j) {
  return j.W > j.H ? couche(j) : debout(j)
}

/**
 * Le doigt tombe-t-il dans la liste ?
 *
 * `coupe` est l'abscisse à gauche de laquelle il appartient toujours à la
 * scène. Debout elle vaut zéro : la scène est **au-dessus** de la liste, pas à
 * côté, et le test se ramène au seul `p.y >= liste.y` d'origine.
 */
export const dansListe = (d, p) => p.y >= d.liste.y && p.x >= d.coupe

/** Le bord gauche d'un onglet. */
export const ongletX = (d, k) => d.barre.x + k * d.barre.pas

/** La hauteur visible d'un onglet : l'atelier cède la place au panneau de refonte. */
export const fenetreDe = (d, vue) => (vue === 'atelier' ? d.fonte.y - d.liste.y - 8 : d.liste.h)

function debout() {
  return {
    large: false,
    coupe: 0,
    separateur: null,
    entete: { cx: 180, gauche: 16, droite: 344, y: 82, yBas: 104, max: 320, prod: 150, lingots: 180 },

    scene: { x: 0, y: 116, w: 360, h: 186 },
    ciel: { y: 116, h: 48 },
    roche: { x: 6, y: 120, w: 50, h: 156 },
    etages: [
      { sol: 276, haut: 232 },
      { sol: 218, haut: 176 },
    ],
    poste: { x0: 62, pas: 58, w: 40 },
    // L'étage du haut loge deux volées de cinq machines (les cinq d'origine,
    // et les cinq du troisième palier) au lieu d'une seule : postes plus
    // étroits, même largeur d'étage, aucun changement vertical à risquer.
    posteHaut: { x0: 64, pas: 28, w: 22 },
    passerelle: { x: 48, w: 306, piliers: [64, 158, 252, 340] },
    lampes: [70, 170, 270, 330],
    ouvriers: { x0: 50, larg: 268 },
    bande: { y: 284, h: 10 },
    foyer: { x: 180, y: 240 },
    avis: { x: 40, y: 284, w: 280, h: 22 },

    barre: { x: 12, y: 308, w: 82, h: 34, pas: 86 },
    liste: { x: 16, y: 350, w: 328, h: 272 },
    ligne: { gauche: 32, droite: 336, centre: 180 },
    ascenseur: { x: 353, w: 3 },
    fonte: { x: 16, y: 546, w: 328, h: 74 },
    pied: 630,
  }
}

/**
 * Couché : la scène tient la moitié gauche, les onglets et la liste la moitié
 * droite. La coupure est à 318 plutôt qu'à 320 — une liste doit tenir ses
 * libellés jusqu'au bout, une usine se contente de ce qu'on lui laisse.
 */
function couche(j) {
  const coupe = 318
  const liste = { x: 330, y: 100, w: 288, h: 236 }
  return {
    large: true,
    coupe,
    separateur: { x: coupe + 4, y: 62, w: 2, h: j.H - 74 },
    // Le compteur reste au-dessus de la scène, à sa place de toujours : c'est
    // l'état de l'usine, il regarde l'usine. La colonne de droite garde ainsi
    // toute sa hauteur pour la liste.
    entete: { cx: 159, gauche: 12, droite: 306, y: 82, yBas: 104, max: 294, prod: 134, lingots: 160 },

    scene: { x: 0, y: 116, w: coupe, h: j.H - 116 },
    ciel: { y: 116, h: 60 },
    roche: { x: 6, y: 120, w: 56, h: 206 },
    // Les deux étages cessent de se marcher dessus : 64 px de machine au lieu
    // de 44, et un ciel qui n'est plus un liseré.
    etages: [
      { sol: 326, haut: 262 },
      { sol: 250, haut: 186 },
    ],
    poste: { x0: 68, pas: 50, w: 40 },
    posteHaut: { x0: 66, pas: 25, w: 20 },
    passerelle: { x: 54, w: 258, piliers: [70, 148, 226, 298] },
    lampes: [70, 150, 230, 290],
    ouvriers: { x0: 50, larg: 220 },
    bande: { y: 334, h: 10 },
    foyer: { x: 159, y: 270 },
    avis: { x: 30, y: 330, w: 258, h: 22 },

    barre: { x: liste.x, y: 62, w: 69, h: 30, pas: 73 },
    liste,
    ligne: { gauche: liste.x + 16, droite: liste.x + liste.w - 8, centre: liste.x + liste.w / 2 },
    ascenseur: { x: liste.x + liste.w + 9, w: 3 },
    fonte: { x: liste.x, y: liste.y + liste.h - 74, w: liste.w, h: 74 },
    pied: j.H - 12,
  }
}
