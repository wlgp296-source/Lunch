# 담당자 1 작업 안내

## 담당 영역

아래 폴더의 기능을 구현합니다.

```text
src/features/solo/
```

주요 파일:

- `src/features/solo/preferences.js`
- `src/features/solo/recommendations.js`

## 첫 번째 작업

1. 메뉴 검색 입력창이 실제로 메뉴를 필터링하도록 구현
2. 기분·예산·거리 조건이 추천 결과에 반영되도록 구현
3. 메뉴 선택 후 식당 예시가 표시되도록 유지

## 수정하지 않는 영역

```text
src/features/team/
src/shared/
src/app/
src/style.css
```

공통 파일 수정이 꼭 필요하면 담당자 2와 먼저 합의합니다.

## 실행 방법

```powershell
pnpm install
pnpm dev
```

작업 후에는 다음 명령이 성공해야 합니다.

```powershell
pnpm run build
```
