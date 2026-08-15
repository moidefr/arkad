import { C } from '../../palette.js'

/**
 * Les tables d'EXPÉDITION. Rien ici ne lance de dé — c'est `logique.js` qui
 * décide, avec un hasard qui vient toujours du moteur.
 *
 * Chaque option porte ses effets garantis (`vivres`/`eau`/`sante`/`km`), et
 * peut en plus porter une `chance` : `{ p, ...jauges }` tentée avec la
 * probabilité `p`, `sinon` s'appliquant si elle échoue. C'est le risk-reward
 * qui manquait à l'ancienne version — sans lui, la meilleure option d'une
 * journée était toujours connue d'avance.
 *
 * `dur: true` marque un choix qui pousse le corps ; `repos: true` un choix
 * qui le laisse souffler. C'est ce que lit la fatigue cumulative dans
 * `logique.js`.
 *
 * `favorise: 'eau'|'vivres'|'sante'` marque une journée dont le thème colle
 * à une jauge : le tirage la préfère quand cette jauge est basse, plutôt que
 * de tirer uniformément et laisser un joueur assoiffé attendre une journée
 * d'eau par pure chance.
 *
 * `beat: 'corde'|'carte'|'remede'` marque la journée qui fait connaître un
 * objet-clé. Elle peut sortir au tirage normal, mais si l'objet n'a toujours
 * pas été obtenu passé `auJour` jours dans l'étape, elle est forcée — un
 * joueur ne peut plus rater silencieusement un objet dont il aura besoin.
 *
 * `route: 'sur'|'risque'` réserve une journée à la route choisie à la
 * frontière précédente (voir `EMBRANCHEMENT`). Les journées sans `route`
 * restent tirables sur les deux routes.
 */

export const ARRIVEE = 900 // kilomètres, sur la route neutre

export const JAUGES = [
  { cle: 'vivres', nom: 'VIVRES', couleur: C.accent },
  { cle: 'eau', nom: 'EAU', couleur: C.cyan },
  { cle: 'sante', nom: 'SANTÉ', couleur: C.vert },
]

export const OBJETS = {
  corde: 'CORDE',
  carte: 'CARTE',
  remede: 'REMÈDE',
}

// La route sûre allonge la traversée qui vient (moins de risque, plus de
// jours) ; la route risquée la raccourcit (un vrai raccourci, quitte à tomber
// sur son pool le plus dur). Décalage appliqué à la frontière *lointaine* de
// l'étape qu'on vient d'entamer.
export const BRANCHE_KM = 20

// La fatigue cumulative casse la stratégie « toujours le meilleur rapport
// km/coût » : enchaîner des journées dures without se reposer ampute les
// gains du jour, jusqu'à ce qu'on lève le pied.
export const FATIGUE_MAX = 4
export const FATIGUE_SEUIL = 3
export const FATIGUE_PENALITE = 0.55

export const EMBRANCHEMENT = {
  texte: 'La route se sépare. Une voie plus sûre serpente plus loin ; un raccourci coupe au plus court, à l’aveugle.',
  a: { l: 'LA ROUTE SÛRE', route: 'sur', km: 0, sante: 2 },
  b: { l: 'LE RACCOURCI', route: 'risque', km: 0, sante: -2 },
}

