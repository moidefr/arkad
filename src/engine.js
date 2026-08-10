/**
 * Le moteur de l'arcade.
 *
 * Une borne : un accueil qui liste les jeux, un jeu à la fois, une pause,
 * un écran de fin. Le moteur ne connaît rien des jeux — il leur prête un
 * écran, les entrées, un score et une sauvegarde, et c'est tout.
 */
import { GAMES } from './games/index.js'
import { Input } from './input.js'
import { C } from './palette.js'
import { texte, rect } from './dessin.js'

export const W = 360
export const H = 640

/** Hauteur du bandeau du haut pendant une partie. */
export const HUD = 64

export class Moteur {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    this.input = new Input(canvas, W, H)
    this.input.onPress = (p) => this._appui(p)
    this.input.onRelease = (p) => this._relache(p)

    this.phase = 'accueil' // accueil | jeu | pause | fin
    this.phaseT = 0
    this.def = null // le jeu chargé
    this.j = null // son contexte
    this.record = false // vrai si la partie qui vient de finir bat le record

    addEventListener('keydown', (e) => {
      if (e.code === 'Escape') this._bascullePause()
    })

    this._redim()
    addEventListener('resize', () => this._redim())
  }

  demarre() {
    let prec = performance.now()
    const tick = (now) => {
      const dt = Math.min((now - prec) / 1000, 1 / 20)
      prec = now
      this._maj(dt)
      this._dessine()
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  _redim() {
    const dpr = Math.min(devicePixelRatio || 1, 3)
    this.canvas.width = Math.round(W * dpr)
    this.canvas.height = Math.round(H * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
  }

  // --- Records --------------------------------------------------------------

  meilleur(id) {
    return Number(localStorage.getItem('arcade.record.' + id) || 0)
  }

  _enregistre(id, score) {
    if (score <= this.meilleur(id)) return false
    localStorage.setItem('arcade.record.' + id, String(Math.floor(score)))
    return true
  }

  // --- Cycle de vie d'une partie -------------------------------------------

  lance(def) {
    this.def = def
    const j = {
      W,
      H,
      HUD,
      t: 0,
      score: 0,
      meilleur: this.meilleur(def.id),
      pointer: this.input.pointer,
      __input: this.input,
      get maintenu() {
        return this.__input.held
      },
      e: {},
      hasard: Math.random,
      entier: (a, b) => a + Math.floor(Math.random() * (b - a)),
      fini: false,
      perdu() {
        this.fini = true
      },
    }
    this.j = j
    def.init?.(j)
    this.phase = 'jeu'
    this.phaseT = 0
  }

  _termine() {
    this.record = this._enregistre(this.def.id, this.j.score)
    this.phase = 'fin'
    this.phaseT = 0
  }

  _quitte() {
    this.phase = 'accueil'
    this.phaseT = 0
    this.def = null
    this.j = null
  }

  _bascullePause() {
    if (this.phase === 'jeu') this.phase = 'pause'
    else if (this.phase === 'pause') this.phase = 'jeu'
    this.phaseT = 0
  }

  _maj(dt) {
    this.phaseT += dt
    if (this.phase !== 'jeu') return

    const j = this.j
    j.t += dt
    this.def.maj?.(j, dt)
    if (j.fini) this._termine()
  }

  // --- Entrées --------------------------------------------------------------

  _appui(p) {
    if (this.phase === 'accueil') {
      const i = indexCarte(p)
      if (i !== null && i < GAMES.length) this.lance(GAMES[i])
      return
    }

    if (this.phase === 'jeu') {
      if (dansRect(p, 0, 0, 56, HUD)) return this._bascullePause()
      this.def.appui?.(this.j, p)
      return
    }

    if (this.phase === 'pause') {
      if (dansRect(p, 50, 250, 260, 60)) return this._bascullePause()
      if (dansRect(p, 50, 326, 260, 60)) return this.lance(this.def)
      if (dansRect(p, 50, 402, 260, 60)) return this._quitte()
      return
    }

    if (this.phase === 'fin' && this.phaseT > 0.4) {
      if (dansRect(p, 50, 400, 260, 66)) return this.lance(this.def)
      if (dansRect(p, 50, 482, 260, 56)) return this._quitte()
    }
  }

  _relache(p) {
    if (this.phase === 'jeu') this.def.relache?.(this.j, p)
  }

  // --- Rendu ----------------------------------------------------------------

  _dessine() {
    const ctx = this.ctx
    ctx.fillStyle = C.fond
    ctx.fillRect(0, 0, W, H)

    if (this.phase === 'accueil') return this._accueil()

    // La dernière image du jeu reste visible sous la pause et sous l'écran
    // de fin : on ne perd jamais le contexte de ce qui vient de se passer.
    this.def.dessine?.(this.j, ctx)
    this._bandeau()
    if (this.phase === 'pause') this._pause()
    if (this.phase === 'fin') this._fin()
  }

  _accueil() {
    const ctx = this.ctx
    texte(ctx, 'ARCADE', W / 2, 66, 44, C.joueur, 900)

    GAMES.forEach((def, i) => {
      const { x, y, w, h } = carte(i)
      rect(ctx, x, y, w, h, C.fondClair, 16)
      rect(ctx, x, y, 5, h, def.couleur || C.joueur, 3)

      ctx.textAlign = 'left'
      const large = w - 40
      texte(ctx, def.nom, x + 20, y + 30, 22, C.texte, 800, large)
      texte(ctx, def.pitch, x + 20, y + 56, 12, C.faible, 600, large)
      const best = this.meilleur(def.id)
      texte(ctx, best ? `record ${best} ${def.unite || ''}`.trim() : 'jamais joué', x + 20, y + 78, 12, best ? C.or : C.faible, 700)
      ctx.textAlign = 'center'
    })

    texte(ctx, `${GAMES.length} jeux · une seule touche`, W / 2, H - 26, 13, C.faible, 600)
  }

  _bandeau() {
    const ctx = this.ctx
    rect(ctx, 0, 0, W, HUD, C.fond)

    // Bouton pause, toujours au même endroit quel que soit le jeu.
    rect(ctx, 14, 18, 30, 28, C.fondClair, 8)
    rect(ctx, 23, 25, 4, 14, C.texte, 2)
    rect(ctx, 31, 25, 4, 14, C.texte, 2)

    const u = this.def.unite ? ' ' + this.def.unite : ''
    texte(ctx, `${Math.floor(this.j.score)}${u}`, W / 2, 32, 26, C.texte, 900)

    ctx.textAlign = 'right'
    const best = Math.max(this.j.meilleur, Math.floor(this.j.score))
    texte(ctx, `record ${best}`, W - 14, 32, 12, C.faible, 700)
    ctx.textAlign = 'center'
  }

  _voile(alpha = 0.82) {
    const ctx = this.ctx
    ctx.fillStyle = `rgba(13, 11, 26, ${alpha})`
    ctx.fillRect(0, 0, W, H)
  }

  _pause() {
    const ctx = this.ctx
    this._voile()
    texte(ctx, 'PAUSE', W / 2, 170, 40, C.texte, 900)
    bouton(ctx, 50, 250, 260, 60, 'REPRENDRE', C.joueur, C.fond)
    bouton(ctx, 50, 326, 260, 60, 'RECOMMENCER', C.fondClair, C.texte)
    bouton(ctx, 50, 402, 260, 60, 'QUITTER', C.fondClair, C.texte)
  }

  _fin() {
    const ctx = this.ctx
    this._voile(0.88)
    texte(ctx, 'PERDU', W / 2, 160, 40, C.danger, 900)
    texte(ctx, `${Math.floor(this.j.score)}`, W / 2, 246, 76, C.texte, 900)
    texte(ctx, this.def.unite || 'points', W / 2, 296, 15, C.faible, 600)
    if (this.record) texte(ctx, 'NOUVEAU RECORD !', W / 2, 340, 18, C.or, 900)
    else texte(ctx, `record : ${this.meilleur(this.def.id)}`, W / 2, 340, 14, C.faible, 700)

    bouton(ctx, 50, 400, 260, 66, 'REJOUER', C.joueur, C.fond)
    bouton(ctx, 50, 482, 260, 56, 'QUITTER', C.fondClair, C.texte)
  }
}

// --- Disposition de l'accueil ------------------------------------------------

const CARTE_H = 96
const CARTE_Y0 = 110
const CARTE_ECART = 12

function carte(i) {
  return { x: 24, y: CARTE_Y0 + i * (CARTE_H + CARTE_ECART), w: W - 48, h: CARTE_H }
}

function indexCarte(p) {
  const i = Math.floor((p.y - CARTE_Y0) / (CARTE_H + CARTE_ECART))
  if (i < 0 || p.y < CARTE_Y0) return null
  const c = carte(i)
  return p.y <= c.y + c.h && p.x >= c.x && p.x <= c.x + c.w ? i : null
}

function bouton(ctx, x, y, w, h, libelle, fond, encre) {
  rect(ctx, x, y, w, h, fond, 16)
  texte(ctx, libelle, x + w / 2, y + h / 2, 21, encre, 800)
}

function dansRect(p, x, y, w, h) {
  return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h
}
