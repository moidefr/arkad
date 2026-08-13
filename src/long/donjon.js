import { C, ton } from '../palette.js'
import { texte, rect, bloc, lueur, PX } from '../dessin.js'

const COLS = 11
const RANGS = 13
const CASE = 32
const X0 = 4
const Y0 = 132
const VUE = 4 // rayon de lumière autour du personnage

/** Le plus grand entier qui fasse tenir treize rangs sous un bandeau, couché. */
const CASE_L = 22

/**
 * Où se pose la carte, et tout ce qui l'entoure.
 *
 * Debout, ce sont les constantes d'origine au pixel près : la grille en haut à
 * gauche, la vie collée sous le bandeau, deux lignes de journal tout en bas.
 * Couché, la carte passe à gauche et le reste devient une colonne à droite —
 * barres, étage, inventaire, et **les six lignes** que `dit()` gardait déjà
 * sans jamais avoir la place de les montrer.
 *
 * Le donjon garde ses 11 × 13 cases dans les deux sens. `carte` et `memoire`
 * sont indexées dessus, et l'étage sauvegardé se relit avec les mêmes index :
 * tourner l'appareil en pleine descente ne peut donc rien rendre incohérent.
 * Seule la case rétrécit — et avec elle tout ce qui se dessine dedans, via
 * `ech()`. Rien n'est mis en cache, il n'y a donc pas de `redim` : chaque image
 * et chaque appui relisent la même disposition.
 *
 * C'est aussi ce qui dispense de tout re-réglage. Un donjon se joue au tour,
 * pas à la seconde : le nombre de pas pour traverser un étage, le nombre de
 * bêtes, la portée de l'archer et le rayon de vue sont comptés en cases, et
 * aucune case n'a été ajoutée ni retirée. Seule la cible du doigt demandait
 * une correction, et elle est faite dans `appui`.
 */
function dispo(j) {
  if (!j.paysage) {
    return {
      taille: CASE,
      x: X0,
      y: Y0,
      // Debout, marcher se commande de n'importe où : l'écran entier est la
      // manette, et c'est ce qui rend le jeu jouable d'une main.
      zone: { x: 0, y: 0, w: j.W, h: j.H },
      panneau: { x: 16, w: j.W - 32 },
      bandeau: { pv: 64, barre: 76, xp: 92, bas: 106, sac: { x: j.W - 16, y: 106, align: 'right', w: 250 } },
      journal: { x: 16, y: j.H - 40, pas: 18, n: 2, w: 328 },
      tresor: { x: j.W / 2, y: 300 },
    }
  }
  const cote = CASE_L
  const x = 12
  const y = 64
  const bord = x + COLS * cote + x // la frontière entre ce qu'on foule et ce qu'on lit
  const col = bord + 12
  const large = j.W - col - 16
  return {
    taille: cote,
    x,
    y,
    zone: { x: 0, y: 0, w: bord, h: j.H },
    panneau: { x: col, w: large },
    bandeau: { pv: 72, barre: 84, xp: 102, bas: 118, sac: { x: col, y: 138, align: 'left', w: large } },
    journal: { x: col, y: 180, pas: 26, n: 6, w: large },
    tresor: { x: x + (COLS * cote) / 2, y: y + (RANGS * cote) / 2 },
  }
}

/**
 * Les tailles du dessin sont données pour la case debout, de 32 pixels. Couché,
 * tout ce qui vit dans une case — le point de sol, la marge de l'escalier, la
 * barre de blessure, les lettres — suit la même réduction, sinon un gobelin de
 * 22 pixels porterait une lettre de 22 pixels.
 */
const ech = (g, v) => Math.round((v * g.taille) / CASE)

