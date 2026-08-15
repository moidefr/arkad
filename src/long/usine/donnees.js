import { C } from '../../palette.js'

/**
 * Tout le contenu de l'USINE, en tables.
 *
 * Rien ici n'importe de quoi dessiner ni de quoi jouer un son : ce fichier et
 * `logique.js` tournent sous `node --test` sans navigateur, et c'est ce qui
 * permet de simuler dix heures de partie en une seconde pour vérifier la
 * courbe au lieu de la deviner.
 *
 * **Règle d'ajout seul** : on n'enlève jamais une ligne, on ne réordonne
 * jamais. Une sauvegarde stocke des indices de machine et des identifiants
 * d'amélioration ; les bouger, c'est corrompre les parties en cours.
 */

/** Les dix lignes de production, du caillou au manteau terrestre. */
export const MACHINES = [
  {
    nom: 'PIOCHE',
    cout: 15,
    taux: 1.14,
    prod: 0.5,
    postes: 1,
    couleur: C.faible,
  },
  {
    nom: 'FOREUSE',
    cout: 170,
    taux: 1.15,
    prod: 4,
    postes: 1,
    couleur: C.cyan,
  },
  {
    nom: 'CONVOYEUR',
    cout: 2000,
    taux: 1.15,
    prod: 32,
    postes: 2,
    couleur: C.vert,
  },
  {
    nom: 'CONCASSEUR',
    cout: 26000,
    taux: 1.16,
    prod: 260,
    postes: 2,
    couleur: C.vert,
  },
  {
    nom: 'FONDERIE',
    cout: 340000,
    taux: 1.16,
    prod: 2200,
    postes: 3,
    couleur: C.violet,
  },
  {
    nom: 'HAUT-FOURNEAU',
    cout: 4.5e6,
    taux: 1.17,
    prod: 19000,
    postes: 3,
    couleur: C.violet,
  },
  {
    nom: 'RÉACTEUR',
    cout: 6e7,
    taux: 1.17,
    prod: 165000,
    postes: 4,
    couleur: C.accent,
    recherche: 'm6',
  },
  {
    nom: 'FORAGE PROFOND',
    cout: 8e8,
    taux: 1.18,
    prod: 1.4e6,
    postes: 4,
    couleur: C.accent,
    recherche: 'm7',
  },
  {
    nom: 'ANNEAU MAGNÉTIQUE',
    cout: 1.1e10,
    taux: 1.19,
    prod: 1.3e7,
    postes: 5,
    couleur: C.rouge,
    recherche: 'm8',
  },
  {
    nom: 'PUITS DE MANTEAU',
    cout: 1.5e11,
    taux: 1.2,
    prod: 1.2e8,
    postes: 6,
    couleur: C.rouge,
    recherche: 'm9',
  },
  // Le troisième palier — cinq lignes de plus, débloquées à la queue leu leu
  // (m10→m14, chacune exige la précédente) plutôt que par un embranchement :
  // la même progression linéaire que m6→m9, poussée plus loin.
  {
    nom: 'FOUR À ARC',
    cout: 2e12,
    taux: 1.21,
    prod: 1.1e9,
    postes: 7,
    couleur: C.accent,
    recherche: 'm10',
  },
  {
    nom: 'SÉPARATEUR ISOTOPIQUE',
    cout: 2.8e13,
    taux: 1.21,
    prod: 1.2e10,
    postes: 8,
    couleur: C.accent,
    recherche: 'm11',
  },
  {
    nom: 'EXTRACTEUR À VIDE',
    cout: 4e14,
    taux: 1.22,
    prod: 1.3e11,
    postes: 9,
    couleur: C.rouge,
    recherche: 'm12',
  },
  {
    nom: 'FORGE ORBITALE',
    cout: 6e15,
    taux: 1.22,
    prod: 1.5e12,
    postes: 10,
    couleur: C.rouge,
    recherche: 'm13',
  },
  {
    nom: 'CŒUR DE FUSION',
    cout: 9e16,
    taux: 1.23,
    prod: 1.7e13,
    postes: 12,
    couleur: C.rouge,
    recherche: 'm14',
  },
]

