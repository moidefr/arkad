/**
 * Les bandes-son de la borne.
 *
 * Chaque ligne est un morceau entier : huit champs, et `composition.js` en
 * déduit seize mesures de basse, d'accords, de chant et de percussion. Deux
 * lignes qui ne diffèrent que par leur graine donnent deux morceaux qui n'ont
 * rien à voir — c'est ce qui permet d'en tenir cinquante pour un seul jeu sans
 * que le fichier fasse plus d'une page.
 *
 * **Cinquante pour BRÈCHE**, cinq par monde : on entend les cinq au fil des
 * cycles, et on ne réentend jamais deux fois de suite la même dans un monde.
 * Puis une par jeu pour le reste de la borne.
 */

const t = (id, nom, bpm, gamme, tonique, ambiance, graine) => ({ id, nom, bpm, gamme, tonique, ambiance, graine })

/**
 * Les cinquante de BRÈCHE. Le nom d'un morceau dit ce qu'il fait au monde
 * qu'il accompagne : une cour se joue en marche, une crue en course, un vide
 * en presque rien.
 */
export const BRECHE = [
  // --- LA COUR : simple, carré, on apprend --------------------------------------
  t('cour1', 'PREMIÈRE COUR', 92, 'mineur', 2, 'marche', 0x1a2b3c),
  t('cour2', 'PAVÉS', 96, 'dorien', 7, 'marche', 0x2b3c4d),
  t('cour3', 'LE COIN DROIT', 88, 'mineur', 9, 'veille', 0x3c4d5e),
  t('cour4', 'HUIT SUR HUIT', 100, 'penta', 0, 'marche', 0x4d5e6f),
  t('cour5', 'RANG PAR RANG', 94, 'mixolydien', 5, 'marche', 0x5e6f70),

  // --- LA FORGE : chaud, martelé -------------------------------------------------
  t('forge1', 'LA FORGE', 104, 'phrygien', 4, 'martial', 0x6f7081),
  t('forge2', 'BATTRE LE FER', 108, 'mineur', 11, 'martial', 0x708192),
  t('forge3', 'LINGOTS', 100, 'dorien', 3, 'marche', 0x8192a3),
  t('forge4', 'L’ENCLUME', 112, 'phrygien', 8, 'brasier', 0x92a3b4),
  t('forge5', 'SOUFFLET', 96, 'harmonique', 1, 'tendu', 0xa3b4c5),

  // --- LA CARRIÈRE : lourd, minéral -----------------------------------------------
  t('carriere1', 'LA CARRIÈRE', 86, 'mineur', 6, 'martial', 0xb4c5d6),
  t('carriere2', 'PIERRE DURE', 82, 'phrygien', 10, 'tendu', 0xc5d6e7),
  t('carriere3', 'DEUX FOIS', 90, 'harmonique', 2, 'martial', 0xd6e7f8),
  t('carriere4', 'POUSSIÈRE', 78, 'japonais', 7, 'veille', 0xe7f809),
  t('carriere5', 'LE FILON', 98, 'dorien', 0, 'marche', 0xf8091a),

  // --- L'ATELIER : régulier, mécanique ---------------------------------------------
  t('atelier1', 'L’ATELIER', 116, 'dorien', 5, 'mecanique', 0x091a2b),
  t('atelier2', 'NEUF SUR NEUF', 120, 'mineur', 9, 'mecanique', 0x1a2b3d),
  t('atelier3', 'COURROIE', 112, 'mixolydien', 2, 'course', 0x2b3d4e),
  t('atelier4', 'À LA CHAÎNE', 124, 'penta', 7, 'mecanique', 0x3d4e5f),
  t('atelier5', 'RÉGLAGE FIN', 108, 'lydien', 4, 'marche', 0x4e5f60),

  // --- LA CRUE : pressé, montant ----------------------------------------------------
  t('crue1', 'LA CRUE', 132, 'mineur', 11, 'course', 0x5f6071),
  t('crue2', 'L’EAU MONTE', 138, 'phrygien', 3, 'course', 0x607182),
  t('crue3', 'TENIR LA DIGUE', 128, 'harmonique', 8, 'tendu', 0x718293),
  t('crue4', 'REPOUSSER', 144, 'dorien', 1, 'course', 0x8293a4),
  t('crue5', 'DERNIÈRE RANGÉE', 126, 'mineur', 6, 'tendu', 0x93a4b5),

  // --- LE GEL : clair, suspendu -------------------------------------------------------
  t('gel1', 'LE GEL', 84, 'japonais', 4, 'glace', 0xa4b5c6),
  t('gel2', 'GIVRE', 76, 'lydien', 9, 'glace', 0xb5c6d7),
  t('gel3', 'CE QUI REVIENT', 90, 'mineur', 0, 'nocturne', 0xc6d7e8),
  t('gel4', 'DEUXIÈME FOIS', 88, 'harmonique', 5, 'glace', 0xd7e8f9),
  t('gel5', 'CRAQUEMENTS', 96, 'phrygien', 10, 'tendu', 0xe8f90a),

  // --- L'ORAGE : gros, sombre ------------------------------------------------------
  t('orage1', 'L’ORAGE', 100, 'phrygien', 7, 'brasier', 0xf90a1b),
  t('orage2', 'GROSSES PIÈCES', 94, 'mineur', 2, 'martial', 0x0a1b2c),
  t('orage3', 'PLUS DE PLACE', 106, 'harmonique', 11, 'tendu', 0x1b2c3d),
  t('orage4', 'TONNERRE', 112, 'phrygien', 5, 'brasier', 0x2c3d4e),
  t('orage5', 'ACCALMIE', 80, 'dorien', 8, 'veille', 0x3d4e60),

  // --- LA FAILLE : profond, tendu ------------------------------------------------------
  t('faille1', 'LA FAILLE', 98, 'mineur', 3, 'tendu', 0x4e6071),
  t('faille2', 'SACRIFIER UNE LIGNE', 92, 'harmonique', 10, 'martial', 0x607182),
  t('faille3', 'HUIT ROCHES', 88, 'phrygien', 6, 'martial', 0x718294),
  t('faille4', 'LE FOND', 74, 'japonais', 1, 'vide', 0x8294a5),
  t('faille5', 'REMONTER', 120, 'dorien', 9, 'course', 0x94a5b6),

  // --- LA FOURNAISE : tout à la fois ------------------------------------------------
  t('fournaise1', 'LA FOURNAISE', 128, 'phrygien', 0, 'brasier', 0xa5b6c7),
  t('fournaise2', 'TOUT À LA FOIS', 134, 'harmonique', 7, 'brasier', 0xb6c7d8),
  t('fournaise3', 'MOITIÉ PRISE', 118, 'mineur', 4, 'tendu', 0xc7d8e9),
  t('fournaise4', 'BRAISE', 102, 'mixolydien', 11, 'martial', 0xd8e9fa),
  t('fournaise5', 'CENDRES', 86, 'japonais', 8, 'veille', 0xe9fa0b),

  // --- LE VIDE : grand, presque rien -------------------------------------------------
  t('vide1', 'LE VIDE', 70, 'lydien', 2, 'vide', 0xfa0b1c),
  t('vide2', 'DIX SUR DIX', 92, 'pentaMaj', 9, 'calme', 0x0b1c2d),
  t('vide3', 'ASSEZ GRAND', 78, 'majeur', 5, 'nocturne', 0x1c2d3e),
  t('vide4', 'S’Y PERDRE', 66, 'japonais', 0, 'vide', 0x2d3e4f),
  t('vide5', 'LE DERNIER MONDE', 110, 'harmonique', 6, 'brasier', 0x3e4f60),
]

