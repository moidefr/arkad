/**
 * Où tombe chaque chose de FRONT, dans les deux gabarits.
 *
 * Un seul endroit décide des rectangles ; le dessin et le doigt lisent le même.
 * C'est la règle qui a coûté un jeu entier à ce projet — huit pixels d'écart
 * entre ce qu'on voit et ce qu'on touche ne lèvent aucune erreur, ils rendent
 * le jeu menteur.
 *
 * **Debout**, les valeurs sont celles d'avant, écrites en clair et non
 * recalculées : FRONT était réglé au pixel, il ne bouge pas d'un pixel.
 *
 * **Couché**, la carte hexagonale cesse d'être le problème du jeu. Une grille
 * de 19 × 15 mesure 33,8 R de large pour 23 R de haut — un rapport de 1,47.
 * La fenêtre debout vaut 0,99, celle couchée 1,46 : le champ tombe pile dans
 * le gabarit couché, et les panneaux d'ordres passent à droite au lieu de
 * manger la moitié basse. Les listes passent à deux colonnes, sans quoi une
 * hauteur de 360 n'en montrerait plus que deux lignes.
 */

const couche = (j) => j.W > j.H

// --- Le châssis des écrans de menu ---------------------------------------------------

/**
 * L'entête et la bourse, communes aux huit écrans hors bataille.
 *
 * Couché, la bourse remonte sur la ligne de titre. Elle y prend la place qui
 * ne servait à rien, et rend au bas de l'écran les cinquante pixels dont les
 * listes et les rangées de boutons ont besoin.
 */
export function chassis(j) {
  if (couche(j))
    return {
      large: true,
      M: 20,
      L: j.W - 40,
      entete: {
        titre: { x: 20, y: 76, max: 190 },
        sous: { x: 325, y: 76, max: 110 },
        trait: { x: 20, y: 90, w: j.W - 40 },
      },
      legende: 102,
    }
  return {
    large: false,
    M: 20,
    L: 320,
    entete: {
      titre: { x: 20, y: 76, max: 250 },
      sous: { x: 340, y: 76, max: 150 },
      trait: { x: 20, y: 90, w: 320 },
    },
    legende: 106,
  }
}

/** `bas` : les deux écrans les plus chargés descendent leur bourse de seize pixels. */
export function bourse(j, bas = false) {
  if (couche(j))
    return {
      trait: null,
      or: { x: j.W - 20, y: 76, taille: 15, max: 100, droite: true },
      etat: { x: j.W - 135, y: 76, taille: 11, max: 165, droite: true },
    }
  const y = bas ? 616 : 600
  return {
    trait: { x: 0, y: y - 8, w: 360 },
    or: { x: 20, y: y + 10, taille: 15, max: 140, droite: false },
    etat: { x: 340, y: y + 10, taille: 12, max: 200, droite: true },
  }
}

// --- Le titre --------------------------------------------------------------------------

export function titre(j, reprise) {
  if (couche(j))
    return {
      bande: { x: 0, y: 66, w: j.W, h: 150 },
      lueur: { x: 200, y: 104, w: 240, h: 44 },
      nom: { x: 320, y: 130, max: 320 },
      sous: { x: 320, y: 168, max: 400 },
      meta: [
        { x: 320, y: 196 },
        { x: 320, y: 214 },
      ],
      reprendre: { x: 60, y: 238, w: 250, h: 56, quoi: 'reprendre' },
      nouvelle: reprise
        ? { x: 330, y: 238, w: 250, h: 56, quoi: 'nouvelle' }
        : { x: 190, y: 238, w: 260, h: 56, quoi: 'nouvelle' },
      pied: [
        { x: 320, y: 318 },
        { x: 320, y: 336 },
      ],
    }
  return {
    bande: { x: 0, y: 96, w: 360, h: 180 },
    lueur: { x: 60, y: 120, w: 240, h: 44 },
    nom: { x: 180, y: 146, max: 320 },
    sous: { x: 180, y: 186, max: 330 },
    meta: [
      { x: 180, y: 214 },
      { x: 180, y: 232 },
    ],
    reprendre: { x: 50, y: 300, w: 260, h: 56, quoi: 'reprendre' },
    nouvelle: { x: 50, y: reprise ? 368 : 300, w: 260, h: 56, quoi: 'nouvelle' },
    pied: [
      { x: 180, y: 470 },
      { x: 180, y: 490 },
    ],
  }
}

