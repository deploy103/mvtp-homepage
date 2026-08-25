# MVTP Cloud Portfolio

`mvtp.cloud` 공개 포트폴리오와 `/adminpage` CMS입니다. Node.js 기본 모듈과 Vanilla HTML/CSS/JavaScript만 사용하며 별도의 런타임 패키지나 외부 DB가 필요하지 않습니다.

## 실행

Node.js 18 이상이 필요합니다.

```bash
cp .env.example .env
npm start
```

기본 주소는 `http://localhost:3000`입니다. `.env`에는 운영 환경의 관리자 계정을 직접 설정해야 합니다.

- `ADMIN_ID`: 관리자 ID
- `ADMIN_PASSWORD`: 충분히 긴 관리자 비밀번호
- `ADMIN_SESSION_SECRET`: 세션 서명용 무작위 비밀값. 운영 환경에서는 `openssl rand -hex 32` 등으로 별도 생성
- `COOKIE_SECURE`: HTTPS 배포에서는 `true`
- `TRUST_PROXY`: 신뢰할 수 있는 reverse proxy가 `X-Forwarded-For`를 덮어쓰는 환경에서만 `true`
- `HOST`, `PORT`: 바인딩 주소와 포트

`.env`와 실제 업로드 파일은 Git에 포함되지 않습니다.

## 데이터와 마이그레이션

운영 콘텐츠는 [`data/site-content.json`](data/site-content.json)에 저장됩니다. 서버 시작 시 현재 schema로 자동 마이그레이션하며, 직접 실행할 수도 있습니다.

```bash
npm run migrate
```

기존 서비스 상태와 활동 데이터는 schema v3의 프로젝트·활동 구조로 옮겨지고, v2 데이터에는 기존 값을 유지한 채 운영 안내 컬렉션이 추가됩니다. 쓰기는 임시 파일을 거친 원자적 교체 방식이며 revision 충돌을 검사합니다. 손상된 JSON은 기본값으로 덮어쓰지 않고 서버 시작을 중단합니다.

업로드 이미지는 `public/uploads/`에 UUID 파일명으로 저장되고 메타데이터는 콘텐츠 JSON에 기록됩니다. 배포·복원 전에는 아래 두 경로를 함께 백업해야 합니다.

- `data/site-content.json`
- `public/uploads/`

## 관리자 보안

관리자 페이지와 모든 변경 API는 서명된 HttpOnly 세션 쿠키로 보호됩니다. 변경 요청에는 세션별 CSRF 토큰과 same-origin 검사를 적용합니다. 콘텐츠는 서버 allowlist를 통해 정규화되며 공개 화면에서는 관리자 텍스트를 `innerHTML`로 렌더링하지 않습니다.

이미지 업로드는 JPEG, PNG, WebP만 허용하며 최대 8MB, 실제 파일 시그니처·구조·크기·픽셀 수를 검사합니다. 서버 저장 파일명에는 원본 이름을 사용하지 않으며, 관리 업로드 경로 밖의 파일은 삭제 API 대상이 될 수 없습니다.

## 검증

```bash
npm test
npm run migrate
```

테스트는 기존 데이터 마이그레이션, revision 충돌, 인증/Authorization, CSRF, 공개 여부, 연도 계산, 안전하지 않은 업로드 차단, 사용 중 미디어 삭제 차단을 포함합니다.

## 배포

현재 배포 구성은 Node 프로세스를 systemd로 실행하고 애플리케이션 디렉터리의 데이터 및 업로드 쓰기를 허용합니다. Reverse proxy에서 HTTPS를 종료하는 경우 `COOKIE_SECURE=true`를 유지하고 `/api`, `/uploads`, 정적 파일 경로를 같은 origin으로 전달해야 합니다.
