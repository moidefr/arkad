/**
 * Le terrain — la moitié du jeu.
 *
 * Chaque hexagone porte un type, et un type n'est qu'un petit paquet de
 * nombres lus par trois endroits : le calcul de déplacement, la ligne de vue,
 * la formule de dégâts. Aucun terrain ne demande de code particulier, ce qui
 * permet d'en ajouter sans toucher aux règles.
 *
 *   cout            points de mouvement pour **entrer** dans l'hexagone
 *   couvert         réduction de dégâts subie sur place (négatif = à découvert)
 *   opaque          coupe la vue de qui n'est pas plus haut
 *   haut            0 plat · 1 hauteur · 2 relief majeur
 *   vue             portée de vue en plus depuis cet hexagone
 *   portee          portée de tir en plus depuis cet hexagone
 *   soin            points de vie rendus en fin de tour à qui s'y trouve
 *   furtif          on n'y voit une troupe qu'à un pas
 *   bloque          infranchissable
 */
import { C } from '../../palette.js'

export const TERRAINS = [
  { id: 'plaine', nom: 'PLAINE', court: 'PLA', cout: 1, couvert: 0, couleur: '#2c3a2e' },
  { id: 'herbe', nom: 'PRAIRIE', court: 'PRE', cout: 1, couvert: 0.04, couleur: '#31432f' },
  { id: 'champ', nom: 'CHAMP', court: 'CHP', cout: 1, couvert: 0.08, couleur: '#3d4029' },
  { id: 'route', nom: 'ROUTE', court: 'RTE', cout: 0.5, couvert: -0.06, couleur: '#413b31' },
  { id: 'pont', nom: 'PONT', court: 'PNT', cout: 1, couvert: -0.06, couleur: '#463d30' },
  { id: 'bosquet', nom: 'BOSQUET', court: 'BOS', cout: 1.5, couvert: 0.12, couleur: '#26402c' },
  { id: 'foret', nom: 'FORÊT', court: 'FOR', cout: 2, couvert: 0.2, opaque: true, furtif: true, couleur: '#1c3a26' },
  {
    id: 'colline',
    nom: 'COLLINE',
    court: 'COL',
    cout: 2,
    couvert: 0.15,
    opaque: true,
    haut: 1,
    vue: 2,
    portee: 1,
    couleur: '#4a4432',
  },
  { id: 'rocaille', nom: 'ROCAILLE', court: 'ROC', cout: 2, couvert: 0.18, couleur: '#3d4045' },
  { id: 'montagne', nom: 'MONTAGNE', court: 'MON', bloque: true, opaque: true, haut: 2, couleur: '#4d5158' },
  { id: 'marais', nom: 'MARAIS', court: 'MAR', cout: 3, couvert: -0.1, couleur: '#2a3a38' },
  { id: 'boue', nom: 'BOURBIER', court: 'BOU', cout: 2.5, couvert: -0.04, couleur: '#3a352b' },
  { id: 'riviere', nom: 'RIVIÈRE', court: 'RIV', cout: 3, couvert: -0.15, couleur: '#22404d' },
  { id: 'gue', nom: 'GUÉ', court: 'GUE', cout: 2, couvert: -0.08, couleur: '#2b4652' },
  { id: 'eau', nom: 'EAU PROFONDE', court: 'EAU', bloque: true, couleur: '#1b3341' },
  { id: 'ruines', nom: 'RUINES', court: 'RUI', cout: 2, couvert: 0.3, opaque: true, couleur: '#3a3a3a' },
  { id: 'mur', nom: 'MURAILLE', court: 'MUR', bloque: true, opaque: true, haut: 1, couleur: '#4a4640' },
  { id: 'village', nom: 'VILLAGE', court: 'VIL', cout: 1, couvert: 0.25, soin: 3, couleur: '#453b33' },
  { id: 'tranchee', nom: 'TRANCHÉE', court: 'TRA', cout: 2, couvert: 0.35, couleur: '#38352c' },
  { id: 'sable', nom: 'SABLE', court: 'SAB', cout: 2, couvert: -0.02, couleur: '#4c4634' },
  { id: 'neige', nom: 'NEIGE', court: 'NEI', cout: 2, couvert: 0.02, couleur: '#414a4c' },
  { id: 'glace', nom: 'GLACE', court: 'GLA', cout: 1, couvert: -0.12, couleur: '#33474f' },
]

/** Table `id → terrain`, et table indice → terrain : la sauvegarde stocke des indices. */
export const T = Object.fromEntries(TERRAINS.map((t) => [t.id, t]))
export const INDICE = Object.fromEntries(TERRAINS.map((t, i) => [t.id, i]))