// --- Le camp ----------------------------------------------------------------------------

const QUATRE = ['campagne', 'caserne', 'uniques', 'compagnie']

/**
 * Le cinquième bouton, vers les bâtiments, ne rejoint pas la grille des
 * quatre premiers : sa forme (une bande large et basse) est différente, et
 * la ligne le fait tenir sous 360 px de haut couché. C'est un pis-aller —
 * le lot 6 remplace cet écran entier par le village vivant — mais tant
 * qu'il n'existe pas, les bâtiments ont besoin d'une porte.
 */
export function camp(j) {
  const c = chassis(j)
  const resume = { x: c.M, y: 100, w: c.L, h: 66 }
  if (c.large) {
    // Deux colonnes de deux, rangées resserrées à 46 pour laisser la place à
    // la bande « BÂTIMENTS » sous elles, et encore deux lignes de texte.
    const w = Math.floor((c.L - 10) / 2)
    const items = QUATRE.map((quoi, i) => ({
      x: c.M + (i % 2) * (w + 10),
      y: 180 + Math.floor(i / 2) * 54,
      w,
      h: 46,
      quoi,
    }))
    items.push({ x: c.M, y: 288, w: c.L, h: 40, quoi: 'ville' })
    return {
      resume,
      items,
      dernier: { x: c.M, y: 340 },
      alerte: { x: c.M, y: 354 },
    }
  }
  const items = QUATRE.map((quoi, i) => ({ x: c.M, y: 180 + i * 68, w: c.L, h: 58, quoi }))
  items.push({ x: c.M, y: 180 + 4 * 68, w: c.L, h: 46, quoi: 'ville' })
  return {
    resume,
    items,
    dernier: { x: c.M, y: 512 },
    alerte: { x: c.M, y: 530 },
  }
}

// --- Les bâtiments ------------------------------------------------------------------

/** La liste des neuf bâtiments : même fenêtre défilante que la caserne. */
export function ville(j) {
  const c = chassis(j)
  if (c.large)
    return {
      legende: { x: c.M, y: c.legende },
      zone: { x: c.M, y: 112, w: c.L, h: 170 },
      cols: 2,
      ligne: 62,
      retour: { x: c.M, y: 304, w: c.L, h: 36, quoi: 'retour' },
    }
  return {
    legende: { x: c.M, y: c.legende },
    zone: { x: c.M, y: 118, w: c.L, h: 396 },
    cols: 1,
    ligne: 62,
    retour: { x: c.M, y: 544, w: c.L, h: 38, quoi: 'retour' },
  }
}

/**
 * Le détail d'un bâtiment : la fiche (nom, niveau, coût) en tête, et une
 * fenêtre défilante en dessous pour ce qui est propre à chacun — les
 * sessions de la caserne, l'étal du marché, les objets de la forge, les
 * types du terrain d'entraînement. Un bâtiment qui n'a rien de propre laisse
 * la fenêtre vide : sa fiche et son bouton CONSTRUIRE suffisent.
 */
export function batiment(j) {
  const c = chassis(j)
  if (c.large)
    return {
      fiche: { x: c.M, y: 98, w: c.L, h: 92 },
      construire: { x: c.M, y: 196, w: c.L, h: 36, quoi: 'construire' },
      legende: { x: c.M, y: 246 },
      zone: { x: c.M, y: 252, w: c.L, h: 60 },
      cols: 3,
      ligne: 56,
      retour: { x: c.M, y: 316, w: c.L, h: 30, quoi: 'retour' },
    }
  return {
    fiche: { x: c.M, y: 98, w: c.L, h: 110 },
    construire: { x: c.M, y: 216, w: c.L, h: 44, quoi: 'construire' },
    legende: { x: c.M, y: 274 },
    zone: { x: c.M, y: 280, w: c.L, h: 258 },
    cols: 1,
    ligne: 56,
    retour: { x: c.M, y: 544, w: c.L, h: 38, quoi: 'retour' },
  }
}

