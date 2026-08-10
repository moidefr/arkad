import { Moteur } from './engine.js'
import { son } from './son.js'

const moteur = new Moteur(document.getElementById('scene'))
moteur.demarre()

// Pratique pendant que tu bidouilles : depuis la console du navigateur,
// `moteur.j` te donne l'état du jeu en cours, et `son` laisse essayer les
// bruitages un par un.
globalThis.moteur = moteur
globalThis.son = son

// Rend le jeu installable sur l'écran d'accueil du téléphone.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}))
}