const centreX = (g, c) => g.x + c * g.taille + g.taille / 2
const centreY = (g, r) => g.y + r * g.taille + g.taille / 2
const dans = (p, z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h

/**
 * Chaque bête a une manière d'être pénible qui lui est propre. C'est ça qui
 * fait la différence entre un donjon et une suite de sacs à points de vie :
 * l'archer punit les couloirs, le spectre traverse les murs, le golem ne
 * bouge qu'un tour sur deux mais encaisse tout.
 */
const BESTIAIRE = [
  { nom: 'rat', l: 'r', pv: 5, force: 2, xp: 3, couleur: C.faible, ia: 'poursuit', des: 1 },
  { nom: 'chauve-souris', l: 'v', pv: 6, force: 3, xp: 6, couleur: C.violet, ia: 'erratique', des: 1 },
  { nom: 'gobelin', l: 'g', pv: 11, force: 5, xp: 9, couleur: C.vert, ia: 'poursuit', des: 2 },
  { nom: 'archer', l: 'a', pv: 9, force: 6, xp: 14, couleur: C.cyan, ia: 'distance', des: 3 },
  { nom: 'spectre', l: 's', pv: 15, force: 8, xp: 20, couleur: C.violet, ia: 'traverse', des: 4 },
  { nom: 'golem', l: 'G', pv: 34, force: 10, xp: 30, couleur: C.bord, ia: 'lent', des: 5 },
  { nom: 'ogre', l: 'O', pv: 28, force: 13, xp: 38, couleur: C.rouge, ia: 'poursuit', des: 6 },
  { nom: 'dragon', l: 'D', pv: 80, force: 20, xp: 160, couleur: C.accent, ia: 'poursuit', des: 9, boss: true },
]

const OBJETS = {
  fiole: { l: '!', couleur: C.rouge, dit: 'une fiole — tu reprends des forces' },
  pain: { l: '%', couleur: C.vert, dit: 'du pain rassis, mais du pain' },
  epee: { l: '/', couleur: C.cyan, dit: 'une lame mieux équilibrée' },
  armure: { l: ']', couleur: C.faible, dit: 'des plaques en meilleur état' },
  parchemin: { l: '?', couleur: C.accent, dit: "l'étage entier te revient d'un coup" },
  or: { l: '$', couleur: C.accent, dit: 'de l’or' },
}

export default {
  id: 'donjon',
  nom: 'DONJON',
  pitch: 'Descends, frappe en avançant dessus. Ça se garde',
  couleur: C.violet,
  unite: 'étages',
  ciel: C.violet,
  persistant: true,
  // Une carte plus un journal : le genre demande la grille à gauche et le texte
  // à droite. Debout, le rayon de vue ne remplit jamais que 9 × 9 cases — les
  // quatre rangs de plus ne sont que du noir — pendant que six lignes de
  // journal se serrent en deux et que l'inventaire s'écrase sous le bandeau.
  paysage: true,
  confort: 'paysage',

  finTitre: () => ({ texte: 'MORT', couleur: C.rouge }),

  init(j) {
    const s = j.charge()
    j.e.h = s ?? {
      etage: 1,
      pv: 26,
      pvMax: 26,
      force: 5,
      arme: 0,
      armure: 0,
      or: 0,
      xp: 0,
      niveau: 1,
      profond: 1,
    }
    j.e.lignes = [s ? 'tu reprends ta descente' : 'la porte se referme derrière toi']
    j.score = j.e.h.etage
    genere(j)
  },

  dessine(j, ctx) {
    const h = j.e.h
    const g = dispo(j)
    const cote = g.taille
    const relief = Math.max(2, ech(g, 3))

    for (let r = 0; r < RANGS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c
        const d = Math.max(Math.abs(c - h.c), Math.abs(r - h.r))
        const eclaire = d <= VUE
        if (!eclaire && !j.e.memoire[i]) continue
        if (eclaire) j.e.memoire[i] = true

        const x = g.x + c * cote
        const y = g.y + r * cote
        const t = j.e.carte[i]
        if (t === '#') bloc(ctx, x, y, cote, cote, eclaire ? C.bord : ton(C.panneau, -0.3), relief)
        else {
          const point = ech(g, 14)
          rect(ctx, x + point, y + point, ech(g, 3), ech(g, 3), eclaire ? C.faible : C.panneau)
          if (t === '>') {
            const m = ech(g, 6)
            if (eclaire) lueur(ctx, x + m, y + m, cote - m * 2, cote - m * 2, C.accent, 3)
            bloc(ctx, x + m, y + m, cote - m * 2, cote - m * 2, eclaire ? C.accent : C.panneau, Math.max(2, ech(g, 2)))
            texte(ctx, '>', x + cote / 2, y + cote / 2, ech(g, 18), C.fond, 700)
          }
        }
      }
    }

    for (const o of j.e.objets) {
      if (!connu(j, o)) continue
      const d = OBJETS[o.type]
      texte(ctx, d.l, centreX(g, o.c), centreY(g, o.r), ech(g, 20), d.couleur, 700)
    }

    for (const m of j.e.monstres) {
      if (!visible(j, m)) continue
      const t = BESTIAIRE[m.type]
      const x = g.x + m.c * cote
      const y = g.y + m.r * cote
      // Une bête entamée porte sa blessure : on choisit sur quoi s'acharner.
      if (m.pv < m.pvMax) {
        const bord = ech(g, 4)
        rect(ctx, x + bord, y + cote - ech(g, 6), (cote - ech(g, 8)) * (m.pv / m.pvMax), ech(g, 3), C.rouge)
      }
      texte(ctx, t.l, x + cote / 2, y + cote / 2 - ech(g, 2), ech(g, 22), t.couleur, 700)
    }

    const moi = ech(g, 7)
    const x = g.x + h.c * cote + moi
    const y = g.y + h.r * cote + moi
    lueur(ctx, x, y, cote - moi * 2, cote - moi * 2, C.accent, 3)
    bloc(ctx, x, y, cote - moi * 2, cote - moi * 2, C.accent, relief)

    if (j.paysage) {
      // La règle verticale dit aussi où s'arrête la manette : à gauche on
      // marche, à droite on lit.
      rect(ctx, g.zone.w, g.y, PX, RANGS * cote, C.bord)
      rect(ctx, g.panneau.x, g.journal.y - 22, g.panneau.w, PX, C.bord)
    }

    entete(j, ctx, g)
    journal(j, ctx, g)
  },

  appui(j, p) {
    const g = dispo(j)
    if (!dans(p, g.zone)) return
    const h = j.e.h
    const dx = p.x - centreX(g, h.c)
    const dy = p.y - centreY(g, h.r)
    // Appuyer sur soi-même, c'est attendre : parfois le meilleur coup est de
    // laisser l'autre venir à portée. Cette cible-là garde ses 32 pixels de
    // côté même quand la case en fait 22 : c'est un pouce qui vise, et un pouce
    // ne rétrécit pas quand l'écran tourne.
    const attente = Math.max(g.taille, CASE) / 2
    if (Math.abs(dx) < attente && Math.abs(dy) < attente) return tour(j, { c: 0, r: 0 })
    const pas = Math.abs(dx) > Math.abs(dy) ? { c: Math.sign(dx), r: 0 } : { c: 0, r: Math.sign(dy) }
    tour(j, pas)
  },
}

