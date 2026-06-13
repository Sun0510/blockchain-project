# HashSH Blockchain NFT Project

HashSH는 Google 계정으로 로그인한 사용자가 해시 게임에 참여하고, 보상 토큰과 NFT를
조회하거나 거래할 수 있도록 만든 Sepolia 테스트넷 기반 Web3 프로젝트입니다.

백엔드는 신규 사용자에게 서버 관리형 지갑을 생성하고, 블록체인 RPC를 통해 ETH 및
ERC-20 잔액 조회, 토큰 민팅, NFT 소유권 확인과 전송을 수행합니다. 프런트엔드는 게임,
보상, NFT 목록과 상세 화면, 마이페이지를 제공합니다.

## 주요 기능

- Google OAuth 로그인과 JWT 쿠키 인증
- 사용자별 Sepolia 지갑 생성 및 잔액 조회
- SHA-256 기반 문자열 게임
- 성공 답안당 1회 ERC-20 보상 지급
- ERC-20 토큰과 Sepolia ETH 교환
- NFT 목록, 메타데이터와 온체인 소유자 조회
- NFT 판매 등록, 가격 변경, 취소 및 구매
- 사용자 이름과 ID 변경
- 선택적 개인키 내보내기

## 기술 구성

- 프런트엔드: React 18, Vite, React Router, Axios, ethers
- 백엔드: Node.js, Express, MySQL, ethers, Google OAuth, JWT
- 블록체인: Ethereum Sepolia 테스트넷, ERC-20, ERC-721
- 데이터베이스: MySQL 8

## 프로젝트 구조

```text
blockchain-project/
├─ backend/
│  ├─ abi/                 스마트 컨트랙트 ABI
│  ├─ server.mjs           Express API 서버
│  ├─ security.mjs         입력 검증 및 보안 유틸리티
│  ├─ security.test.mjs    보안 단위 테스트
│  ├─ schema.sql           MySQL 초기 스키마
│  └─ .env.example         백엔드 환경 변수 예시
├─ frontend/
│  ├─ src/                 React 화면과 API 코드
│  └─ .env.example         프런트엔드 환경 변수 예시
└─ README.md
```

## 보안 설계

- OAuth `state` 검증으로 로그인 CSRF 방지
- HttpOnly JWT 쿠키와 운영 환경용 Secure 쿠키 적용
- JWT 알고리즘, 발급자와 대상 검증
- 허용된 Origin 검사 및 CORS 제한
- 요청 본문 크기 및 민감 API 호출 횟수 제한
- 게임과 거래에서 요청 본문의 사용자 식별자를 신뢰하지 않고 로그인 세션 사용
- NFT 판매 시 ERC-721 `ownerOf`를 이용한 온체인 소유권 검증
- 성공 답안과 보상 청구를 연결하여 중복 민팅 방지
- NFT 메타데이터 URL의 내부 주소 접근, 과도한 응답과 리다이렉트 제한
- 지갑 암호를 AES-256-GCM으로 암호화할 수 있는 마스터 키 지원
- 개인키 내보내기 기본 비활성화

NFT 구매는 현재 ETH 전송과 NFT 전송이 별도의 온체인 트랜잭션으로 실행됩니다. 완전한
원자적 거래가 필요한 운영 서비스에서는 에스크로 방식의 마켓플레이스 스마트 컨트랙트가
추가로 필요합니다.

## 환경 변수

백엔드 주요 설정은 다음과 같습니다.

- `JWT_SECRET`: 최소 32자의 JWT 서명 키
- `WALLET_MASTER_KEY`: 지갑 암호 보호용 32바이트 Base64 키
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth 자격 증명
- `DATABASE_*`: MySQL 연결 정보
- `RPC_URL`: Sepolia JSON-RPC 주소
- `PRIVATE_KEY`: 초기 ETH 전송, 교환과 보상 민팅에 사용하는 서버 지갑 키
- `TOKEN_ADDRESS`: ERC-20 토큰 컨트랙트 주소
- `NFT_METADATA_HOSTS`: 허용할 NFT 메타데이터 호스트 목록
- `ALLOW_PRIVATE_KEY_EXPORT`: 개인키 내보내기 허용 여부, 기본값 `false`

비밀키와 실제 운영 환경 변수 파일은 Git에 커밋하지 마십시오.

## 실행 방법

Windows PowerShell, Node.js 20 이상, MySQL 8 이상을 기준으로 합니다. 아래 명령은
`C:\Users\sun\Documents\blockchain-project` 프로젝트 루트에서 시작합니다.

### 1. MySQL 스키마 생성

현재 PC의 MySQL 기본 설치 경로를 사용합니다.

```powershell
$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
Get-Content -Raw backend/schema.sql | & $mysql -u root -p
```

명령 실행 후 MySQL `root` 비밀번호를 입력합니다. `mysql.exe`가 PATH에 등록되어 있다면
절대 경로 대신 `mysql` 명령을 사용할 수 있습니다.

### 2. 환경 파일 생성

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

생성된 `backend/.env`에 MySQL, Google OAuth, Sepolia RPC, 서버 지갑과 토큰 주소를
입력합니다. 마스터 키는 다음 명령으로 생성할 수 있습니다.

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Google Cloud Console에는 다음 승인된 리디렉션 URI를 등록합니다.

```text
http://localhost:4000/api/auth/google/callback
```

### 3. 백엔드 실행

첫 번째 PowerShell 터미널에서 실행합니다.

```powershell
cd C:\Users\sun\Documents\blockchain-project\backend
npm.cmd install
npm.cmd test
npm.cmd run check
npm.cmd run dev
```

프롬프트가 이미 `...\blockchain-project\backend>`라면 `cd` 명령은 생략합니다.

### 4. 프런트엔드 실행

두 번째 PowerShell 터미널에서 실행합니다.

```powershell
cd C:\Users\sun\Documents\blockchain-project\frontend
npm.cmd install
npm.cmd run dev
```

프롬프트가 이미 `...\blockchain-project\frontend>`라면 `cd` 명령은 생략합니다.

### 5. 브라우저 접속

```text
http://localhost:5173
```

PowerShell에서 `npm.ps1` 실행 정책 오류가 발생하지 않도록 `npm` 대신 `npm.cmd`를
사용합니다. 실행 정책을 변경할 필요는 없습니다.