/**
 * L'étage sur lequel une machine est dessinée. Zéro en bas, un pour tout le
 * reste — le troisième palier (10-14) rejoint le premier étage plutôt que
 * d'en réclamer un troisième : `scene.js` y loge dix postes plus étroits
 * (`posteHaut` dans `dispo.js`) au lieu de cinq, sans toucher à la hauteur
 * de l'écran.
 */
export const etageDe = (i) => (i < 5 ? 0 : 1)

/**
 * Les améliorations cassent la courbe au lieu de l'allonger. Trente, classées :
 * deux par machine, six globales, deux pour la main, deux pour les ouvriers.
 */
export const AMELIORATIONS = [
  {
    id: 'g0a',
    nom: 'MANCHES FERRÉS',
    dit: 'PIOCHE ×3',
    cout: 600,
    cible: 0,
    facteur: 3,
  },
  {
    id: 'm1',
    nom: 'GANTS RENFORCÉS',
    dit: 'creuser à la main ×8',
    cout: 1800,
    main: 8,
  },
  {
    id: 'g1a',
    nom: 'TÊTES DIAMANT',
    dit: 'FOREUSE ×3',
    cout: 9000,
    cible: 1,
    facteur: 3,
  },
  {
    id: 'g0b',
    nom: 'PIOCHES DOUBLES',
    dit: 'PIOCHE ×5',
    cout: 30000,
    cible: 0,
    facteur: 5,
  },
  {
    id: 'o1',
    nom: 'CASQUES',
    dit: 'ouvriers +25 %',
    cout: 45000,
    ouvrier: 0.25,
  },
  {
    id: 'h1',
    nom: 'HUILE CHAUDE',
    dit: 'tout ×1.6',
    cout: 120000,
    global: 1.6,
  },
  {
    id: 'g2a',
    nom: 'COURROIES DOUBLES',
    dit: 'CONVOYEUR ×3',
    cout: 260000,
    cible: 2,
    facteur: 3,
  },
  {
    id: 'g1b',
    nom: 'TRÉPANS LONGS',
    dit: 'FOREUSE ×5',
    cout: 700000,
    cible: 1,
    facteur: 5,
  },
  {
    id: 'g3a',
    nom: 'MÂCHOIRES ACIER',
    dit: 'CONCASSEUR ×3',
    cout: 2.2e6,
    cible: 3,
    facteur: 3,
  },
  {
    id: 'm2',
    nom: 'MARTEAU-PIQUEUR',
    dit: 'creuser à la main ×25',
    cout: 6e6,
    main: 25,
  },
  { id: 'h2', nom: 'AUTOMATISATION', dit: 'tout ×2', cout: 1.4e7, global: 2 },
  {
    id: 'g2b',
    nom: 'RAILS SUSPENDUS',
    dit: 'CONVOYEUR ×5',
    cout: 4e7,
    cible: 2,
    facteur: 5,
  },
  {
    id: 'g4a',
    nom: 'CREUSETS PROFONDS',
    dit: 'FONDERIE ×3',
    cout: 1.1e8,
    cible: 4,
    facteur: 3,
  },
  {
    id: 'o2',
    nom: 'PRIMES DE FOND',
    dit: 'ouvriers +40 %',
    cout: 3e8,
    ouvrier: 0.4,
  },
  {
    id: 'g3b',
    nom: 'BROYAGE FIN',
    dit: 'CONCASSEUR ×5',
    cout: 7e8,
    cible: 3,
    facteur: 5,
  },
  {
    id: 'h3',
    nom: 'CHAÎNE COMPLÈTE',
    dit: 'tout ×2.5',
    cout: 2.5e9,
    global: 2.5,
  },
  {
    id: 'g5a',
    nom: 'SOUFFLERIE',
    dit: 'HAUT-FOURNEAU ×3',
    cout: 9e9,
    cible: 5,
    facteur: 3,
  },
  {
    id: 'g4b',
    nom: 'COULÉE CONTINUE',
    dit: 'FONDERIE ×5',
    cout: 4e10,
    cible: 4,
    facteur: 5,
  },
  {
    id: 'g6a',
    nom: 'CONFINEMENT',
    dit: 'RÉACTEUR ×3',
    cout: 1.6e11,
    cible: 6,
    facteur: 3,
  },
  {
    id: 'g5b',
    nom: 'RECYCLAGE THERMIQUE',
    dit: 'HAUT-FOURNEAU ×5',
    cout: 7e11,
    cible: 5,
    facteur: 5,
  },
  { id: 'h4', nom: 'PILOTAGE CENTRAL', dit: 'tout ×3', cout: 3e12, global: 3 },
  {
    id: 'g7a',
    nom: 'BOUES LOURDES',
    dit: 'FORAGE PROFOND ×3',
    cout: 1.2e13,
    cible: 7,
    facteur: 3,
  },
  {
    id: 'g6b',
    nom: 'SURGÉNÉRATION',
    dit: 'RÉACTEUR ×5',
    cout: 5e13,
    cible: 6,
    facteur: 5,
  },
  {
    id: 'g8a',
    nom: 'SUPRACONDUCTEURS',
    dit: 'ANNEAU ×3',
    cout: 2e14,
    cible: 8,
    facteur: 3,
  },
  { id: 'h5', nom: 'RÉSEAU FERMÉ', dit: 'tout ×3', cout: 9e14, global: 3 },
  {
    id: 'g7b',
    nom: 'TÊTES ROTATIVES',
    dit: 'FORAGE PROFOND ×5',
    cout: 4e15,
    cible: 7,
    facteur: 5,
  },
  {
    id: 'g9a',
    nom: 'GAINE CÉRAMIQUE',
    dit: 'PUITS ×3',
    cout: 2e16,
    cible: 9,
    facteur: 3,
  },
  {
    id: 'g8b',
    nom: 'CHAMPS CROISÉS',
    dit: 'ANNEAU ×5',
    cout: 9e16,
    cible: 8,
    facteur: 5,
  },
  { id: 'h6', nom: 'USINE TOTALE', dit: 'tout ×4', cout: 5e17, global: 4 },
  {
    id: 'g9b',
    nom: 'FORAGE MANTELLIQUE',
    dit: 'PUITS ×5',
    cout: 3e18,
    cible: 9,
    facteur: 5,
  },
  // Le troisième palier d'améliorations : deux par machine neuve (comme
  // partout ailleurs), quatre globales de plus, et un cran de plus pour la
  // main et pour les ouvriers. `h9` est déjà pris par la recherche
  // « CHAÎNE INTÉGRÉE » (capstone) : les globales neuves sautent ce numéro
  // plutôt que de partager un identifiant avec une tout autre table.
  { id: 'g10a', nom: 'ÉLECTRODES LONGUES', dit: 'FOUR À ARC ×3', cout: 2e13, cible: 10, facteur: 3 },
  { id: 'h7', nom: 'CHAÎNE DOUBLÉE', dit: 'tout ×5', cout: 3e18, global: 5 },
  { id: 'g10b', nom: 'ARC PULSÉ', dit: 'FOUR À ARC ×5', cout: 1.2e14, cible: 10, facteur: 5 },
  { id: 'g11a', nom: 'CENTRIFUGEUSES', dit: 'SÉPARATEUR ×3', cout: 2.8e14, cible: 11, facteur: 3 },
  { id: 'm3', nom: 'FORET À MAIN', dit: 'creuser à la main ×80', cout: 5e9, main: 80 },
  { id: 'o6', nom: 'ÉQUIPES RELAIS', dit: 'ouvriers +55 %', cout: 2e12, ouvrier: 0.55 },
  { id: 'g11b', nom: 'CASCADE ISOTOPIQUE', dit: 'SÉPARATEUR ×5', cout: 1.7e15, cible: 11, facteur: 5 },
  { id: 'h8', nom: 'RÉSEAU REDONDANT', dit: 'tout ×6', cout: 2e19, global: 6 },
  { id: 'g12a', nom: 'POMPES CRYOGÉNIQUES', dit: 'EXTRACTEUR À VIDE ×3', cout: 4e15, cible: 12, facteur: 3 },
  { id: 'g12b', nom: 'VIDE POUSSÉ', dit: 'EXTRACTEUR À VIDE ×5', cout: 2.4e16, cible: 12, facteur: 5 },
  { id: 'm4', nom: 'PERFORATEUR THERMIQUE', dit: 'creuser à la main ×300', cout: 8e12, main: 300 },
  { id: 'o7', nom: 'ROULEMENT CONTINU', dit: 'ouvriers +75 %', cout: 4e15, ouvrier: 0.75 },
  { id: 'g13a', nom: 'BRAS TÉLÉGUIDÉS', dit: 'FORGE ORBITALE ×3', cout: 6e16, cible: 13, facteur: 3 },
  { id: 'h10', nom: 'SYNCHRONISATION TOTALE', dit: 'tout ×8', cout: 1.5e20, global: 8 },
  { id: 'g13b', nom: 'ASSEMBLAGE EN VOL', dit: 'FORGE ORBITALE ×5', cout: 3.6e17, cible: 13, facteur: 5 },
  { id: 'g14a', nom: 'CONFINEMENT MAGNÉTIQUE', dit: 'CŒUR DE FUSION ×3', cout: 9e17, cible: 14, facteur: 3 },
  { id: 'g14b', nom: 'IGNITION SOUTENUE', dit: 'CŒUR DE FUSION ×5', cout: 5.4e18, cible: 14, facteur: 5 },
  { id: 'h11', nom: 'USINE PARFAITE', dit: 'tout ×10', cout: 1e21, global: 10 },
]