export const ETAPES = [
  {
    nom: 'LA PLAINE',
    jusqu: 230,
    couleur: C.vert,
    journees: [
      {
        texte: 'Une plaine ouverte, aucun abri en vue.',
        a: { l: 'MARCHER VITE', km: 28, dur: true, vivres: -10, eau: -15, sante: -4 },
        b: { l: 'MÉNAGER LES FORCES', km: 14, repos: true, vivres: -6, eau: -8, sante: 2 },
      },
      {
        texte: 'Un ruisseau clair descend d’une crête lointaine.',
        favorise: 'eau',
        a: { l: 'REMPLIR LES OUTRES', km: 9, eau: 6, vivres: -5, chance: { p: 0.65, eau: 9 }, sinon: { eau: 2, sante: -3 } },
        b: { l: 'PASSER SANS S’ARRÊTER', km: 24, eau: -14, vivres: -7 },
      },
      {
        texte: 'Des traces de gibier dans la boue séchée.',
        favorise: 'vivres',
        a: { l: 'CHASSER', km: 7, dur: true, eau: -10, chance: { p: 0.55, vivres: 29, sante: -3 }, sinon: { vivres: 5, sante: -6 } },
        b: { l: 'CONTINUER', km: 22, vivres: -8, eau: -11 },
      },
      {
        texte: 'Une charrette renversée, à moitié pillée.',
        beat: 'corde',
        auJour: 3,
        a: { l: 'FOUILLER', km: 6, vivres: 14, eau: 4, sante: -2, objet: 'corde' },
        b: { l: 'NE PAS S’ATTARDER', km: 23, vivres: -7, eau: -10 },
      },
      {
        texte: 'Un hameau méfiant. On te propose un échange.',
        beat: 'remede',
        auJour: 7,
        a: { l: 'DONNER DES VIVRES', km: 25, vivres: -18, sante: 10, objet: 'remede' },
        b: { l: 'REFUSER POLIMENT', km: 18, vivres: -7, eau: -10 },
      },
      {
        texte: 'Un vieux te propose de recopier sa carte, contre un repas.',
        beat: 'carte',
        auJour: 5,
        a: { l: 'ACCEPTER', km: 10, vivres: -16, objet: 'carte' },
        b: { l: 'SE FIER AU SOLEIL', km: 21, vivres: -7, eau: -11 },
      },
      {
        texte: 'Des nuées de mouches tournent autour d’une carcasse.',
        a: { l: 'EXAMINER DE PRÈS', km: 8, sante: -2, chance: { p: 0.5, vivres: 17 }, sinon: { sante: -10 } },
        b: { l: 'S’ÉLOIGNER', km: 20, vivres: -8, eau: -11 },
      },
      {
        texte: 'Le ciel se couvre d’un coup. La pluie ne va pas tarder.',
        a: { l: 'PROFITER DE L’AVERSE', km: 11, repos: true, eau: 7, sante: -4 },
        b: { l: 'AVANCER AVANT L’ORAGE', km: 26, dur: true, vivres: -9, eau: -10, sante: -3 },
      },
      {
        texte: 'Un chien errant te suit depuis une heure, la langue pendante.',
        favorise: 'sante',
        a: { l: 'LUI DONNER À MANGER', km: 14, vivres: -11, sante: 6 },
        b: { l: 'L’IGNORER', km: 24, vivres: -8, eau: -11 },
      },
      {
        texte: 'Des fermiers battent le blé, la récolte est bonne cette année.',
        favorise: 'vivres',
        a: { l: 'PROPOSER DE L’AIDE', km: 9, sante: -6, chance: { p: 0.7, vivres: 24 }, sinon: { vivres: 9 } },
        b: { l: 'PASSER SON CHEMIN', km: 21, vivres: -8, eau: -10 },
      },
      {
        texte: 'Une borne à moitié effacée indique deux directions.',
        a: { l: 'LE CHEMIN DIRECT', km: 24, dur: true, vivres: -9, eau: -13 },
        b: { l: 'LE DÉTOUR PAR LE VILLAGE', km: 15, repos: true, vivres: 2, eau: 2 },
      },
      {
        texte: 'La nuit tombe vite. Un feu de camp au loin, des voix.',
        a: { l: 'S’Y JOINDRE', km: 12, repos: true, chance: { p: 0.6, vivres: 14, sante: 8 }, sinon: { vivres: -11 } },
        b: { l: 'CAMPER SEUL, À L’ÉCART', km: 18, sante: 4, vivres: -7, eau: -8 },
      },
    ],
  },
  {
    nom: 'LA FORÊT',
    jusqu: 470,
    couleur: C.cyan,
    journees: [
      {
        texte: 'La forêt se referme. Le sentier disparaît sous les fougères.',
        a: { l: 'COUPER À TRAVERS', km: 30, dur: true, vivres: -11, eau: -13, sante: -6 },
        b: { l: 'LONGER LA LISIÈRE', km: 17, vivres: -7, eau: -10 },
        c: { l: 'SUIVRE LA CARTE', km: 34, vivres: -8, eau: -10, exige: 'carte' },
      },
      {
        texte: 'Des baies inconnues, en abondance, d’un rouge trop vif.',
        favorise: 'vivres',
        a: { l: 'EN MANGER', km: 17, chance: { p: 0.55, vivres: 22 }, sinon: { sante: -16, vivres: 5 } },
        b: { l: 'S’EN PASSER', km: 19, vivres: -8, eau: -10 },
      },
      {
        texte: 'Un torrent large, aux berges glissantes.',
        a: { l: 'TRAVERSER À GUÉ', km: 16, dur: true, eau: 9, chance: { p: 0.65, sante: -4 }, sinon: { sante: -18 } },
        b: { l: 'REMONTER LE COURS', km: 8, repos: true, eau: 11, vivres: -6 },
        c: { l: 'TENDRE LA CORDE', km: 24, eau: 9, sante: -2, exige: 'corde' },
      },
      {
        texte: 'Des champignons, un tapis de mousse, et un silence complet.',
        a: { l: 'CAMPER ICI', km: 5, repos: true, sante: 12, vivres: -7, eau: -5 },
        b: { l: 'AVANCER ENCORE', km: 24, dur: true, vivres: -9, eau: -13, sante: -3 },
      },
      {
        texte: 'Une cabane de charbonnier, vide depuis longtemps.',
        favorise: 'sante',
        a: { l: 'FOUILLER LES RESTES', km: 7, chance: { p: 0.6, vivres: 19, sante: 4 }, sinon: { sante: 2 } },
        b: { l: 'DORMIR AU SEC', km: 4, repos: true, sante: 14, vivres: -8 },
      },
      {
        texte: 'Orage. Le sentier se transforme en torrent.',
        a: { l: 'AVANCER SOUS LA PLUIE', km: 21, dur: true, eau: 8, sante: -10, vivres: -6 },
        b: { l: 'S’ABRITER', km: 5, repos: true, eau: 6, vivres: -7, sante: 4 },
      },
      {
        texte: 'La lisière longe un ruisseau tranquille, des traces de sentier balisé.',
        route: 'sur',
        a: { l: 'SUIVRE LE BALISAGE', km: 18, vivres: -7, eau: 2 },
        b: { l: 'COUPER PLUS COURT', km: 22, vivres: -9, eau: -10, sante: -2 },
      },
      {
        texte: 'Un campement de bûcherons, désert mais en ordre.',
        route: 'sur',
        a: { l: 'S’Y REPOSER', km: 6, repos: true, sante: 10, vivres: -5 },
        b: { l: 'CONTINUER', km: 20, vivres: -8, eau: -10 },
      },
      {
        texte: 'Le sous-bois est dense, des bruits que tu ne reconnais pas.',
        route: 'risque',
        a: { l: 'PRESSER LE PAS', km: 26, dur: true, chance: { p: 0.5, sante: 2 }, sinon: { sante: -14, vivres: -5 } },
        b: { l: 'RESTER SUR SES GARDES', km: 14, vivres: -7, eau: -8 },
      },
      {
        texte: 'Un arbre mort barre le passage sur des mètres.',
        route: 'risque',
        a: { l: 'LE CONTOURNER PAR LE RAVIN', km: 23, dur: true, chance: { p: 0.5, eau: 6 }, sinon: { sante: -12, eau: -13 } },
        b: { l: 'LE DÉMONTER À LA HACHE', km: 9, sante: -6, vivres: -7 },
      },
      {
        texte: 'Des empreintes de sanglier, fraîches, en cercle.',
        favorise: 'vivres',
        a: { l: 'SUIVRE LA PISTE', km: 10, dur: true, chance: { p: 0.5, vivres: 24, sante: -4 }, sinon: { sante: -10 } },
        b: { l: 'S’EN ÉCARTER', km: 21, vivres: -8, eau: -11 },
      },
      {
        texte: 'Une clairière inondée de lumière, une source à son centre.',
        favorise: 'eau',
        a: { l: 'FAIRE HALTE', km: 8, repos: true, eau: 11, sante: 6 },
        b: { l: 'NE PAS S’ATTARDER', km: 22, vivres: -8, eau: -11 },
      },
    ],
  },
  {
    nom: 'LES CRÊTES',
    jusqu: 700,
    couleur: C.violet,
    journees: [
      {
        texte: 'Le col est enneigé. En contrebas, un long détour.',
        a: { l: 'LE COL', km: 36, dur: true, sante: -16, vivres: -10, eau: -10 },
        b: { l: 'LE DÉTOUR', km: 16, vivres: -8, eau: -11 },
        c: { l: 'S’ENCORDER', km: 34, sante: -5, vivres: -9, exige: 'corde' },
      },
      {
        texte: 'Une paroi verticale coupe la route.',
        a: { l: 'LA CONTOURNER', km: 12, vivres: -9, eau: -13 },
        b: { l: 'GRIMPER', km: 30, dur: true, sante: -18, vivres: -7 },
        c: { l: 'GRIMPER ENCORDÉ', km: 32, sante: -6, vivres: -7, exige: 'corde' },
      },
      {
        texte: 'De la neige propre, à perte de vue.',
        favorise: 'eau',
        a: { l: 'LA FAIRE FONDRE', km: 9, vivres: -7, sante: -3, chance: { p: 0.7, eau: 13 }, sinon: { eau: 4 } },
        b: { l: 'MARCHER TANT QU’IL FAIT JOUR', km: 26, dur: true, eau: -15, vivres: -9 },
      },
      {
        texte: 'Le vent tourne. La nuit sera glaciale.',
        a: { l: 'MARCHER DE NUIT', km: 29, dur: true, sante: -12, vivres: -10, eau: -8 },
        b: { l: 'FAIRE DU FEU', km: 6, repos: true, sante: 10, vivres: -11, eau: -7 },
      },
      {
        texte: 'Un refuge de pierre, à demi effondré.',
        a: { l: 'Y PASSER LA NUIT', km: 5, repos: true, sante: 16, vivres: -8, eau: -7 },
        b: { l: 'POUSSER JUSQU’AU SUIVANT', km: 27, dur: true, sante: -8, vivres: -9, eau: -11 },
      },
      {
        texte: 'Un aigle tournoie au-dessus d’une carcasse fraîche.',
        favorise: 'vivres',
        a: { l: 'PRENDRE CE QU’IL RESTE', km: 11, sante: -6, chance: { p: 0.6, vivres: 22 }, sinon: { vivres: 7 } },
        b: { l: 'LAISSER', km: 22, vivres: -9, eau: -11 },
      },
      {
        texte: 'Un sentier muletier, marqué de cairns réguliers.',
        route: 'sur',
        a: { l: 'SUIVRE LES CAIRNS', km: 20, vivres: -8, eau: -10 },
        b: { l: 'PRENDRE DE LA HAUTEUR', km: 25, dur: true, sante: -6, vivres: -7 },
      },
      {
        texte: 'Une bergerie de pierre sèche, murs intacts.',
        route: 'sur',
        a: { l: 'Y DORMIR', km: 6, repos: true, sante: 14, vivres: -7 },
        b: { l: 'CONTINUER', km: 23, dur: true, sante: -6, vivres: -8 },
      },
      {
        texte: 'La crête s’amincit à un mètre de large, le vide des deux côtés.',
        route: 'risque',
        a: { l: 'AVANCER SANS S’ARRÊTER', km: 31, dur: true, chance: { p: 0.45, sante: 0 }, sinon: { sante: -22 } },
        b: { l: 'REVENIR SUR SES PAS, PAR LE BAS', km: 12, vivres: -9, eau: -11 },
      },
      {
        texte: 'Un pierrier instable, la voie la plus directe.',
        route: 'risque',
        a: { l: 'S’ENGAGER DANS LE PIERRIER', km: 28, dur: true, chance: { p: 0.55, sante: -2 }, sinon: { sante: -16, eau: -10 } },
        b: { l: 'LE LONG CONTOURNEMENT', km: 13, vivres: -8, eau: -10 },
      },
      {
        texte: 'Un renard des neiges observe, immobile, sans peur.',
        a: { l: 'LUI LAISSER DES VIVRES', km: 14, vivres: -9, sante: 6 },
        b: { l: 'POURSUIVRE', km: 24, vivres: -9, eau: -10 },
      },
      {
        texte: 'Le brouillard monte d’un coup, tu ne vois plus tes pieds.',
        favorise: 'sante',
        a: { l: 'ATTENDRE QU’IL SE LÈVE', km: 4, repos: true, sante: 6, vivres: -5, eau: -7 },
        b: { l: 'AVANCER AU JUGÉ', km: 20, dur: true, chance: { p: 0.5, sante: -2 }, sinon: { sante: -14 } },
      },
    ],
  },
  {
    nom: 'LE DÉSERT',
    jusqu: ARRIVEE,
    couleur: C.accent,
    journees: [
      {
        texte: 'Le sable commence. La chaleur monte du sol.',
        a: { l: 'MARCHER LE JOUR', km: 27, dur: true, eau: -30, sante: -8 },
        b: { l: 'MARCHER LA NUIT', km: 20, eau: -13, vivres: -10, sante: -3 },
      },
      {
        texte: 'Un puits. La corde a disparu.',
        favorise: 'eau',
        a: { l: 'DESCENDRE À MAINS NUES', km: 6, sante: -12, chance: { p: 0.6, eau: 11 }, sinon: { eau: 5 } },
        b: { l: 'RENONCER', km: 20, eau: -21, vivres: -7 },
        c: { l: 'UTILISER SA CORDE', km: 8, eau: 19, exige: 'corde' },
      },
      {
        texte: 'Une caravane croise ta route, pressée.',
        a: { l: 'ÉCHANGER DES VIVRES', km: 22, vivres: -20, eau: 13 },
        b: { l: 'DEMANDER LA DIRECTION', km: 30, dur: true, eau: -19, vivres: -8 },
      },
      {
        texte: 'Tempête de sable à l’horizon.',
        a: { l: 'LUI TOURNER LE DOS', km: 8, sante: -4, eau: -10 },
        b: { l: 'LA TRAVERSER', km: 31, dur: true, chance: { p: 0.5, sante: -8 }, sinon: { sante: -24, eau: -15 } },
      },
      {
        texte: 'Des ruines basses, à moitié ensablées.',
        a: { l: 'FOUILLER', km: 7, chance: { p: 0.55, eau: 9, vivres: 14 }, sinon: { sante: -4 } },
        b: { l: 'PASSER', km: 25, eau: -21, vivres: -8 },
      },
      {
        texte: 'Au loin, une ligne verte. Ce n’est peut-être rien.',
        a: { l: 'Y CROIRE', km: 33, dur: true, eau: -24, sante: -6 },
        b: { l: 'GARDER LE CAP', km: 24, eau: -19, vivres: -8 },
        c: { l: 'VÉRIFIER SUR LA CARTE', km: 33, eau: 5, exige: 'carte' },
      },
      {
        texte: 'Une piste de caravaniers, jalonnée de puits connus.',
        route: 'sur',
        a: { l: 'SUIVRE LA PISTE', km: 22, eau: -15, vivres: -7 },
        b: { l: 'COUPER À TRAVERS LES DUNES', km: 28, dur: true, eau: -27, sante: -4 },
      },
      {
        texte: 'Un campement bédouin propose l’hospitalité pour la nuit.',
        route: 'sur',
        a: { l: 'ACCEPTER', km: 8, repos: true, sante: 10, eau: 4, vivres: -5 },
        b: { l: 'DÉCLINER, CONTINUER', km: 24, eau: -21, vivres: -9 },
      },
      {
        texte: 'Le raccourci passe par une dépression sans ombre.',
        route: 'risque',
        a: { l: 'S’Y ENGAGER', km: 34, dur: true, chance: { p: 0.45, eau: -10 }, sinon: { eau: -32, sante: -10 } },
        b: { l: 'LE LONG CONTOUR PAR LA CRÊTE ROCHEUSE', km: 16, eau: -15, sante: -4 },
      },
      {
        texte: 'Des nomades t’indiquent un puits, à condition de faire vite.',
        route: 'risque',
        favorise: 'eau',
        a: { l: 'Y COURIR', km: 29, dur: true, chance: { p: 0.6, eau: 14 }, sinon: { eau: -13, sante: -6 } },
        b: { l: 'NE PAS RISQUER LA CHALEUR', km: 18, eau: -21, vivres: -7 },
      },
      {
        texte: 'Le vent a découvert un squelette d’animal, blanchi.',
        a: { l: 'S’EN DÉTOURNER', km: 22, eau: -19, vivres: -8 },
        b: { l: 'CHERCHER DE L’OMBRE', km: 9, repos: true, sante: 8, eau: -10 },
      },
      {
        texte: 'Une oasis, minuscule, presque un mirage.',
        favorise: 'sante',
        a: { l: 'S’Y ARRÊTER', km: 10, repos: true, eau: 13, sante: 10, vivres: 5 },
        b: { l: 'NE PAS Y CROIRE, CONTINUER', km: 26, eau: -21, vivres: -9 },
      },
    ],
  },
]

