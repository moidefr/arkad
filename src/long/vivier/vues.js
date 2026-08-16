import { C, ton } from '../../palette.js'
import { texte, rect, cadre, bloc, pastille, borne } from '../../dessin.js'
import { TRAITS, CAPACITE, NOURRITURE_MAX, TOTAL_COMBOS, CYCLE_LENT, CYCLE_RAPIDE, COUT_PONTE } from './donnees.js'
import * as L from './logique.js'
import { zoneCreature, zoneCase } from './dispo.js'

const valeurDe = (cle, id) => TRAITS.find((t) => t.cle === cle).valeurs.find((v) => v.id === id)

/** Le nom lisible d'une combinaison, dans l'ordre des gènes. */
export const nomDe = (phen) => phen.map((id, i) => valeurDe(TRAITS[i].cle, id).nom).join(' · ')

/** La forme seule, dans une couleur donnée — le corps de la créature. */
function dessineForme(ctx, cx, cy, r, formeId, couleur, ep) {
  if (formeId === 'ronde') pastille(ctx, cx, cy, r, couleur)
  else if (formeId === 'anguleuse') bloc(ctx, cx - r, cy - r, r * 2, r * 2, couleur, ep)
  else bloc(ctx, cx - r * 1.3, cy - r * 0.62, r * 2.6, r * 1.24, couleur, ep)
}

/**
 * Une créature, dessinée depuis son phénotype — jamais depuis une image.
 * La couleur et le motif sont ce que le joueur découvre ; la forme et la
 * taille se lisent déjà sur une silhouette (voir `dessineSilhouette`).
 */
export function dessineCreature(ctx, cx, cy, rayon, phen) {
  const [couleurId, formeId, motifId, tailleId] = phen
  const couleur = valeurDe('couleur', couleurId).couleur
  const echelle = valeurDe('taille', tailleId).echelle
  const r = Math.max(3, rayon * echelle)
  const ep = Math.max(1, r * 0.2)

  dessineForme(ctx, cx, cy, r, formeId, couleur, ep)

  if (motifId === 'tachete') {
    const sombre = ton(couleur, -0.42)
    pastille(ctx, cx - r * 0.42, cy - r * 0.18, Math.max(1, r * 0.2), sombre)
    pastille(ctx, cx + r * 0.36, cy + r * 0.14, Math.max(1, r * 0.16), sombre)
    pastille(ctx, cx - r * 0.05, cy + r * 0.4, Math.max(1, r * 0.14), sombre)
  } else if (motifId === 'raye') {
    const sombre = ton(couleur, -0.42)
    for (let k = -1; k <= 1; k++) rect(ctx, cx - r, cy + k * r * 0.5 - 1, r * 2, Math.max(1, r * 0.14), sombre)
  }
}

/** Le contour d'une combinaison pas encore vue : la forme et la taille se devinent, la couleur non. */
function dessineSilhouette(ctx, cx, cy, rayon, phen) {
  const tailleId = phen[3]
  const echelle = valeurDe('taille', tailleId).echelle
  const r = Math.max(3, rayon * echelle)
  dessineForme(ctx, cx, cy, r, phen[1], C.bord, Math.max(1, r * 0.2))
}

export function dessine(ctx, d, j, e) {
  ctx.textAlign = 'left'
  texte(ctx, `${e.bassin.length} EN VIE`, d.jauge.x, 74, 15, C.faible, 700)
  ctx.textAlign = 'right'
  texte(ctx, `${e.decouvertes.length} / ${TOTAL_COMBOS} DÉCOUVERTES`, j.W - d.jauge.x, 74, 14, C.rouge, 700)
  ctx.textAlign = 'center'

  // Pendant les toutes premières secondes, ce que le bassin a fait sans qu'on regarde.
  if (e.horsLigne?.naissances && j.t < 8) {
    const dit = `pendant ton absence : +${e.horsLigne.naissances} naissance${e.horsLigne.naissances > 1 ? 's' : ''}` +
      (e.horsLigne.decouvertes ? `, +${e.horsLigne.decouvertes} découverte${e.horsLigne.decouvertes > 1 ? 's' : ''}` : '')
    texte(ctx, dit, j.W / 2, 96, 12, C.rouge, 700, j.W - 40)
  } else {
    const reste = Math.max(0, Math.ceil(e.minuterie))
    texte(ctx, `prochaine ponte dans ${reste} s`, j.W / 2, 96, 12, C.faible, 700)
  }

  // La nourriture : jamais nécessaire, mais elle accélère le cycle en cours.
  const g = d.jauge
  rect(ctx, g.x, g.y, g.w, g.h, C.panneau)
  const part = borne(e.nourriture / NOURRITURE_MAX, 0, 1)
  if (part > 0) bloc(ctx, g.x, g.y, g.w * part, g.h, C.rouge, 2)
  const intervalRef = e.nourriture >= COUT_PONTE ? CYCLE_RAPIDE : CYCLE_LENT
  const avancement = borne(1 - e.minuterie / intervalRef, 0, 1)
  rect(ctx, g.x, g.y + g.h + 3, g.w, 3, C.panneau)
  rect(ctx, g.x, g.y + g.h + 3, g.w * avancement, 3, ton(C.rouge, -0.2))

  // Le bassin : ce qui vit là, maintenant.
  const b = d.bassin
  rect(ctx, b.x, b.y, b.w, b.h, C.panneau)
  cadre(ctx, b.x, b.y, b.w, b.h, C.bord)
  const rayon = Math.min(b.w / b.cases, b.h / 2) * 0.32
  e.bassin.forEach((c, i) => {
    if (i >= CAPACITE) return
    const z = zoneCreature(d, i)
    dessineCreature(ctx, z.x + z.w / 2, z.y + z.h / 2, rayon, L.phenotype(c.genotype))
  })

  // La collection : une grille de silhouettes, colorées à mesure qu'on les trouve.
  const rayonGrille = d.grille.cote * 0.36
  for (let i = 0; i < TOTAL_COMBOS; i++) {
    const z = zoneCase(d, i)
    const phen = L.comboDeIndex(i)
    const trouvee = e.decouvertes.includes(L.comboId(phen))
    rect(ctx, z.x + 1, z.y + 1, z.w - 2, z.h - 2, C.panneau)
    if (trouvee) dessineCreature(ctx, z.x + z.w / 2, z.y + z.h / 2, rayonGrille, phen)
    else dessineSilhouette(ctx, z.x + z.w / 2, z.y + z.h / 2, rayonGrille, phen)
  }

  // Nourrir : un geste simple, jamais urgent.
  const boutonPlein = e.nourriture < NOURRITURE_MAX
  rect(ctx, d.bouton.x, d.bouton.y, d.bouton.w, d.bouton.h, C.panneau)
  cadre(ctx, d.bouton.x, d.bouton.y, d.bouton.w, d.bouton.h, boutonPlein ? C.rouge : C.bord)
  texte(ctx, 'NOURRIR', j.W / 2, d.bouton.y + d.bouton.h / 2, 15, boutonPlein ? C.rouge : C.bord, 700)
}