/**
 * La recherche est la seule dépense en **temps réel**, et la seule chose qui
 * survit à une refonte. C'est elle qui occupe les heures creuses et qui donne
 * une raison de refondre : on repart de zéro en minerai, jamais en savoir.
 */
export const RECHERCHES = [
  {
    id: 'r0',
    nom: 'ÉQUIPES DE NUIT',
    dit: 'crédit hors ligne : 12 h',
    cout: 1200,
    duree: 90,
    requis: [],
  },
  {
    id: 'p0',
    nom: 'PIÈCES DE RECHANGE',
    dit: 'moitié moins de pannes',
    cout: 25000,
    duree: 300,
    requis: ['r0'],
  },
  {
    id: 'o0',
    nom: 'RECRUTEMENT',
    dit: 'ouvriers 30 % moins chers',
    cout: 60000,
    duree: 420,
    requis: ['r0'],
  },
  {
    id: 'p1',
    nom: 'MAINTENANCE',
    dit: 'une panne se répare seule en 25 s',
    cout: 400000,
    duree: 900,
    requis: ['p0'],
  },
  {
    id: 'o3',
    nom: 'CANTINE',
    dit: 'sans ouvrier, on tourne à 55 %',
    cout: 900000,
    duree: 1200,
    requis: ['o0'],
  },
  {
    id: 'm6',
    nom: 'FISSION',
    dit: 'débloque le RÉACTEUR',
    cout: 3e6,
    duree: 1800,
    requis: ['p1'],
  },
  {
    id: 'o4',
    nom: 'FORMATION',
    dit: 'un ouvrier tient 1,6 poste',
    cout: 8e6,
    duree: 2400,
    requis: ['o3'],
  },
  {
    id: 'c0',
    nom: 'BUREAU COMMERCIAL',
    dit: 'des contrats à honorer',
    cout: 250000,
    duree: 600,
    requis: ['r0'],
  },
  {
    id: 'r1',
    nom: 'TROIS-HUIT',
    dit: 'crédit hors ligne : 24 h',
    cout: 6e7,
    duree: 3600,
    requis: ['o4'],
  },
  {
    id: 'p2',
    nom: 'ATELIER MÉCANIQUE',
    dit: 'réparer donne 30 s d’avance',
    cout: 1.5e8,
    duree: 2700,
    requis: ['p1'],
  },
  {
    id: 'm7',
    nom: 'SISMIQUE',
    dit: 'débloque le FORAGE PROFOND',
    cout: 5e8,
    duree: 4200,
    requis: ['m6'],
  },
  {
    id: 'c1',
    nom: 'LOGISTIQUE',
    dit: 'deux contrats en même temps',
    cout: 2e9,
    duree: 3600,
    requis: ['c0'],
  },
  {
    id: 'b0',
    nom: 'BUREAU D’ÉTUDES',
    dit: 'deux recherches en parallèle',
    cout: 8e9,
    duree: 5400,
    requis: ['r1'],
  },
  {
    id: 'f0',
    nom: 'FONDERIE FINE',
    dit: 'lingots +25 %',
    cout: 3e10,
    duree: 5400,
    requis: ['b0'],
  },
  {
    id: 'm8',
    nom: 'MAGNÉTISME',
    dit: 'débloque l’ANNEAU MAGNÉTIQUE',
    cout: 1.2e11,
    duree: 7200,
    requis: ['m7'],
  },
  {
    id: 'c2',
    nom: 'NÉGOCIATION',
    dit: 'primes de contrat doublées',
    cout: 5e11,
    duree: 5400,
    requis: ['c1'],
  },
  {
    id: 'a0',
    nom: 'AUTOMATE DE TAILLE',
    dit: 'la main creuse toute seule',
    cout: 2e12,
    duree: 7200,
    requis: ['p2'],
  },
  {
    id: 'f1',
    nom: 'MÉMOIRE D’ATELIER',
    dit: 'garder une machine de chaque à la refonte',
    cout: 1e13,
    duree: 10800,
    requis: ['f0'],
  },
  {
    id: 'm9',
    nom: 'GÉOTHERMIE',
    dit: 'débloque le PUITS DE MANTEAU',
    cout: 6e13,
    duree: 10800,
    requis: ['m8'],
  },
  {
    id: 'h9',
    nom: 'CHAÎNE INTÉGRÉE',
    dit: 'tout ×3, définitivement',
    cout: 4e14,
    duree: 14400,
    requis: ['f1', 'm9'],
  },
  // Le troisième palier de recherches : cinq déblocages de machine à la
  // queue leu leu (m10→m14, chacune exige la précédente, comme m6→m9), un
  // cran de plus sur chaque branche existante, et un second capstone —
  // `x0`, pas `h10`, pour ne jamais partager un identifiant avec les
  // globales neuves d'`AMELIORATIONS` qui vivent dans une tout autre table.
  { id: 'm10', nom: 'ARC ÉLECTRIQUE', dit: 'débloque le FOUR À ARC', cout: 1.5e14, duree: 12600, requis: ['m9'] },
  {
    id: 'r2',
    nom: 'ROTATION CONTINUE',
    dit: 'crédit hors ligne : 48 h',
    cout: 3e14,
    duree: 14400,
    requis: ['r1'],
  },
  {
    id: 'p3',
    nom: 'CAPTEURS PRÉDICTIFS',
    dit: 'pannes encore deux fois plus rares',
    cout: 6e14,
    duree: 16200,
    requis: ['p2'],
  },
  { id: 'o5', nom: 'POLYVALENCE', dit: 'un ouvrier tient 2,2 postes', cout: 1.2e15, duree: 18000, requis: ['o4'] },
  { id: 'c3', nom: 'ENTREPÔT AVANCÉ', dit: 'trois contrats à la fois', cout: 2.5e15, duree: 19800, requis: ['c2'] },
  {
    id: 'b1',
    nom: 'ANNEXE DE RECHERCHE',
    dit: 'trois recherches en parallèle',
    cout: 5e15,
    duree: 21600,
    requis: ['b0'],
  },
  { id: 'f2', nom: 'CREUSET RAFFINÉ', dit: 'lingots encore +15 %', cout: 1e16, duree: 23400, requis: ['f1'] },
  // m11→m14 sont une chaîne strictement séquentielle (chacune exige la
  // précédente) : le parallélisme de recherche (b0/b1) ne raccourcit rien
  // ici, contrairement au reste de l'arbre où plusieurs branches peuvent
  // avancer de front. Des `duree` à l'échelle de m10 les rendrait
  // inatteignables avant 80 h passées — mesuré au banc, retenu plus court.
  {
    id: 'm11',
    nom: 'ULTRACENTRIFUGATION',
    dit: 'débloque le SÉPARATEUR ISOTOPIQUE',
    cout: 2e16,
    duree: 7200,
    requis: ['m10'],
  },
  { id: 'm12', nom: 'VIDE ABSOLU', dit: 'débloque l’EXTRACTEUR À VIDE', cout: 8e16, duree: 9000, requis: ['m11'] },
  {
    id: 'm13',
    nom: 'MÉTALLURGIE ORBITALE',
    dit: 'débloque la FORGE ORBITALE',
    cout: 3e17,
    duree: 10800,
    requis: ['m12'],
  },
  {
    id: 'm14',
    nom: 'CONFINEMENT MAGNÉTIQUE STABLE',
    dit: 'débloque le CŒUR DE FUSION',
    cout: 1.2e18,
    duree: 12600,
    requis: ['m13'],
  },
  {
    id: 'x0',
    nom: 'RÉSONANCE DES LINGOTS',
    dit: 'chaque lingot vaut 40 % de plus',
    cout: 1e19,
    duree: 18000,
    requis: ['h9', 'm14'],
  },
]

