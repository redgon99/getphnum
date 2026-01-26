// Supabase 설정
class SupabaseManager {
    constructor() {
        // Supabase 프로젝트 설정
        this.supabaseUrl = 'https://ainftwifvclgiookzrwm.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpbmZ0d2lmdmNsZ2lvb2t6cndtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyMTQyOTMsImV4cCI6MjA3MDc5MDI5M30.fHWOF1nNcen0iehaRh7Z2EWcOufYeeKGT7FH3UHO5XA';

        // 설정 완료 상태
        this.isConfigured = true;

        if (this.isConfigured) {
            // Supabase 클라이언트 초기화
            this.supabase = supabase.createClient(this.supabaseUrl, this.supabaseKey);
            console.log('✅ Supabase 클라이언트 초기화 완료');
        } else {
            console.warn('⚠️ Supabase 설정이 필요합니다. localStorage 모드로 실행됩니다.');
            this.supabase = null;
        }

        this.tableName = 'getphnum';
    }

    // Supabase 설정 확인
    isSupabaseConfigured() {
        return this.isConfigured && this.supabase;
    }

    // 테이블 생성 SQL (Supabase 대시보드에서 실행)
    getCreateTableSQL() {
        return `
-- 전화번호 수집 테이블 생성
CREATE TABLE IF NOT EXISTS phone_numbers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- 실시간 기능 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE phone_numbers;

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_phone_numbers_created_at ON phone_numbers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_phone ON phone_numbers(phone);

-- Row Level Security (RLS) 설정
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기와 쓰기 가능하도록 정책 설정 (필요에 따라 수정)
CREATE POLICY "Allow public read access" ON phone_numbers FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON phone_numbers FOR INSERT WITH CHECK (true);
        `;
    }

    // 전화번호 데이터 삽입
    async insertPhoneNumber(name, phone, additionalData = {}) {
        if (!this.isSupabaseConfigured()) {
            throw new Error('Supabase가 설정되지 않았습니다.');
        }

        try {
            const cleanPhone = phone.replace(/\D/g, ''); // 숫자만 저장

            // 중복 전화번호 체크 (선택사항)
            if (additionalData.checkDuplicate !== false) {
                const isDuplicate = await this.checkDuplicatePhone(cleanPhone);
                if (isDuplicate) {
                    console.warn('⚠️ 중복된 전화번호:', cleanPhone);
                    // 중복이어도 저장하되 로그만 남김
                }
            }

            const data = {
                name: name.trim(),
                phone: cleanPhone,
                ip_address: additionalData.ip || null,
                user_agent: additionalData.userAgent || navigator.userAgent
            };

            const { data: result, error } = await this.supabase
                .from(this.tableName)
                .insert([data])
                .select();

            if (error) {
                console.error('Supabase 삽입 오류:', error);
                throw error;
            }

            console.log('✅ Supabase에 데이터 저장 성공:', result[0]);
            return result[0];

        } catch (error) {
            console.error('전화번호 저장 실패:', error);
            throw error;
        }
    }

    // 중복 전화번호 체크
    async checkDuplicatePhone(phone) {
        if (!this.isSupabaseConfigured()) {
            return false;
        }

        try {
            const { data, error } = await this.supabase
                .rpc('check_duplicate_phone', { phone_number: phone });

            if (error) throw error;
            return data || false;

        } catch (error) {
            console.error('중복 체크 실패:', error);
            return false;
        }
    }

    // 전화번호 데이터 조회 (포맷된 뷰 사용)
    async getPhoneNumbers(limit = 100) {
        if (!this.isSupabaseConfigured()) {
            throw new Error('Supabase가 설정되지 않았습니다.');
        }

        try {
            // 포맷된 뷰에서 조회
            const { data, error } = await this.supabase
                .from('getphnum_formatted')
                .select('*')
                .limit(limit);

            if (error) {
                console.error('Supabase 조회 오류:', error);
                throw error;
            }

            console.log('📊 Supabase에서 데이터 조회 완료:', data.length, '개');
            return data;

        } catch (error) {
            console.error('전화번호 조회 실패:', error);
            // Fallback: 원본 테이블에서 조회
            return await this.getPhoneNumbersBasic(limit);
        }
    }

    // 기본 데이터 조회 (Fallback)
    async getPhoneNumbersBasic(limit = 100) {
        try {
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            console.log('📊 기본 테이블에서 데이터 조회 완료:', data.length, '개');
            return data;

        } catch (error) {
            console.error('기본 전화번호 조회 실패:', error);
            throw error;
        }
    }