// --- Les engagements -----------------------------------------------------------------------

export function campagne(j, offres = 3) {
  const c = chassis(j)
  if (c.large) {
    // Deux ou trois offres selon le niveau : elles se partagent la largeur au
    // lieu de laisser un trou à droite quand il n'y en a que deux.
    const n = Math.max(1, offres)
    const w = Math.floor((c.L - (n - 1) * 9) / n)
    return {
      offres: Array.from({ length: offres }, (_, i) => ({
        x: c.M + i * (w + 9),
        y: 100,
        w,
        h: 190,
        quoi: 'offre',
        k: i,
      })),
      // Couché, chaque offre est une colonne étroite : la prime et le renom
      // descendent sous la difficulté au lieu de la percuter à droite.
      dy: { nom: 20, obj: 38, para: 54, dims: 124, diff: 140, or: 158, renom: 174 },
      engager: { x: c.M, y: 298, w: 390, h: 40, quoi: 'engager' },
      retour: { x: 416, y: 298, w: 204, h: 40, quoi: 'retour' },
    }
  }
  return {
    offres: Array.from({ length: offres }, (_, i) => ({
      x: c.M,
      y: 100 + i * 126,
      w: c.L,
      h: 118,
      quoi: 'offre',
      k: i,
    })),
    dy: { nom: 20, obj: 38, para: 54, dims: 88, diff: 104, or: 88, renom: 104 },
    engager: { x: c.M, y: 490, w: c.L, h: 46, quoi: 'engager' },
    retour: { x: c.M, y: 544, w: c.L, h: 38, quoi: 'retour' },
  }
}

// --- Les trois listes ------------------------------------------------------------------------

/**
 * Caserne, état-major, compagnie : la même fenêtre défilante, à trois hauteurs
 * de ligne près. Couché, deux colonnes — une fenêtre de 170 px ne montrerait
 * sinon que deux recrues.
 */
export function caserne(j) {
  const c = chassis(j)
  if (c.large)
    return {
      legende: { x: c.M, y: c.legende },
      zone: { x: c.M, y: 112, w: c.L, h: 170 },
      cols: 2,
      ligne: 62,
      vide: { x: c.M, y: 150 },
      plein: { x: c.M, y: 294 },
      retour: { x: c.M, y: 304, w: c.L, h: 36, quoi: 'retour' },
    }
  return {
    legende: { x: c.M, y: c.legende },
    zone: { x: c.M, y: 118, w: c.L, h: 396 },
    cols: 1,
    ligne: 62,
    vide: { x: c.M, y: 160 },
    plein: { x: c.M, y: 528 },
    retour: { x: c.M, y: 544, w: c.L, h: 38, quoi: 'retour' },
  }
}

export function uniques(j) {
  const c = chassis(j)
  if (c.large)
    return {
      // La légende remonte de quatre pixels : les dossiers sont les plus hauts
      // du jeu, et c'est la seule liste dont la première ligne monte à 104.
      legende: { x: c.M, y: 98 },
      // 170 pour une rangée entière et le tiers de la suivante, découpée au
      // cadre : c'est ce bout de dossier qui dit qu'il y a autre chose dessous.
      zone: { x: c.M, y: 104, w: c.L, h: 170 },
      cols: 2,
      ligne: 126,
      vide: { x: c.M, y: 140 },
      eclat: { x: j.W / 2, y: 189 },
      retour: { x: c.M, y: 300, w: c.L, h: 36, quoi: 'retour' },
    }
  return {
    legende: { x: c.M, y: c.legende },
    zone: { x: c.M, y: 118, w: c.L, h: 396 },
    cols: 1,
    ligne: 130,
    vide: { x: c.M, y: 160 },
    eclat: { x: 180, y: 300 },
    retour: { x: c.M, y: 544, w: c.L, h: 38, quoi: 'retour' },
  }
}

