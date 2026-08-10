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
