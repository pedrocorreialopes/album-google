/**
 * Service Worker para funcionalidade offline e cache de recursos
 */

const CACHE_NAME = 'album-viewer-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache aberto');
                return cache.addAll(urlsToCache);
            })
    );
});

// Ativação do Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deletando cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Interceptação de requisições
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Retorna do cache se disponível, senão faz requisição
                if (response) {
                    return response;
                }
                
                return fetch(event.request).then(response => {
                    // Não cacheia se não for uma resposta válida
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Copia a resposta para poder cacheá-la
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                });
            })
            .catch(() => {
                // Fallback offline - pode retornar uma página offline
                return new Response('Você está offline. Alguns recursos podem não estar disponíveis.');
            })
    );
});