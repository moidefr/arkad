/**
 * Le moteur de la borne.
 *
 * Il tient l'accueil, la pause, l'écran de fin et les records — et rien
 * d'autre : il ne sait pas ce que font les jeux. Un jeu lui prête juste une
 * fonction de mise à jour, une fonction de dessin, et lui dit quand c'est
 * perdu.
 */
import { PRINCIPAL, MINIS } from './games/index.js'
import { Input } from './input.js'
import { C } from './palette.js'
import { son } from './son.js'
import { texte, rect, cadre, scanlines, PX } from './dessin.js'

export const W = 360
export const H = 640

/** Hauteur du bandeau du haut pendant une partie. */
export const HUD = 56

// Zones cliquables de l'accueil.
const BTN_SON = { x: 302, y: 16, w: 40, h: 30 }
const VEDETTE = { x: 20, y: 74, w: 320, h: 104 }
const LISTE_Y = 226
const LIGNE_H = 46
const LIGNE_PAS = 54

// Zones des menus.
const B_PAUSE = [
  { y: 250, h: 56, libelle: 'REPRENDRE' },
  { y: 318, h: 56, libelle: 'RECOMMENCER' },
  { y: 386, h: 56, libelle: 'QUITTER' },
  { y: 454, h: 56, libelle: 'SON' },
]
const B_FIN = [
  { y: 404, h: 62, libelle: 'REJOUER' },
  { y: 480, h: 54, libelle: 'QUITTER' },
]
const MENU_X = 50
const MENU_W = 260

export class Moteur {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    this.input = new Input(canvas, W, H)
    this.input.onPress = (p) => this._appui(p)
    this.input.onRelease = (p) => this._relache(p)

    this.phase = 'accueil' // accueil | jeu | pause | fin
    this.phaseT = 0
    this.def = null
    this.j = null
    this.record = false

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
    // Volontairement sans densité d'écran : la toile fait exactement
    // 360 x 640 pixels et c'est le CSS qui l'agrandit sans lissage. C'est de
    // là que vient le grain.
    this.canvas.width = W
    this.canvas.height = H
    this.ctx.imageSmoothingEnabled = false
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
      son,
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
    this.record = this.def.sansScore ? false : this._enregistre(this.def.id, this.j.score)
    this.phase = 'fin'
    this.phaseT = 0
    son.mort()
    if (this.record) setTimeout(() => son.record(), 450)
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
    // On est dans le geste de l'utilisateur : seul moment où iOS accepte de
    // démarrer le son.
    son.reveille()

    if (this.phase === 'accueil') {
      if (dans(p, BTN_SON.x, BTN_SON.y, BTN_SON.w, BTN_SON.h)) return son.bascule()
      if (dans(p, VEDETTE.x, VEDETTE.y, VEDETTE.w, VEDETTE.h)) {
        son.clic()
        return this.lance(PRINCIPAL)
      }
      const i = Math.floor((p.y - LISTE_Y) / LIGNE_PAS)
      if (i >= 0 && i < MINIS.length && p.y >= LISTE_Y && p.y <= LISTE_Y + i * LIGNE_PAS + LIGNE_H) {
        son.clic()
        this.lance(MINIS[i])
      }
      return
    }

    if (this.phase === 'jeu') {
      if (dans(p, 0, 0, 52, HUD)) {
        son.clic()
        return this._bascullePause()
      }
      this.def.appui?.(this.j, p)
      return
    }

    if (this.phase === 'pause') {
      const i = index(p, B_PAUSE)
      if (i === 0) return son.clic(), this._bascullePause()
      if (i === 1) return son.clic(), this.lance(this.def)
      if (i === 2) return son.clic(), this._quitte()
      if (i === 3) return son.bascule()
      return
    }

    if (this.phase === 'fin' && this.phaseT > 0.4) {
      const i = index(p, B_FIN)
      if (i === 0) return son.clic(), this.lance(this.def)
      if (i === 1) return son.clic(), this._quitte()
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

    if (this.phase === 'accueil') this._accueil()
    else {
      // La dernière image du jeu reste visible sous la pause et sous l'écran
      // de fin : on ne perd jamais de vue ce qui vient de se passer.
      this.def.dessine?.(this.j, ctx)
      this._bandeau()
      if (this.phase === 'pause') this._pause()
      if (this.phase === 'fin') this._fin()
    }

    scanlines(ctx, W, H)
  }

  // --- Accueil --------------------------------------------------------------

  _accueil() {
    const ctx = this.ctx

    ctx.textAlign = 'left'
    texte(ctx, '> ARCADE', 20, 30, 26, C.accent, 700)
    // Curseur clignotant : deux lignes de code, et l'écran a l'air vivant.
    if (Math.floor(this.phaseT * 2) % 2 === 0) rect(ctx, 152, 22, 12, 18, C.accent)
    ctx.textAlign = 'center'

    this._boutonSon()
    rect(ctx, 20, 56, 320, PX, C.bord)

    this._vedette()

    ctx.textAlign = 'left'
    texte(ctx, 'MINI-JEUX', 20, 204, 14, C.faible, 700)
    ctx.textAlign = 'center'
    rect(ctx, 104, 204, 236, PX, C.bord)

    MINIS.forEach((def, i) => this._ligne(def, i))

    ctx.textAlign = 'left'
    texte(ctx, `${MINIS.length + 1} jeux`, 20, 612, 11, C.faible, 700)
    ctx.textAlign = 'right'
    texte(ctx, 'une seule touche', 340, 612, 11, C.faible, 700)
    ctx.textAlign = 'center'
  }

