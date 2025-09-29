# 전화번호 수집 시스템

QR코드를 통한 전화번호 수집을 위한 웹 애플리케이션입니다.

## 기능

### 관리자 페이지 (`index.html`)
- 좌측: 수집된 전화번호 데이터 테이블 (실시간 업데이트)
- 우측: QR코드 생성 및 표시
- 통계 정보 (총 수집 수, 오늘 수집 수)
- 데이터 내보내기 (CSV 형식)
- Supabase 실시간 동기화

### 모바일 앱 (`mobile.html`)
- 이름과 전화번호 입력 폼
- 실시간 입력 유효성 검사
- 전화번호 자동 포맷팅
- PWA 지원 (앱 설치 가능)
- Supabase 클라우드 저장

## 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Supabase (PostgreSQL + 실시간 기능)
- **QR코드**: Google Charts API
- **데이터 저장**: Supabase Database (+ localStorage fallback)
- **실시간 동기화**: Supabase Realtime
- **PWA**: Service Worker, Web App Manifest

## 설치 및 실행

### 1. Supabase 설정 (권장)

#### Supabase 프로젝트 생성
1. [Supabase](https://supabase.com) 회원가입 및 로그인
2. 새 프로젝트 생성
3. 프로젝트 설정에서 **API URL**과 **anon key** 복사

#### 데이터베이스 테이블 생성
1. Supabase 대시보드에서 **SQL Editor** 열기
2. 다음 SQL 실행:

```sql
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

-- Row Level Security (RLS) 설정
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;

-- 공개 접근 정책 설정
CREATE POLICY "Allow public read access" ON phone_numbers FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON phone_numbers FOR INSERT WITH CHECK (true);
```

#### 앱 설정 구성 ✅ 완료
Supabase 연결이 이미 구성되어 있습니다:
- **프로젝트 URL**: `https://ainftwifvclgiookzrwm.supabase.co`
- **테이블 이름**: `getphnum`
- **실시간 기능**: 활성화됨
- **테스트 데이터**: 3개 샘플 데이터 포함

### 2. 로컬 테스트
- **Supabase 설정 완료 시**: 클라우드 DB와 실시간 동기화
- **Supabase 미설정 시**: localStorage 모드로 실행

### 3. 웹서버 배포
1. 프로젝트 파일을 웹 서버에 업로드
2. Supabase 설정이 되어있으면 실시간 클라우드 동기화
3. QR코드 자동 생성

### 추천 배포 플랫폼
- **Vercel** (무료) - Supabase와 완벽 호환
- **Netlify** (무료) - 정적 호스팅
- **GitHub Pages** (무료) - 간단한 배포

## Supabase 백엔드 기능

### 📊 데이터베이스 구조
- **getphnum 테이블**: 전화번호 데이터 저장
- **getphnum_formatted 뷰**: 자동 전화번호 포맷팅
- **getphnum_daily_stats 뷰**: 일별 통계
- **getphnum_hourly_stats 뷰**: 시간별 통계

### 🔧 백엔드 함수
- **get_getphnum_stats()**: 종합 통계 (총, 오늘, 주간, 월간)
- **check_duplicate_phone()**: 중복 전화번호 체크
- **format_phone_number()**: 전화번호 자동 포맷팅

### 🔒 보안 설정
- **Row Level Security (RLS)**: 활성화됨
- **공개 읽기 정책**: 모든 사용자 데이터 조회 가능
- **공개 쓰기 정책**: 모든 사용자 데이터 입력 가능
- **관리자 정책**: 인증된 사용자만 수정/삭제

### ⚡ 실시간 기능
- **실시간 구독**: 새 데이터 즉시 알림
- **자동 동기화**: 모든 관리자 페이지 즉시 업데이트
- **WebSocket 연결**: 끊김 없는 실시간 통신

### 📈 고급 기능
- **중복 감지**: 동일 전화번호 입력 시 경고
- **IP 추적**: 데이터 수집 시 IP 주소 기록
- **사용자 에이전트**: 브라우저/기기 정보 저장
- **자동 타임스탬프**: 생성/수정 시간 자동 기록

## 파일 구조

```
getphnum/
├── index.html          # 관리자 페이지
├── mobile.html         # 모바일 앱
├── manifest.json       # PWA 매니페스트
├── sw.js              # Service Worker
├── styles/
│   ├── admin.css      # 관리자 페이지 스타일
│   └── mobile.css     # 모바일 앱 스타일
├── js/
│   ├── admin.js       # 관리자 페이지 로직
│   └── mobile.js      # 모바일 앱 로직
└── README.md          # 프로젝트 문서
```

## 사용법

### 관리자
1. `index.html`을 데스크톱 브라우저에서 열기
2. 우측의 QR코드를 사용자에게 제공
3. 좌측에서 실시간으로 수집되는 데이터 확인
4. 필요시 데이터 내보내기 또는 초기화

### 사용자 (모바일)
1. QR코드를 스마트폰으로 스캔
2. 이름과 전화번호 입력
3. 전송 버튼 클릭
4. 성공 메시지 확인

## 주요 기능

### 실시간 데이터 동기화
- localStorage 기반 데이터 공유
- 여러 탭 간 실시간 동기화
- 새 데이터 추가 시 자동 업데이트

### 입력 유효성 검사
- 이름: 2-20자, 한글/영문만 허용
- 전화번호: 한국 형식 (010-1234-5678)
- 실시간 포맷팅 및 검증

### PWA 기능
- 앱 설치 가능
- 오프라인 지원
- 푸시 알림 지원 (선택사항)

### 반응형 디자인
- 데스크톱과 모바일 최적화
- 터치 친화적 인터페이스
- 다크 모드 지원

## 브라우저 지원

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## 보안 고려사항

- 클라이언트 사이드 데이터 저장 (localStorage)
- 실제 운영 환경에서는 서버 사이드 데이터 저장 권장
- HTTPS 사용 권장 (PWA 기능을 위해)

## 확장 가능성

- 서버 사이드 API 연동
- 데이터베이스 연동
- 사용자 인증 시스템
- 데이터 분석 및 통계
- 다국어 지원

## 라이선스

MIT License
