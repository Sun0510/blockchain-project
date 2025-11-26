import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { ethers } from 'ethers';
import mysql from "mysql2/promise";
import { OAuth2Client } from "google-auth-library";

/* -------------------------
 환경 변수
------------------------- */
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URL = process.env.GOOGLE_REDIRECT_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;

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

function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'No token' });
  const token = h.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/* -------------------------
 Express 앱 설정
------------------------- */
const app = express();
app.use(cors());
app.use(express.json());

/* -------------------------
 Health 체크
------------------------- */
app.get('/api/health', (req, res) => res.json({ ok: true }));

/* -------------------------
 Google OAuth 로그인
------------------------- */
app.get('/api/auth/google/login', (req, res) => {
  const url = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"]
  });
  res.redirect(url);
});

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
    const sub = payload.sub; // Google 고유 ID

    // 기존 사용자 확인
    const [rows] = await db.query(
      "SELECT * FROM users WHERE oauth_provider=? AND oauth_sub=?",
      ["google", sub]
    );

    let user;
    if (rows.length > 0) {
      user = rows[0]; // 기존 사용자
    } else {
      // 신규 사용자 → DB + 자동 지갑 생성
      const wallet = ethers.Wallet.createRandom();
      const encryptedKey = await wallet.encrypt(crypto.randomBytes(32).toString("hex"));

      const id = nanoid();
      await db.query(
        `INSERT INTO users (id, email, name, wallet_address, encrypted_private_key, oauth_provider, oauth_sub, created_at)
         VALUES (?, ?, ?, ?, ?, 'google', ?, ?)`,
        [id, email, name, wallet.address, encryptedKey, sub, Date.now()]
      );

      const [created] = await db.query("SELECT * FROM users WHERE id=?", [id]);
      user = created[0];
    }

    // JWT 발급
    const token = signToken({ id: user.id, email: user.email });

    // 프론트엔드로 리다이렉션 + 토큰 전달
    res.redirect(`${FRONTEND_URL}/login-success?token=${token}`);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Google OAuth failed", details: e.message });
  }
});

/* -------------------------
 보호된 API 예시
------------------------- */
app.get('/api/me', authMiddleware, async (req, res) => {
  const [[user]] = await db.query("SELECT * FROM users WHERE id=?", [req.user.id]);
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      wallet_address: user.wallet_address
    }
  });
});

/* -------------------------
 서버 시작
------------------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on ${PORT}`));
