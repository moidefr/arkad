/**
 * L'AVENTURE — le jeu central de la borne.
 *
 * Pour l'instant c'est un squelette, mais un squelette qui tourne : un
 * personnage qui court tout seul, un bouton qui le fait sauter, des niveaux
 * écrits en texte dans niveaux.js, et une progression qui se retient.
 *
 * Il se branche sur le moteur comme n'importe quel jeu, mais gère ses propres
 * écrans (carte des niveaux, niveau, réussite) parce que lui seul sait ce
 * qu'est « avancer ».
 *
 * Ce qu'il reste à faire : de vrais niveaux, un décor, une raison d'avancer.
 */
import { C } from '../palette.js'
import { texte, rect, cadre, trame, borne } from '../dessin.js'
import { NIVEAUX, TUILE, RANGS, normalise } from './niveaux.js'
import { lis, ecris } from '../stockage.js'

const CLE = 'aventure.faits'

// Le personnage avance seul : le saut est la seule chose qu'on contrôle.
const VX = 92
const G = 900
const SAUT = 300
const COYOTE = 0.1 // on peut encore sauter juste après avoir quitté le sol
const TAMPON = 0.12 // un appui juste avant d'atterrir est mémorisé
const LARGEUR_J = 14
const HAUTEUR_J = 18

export function faits() {
  try {
    return new Set(JSON.parse(lis(CLE, '[]')))
  } catch {
    return new Set()
  }
}

function marque(i) {
  const f = faits()
  f.add(i)
  ecris(CLE, JSON.stringify([...f]))
}

function ouvert(i, f = faits()) {
  return i === 0 || f.has(i - 1)
}

export default {
  id: 'aventure',
  nom: 'AVENTURE',
  pitch: 'Il court tout seul. Appuie pour sauter',
  couleur: C.accent,
  unite: '',
  sansScore: true,

  progression() {
    return { faits: faits().size, total: NIVEAUX.length }
  },

  titreHud(j) {
    if (j.e.vue !== 'niveau') return 'AVENTURE'
    return `${j.e.n + 1}. ${NIVEAUX[j.e.n].nom}`
  },

  init(j) {
    j.e.vue = 'carte'
    j.e.n = 0
    j.e.morts = 0
  },

  maj(j, dt) {
    if (j.e.vue !== 'niveau') return
    majNiveau(j, dt)
  },

  dessine(j, ctx) {
    if (j.e.vue === 'carte') return dessineCarte(j, ctx)
    dessineNiveau(j, ctx)
    if (j.e.vue === 'reussi') dessineReussite(j, ctx)
  },

  appui(j, p) {
    if (j.e.vue === 'carte') {
      const i = Math.floor((p.y - 96) / 46)
      if (i >= 0 && i < NIVEAUX.length && ouvert(i)) {
        j.son.clic()
        charge(j, i)
      }
      return
    }

    if (j.e.vue === 'reussi') {
      j.e.vue = 'carte'
      j.son.clic()
      return
    }

    j.e.tampon = TAMPON
  },
}

// --- Chargement d'un niveau --------------------------------------------------

function charge(j, i) {
  const grille = normalise(NIVEAUX[i].carte)
  const largeur = grille[0].length

  let depart = { c: 1, r: RANGS - 2 }
  const pieces = new Set()
  grille.forEach((ligne, r) => {
    for (let c = 0; c < ligne.length; c++) {
      if (ligne[c] === '@') depart = { c, r }
      if (ligne[c] === 'o') pieces.add(c + ',' + r)
    }
  })

  j.e.vue = 'niveau'
  j.e.n = i
  j.e.grille = grille
  j.e.largeur = largeur
  j.e.pieces = pieces
  j.e.ramassees = 0
  j.e.depart = depart
  j.e.cam = 0
  j.e.t = 0
  // Ciel de parallaxe : sans lui, la moitié haute de l'écran est un vide noir.
  j.e.ciel = Array.from({ length: 46 }, () => ({
    x: Math.random() * (largeur * TUILE),
    y: 70 + Math.random() * (decalageBrut() - 90),
    p: 0.12 + Math.random() * 0.4,
  }))
  reprend(j)
}

/** Remet le personnage au départ, sans toucher aux pièces déjà ramassées. */
function reprend(j) {
  const d = j.e.depart
  j.e.j = {
    x: d.c * TUILE + (TUILE - LARGEUR_J) / 2,
    y: d.r * TUILE + TUILE - HAUTEUR_J,
    vy: 0,
    sol: false,
    depuisSol: 99,
  }
  j.e.tampon = 0
}

