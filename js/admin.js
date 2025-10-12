// 관리자 페이지 JavaScript
class PhoneDataManager {
    constructor() {
        this.data = [];
        this.subscription = null;
        this.useSupabase = false;
        this.currentSessionId = null; // 현재 선택된 세션 ID
        this.sessions = []; // 세션 목록
        this.existingPins = new Set(); // 중복 체크용
        // init()은 외부에서 명시적으로 호출
    }

    async init() {
        console.log('관리자 페이지 초기화 시작');
        
        // Supabase 설정 확인
        await this.checkSupabaseConfig();
        
        // URL 파라미터에서 세션 ID 확인
        const urlParams = new URLSearchParams(window.location.search);
        const sessionParam = urlParams.get('session');
        if (sessionParam) {
            this.currentSessionId = parseInt(sessionParam);
            console.log('📌 URL에서 세션 ID 감지:', this.currentSessionId);
        }
        
        // 세션 목록 로드
        await this.loadSessions();
        
        // 데이터 로드
        await this.loadInitialData();
        
        // UI 업데이트
        await this.updateStats();
        this.renderTable();
        this.setupEventListeners();
        this.setupRealTimeSync();
        
        // 우측 세션 관리 초기화
        this.setupQuickSessionAdd();
        this.renderQuickSessionList();
        
        console.log('관리자 페이지 초기화 완료');
    }
    
    // Supabase 설정 확인
    async checkSupabaseConfig() {
        if (window.supabaseManager && window.supabaseManager.isSupabaseConfigured()) {
            this.useSupabase = true;
            console.log('✅ Supabase 모드로 실행');
            
            // 연결 테스트
            const testResult = await window.supabaseManager.testConnection();
            if (testResult.success) {
                console.log('🔗 Supabase 연결 성공');
            } else {
                console.error('❌ Supabase 연결 실패:', testResult.message);
                this.useSupabase = false;
            }
        } else {
            this.useSupabase = false;
            console.log('📦 localStorage 모드로 실행');
        }
    }
    
    // 세션 목록 로드
    async loadSessions() {
        if (!this.useSupabase) {
            console.log('⚠️ Supabase 비활성화, 세션 기능 사용 불가');
            return;
        }
        
        try {
            const result = await window.supabaseManager.getAllSessions();
            if (result.success) {
                this.sessions = result.data || [];
                console.log(`✅ ${this.sessions.length}개 세션 로드됨`);
                
                // 기존 PIN 목록 업데이트 (중복 체크용)
                this.existingPins = new Set(this.sessions.map(s => s.pin));
                console.log('📌 기존 PIN 목록:', Array.from(this.existingPins));
                
                this.renderSessionSelector();
            }
        } catch (error) {
            console.error('❌ 세션 로드 실패:', error);
        }
    }
    
    // 세션 선택기 렌더링
    renderSessionSelector() {
        const select = document.getElementById('sessionSelect');
        if (!select) return;
        
        // 기존 옵션 유지하고 세션 추가
        select.innerHTML = '<option value="">전체 데이터</option>';
        
        this.sessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session.id;
            option.textContent = `[${session.pin}] ${session.title}`;
            if (!session.is_active) {
                option.textContent += ' (비활성)';
                option.disabled = true;
            }
            if (this.currentSessionId && session.id === this.currentSessionId) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        // 세션 정보 배지 업데이트
        this.updateSessionInfoBadge();
        
        // 이벤트 리스너
        select.addEventListener('change', async (e) => {
            this.currentSessionId = e.target.value ? parseInt(e.target.value) : null;
            console.log('📌 세션 변경:', this.currentSessionId);
            await this.loadInitialData();
            await this.updateStats();
            this.renderTable();
            this.updateSessionInfoBadge();
            
            // QR 코드 업데이트
            if (typeof window.updateMobileUrl === 'function') {
                window.updateMobileUrl();
            }
        });
    }
    
    // 세션 정보 배지 업데이트
    updateSessionInfoBadge() {
        const badge = document.getElementById('sessionInfo');
        if (!badge) return;
        
        if (this.currentSessionId) {
            const session = this.sessions.find(s => s.id === this.currentSessionId);
            if (session) {
                badge.textContent = `PIN: ${session.pin}`;
                badge.style.display = 'block';
            }
        } else {
            badge.textContent = '';
            badge.style.display = 'none';
        }
    }
    
    // ==================== 우측 세션 관리 ====================
    