/**
 * Les contrats donnent une raison de rouvrir l'application à un moment précis,
 * ce qu'aucune autre mécanique du jeu ne fait. Ils sont tirés d'un modèle et
 * calibrés sur la production du moment, jamais sur des nombres absolus qui
 * deviendraient ridicules deux heures plus tard.
 */
export const CONTRATS = [
  { nom: 'COMMANDE PRESSÉE', charge: 45, delai: 180, prime: 'multi' },
  { nom: 'LOT DE FONTE', charge: 120, delai: 600, prime: 'lingot' },
  { nom: 'LIVRAISON DE NUIT', charge: 400, delai: 2400, prime: 'multi' },
  { nom: 'MARCHÉ PUBLIC', charge: 900, delai: 5400, prime: 'lingot' },
  { nom: 'PETITE SÉRIE', charge: 25, delai: 120, prime: 'minerai' },
  { nom: 'STOCK STRATÉGIQUE', charge: 1800, delai: 10800, prime: 'lingot' },
  { nom: 'RÉASSORT', charge: 70, delai: 300, prime: 'minerai' },
  { nom: 'GROS ŒUVRE', charge: 300, delai: 1800, prime: 'multi' },
  // Le charge/délai reste en secondes de production courante, pas en
  // nombres absolus (voir `tire()`) : ces quatre-là élargissent juste
  // l'éventail, du contrat éclair à la commande de fond.
  { nom: 'DEMANDE URGENTE', charge: 15, delai: 60, prime: 'multi' },
  { nom: 'EXPORT LOURD', charge: 550, delai: 3000, prime: 'minerai' },
  { nom: 'CONTRAT CADRE', charge: 2500, delai: 14400, prime: 'lingot' },
  { nom: 'RÉSERVE D’ÉTAT', charge: 3600, delai: 21600, prime: 'lingot' },
]