/**
 * Une bande par jeu, pour le reste de la borne. Elles suivent le tempo du jeu
 * plutôt que son thème : un jeu d'esquive à cent quarante, une expédition à
 * soixante-dix.
 */
export const JEUX = [
  t('esquive', 'ESQUIVER', 140, 'phrygien', 4, 'course', 0x110022),
  t('voltige', 'LE TUNNEL', 132, 'dorien', 9, 'course', 0x220033),
  t('grimpe', 'PLUS HAUT', 124, 'penta', 2, 'course', 0x330044),
  t('slalom', 'ENTRE LES MURS', 136, 'mineur', 7, 'course', 0x440055),
  t('fusee', 'POSER EN DOUCEUR', 88, 'lydien', 0, 'nocturne', 0x550066),
  t('casse-brique', 'LE MUR', 118, 'mixolydien', 5, 'mecanique', 0x660077),
  t('serpent', 'LA LIGNE QUI POUSSE', 112, 'penta', 10, 'mecanique', 0x770088),
  t('orbite', 'AUTOUR', 96, 'lydien', 3, 'nocturne', 0x880099),
  t('balance', 'TENIR DEBOUT', 84, 'harmonique', 8, 'tendu', 0x9900aa),
  t('pile', 'UN DE PLUS', 100, 'dorien', 1, 'marche', 0xaa00bb),
  t('corde', 'LA CADENCE', 126, 'pentaMaj', 6, 'fete', 0xbb00cc),
  t('cibles', 'VISER', 130, 'mineur', 11, 'course', 0xcc00dd),
  t('rythme', 'LA MESURE', 120, 'majeur', 4, 'fete', 0xdd00ee),
  t('gardien', 'ARRÊTER TOUT', 122, 'phrygien', 9, 'tendu', 0xee00ff),
  t('tri', 'DEUX BACS', 116, 'dorien', 2, 'mecanique', 0xff0011),
  t('memoire', 'SE SOUVENIR', 82, 'japonais', 7, 'calme', 0x101122),
  t('couleur', 'LE MOT ET LA COULEUR', 104, 'majeur', 0, 'marche', 0x202233),
  t('calcul', 'COMPTER VITE', 128, 'mixolydien', 5, 'mecanique', 0x303344),
  t('visee', 'AU SOMMET', 100, 'phrygien', 8, 'tendu', 0x11223a),
  t('geste', 'LE BON SENS', 134, 'mineur', 1, 'course', 0x22334b),
  t('trace', 'SANS TOUCHER LE BORD', 110, 'dorien', 6, 'mecanique', 0x33445c),
  t('eclair', 'DÉJÀ ÉTEINT', 146, 'harmonique', 3, 'tendu', 0x44556d),
  t('paires', 'DEUX PAR DEUX', 88, 'lydien', 0, 'calme', 0x55667e),
  t('dedale', 'SANS TOUCHER LES MURS', 118, 'phrygien', 5, 'mecanique', 0x66778f),
  t('demineur', 'CE QU’ON DÉDUIT', 74, 'mineur', 10, 'calme', 0x404455),
  t('mille', 'MILLE', 90, 'pentaMaj', 3, 'veille', 0x505566),
  t('taquin', 'REMETTRE EN ORDRE', 86, 'dorien', 8, 'veille', 0x606677),
  t('picross', 'CASE PAR CASE', 78, 'penta', 1, 'calme', 0x778090),
  t('sudoku', 'NEUF CHIFFRES', 72, 'majeur', 6, 'calme', 0x8891a1),
  t('lumieres', 'TOUT ÉTEINDRE', 80, 'lydien', 9, 'nocturne', 0x99a2b2),
  t('code', 'BIEN PLACÉ', 96, 'mixolydien', 4, 'tendu', 0xaab3c3),
  t('solitaire', 'UN SEUL RESTE', 68, 'japonais', 0, 'veille', 0xbbc4d4),
  t('flux', 'RELIER LES DEUX', 84, 'dorien', 11, 'calme', 0xccd5e5),
  t('usine', 'LA GRANDE MACHINE', 108, 'dorien', 6, 'mecanique', 0x808899),
  t('expedition', 'NEUF CENTS KILOMÈTRES', 70, 'mineur', 11, 'calme', 0x9099aa),
  t('front', 'LA COMPAGNIE', 96, 'harmonique', 4, 'martial', 0xa0aabb),
  t('ruee', 'DROIT DEVANT', 150, 'mineur', 9, 'course', 0xb0bbcc),
]

