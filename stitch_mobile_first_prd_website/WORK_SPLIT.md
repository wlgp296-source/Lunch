# 두 명이 동시에 작업하는 방법

## 담당 영역

- 담당자 1: `src/features/solo/`
  - 1인 설정, 메뉴 추천, 식당 추천, 개인 기록
- 담당자 2: `src/features/team/`
  - 팀방, 투표, 룰렛, 팀 기록
- 공통 관리: `src/shared/`, `src/app/app.js`
  - 데이터 형식과 공통 상태를 먼저 합의한 뒤 수정

## 작업 규칙

1. 담당 영역 밖의 파일은 직접 수정하지 않습니다.
2. 공통 데이터 형식은 `src/shared/data.js`에서 관리합니다.
3. 공통 상태 저장 방식은 `src/shared/state.js`에서 관리합니다.
4. 기능은 작은 커밋 단위로 저장합니다.
5. 통합할 때는 공통 구조를 먼저 합친 뒤 각 기능을 합칩니다.

## 브랜치 예시

```text
feature/solo-flow
feature/team-flow
```