function entete(j, ctx, g) {
  const h = j.e.h
  const b = g.bandeau
  const { x, w } = g.panneau
  const part = Math.max(0, h.pv / h.pvMax)
  rect(ctx, x, b.barre, w, 14, C.panneau)
  rect(ctx, x, b.barre, w * part, 14, part > 0.35 ? C.vert : C.rouge)

  ctx.textAlign = 'left'
  texte(ctx, `${Math.max(0, h.pv)}/${h.pvMax} PV`, x, b.pv, 13, C.texte, 700)
  texte(ctx, `étage ${h.etage}`, x, b.bas, 13, C.accent, 700)
  ctx.textAlign = 'right'
  texte(ctx, `niv ${h.niveau}`, x + w, b.pv, 13, C.faible, 700)
  // Debout, l'inventaire se serre à droite de l'étage faute de place ; couché,
  // la colonne est haute et il descend d'une ligne, en clair.
  ctx.textAlign = b.sac.align
  texte(ctx, `épée +${h.arme} · plaques +${h.armure} · ${h.or} or`, b.sac.x, b.sac.y, 12, C.faible, 700, b.sac.w)
  ctx.textAlign = 'center'

  // Barre d'expérience, fine, juste sous les points de vie.
  const seuil = h.niveau * 20
  rect(ctx, x, b.xp, w, 3, C.panneau)
  rect(ctx, x, b.xp, w * Math.min(1, h.xp / seuil), 3, C.cyan)
}

/**
 * Le journal. `dit()` en garde six depuis toujours ; debout, le bas de l'écran
 * n'en montrait que deux. La colonne couchée les tient toutes, et les plus
 * anciennes s'éteignent au lieu de disparaître d'un coup.
 */