/**
 * La compagnie porte en plus une rangée d'escouades, dont le nombre change en
 * cours de campagne : `n` est le nombre de boutons de cette rangée.
 */
export function compagnie(j, n, peutOuvrir) {
  const c = chassis(j)
  const rangee = (y, h) => {
    const w = Math.floor((c.L - (n - 1) * 6) / n)
    return Array.from({ length: n }, (_, i) => ({ x: c.M + i * (w + 6), y, w, h }))
  }
  if (c.large)
    return {
      legende: { x: c.M, y: c.legende },
      zone: { x: c.M, y: 112, w: c.L, h: 150 },
      cols: 2,
      ligne: 46,
      escouades: rangee(268, 34),
      invite: { x: c.M, y: 286 },
      fiche: { x: c.M, y: 308, w: 294, h: 36, quoi: 'fiche' },
      ouvrir: { x: 320, y: 308, w: 146, h: 36, quoi: 'nouvelleEscouade' },
      retour: peutOuvrir
        ? { x: 472, y: 308, w: 148, h: 36, quoi: 'retour' }
        : { x: 320, y: 308, w: 300, h: 36, quoi: 'retour' },
    }
  return {
    legende: { x: c.M, y: c.legende },
    zone: { x: c.M, y: 116, w: c.L, h: 348 },
    cols: 1,
    ligne: 46,
    escouades: rangee(472, 36),
    invite: { x: c.M, y: 492 },
    fiche: { x: c.M, y: 514, w: c.L, h: 38, quoi: 'fiche' },
    ouvrir: { x: c.M, y: 556, w: 150, h: 34, quoi: 'nouvelleEscouade' },
    retour: peutOuvrir
      ? { x: c.M + 158, y: 556, w: c.L - 158, h: 34, quoi: 'retour' }
      : { x: c.M, y: 556, w: c.L, h: 34, quoi: 'retour' },
  }
}

// --- La fiche d'une troupe -------------------------------------------------------------------

export function fiche(j) {
  const c = chassis(j)
  if (c.large) {
    // Couché : l'état civil, l'équipement et les types à gauche, les
    // aptitudes à droite. C'est la seule page du jeu dont le contenu ne
    // tient pas debout dans 300 px de haut.
    const p = { x: c.M, y: 98, w: 290, h: 70 }
    const eqW = Math.floor((p.w - 16) / 3)
    return {
      panneau: p,
      stats: { x: c.M, y: 172, w: p.w, h: 26 },
      equip: [0, 1, 2].map((i) => ({ x: c.M + i * (eqW + 8), y: 202, w: eqW, h: 32, quoi: 'equipSlot' })),
      types: { x: c.M, y: 238, w: p.w, h: 26 },
      compteurs: { x: c.M, y: 270 },
      apTitre: { x: 330, y: 104 },
      apZone: { x: 330, y: 124, w: 290, h: 176 },
      soigne: { x: c.M, y: 308, w: 190, h: 36, quoi: 'soigne' },
      reforme: { x: 216, y: 308, w: 190, h: 36, quoi: 'reforme' },
      retour: { x: 412, y: 308, w: 208, h: 36, quoi: 'retour' },
    }
  }
  const p = { x: c.M, y: 98, w: c.L, h: 92 }
  const eqW = Math.floor((c.L - 16) / 3)
  const demi = Math.floor((c.L - 6) / 2)
  return {
    panneau: p,
    stats: { x: c.M, y: 198, w: c.L, h: 32 },
    equip: [0, 1, 2].map((i) => ({ x: c.M + i * (eqW + 8), y: 238, w: eqW, h: 46, quoi: 'equipSlot' })),
    types: { x: c.M, y: 292, w: c.L, h: 34 },
    compteurs: { x: c.M, y: 492 },
    apTitre: { x: c.M, y: 330 },
    apZone: { x: c.M, y: 340, w: c.L, h: 148 },
    soigne: { x: c.M, y: 508, w: demi, h: 38, quoi: 'soigne' },
    reforme: { x: c.M + demi + 6, y: 508, w: demi, h: 38, quoi: 'reforme' },
    retour: { x: c.M, y: 552, w: c.L, h: 36, quoi: 'retour' },
  }
}

