# 허브아이(Herb5) 주문 관리 사이트 — 작업 안내

이 저장소는 허브 · 식용꽃 쇼핑몰 **허브아이**의 업무용 웹사이트예요.
GitHub Pages로 열려요: https://herb5-i.github.io/herb5_order/

- 맨 앞 주소는 **첫 화면**(허브아이 · 허브다섯메 로고 고르기)이에요.
- 허브아이: https://herb5-i.github.io/herb5_order/shop/
- 허브다섯메 농장: https://herb5-i.github.io/herb5_order/farm/ (원본은 `herbfive-farm` 저장소, `sh sync_farm.sh`로 가져와요)

사용자는 개발자가 아닌 가게 운영자예요. **설명과 화면 문구는 쉬운 한국어(해요체)** 로 써 주세요.
전문 용어(API, 배포, 커밋 등)는 꼭 필요할 때만 쓰고, 쓰면 짧게 풀어서 설명해요.

## 파일 구조

| 위치 | 내용 |
|---|---|
| `src/index.html` | **원본. 기능 · 화면은 여기만 고쳐요.** (HTML · CSS · JS가 한 파일에 다 있어요) |
| `src/build_web.py` | 원본 → 사이트 완성본 만들기 (로그인 · Firebase 연결 · 앱 설치 파일 추가) |
| `src/web_fb.js`, `src/web_fb.css`, `src/web_login.css` | 완성본에만 들어가는 로그인 · 동기화 코드 |
| `src/audit_all.js` | 화면 점검 (모바일 · PC 폭마다 넘침 · 글자 잘림 · 오류) |
| `src/test/` | 점검용 가짜 데이터 (실제 고객 정보 아님) |
| `src/build_shared.py`, `rules_live.json`, `weather_doc.json` | 예전 "공용 html 파일" 만들기 (지금은 거의 안 써요) |
| `index.html`, `manifest.webmanifest`, `sw.js`, `logo-hi.png`, `icon-*.png` (맨 위) | **첫 화면** (로고 두 개). 이건 직접 고쳐요. 카페24 연결에서 돌아온 주소(`?code=`)는 `shop/`으로 넘겨요 |
| `shop/` | **허브아이 완성본. 직접 고치지 말고 빌드로만 만들어요.** |
| `farm/`, `sync_farm.sh` | 허브다섯메 농장 사이트 (herbfive-farm 저장소에서 가져온 완성본) |
| `firebase-config.js` | Firebase 연결값 (공개돼도 되는 값) |
| `cafe24-worker/worker.js` | Cloudflare 워커 (카페24 · 네이버 API 중계). 사용자가 Cloudflare에 직접 붙여 넣어 배포해요 |
| `firestore.rules` | Firestore 보안 규칙 |

## 고치는 순서 (매번 지켜 주세요)

1. `src/index.html`을 고쳐요. 큰 수정 전에는 백업을 떠 두면 좋아요.
2. 완성본 만들기:
   ```
   cd src && python3 build_web.py ../shop
   ```
   (`shop/` 안의 `index.html`, `manifest.webmanifest`, `sw.js`, 아이콘이 새로 만들어져요. 맨 위 첫 화면은 건드리지 않아요)
3. **화면 점검 — 수정할 때마다 꼭 해요.** 사용자가 요청한 규칙이에요: 모바일 · PC에서 넘침, 크기 변화 같은 문제가 없는지 확인하고 고치기.
   ```
   cd src
   node audit_all.js 340,412,768
   node audit_all.js 1024,1280
   node audit_all.js 1600
   node audit_all.js 360,1280 dark
   ```
   각 줄 마지막이 `총 0건`이어야 해요. 아니면 나온 항목을 고친 뒤 다시 점검해요.
   (Playwright + Chromium이 필요해요: `npm i -D playwright && npx playwright install chromium`)
4. 바꾼 부분은 Playwright로 직접 열어 눌러 보고, 필요하면 캡처해서 눈으로 확인해요.
5. 커밋하고 `main`에 올리면 1~2분 뒤 사이트에 반영돼요.
6. `cafe24-worker/worker.js`를 바꿨다면 사용자에게 **Cloudflare에 새 worker.js를 붙여 넣어 배포**해 달라고 꼭 알려요.

