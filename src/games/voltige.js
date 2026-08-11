import { C } from '../palette.js'
import { texte, rect } from '../dessin.js'

const LARGEUR_COL = 20
const X_JOUEUR = 84
const TAILLE = 16
const POUSSEE = 780
const GRAVITE = 700

export default {
  id: 'voltige',
  nom: 'VOLTIGE',
  pitch: 'Maintiens pour monter, lâche pour descendre',
  couleur: C.cyan,
  unite: 'm',

  init(j) {
    j.e.y = (j.HUD + j.H) / 2
    j.e.vy = 0
    j.e.centre = j.e.y
    j.e.ouverture = 210
    j.e.decalage = 0
    j.e.cols = []
    // On remplit l'écran de colonnes dès le départ, sinon le tunnel apparaît
    // progressivement et les premières secondes sont vides.
    for (let i = 0; i < j.W / LARGEUR_COL + 3; i++) ajoute(j)
  },

  maj(j, dt) {
    const vitesse = 150 + j.t * 6
    j.score += dt * 12

    j.e.vy += (j.maintenu ? -POUSSEE : GRAVITE) * dt
    j.e.vy = Math.max(-320, Math.min(320, j.e.vy))
    j.e.y += j.e.vy * dt

    j.e.decalage += vitesse * dt
    while (j.e.decalage >= LARGEUR_COL) {
      j.e.decalage -= LARGEUR_COL
      j.e.cols.shift()
      ajoute(j)
    }

    // Le tunnel se resserre lentement : c'est toute la courbe de difficulté.
    j.e.ouverture = Math.max(96, 210 - j.t * 2.6)

    const i = Math.floor((X_JOUEUR + j.e.decalage) / LARGEUR_COL)
    const col = j.e.cols[i]
    if (!col) return
    if (j.e.y - TAILLE / 2 < col.haut || j.e.y + TAILLE / 2 > col.bas) j.perdu()
  },

  dessine(j, ctx) {
    j.e.cols.forEach((col, i) => {
      const x = i * LARGEUR_COL - j.e.decalage
      rect(ctx, x, j.HUD, LARGEUR_COL, col.haut - j.HUD, C.bord)
      rect(ctx, x, col.haut - 4, LARGEUR_COL, 4, C.cyan)
      rect(ctx, x, col.bas, LARGEUR_COL, j.H - col.bas, C.bord)
      rect(ctx, x, col.bas, LARGEUR_COL, 4, C.cyan)
    })

    rect(ctx, X_JOUEUR - TAILLE / 2, j.e.y - TAILLE / 2, TAILLE, TAILLE, C.accent)
    // Une traînée quand ça pousse : le seul retour visuel sur l'appui.
    if (j.maintenu) rect(ctx, X_JOUEUR - 4, j.e.y + TAILLE / 2, 8, 10, C.rouge)

    if (j.t < 3) texte(ctx, 'maintiens appuyé', j.W / 2, j.H - 40, 12, C.faible, 700)
  },
}

function ajoute(j) {
  const derniere = j.e.cols[j.e.cols.length - 1]
  const bas = j.H - 20
  const haut = j.HUD + 20
  const amplitude = 26

  let centre = derniere ? derniere.centre + (Math.random() * 2 - 1) * amplitude : (j.HUD + j.H) / 2
  centre = Math.max(haut + j.e.ouverture / 2, Math.min(bas - j.e.ouverture / 2, centre))

  j.e.cols.push({
    centre,
    haut: centre - j.e.ouverture / 2,
    bas: centre + j.e.ouverture / 2,
  })
}
