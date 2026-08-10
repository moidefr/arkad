import { Moteur } from './engine.js'

const moteur = new Moteur(document.getElementById('scene'))
moteur.demarre()

// Pratique pendant que tu bidouilles : depuis la console du navigateur,
// `moteur.g` te donne l'état du micro-jeu en cours.
globalThis.moteur = moteur

// Rend le jeu installable sur l'écran d'accueil du téléphone.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}))
}
