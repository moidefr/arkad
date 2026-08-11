import { C } from '../palette.js'
import { texte, rect } from '../dessin.js'

const COLS = 11
const RANGS = 14
const CASE = 32
const X0 = 4
const Y0 = 116
const VUE = 4 // rayon de lumière autour du personnage

const BESTIAIRE = [
  { nom: 'rat', lettre: 'r', pv: 4, force: 2, xp: 3, couleur: C.faible },
  { nom: 'gobelin', lettre: 'g', pv: 8, force: 4, xp: 7, couleur: C.vert },
  { nom: 'spectre', lettre: 's', pv: 14, force: 7, xp: 16, couleur: C.violet },
  { nom: 'ogre', lettre: 'O', pv: 26, force: 11, xp: 34, couleur: C.rouge },
]

export default {
  id: 'donjon',
  nom: 'DONJON',
  pitch: 'Descends. Frappe en avançant dessus. Ça se garde',
  couleur: C.violet,
  unite: 'étages',
  persistant: true,

  finTitre: () => ({ texte: 'MORT', couleur: C.rouge }),

  init(j) {
    const sauve = j.charge()
    j.e.h = sauve ?? { etage: 1, pv: 24, pvMax: 24, force: 5, xp: 0, niveau: 1 }
    j.e.journal = sauve ? 'tu reprends ta descente' : 'la porte se referme derrière toi'
    j.score = j.e.h.etage
    genere(j)
  },

  dessine(j, ctx) {
    const h = j.e.h

    for (let r = 0; r < RANGS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c
        const d = Math.max(Math.abs(c - h.c), Math.abs(r - h.r))
        const eclaire = d <= VUE
        if (!eclaire && !j.e.memoire[i]) continue
        if (eclaire) j.e.memoire[i] = true

        const x = X0 + c * CASE
        const y = Y0 + r * CASE
        const t = j.e.carte[i]
        if (t === '#') rect(ctx, x, y, CASE, CASE, eclaire ? C.bord : C.panneau)
        else {
          rect(ctx, x + 14, y + 14, 3, 3, eclaire ? C.faible : C.panneau)
          if (t === '>') {
            rect(ctx, x + 6, y + 6, CASE - 12, CASE - 12, eclaire ? C.accent : C.panneau)
            texte(ctx, '>', x + CASE / 2, y + CASE / 2, 18, C.fond, 700)
          }
        }
      }
    }

    for (const o of j.e.objets) {
      if (!visible(j, o)) continue
      rect(ctx, X0 + o.c * CASE + 10, Y0 + o.r * CASE + 10, 12, 12, C.cyan)
    }

    for (const m of j.e.monstres) {
      if (!visible(j, m)) continue
      const t = BESTIAIRE[m.type]
      texte(ctx, t.lettre, X0 + m.c * CASE + CASE / 2, Y0 + m.r * CASE + CASE / 2, 22, t.couleur, 700)
    }

    rect(ctx, X0 + h.c * CASE + 7, Y0 + h.r * CASE + 7, CASE - 14, CASE - 14, C.accent)

    // Bandeau du bas : santé, force, expérience, et le dernier événement.
    const part = Math.max(0, h.pv / h.pvMax)
    rect(ctx, 16, 74, 328, 12, C.panneau)
    rect(ctx, 16, 74, 328 * part, 12, part > 0.35 ? C.vert : C.rouge)
    ctx.textAlign = 'left'
    texte(ctx, `${h.pv}/${h.pvMax} PV`, 16, 62, 13, C.texte, 700)
    texte(ctx, j.e.journal, 16, j.H - 46, 13, C.faible, 700, 328)
    ctx.textAlign = 'right'
    texte(ctx, `niv ${h.niveau} · force ${h.force}`, j.W - 16, 62, 13, C.faible, 700)
    ctx.textAlign = 'center'
    texte(ctx, 'appuie autour de toi pour avancer', j.W / 2, j.H - 22, 13, C.bord, 700)
  },

  appui(j, p) {
    const h = j.e.h
    const dx = p.x - (X0 + h.c * CASE + CASE / 2)
    const dy = p.y - (Y0 + h.r * CASE + CASE / 2)
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
    const pas = Math.abs(dx) > Math.abs(dy) ? { c: Math.sign(dx), r: 0 } : { c: 0, r: Math.sign(dy) }
    tour(j, pas)
  },
}

// --- Génération --------------------------------------------------------------