// --- Simulation --------------------------------------------------------------

function tuile(j, c, r) {
  if (r < 0 || r >= RANGS) return '.'
  if (c < 0 || c >= j.e.largeur) return '.'
  return j.e.grille[r][c]
}

function solide(j, c, r) {
  return tuile(j, c, r) === '#'
}

/** Les cases que recouvre une boîte, pour ne tester que celles-là. */
function autour(x, y, w, h) {
  return {
    c0: Math.floor(x / TUILE),
    c1: Math.floor((x + w - 1) / TUILE),
    r0: Math.floor(y / TUILE),
    r1: Math.floor((y + h - 1) / TUILE),
  }
}

function majNiveau(j, dt) {
  const p = j.e.j
  j.e.t += dt
  j.e.tampon = Math.max(0, j.e.tampon - dt)

  // Horizontal : vitesse constante, on repousse hors des blocs.
  p.x += VX * dt
  let b = autour(p.x, p.y, LARGEUR_J, HAUTEUR_J)
  for (let r = b.r0; r <= b.r1; r++) {
    if (solide(j, b.c1, r)) {
      p.x = b.c1 * TUILE - LARGEUR_J
      break
    }
  }

  // Vertical.
  p.vy += G * dt
  p.y += p.vy * dt
  p.sol = false
  b = autour(p.x, p.y, LARGEUR_J, HAUTEUR_J)
  for (let c = b.c0; c <= b.c1; c++) {
    if (p.vy >= 0 && solide(j, c, b.r1)) {
      p.y = b.r1 * TUILE - HAUTEUR_J
      p.vy = 0
      p.sol = true
      break
    }
    if (p.vy < 0 && solide(j, c, b.r0)) {
      p.y = (b.r0 + 1) * TUILE
      p.vy = 0
      break
    }
  }

  p.depuisSol = p.sol ? 0 : p.depuisSol + dt

  // Saut : indulgent des deux côtés, sinon un jeu à un bouton est injuste.
  if (j.e.tampon > 0 && p.depuisSol < COYOTE) {
    p.vy = -SAUT
    p.sol = false
    p.depuisSol = 99
    j.e.tampon = 0
    j.son.rebond()
  }

  // Contenu des cases traversées.
  b = autour(p.x, p.y, LARGEUR_J, HAUTEUR_J)
  for (let c = b.c0; c <= b.c1; c++) {
    for (let r = b.r0; r <= b.r1; r++) {
      const t = tuile(j, c, r)
      if (t === '^') return meurt(j)
      if (t === 'X') return gagne(j)
      if (t === 'o') {
        const cle = c + ',' + r
        if (j.e.pieces.delete(cle)) {
          j.e.ramassees++
          j.son.ramasse()
          // Repère de l'écran : la caméra bouge, les grains non.
          j.fx.eclat(c * TUILE + TUILE / 2 - j.e.cam, r * TUILE + TUILE / 2 + decalage(j), C.accent, {
            n: 10,
            vitesse: 120,
          })
        }
      }
    }
  }

  // Tombé hors du monde, ou arrivé au bout sans sortie.
  if (p.y > RANGS * TUILE + 40) return meurt(j)
  if (p.x > j.e.largeur * TUILE) return meurt(j)

  j.e.cam = borne(p.x - j.W * 0.35, 0, Math.max(0, j.e.largeur * TUILE - j.W))
}

function meurt(j) {
  j.e.morts++
  j.son.rate()
  j.fx.eclat(j.e.j.x - j.e.cam, j.e.j.y + decalage(j), C.rouge, { n: 18, vitesse: 190, taille: 5 })
  j.fx.secoue(8)
  reprend(j)
}

function gagne(j) {
  marque(j.e.n)
  j.e.vue = 'reussi'
  j.son.niveau()
}

// --- Rendu -------------------------------------------------------------------

/** Le bas de la carte est calé en bas de l'écran, le ciel occupe le reste. */
function decalageBrut() {
  return 640 - 24 - RANGS * TUILE
}

function decalage(j) {
  return j.H - 24 - RANGS * TUILE
}

