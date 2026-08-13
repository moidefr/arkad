/**
 * Deux façons de peindre la même borne.
 *
 * ARKAD est né sur un terminal à phosphore ambré : gros pixels, angles droits,
 * dégradés au tramage. C'est une identité, et elle tient. Mais un jeu de blocs
 * ou un jeu de rythme se joue aussi, ailleurs, avec des couleurs pleines et des
 * coins adoucis — et il n'y a pas de raison d'imposer le tube à qui préfère ça.
 *
 * **La règle qui rend l'ensemble tenable : un thème change le rendu, jamais la
 * disposition.** Aucune coordonnée, aucune taille, aucune zone tactile ne
 * dépend du thème. Un bouton est au même endroit et fait la même taille dans
 * les deux ; seuls sa couleur, ses coins et son relief changent. C'est ce qui
 * permet de basculer en pleine partie sans rien casser, et c'est ce qui fait
 * qu'un seul jeu de tests d'écran couvre les deux thèmes.
 *
 * D'où le vocabulaire ci-dessous : que des *traits de peinture*, pas une seule
 * mesure. Le jour où un thème voudra déplacer quelque chose, c'est ce fichier
 * qu'il faudra rediscuter, pas contourner.
 */
import { C } from './palette.js'
import { lis, ecris } from './stockage.js'

/** La palette d'origine, mise de côté avant que quiconque n'y touche. */
const PHOSPHORE = { ...C }

export const THEMES = {
  phosphore: {
    id: 'phosphore',
    nom: 'PHOSPHORE',
    pitch: 'le terminal ambré',
    couleurs: PHOSPHORE,
    // Les traits. Chacun est lu à un seul endroit de `dessin.js`.
    arrondi: 0, // rayon des coins, en pixels logiques
    relief: 'arete', // comment `bloc()` donne du corps : arêtes ou dégradé
    halo: 1, // multiplicateur de `lueur()`
    trame: true, // dégradés au tramage de Bayer plutôt qu'interpolés
    balayage: true, // les lignes du tube
    vignette: true, // les bords assombris
  },

  moderne: {
    id: 'moderne',
    nom: 'MODERNE',
    pitch: 'couleurs pleines, coins adoucis',
    couleurs: {
      // Un bleu de nuit plutôt qu'un noir verdâtre : c'est le fond sur lequel
      // les jeux de blocs et de rythme posent leurs couleurs depuis toujours,
      // et il fait ressortir le saturé là où le phosphore l'éteignait.
      fond: '#12142a',
      panneau: '#1e2145',
      bord: '#3a4180',
      texte: '#f2f4ff',
      faible: '#8b91c4',

      accent: '#ffc233',
      vert: '#3ddc84',
      cyan: '#22d3ee',
      violet: '#a855f7',
      rouge: '#f43f5e',
    },
    arrondi: 5,
    relief: 'degrade',
    halo: 1.7,
    trame: false,
    balayage: false,
    vignette: false,
  },
}

export const IDS = Object.keys(THEMES)

class Theme {
  constructor() {
    const lu = lis('theme', null)
    this.id = THEMES[lu] ? lu : 'phosphore'
    this._applique()
  }

  get traits() {
    return THEMES[this.id]
  }

  get nom() {
    return this.traits.nom
  }

  /**
   * Réécrit la palette **en place**. Les vingt-six jeux font
   * `import { C } from './palette.js'` et gardent la référence : remplacer
   * l'objet ne les toucherait pas, le modifier les touche tous.
   */
  _applique() {
    Object.assign(C, this.traits.couleurs)
  }

  choisis(id) {
    if (!THEMES[id] || id === this.id) return this.id
    this.id = id
    ecris('theme', id)
    this._applique()
    return this.id
  }

  bascule() {
    return this.choisis(IDS[(IDS.indexOf(this.id) + 1) % IDS.length])
  }
}

export const theme = new Theme()