/** Ces journées-là ne se tirent pas au sort : elles arrivent quand ça va mal. */
export const URGENCES = [
  {
    quand: (h) => h.sante <= 32,
    texte: 'La fièvre te prend au réveil. Tu tiens à peine debout.',
    a: { l: 'MARCHER QUAND MÊME', km: 17, dur: true, sante: -14, vivres: -7, eau: -13 },
    b: { l: 'RESTER COUCHÉ', km: 0, repos: true, sante: 16, vivres: -10, eau: -11 },
    c: { l: 'PRENDRE LE REMÈDE', km: 14, sante: 34, exige: 'remede' },
  },
  {
    quand: (h) => h.vivres <= 14,
    texte: 'Le sac est presque vide. Tu comptes les bouchées.',
    a: { l: 'CHASSER TOUTE LA JOURNÉE', km: 4, dur: true, vivres: 22, eau: -13, sante: -5 },
    b: { l: 'SERRER LA CEINTURE', km: 23, vivres: -5, sante: -9 },
  },
  {
    quand: (h) => h.eau <= 14,
    texte: 'Les outres sonnent creux depuis ce matin.',
    a: { l: 'CHERCHER UN POINT D’EAU', km: 5, eau: 12, vivres: -8, sante: -4 },
    b: { l: 'TENIR ENCORE UN JOUR', km: 24, dur: true, eau: -5, sante: -12 },
  },
  {
    quand: (h) => h.fatigue >= FATIGUE_MAX,
    texte: 'Tu ne sens plus tes jambes. Il faut t’arrêter, ou tomber.',
    a: { l: 'S’EFFONDRER ICI', km: 0, repos: true, sante: 8 },
    b: { l: 'CONTINUER SUR LES DENTS', km: 12, dur: true, sante: -14, vivres: -9 },
  },
]
