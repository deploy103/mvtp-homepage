# HanSei Links

hansei.mvtp.cloud에서 운영하는 한세 관련 사이트 바로가기 허브입니다. 외부 의존성 없이 Node 기본 모듈로 정적 파일, `/api/uptime`, `/api/site-content`를 제공합니다.

## Run

```bash
npm start
```

기본 주소는 `http://localhost:3000`입니다. 포트 변경은 `PORT=8080 npm start`처럼 지정합니다.


## Uptime API

`GET /api/uptime`은 Ubuntu/Linux 서버에서는 `/proc/uptime`을 우선 읽고, 개발 환경에서는 `os.uptime()`으로 fallback합니다.
