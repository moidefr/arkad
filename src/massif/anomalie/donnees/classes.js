import { C } from '../../../palette.js'

/**
 * Les classes. Chacune tient un territoire mécanique que personne d'autre
 * n'occupe : c'est ce qui fait qu'une équipe de trois est un choix et non un
 * tirage. Trois pour l'instant, huit à terme.
 *
 * `depart` sont les deux compétences verrouillées — on ne peut pas les jeter.
 * `reserve` est ce que le butin peut proposer à un opérateur de cette classe.
 */
export const CLASSES = [
  {
    id: 'analyste',
    nom: 'ANALYSTE',
    court: 'A',
    couleur: C.cyan,
    territoire: 'révélation',
    dit: 'Marque, expose, et transforme ce qu’il sait en dégâts pour les autres.',
    pv: 46,
    puiss: 5,
    vit: 11,
    blindage: 1,
    rang: 1,
    depart: ['sonde', 'faille'],
    reserve: ['balayage', 'exploit', 'rapport', 'brouillage'],
  },
  {
    id: 'briseur',
    nom: 'BRISEUR',
    court: 'B',
    couleur: C.rouge,
    territoire: 'contact',
    dit: 'Tient le rang avant, casse le blindage, frappe le plus fort de tous.',
    pv: 66,
    puiss: 8,
    vit: 7,
    blindage: 4,
    rang: 0,
    depart: ['masse', 'ancre'],
    reserve: ['ebranle', 'onde', 'charge', 'demolition'],
  },
  {
    id: 'tisseur',
    nom: 'TISSEUR',
    court: 'T',
    couleur: C.vert,
    territoire: 'tenue',
    dit: 'Pare-feux, correctifs, et il déplace tout le monde — alliés compris.',
    pv: 52,
    puiss: 4,
    vit: 9,
    blindage: 2,
    rang: 1,
    depart: ['correctif', 'purge'],
    reserve: ['muraille', 'permutation', 'filtre', 'suture'],
  },
  {
    id: 'vecteur',
    nom: 'VECTEUR',
    court: 'V',
    couleur: C.violet,
    territoire: 'corruption',
    dit: 'Il ne frappe pas : il ronge. Ni blindage ni pare-feu n’arrêtent une fuite.',
    pv: 48,
    puiss: 6,
    vit: 10,
    blindage: 1,
    rang: 1,
    depart: ['injecte', 'diffuse'],
    reserve: ['ver', 'catalyse', 'siphon', 'essaimage'],
  },
  {
    id: 'horloge',
    nom: 'HORLOGE',
    court: 'H',
    couleur: C.accent,
    territoire: 'tempo',
    dit: 'Elle ne décide pas des dégâts, elle décide de l’ordre — et l’ordre décide du reste.',
    pv: 44,
    puiss: 5,
    vit: 13,
    blindage: 1,
    rang: 1,
    depart: ['retard', 'devance'],
    reserve: ['accelere', 'gel', 'impulsion', 'cascade'],
  },
]

export const CLASSE = Object.fromEntries(CLASSES.map((c) => [c.id, c]))

/** Les noms d'opérateur, tirés dans l'ordre. Trois par partie. */
export const NOMS = ['SILAS', 'WREN', 'ORB', 'KADE', 'NILS', 'VESP', 'TARN', 'IRIS', 'MOSS', 'ELKO']