// --- Le bilan ---------------------------------------------------------------------------------

/**
 * Trois listes qui s'empilent : promotions, butin, disparus. Debout elles se
 * suivent en une colonne ; couché elles tiennent chacune la sienne, ce qui
 * évite qu'un revers coûteux écrive par-dessus le bouton AU CAMP.
 */
export function bilan(j) {
  const c = chassis(j)
  if (c.large)
    return {
      lueur: { x: 200, y: 66, w: 240, h: 36 },
      mot: { x: j.W / 2, y: 88, max: 330 },
      titre: { x: j.W / 2, y: 112, max: 330 },
      panneau: { x: c.M, y: 126, w: c.L, h: 46 },
      or: { y: 148 },
      renom: { y: 148 },
      niveau: { y: 166 },
      colonnes: [c.M, 222, 424],
      largeur: 188,
      debut: 186,
      max: 300,
      suite: { x: c.M, y: 308, w: c.L, h: 40, quoi: 'suite' },
    }
  return {
    lueur: { x: 60, y: 96, w: 240, h: 40 },
    mot: { x: 180, y: 118, max: 330 },
    titre: { x: 180, y: 146, max: 330 },
    panneau: { x: c.M, y: 164, w: c.L, h: 54 },
    or: { y: 186 },
    renom: { y: 186 },
    niveau: { y: 208 },
    colonnes: [c.M, c.M, c.M],
    largeur: c.L,
    debut: 240,
    max: 546,
    suite: { x: c.M, y: 552, w: c.L, h: 44, quoi: 'suite' },
  }
}

// --- La bataille --------------------------------------------------------------------------------

/**
 * Le bandeau, le champ, le panneau.
 *
 * Debout ils s'empilent et pavent exactement 640 : 56 + 32 + 364 + 188.
 * Couché, le champ prend la colonne de gauche et le panneau celle de droite —
 * c'est le gain principal de tout ce travail. Le panneau y gagne 304 px de
 * haut pour 184 de contenu, et les deux boutons du bandeau repassent enfin
 * au-dessus des 44 × 30 réglementaires.
 */