export const terrainDe = (i) => TERRAINS[i] ?? TERRAINS[0]

export const cout = (t) => (t.bloque ? Infinity : t.cout)
export const couvert = (t) => t.couvert ?? 0
export const haut = (t) => t.haut ?? 0

/**
 * Les biomes — la recette d'un champ de bataille.
 *
 * `fond` est posé partout, puis les taches sont semées dans l'ordre. Un biome
 * n'est donc que trois lignes de données, et en ajouter un ne demande rien.
 */
export const BIOMES = [
  {
    id: 'plaine',
    nom: 'LA GRANDE PLAINE',
    fond: 'plaine',
    taches: [
      { t: 'herbe', n: 5, taille: 5 },
      { t: 'bosquet', n: 4, taille: 3 },
      { t: 'champ', n: 3, taille: 4 },
      { t: 'colline', n: 2, taille: 2 },
    ],
    route: 0.7,
  },
  {
    id: 'bocage',
    nom: 'LE BOCAGE',
    fond: 'herbe',
    taches: [
      { t: 'bosquet', n: 9, taille: 2 },
      { t: 'foret', n: 4, taille: 3 },
      { t: 'champ', n: 4, taille: 3 },
      { t: 'village', n: 1, taille: 2 },
    ],
    route: 0.5,
  },
  {
    id: 'foret',
    nom: 'LA SYLVE',
    fond: 'foret',
    taches: [
      { t: 'herbe', n: 5, taille: 3 },
      { t: 'bosquet', n: 5, taille: 3 },
      { t: 'plaine', n: 3, taille: 2 },
      { t: 'marais', n: 2, taille: 2 },
    ],
    route: 0.35,
  },
  {
    id: 'collines',
    nom: 'LES HAUTS',
    fond: 'herbe',
    taches: [
      { t: 'colline', n: 7, taille: 3 },
      { t: 'rocaille', n: 4, taille: 2 },
      { t: 'montagne', n: 2, taille: 2 },
      { t: 'bosquet', n: 3, taille: 2 },
    ],
    route: 0.45,
  },
  {
    id: 'marais',
    nom: 'LES FONDRIÈRES',
    fond: 'boue',
    taches: [
      { t: 'marais', n: 7, taille: 3 },
      { t: 'eau', n: 3, taille: 2 },
      { t: 'bosquet', n: 4, taille: 2 },
      { t: 'herbe', n: 3, taille: 3 },
    ],
    riviere: true,
    route: 0.25,
  },
  {
    id: 'desert',
    nom: 'LES SABLES',
    fond: 'sable',
    taches: [
      { t: 'rocaille', n: 5, taille: 3 },
      { t: 'plaine', n: 4, taille: 3 },
      { t: 'ruines', n: 2, taille: 2 },
      { t: 'montagne', n: 2, taille: 2 },
    ],
    route: 0.4,
  },
  {
    id: 'ruines',
    nom: 'LA VILLE MORTE',
    fond: 'plaine',
    taches: [
      { t: 'ruines', n: 8, taille: 3 },
      { t: 'mur', n: 5, taille: 2 },
      { t: 'village', n: 3, taille: 2 },
      { t: 'tranchee', n: 3, taille: 2 },
    ],
    route: 0.9,
  },
  {
    id: 'hiver',
    nom: 'LE GRAND FROID',
    fond: 'neige',
    taches: [
      { t: 'glace', n: 4, taille: 3 },
      { t: 'foret', n: 4, taille: 3 },
      { t: 'colline', n: 3, taille: 2 },
      { t: 'rocaille', n: 3, taille: 2 },
    ],
    route: 0.4,
  },
  {
    id: 'fleuve',
    nom: 'LE PASSAGE',
    fond: 'herbe',
    taches: [
      { t: 'bosquet', n: 4, taille: 2 },
      { t: 'champ', n: 4, taille: 3 },
      { t: 'village', n: 2, taille: 2 },
      { t: 'colline', n: 2, taille: 2 },
    ],
    riviere: true,
    route: 0.85,
  },
  {
    id: 'front',
    nom: 'LE FRONT FIGÉ',
    fond: 'boue',
    taches: [
      { t: 'tranchee', n: 8, taille: 2 },
      { t: 'ruines', n: 4, taille: 2 },
      { t: 'rocaille', n: 3, taille: 2 },
      { t: 'marais', n: 3, taille: 2 },
    ],
    route: 0.3,
  },
]

/** Une teinte de repère par terrain, pour la légende et les pastilles. */
export const teinteTerrain = (t) => (t.haut ? C.faible : t.couvert > 0.15 ? C.vert : t.couvert < 0 ? C.rouge : C.faible)
