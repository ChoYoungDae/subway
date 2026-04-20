# 지하철 앱(Subway) 배포 및 연동 가이드

이 문서는 지하철 앱(`subway-access`)을 웹으로 배포하고 `seoulroutes.com` 도메인에 연동하는 과정을 정리한 가이드입니다.

## 1. 운영 환경 정보
- **배포 플랫폼**: Vercel
- **저장소**: `ChoYoungDae/subway` (Main 브랜치)
- **접속 주소**: `https://seoulroutes.com/subway`
- **로컬 개발 경로**: `d:\projects\subway-access`

## 2. 배포 설정 (Expo Web)
웹 빌드 시 하위 경로(`/subway`)에서 정상 작동하도록 다음 설정을 유지해야 합니다.

- **app.json**: `experiments.baseUrl`이 `/subway`로 설정되어 있어야 합니다.
- **App.js**: `NavigationContainer`의 `linking` 프리픽스에 `https://seoulroutes.com/subway`가 포함되어야 합니다.
- **vercel.json**: 루트의 `index.html`로 모든 요청을 리다이렉트하되, `/subway` 프리픽스를 처리하는 Rewrite 규칙이 포함되어야 합니다.

## 3. 도메인 연동 (Domain Mapping)
`seoulroutes.com` 메인 프로젝트(`summit`)에서 지하철 앱으로 연결해 주는 설정입니다.

### summit (등산 앱) 설정 - `next.config.ts`
```typescript
async rewrites() {
  return [
    {
      source: "/subway/:path*",
      destination: "https://지하철-앱-Vercel-주소.vercel.app/:path*"
    }
  ];
}
```

## 4. 환경 변수 (Environment Variables)
Vercel 대시보드의 **Settings > Environment Variables**에 다음 키들을 등록해야 앱이 정상 작동합니다.

| 변수명 | 용도 |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명 키 (CORS 프록시용) |
| `EXPO_PUBLIC_KRIC_SERVICE_KEY` | 공공데이터포털(KRIC) API 키 |
| `EXPO_PUBLIC_DATA_GO_KR_API_KEY` | 공공데이터포털 일반 API 키 |
| `EXPO_PUBLIC_SEOUL_SUBWAY_KEY` | 서울시 실시간 지하철 API 키 |
| `EXPO_PUBLIC_ODSAY_API_KEY` | ODSay API 키 (경로 탐색용) |
| `ANTHROPIC_API_KEY` | (필요 시) 번역 스크립트 실행용 키 |

## 5. 보안 및 유지보수
- **보안**: API 키가 코드에 하드코딩되지 않도록 주의하십시오. 만약 GitHub Secret Scanning에 걸릴 경우, `.git` 폴더를 삭제하고 다시 초기화하여 히스토리를 밀어내야 합니다.
- **업데이트**: `subway-access` 프로젝트의 `main` 브런치를 푸시하면 Vercel이 자동으로 빌드하여 `seoulroutes.com/subway`에 반영합니다.

---
최종 수정일: 2026-04-20