/** Ce qu'il faut d'extrait pour un premier lingot, et la platitude de la courbe. */
export const SEUIL_LINGOT = 1e6
/**
 * Le prix d'un ouvrier est **indexé sur la production**, pas sur une puissance
 * du nombre d'embauches.
 *
 * Un prix exponentiel a été essayé et mesuré au banc : il devient inabordable
 * vers la troisième heure, l'usine tourne en sous-effectif permanent et la
 * mécanique meurt. L'inverse — un prix fixe — la rend gratuite à la huitième
 * heure, et une dépense qui ne coûte rien n'est pas une décision. Adossé à la
 * production, l'ouvrier vaut toujours quelques dizaines de secondes d'usine,
 * de la première minute à la dixième heure.
 */
export const OUVRIER_COUT = 150 // plancher, le temps que l'usine démarre
export const OUVRIER_SECONDES = 6 // secondes de production pour le premier
export const OUVRIER_PENTE = 12 // et +1/12ᵉ par ouvrier déjà embauché
/**
 * Les postes ne grandissent pas aussi vite que les machines : la centième
 * pioche ne demande pas un centième mineur. Sans cet exposant, la demande est
 * linéaire face à un prix exponentiel, et l'usine finit par tourner en
 * sous-effectif permanent quoi qu'on fasse.
 */
export const POSTE_PENTE = 0.6
