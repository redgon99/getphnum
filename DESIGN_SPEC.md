# 전화번호 수집 시스템 - 디자인 스펙

## 🎨 컬러 팔레트

### Primary Colors
- **Primary Gradient**: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- **Primary Blue**: `#667eea`
- **Primary Purple**: `#764ba2`

### Semantic Colors
- **Success**: `#10b981` (Green)
- **Warning**: `#fbbf24` (Yellow)
- **Danger**: `#ef4444` (Red)
- **Info**: `#3b82f6` (Blue)

### Neutral Colors
- **Text Primary**: `#1e293b`, `#2d3748`
- **Text Secondary**: `#64748b`
- **Border**: `#e2e8f0`, `#cbd5e1`
- **Background**: `#f8fafc`, `#f1f5f9`
- **White**: `#ffffff`

---

## 📐 레이아웃 구조

### 1. 관리자 페이지 (index.html) - 1400px max-width

```
┌────────────────────────────────────────────────────────────────┐
│                     전체 컨테이너 (100vh)                      │
├─────────────────────────────────┬──────────────────────────────┤
│        좌측 (flex: 1)           │    우측 (500px fixed)        │
│    배경: #f8fafc                │    배경: white               │
│                                 │                              │
│ ┌─────────────────────────────┐ │  ┌────────────────────────┐ │
│ │ 🔢 새 세션 추가             │ │  │   QR코드 스캔          │ │
│ │ [PIN입력] ➕               │ │  │                        │ │
│ └─────────────────────────────┘ │  │   [QR 이미지]          │ │
│                                 │  │    250x250px           │ │
│ ┌─────────────────────────────┐ │  │                        │ │
│ │ 📋 세션 목록 (5)           │ │  │   모바일 URL:          │ │
│ │ ● 1234 | 12건 | 🗑️        │ │  │   [URL 입력창]         │ │
│ │ ● 5678 |  5건 | 🗑️        │ │  │   [복사][새로고침]     │ │
│ └─────────────────────────────┘ │  └────────────────────────┘ │
│                                 │                              │
│ 수집된 전화번호 🟢              │  QR 확장 시: 400x400px      │
│ PIN: 1234                       │                              │
│                                 │                              │
│ 📊 통계: 총 17건 | 오늘 5건    │                              │
│                                 │                              │
│ [데이터 내보내기][초기화][새로고침]                           │
│                                 │                              │
│ ┌─────────────────────────────┐ │                              │
│ │ 번호│이름│전화번호│수집시간 │ │                              │
│ │  1  │홍길동│010-1234│...    │ │                              │
│ │  2  │김철수│010-5678│...    │ │                              │
│ └─────────────────────────────┘ │                              │
└─────────────────────────────────┴──────────────────────────────┘
```

---

## 🎯 주요 컴포넌트

### 1. 세션 빠른 추가 (.session-quick-add)
- **배경**: Gradient `#667eea → #764ba2`
- **패딩**: 15px
- **Border Radius**: 12px
- **입력 필드**:
  - 폰트 크기: 1.2rem
  - 폰트 굵기: 700 (Bold)
  - 텍스트 정렬: center
  - Letter spacing: 0.2em
- **버튼**: 45x45px, 아이콘 "➕"

### 2. 세션 목록 (.session-list-compact)
- **배경**: `#f8fafc`
- **Border**: 1px solid `#e2e8f0`
- **최대 높이**: 200px (스크롤)
- **패딩**: 12px
- **Border Radius**: 12px

### 3. 세션 아이템 (.session-item)
- **기본**: 
  - 배경: white
  - Border: 1px solid `#e2e8f0`
  - 패딩: 8px 10px
  - Border Radius: 8px
- **Hover**:
  - 배경: `#f1f5f9`
  - Border: `#cbd5e1`
  - Transform: translateX(2px)
- **Active**:
  - 배경: `#ede9fe` (연보라)
  - Border: `#667eea`
  - Box-shadow: `0 0 0 2px rgba(102, 126, 234, 0.1)`

