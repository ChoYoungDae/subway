# Project Rules for subway-access

## Build and Test Commands

### JavaScript/Node.js Commands
- **Linting**: `npm run lint`
- **Type checking**: `npm run typecheck` (if TypeScript is configured)
- **Testing**: `npm test` or `npm run test`
- **Build**: `npm run build`

### React Native Specific Commands
- **iOS build**: `npx react-native run-ios`
- **Android build**: `npx react-native run-android`
- **Start Metro**: `npx react-native start`

## Code Quality Standards

### JavaScript/React Native Conventions
- Use functional components with hooks
- Follow React Native naming conventions (PascalCase for components)
- Use ES6+ syntax (const/let, arrow functions, destructuring)
- Prefer async/await over promise chains

### File Structure
- Components in `src/components/`
- Services in `src/services/`
- Utilities in `src/utils/`
- Screens in `src/screens/`

## Project-Specific Rules

### Core Architectural Principles
- **Logic over Text**: 모든 이동 안내는 DB의 고정된 텍스트를 읽는 것이 아니라, 분석 엔진(A-B-C 파이프라인)이 실시간으로 조립하는 것이다. 이 구조를 깨는 수정을 절대 금지한다.
- **Strict Normalization**: 모든 위치 정보는 1F, B2 등 약속된 표준 코드로만 처리한다. 한글 표기가 섞인 상태로 로직에 넘기지 마라.
- **Traceability**: 모든 데이터 변환 단계에서 console.log를 남겨라. (예: [Parser] -> JSON -> [Builder] -> English) 데이터의 변질 과정을 추적할 수 있어야 한다.
- **Double-Check Reversal**: 도착역 안내 로직을 건드릴 때는 반드시 출발역 안내를 거꾸로 뒤집었을 때와 논리적으로 완벽히 대칭되는지 검증하라.

### API Integration
- Seoul Metro API integration through `src/api/seoulApi.js`
- Supabase integration through `lib/supabase.js`
- Handle API errors gracefully with appropriate user feedback

### Navigation Logic
- Barrier-free route parsing in `src/utils/routeParser.js`
- Sentence building for movement instructions in `src/utils/SentenceBuilder.js`
- Timeline generation in `src/utils/TimelineFactory.js`

### Data Handling
- Korean text processing utilities in various utils files
- Station code mapping in `src/data/kricCodes.json`
- Movement translations in `src/data/movementTranslations.js`

## Testing Requirements

### Unit Tests
- Test component rendering and functionality
- Test utility functions (parsers, translators, etc.)
- Test API service functions

### Integration Tests
- Test complete route planning flow
- Test navigation instruction generation
- Test real-time location integration

### Validation Tests
- Test against CSV ground truth data (subway_navigation_final_for_dev_v3.csv)
- Validate Korean text parsing accuracy
- Verify barrier-free path correctness

## Security Considerations
- Never commit API keys or secrets
- Use environment variables for sensitive configuration
- Validate all user inputs to prevent injection attacks
- Follow React Native security best practices

## Performance Guidelines
- Optimize images and assets in `assets/` directory
- Implement proper memoization for expensive computations
- Use efficient data structures for station and route data
- Minimize re-renders in React components

## Internationalization (i18n)
- Support Korean and English text
- Use `src/i18n/strings.js` for string management
- Handle RTL/LTR layout considerations if needed

## Error Handling
- Implement comprehensive error boundaries
- Provide user-friendly error messages
- Log errors appropriately for debugging
- Handle network connectivity issues gracefully

## Documentation Standards
- Document complex algorithms and business logic
- Comment on non-obvious implementation details
- Maintain README.md with project overview
- Document API endpoints and data structures