function journal(j, ctx, g) {
  const lignes = j.e.lignes.slice(-g.journal.n)
  ctx.textAlign = 'left'
  lignes.forEach((l, i) => {
    // Au tout premier tour il n'y a qu'une ligne, et rien à quoi la comparer :
    // elle reste éteinte comme le reste du passé.
    const vive = lignes.length > 1 && i === lignes.length - 1
    const couleur = vive ? C.texte : i >= lignes.length - 2 ? C.faible : ton(C.faible, -0.4)
    texte(ctx, l, g.journal.x, g.journal.y + i * g.journal.pas, 13, couleur, 700, g.journal.w)
  })
  ctx.textAlign = 'center'
}

// --- Génération --------------------------------------------------------------

const centre = (s) => ({ c: s.c + (s.w >> 1), r: s.r + (s.h >> 1) })
const visible = (j, e) => Math.max(Math.abs(e.c - j.e.h.c), Math.abs(e.r - j.e.h.r)) <= VUE
const connu = (j, e) => visible(j, e) || j.e.memoire[e.r * COLS + e.c]

/** Les bêtes disponibles à cet étage : la table monte avec la profondeur. */
function pool(etage) {
  return BESTIAIRE.filter((b) => !b.boss && b.des <= Math.max(2, etage))
}

function genere(j) {
  const etage = j.e.h.etage
  const boss = etage % 5 === 0
  const carte = Array(COLS * RANGS).fill('#')
  const salles = []

  const vise = boss ? 3 : 5 + Math.min(2, Math.floor(etage / 4))
  for (let k = 0; k < 60 && salles.length < vise; k++) {
    const w = 2 + Math.floor(Math.random() * (boss ? 5 : 3))
    const hh = 2 + Math.floor(Math.random() * (boss ? 4 : 3))
    const c = 1 + Math.floor(Math.random() * (COLS - w - 2))
    const r = 1 + Math.floor(Math.random() * (RANGS - hh - 2))
    if (salles.some((s) => c < s.c + s.w + 1 && c + w + 1 > s.c && r < s.r + s.h + 1 && r + hh + 1 > s.r)) continue
    salles.push({ c, r, w, h: hh })
  }

  const creuse = (c, r) => {
    if (c > 0 && c < COLS - 1 && r > 0 && r < RANGS - 1) carte[r * COLS + c] = '.'
  }
  for (const s of salles) {
    for (let c = s.c; c < s.c + s.w; c++) for (let r = s.r; r < s.r + s.h; r++) creuse(c, r)
  }
  for (let i = 1; i < salles.length; i++) {
    const a = centre(salles[i - 1])
    const b = centre(salles[i])
    for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) creuse(c, a.r)
    for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) creuse(b.c, r)
  }

  const depart = centre(salles[0])
  const sortie = centre(salles[salles.length - 1])
  carte[sortie.r * COLS + sortie.c] = '>'

  j.e.carte = carte
  j.e.memoire = Array(COLS * RANGS).fill(false)
  j.e.salles = salles
  j.e.h.c = depart.c
  j.e.h.r = depart.r
  j.e.boss = boss

  j.e.monstres = []
  if (boss) {
    // Un étage sur cinq : une seule bête, énorme, et de quoi se soigner avant.
    const s = salles[salles.length - 1]
    const t = BESTIAIRE[BESTIAIRE.length - 1]
    const echelle = 1 + (etage - 5) * 0.35
    pose(j, {
      c: s.c + (s.w >> 1),
      r: s.r + (s.h >> 1),
      pv: Math.round(t.pv * echelle),
      pvMax: Math.round(t.pv * echelle),
      force: Math.round(t.force * echelle * 0.7),
      type: BESTIAIRE.length - 1,
      lent: false,
    })
    j.e.lignes.push(`quelque chose de grand respire au fond de l’étage ${etage}`)
  } else {
    const table = pool(etage)
    const combien = Math.min(10, 3 + Math.floor(etage / 1.4))
    for (let k = 0; k < combien; k++) {
      const s = salles[1 + Math.floor(Math.random() * (salles.length - 1))]
      const t = table[Math.floor(Math.random() * table.length)]
      const type = BESTIAIRE.indexOf(t)
      pose(j, {
        c: s.c + Math.floor(Math.random() * s.w),
        r: s.r + Math.floor(Math.random() * s.h),
        pv: t.pv + etage * 2,
        pvMax: t.pv + etage * 2,
        force: t.force + Math.floor(etage / 2),
        type,
        lent: false,
      })
    }
  }

  j.e.objets = []
  const butin = boss ? 4 : 2 + (Math.random() < 0.4 ? 1 : 0)
  for (let k = 0; k < butin; k++) {
    const s = salles[Math.floor(Math.random() * salles.length)]
    j.e.objets.push({
      c: s.c + Math.floor(Math.random() * s.w),
      r: s.r + Math.floor(Math.random() * s.h),
      type: tirageObjet(boss),
    })
  }
}

