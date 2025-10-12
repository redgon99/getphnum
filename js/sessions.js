// 세션 관리 클래스
class SessionManager {
    constructor() {
        this.sessions = [];
        this.currentSession = null;
        this.existingPins = new Set(); // 중복 체크용
        this.init();
    }

    async init() {
        console.log('🎯 세션 관리자 초기화');
        
        // Supabase 준비 대기
        await this.waitForSupabase();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 세션 목록 로드
        await this.loadSessions();
    }

    async waitForSupabase() {
        let attempts = 0;
        while (!window.supabaseManager && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window.supabaseManager) {
            console.error('❌ Supabase 초기화 실패');
            this.showNotification('Supabase 연결에 실패했습니다', 'error');
        } else {
            console.log('✅ Supabase 준비 완료');
        }
    }

    setupEventListeners() {
        // PIN 빠른 추가 폼
        const quickAddForm = document.getElementById('quickAddForm');
        const quickPinInput = document.getElementById('quickPinInput');
        
        quickAddForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.quickAddSession();
        });

        // PIN 입력 시 실시간 검증
        quickPinInput.addEventListener('input', (e) => {
            this.validatePinInput(e.target.value);
        });

        // 상세 페이지 버튼들
        document.getElementById('toggleStatusBtn').addEventListener('click', () => {
            this.toggleSessionStatus();
        });

        document.getElementById('deleteSessionBtn').addEventListener('click', () => {
            this.deleteSession();
        });

        document.getElementById('viewDataBtn').addEventListener('click', () => {
            this.viewSessionData();
        });

        document.getElementById('copyUrlBtn').addEventListener('click', () => {
            this.copyMobileUrl();
        });

        // 전체 접기/펼치기
        document.getElementById('collapseAllBtn').addEventListener('click', () => {
            this.toggleAllSessions();
        });
    }

    // PIN 입력 검증
    validatePinInput(pin) {
        const input = document.getElementById('quickPinInput');
        const validation = document.getElementById('pinValidation');
        
        // 4자리가 아니면 초기화
        if (pin.length < 4) {
            input.classList.remove('valid', 'invalid');
            validation.style.display = 'none';
            return;
        }

        // 4자리 숫자 검증
        if (!/^\d{4}$/.test(pin)) {
            input.classList.remove('valid');
            input.classList.add('invalid');
            validation.textContent = '4자리 숫자만 입력 가능합니다';
            validation.className = 'validation-message error';
            return;
        }

        // 중복 검증
        if (this.existingPins.has(pin)) {
            input.classList.remove('valid');
            input.classList.add('invalid');
            validation.textContent = `PIN ${pin}은 이미 사용 중입니다`;
            validation.className = 'validation-message error';
            return;
        }

        // 유효한 PIN
        input.classList.remove('invalid');
        input.classList.add('valid');
        validation.textContent = `PIN ${pin} 사용 가능합니다`;
        validation.className = 'validation-message success';
    }

    // 빠른 세션 추가
    async quickAddSession() {
        const input = document.getElementById('quickPinInput');
        const pin = input.value.trim();

        console.log('📝 빠른 세션 추가:', pin);

        // 유효성 검증
        if (!/^\d{4}$/.test(pin)) {
            this.showNotification('4자리 숫자를 입력해주세요', 'error');
            return;
        }

        if (this.existingPins.has(pin)) {
            this.showNotification(`PIN ${pin}은 이미 사용 중입니다`, 'error');
            return;
        }

        try {
            // 기본 제목으로 세션 생성
            const title = `세션 ${pin}`;
            const result = await window.supabaseManager.createSession({
                pin: pin,
                title: title,
                description: null,
                expires_at: null
            });
            
            if (result.success) {
                this.showNotification(`세션 ${pin} 생성 완료!`, 'success');
                input.value = '';
                input.classList.remove('valid', 'invalid');
                document.getElementById('pinValidation').style.display = 'none';
                
                // 세션 목록 새로고침
                await this.loadSessions();
                
                // 새로 생성된 세션 선택
                this.selectSession(result.data.id);
            } else {
                throw new Error(result.message || '세션 생성 실패');
            }
        } catch (error) {
            console.error('❌ 세션 생성 오류:', error);
            
            let errorMsg = '세션 생성에 실패했습니다';
            if (error.message.includes('duplicate') || error.message.includes('unique')) {
                errorMsg = `PIN ${pin}은 이미 사용 중입니다`;
            }
            
            this.showNotification(errorMsg, 'error');
        }
    }

    // 세션 목록 로드
    async loadSessions() {
        console.log('🔄 세션 목록 로드 중...');
        const container = document.getElementById('sessionTreeContainer');
        container.innerHTML = '<div class="loading-tree">세션을 불러오는 중...</div>';

        try {
            const result = await window.supabaseManager.getAllSessions();
            
            if (result.success) {
                this.sessions = result.data || [];
                console.log(`✅ ${this.sessions.length}개 세션 로드됨`);
                
                // 기존 PIN 목록 업데이트
                this.existingPins = new Set(this.sessions.map(s => s.pin));
                
                this.renderSessionTree();
            } else {
                throw new Error(result.message || '세션 로드 실패');
            }
        } catch (error) {
            console.error('❌ 세션 로드 오류:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <p>⚠️ 세션을 불러올 수 없습니다</p>
                    <small>${error.message}</small>
                </div>
            `;
        }
    }

    // 세션 트리 렌더링
    renderSessionTree() {
        const container = document.getElementById('sessionTreeContainer');
        
        if (this.sessions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>📭 세션이 없습니다</p>
                    <small>위에서 PIN을 입력하여 세션을 추가하세요</small>
                </div>
            `;
            return;
        }

        // 활성 세션 먼저, 그 다음 PIN 순으로 정렬
        const sortedSessions = [...this.sessions].sort((a, b) => {
            if (a.is_active !== b.is_active) {
                return a.is_active ? -1 : 1;
            }
            return a.pin.localeCompare(b.pin);
        });

        container.innerHTML = sortedSessions.map(session => `
            <div class="tree-item ${session.is_active ? '' : 'inactive'} ${this.currentSession && this.currentSession.id === session.id ? 'active' : ''}" 
                 data-session-id="${session.id}">
                <div class="tree-item-header">
                    <div class="tree-item-status"></div>
                    <div class="tree-item-pin">${session.pin}</div>
                    <div class="tree-item-info">
                        <div class="tree-item-count">
                            <strong>${session.current_entries || 0}</strong>건 
                            (오늘 <strong>${session.today_entries || 0}</strong>)
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // 클릭 이벤트 등록
        container.querySelectorAll('.tree-item').forEach(item => {
            item.addEventListener('click', () => {
                const sessionId = parseInt(item.dataset.sessionId);
                this.selectSession(sessionId);
            });
        });
    }

    // 세션 선택
    selectSession(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;

        this.currentSession = session;
        console.log('📌 세션 선택:', session);

        // 트리에서 active 클래스 업데이트
        document.querySelectorAll('.tree-item').forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.sessionId) === sessionId);
        });

        // 상세 정보 표시
        this.showSessionDetail(session);
    }

    // 세션 상세 정보 표시
    showSessionDetail(session) {
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('sessionDetail').style.display = 'block';

        // 모바일 URL 생성
        const protocol = window.location.protocol;
        const host = window.location.host;
        const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
        const mobileUrl = `${protocol}//${host}${basePath}/mobile.html?pin=${session.pin}`;

        // 정보 업데이트
        document.getElementById('detailTitle').textContent = `세션 ${session.pin}`;
        document.getElementById('detailPin').textContent = session.pin;
        document.getElementById('detailTotalEntries').textContent = session.current_entries || 0;
        document.getElementById('detailTodayEntries').textContent = session.today_entries || 0;
        document.getElementById('detailStatus').textContent = session.is_active ? '✅ 활성' : '❌ 비활성';
        document.getElementById('detailMobileUrl').value = mobileUrl;
        document.getElementById('detailCreatedAt').textContent = new Date(session.created_at).toLocaleString('ko-KR');
        
        const lastEntry = session.last_entry_at 
            ? new Date(session.last_entry_at).toLocaleString('ko-KR')
            : '수집된 데이터 없음';
        document.getElementById('detailLastEntry').textContent = lastEntry;

        // 버튼 텍스트 업데이트
        document.getElementById('toggleStatusBtn').textContent = session.is_active ? '🔒 비활성화' : '✅ 활성화';
    }

    // 모바일 URL 복사
    copyMobileUrl() {
        const urlInput = document.getElementById('detailMobileUrl');
        urlInput.select();
        urlInput.setSelectionRange(0, 99999);

        try {
            document.execCommand('copy');
            this.showNotification('모바일 URL이 복사되었습니다!', 'success');
        } catch (err) {
            console.error('복사 실패:', err);
            this.showNotification('복사에 실패했습니다', 'error');
        }
    }

    // 세션 데이터 보기
    viewSessionData() {
        if (!this.currentSession) return;
        window.location.href = `index.html?session=${this.currentSession.id}`;
    }

    // 세션 상태 토글
    async toggleSessionStatus() {
        if (!this.currentSession) return;

        const newStatus = !this.currentSession.is_active;
        const action = newStatus ? '활성화' : '비활성화';

        if (!confirm(`세션 ${this.currentSession.pin}을(를) ${action}하시겠습니까?`)) {
            return;
        }

        try {
            const result = await window.supabaseManager.updateSessionStatus(this.currentSession.id, newStatus);
            
            if (result.success) {
                this.showNotification(`세션이 ${action}되었습니다`, 'success');
                await this.loadSessions();
                this.selectSession(this.currentSession.id);
            } else {
                throw new Error(result.message || '상태 변경 실패');
            }
        } catch (error) {
            console.error('❌ 상태 변경 오류:', error);
            this.showNotification(`상태 변경에 실패했습니다: ${error.message}`, 'error');
        }
    }

    // 세션 삭제
    async deleteSession() {
        if (!this.currentSession) return;

        const entryCount = this.currentSession.current_entries || 0;
        let confirmMsg = `세션 ${this.currentSession.pin}을(를) 삭제하시겠습니까?`;
        
        if (entryCount > 0) {
            confirmMsg += `\n\n⚠️ 이 세션에는 ${entryCount}개의 수집된 데이터가 있습니다. 모두 삭제됩니다!`;
        }

        if (!confirm(confirmMsg)) {
            return;
        }

        try {
            const result = await window.supabaseManager.deleteSession(this.currentSession.id);
            
            if (result.success) {
                this.showNotification('세션이 삭제되었습니다', 'success');
                this.currentSession = null;
                document.getElementById('sessionDetail').style.display = 'none';
                document.getElementById('emptyState').style.display = 'flex';
                await this.loadSessions();
            } else {
                throw new Error(result.message || '삭제 실패');
            }
        } catch (error) {
            console.error('❌ 삭제 오류:', error);
            this.showNotification(`삭제에 실패했습니다: ${error.message}`, 'error');
        }
    }

    // 전체 접기/펼치기
    toggleAllSessions() {
        // 간단한 구현: 현재는 선택 해제
        this.currentSession = null;
        document.querySelectorAll('.tree-item').forEach(item => {
            item.classList.remove('active');
        });
        document.getElementById('sessionDetail').style.display = 'none';
        document.getElementById('emptyState').style.display = 'flex';
    }

    // 알림 표시
    showNotification(message, type = 'info') {
        // 기존 알림 제거
        const existing = document.querySelector('.notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);

        // 3초 후 제거
        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.sessionManager = new SessionManager();
});
