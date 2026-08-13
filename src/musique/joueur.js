/**
 * Le joueur de bandes-son : il programme dans le contexte audio les
 * évènements que `composition.js` a calculés, et rien d'autre.
 *
 * Le principe est celui de tout séquenceur écrit sur Web Audio : une horloge
 * grossière (un intervalle de vingt-cinq millisecondes) qui programme à
 * l'avance les notes des deux cents millisecondes suivantes. On ne déclenche
 * jamais une note « maintenant » — le fil principal d'un jeu qui dessine
 * soixante images par seconde ne tient pas le tempo, la carte son si.
 */
import { compose, frequence } from './composition.js'

const AVANCE = 0.22
const TIC = 25

export class Joueur {
  constructor() {
    this.ctx = null
    this.sortie = null
    this.piste = null
    this.fiche = null
    this.debut = 0
    this.prochain = 0
    this.horloge = null
    this.volume = 0.18
  }

  /**
   * Branche le joueur sur un contexte audio existant. On partage celui des
   * bruitages : deux contextes sur iOS, c'est deux fois plus d'occasions que
   * l'un des deux reste suspendu.
   */
  branche(ctx, destination) {
    if (this.ctx === ctx) return
    this.ctx = ctx
    this.sortie = ctx.createGain()
    this.sortie.gain.value = this.volume
    this.sortie.connect(destination ?? ctx.destination)
  }

  get enCours() {
    return !!this.horloge
  }

  /** Lance une bande. Rejouer la même ne la redémarre pas : elle continue. */
  joue(fiche) {
    if (!this.ctx || !fiche) return
    if (this.fiche?.id === fiche.id && this.enCours) return
    this.arrete()
    this.fiche = fiche
    this.piste = compose(fiche)
    this.debut = this.ctx.currentTime + 0.1
    this.prochain = 0
    this.sortie.gain.cancelScheduledValues(this.ctx.currentTime)
    this.sortie.gain.setValueAtTime(0.0001, this.ctx.currentTime)
    this.sortie.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 1.2)
    this.horloge = setInterval(() => this._programme(), TIC)
    this._programme()
  }

  arrete(fondu = 0.4) {
    if (this.horloge) clearInterval(this.horloge)
    this.horloge = null
    if (this.ctx && this.sortie) {
      const t = this.ctx.currentTime
      this.sortie.gain.cancelScheduledValues(t)
      this.sortie.gain.setValueAtTime(this.sortie.gain.value, t)
      this.sortie.gain.linearRampToValueAtTime(0.0001, t + fondu)
    }
    this.fiche = null
    this.piste = null
  }

  /** Programme tout ce qui tombe dans la fenêtre d'avance, boucle comprise. */
  _programme() {
    if (!this.piste) return
    const limite = this.ctx.currentTime + AVANCE
    let garde = 0
    while (this.debut + this.piste.evenements[this.prochain]?.t <= limite && garde++ < 400) {
      const e = this.piste.evenements[this.prochain]
      this._voix(e, this.debut + e.t)
      this.prochain++
      if (this.prochain >= this.piste.evenements.length) {
        // On reboucle en décalant l'origine : la bande tourne sans couture et
        // sans qu'on ait à recomposer quoi que ce soit.
        this.prochain = 0
        this.debut += this.piste.duree
      }
    }
  }

  // --- Les timbres ----------------------------------------------------------------
  //
  // Cinq voix mélodiques et trois percussions, toutes synthétisées. Elles ne
  // cherchent pas à imiter un instrument : elles cherchent à être
  // reconnaissables les unes des autres sur un haut-parleur de téléphone, ce
  // qui est une contrainte plus dure et plus utile.

  _voix(e, t) {
    const c = this.ctx
    if (e.voix === 'grosse') return this._peau(t, 120, 42, 0.11, e.volume)
    if (e.voix === 'caisse') return this._bruit(t, 0.11, e.volume, 1900, 'bandpass')
    if (e.voix === 'charley') return this._bruit(t, 0.035, e.volume, 7000, 'highpass')

    const f = frequence(e.note)
    if (e.voix === 'nappe') return this._nappe(t, f, e.duree, e.volume)
    const timbre =
      e.voix === 'basse'
        ? { type: 'triangle', coupe: 900, attaque: 0.01 }
        : e.voix === 'accords'
          ? { type: 'square', coupe: 2200, attaque: 0.008 }
          : e.voix === 'arpege'
            ? { type: 'square', coupe: 3200, attaque: 0.004 }
            : { type: 'triangle', coupe: 4000, attaque: 0.012 }

    const o = c.createOscillator()
    const g = c.createGain()
    const flt = c.createBiquadFilter()
    o.type = timbre.type
    o.frequency.setValueAtTime(f, t)
    flt.type = 'lowpass'
    flt.frequency.setValueAtTime(timbre.coupe, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(e.volume, t + timbre.attaque)
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.05, e.duree))
    o.connect(flt)
    flt.connect(g)
    g.connect(this.sortie)
    o.start(t)
    o.stop(t + e.duree + 0.06)
  }

  /** La nappe : deux oscillateurs désaccordés, attaque lente, filtre fermé. */
  _nappe(t, f, duree, volume) {
    const c = this.ctx
    const g = c.createGain()
    const flt = c.createBiquadFilter()
    flt.type = 'lowpass'
    flt.frequency.setValueAtTime(1100, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(volume, t + duree * 0.35)
    g.gain.linearRampToValueAtTime(0.0001, t + duree)
    for (const detune of [-6, 6]) {
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(f, t)
      o.detune.setValueAtTime(detune, t)
      o.connect(flt)
      o.start(t)
      o.stop(t + duree + 0.1)
    }
    flt.connect(g)
    g.connect(this.sortie)
  }

  /** La grosse caisse : une sinusoïde qui tombe. C'est tout ce qu'il faut. */
  _peau(t, de, a, duree, volume) {
    const c = this.ctx
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(de, t)
    o.frequency.exponentialRampToValueAtTime(a, t + duree)
    g.gain.setValueAtTime(volume, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree)
    o.connect(g)
    g.connect(this.sortie)
    o.start(t)
    o.stop(t + duree + 0.03)
  }

  _bruit(t, duree, volume, coupe, type) {
    const c = this.ctx
    const n = Math.max(1, Math.floor(c.sampleRate * duree))
    const buffer = c.createBuffer(1, n, c.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n)
    const src = c.createBufferSource()
    src.buffer = buffer
    const flt = c.createBiquadFilter()
    flt.type = type
    flt.frequency.value = coupe
    const g = c.createGain()
    g.gain.value = volume
    src.connect(flt)
    flt.connect(g)
    g.connect(this.sortie)
    src.start(t)
  }
}