  /** La grosse carte du jeu principal, en haut : c'est le cœur de la borne. */
  _vedette() {
    const ctx = this.ctx
    const { x, y, w, h } = VEDETTE
    rect(ctx, x, y, w, h, C.panneau)
    cadre(ctx, x, y, w, h, C.accent)

    ctx.textAlign = 'left'
    texte(ctx, PRINCIPAL.nom, x + 14, y + 26, 26, C.accent, 700)
    texte(ctx, PRINCIPAL.pitch, x + 14, y + 50, 11, C.faible, 700, w - 28)

    // Barre de progression en gros blocs, comme un chargement de terminal.
    const { faits, total } = PRINCIPAL.progression?.() ?? { faits: 0, total: 0 }
    const cases = 20
    const pleines = total ? Math.round((faits / total) * cases) : 0
    for (let i = 0; i < cases; i++) {
      rect(ctx, x + 14 + i * 12, y + 68, 10, 10, i < pleines ? C.accent : C.bord)
    }
    ctx.textAlign = 'right'
    texte(ctx, `${faits}/${total}`, x + w - 14, y + 88, 12, C.faible, 700)
    ctx.textAlign = 'left'
    texte(ctx, 'NIVEAUX', x + 14, y + 88, 12, C.faible, 700)
    ctx.textAlign = 'center'
  }

  /** Une ligne de mini-jeu, façon liste de fichiers. */
  _ligne(def, i) {
    const ctx = this.ctx
    const y = LISTE_Y + i * LIGNE_PAS
    rect(ctx, 20, y, 320, LIGNE_H, C.panneau)
    rect(ctx, 20, y, 4, LIGNE_H, def.couleur)

    ctx.textAlign = 'left'
    texte(ctx, `[${String(i + 1).padStart(2, '0')}]`, 34, y + 16, 12, C.faible, 700)
    texte(ctx, def.nom, 74, y + 16, 16, C.texte, 700, 180)
    texte(ctx, def.pitch, 34, y + 34, 11, C.faible, 700, 290)

    const best = this.meilleur(def.id)
    ctx.textAlign = 'right'
    texte(ctx, best ? `${best} ${def.unite}` : '--', 326, y + 16, 13, best ? C.accent : C.faible, 700)
    ctx.textAlign = 'center'
  }

  _boutonSon() {
    const ctx = this.ctx
    const { x, y, w, h } = BTN_SON
    cadre(ctx, x, y, w, h, son.muet ? C.bord : C.faible)
    texte(ctx, son.muet ? 'x' : '♪', x + w / 2, y + h / 2, 15, son.muet ? C.faible : C.accent, 700)
  }

  // --- En jeu ---------------------------------------------------------------

  _bandeau() {
    const ctx = this.ctx
    rect(ctx, 0, 0, W, HUD, C.fond)
    rect(ctx, 0, HUD - PX, W, PX, C.bord)

    // Bouton pause, toujours au même endroit quel que soit le jeu.
    cadre(ctx, 12, 14, 28, 26, C.faible)
    rect(ctx, 21, 20, 4, 14, C.texte)
    rect(ctx, 29, 20, 4, 14, C.texte)

    const titre = this.def.sansScore
      ? this.def.titreHud?.(this.j) ?? this.def.nom
      : `${Math.floor(this.j.score)} ${this.def.unite}`
    texte(ctx, titre, W / 2, 26, 20, C.texte, 700, 200)

    if (!this.def.sansScore) {
      ctx.textAlign = 'right'
      const best = Math.max(this.j.meilleur, Math.floor(this.j.score))
      texte(ctx, `REC ${best}`, W - 12, 26, 11, C.faible, 700)
      ctx.textAlign = 'center'
    }
  }

  _voile(alpha = 0.86) {
    const ctx = this.ctx
    ctx.fillStyle = `rgba(11, 14, 13, ${alpha})`
    ctx.fillRect(0, 0, W, H)
  }

  _pause() {
    const ctx = this.ctx
    this._voile()
    texte(ctx, '-- PAUSE --', W / 2, 174, 26, C.accent, 700)
    B_PAUSE.forEach((b, i) => {
      const libelle = i === 3 ? (son.muet ? 'SON : NON' : 'SON : OUI') : b.libelle
      bouton(ctx, b.y, b.h, libelle, i === 0)
    })
  }

  _fin() {
    const ctx = this.ctx
    this._voile(0.9)
    const perdu = !this.def.sansScore
    texte(ctx, perdu ? 'GAME OVER' : 'FIN', W / 2, 168, 30, C.rouge, 700)

    if (!this.def.sansScore) {
      texte(ctx, `${Math.floor(this.j.score)}`, W / 2, 252, 60, C.texte, 700)
      texte(ctx, this.def.unite, W / 2, 296, 13, C.faible, 700)
      if (this.record) texte(ctx, '* NOUVEAU RECORD *', W / 2, 342, 15, C.accent, 700)
      else texte(ctx, `record ${this.meilleur(this.def.id)}`, W / 2, 342, 12, C.faible, 700)
    }

    B_FIN.forEach((b, i) => bouton(ctx, b.y, b.h, b.libelle, i === 0))
  }
}

// --- Petits blocs partagés ---------------------------------------------------

function bouton(ctx, y, h, libelle, primaire) {
  const couleur = primaire ? C.accent : C.faible
  rect(ctx, MENU_X, y, MENU_W, h, C.panneau)
  cadre(ctx, MENU_X, y, MENU_W, h, couleur)
  texte(ctx, libelle, MENU_X + MENU_W / 2, y + h / 2, 18, primaire ? C.accent : C.texte, 700, MENU_W - 24)
}

function index(p, boutons) {
  return boutons.findIndex((b) => dans(p, MENU_X, b.y, MENU_W, b.h))
}

function dans(p, x, y, w, h) {
  return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h
}