    // 빠른 세션 추가 설정
    setupQuickSessionAdd() {
        const quickForm = document.getElementById('quickAddForm');
        const quickPinInput = document.getElementById('quickPinInput');
        
        if (!quickForm || !quickPinInput) {
            console.log('⚠️ 빠른 세션 추가 요소 없음');
            return;
        }
        
        // 폼 제출
        quickForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.quickAddSession();
        });
        
        // PIN 입력 검증
        quickPinInput.addEventListener('input', (e) => {
            this.validateQuickPin(e.target.value);
        });
    }
    
    // PIN 입력 검증
    validateQuickPin(pin) {
        const input = document.getElementById('quickPinInput');
        const validation = document.getElementById('quickPinValidation');
        
        if (!input || !validation) {
            console.log('⚠️ PIN 검증 요소 없음');
            return;
        }
        
        console.log('🔍 PIN 검증:', pin, '기존 PIN 목록:', Array.from(this.existingPins));
        
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
            validation.textContent = '❌ 4자리 숫자만 입력';
            validation.className = 'quick-validation error';
            console.log('❌ 숫자 형식 오류:', pin);
            return;
        }
        
        // 중복 검증
        if (this.existingPins.has(pin)) {
            input.classList.remove('valid');
            input.classList.add('invalid');
            validation.textContent = `⚠️ PIN ${pin}은 이미 사용 중입니다`;
            validation.className = 'quick-validation error';
            validation.style.display = 'block';
            console.log(`❌ PIN ${pin} 중복 감지! 기존 PIN:`, Array.from(this.existingPins));
            return;
        }
        
        // 유효한 PIN
        input.classList.remove('invalid');
        input.classList.add('valid');
        validation.textContent = `✅ 사용 가능`;
        validation.className = 'quick-validation success';
        validation.style.display = 'block';
        console.log(`✅ PIN ${pin} 사용 가능`);
    }
    
    // 빠른 세션 추가
    async quickAddSession() {
        const input = document.getElementById('quickPinInput');
        const pin = input.value.trim();
        
        console.log('📝 빠른 세션 추가:', pin);
        
        // 유효성 검증
        if (!/^\d{4}$/.test(pin)) {
            this.showQuickNotification('❌ 4자리 숫자만 입력 가능합니다', 'error');
            return;
        }
        
        if (this.existingPins.has(pin)) {
            this.showQuickNotification(`⚠️ PIN ${pin}은 이미 사용 중입니다. 다른 번호를 사용하세요.`, 'error');
            
            // 입력창 시각적 피드백
            const input = document.getElementById('quickPinInput');
            input.classList.add('invalid');
            input.select(); // 텍스트 전체 선택으로 재입력 용이
            
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
                this.showQuickNotification(`✅ 세션 ${pin} 생성 완료!`, 'success');
                
                // PIN을 기존 목록에 추가 (즉시 중복 체크에 반영)
                this.existingPins.add(pin);
                console.log('✅ PIN 추가됨:', pin, '현재 목록:', Array.from(this.existingPins));
                
                // 입력창 초기화
                input.value = '';
                input.classList.remove('valid', 'invalid');
                const validation = document.getElementById('quickPinValidation');
                if (validation) {
                    validation.style.display = 'none';
                    validation.className = 'quick-validation';
                }
                
                // 세션 목록 새로고침
                await this.loadSessions();
                this.renderQuickSessionList();
                
                // 새로 생성된 세션 자동 선택
                this.currentSessionId = result.data.id;
                console.log('🎯 새 세션 자동 선택:', this.currentSessionId, 'PIN:', pin);
                
                this.renderSessionSelector();
                this.updateSessionInfoBadge();
                await this.loadInitialData();
                await this.updateStats();
                this.renderTable();
                
                // QR 코드 업데이트 (중요!)
                if (typeof window.updateMobileUrl === 'function') {
                    console.log('🔄 QR 코드 업데이트 호출');
                    window.updateMobileUrl();
                } else {
                    console.error('❌ updateMobileUrl 함수 없음!');
                }
            } else {
                throw new Error(result.message || '세션 생성 실패');
            }
        } catch (error) {
            console.error('❌ 세션 생성 오류:', error);
            let errorMsg = '❌ 세션 생성에 실패했습니다';
            
            if (error.message.includes('duplicate') || error.message.includes('unique') || error.message.includes('violates unique constraint')) {
                errorMsg = `⚠️ PIN ${pin}은 이미 사용 중입니다. 다른 번호를 입력하세요.`;
                input.classList.add('invalid');
                input.select();
            } else if (error.message) {
                errorMsg = `❌ ${error.message}`;
            }
            
            this.showQuickNotification(errorMsg, 'error');
        }
    }
    
    // 우측 세션 목록 렌더링
    renderQuickSessionList() {
        const container = document.getElementById('sessionListContainer');
        const countSpan = document.getElementById('sessionCount');
        
        if (!container) {
            console.log('⚠️ 세션 목록 컨테이너 없음');
            return;
        }
        
        // 카운트 업데이트
        if (countSpan) {
            countSpan.textContent = this.sessions.length;
        }
        
        if (this.sessions.length === 0) {
            container.innerHTML = '<div class="session-loading">세션이 없습니다</div>';
            return;
        }
        
        // 활성 세션 먼저, PIN 순으로 정렬
        const sortedSessions = [...this.sessions].sort((a, b) => {
            if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
            return a.pin.localeCompare(b.pin);
        });
        
        container.innerHTML = sortedSessions.map(session => `
            <div class="session-item ${session.is_active ? '' : 'inactive'} ${this.currentSessionId === session.id ? 'active' : ''}" 
                 data-session-id="${session.id}">
                <div class="session-item-pin">${session.pin}</div>
                <div class="session-item-info">
                    <div class="session-item-count">
                        <strong>${session.current_entries || 0}</strong>건
                    </div>
                </div>
                <div class="session-item-actions">
                    <button class="session-item-btn delete" title="삭제" data-action="delete" data-session-id="${session.id}">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
        
        // 이벤트 리스너 등록
        container.querySelectorAll('.session-item').forEach(item => {
            const sessionId = parseInt(item.dataset.sessionId);
            
            // 클릭 시 선택
            item.addEventListener('click', (e) => {
                // 버튼 클릭은 무시
                if (e.target.closest('.session-item-btn')) return;
                
                this.selectQuickSession(sessionId);
            });
        });
        
        // 삭제 버튼
        container.querySelectorAll('.session-item-btn.delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const sessionId = parseInt(btn.dataset.sessionId);
                await this.deleteQuickSession(sessionId);
            });
        });
    }
    
    // 빠른 세션 선택
    async selectQuickSession(sessionId) {
        console.log('📌 빠른 세션 선택:', sessionId);
        
        this.currentSessionId = sessionId;
        
        // UI 업데이트
        this.renderQuickSessionList();
        this.renderSessionSelector();
        await this.loadInitialData();
        await this.updateStats();
        this.renderTable();
        this.updateSessionInfoBadge();
        
        // QR 코드 업데이트
        if (typeof window.updateMobileUrl === 'function') {
            window.updateMobileUrl();
        }
    }
    
    // 빠른 세션 삭제
    async deleteQuickSession(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;
        
        const entryCount = session.current_entries || 0;
        let confirmMsg = `세션 ${session.pin} 삭제?`;
        if (entryCount > 0) {
            confirmMsg += `\n⚠️ ${entryCount}개 데이터도 삭제됩니다!`;
        }
        
        if (!confirm(confirmMsg)) return;
        
        try {
            const result = await window.supabaseManager.deleteSession(sessionId);
            
            if (result.success) {
                this.showQuickNotification('✅ 세션 삭제됨', 'success');
                
                // PIN을 기존 목록에서 제거 (즉시 중복 체크에 반영)
                this.existingPins.delete(session.pin);
                console.log('🗑️ PIN 제거됨:', session.pin, '현재 목록:', Array.from(this.existingPins));
                
                // 현재 선택된 세션이면 해제
                if (this.currentSessionId === sessionId) {
                    this.currentSessionId = null;
                }
                
                // 새로고침
                await this.loadSessions();
                this.renderQuickSessionList();
                this.renderSessionSelector();
                await this.loadInitialData();
                await this.updateStats();
                this.renderTable();
                
                // QR 코드 업데이트
                if (typeof window.updateMobileUrl === 'function') {
                    window.updateMobileUrl();
                }
            } else {
                throw new Error(result.message || '삭제 실패');
            }
        } catch (error) {
            console.error('❌ 세션 삭제 오류:', error);
            this.showQuickNotification('삭제 실패', 'error');
        }
    }
    
    // 빠른 알림
    showQuickNotification(message, type = 'info') {
        const validation = document.getElementById('quickPinValidation');
        if (!validation) {
            console.log('⚠️ 알림 요소 없음');
            return;
        }
        
        console.log('📢 알림 표시:', message, '타입:', type);
        
        validation.textContent = message;
        validation.className = `quick-validation ${type}`;
        validation.style.display = 'block';
        validation.style.visibility = 'visible';
        validation.style.opacity = '1';
        
        // 에러 메시지는 더 오래 표시
        const duration = type === 'error' ? 5000 : 3000;
        
        setTimeout(() => {
            if (validation.className.includes(type)) {
                validation.style.opacity = '0';
                setTimeout(() => {
                    validation.style.display = 'none';
                    validation.className = 'quick-validation';
                }, 300);
            }
        }, duration);
    }
    
    // 세션 카운트 증가 (실시간 업데이트용)
    incrementSessionCount(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (session) {
            // 메모리의 카운트 증가
            session.current_entries = (session.current_entries || 0) + 1;
            
            // 오늘 날짜 확인
            const today = new Date().toDateString();
            const lastEntryDate = session.last_entry_at ? new Date(session.last_entry_at).toDateString() : null;
            
            if (lastEntryDate === today) {
                session.today_entries = (session.today_entries || 0) + 1;
            } else {
                session.today_entries = 1;
            }
            
            session.last_entry_at = new Date().toISOString();
            
            console.log(`📊 세션 ${sessionId} 카운트 증가:`, session.current_entries);
            
            // UI 업데이트
            this.renderQuickSessionList();
        }
    }
    
    // 초기 데이터 로드
    async loadInitialData() {
        console.log('📥 데이터 로드 시작, useSupabase:', this.useSupabase, 'sessionId:', this.currentSessionId);
        
        if (this.useSupabase) {
            try {
                console.log('🔄 Supabase에서 데이터 조회 중...');
                
                // 세션 필터링
                if (this.currentSessionId) {
                    const result = await window.supabaseManager.getDataBySession(this.currentSessionId);
                    if (result.success) {
                        this.data = result.data || [];
                        console.log(`📊 세션 ${this.currentSessionId}의 데이터 로드 성공:`, this.data.length, '개');
                    } else {
                        throw new Error(result.message);
                    }
                } else {
                    this.data = await window.supabaseManager.getPhoneNumbers();
                    console.log('📊 전체 데이터 로드 성공:', this.data.length, '개');
                }
                
                console.log('📋 로드된 데이터:', this.data);
            } catch (error) {
                console.error('❌ Supabase 데이터 로드 실패, localStorage로 전환:', error);
                this.useSupabase = false;
                this.loadFromLocalStorage();
            }
        } else {
            this.loadFromLocalStorage();
        }
        
        console.log('✅ 데이터 로드 완료, 총 데이터 수:', this.data.length);
    }
    
    // localStorage에서 데이터 로드
    loadFromLocalStorage() {
        this.data = JSON.parse(localStorage.getItem('phoneData')) || [];
        console.log('📦 localStorage에서 데이터 로드:', this.data.length, '개');
    }
    
    // 강제 데이터 새로고침
    forceRefreshData() {
        const storedData = JSON.parse(localStorage.getItem('phoneData')) || [];
        console.log('localStorage에서 로드된 데이터 수:', storedData.length);
        
        if (storedData.length > 0) {
            this.data = storedData;
            console.log('데이터 업데이트 완료:', this.data.length, '개');
        } else {
            console.log('localStorage에 저장된 데이터가 없습니다');
        }
    }

    // QR코드 생성
    generateQRCode() {
        const mobileUrl = `${window.location.origin}/mobile.html`;
        const qrContainer = document.getElementById('qrcode');
        const urlInput = document.getElementById('mobileUrl');
        const qrLoading = document.getElementById('qrLoading');
        
        urlInput.value = mobileUrl;

        // 로딩 표시
        qrLoading.style.display = 'block';
        qrContainer.style.display = 'none';

        // QRCode 라이브러리가 로드되었는지 확인
        if (typeof QRCode === 'undefined') {
            console.error('QRCode 라이브러리가 로드되지 않았습니다.');
            qrLoading.innerHTML = `
                <p style="color: red;">QRCode 라이브러리 로드 실패</p>
                <p style="font-size: 0.9rem; margin-top: 10px;">
                    <a href="${mobileUrl}" target="_blank" style="color: #3b82f6; text-decoration: underline;">
                        직접 링크로 접속하기
                    </a>
                </p>
            `;
            return;
        }

        // 기존 QR코드 제거
        qrContainer.innerHTML = '';

        // 새 QR코드 생성
        QRCode.toCanvas(qrContainer, mobileUrl, {
            width: 250,
            height: 250,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            errorCorrectionLevel: 'M'
        }, (error) => {
            qrLoading.style.display = 'none';
            
            if (error) {
                console.error('QR코드 생성 실패:', error);
                qrContainer.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: red;">
                        <p>QR코드 생성 실패</p>
                        <p style="font-size: 0.9rem; margin-top: 10px;">
                            <a href="${mobileUrl}" target="_blank" style="color: #3b82f6; text-decoration: underline;">
                                직접 링크로 접속하기
                            </a>
                        </p>
                        <p style="font-size: 0.8rem; margin-top: 5px; color: #666;">
                            페이지를 새로고침해주세요
                        </p>
                    </div>
                `;
                qrContainer.style.display = 'block';
            } else {
                qrContainer.style.display = 'block';
                console.log('QR코드 생성 성공');
            }
        });
    }

    // 통계 업데이트
    async updateStats() {
        if (this.useSupabase) {
            try {
                const stats = await window.supabaseManager.getStats();
                document.getElementById('totalCount').textContent = stats.total;
                document.getElementById('todayCount').textContent = stats.today;
                console.log('📊 Supabase 통계 업데이트:', stats);
            } catch (error) {
                console.error('Supabase 통계 조회 실패:', error);
                this.updateStatsFromLocalData();
            }
        } else {
            this.updateStatsFromLocalData();
        }
    }
    
    // localStorage 데이터로 통계 계산
    updateStatsFromLocalData() {
        const totalCount = this.data.length;
        const today = new Date().toDateString();
        const todayCount = this.data.filter(item => {
            const itemDate = item.created_at || item.timestamp;
            return new Date(itemDate).toDateString() === today;
        }).length;

        document.getElementById('totalCount').textContent = totalCount;
        document.getElementById('todayCount').textContent = todayCount;
    }

    // 테이블 렌더링
    renderTable() {
        console.log('🖼️ 테이블 렌더링 시작, 데이터 수:', this.data.length);
        
        const tbody = document.getElementById('dataTableBody');
        if (!tbody) {
            console.error('❌ dataTableBody 요소를 찾을 수 없습니다');
            return;
        }
        
        const previousCount = tbody.children.length;
        tbody.innerHTML = '';

        if (this.data.length === 0) {
            console.log('📭 데이터가 없어 빈 테이블 표시');
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: #9ca3af; padding: 40px;">
                        <div style="font-size: 1.2em; margin-bottom: 10px;">📱</div>
                        아직 수집된 데이터가 없습니다<br>
                        <small style="color: #6b7280;">QR코드를 스캔하여 전화번호를 수집하세요</small>
                    </td>
                </tr>
            `;
            return;
        }

        console.log('📊 테이블에 데이터 렌더링:', this.data.length, '개');

        // 최신 데이터부터 표시 (Supabase는 이미 정렬되어 있음)
        this.data.forEach((item, index) => {
            const row = document.createElement('tr');
            const rowNumber = index + 1;
            
            // Supabase와 localStorage 데이터 구조 호환
            const timestamp = item.created_at || item.timestamp;
            const itemId = item.id || item.id || Date.now();
            
            row.innerHTML = `
                <td style="font-weight: 600; color: #3b82f6;">${rowNumber}</td>
                <td style="font-weight: 500;">${this.escapeHtml(item.name)}</td>
                <td style="font-family: monospace; font-weight: 500;">${this.formatPhoneNumber(item.phone)}</td>
                <td style="color: #6b7280; font-size: 0.9em;">${this.formatDateTime(timestamp)}</td>
            `;
            
            // 새로 추가된 행인지 확인 (첫 번째 행이고 이전보다 데이터가 많아진 경우)
            if (index === 0 && this.data.length > previousCount) {
                row.setAttribute('data-new', 'true');
                row.setAttribute('data-id', itemId);
            }
            
            tbody.appendChild(row);
        });

        console.log('✅ 테이블 렌더링 완료:', this.data.length, '개 행 생성');

        // 테이블 새로고침 애니메이션
        if (this.data.length !== previousCount) {
            this.animateTableRefresh();
            
            // 새 행 하이라이트
            const newRow = tbody.querySelector('tr[data-new="true"]');
            if (newRow) {
                setTimeout(() => {
                    this.highlightSpecificRow(newRow);
                }, 300);
            }
        }
    }
    
    // 특정 행 하이라이트
    highlightSpecificRow(row) {
        // 강한 하이라이트 효과
        row.style.cssText = `
            background: linear-gradient(90deg, #10b981, #34d399) !important;
            color: white !important;
            transform: scale(1.02);
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
            transition: all 0.5s ease;
            border-radius: 8px;
        `;
        
        // 펄스 효과 추가
        row.classList.add('pulse-animation');
        
        setTimeout(() => {
            row.style.cssText = `
                background: #f0fdf4;
                color: #166534;
                transform: scale(1);
                box-shadow: none;
                transition: all 0.5s ease;
                border-radius: 0;
            `;
        }, 2000);
        
        setTimeout(() => {
            row.style.cssText = '';
            row.classList.remove('pulse-animation');
            row.removeAttribute('data-new');
        }, 4000);
    }

    // HTML 이스케이프
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 전화번호 포맷팅
    formatPhoneNumber(phone) {
        // 숫자만 추출
        const numbers = phone.replace(/\D/g, '');
        
        // 한국 전화번호 포맷팅
        if (numbers.length === 11 && numbers.startsWith('010')) {
            return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
        } else if (numbers.length === 10) {
            return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
        }
        
        return phone;
    }

    // 날짜/시간 포맷팅
    formatDateTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // 1분 미만
        if (diff < 60000) {
            return '방금 전';
        }
        
        // 1시간 미만
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes}분 전`;
        }
        
        // 24시간 미만
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours}시간 전`;
        }
        
        // 그 외에는 날짜 표시
        return date.toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 데이터 추가
    addData(name, phone) {
        const newData = {
            id: Date.now(),
            name: name.trim(),
            phone: phone.trim(),
            timestamp: new Date().toISOString()
        };

        this.data.push(newData);
        this.saveData();
        this.updateStats();
        this.renderTable();
        
        // 새 데이터 행에 하이라이트 효과
        this.highlightNewRow();
    }

    // 새 데이터 행 하이라이트
    highlightNewRow() {
        const rows = document.querySelectorAll('#dataTableBody tr');
        if (rows.length > 0) {
            const newRow = rows[0];
            
            // 강한 하이라이트 효과
            newRow.style.cssText = `
                background: linear-gradient(90deg, #10b981, #34d399) !important;
                color: white !important;
                transform: scale(1.02);
                box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
                transition: all 0.5s ease;
                border-radius: 8px;
            `;
            
            // 펄스 효과 추가
            newRow.classList.add('pulse-animation');
            
            setTimeout(() => {
                newRow.style.cssText = `
                    background: #f0fdf4;
                    color: #166534;
                    transform: scale(1);
                    box-shadow: none;
                    transition: all 0.5s ease;
                    border-radius: 0;
                `;
            }, 2000);
            
            setTimeout(() => {
                newRow.style.cssText = '';
                newRow.classList.remove('pulse-animation');
            }, 4000);
        }
    }
    
    // 테이블 전체 새로고침 애니메이션
    animateTableRefresh() {
        const table = document.getElementById('dataTable');
        table.style.transform = 'scale(0.98)';
        table.style.transition = 'transform 0.2s ease';
        
        setTimeout(() => {
            table.style.transform = 'scale(1)';
        }, 200);
    }

    // 데이터 저장
    saveData() {
        localStorage.setItem('phoneData', JSON.stringify(this.data));
    }

    // 데이터 내보내기
    exportData() {
        if (this.data.length === 0) {
            alert('내보낼 데이터가 없습니다.');
            return;
        }

        const csvContent = this.generateCSV();
        
        // UTF-8 BOM 추가 (Excel에서 한글 깨짐 방지)
        const BOM = '\uFEFF';
        const csvWithBOM = BOM + csvContent;
        
        const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `전화번호_데이터_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('✅ 데이터 내보내기 완료:', this.data.length, '개 데이터');
        }
    }

    // CSV 생성
    generateCSV() {
        const headers = ['번호', '이름', '전화번호', '수집시간'];
        const rows = [headers.join(',')];

        this.data.forEach((item, index) => {
            // CSV에서 쌍따옴표 이스케이프 처리
            const escapeCsvValue = (value) => {
                if (typeof value !== 'string') value = String(value);
                // 쌍따옴표가 있으면 두 번 쓰기 ("" -> """")
                const escaped = value.replace(/"/g, '""');
                return `"${escaped}"`;
            };
            
            // 시간 필드 - Supabase(created_at) 또는 localStorage(timestamp) 지원
            const timestamp = item.created_at || item.timestamp;
            const formattedTime = new Date(timestamp).toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            const row = [
                index + 1,
                escapeCsvValue(item.name),
                escapeCsvValue(this.formatPhoneNumber(item.phone)),
                escapeCsvValue(formattedTime)
            ];
            rows.push(row.join(','));
        });

        return rows.join('\r\n'); // Windows 호환성을 위해 \r\n 사용
    }

    // 내보내기 옵션 선택
    showExportOptions() {
        const options = [
            'Excel용 CSV (한글 최적화)',
            'UTF-8 텍스트 파일',
            'JSON 형식',
            '취소'
        ];
        
        const choice = prompt(`내보내기 형식을 선택하세요:\n\n${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}\n\n번호를 입력하세요 (1-${options.length}):`);
        
        if (!choice || choice === '4') return;
        
        const choiceNum = parseInt(choice);
        switch (choiceNum) {
            case 1:
                this.exportData(); // 기본 Excel CSV
                break;
            case 2:
                this.exportAsText();
                break;
            case 3:
                this.exportAsJSON();
                break;
            default:
                alert('올바른 번호를 입력하세요.');
        }
    }

    // 텍스트 파일로 내보내기
    exportAsText() {
        if (this.data.length === 0) {
            alert('내보낼 데이터가 없습니다.');
            return;
        }

        let content = `전화번호 수집 데이터\n`;
        content += `생성일시: ${new Date().toLocaleString('ko-KR')}\n`;
        content += `총 ${this.data.length}개 데이터\n\n`;
        content += `${'='.repeat(50)}\n\n`;

        this.data.forEach((item, index) => {
            const timestamp = item.created_at || item.timestamp;
            content += `${index + 1}. ${item.name}\n`;
            content += `   전화번호: ${this.formatPhoneNumber(item.phone)}\n`;
            content += `   수집시간: ${new Date(timestamp).toLocaleString('ko-KR')}\n\n`;
        });

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `전화번호_데이터_${new Date().toISOString().split('T')[0]}.txt`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('✅ 텍스트 파일 내보내기 완료');
    }

    // JSON 파일로 내보내기
    exportAsJSON() {
        if (this.data.length === 0) {
            alert('내보낼 데이터가 없습니다.');
            return;
        }

        const exportData = {
            exportDate: new Date().toISOString(),
            totalCount: this.data.length,
            data: this.data.map((item, index) => ({
                순번: index + 1,
                이름: item.name,
                전화번호: this.formatPhoneNumber(item.phone),
                원본전화번호: item.phone,
                수집시간: item.created_at || item.timestamp,
                수집시간_포맷: new Date(item.created_at || item.timestamp).toLocaleString('ko-KR')
            }))
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `전화번호_데이터_${new Date().toISOString().split('T')[0]}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('✅ JSON 파일 내보내기 완료');
    }

    // 데이터 초기화
    async clearData() {
        const confirmMessage = this.useSupabase ? 
            '모든 데이터를 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.\n• Supabase 데이터베이스에서 완전히 삭제됩니다.\n• 로컬 저장소도 함께 초기화됩니다.' :
            '모든 데이터를 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.\n• 로컬 저장소 데이터가 삭제됩니다.';
            
        if (confirm(confirmMessage)) {
            try {
                console.log('🗑️ 데이터 초기화 시작');
                
                // Supabase에서 데이터 삭제
                if (this.useSupabase) {
                    try {
                        const result = await window.supabaseManager.clearAllData();
                        console.log('✅ Supabase 데이터 삭제 완료:', result.message);
                    } catch (error) {
                        console.error('❌ Supabase 데이터 삭제 실패:', error);
                        
                        // 더 구체적인 오류 메시지 제공
                        let errorMessage = 'Supabase 데이터 삭제에 실패했습니다.\n\n';
                        
                        if (error.message.includes('permission')) {
                            errorMessage += '권한 오류: 데이터베이스 삭제 권한이 없습니다.\n';
                        } else if (error.message.includes('network')) {
                            errorMessage += '네트워크 오류: 인터넷 연결을 확인하세요.\n';
                        } else {
                            errorMessage += `오류: ${error.message}\n`;
                        }
                        
                        errorMessage += '\n로컬 데이터만 삭제하시겠습니까?';
                        
                        const continueWithLocal = confirm(errorMessage);
                        if (!continueWithLocal) {
                            return;
                        }
                    }
                }
                
                // 로컬 데이터 초기화
                this.data = [];
                this.saveData();
                await this.updateStats();
                this.renderTable();
                
                console.log('✅ 데이터 초기화 완료');
                alert('데이터가 성공적으로 초기화되었습니다.');
                
            } catch (error) {
                console.error('❌ 데이터 초기화 실패:', error);
                alert('데이터 초기화 중 오류가 발생했습니다: ' + error.message);
            }
        }
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        // URL 복사 버튼
        document.getElementById('copyUrlBtn').addEventListener('click', () => {
            const urlInput = document.getElementById('mobileUrl');
            urlInput.select();
            urlInput.setSelectionRange(0, 99999);
            
            try {
                document.execCommand('copy');
                alert('URL이 클립보드에 복사되었습니다.');
            } catch (err) {
                // Fallback for modern browsers
                navigator.clipboard.writeText(urlInput.value).then(() => {
                    alert('URL이 클립보드에 복사되었습니다.');
                });
            }
        });

        // 데이터 내보내기 버튼
        document.getElementById('exportBtn').addEventListener('click', (e) => {
            // Shift 키를 누르고 클릭하면 다른 형식 옵션 표시
            if (e.shiftKey) {
                this.showExportOptions();
            } else {
                this.exportData();
            }
        });

        // 데이터 초기화 버튼
        document.getElementById('clearBtn').addEventListener('click', async () => {
            await this.clearData();
        });

        // QR코드 새로고침 버튼
        document.getElementById('refreshQrBtn').addEventListener('click', () => {
            if (typeof generateQR === 'function') {
                generateQR();
            } else {
                location.reload();
            }
        });

        // QR코드 클릭 이벤트 (레이아웃 토글)
        this.setupQrClickToggle();

        // 키보드 단축키
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'e':
                        e.preventDefault();
                        this.exportData();
                        break;
                    case 'r':
                        e.preventDefault();
                        this.clearData();
                        break;
                }
            }
        });
    }

    // QR코드 클릭 토글 설정
    setupQrClickToggle() {
        const qrSection = document.querySelector('.qr-section');
        const qrContainer = document.querySelector('.qr-container');
        const container = document.querySelector('.container');
        
        if (qrSection && qrContainer && container) {
            // QR 섹션 클릭 이벤트
            qrSection.addEventListener('click', (e) => {
                // QR 컨테이너나 그 자식 요소를 클릭한 경우에만 토글
                if (e.target.closest('.qr-container') || e.target === qrSection) {
                    this.toggleQrLayout(container);
                }
            });
            
            // ESC 키로 레이아웃 복원
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && container.classList.contains('qr-expanded')) {
                    this.toggleQrLayout(container);
                }
            });
        }
    }

    // QR 레이아웃 토글
    toggleQrLayout(container) {
        const isExpanded = container.classList.contains('qr-expanded');
        
        if (isExpanded) {
            // 축소 (원래 상태)
            container.classList.remove('qr-expanded');
            console.log('📱 QR 레이아웃 축소');
            // QR코드 크기 축소
            this.adjustQrSize(false);
        } else {
            // 확장
            container.classList.add('qr-expanded');
            console.log('📱 QR 레이아웃 확장');
            // QR코드 크기 확대
            this.adjustQrSize(true);
        }
    }

    // QR코드 크기 조정
    adjustQrSize(isExpanded) {
        const qrImage = document.getElementById('qrImage');
        const qrCodeElement = document.getElementById('qrcode');
        
        if (qrImage && qrImage.src) {
            // 현재 URL에서 크기 파라미터 변경
            let newSrc = qrImage.src;
            if (isExpanded) {
                // 확장 시 더 큰 크기로 변경
                newSrc = newSrc.replace(/chs=\d+x\d+/, 'chs=400x400');
                newSrc = newSrc.replace(/size=\d+x\d+/, 'size=400x400');
                newSrc = newSrc.replace(/size=\d+/, 'size=400');
            } else {
                // 축소 시 원래 크기로 변경
                newSrc = newSrc.replace(/chs=\d+x\d+/, 'chs=300x300');
                newSrc = newSrc.replace(/size=\d+x\d+/, 'size=300x300');
                newSrc = newSrc.replace(/size=\d+/, 'size=300');
            }
            
            if (newSrc !== qrImage.src) {
                qrImage.src = newSrc;
                console.log('🔄 QR코드 이미지 크기 조정:', isExpanded ? '확대' : '축소');
            }
        }
        
        // QRCode.js로 생성된 QR코드도 크기 조정
        const qrDisplay = document.getElementById('qrDisplay');
        if (qrDisplay) {
            const canvas = qrDisplay.querySelector('canvas');
            if (canvas) {
                if (isExpanded) {
                    canvas.style.width = '400px';
                    canvas.style.height = '400px';
                    canvas.width = 400;
                    canvas.height = 400;
                } else {
                    canvas.style.width = '250px';
                    canvas.style.height = '250px';
                    canvas.width = 250;
                    canvas.height = 250;
                }
                console.log('🔄 QRCode.js 캔버스 크기 조정:', isExpanded ? '확대' : '축소');
            }
        }
    }

    // 실시간 동기화 설정
    setupRealTimeSync() {
        console.log('실시간 동기화 설정 시작');
        
        if (this.useSupabase) {
            this.setupSupabaseRealtime();
        } else {
            this.setupLocalStorageSync();
        }
        
        // 강제로 데이터 새로고침하는 함수 추가
        window.refreshAdminData = async () => {
            console.log('🔄 수동 데이터 새로고침 시작');
            try {
                await this.loadInitialData();
                await this.updateStats();
                this.renderTable();
                console.log('✅ 새로고침 완료, 현재 데이터 수:', this.data.length);
                
                // 새로고침 완료 알림 (새 데이터가 있을 때만)
                if (this.data.length > 0) {
                    this.showRefreshNotification();
                }
            } catch (error) {
                console.error('❌ 새로고침 실패:', error);
                alert('데이터 새로고침에 실패했습니다: ' + error.message);
            }
        };
    }
    
    // Supabase 실시간 구독 설정
    setupSupabaseRealtime() {
        console.log('🔥 Supabase 실시간 구독 설정');
        
        this.subscription = window.supabaseManager.setupRealtimeSubscription((newData) => {
            console.log('🚀 실시간 새 데이터 수신:', newData);
            console.log('📌 현재 선택된 세션 ID:', this.currentSessionId);
            console.log('📌 새 데이터의 세션 ID:', newData.session_id);
            
            // 세션 필터링: 현재 선택된 세션과 일치하는 데이터만 추가
            if (this.currentSessionId) {
                // 특정 세션 선택 중
                if (newData.session_id === this.currentSessionId) {
                    console.log('✅ 선택된 세션의 데이터 - 추가함');
                    this.data.unshift(newData);
                    
                    // UI 업데이트
                    this.updateStats();
                    this.renderTable();
                    
                    // 세션 카운트 증가
                    this.incrementSessionCount(this.currentSessionId);
                    
                    // 알림 표시
                    this.showNewDataNotification([newData]);
                } else {
                    console.log('⏭️ 다른 세션의 데이터 - 무시하지만 카운트는 업데이트');
                    // 다른 세션의 데이터도 카운트는 업데이트
                    if (newData.session_id) {
                        this.incrementSessionCount(newData.session_id);
                    }
                }
            } else {
                // 전체 데이터 보기 모드
                console.log('✅ 전체 데이터 모드 - 추가함');
                this.data.unshift(newData);
                
                // UI 업데이트
                this.updateStats();
                this.renderTable();
                
                // 세션 카운트 증가
                if (newData.session_id) {
                    this.incrementSessionCount(newData.session_id);
                }
                
                // 알림 표시
                this.showNewDataNotification([newData]);
            }
        });
        
        if (this.subscription) {
            console.log('✅ Supabase 실시간 구독 성공');
        } else {
            console.warn('❌ Supabase 실시간 구독 실패');
        }
    }
    
    // localStorage 동기화 (Supabase 미사용 시)
    setupLocalStorageSync() {
        console.log('📦 localStorage 동기화 설정');
        
        // localStorage 변경 감지
        window.addEventListener('storage', (e) => {
            console.log('Storage 이벤트 감지:', e.key, e.newValue);
            if (e.key === 'phoneData') {
                console.log('phoneData 변경 감지, 데이터 업데이트');
                this.data = JSON.parse(e.newValue) || [];
                this.updateStats();
                this.renderTable();
                this.showNewDataNotification();
            }
        });

        // 주기적 체크 (500ms마다)
        this.syncInterval = setInterval(() => {
            const storedData = JSON.parse(localStorage.getItem('phoneData')) || [];
            if (storedData.length !== this.data.length) {
                console.log('🔄 localStorage 데이터 변경 감지!');
                console.log('이전 데이터:', this.data.length, '→ 현재 데이터:', storedData.length);
                
                const newItems = storedData.slice(this.data.length);
                this.data = storedData;
                this.updateStats();
                this.renderTable();
                
                if (newItems.length > 0) {
                    this.showNewDataNotification(newItems);
                }
            }
        }, 500);
        
        // postMessage 이벤트 리스너
        window.addEventListener('message', (event) => {
            console.log('📱 모바일 앱에서 메시지 수신:', event.data);
            if (event.data.type === 'phoneData') {
                console.log('새 전화번호 데이터 수신, 즉시 새로고침');
                setTimeout(() => {
                    this.loadFromLocalStorage();
                    this.updateStats();
                    this.renderTable();
                    this.showNewDataNotification([{
                        name: event.data.name,
                        phone: event.data.phone
                    }]);
                }, 100);
            }
        });
    }
    
    // 새 데이터 알림 표시
    showNewDataNotification(newItems = []) {
        // 기존 알림 제거
        const existingNotif = document.getElementById('newDataNotification');
        if (existingNotif) {
            existingNotif.remove();
        }
        
        // 새 알림 생성
        const notification = document.createElement('div');
        notification.id = 'newDataNotification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #10b981;
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            font-weight: 600;
            z-index: 1000;
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
            animation: slideDown 0.3s ease;
        `;
        
        if (newItems.length > 0) {
            notification.innerHTML = `
                📱 새로운 전화번호 접수!<br>
                <small style="font-size: 12px; opacity: 0.9;">
                    ${newItems.map(item => `${item.name}: ${this.formatPhoneNumber(item.phone)}`).join(', ')}
                </small>
            `;
        } else {
            notification.textContent = '📱 새로운 데이터가 접수되었습니다!';
        }
        
        document.body.appendChild(notification);
        
        // 5초 후 제거
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideUp 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
        
        // CSS 애니메이션 추가
        if (!document.getElementById('notificationStyles')) {
            const style = document.createElement('style');
            style.id = 'notificationStyles';
            style.textContent = `
                @keyframes slideDown {
                    from {
                        transform: translateX(-50%) translateY(-100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(-50%) translateY(0);
                        opacity: 1;
                    }
                }
                @keyframes slideUp {
                    from {
                        transform: translateX(-50%) translateY(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(-50%) translateY(-100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // 새로고침 완료 알림 표시
    showRefreshNotification() {
        // 기존 알림 제거
        const existingNotif = document.getElementById('refreshNotification');
        if (existingNotif) {
            existingNotif.remove();
        }
        
        // 새 알림 생성
        const notification = document.createElement('div');
        notification.id = 'refreshNotification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #3b82f6;
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            font-weight: 600;
            z-index: 1000;
            box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
            animation: slideDown 0.3s ease;
        `;
        
        notification.innerHTML = `
            🔄 데이터 새로고침 완료!<br>
            <small style="font-size: 12px; opacity: 0.9;">
                총 ${this.data.length}개의 데이터를 불러왔습니다
            </small>
        `;
        
        document.body.appendChild(notification);
        
        // 3초 후 제거
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideUp 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 3000);
    }

    // 모바일 앱에서 데이터 수신 (URL 파라미터 또는 postMessage)
    receiveDataFromMobile() {
        // URL 파라미터에서 데이터 확인
        const urlParams = new URLSearchParams(window.location.search);
        const name = urlParams.get('name');
        const phone = urlParams.get('phone');

        if (name && phone) {
            this.addData(name, phone);
            
            // URL에서 파라미터 제거
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        }

        // postMessage로 데이터 수신
        window.addEventListener('message', (event) => {
            if (event.data.type === 'phoneData' && event.data.name && event.data.phone) {
                this.addData(event.data.name, event.data.phone);
            }
        });
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 페이지 로드 완료, 초기화 시작');
    
    // Supabase 매니저가 로드될 때까지 대기
    const waitForSupabaseManager = () => {
        return new Promise((resolve) => {
            const checkManager = () => {
                if (window.supabaseManager) {
                    console.log('✅ Supabase Manager 로드 완료');
                    resolve();
                } else {
                    console.log('⏳ Supabase Manager 로드 대기 중...');
                    setTimeout(checkManager, 100);
                }
            };
            checkManager();
        });
    };
    
    // Supabase 매니저 로드 대기
    await waitForSupabaseManager();
    
    // PhoneDataManager 초기화
    console.log('📱 PhoneDataManager 초기화 시작');
    const phoneManager = new PhoneDataManager();
    
    // 초기화 완료 대기
    if (phoneManager.init && typeof phoneManager.init === 'function') {
        await phoneManager.init();
    }
    
    // 모바일에서 전송된 데이터 확인
    phoneManager.receiveDataFromMobile();
    
    // 전역 접근을 위해 window 객체에 저장
    window.phoneManager = phoneManager;
    
    console.log('🎉 초기화 완료');
});

// 서비스 워커 등록 (PWA 지원) - 로컬에서는 비활성화
if ('serviceWorker' in navigator && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('✅ Service Worker 등록 성공:', registration.scope);
                
                registration.addEventListener('updatefound', () => {
                    console.log('🔄 새로운 Service Worker 발견');
                });
            })
            .catch((registrationError) => {
                console.warn('❌ Service Worker 등록 실패:', registrationError);
            });
    });
} else {
    console.log('🏠 로컬 환경에서는 Service Worker를 사용하지 않습니다');
}
