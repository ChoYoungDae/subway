# Seoul Subway : Step-Free Access

서울 지하철 교통약자 안내 앱입니다. 외국인 관광객을 대상으로 한 영어 기반, 한국어 병기 앱입니다.

## 기능

- Supabase 데이터베이스와 연동하여 실시간 역 정보 조회
- 역 검색 및 필터링 (영어/한국어 지원)
- 역 상세 정보 및 방향 선택 (입장/출구)
- 출구별 step-free access 상태 확인

## 시작하기

### 1. 패키지 설치

```bash
cd D:\projects\subway-access
npm install
```

### 2. Supabase 설정

1. `.env` 파일을 열고 실제 Supabase 프로젝트 정보로 업데이트:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

2. Supabase 프로젝트에 `stations` 테이블 생성:

```sql
CREATE TABLE stations (
  id BIGSERIAL PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ko TEXT NOT NULL,
  line TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 샘플 데이터 삽입
INSERT INTO stations (name_en, name_ko, line) VALUES
  ('Gangnam', '강남', '2'),
  ('Hongdae', '홍대입구', '2'),
  ('Myeongdong', '명동', '4'),
  ('Gyeongbokgung', '경복궁', '3'),
  ('Itaewon', '이태원', '6');
```

### 3. 앱 실행

```bash
npm start
# 또는
expo start
```

## 프로젝트 구조

```
D:\projects\subway-access\
├── App.js                          # 메인 앱 + React Navigation 설정
├── lib/
│   └── supabase.js                 # Supabase 클라이언트 설정
├── src/
│   ├── i18n/
│   │   └── strings.js              # 다국어 텍스트 관리 (영어/한국어)
│   └── screens/
│       ├── HomeScreen.js           # 홈 화면 (검색 + 역 목록)
│       ├── StationScreen.js        # 역 상세 화면
│       └── ExitScreen.js           # 출구 목록 화면
├── .env                            # Supabase 환경 변수 (Git 제외)
├── .env.example                    # 환경 변수 예시
├── package.json
└── app.json
```

## 화면 구조

### 1. 홈 화면 (HomeScreen)
- 앱 타이틀 및 부제
- 역 검색창 (영어/한국어 실시간 필터링)
- Supabase에서 불러온 역 목록 표시
- 검색어 입력 시 필터링된 결과 표시

### 2. 역 상세 화면 (StationScreen)
- 역 이름 (영어/한국어)
- 방향 선택 버튼 (입장/출구)

### 3. 출구 목록 화면 (ExitScreen)
- 출구 번호 리스트
- 각 출구별 상태 표시 (이용 가능/점검 중)

## 기술 스택

- React Native
- Expo
- React Navigation
- Supabase (PostgreSQL 데이터베이스)

## 다음 단계

- 실제 서울 지하철 출구 데이터를 Supabase에 추가
- 출구 정보도 Supabase에서 조회하도록 구현
- 다국어 확장 (일본어, 중국어 등)
- 지도 연동 (출구 위치 표시)
