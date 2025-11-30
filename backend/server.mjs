// server.mjs
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { ethers } from 'ethers';
import mysql from "mysql2/promise";
import cookieParser from 'cookie-parser';
import { OAuth2Client } from "google-auth-library";
import fs from 'fs';
import os from 'os';
import path from 'path';
import axios from "axios";



/* -------------------------
 환경 변수 / 기본값 체크
------------------------- */
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn("⚠️ JWT_SECRET is not set. Using a development default. Do NOT use this in production.");
  JWT_SECRET = 'dev_jwt_secret';
}
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URL = process.env.GOOGLE_REDIRECT_URL;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/* -------------------------
 랜덤 범위 (버그 수정)
------------------------- */
function randomHex16() {
  return crypto.randomBytes(8).toString("hex"); // 8바이트 = 16 hex chars
}

const RANDOM_LOW = randomHex16();
const RANDOM_HIGH = randomHex16();
// 정렬이 목적이면 올바르게 정렬
const [LOW, HIGH] = RANDOM_LOW < RANDOM_HIGH ? [RANDOM_LOW, RANDOM_HIGH] : [RANDOM_HIGH, RANDOM_LOW];

console.log("Random range for game:", LOW, HIGH);

/* -------------------------
 Google OAuth 클라이언트
------------------------- */
const googleClient = new OAuth2Client({
  clientId: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  redirectUri: GOOGLE_REDIRECT_URL
});

/* -------------------------
 MySQL 연결 (mysql2 pool)
------------------------- */
const db = await mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'blockchain_service',
  waitForConnections: true,
  connectionLimit: 10,
  port: 3306
});

/* -------------------------
 JWT Helper
------------------------- */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/* -------------------------
 Express 앱 설정
------------------------- */
const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

/* -------------------------
 Google OAuth Login URL
------------------------- */
app.get('/api/auth/google/login', (req, res) => {
  const url = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
  });
  res.redirect(url);
});

/* -------------------------
 Google OAuth Callback
------------------------- */
app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).json({ error: "No code" });

    const { tokens } = await googleClient.getToken(code);
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name || "";
    const sub = payload.sub;

    // 기존 사용자 확인
    const [rows] = await db.query("SELECT * FROM users WHERE sub=?", [sub]);
    let user;

    if (rows.length > 0) {
      user = rows[0];
    } else {
      // 새 지갑 생성
      const wallet = ethers.Wallet.createRandom();

      // 암호화용 비밀번호 생성
      const walletPassword = crypto.randomBytes(32).toString("hex");
      const encryptedKey = await wallet.encrypt(walletPassword);

      // encryptedKey 분리 (앞 512, 뒤 나머지)
      const encryptedKeyPart1 = encryptedKey.slice(0, 512);
      const encryptedKeyPart2 = encryptedKey.slice(512);

      const id = nanoid();
      const createdAt = new Date().toISOString().slice(0, 19).replace("T", " ");

      // users 테이블 추가
      await db.query(
        `INSERT INTO users (sub, id, name, email, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [sub, id, name, email, createdAt]
      );

      // wallets1 테이블 저장 → 앞 512자리
      await db.query(
        `INSERT INTO wallets1 (sub, address, encrypted_key)
         VALUES (?, ?, ?)`,
        [sub, wallet.address, encryptedKeyPart1]
      );

      // wallets2 테이블 저장 → 나머지 + 비밀번호
      await db.query(
        `INSERT INTO wallets2 (sub, encrypted_key, pw)
         VALUES (?, ?, ?)`,
        [sub, encryptedKeyPart2, walletPassword]
      );

      const [created] = await db.query("SELECT * FROM users WHERE id=?", [id]);
      user = created[0];
    }

    // JWT 발급 (id를 페이로드로)
    const token = signToken({ id: user.id });
    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // 개발용: 배포에서는 true(HTTPS)로 설정하세요
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.redirect(`${FRONTEND_URL}/mypage`);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Google OAuth failed", details: e.message });
  }
});

/* -------------------------
 JWT 인증 미들웨어
------------------------- */
function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Not logged in" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* -------------------------
 보호된 API: 현재 사용자 정보
------------------------- */
app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const [[user]] = await db.query(
      `SELECT u.id, u.email, u.name, w.address AS wallet_address
       FROM users u
       LEFT JOIN wallets1 w ON u.sub = w.sub
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch user", details: e.message });
  }
});