## 지켜야 할 것

- **비밀키는 절대 코드나 대화에 쓰지 않아요.** 카페24 Client Secret, 네이버 Client Secret 등은 Cloudflare 워커의 Secret(`CAFE24_CLIENT_SECRET`, `NAVER_CLIENT_SECRET`)에만 있어요. 사용자에게 채팅으로 달라고 하지도 않아요.
- **고객 개인정보**: 받는 분 이름 · 전화번호 · 주소를 공용 저장소(Firestore)에 그대로 저장하지 않아요. 고객 이름은 기기 안(IndexedDB)에만, 전화번호 · 주소는 필요할 때만 불러와 보여주고 저장하지 않아요.
  - 예외 (사용자 요청, 2026-11-24): **카톡 주문**의 업체 정보(업체명 · 받는 분 · 전화 · 주소)와 카톡 주문은 여러 기기에서 같이 쓰도록 공용 저장소 `stock/kakaobiz`, `stock/kakaoorders`에 저장해요 (로그인한 직원만 읽기). 내려받은 주문은 30일 뒤 지워져요.
- **카페24 데이터를 바꾸는 동작**(희망배송일, 공지 올리기, 송장 등록 등)은 확인 창을 띄우고 관리자만 할 수 있게 해요.
- Cloudflare 무료 요금제: 한 번 호출에 외부 요청 50개까지, KV 쓰기 하루 1,000번까지.
- 화면은 PC(왼쪽 메뉴) · 휴대폰(아래 메뉴) · 다크 모드를 모두 지원해요. 새 화면도 셋 다 맞춰요.
- 날짜 · 시간은 한국 시간 기준이에요.

## 주요 기능 (탭 순서)

홈(위젯 꾸미기 · 주문 처리 현황) · 정리(주문 정리 / 들어온 주문: 아직 안 불러온 주문 미리 보기 / 송장 등록 / 날씨 / 배송 · 휴무 공지 이미지) · 집계 보기 · 재고 관리(재고 · 입고 · 반송 · 폐기 / 판매: 카페24 품절 · 판매 재개 · 가격 · 수량, 기록은 stock/salelog) · 이슈 관리 · 고객 관리(전체 / 이번 주 주문 예상 / 재주문 확인, 연락 약속) · 기록 · 통계(백업 기간 지정) · 시장(네이버 검색 추이 비교) · 규칙 관리(관리자)

## 개선 메모 처리 (사용자가 "메모 불러와"라고 하면)

1. 사용자에게 받은 읽기 주소(`.../fb/read?k=...`)로 메모와 "이어서 의견"을 읽어요.
2. 메모를 처리하면 맨 위 `fb_notes.json`에 메모 번호별로 처리 내용을 적어요: `{"번호": {"at": "YYYY-MM-DD", "st": "done|doing|hold", "t": "어떻게 고쳤는지 (쉬운 한국어)"}}`. 홈 화면 메모 칸에 "처리 내용"으로 그대로 보여요. st: done=반영함, doing=처리중, hold=반영 안 됨 (처리 내용이 없으면 메모됨). 개인정보는 적지 않아요.
3. 이어서 의견(피드백)이 달리면 그 내용을 반영하고 `t`를 고쳐 적어요.
4. 처리 내용을 올린 뒤에는 **사용자 휴대폰으로 알림**(PushNotification)을 보내요: 몇 번 메모를 어떻게 처리했는지 한 줄로. 사이트에서도 `fb_notes.json`이 바뀌면 직원들 알림(종 · 앱 아이콘 숫자)에 "개선 메모 처리 내용 N건이 올라왔어요"가 떠요.

## 참고

- 이 원본은 원래 claude.ai 대화에서 만들어 왔어요. claude.ai 쪽 미리보기(아티팩트)는 이제 업데이트하지 않아요. 실제로 쓰는 건 GitHub 사이트예요.
- 지금까지 바뀐 내용은 `git log`로 볼 수 있어요.