function pose(j, m) {
  if (j.e.monstres.some((o) => o.c === m.c && o.r === m.r)) return
  j.e.monstres.push(m)
}

function tirageObjet(boss) {
  const d = Math.random()
  if (boss) return d < 0.5 ? 'epee' : d < 0.85 ? 'armure' : 'fiole'
  if (d < 0.34) return 'fiole'
  if (d < 0.54) return 'pain'
  if (d < 0.68) return 'or'
  if (d < 0.8) return 'parchemin'
  if (d < 0.91) return 'epee'
  return 'armure'
}

// --- Un tour -----------------------------------------------------------------

function dit(j, ligne) {
  j.e.lignes.push(ligne)
  if (j.e.lignes.length > 6) j.e.lignes.shift()
}

function libre(j, c, r, traverse = false) {
  if (c < 0 || c >= COLS || r < 0 || r >= RANGS) return false
  if (!traverse && j.e.carte[r * COLS + c] === '#') return false
  return true
}

function tour(j, pas) {
  const h = j.e.h
  if (pas.c || pas.r) {
    const c = h.c + pas.c
    const r = h.r + pas.r
    if (!libre(j, c, r)) return

    const cible = j.e.monstres.find((m) => m.c === c && m.r === r)
    if (cible) frappe(j, cible)
    else {
      h.c = c
      h.r = r
      ramasse(j)
      if (j.e.carte[r * COLS + c] === '>') return descend(j)
    }
  } else dit(j, 'tu attends')

  monstres(j)
  if (h.pv > 0) ecrit(j)
}

function frappe(j, m) {
  const h = j.e.h
  const g = dispo(j)
  const degats = h.force + h.arme * 2 + Math.floor(Math.random() * 3)
  m.pv -= degats
  j.son.casse(4)
  j.fx.eclat(centreX(g, m.c), centreY(g, m.r), C.rouge, { n: 8, vitesse: 120 })
  if (m.pv > 0) {
    dit(j, `tu frappes le ${BESTIAIRE[m.type].nom} (${degats})`)
    return
  }
  j.e.monstres.splice(j.e.monstres.indexOf(m), 1)
  h.xp += BESTIAIRE[m.type].xp + j.e.h.etage
  dit(j, `le ${BESTIAIRE[m.type].nom} tombe`)
  j.son.touche(6)
  if (BESTIAIRE[m.type].boss) {
    h.or += 50 + j.e.h.etage * 10
    dit(j, 'son trésor est à toi')
    j.fx.eclat(g.tresor.x, g.tresor.y, C.accent, { n: 30, vitesse: 240 })
  }
  monte(j)
}

function monte(j) {
  const h = j.e.h
  const seuil = h.niveau * 20
  if (h.xp < seuil) return
  h.xp -= seuil
  h.niveau++
  h.pvMax += 5
  h.pv = h.pvMax
  h.force += 2
  dit(j, `niveau ${h.niveau} — tu te sens plus solide`)
  j.son.niveau()
  const g = dispo(j)
  j.fx.eclat(centreX(g, h.c), centreY(g, h.r), C.accent, { n: 18, vitesse: 160 })
}

