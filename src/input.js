/**
 * Entrée unifiée PC / téléphone.
 *
 * Le jeu ne connaît que deux évènements : appui et relâchement, chacun avec
 * une position en coordonnées logiques (0..W, 0..H). Souris, doigt et barre
 * d'espace passent tous par le même tuyau — un micro-jeu n'a jamais à savoir
 * sur quoi il tourne.
 */
export class Input {
  constructor(canvas, W, H) {
    this.canvas = canvas
    this.W = W
    this.H = H

    /** Position du dernier appui (ou du survol souris sur PC). */
    this.pointer = { x: W / 2, y: H / 2 }
    /** Vrai tant que le doigt / bouton / espace est maintenu. */
    this.held = false

    this.onPress = () => {}
    this.onRelease = () => {}

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId)
      this._set(e)
      this._press()
    })
    canvas.addEventListener('pointermove', (e) => {
      // Utile sur PC pour viser avant de cliquer ; sur mobile ça n'arrive
      // qu'avec le doigt posé, donc aucune triche possible.
      this._set(e)
    })
    canvas.addEventListener('pointerup', (e) => {
      this._set(e)
      this._release()
    })
    canvas.addEventListener('pointercancel', () => this._release())
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    addEventListener('keydown', (e) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return
      e.preventDefault()
      if (e.repeat) return
      this._press()
    })
    addEventListener('keyup', (e) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return
      this._release()
    })
  }

  _set(e) {
    const r = this.canvas.getBoundingClientRect()
    this.pointer.x = ((e.clientX - r.left) / r.width) * this.W
    this.pointer.y = ((e.clientY - r.top) / r.height) * this.H
  }

  _press() {
    if (this.held) return
    this.held = true
    this.onPress({ ...this.pointer })
  }

  _release() {
    if (!this.held) return
    this.held = false
    this.onRelease({ ...this.pointer })
  }
}