export function bataille(j) {
  if (couche(j)) {
    // Le panneau démarre pile où le champ s'arrête : les hexagones débordent
    // de leur fenêtre d'un rayon ou deux, et c'est lui qui les recouvre. Un
    // interstice de quatre pixels aurait laissé voir des bouts de nid d'abeille.
    const coupe = 392
    const panneau = { x: coupe, y: 56, w: j.W - coupe, h: j.H - 56 }
    // La largeur utile du panneau. Couché elle tombe à 232 px : toute largeur
    // de texte taillée pour les 344 du portrait s'y recouvre, et deux lignes
    // opaques l'une sur l'autre ne lèvent aucune erreur.
    const pw = panneau.w - 16
    return {
      large: true,
      bandeau: { x: 0, y: 56, w: coupe, h: 36 },
      objectif: { x: 8, dy: 12, max: 150 },
      tour: { x: 8, dy: 26, max: 150 },
      zoom: { x: 172, y: 59, w: 60, h: 30, quoi: 'zoom' },
      fin: { x: 238, y: 59, w: 146, h: 30, quoi: 'finTour' },
      champ: { x: 0, y: 92, w: coupe, h: j.H - 92 },
      panneau,
      px: panneau.x + 8,
      pw,
      tourAdverse: { x: 0, y: j.H - 22, w: coupe, h: 22 },
      vignettes: { cols: 4, h: 42 },
      // Les deux compteurs ne tiennent plus côte à côte : ils s'empilent, et la
      // colonne a de quoi les loger sans rien pousser sous l'écran.
      repos: { compte: 16, reste: 34, maxCompte: pw, maxReste: pw, vignettes: 44 },
      // Le panneau a 304 px de haut pour 184 de contenu debout : plutôt que de
      // laisser cent vingt pixels vides, les trois rangées de boutons passent
      // de 36/34/34 à 48/46/46. C'est le pouce qui y gagne.
      unite: {
        nom: 22,
        sous: 42,
        pv: 54,
        pvTexte: 62,
        moral: 72,
        moralTexte: 78,
        y1: 100,
        pas2: 58,
        pas3: 56,
        h1: 48,
        h2: 46,
        h3: 46,
        // Chaque ligne porte un texte à gauche et un à droite : ce qu'on donne
        // à l'un, on le retire à l'autre, huit pixels de jour compris.
        maxNom: pw - 98,
        maxPm: 90,
        maxSous: pw - 102,
        maxCouvert: 94,
      },
      prevision: {
        nom: 20,
        panneau: 30,
        hPanneau: 52,
        inflige: 46,
        chiffre: 48,
        barre: 64,
        riposte: 90,
        hRiposte: 36,
        ripTexte: 108,
        detail: 132,
        cols: 1,
        pas: 16,
        couvert: 186,
        boutons: 206,
        hBouton: 40,
      },
      // Le compte de points de vie descend sous la jauge au lieu de partager sa
      // ligne avec les statistiques : à 232 px, les deux s'écrivaient l'un sur
      // l'autre sur une trentaine de pixels.
      inspect: {
        nom: 22,
        sous: 40,
        barre: 52,
        pv: 74,
        stats: 94,
        terrain: 114,
        apt: 134,
        maxStats: pw,
        maxPv: pw,
        fermer: 250,
        hFermer: 36,
      },
    }
  }
  const champ = { x: 0, y: 88, w: 360, h: 364 }
  const panneau = { x: 0, y: champ.y + champ.h, w: 360, h: j.H - (champ.y + champ.h) }
  return {
    large: false,
    bandeau: { x: 0, y: 56, w: 360, h: 32 },
    objectif: { x: 8, dy: 11, max: 118 },
    tour: { x: 8, dy: 25, max: 118 },
    zoom: { x: 136, y: 59, w: 52, h: 26, quoi: 'zoom' },
    fin: { x: 194, y: 59, w: 158, h: 26, quoi: 'finTour' },
    champ,
    panneau,
    px: panneau.x + 8,
    pw: panneau.w - 16,
    tourAdverse: { x: 0, y: panneau.y - 22, w: 360, h: 22 },
    vignettes: { cols: 6, h: 42 },
    // Debout, les deux compteurs tiennent sur la même ligne : 210 + 130 font
    // les 344 px du panneau, au pixel près.
    repos: { compte: 16, reste: 16, maxCompte: 210, maxReste: 130, vignettes: 26 },
    unite: {
      nom: 18,
      sous: 34,
      pv: 44,
      pvTexte: 49,
      moral: 56,
      moralTexte: 61,
      y1: 70,
      pas2: 40,
      pas3: 40,
      h1: 36,
      h2: 34,
      h3: 34,
      maxNom: 210,
      maxPm: 90,
      maxSous: 230,
      maxCouvert: 110,
    },
    prevision: {
      nom: 16,
      panneau: 24,
      hPanneau: 46,
      inflige: 38,
      chiffre: 40,
      barre: 54,
      riposte: 74,
      hRiposte: 30,
      ripTexte: 90,
      detail: 110,
      cols: 2,
      pas: 14,
      couvert: 136,
      boutons: 148,
      hBouton: 36,
    },
    inspect: {
      nom: 18,
      sous: 34,
      barre: 42,
      pv: 62,
      stats: 62,
      terrain: 78,
      apt: 96,
      maxStats: 250,
      maxPv: 80,
      fermer: 148,
      hFermer: 34,
    },
  }
}