/* -------------------------
 사용자 개인키 다운로드
------------------------- */
app.get("/api/download-private-key", authMiddleware, async (req, res) => {
  try {
    // 1) 사용자 id -> sub 조회
    const [[userRow]] = await db.query("SELECT sub FROM users WHERE id=?", [req.user.id]);
    if (!userRow) return res.status(404).json({ message: "User not found" });
    const sub = userRow.sub;

    // 2) wallets1, wallets2 조회
    const [w1rows] = await db.query("SELECT encrypted_key, address FROM wallets1 WHERE sub=?", [sub]);
    const [w2rows] = await db.query("SELECT encrypted_key, pw FROM wallets2 WHERE sub=?", [sub]);

    if (w1rows.length === 0 || w2rows.length === 0) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    const w1 = w1rows[0];
    const w2 = w2rows[0];

    // 3) encryptedKey 재조합
    const fullEncryptedKey = String(w1.encrypted_key) + String(w2.encrypted_key);
    const walletPassword = w2.pw;

    // 4) 복호화 (ethers)
    // fromEncryptedJson expects the JSON string (the keystore)
    const wallet = await ethers.Wallet.fromEncryptedJson(fullEncryptedKey, walletPassword);
    const privateKey = wallet.privateKey; // 0x....

    // 5) 임시 파일 생성 후 전송
    const tmpDir = os.tmpdir();
    const filename = `private_key_${req.user.id}.txt`;
    const filePath = path.join(tmpDir, filename);

    await fs.promises.writeFile(filePath, privateKey, { encoding: 'utf8', mode: 0o600 });

    res.download(filePath, "my_private_key.txt", async (err) => {
      try {
        await fs.promises.unlink(filePath);
      } catch (unlinkErr) {
        console.error("Failed to delete temp private key file:", unlinkErr);
      }
      if (err) {
        console.error("Res.download error:", err);
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to decrypt or download private key", details: err.message });
  }
});

/* -------------------------
 로그아웃
------------------------- */
app.post('/api/logout', (req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

/* -------------------------
 NFT 목록
------------------------- */
app.get("/api/nfts", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT nfts.tokenID, nfts.address AS contractAddress, users.id AS ownerid
      FROM nfts
      LEFT JOIN users ON users.sub = nfts.nft_owner
    `);

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

    const nftArray = [];
    for (const row of rows) {
      const NFTABI = JSON.parse(fs.readFileSync("./abi/SHINUNFT.json", "utf8"));
      const contract = new ethers.Contract(row.contractAddress, NFTABI, provider);
      const tokenURI = await contract.tokenURI(row.tokenID);
      const metadataURL = tokenURI;
      const metadata = (await axios.get(metadataURL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NFTFetcher/1.0)'
        }
      })).data;
      
      nftArray.push({
        tokenID: row.tokenID,
        contractAddress: row.contractAddress,
        name: metadata.name,
        image: metadata.image,
        ownerid: row.ownerid || null
      });
    }

    return res.json({ success: true, result: nftArray });
  } catch (e) {
    console.error("❌ /nfts error:", e);
    return res.status(500).json({ success: false, error: "NFT 조회 실패" });
  }
});



/* -------------------------
 게임 제출 API
------------------------- */
app.post("/api/game/submit", authMiddleware, async (req, res) => {
  try {
    const { input } = req.body;
    if (!input || input.length > 20)
      return res.status(400).json({ error: "INVALID_INPUT" });

    // SHA256 해시
    const hashHex = crypto.createHash("sha256").update(input).digest("hex");
    const last16 = hashHex.slice(-16).toUpperCase();

    // 범위 체크
    const success = last16 >= LOW && last16 <= HIGH;

    // DB 처리
    const answeredAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    const sub = req.user.id;

    // 중복 체크
    const [existing] = await db.query(
      "SELECT * FROM answers WHERE answer=? AND sub=?",
      [last16, sub]
    );

    if (success) {
      if (existing.length > 0) {
        // 이미 등록된 정답
        return res.json({
          success: false,
          duplicate: true,
          answer: last16,
          low: LOW,
          high: HIGH
        });
      }

      // 신규 정답 저장
      await db.query(
        "INSERT INTO answers (answer, sub, str, answered_at) VALUES (?, ?, ?, ?)",
        [last16, sub, input, answeredAt]
      );
    }

    res.json({
      success,
      duplicate: false,
      answer: last16,
      low: LOW,
      high: HIGH
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "SERVER_ERROR", message: e.message });
  }
});

/* -------------------------
 리워드 관련 (원래 knex 스타일이었음 → 여기서는 미구현으로 처리)
------------------------- */
app.post("/api/reward/open", authMiddleware, async (req, res) => {
  return res.status(501).json({ msg: "Not implemented (reward.open)" });
});

app.get("/api/reward/history", authMiddleware, async (req, res) => {
  return res.status(501).json({ msg: "Not implemented (reward.history)" });
});

/* -------------------------
 서버 시작
------------------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on ${PORT}`));
