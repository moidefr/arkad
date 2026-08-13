/**
 * Le son de l'arcade, entièrement synthétisé : aucun fichier audio, donc
 * rien à télécharger et un contrôle total sur la hauteur des notes (le
 * casse-brique monte d'un ton par rangée, les cibles montent avec le combo).
 *
 * Contrainte à respecter partout : sur iPhone, le contexte audio ne démarre
 * que depuis un vrai geste de l'utilisateur. D'où `reveille()`, appelé par le
 * moteur au premier appui.
 */
import { lis, ecris } from './stockage.js'

/**
 * Trois états, pas deux.
 *
 * Une borne qui a cinquante bandes-son ne peut pas s'en remettre à un seul
 * interrupteur : il y a ceux qui veulent tout, ceux qui veulent les bruitages
 * sans la musique — le cas le plus courant, dans le métro ou à côté de
 * quelqu'un — et ceux qui veulent le silence. Un bouton, trois positions.
 */
export const MODES = ['tout', 'bruitages', 'muet']
const LIBELLES = { tout: 'SON : TOUT', bruitages: 'SON : SANS MUSIQUE', muet: 'SON : MUET' }

class Sons {
  constructor() {
    // L'ancien réglage n'avait que deux positions : on le relit sans le perdre.
    const ancien = lis('muet') === '1' ? 'muet' : null
    const lu = lis('son.mode', null)
    this.mode = MODES.includes(lu) ? lu : (ancien ?? 'tout')
    this.ctx = null
    this.maitre = null
  }

  /** Vrai quand plus rien ne doit sortir. Le reste du code ne connaît que ça. */
  get muet() {
    return this.mode === 'muet'
  }

  /** Vrai quand la bande-son doit tourner. */
  get musique() {
    return this.mode === 'tout'
  }

  get libelle() {
    return LIBELLES[this.mode]
  }

  reveille() {
    if (!this.ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.maitre = this.ctx.createGain()
      this.maitre.gain.value = 0.35
      this.maitre.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
  }

  bascule() {
    this.mode = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length]
    ecris('son.mode', this.mode)
    ecris('muet', this.muet ? '1' : '0')
    if (!this.muet) this.clic()
    return this.mode
  }

  get actif() {
    return !!this.ctx && !this.muet
  }

  // --- Briques de base ------------------------------------------------------

  /** Une note : type d'onde, glissando optionnel, enveloppe percussive. */
  _note({ type = 'square', de, a, duree = 0.1, volume = 0.3, retard = 0 }) {
    if (!this.actif) return
    const c = this.ctx
    const t = c.currentTime + retard
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(de, t)
    if (a && a !== de) o.frequency.exponentialRampToValueAtTime(Math.max(20, a), t + duree)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(volume, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree)
    o.connect(g)
    g.connect(this.maitre)
    o.start(t)
    o.stop(t + duree + 0.03)
  }

  /** Du bruit filtré : les impacts et les explosions. */
  _bruit({ duree = 0.18, volume = 0.25, coupe = 1400, type = 'lowpass', retard = 0 }) {
    if (!this.actif) return
    const c = this.ctx
    const n = Math.max(1, Math.floor(c.sampleRate * duree))
    const buffer = c.createBuffer(1, n, c.sampleRate)
    const data = buffer.getChannelData(0)
    // Décroissance linéaire directement dans l'échantillon : plus court à
    // écrire qu'une enveloppe, et suffisant pour un impact.
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n)

    const source = c.createBufferSource()
    source.buffer = buffer
    const filtre = c.createBiquadFilter()
    filtre.type = type
    filtre.frequency.value = coupe
    const g = c.createGain()
    g.gain.value = volume
    source.connect(filtre)
    filtre.connect(g)
    g.connect(this.maitre)
    source.start(c.currentTime + retard)
  }

  _arpege(freqs, { ecart = 0.07, duree = 0.1, type = 'square', volume = 0.26 } = {}) {
    freqs.forEach((f, i) => this._note({ type, de: f, duree, volume, retard: i * ecart }))
  }

  // --- Sons du jeu ----------------------------------------------------------

  clic() {
    this._note({ type: 'triangle', de: 520, a: 720, duree: 0.05, volume: 0.16 })
  }

  rebond() {
    this._note({ type: 'square', de: 330, a: 290, duree: 0.055, volume: 0.2 })
  }

  /** Le rang de la brique donne la note : casser une colonne fait une gamme. */
  casse(rang = 0) {
    const f = 392 * Math.pow(2, rang / 12)
    this._note({ type: 'square', de: f, a: f * 1.5, duree: 0.08, volume: 0.22 })
    this._bruit({ duree: 0.06, volume: 0.12, coupe: 2600, type: 'highpass' })
  }

  ramasse() {
    this._arpege([660, 990], { ecart: 0.055, duree: 0.07, type: 'triangle', volume: 0.22 })
  }

  /** Plus le combo monte, plus la note monte : on entend qu'on enchaîne. */
  touche(combo = 1) {
    const f = 523 * Math.pow(2, Math.min(combo - 1, 12) / 12)
    this._note({ type: 'square', de: f, a: f * 1.25, duree: 0.09, volume: 0.22 })
  }

  rate() {
    this._note({ type: 'sawtooth', de: 190, a: 90, duree: 0.2, volume: 0.2 })
  }

  niveau() {
    this._arpege([523, 659, 784], { ecart: 0.08, duree: 0.13, type: 'triangle' })
  }

  mort() {
    this._note({ type: 'sawtooth', de: 420, a: 55, duree: 0.6, volume: 0.26 })
    this._bruit({ duree: 0.4, volume: 0.16, coupe: 900 })
  }

  record() {
    this._arpege([523, 659, 784, 1047], { ecart: 0.1, duree: 0.2, type: 'triangle', volume: 0.24 })
  }
}

export const son = new Sons()
