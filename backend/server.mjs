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

/* -------------------------
 환경 변수
------------------------- */
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URL = process.env.GOOGLE_REDIRECT_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;

// 서버 시작 시 랜덤으로 16자리 16진수 두 개 생성 (한 번만)
function randomHex16() {
  return crypto.randomBytes(8).toString("hex"); // 8바이트 = 16자리 16진수
}

const RANDOM_LOW = randomHex16();
const RANDOM_HIGH = randomHex16();
const [LOW, HIGH] = RANDOM_LOW < RANDOM_HIGH ? [RANDOM_LOW, RANDOM_HIGH] : [RANDOM_HIGH, RANDOM_HIGH];

console.log("Random range for game:", RANDOM_LOW, RANDOM_HIGH);

/* -------------------------
 Google OAuth 클라이언트
------------------------- */
const googleClient = new OAuth2Client({
  clientId: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  redirectUri: GOOGLE_REDIRECT_URL
});

/* -------------------------
 MySQL 연결
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
    const sub = payload.sub; // Google ID

    // 사용자 확인
    const [rows] = await db.query("SELECT * FROM users WHERE sub=?", [sub]);
    let user;
    if (rows.length > 0) {
      user = rows[0];
    } else {
      const wallet = ethers.Wallet.createRandom();
      const encryptedKey = await wallet.encrypt(crypto.randomBytes(32).toString("hex"));
      const id = nanoid();
      const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

      await db.query(
        `INSERT INTO users (sub, id, name, email, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [sub, id, name, email, createdAt]
      );

      await db.query(
        `INSERT INTO wallets (sub, address, private_key)
         VALUES (?, ?, ?)`,
        [sub, wallet.address, encryptedKey]
      );

      const [created] = await db.query("SELECT * FROM users WHERE id=?", [id]);
      user = created[0];
    }

    // JWT 쿠키 발급
    const token = signToken({ id: user.id });
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
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
       LEFT JOIN wallets w ON u.sub = w.sub
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
 로그아웃
------------------------- */
app.post('/api/logout', (req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
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

app.post("/api/reward/open", async (req, res) => {
  const user = req.user; // 세션 또는 JWT로 가져오는 유저
  if (!user) return res.status(401).json({ msg: "login required" });

  // 소유주가 없는 NFT 중 랜덤 선택
  const nft = await db("nfts")
    .whereNull("nft_owner")
    .orderByRaw("RAND()")
    .first();

  if (!nft) return res.status(400).json({ msg: "지급 가능한 NFT 없음" });

  // 소유권 부여
  await db("nfts")
    .where("address", nft.address)
    .update({ nft_owner: user.wallet_address });

  res.json(nft);
});

// 리워드 기록
app.get("/api/reward/history", async (req, res) => {
  const user = req.user;
  if (!user) return res.json([]);

  const history = await db("nfts")
    .where("nft_owner", user.wallet_address)
    .orderBy("id", "desc");

  res.json(history);
});


/* -------------------------
 서버 시작
------------------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on ${PORT}`));
