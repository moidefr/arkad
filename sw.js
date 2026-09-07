/**
 * Service worker volontairement minimal : on va chercher le réseau d'abord,
 * et le cache ne sert que de filet quand il n'y a pas de connexion.
 * (Un cache-first casserait le rechargement pendant que tu développes.)
 */
const CACHE = 'arcade-v1'

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
  )
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  // Les appels au dos de la borne (Supabase) ne passent pas par ici : un
  // classement servi depuis le cache serait un classement d'hier, et
  // `scores.js` sait déjà garder la dernière image qu'il a reçue.
  if (new URL(e.request.url).origin !== self.location.origin) return
  e.respondWith(
    fetch(e.request)
      .then((rep) => {
        const copie = rep.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copie))
        return rep
      })
      .catch(() => caches.match(e.request))
  )
})
