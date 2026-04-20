# 지하철 앱(Subway) 배포 및 연동 가이드

> [!IMPORTANT]
> **AI 작업 원칙 (Critical Rule for AI)**
> 1. **로컬 소스 절대 무결성**: 로컬 워크스페이스(`d:\projects\subway-access`)의 소스 코드가 모든 배포의 '절대적 기준'입니다. AI는 사용자 요청 없이 로직, 번역, CSS 스타일을 임의로 수정하지 않습니다.
> 2. **수동 복사 절대 금지**: `subway` 빌드 파일을 `summit` 프로젝트 폴더로 직접 복사하거나 커밋하지 마십시오. 이는 히스토리 오염과 배달 사고의 원인이 됩니다.
> 3. **독립적 배포**: 지하철 앱은 자체 저장소(`subway-access`)에서 Vercel로 독립 배포되며, 메인 도메인과는 '안내판(Rewrites)' 설정을 통해 연결됩니다.

## 1. 운영 환경 구조
- **메인 도메인 (Gateway)**: `https://seoulroutes.com` (`summit` 프로젝트)
- **지하철 앱 (Service)**: `https://subway-seven-amber.vercel.app` (`subway-access` 프로젝트)
- **연결 경로**: `https://seoulroutes.com/subway` -> (Proxy) -> `subway` 프로젝트

## 2. 배포 및 연동 방식 (Next.js Rewrites)
이 프로젝트는 수동 파일 이동이 필요 없는 **'프록시/리와이트'** 방식을 사용합니다.

### 연동 설정 (이미 완료됨)
메인 서버(`summit`)의 `next.config.ts` 파일에 아래와 같은 안내판 설정이 되어 있습니다.
```typescript
async rewrites() {
  return [
    {
      source: "/subway/:path*",
      destination: "https://subway-seven-amber.vercel.app/:path*",
    },
  ];
}
```

### 업데이트 워크플로우
1. **코드 수정**: `d:\projects\subway-access`에서 기능을 개발하거나 수정합니다.
2. **코드 푸시**: 수정된 코드를 지하철 전용 저장소에 푸시합니다.
   ```powershell
   git add .
   git commit -m "feat: update subway feature"
   git push origin main
   ```
3. **자동 반영**: Vercel이 자동으로 빌드하여 지하철 전용 서버에 반영하며, `seoulroutes.com/subway` 접속 시 즉시 최신 화면이 나타납니다. (메인 서버 `summit`은 건드릴 필요가 없습니다.)

## 3. 설정 주의사항 및 팁
- **Base Path**: 웹 빌드 시 하위 경로 인식을 위해 `app.json`의 `experiments.baseUrl`이 `/subway`로 설정되어 있어야 합니다.
- **Font Parity**: 웹 브라우저에서 서체가 무너지는 것을 방지하기 위해 `App.js`에 `Platform.OS === 'web'` 기반의 스타일 주입 로직을 포함합니다.
- **Cache Purge**: 배포 후 화면이 바뀌지 않는다면 브라우저에서 `Ctrl + Shift + R`을 눌러 강력 새로고침을 수행하십시오.

---
최종 업데이트: 2026-04-21 (Vercel Proxy 구조로 공식 배포 체계 현대화)