function ramasse(j) {
  const h = j.e.h
  const i = j.e.objets.findIndex((o) => o.c === h.c && o.r === h.r)
  if (i === -1) return
  const o = j.e.objets.splice(i, 1)[0]

  if (o.type === 'fiole') h.pv = Math.min(h.pvMax, h.pv + 14)
  else if (o.type === 'pain') h.pv = Math.min(h.pvMax, h.pv + 6)
  else if (o.type === 'epee') h.arme++
  else if (o.type === 'armure') h.armure++
  else if (o.type === 'or') h.or += 5 + Math.floor(Math.random() * 10 * h.etage)
  else if (o.type === 'parchemin') j.e.memoire = j.e.memoire.map(() => true)

  dit(j, OBJETS[o.type].dit)
  j.son.ramasse()
  const g = dispo(j)
  j.fx.eclat(centreX(g, h.c), centreY(g, h.r), OBJETS[o.type].couleur, { n: 10, vitesse: 120 })
}

function attaque(j, m, portee) {
  const h = j.e.h
  const degats = Math.max(1, m.force - h.armure - Math.floor(Math.random() * 3))
  h.pv -= degats
  dit(j, `${portee ? 'une flèche te trouve' : `le ${BESTIAIRE[m.type].nom} te touche`} (${degats})`)
  j.son.rate()
  j.fx.secoue(portee ? 3 : 5)
}

function monstres(j) {
  const h = j.e.h
  for (const m of j.e.monstres) {
    const t = BESTIAIRE[m.type]
    const dc = h.c - m.c
    const dr = h.r - m.r
    const d = Math.abs(dc) + Math.abs(dr)

    if (t.ia === 'lent') {
      m.lent = !m.lent
      if (m.lent) continue // un tour sur deux, le golem regarde ailleurs
    }

    if (d === 1) {
      attaque(j, m, false)
      if (h.pv <= 0) return meurt(j)
      continue
    }

    // L'archer tire dans les lignes dégagées : les couloirs deviennent
    // dangereux au lieu d'être des refuges.
    if (t.ia === 'distance' && (dc === 0 || dr === 0) && d <= 4 && ligneDegagee(j, m, h)) {
      attaque(j, m, true)
      if (h.pv <= 0) return meurt(j)
      continue
    }

    if (t.ia === 'erratique' && Math.random() < 0.45) {
      const dirs = [
        { c: 1, r: 0 },
        { c: -1, r: 0 },
        { c: 0, r: 1 },
        { c: 0, r: -1 },
      ]
      const p = dirs[Math.floor(Math.random() * 4)]
      if (libre(j, m.c + p.c, m.r + p.r) && !occupe(j, m, m.c + p.c, m.r + p.r)) {
        m.c += p.c
        m.r += p.r
      }
      continue
    }

    if (d > 8) continue
    const pas = Math.abs(dc) > Math.abs(dr) ? { c: Math.sign(dc), r: 0 } : { c: 0, r: Math.sign(dr) }
    const c = m.c + pas.c
    const r = m.r + pas.r
    if (!libre(j, c, r, t.ia === 'traverse')) continue
    if (c === h.c && r === h.r) continue
    if (occupe(j, m, c, r)) continue
    m.c = c
    m.r = r
  }
}

const occupe = (j, moi, c, r) => j.e.monstres.some((o) => o !== moi && o.c === c && o.r === r)

function ligneDegagee(j, a, b) {
  const pc = Math.sign(b.c - a.c)
  const pr = Math.sign(b.r - a.r)
  let c = a.c + pc
  let r = a.r + pr
  while (c !== b.c || r !== b.r) {
    if (j.e.carte[r * COLS + c] === '#') return false
    c += pc
    r += pr
  }
  return true
}

function descend(j) {
  const h = j.e.h
  h.etage++
  h.profond = Math.max(h.profond, h.etage)
  h.pv = Math.min(h.pvMax, h.pv + 8)
  j.score = h.etage
  dit(j, `étage ${h.etage}`)
  j.son.niveau()
  genere(j)
  ecrit(j)
}

function meurt(j) {
  j.score = j.e.h.etage
  dit(j, 'tu tombes')
  j.efface() // une mort efface la sauvegarde : c'est un roguelike
  j.perdu()
}

/** On écrit après chaque tour : fermer l'application ne coûte jamais rien. */
function ecrit(j) {
  const h = j.e.h
  j.sauve({
    etage: h.etage,
    pv: h.pv,
    pvMax: h.pvMax,
    force: h.force,
    arme: h.arme,
    armure: h.armure,
    or: h.or,
    xp: h.xp,
    niveau: h.niveau,
    profond: h.profond,
  })
}