    // 실시간 구독 설정
    setupRealtimeSubscription(callback) {
        if (!this.isSupabaseConfigured()) {
            console.warn('Supabase가 설정되지 않아 실시간 구독을 건너뜁니다.');
            return null;
        }

        try {
            const subscription = this.supabase
                .channel('getphnum_changes')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: this.tableName
                    },
                    (payload) => {
                        console.log('🔥 실시간 데이터 수신:', payload.new);
                        if (callback) {
                            callback(payload.new);
                        }
                    }
                )
                .subscribe((status) => {
                    console.log('📡 실시간 구독 상태:', status);
                    if (status === 'SUBSCRIBED') {
                        console.log('✅ getphnum 테이블 실시간 구독 성공');
                    }
                });

            return subscription;

        } catch (error) {
            console.error('실시간 구독 설정 실패:', error);
            return null;
        }
    }

    // 구독 해제
    unsubscribe(subscription) {
        if (subscription && this.isSupabaseConfigured()) {
            this.supabase.removeChannel(subscription);
            console.log('📡 실시간 구독 해제');
        }
    }

    // 통계 조회 (최적화된 함수 사용)
    async getStats() {
        if (!this.isSupabaseConfigured()) {
            throw new Error('Supabase가 설정되지 않았습니다.');
        }

        try {
            // 통계 함수 호출
            const { data, error } = await this.supabase
                .rpc('get_getphnum_stats');

            if (error) throw error;

            const stats = data[0];
            return {
                total: parseInt(stats.total_count) || 0,
                today: parseInt(stats.today_count) || 0,
                week: parseInt(stats.this_week_count) || 0,
                month: parseInt(stats.this_month_count) || 0
            };

        } catch (error) {
            console.error('통계 조회 실패:', error);
            // Fallback: 기본 쿼리 사용
            return await this.getStatsBasic();
        }
    }

    // 기본 통계 조회 (Fallback)
    async getStatsBasic() {
        try {
            // 총 개수
            const { count: totalCount, error: totalError } = await this.supabase
                .from(this.tableName)
                .select('*', { count: 'exact', head: true });

            if (totalError) throw totalError;

            // 오늘 개수
            const today = new Date().toISOString().split('T')[0];
            const { count: todayCount, error: todayError } = await this.supabase
                .from(this.tableName)
                .select('*', { count: 'exact', head: true })
                .gte('created_at', today);

            if (todayError) throw todayError;

            return {
                total: totalCount || 0,
                today: todayCount || 0,
                week: 0,
                month: 0
            };

        } catch (error) {
            console.error('기본 통계 조회 실패:', error);
            throw error;
        }
    }

    // 모든 데이터 삭제
    async clearAllData() {
        if (!this.isSupabaseConfigured()) {
            throw new Error('Supabase가 설정되지 않았습니다.');
        }

        try {
            console.log('🗑️ Supabase에서 모든 데이터 삭제 시작');

            // 먼저 현재 데이터 수 확인
            const { count: beforeCount } = await this.supabase
                .from(this.tableName)
                .select('*', { count: 'exact', head: true });

            console.log('📊 삭제 전 데이터 수:', beforeCount);

            if (beforeCount === 0) {
                console.log('📭 삭제할 데이터가 없습니다');
                return { success: true, message: '삭제할 데이터가 없습니다.' };
            }

            // 방법 1: 일괄 삭제 시도
            let { error, count } = await this.supabase
                .from(this.tableName)
                .delete({ count: 'exact' })
                .gt('id', 0); // id가 0보다 큰 모든 레코드

            // 방법 1이 실패하면 방법 2: 개별 삭제 시도
            if (error) {
                console.warn('일괄 삭제 실패, 개별 삭제 시도:', error.message);

                // 모든 레코드 조회
                const { data: allData, error: selectError } = await this.supabase
                    .from(this.tableName)
                    .select('id');

                if (selectError) {
                    console.error('조회 오류:', selectError);
                    throw selectError;
                }

                console.log(`📋 개별 삭제할 레코드 수: ${allData.length}`);

                let deletedCount = 0;
                let lastError = null;

                // 각 레코드를 개별적으로 삭제
                for (const row of allData) {
                    const { error: deleteError } = await this.supabase
                        .from(this.tableName)
                        .delete()
                        .eq('id', row.id);

                    if (deleteError) {
                        console.error(`❌ ID ${row.id} 삭제 실패:`, deleteError);
                        lastError = deleteError;
                    } else {
                        deletedCount++;
                        console.log(`✅ ID ${row.id} 삭제 성공`);
                    }
                }

                if (lastError && deletedCount === 0) {
                    throw lastError;
                }

                count = deletedCount;
                error = null; // 개별 삭제로 성공
            }

            if (error) {
                console.error('Supabase 데이터 삭제 오류:', error);
                console.error('오류 세부사항:', JSON.stringify(error, null, 2));
                throw error;
            }

            // 삭제 후 데이터 수 확인
            const { count: afterCount } = await this.supabase
                .from(this.tableName)
                .select('*', { count: 'exact', head: true });

            console.log('✅ Supabase에서 데이터 삭제 완료');
            console.log('📊 삭제된 행 수:', count);
            console.log('📊 삭제 후 남은 데이터 수:', afterCount);

            // 정말로 모든 데이터가 삭제되었는지 확인
            if (afterCount > 0) {
                console.warn(`⚠️ 완전 삭제되지 않음: ${afterCount}개 데이터가 남아있음`);

                // 마지막 시도: 남은 데이터들을 개별적으로 삭제
                console.log('🔧 마지막 시도: 남은 데이터 개별 삭제');
                const { data: remainingData, error: remainingError } = await this.supabase
                    .from(this.tableName)
                    .select('id');

                if (!remainingError && remainingData.length > 0) {
                    let finalDeletedCount = 0;
                    for (const row of remainingData) {
                        const { error: finalDeleteError } = await this.supabase
                            .from(this.tableName)
                            .delete()
                            .eq('id', row.id);

                        if (!finalDeleteError) {
                            finalDeletedCount++;
                        }
                    }

                    if (finalDeletedCount > 0) {
                        console.log(`✅ 추가로 ${finalDeletedCount}개 삭제 완료`);
                        return {
                            success: true,
                            message: `총 ${count + finalDeletedCount}개의 데이터가 삭제되었습니다.`
                        };
                    }
                }
            }

            return {
                success: true,
                message: `총 ${count}개의 데이터가 삭제되었습니다. (남은 데이터: ${afterCount}개)`
            };

        } catch (error) {
            console.error('데이터 삭제 실패:', error);
            console.error('오류 세부사항:', JSON.stringify(error, null, 2));
            throw error;
        }
    }

    // 특정 데이터 삭제
    async deleteData(id) {
        if (!this.isSupabaseConfigured()) {
            throw new Error('Supabase가 설정되지 않았습니다.');
        }

        try {
            const { error } = await this.supabase
                .from(this.tableName)
                .delete()
                .eq('id', id);

            if (error) throw error;

            console.log('✅ 데이터 삭제 완료:', id);
            return { success: true };

        } catch (error) {
            console.error('데이터 삭제 실패:', error);
            throw error;
        }
    }

    // 연결 테스트
    async testConnection() {
        if (!this.isSupabaseConfigured()) {
            return { success: false, message: 'Supabase가 설정되지 않았습니다.' };
        }

        try {
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('count', { count: 'exact', head: true });

            if (error) {
                return { success: false, message: error.message };
            }

            return { success: true, message: 'Supabase 연결 성공' };

        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    // 테스트용 삭제 함수 (디버깅용)
    async testDelete() {
        if (!this.isSupabaseConfigured()) {
            console.error('Supabase가 설정되지 않았습니다.');
            return false;
        }

        try {
            console.log('🧪 테스트용 삭제 시작');

            // 모든 레코드 조회
            const { data: allData, error: selectError } = await this.supabase
                .from(this.tableName)
                .select('id, name, phone');

            if (selectError) {
                console.error('조회 오류:', selectError);
                return false;
            }

            console.log('📋 현재 데이터:', allData);

            if (allData.length === 0) {
                console.log('삭제할 데이터가 없습니다.');
                return true;
            }

            // 하나씩 삭제해보기
            for (const row of allData) {
                console.log(`🗑️ ID ${row.id} 삭제 시도:`, row.name);

                const { error: deleteError } = await this.supabase
                    .from(this.tableName)
                    .delete()
                    .eq('id', row.id);

                if (deleteError) {
                    console.error(`❌ ID ${row.id} 삭제 실패:`, deleteError);
                    return false;
                } else {
                    console.log(`✅ ID ${row.id} 삭제 성공`);
                }
            }

            console.log('🎉 모든 데이터 삭제 완료');
            return true;

        } catch (error) {
            console.error('테스트 삭제 실패:', error);
            return false;
        }
    }

    // ==================== 세션 관리 함수 ====================

    // 세션 생성
    async createSession(sessionData) {
        try {
            const { data, error } = await this.supabase
                .from('collection_sessions')
                .insert([{
                    pin: sessionData.pin,
                    title: sessionData.title,
                    description: sessionData.description,
                    expires_at: sessionData.expires_at
                }])
                .select()
                .single();

            if (error) throw error;

            console.log('✅ 세션 생성 완료:', data);
            return { success: true, data };
        } catch (error) {
            console.error('❌ 세션 생성 오류:', error);
            return { success: false, message: error.message };
        }
    }

    // 모든 세션 조회 (통계 포함)
    async getAllSessions() {
        try {
            const { data, error } = await this.supabase
                .from('session_statistics')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            console.log(`✅ ${data.length}개 세션 조회 완료`);
            return { success: true, data };
        } catch (error) {
            console.error('❌ 세션 조회 오류:', error);
            return { success: false, message: error.message };
        }
    }

    // PIN으로 세션 조회
    async getSessionByPin(pin) {
        try {
            const { data, error } = await this.supabase
                .from('collection_sessions')
                .select('*')
                .eq('pin', pin)
                .eq('is_active', true)
                .single();

            if (error) throw error;

            console.log('✅ 세션 조회 완료:', data);
            return { success: true, data };
        } catch (error) {
            console.error('❌ 세션 조회 오류:', error);
            return { success: false, message: error.message };
        }
    }

    // 세션 ID로 세션 조회
    async getSessionById(sessionId) {
        try {
            const { data, error } = await this.supabase
                .from('session_statistics')
                .select('*')
                .eq('id', sessionId)
                .single();

            if (error) throw error;

            console.log('✅ 세션 조회 완료:', data);
            return { success: true, data };
        } catch (error) {
            console.error('❌ 세션 조회 오류:', error);
            return { success: false, message: error.message };
        }
    }

    // 세션 상태 업데이트
    async updateSessionStatus(sessionId, isActive) {
        try {
            const { data, error } = await this.supabase
                .from('collection_sessions')
                .update({ is_active: isActive })
                .eq('id', sessionId)
                .select()
                .single();

            if (error) throw error;

            console.log('✅ 세션 상태 업데이트 완료:', data);
            return { success: true, data };
        } catch (error) {
            console.error('❌ 세션 상태 업데이트 오류:', error);
            return { success: false, message: error.message };
        }
    }

    // 세션 삭제
    async deleteSession(sessionId) {
        try {
            const { error } = await this.supabase
                .from('collection_sessions')
                .delete()
                .eq('id', sessionId);

            if (error) throw error;

            console.log('✅ 세션 삭제 완료');
            return { success: true };
        } catch (error) {
            console.error('❌ 세션 삭제 오류:', error);
            return { success: false, message: error.message };
        }
    }

    // 세션별 데이터 조회
    async getDataBySession(sessionId) {
        try {
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            console.log(`✅ 세션 ${sessionId}의 ${data.length}개 데이터 조회 완료`);
            return { success: true, data };
        } catch (error) {
            console.error('❌ 세션 데이터 조회 오류:', error);
            return { success: false, message: error.message };
        }
    }

    // PIN을 포함한 데이터 추가
    async addDataWithPin(name, phone, pin, metadata = {}) {
        try {
            // PIN으로 세션 조회
            const sessionResult = await this.getSessionByPin(pin);
            if (!sessionResult.success || !sessionResult.data) {
                throw new Error('유효하지 않은 PIN 번호입니다');
            }

            const session = sessionResult.data;

            // 만료 확인
            if (session.expires_at && new Date(session.expires_at) < new Date()) {
                throw new Error('만료된 세션입니다');
            }

            // 데이터 추가
            const { data, error } = await this.supabase
                .from(this.tableName)
                .insert([{
                    name: name,
                    phone: phone,
                    session_id: session.id,
                    ip_address: metadata.ip_address,
                    user_agent: metadata.user_agent
                }])
                .select();

            if (error) throw error;

            console.log('✅ 데이터 추가 완료 (세션 포함):', data);
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('❌ 데이터 추가 오류:', error);
            return { success: false, message: error.message };
        }
    }

    // 세션별 데이터 삭제
    async clearSessionData(sessionId) {
        try {
            const { error } = await this.supabase
                .from(this.tableName)
                .delete()
                .eq('session_id', sessionId);

            if (error) throw error;

            console.log(`✅ 세션 ${sessionId}의 데이터 삭제 완료`);
            return { success: true };
        } catch (error) {
            console.error('❌ 세션 데이터 삭제 오류:', error);
            return { success: false, message: error.message };
        }
    }
}

// 전역 Supabase 매니저 인스턴스
window.supabaseManager = new SupabaseManager();

// 테스트 함수를 전역으로 노출 (디버깅용)
window.testSupabaseDelete = async function () {
    return await window.supabaseManager.testDelete();
};