function genere(j) {
  const carte = Array(COLS * RANGS).fill('#')
  const salles = []
  for (let k = 0; k < 40 && salles.length < 6; k++) {
    const w = 2 + Math.floor(Math.random() * 3)
    const hh = 2 + Math.floor(Math.random() * 3)
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
  // Couloirs en L entre les centres : simple, et toujours connexe.
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
  j.e.h.c = depart.c
  j.e.h.r = depart.r

  // Le peuplement suit l'étage : plus bas, plus nombreux et plus gros.
  const etage = j.e.h.etage
  j.e.monstres = []
  const combien = Math.min(9, 2 + Math.floor(etage / 1.5))
  for (let k = 0; k < combien; k++) {
    const s = salles[1 + Math.floor(Math.random() * (salles.length - 1))]
    const type = Math.min(BESTIAIRE.length - 1, Math.floor(Math.random() * (1 + etage / 3)))
    const t = BESTIAIRE[type]
    j.e.monstres.push({
      c: s.c + Math.floor(Math.random() * s.w),
      r: s.r + Math.floor(Math.random() * s.h),
      pv: t.pv + etage,
      force: t.force + Math.floor(etage / 2),
      type,
    })
  }

  j.e.objets = []
  for (let k = 0; k < 2; k++) {
    const s = salles[Math.floor(Math.random() * salles.length)]
    j.e.objets.push({ c: s.c + Math.floor(Math.random() * s.w), r: s.r + Math.floor(Math.random() * s.h) })
  }
}

const centre = (s) => ({ c: s.c + (s.w >> 1), r: s.r + (s.h >> 1) })
const visible = (j, e) => Math.max(Math.abs(e.c - j.e.h.c), Math.abs(e.r - j.e.h.r)) <= VUE

// --- Un tour -----------------------------------------------------------------

function tour(j, pas) {
  const h = j.e.h
  const c = h.c + pas.c
  const r = h.r + pas.r
  if (c < 0 || c >= COLS || r < 0 || r >= RANGS) return
  if (j.e.carte[r * COLS + c] === '#') return

  const cible = j.e.monstres.find((m) => m.c === c && m.r === r)
  if (cible) frappe(j, cible)
  else {
    h.c = c
    h.r = r
    ramasse(j)
    if (j.e.carte[r * COLS + c] === '>') return descend(j)
  }

  monstres(j)
  ecrit(j)
}

function frappe(j, m) {
  const h = j.e.h
  const degats = h.force + Math.floor(Math.random() * 3)
  m.pv -= degats
  j.son.casse(4)
  j.fx.eclat(X0 + m.c * CASE + CASE / 2, Y0 + m.r * CASE + CASE / 2, C.rouge, { n: 8, vitesse: 120 })
  if (m.pv > 0) {
    j.e.journal = `tu frappes le ${BESTIAIRE[m.type].nom} (${degats})`
    return
  }
  j.e.monstres.splice(j.e.monstres.indexOf(m), 1)
  h.xp += BESTIAIRE[m.type].xp + j.e.h.etage
  j.e.journal = `le ${BESTIAIRE[m.type].nom} tombe`
  j.son.touche(6)
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
  j.e.journal = `niveau ${h.niveau} — tu te sens plus solide`
  j.son.niveau()
  j.fx.eclat(X0 + h.c * CASE + CASE / 2, Y0 + h.r * CASE + CASE / 2, C.accent, { n: 18, vitesse: 160 })
}

function ramasse(j) {
  const h = j.e.h
  const i = j.e.objets.findIndex((o) => o.c === h.c && o.r === h.r)
  if (i === -1) return
  j.e.objets.splice(i, 1)
  h.pv = Math.min(h.pvMax, h.pv + 10)
  j.e.journal = 'une fiole — tu reprends des forces'
  j.son.ramasse()
}

function monstres(j) {
  const h = j.e.h
  for (const m of j.e.monstres) {
    const dc = h.c - m.c
    const dr = h.r - m.r
    const d = Math.abs(dc) + Math.abs(dr)

    if (d === 1) {
      const degats = Math.max(1, m.force - Math.floor(Math.random() * 3))
      h.pv -= degats
      j.e.journal = `le ${BESTIAIRE[m.type].nom} te touche (${degats})`
      j.son.rate()
      j.fx.secoue(4)
      if (h.pv <= 0) return meurt(j)
      continue
    }

    // Poursuite simple : on avance sur l'axe le plus éloigné, sinon on erre.
    if (d > 7) continue
    const pas = Math.abs(dc) > Math.abs(dr) ? { c: Math.sign(dc), r: 0 } : { c: 0, r: Math.sign(dr) }
    const c = m.c + pas.c
    const r = m.r + pas.r
    if (j.e.carte[r * COLS + c] === '#') continue
    if (c === h.c && r === h.r) continue
    if (j.e.monstres.some((o) => o !== m && o.c === c && o.r === r)) continue
    m.c = c
    m.r = r
  }
}

function descend(j) {
  const h = j.e.h
  h.etage++
  h.pv = Math.min(h.pvMax, h.pv + 6)
  j.score = h.etage
  j.e.journal = `étage ${h.etage}`
  j.son.niveau()
  genere(j)
  ecrit(j)
}

function meurt(j) {
  j.score = j.e.h.etage
  j.e.journal = 'tu tombes'
  j.efface() // une mort efface la sauvegarde : c'est un roguelike
  j.perdu()
}

/** On écrit après chaque tour : fermer l'application ne coûte jamais rien. */
function ecrit(j) {
  const h = j.e.h
  j.sauve({ etage: h.etage, pv: h.pv, pvMax: h.pvMax, force: h.force, xp: h.xp, niveau: h.niveau })
}
