// Service Worker バージョン
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `attendance-app-${CACHE_VERSION}`;

// キャッシュするファイル
const FILES_TO_CACHE = [
    '/attendance-app/',
    '/attendance-app/index.html',
    '/attendance-app/styles.css',
    '/attendance-app/app.js',
    '/attendance-app/manifest.json'
];

// Service Worker インストール時
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(FILES_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Service Worker アクティベーション時（古いキャッシュを削除）
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activate');

    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );

    return self.clients.claim();
});

// フェッチイベント（ネットワーク優先、フォールバックでキャッシュ）
self.addEventListener('fetch', (event) => {
    // GAS APIリクエストはキャッシュしない（常に最新データを取得）
    if (event.request.url.includes('script.google.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // キャッシュがあれば返す
                if (response) {
                    return response;
                }

                // なければネットワークから取得
                return fetch(event.request)
                    .then((response) => {
                        // レスポンスが無効な場合はそのまま返す
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // レスポンスをキャッシュに保存
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // ネットワークエラー時はキャッシュから返す（オフライン対応）
                        return caches.match('/attendance-app/index.html');
                    });
            })
    );
});
