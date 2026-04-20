# DB 캐싱 기능 비활성화 (Route Cache Toggle)

개발 및 검증 단계에서 AI 번역 로직과 경로 최적화 결과를 실시간으로 확인하기 위해, 기존의 Supabase DB 캐싱 기능을 선택적으로 끌 수 있는 기능을 추가했습니다.

## 개요
- **목적**: `cached_routes` 테이블에서 이전 결과를 가져오지 않고, 항상 새로운 경로 탐색 및 AI 번역을 강제 수행합니다.
- **대상 파일**: `src/services/RouteService.js`

## 설정 방법
`RouteService` 클래스의 생성자(`constructor`)에 있는 `USE_DB_CACHE` 변수를 통해 제어합니다.

```javascript
// src/services/RouteService.js

constructor() {
    this.pathFinder = new PathFinder();
    this.routeAssembler = null;
    this.CACHE_EXPIRY_DAYS = 30;
    
    // 이 부분을 수정하세요
    this.USE_DB_CACHE = false; // false: 캐시 비활성화 (실시간 검색), true: 캐시 활성화
    
    this._stationsCache = null;
}
```

## 주의 사항
- `USE_DB_CACHE = false` 상태에서는 모든 검색이 새로운 API 호출과 AI 번역을 유발하므로, 개발 단계에서만 비활성화하는 것을 권장합니다.
- 상용 환경(Production)으로 배포 시에는 다시 `true`로 변경하여 서버 부하 및 API 비용을 절감해야 합니다.