function dessineNiveau(j, ctx) {
  const dy = decalage(j)
  const cam = Math.round(j.e.cam)

  // Le ciel défile plus lentement que le sol : c'est ce qui donne la
  // profondeur, pour trois lignes de code.
  const large = j.W + 40
  for (const s of j.e.ciel) {
    const x = (((s.x - cam * s.p) % large) + large) % large - 20
    rect(ctx, x, s.y, 2, 2, C.bord)
  }
  rect(ctx, 0, dy - 2, j.W, 2, C.panneau)

  trame(ctx, 0, dy, j.W, j.H - dy, 20, C.panneau)

  const c0 = Math.max(0, Math.floor(cam / TUILE))
  const c1 = Math.min(j.e.largeur - 1, Math.ceil((cam + j.W) / TUILE))

  for (let c = c0; c <= c1; c++) {
    for (let r = 0; r < RANGS; r++) {
      const t = j.e.grille[r][c]
      if (t === '.' || t === '@') continue
      const x = c * TUILE - cam
      const y = r * TUILE + dy

      if (t === '#') {
        rect(ctx, x, y, TUILE, TUILE, C.bord)
        rect(ctx, x, y, TUILE, 4, C.faible)
      } else if (t === '^') {
        // Pic : trois marches, dessinées en pixels plutôt qu'en triangle.
        for (let k = 0; k < 4; k++) {
          const l = TUILE - k * 5
          rect(ctx, x + (TUILE - l) / 2, y + TUILE - (k + 1) * 5, l, 5, C.rouge)
        }
      } else if (t === 'o') {
        if (!j.e.pieces.has(c + ',' + r)) continue
        const b = Math.sin(j.e.t * 6 + c) * 2
        rect(ctx, x + 6, y + 6 + b, 8, 8, C.accent)
      } else if (t === 'X') {
        rect(ctx, x - 2, y - TUILE, TUILE + 4, TUILE * 2, C.panneau)
        cadre(ctx, x - 2, y - TUILE, TUILE + 4, TUILE * 2, C.accent)
        const k = (Math.sin(j.e.t * 4) + 1) / 2
        rect(ctx, x + 4, y - TUILE + 6 + k * 4, TUILE - 8, 8, C.accent)
      }
    }
  }

  const p = j.e.j
  rect(ctx, p.x - cam, p.y + dy, LARGEUR_J, HAUTEUR_J, C.cyan)
  rect(ctx, p.x - cam + 8, p.y + dy + 4, 4, 4, C.fond)

  // Repères en bas : pièces et morts.
  ctx.textAlign = 'left'
  texte(ctx, `o ${j.e.ramassees}/${j.e.ramassees + j.e.pieces.size}`, 14, j.H - 12, 13, C.accent, 700)
  ctx.textAlign = 'right'
  texte(ctx, `morts ${j.e.morts}`, j.W - 14, j.H - 12, 13, C.faible, 700)
  ctx.textAlign = 'center'

  if (j.e.t < 3) texte(ctx, NIVEAUX[j.e.n].indice, j.W / 2, j.HUD + 40, 13, C.faible, 700)
}

function dessineReussite(j, ctx) {
  ctx.fillStyle = 'rgba(11, 14, 13, 0.86)'
  ctx.fillRect(0, 0, j.W, j.H)
  texte(ctx, 'NIVEAU TERMINÉ', j.W / 2, 250, 22, C.accent, 700)
  texte(ctx, `pièces ${j.e.ramassees}`, j.W / 2, 300, 14, C.texte, 700)
  texte(ctx, `morts ${j.e.morts}`, j.W / 2, 324, 14, C.faible, 700)
  texte(ctx, 'appuie pour continuer', j.W / 2, 400, 13, C.faible, 700)
}

function dessineCarte(j, ctx) {
  const f = faits()
  ctx.textAlign = 'left'
  texte(ctx, 'CHOISIS UN NIVEAU', 20, 74, 14, C.faible, 700)
  ctx.textAlign = 'center'

  NIVEAUX.forEach((n, i) => {
    const y = 96 + i * 46
    const dispo = ouvert(i, f)
    const fini = f.has(i)
    rect(ctx, 20, y, 320, 38, C.panneau)
    rect(ctx, 20, y, 4, 38, fini ? C.accent : dispo ? C.faible : C.bord)

    ctx.textAlign = 'left'
    texte(ctx, `[${String(i + 1).padStart(2, '0')}]`, 34, y + 19, 13, C.faible, 700)
    texte(ctx, dispo ? n.nom : '???????', 74, y + 19, 15, dispo ? C.texte : C.bord, 700, 190)
    ctx.textAlign = 'right'
    texte(ctx, fini ? 'FAIT' : dispo ? '>' : 'x', 326, y + 19, 13, fini ? C.accent : C.faible, 700)
    ctx.textAlign = 'center'
  })

  texte(ctx, 'squelette — les vrais niveaux viendront', j.W / 2, j.H - 60, 12, C.bord, 700)
}
