/**
 * Traduit une URL en état de la borne, et inversement.
 *
 * Le seul endroit à connaître les deux sens du chemin : `depuisChemin` pour
 * atterrir directement sur une catégorie ou un jeu, `cheminDe` pour que
 * chaque appui du joueur laisse une adresse qu'on peut partager ou
 * retrouver. Ni l'un ni l'autre ne touche au DOM — testable sous
 * `node --test`, sans simulacre.
 */
import { CATEGORIES } from './catalogue.js'

/**
 * Un chemin d'URL ('/', '/court/', '/court/corde/', …) -> { cat, def }, ou
 * `null` si le premier segment ne correspond à aucune catégorie connue (lien
 * mort, vieux favori) — l'appelant retombe alors sur l'accueil.
 *
 * Un deuxième segment qui ne correspond à aucun jeu de la catégorie est
 * ignoré plutôt que rejeté : `def` retombe à `null` et l'appelant atterrit
 * sur l'écran de la catégorie, pas sur l'accueil — c'est le mieux qu'on
 * puisse faire d'un lien à moitié valide.
 */
export function depuisChemin(chemin) {
  const parts = chemin.split('/').filter(Boolean)
  if (parts.length === 0) return { cat: null, def: null }
  const cat = CATEGORIES.find((c) => c.id === parts[0])
  if (!cat) return null
  const def = parts[1] ? (cat.jeux.find((j) => j.id === parts[1]) ?? null) : null
  return { cat, def }
}

/** L'inverse : { cat, def } -> chemin canonique, toujours terminé par « / ». */
export function cheminDe(cat, def) {
  if (!cat) return '/'
  return def ? `/${cat.id}/${def.id}/` : `/${cat.id}/`
}
