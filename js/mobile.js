// 모바일 앱 JavaScript
class MobilePhoneForm {
    constructor() {
        this.form = document.getElementById('phoneForm');
        this.nameInput = document.getElementById('name');
        this.phoneInput = document.getElementById('phone');
        this.submitBtn = document.querySelector('.submit-btn');
        this.successMessage = document.getElementById('successMessage');
        this.errorMessage = document.getElementById('errorMessage');
        this.useSupabase = false;
        
        this.init();
    }

    async init() {
        // Supabase 설정 확인
        await this.checkSupabaseConfig();
        
        this.setupEventListeners();
        this.setupInputValidation();
        this.setupPhoneFormatting();
        this.checkForReturningUser();
    }
    
    // Supabase 설정 확인
    async checkSupabaseConfig() {
        if (window.supabaseManager && window.supabaseManager.isSupabaseConfigured()) {
            this.useSupabase = true;
            console.log('✅ 모바일 앱: Supabase 모드로 실행');
            
            // 연결 테스트
            const testResult = await window.supabaseManager.testConnection();
            if (testResult.success) {
                console.log('🔗 모바일 앱: Supabase 연결 성공');
            } else {
                console.error('❌ 모바일 앱: Supabase 연결 실패:', testResult.message);
                this.useSupabase = false;
            }
        } else {
            this.useSupabase = false;
            console.log('📦 모바일 앱: localStorage 모드로 실행');
        }
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // 입력 필드 포커스 시 에러 메시지 숨기기
        [this.nameInput, this.phoneInput].forEach(input => {
            input.addEventListener('focus', () => {
                this.hideMessages();
                input.classList.remove('invalid');
            });
        });

        // 전화번호 입력 시 실시간 포맷팅
        this.phoneInput.addEventListener('input', (e) => {
            this.formatPhoneInput(e.target);
        });

        // 엔터키로 폼 제출
        this.form.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSubmit();
            }
        });
    }

    // 입력 유효성 검사 설정
    setupInputValidation() {
        // 이름 유효성 검사
        this.nameInput.addEventListener('blur', () => {
            this.validateName();
        });

        // 전화번호 유효성 검사
        this.phoneInput.addEventListener('blur', () => {
            this.validatePhone();
        });
    }

    // 전화번호 포맷팅 설정
    setupPhoneFormatting() {
        this.phoneInput.addEventListener('paste', (e) => {
            setTimeout(() => {
                this.formatPhoneInput(e.target);
            }, 10);
        });
    }

    // 이름 유효성 검사
    validateName() {
        const name = this.nameInput.value.trim();
        const isValid = name.length >= 2 && name.length <= 20 && /^[가-힣a-zA-Z\s]+$/.test(name);
        
        this.nameInput.classList.toggle('valid', isValid);
        this.nameInput.classList.toggle('invalid', !isValid && name.length > 0);
        
        return isValid;
    }

    // 전화번호 유효성 검사
    validatePhone() {
        const phone = this.phoneInput.value.replace(/\D/g, '');
        const isValid = /^01[016789]\d{7,8}$/.test(phone);
        
        this.phoneInput.classList.toggle('valid', isValid);
        this.phoneInput.classList.toggle('invalid', !isValid && phone.length > 0);
        
        return isValid;
    }

    // 전화번호 입력 포맷팅
    formatPhoneInput(input) {
        let value = input.value.replace(/\D/g, '');
        
        if (value.length >= 11) {
            value = value.slice(0, 11);
        }
        
        if (value.length >= 7) {
            value = value.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
        } else if (value.length >= 3) {
            value = value.replace(/(\d{3})(\d{0,4})/, '$1-$2');
        }
        
        input.value = value;
    }

    // 폼 제출 처리
    async handleSubmit() {
        console.log('폼 제출 시작');
        
        if (!this.validateForm()) {
            console.log('폼 유효성 검사 실패');
            return;
        }

        console.log('폼 유효성 검사 통과');
        this.setLoading(true);
        this.hideMessages();

        try {
            const formData = {
                name: this.nameInput.value.trim(),
                phone: this.phoneInput.value.replace(/\D/g, '')
            };

            console.log('전송할 데이터:', formData);

            // 데이터 전송
            await this.sendData(formData);
            
            // 성공 처리
            console.log('데이터 전송 성공, 성공 메시지 표시');
            this.showSuccess();
            this.clearForm();
            
            // 마지막 제출 시간 저장
            localStorage.setItem('lastPhoneSubmission', new Date().toISOString());
            
            // 3초 후 폼 다시 표시
            setTimeout(() => {
                this.hideMessages();
            }, 3000);

        } catch (error) {
            console.error('데이터 전송 실패:', error);
            
            // 에러 타입에 따른 구체적인 메시지
            let errorMessage = '데이터 전송에 실패했습니다.';
            
            if (error.message.includes('localStorage')) {
                errorMessage = '데이터 저장에 실패했습니다. 브라우저 설정을 확인해주세요.';
            } else if (error.message.includes('네트워크')) {
                errorMessage = '네트워크 연결을 확인하고 다시 시도해주세요.';
            } else if (error.message.includes('서버')) {
                errorMessage = '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.';
            } else {
                errorMessage = '알 수 없는 오류가 발생했습니다. 다시 시도해주세요.';
            }
            
            this.showError(errorMessage);
        } finally {
            this.setLoading(false);
        }
    }

    // 폼 유효성 검사
    validateForm() {
        const isNameValid = this.validateName();
        const isPhoneValid = this.validatePhone();

        if (!isNameValid) {
            this.showError('올바른 이름을 입력해주세요. (2-20자, 한글/영문)');
            this.nameInput.focus();
            return false;
        }

        if (!isPhoneValid) {
            this.showError('올바른 전화번호를 입력해주세요. (010-1234-5678 형식)');
            this.phoneInput.focus();
            return false;
        }

        return true;
    }

    // 데이터 전송
    async sendData(data) {
        try {
            console.log('데이터 전송 시작:', data);
            
            if (this.useSupabase) {
                // Supabase에 데이터 저장
                const result = await window.supabaseManager.insertPhoneNumber(
                    data.name, 
                    data.phone,
                    {
                        userAgent: navigator.userAgent,
                        timestamp: new Date().toISOString()
                    }
                );
                console.log('✅ Supabase 저장 완료:', result);
                
                // 로컬 백업도 저장
                this.saveToLocalStorage(data);
                
            } else {
                // localStorage 모드
                await this.saveToLocalStorage(data);
                console.log('📦 localStorage 저장 완료');
                
                // 관리자 페이지에 알림
                this.notifyAdminPage(data);
            }
            
        } catch (error) {
            console.error('sendData 에러:', error);
            
            // Supabase 실패 시 localStorage로 fallback
            if (this.useSupabase) {
                console.log('Supabase 실패, localStorage로 fallback');
                try {
                    await this.saveToLocalStorage(data);
                    this.notifyAdminPage(data);
                    console.log('📦 localStorage fallback 성공');
                } catch (fallbackError) {
                    console.error('localStorage fallback도 실패:', fallbackError);
                    throw fallbackError;
                }
            } else {
                throw error;
            }
        }
    }
    
    // localStorage에 저장
    async saveToLocalStorage(data) {
        const existingData = JSON.parse(localStorage.getItem('phoneData')) || [];
        
        const newData = {
            id: Date.now(),
            name: data.name,
            phone: data.phone,
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString() // Supabase 호환
        };

        existingData.push(newData);
        localStorage.setItem('phoneData', JSON.stringify(existingData));
        
        const savedData = JSON.parse(localStorage.getItem('phoneData')) || [];
        console.log('저장 후 전체 데이터 수:', savedData.length);
        console.log('방금 저장한 데이터:', newData);
        
        return newData;
    }

    // 서버 요청 시뮬레이션
    simulateServerRequest(data) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // 항상 성공하도록 수정 (테스트용)
                console.log('데이터 전송 성공:', data);
                resolve(data);
            }, 500 + Math.random() * 500); // 0.5~1초 딜레이
        });
    }

    // 관리자 페이지에 알림
    notifyAdminPage(data) {
        // 같은 도메인의 다른 탭에 메시지 전송
        if (window.opener) {
            window.opener.postMessage({
                type: 'phoneData',
                name: data.name,
                phone: data.phone
            }, window.location.origin);
        }

        // localStorage 변경 이벤트 발생
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'phoneData',
            newValue: localStorage.getItem('phoneData')
        }));
    }

    // 로딩 상태 설정
    setLoading(loading) {
        this.submitBtn.disabled = loading;
        this.submitBtn.classList.toggle('loading', loading);
        
        if (loading) {
            this.submitBtn.querySelector('.btn-text').style.display = 'none';
            this.submitBtn.querySelector('.btn-loading').style.display = 'inline';
        } else {
            this.submitBtn.querySelector('.btn-text').style.display = 'inline';
            this.submitBtn.querySelector('.btn-loading').style.display = 'none';
        }
    }

    // 성공 메시지 표시
    showSuccess() {
        this.successMessage.style.display = 'block';
        this.errorMessage.style.display = 'none';
        
        // 성공 사운드 재생 (지원하는 경우)
        this.playSuccessSound();
    }

    // 에러 메시지 표시
    showError(message) {
        this.errorMessage.style.display = 'block';
        this.successMessage.style.display = 'none';
        
        const errorText = document.getElementById('errorText');
        errorText.innerHTML = `
            <p style="margin-bottom: 15px;">${message}</p>
            <button onclick="location.reload()" style="
                padding: 8px 16px; 
                background: #ef4444; 
                color: white; 
                border: none; 
                border-radius: 6px; 
                cursor: pointer; 
                font-size: 14px;
                margin-right: 10px;
            ">페이지 새로고침</button>
            <button onclick="window.mobileForm.hideMessages()" style="
                padding: 8px 16px; 
                background: #6b7280; 
                color: white; 
                border: none; 
                border-radius: 6px; 
                cursor: pointer; 
                font-size: 14px;
            ">다시 시도</button>
        `;
    }

    // 메시지 숨기기
    hideMessages() {
        this.successMessage.style.display = 'none';
        this.errorMessage.style.display = 'none';
    }

    // 폼 초기화
    clearForm() {
        this.form.reset();
        [this.nameInput, this.phoneInput].forEach(input => {
            input.classList.remove('valid', 'invalid');
        });
    }

    // 성공 사운드 재생
    playSuccessSound() {
        try {
            // Web Audio API를 사용한 간단한 성공 사운드
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            // 사운드 재생 실패 시 무시
            console.log('사운드 재생 실패:', error);
        }
    }

    // 재방문 사용자 확인
    checkForReturningUser() {
        const lastSubmission = localStorage.getItem('lastPhoneSubmission');
        if (lastSubmission) {
            const lastDate = new Date(lastSubmission);
            const now = new Date();
            const diffHours = (now - lastDate) / (1000 * 60 * 60);
            
            if (diffHours < 24) {
                // 24시간 내 재방문 시 안내 메시지
                this.showInfo('이미 정보를 제출하셨습니다. 추가 정보가 필요하시면 다시 제출해주세요.');
            }
        }
    }

    // 정보 메시지 표시
    showInfo(message) {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'info-message';
        infoDiv.style.cssText = `
            background: #dbeafe;
            color: #1e40af;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
            font-size: 0.9rem;
        `;
        infoDiv.textContent = message;
        
        this.form.parentNode.insertBefore(infoDiv, this.form);
        
        setTimeout(() => {
            infoDiv.remove();
        }, 5000);
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    const mobileForm = new MobilePhoneForm();
    
    // 전역 접근을 위해 window 객체에 저장
    window.mobileForm = mobileForm;
});

// PWA 설치 프롬프트
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // 설치 버튼 표시 (선택사항)
    const installBtn = document.createElement('button');
    installBtn.textContent = '앱 설치';
    installBtn.className = 'install-btn';
    installBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #3b82f6;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 8px;
        font-size: 0.9rem;
        cursor: pointer;
        z-index: 1000;
    `;
    
    installBtn.addEventListener('click', () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('PWA 설치됨');
            }
            deferredPrompt = null;
            installBtn.remove();
        });
    });
    
    document.body.appendChild(installBtn);
});

// PWA 설치 완료
window.addEventListener('appinstalled', (evt) => {
    console.log('PWA가 설치되었습니다');
});

// 오프라인 지원
window.addEventListener('online', () => {
    console.log('온라인 상태로 복구됨');
});

window.addEventListener('offline', () => {
    console.log('오프라인 상태');
});

// 서비스 워커 등록 - 로컬에서는 비활성화
if ('serviceWorker' in navigator && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('✅ Service Worker 등록 성공:', registration.scope);
            })
            .catch((registrationError) => {
                console.warn('❌ Service Worker 등록 실패:', registrationError);
            });
    });
} else {
    console.log('🏠 로컬 환경에서는 Service Worker를 사용하지 않습니다');
}
