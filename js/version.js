// 앱 버전 관리
const APP_VERSION = '1.1.0'; // 배포할 때마다 이 버전을 올리세요
const BUILD_TIME = '2025-10-12T09:30:00'; // 빌드 시간

// 버전 체크 및 캐시 클리어
(function() {
    const STORAGE_KEY = 'app_version';
    const storedVersion = localStorage.getItem(STORAGE_KEY);
    
    console.log('📦 현재 버전:', APP_VERSION);
    console.log('💾 저장된 버전:', storedVersion);
    
    if (storedVersion !== APP_VERSION) {
        console.log('🔄 버전 변경 감지! 캐시를 클리어합니다...');
        
        // 캐시 클리어
        if ('caches' in window) {
            caches.keys().then(function(names) {
                for (let name of names) {
                    caches.delete(name);
                    console.log('🗑️ 캐시 삭제:', name);
                }
            });
        }
        
        // Service Worker 재등록
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) {
                    registration.unregister();
                    console.log('🔄 Service Worker 제거');
                }
            });
        }
        
        // 버전 업데이트
        localStorage.setItem(STORAGE_KEY, APP_VERSION);
        
        // 페이지 강제 새로고침 (캐시 무시)
        console.log('✨ 최신 버전으로 업데이트 완료!');
        
        // 사용자에게 알림
        if (storedVersion) {
            const updateMsg = `
🎉 새로운 버전이 업데이트되었습니다!

이전 버전: ${storedVersion}
현재 버전: ${APP_VERSION}

페이지를 새로고침합니다...
            `.trim();
            
            alert(updateMsg);
            
            // 캐시 무시하고 강제 새로고침
            setTimeout(() => {
                window.location.reload(true);
            }, 500);
        }
    } else {
        console.log('✅ 최신 버전 사용 중');
    }
    
    // 버전 정보 전역 노출
    window.APP_VERSION = APP_VERSION;
    window.BUILD_TIME = BUILD_TIME;
})();

// 수동 업데이트 체크 함수
window.checkForUpdates = function() {
    console.log('🔍 업데이트 확인 중...');
    console.log('현재 버전:', APP_VERSION);
    console.log('빌드 시간:', BUILD_TIME);
    
    // 서버에서 최신 버전 확인 (선택사항)
    // fetch('/version.json').then(...)
    
    alert(`현재 버전: ${APP_VERSION}\n빌드 시간: ${BUILD_TIME}\n\n최신 버전을 사용 중입니다.`);
};