/**
 * Les cinq de RUÉE, une par niveau. Elles sont plus rapides que tout le reste
 * de la borne parce que le niveau est **calé sur elles** : c'est le tempo qui
 * donne l'allure de défilement, donc changer la bande d'un niveau, c'est
 * changer le niveau.
 */
export const RUEE = [
  t('ruee1', 'PREMIÈRE RUÉE', 140, 'mineur', 4, 'course', 0x1155aa),
  t('ruee2', 'LA FERRAILLE', 152, 'phrygien', 9, 'mecanique', 0x2266bb),
  t('ruee3', 'L’ENVOL', 146, 'dorien', 2, 'course', 0x3377cc),
  t('ruee4', 'LES ORBES', 158, 'mixolydien', 7, 'fete', 0x4488dd),
  t('ruee5', 'LA DERNIÈRE', 172, 'harmonique', 0, 'brasier', 0x5599ee),
  t('ruee6', 'À L’ENVERS', 148, 'phrygien', 5, 'mecanique', 0x66aaff),
  t('ruee7', 'LE FIL', 162, 'lydien', 11, 'course', 0x77bb11),
  t('ruee8', 'TOUT EN MÊME TEMPS', 176, 'harmonique', 3, 'brasier', 0x88cc22),
]

export const TOUTES = [...BRECHE, ...RUEE, ...JEUX]
export const PAR_ID = Object.fromEntries(TOUTES.map((x) => [x.id, x]))

/**
 * La bande d'un palier de BRÈCHE.
 *
 * Le jeu n'a plus de mondes : la partie est sans fin et les cinquante morceaux
 * se succèdent au score, un palier tous les 2 200 points. On les entend donc
 * tous dans une seule très longue partie — c'est plus exigeant que l'ancienne
 * répartition par monde, où il fallait cinq cycles pour en faire le tour, et
 * ça donne à la musique le rôle de repère de progression que les écrans de
 * passage tenaient avant.
 */
export const pourPalier = (n) => BRECHE[(((n | 0) % BRECHE.length) + BRECHE.length) % BRECHE.length]

/** La bande d'un jeu, par son identifiant de catalogue. */
export const pourJeu = (id) => JEUX.find((x) => x.id === id) ?? null