### 4. 통계 카드 (.stat-item)
- **배경**: Gradient `#f8fafc → #e2e8f0`
- **패딩**: 20px
- **Border Radius**: 12px
- **숫자**: 1.8rem, Bold, `#667eea`
- **레이블**: 0.85rem, `#64748b`

### 5. 버튼 스타일

#### Primary Button
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
color: white
padding: 12px 24px
border-radius: 8px
font-weight: 600
```

#### Danger Button
```css
background: #ef4444
color: white
padding: 12px 24px
border-radius: 8px
```

#### Secondary Button
```css
background: #6b7280
color: white
padding: 12px 24px
border-radius: 8px
```

### 6. 데이터 테이블
- **Header 배경**: `#f8fafc`
- **Border**: `#e2e8f0`
- **Hover Row**: `#f0f9ff`
- **컬럼 비율**: 번호 10% | 이름 25% | 전화번호 30% | 시간 35%

### 7. QR 코드 영역
- **배경**: white
- **컨테이너 패딩**: 30px
- **QR 이미지**: 250x250px (기본), 400x400px (확장)
- **Border Radius**: 16px
- **Box Shadow**: `0 4px 20px rgba(0,0,0,0.1)`

---

## 📱 모바일 페이지 (mobile.html) - 400px max-width

### 레이아웃
```
┌──────────────────────────┐
│    전화번호 입력         │
│    (헤더 - 그라디언트)   │
│                          │
│ ┌──────────────────────┐ │
│ │ 🔐 PIN 번호          │ │
│ │ [1234]               │ │
│ │                      │ │
│ │ 이름                 │ │
│ │ [입력]               │ │
│ │                      │ │
│ │ 전화번호             │ │
│ │ [010-1234-5678]      │ │
│ │                      │ │
│ │ [    전송    ]       │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

### 스타일
- **배경**: Gradient `#667eea → #764ba2`
- **폼 배경**: white
- **폼 패딩**: 30px
- **Border Radius**: 20px
- **입력 필드**:
  - 패딩: 15px
  - Border: 2px solid `#e5e7eb`
  - Border Radius: 12px
  - 포커스 시: Border `#3b82f6`

---

## 🔢 타이포그래피

### Headings
- **H1**: 2rem (32px), Bold 600
- **H2**: 1.5rem (24px), Bold 600
- **H3**: 1.2rem (19px), Bold 600

### Body Text
- **기본**: 1rem (16px), Regular 400
- **Small**: 0.85rem (14px)
- **Tiny**: 0.75rem (12px)

### Font Family
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 
             Roboto, 'Helvetica Neue', Arial, sans-serif
```

---

## 🎭 애니메이션

### Slide In (알림)
```css
@keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}
```

### Scale (버튼)
```css
hover: transform: scale(1.05)
active: transform: scale(0.95)
```

### Transition
- **기본**: `all 0.3s ease`
- **빠름**: `all 0.2s ease`

---

## 📦 컴포넌트 재사용

### 1. PIN 입력 필드
- 크기: 1.2rem ~ 1.5rem
- 굵기: 700 (Bold)
- 정렬: center
- Letter spacing: 0.2em ~ 0.3em

### 2. 배지 (Badge)
- 패딩: 4px ~ 8px, 10px ~ 16px
- Border Radius: 10px ~ 20px
- 폰트: 0.75rem ~ 0.85rem, Bold 600

### 3. 카드
- Border Radius: 12px ~ 16px
- Box Shadow: `0 4px 20px rgba(0,0,0,0.1)`
- Hover: `0 8px 30px rgba(0,0,0,0.15)`

---

## 📱 반응형 브레이크포인트

### Desktop (기본)
- Container: 1400px max-width

### Tablet (1024px 이하)
- QR 섹션: flex 비율 조정

### Mobile (768px 이하)
- Flex direction: column (세로 배치)
- 버튼: width 100%
- 테이블: 최소 너비 제거

---

이 스펙을 바탕으로 Figma에서 디자인을 만드시면 됩니다! 
Figma 플러그인을 실행하고 연결하시면 코드에서 직접 Figma 요소를 제어할 수 있습니다.

