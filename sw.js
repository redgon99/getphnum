// Service Worker for PWA support
const CACHE_NAME = 'phone-collector-v2';
const essentialFiles = [
  './index.html',
  './mobile.html',
  './styles/admin.css',
  './styles/mobile.css',
  './js/admin.js',
  './js/mobile.js',
  './manifest.json'
];

// Install event with improved error handling
self.addEventListener('install', (event) => {
  console.log('Service Worker 설치 시작');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('캐시 열기 성공');
        
        // 파일을 하나씩 추가하여 어떤 파일이 실패하는지 확인
        return Promise.allSettled(
          essentialFiles.map(url => {
            return fetch(url)
              .then(response => {
                if (response.ok) {
                  console.log('캐시 추가 성공:', url);
                  return cache.put(url, response);
                } else {
                  console.warn('파일을 찾을 수 없음:', url, response.status);
                  return Promise.resolve(); // 실패해도 계속 진행
                }
              })
              .catch(error => {
                console.warn('파일 캐시 실패:', url, error.message);
                return Promise.resolve(); // 실패해도 계속 진행
              });
          })
        );
      })
      .then(() => {
        console.log('Service Worker 설치 완료');
        self.skipWaiting(); // 즉시 활성화
      })
      .catch(error => {
        console.error('Service Worker 설치 실패:', error);
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker 활성화');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('이전 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker 활성화 완료');
      return self.clients.claim(); // 모든 클라이언트 제어
    })
  );
});

// Fetch event with improved error handling
self.addEventListener('fetch', (event) => {
  // localhost나 로컬 파일은 캐시하지 않음
  if (event.request.url.includes('localhost') || 
      event.request.url.includes('127.0.0.1') ||
      event.request.url.startsWith('file://')) {
    return fetch(event.request);
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 캐시에서 찾으면 반환
        if (response) {
          console.log('캐시에서 반환:', event.request.url);
          return response;
        }

        // 네트워크에서 가져오기
        return fetch(event.request)
          .then((response) => {
            // 유효한 응답인지 확인
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // 응답 복제하여 캐시에 저장
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache)
                  .catch(error => {
                    console.warn('캐시 저장 실패:', event.request.url, error);
                  });
              });

            return response;
          })
          .catch(error => {
            console.warn('네트워크 요청 실패:', event.request.url, error);
            
            // 오프라인일 때 기본 페이지 반환
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            
            throw error;
          });
      })
  );
});

// Background sync for offline data submission
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Handle offline data submission when back online
  return new Promise((resolve) => {
    // This would typically sync with a server
    console.log('Background sync triggered');
    resolve();
  });
}

// Push notifications (optional)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : '새로운 알림이 있습니다.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '확인하기',
        icon: '/icons/icon-72x72.png'
      },
      {
        action: 'close',
        title: '닫기',
        icon: '/icons/icon-72x72.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('전화번호 수집 앱', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/mobile.html')
    );
  }
});
