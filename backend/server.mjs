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
import axios from "axios";
import {
  cookieOptions,
  createRateLimiter,
  decryptSecret,
  encryptSecret,
  parseAllowedOrigins,
  parsePositiveInteger,
  requireTrustedOrigin,
  safeEqual,
  securityHeaders,
  validateMetadataUrl,
  validateProfile,
} from "./security.mjs";



/* -------------------------
 환경 변수 / 기본값 체크
------------------------- */
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || (IS_PRODUCTION ? "" : "dev-only-change-me-32-characters-min");
if (JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must contain at least 32 characters");
}
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URL = process.env.GOOGLE_REDIRECT_URL;
const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.FRONTEND_URL);
const FRONTEND_URL = ALLOWED_ORIGINS[0];
const AUTH_COOKIE_OPTIONS = cookieOptions(IS_PRODUCTION);
const WALLET_MASTER_KEY = process.env.WALLET_MASTER_KEY;
if (IS_PRODUCTION && !WALLET_MASTER_KEY) {
  throw new Error("WALLET_MASTER_KEY is required in production");
}
const METADATA_HOSTS = String(process.env.NFT_METADATA_HOSTS || "")
  .split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
const DATABASE_HOST= process.env.DATABASE_HOST;
const DATABASE_USER= process.env.DATABASE_USER;
const DATABASE_PASSWORD= process.env.DATABASE_PASSWORD;
const DATABASE_NAME=process.env.DATABASE_NAME;
const DATABASE_PORT= process.env.DATABASE_PORT;

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
  host: DATABASE_HOST,
  user: DATABASE_USER,
  password: DATABASE_PASSWORD,
  database: DATABASE_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  port: DATABASE_PORT
});

/* -------------------------
 JWT Helper
------------------------- */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: "HS256",
    audience: "blockchain-project-frontend",
    issuer: "blockchain-project-backend",
    expiresIn: '7d'
  });
}

/* -------------------------
 Express 앱 설정
------------------------- */
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(securityHeaders);
app.use(cookieParser());
app.use(express.json({ limit: "32kb", strict: true }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin.replace(/\/$/, ""))) return callback(null, true);
    return callback(new Error("Origin is not allowed"));
  },
  credentials: true
}));
app.use(requireTrustedOrigin(ALLOWED_ORIGINS));

const authRateLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 60 });
const sensitiveRateLimit = createRateLimiter({ windowMs: 60 * 1000, max: 10 });

/* -------------------------
 Google OAuth Login URL
------------------------- */
app.get('/api/auth/google/login', authRateLimit, (req, res) => {
  const state = crypto.randomBytes(32).toString("hex");
  res.cookie("oauth_state", state, { ...AUTH_COOKIE_OPTIONS, maxAge: 10 * 60 * 1000 });
  const url = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    state,
  });
  res.redirect(url);
});

/* -------------------------
 Google OAuth Callback
------------------------- */
app.get('/api/auth/google/callback', authRateLimit, async (req, res) => {
  try {
    const code = req.query.code;
    const state = req.query.state;
    if (!code || !state || !safeEqual(state, req.cookies.oauth_state)) {
      return res.status(400).json({ error: "Invalid OAuth callback" });
    }
    res.clearCookie("oauth_state", AUTH_COOKIE_OPTIONS);

    const { tokens } = await googleClient.getToken(code);
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload?.email_verified) return res.status(403).json({ error: "Google email is not verified" });
    const email = payload.email;
    const name = payload.name || "";
    const sub = payload.sub;

    const [rows] = await db.query("SELECT * FROM users WHERE sub=?", [sub]);
    let user;

    
    if (rows.length > 0) { // 기존 사용자
      user = rows[0];
    } else {  // 신규 사용자
      const wallet = ethers.Wallet.createRandom();

      // 암호화용 비밀번호 생성
      const walletPassword = crypto.randomBytes(32).toString("hex");
      const encryptedKey = await wallet.encrypt(walletPassword);

      // encryptedKey 분할
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

      // wallets1 저장
      await db.query(
        `INSERT INTO wallets1 (sub, address, encrypted_key)
         VALUES (?, ?, ?)`,
        [sub, wallet.address, encryptedKeyPart1]
      );

      // wallets2 저장
      await db.query(
        `INSERT INTO wallets2 (sub, encrypted_key, pw)
         VALUES (?, ?, ?)`,
        [sub, encryptedKeyPart2, encryptSecret(walletPassword, WALLET_MASTER_KEY)]
      );

      // 기초 자본 0.0001 sepoliaETH
      try {
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        const serverWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        const tx = await serverWallet.sendTransaction({
          to: wallet.address,
          value: ethers.parseEther("0.0001")
        });

        console.log("Initial ETH transfer:", tx.hash);
        await tx.wait(); // 전송 완료까지 대기
      } catch (err) {
        console.error("🔥 Error while sending initial ETH:", err);
      }

      const [created] = await db.query("SELECT * FROM users WHERE id=?", [id]);
      user = created[0];
    }

    // JWT 발급
    const token = signToken({ id: user.id });
    res.cookie("token", token, { ...AUTH_COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.redirect(`${FRONTEND_URL}/mypage`);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Google OAuth failed" });
  }
});


/* -------------------------
 JWT 인증 미들웨어
------------------------- */
function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Not logged in" });

  try {
    req.user = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      audience: "blockchain-project-frontend",
      issuer: "blockchain-project-backend",
    });
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
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

/* -------------------------
 사용자 잔액 조회
------------------------- */
// server.mjs 중간에 추가

// ERC20 잔액 조회 API
app.get("/api/balances", authMiddleware, async (req, res) => {
  try {
    // 사용자 지갑 주소 조회
    const [[user]] = await db.query(
      "SELECT w.address AS wallet_address FROM users u LEFT JOIN wallets1 w ON u.sub = w.sub WHERE u.id=?",
      [req.user.id]
    );

    if (!user || !user.wallet_address) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

    // 1️⃣ Sepolia ETH 잔액
    const balanceWei = await provider.getBalance(user.wallet_address);
    const ethBalance = parseFloat(ethers.formatEther(balanceWei)).toFixed(8);

    // 2️⃣ ERC20 토큰 잔액
    const tokenAddress = process.env.TOKEN_ADDRESS;
    const ERC20_ABI = [
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ];
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    const rawTokenBalance = await tokenContract.balanceOf(user.wallet_address);
    const tokenBalance = parseFloat(ethers.formatUnits(rawTokenBalance, 0)).toFixed(0);

    res.json({ ethBalance, tokenBalance });
  } catch (err) {
    console.error("잔액 조회 실패:", err);
    res.status(500).json({ ethBalance: "N/A", tokenBalance: "N/A", error: "Balance lookup failed" });
  }
});


/* -------------------------
 사용자 개인키 다운로드
------------------------- */
app.get("/api/download-private-key", authMiddleware, sensitiveRateLimit, async (req, res) => {
  try {
    if (process.env.ALLOW_PRIVATE_KEY_EXPORT !== "true") {
      return res.status(403).json({ message: "Private key export is disabled" });
    }
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
    const walletPassword = decryptSecret(w2.pw, WALLET_MASTER_KEY);

    // 4) 복호화 (ethers)
    // fromEncryptedJson expects the JSON string (the keystore)
    const wallet = await ethers.Wallet.fromEncryptedJson(fullEncryptedKey, walletPassword);
    const privateKey = wallet.privateKey; // 0x....

    // 5) 임시 파일 생성 후 전송
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="my_private_key.txt"');
    res.send(privateKey);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to decrypt or download private key" });
  }
});

/* -------------------------
 회원 정보 수정
------------------------- */

app.put("/users/update", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, id } = validateProfile(req.body || {});

    const [rows] = await db.query("SELECT name, id FROM users WHERE id = ?", [userId]);
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    const current = rows[0];

    const newName = name === "" ? current.name : name;
    const newId = id === "" ? current.id : id;

    if (id !== "" && newId !== current.id) {
      const [dupCheck] = await db.query(
        "SELECT id FROM users WHERE id = ? AND id != ?",
        [newId, current.id]
      );
      if (dupCheck.length > 0) return res.status(409).json({ error: "이미 사용 중인 ID입니다." });
    }

    // DB 업데이트
    await db.query("UPDATE users SET name = ?, id = ? WHERE id = ?", [newName, newId, current.id]);

    // 🔹 JWT 재발급
    const newToken = signToken({ id: newId });
    res.cookie("token", newToken, {
      httpOnly: true,
      secure: true, // 배포 시 true
      sameSite: "none",
      ...AUTH_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({ success: true, name: newName, id: newId });
  } catch (err) {
    console.error(err);
    const badInput = err.message?.startsWith("Invalid") || err.message?.startsWith("ID must");
    res.status(badInput ? 400 : 500).json({ error: badInput ? err.message : "Server error" });
  }
});





app.post("/users/check-id", authMiddleware, async (req, res) => {
  try {
    const { id } = validateProfile({ id: req.body?.id });
    if (!id || id.trim() === "") return res.status(400).json({ error: "ID를 입력해주세요." });

    const [rows] = await db.query("SELECT id FROM users WHERE id = ?", [id]);
    res.json({ available: rows.length === 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


/* -------------------------
 로그아웃
------------------------- */
app.post('/api/logout', (req, res) => {
  res.clearCookie("token", AUTH_COOKIE_OPTIONS);
  res.json({ ok: true });
});

/* -------------------------
 NFT 목록
------------------------- */
app.get("/api/nfts", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT nfts.tokenID, nfts.address AS contractAddress
      FROM nfts
    `);

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

    const nftArray = [];
    for (const row of rows) {
      const NFTABI = JSON.parse(fs.readFileSync("./abi/SHINUNFT.json", "utf8"));
      const contract = new ethers.Contract(row.contractAddress, NFTABI, provider);
      
      // tokenURI 가져오기
      const tokenURI = await contract.tokenURI(row.tokenID);
      const metadataUrl = validateMetadataUrl(tokenURI, METADATA_HOSTS);
      const metadata = (await axios.get(metadataUrl, {
        headers: { 'User-Agent': 'NFTFetcher/1.0' },
        timeout: 5000,
        maxContentLength: 1024 * 1024,
        maxRedirects: 0,
      })).data;

      // 스마트 컨트랙트에서 실제 소유자 지갑 조회
      let onChainOwner = null;
      let walletSub = null;
      let ownerId = null;
      
      try {
        onChainOwner = await contract.ownerOf(row.tokenID);

        // wallet1에서 sub 조회
        const [walletRows] = await db.query(
          "SELECT sub FROM wallets1 WHERE address = ?",
          [onChainOwner]
        );
        if (walletRows.length > 0) {
          walletSub = walletRows[0].sub;

          // users에서 id 조회
          const [userRows] = await db.query(
            "SELECT id FROM users WHERE sub = ?",
            [walletSub]
          );
          if (userRows.length > 0) {
            ownerId = userRows[0].id;
          }
        }
      } catch (err) {
        console.warn(`⚠️ ownerOf 조회 실패 tokenID=${row.tokenID}:`, err.message);
      }

      nftArray.push({
        tokenID: row.tokenID,
        contractAddress: row.contractAddress,
        name: metadata.name,
        image: metadata.image,
        onChainOwner,  
        ownerId     // 최종 users 테이블 id
      });
    }

    return res.json({ success: true, result: nftArray });
  } catch (e) {
    console.error("❌ /nfts error:", e);
    return res.status(500).json({ success: false, error: "NFT 조회 실패" });
  }
});

/* -------------------------
 환전하기
------------------------- */
app.post("/api/exchange", authMiddleware, sensitiveRateLimit, async (req, res) => {
  try {
    const amount = parsePositiveInteger(req.body?.amount);

    // 1) 사용자 id -> sub 조회
    const [[userRow]] = await db.query("SELECT sub FROM users WHERE id=?", [req.user.id]);
    if (!userRow) return res.status(404).json({ message: "User not found" });
    const sub = userRow.sub;

    if (!userRow) return res.status(400).json({ error: "지갑 정보 없음" });

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
    const walletPassword = decryptSecret(w2.pw, WALLET_MASTER_KEY);

    // 4) 복호화 (ethers)
    // 사용자 지갑 객체 생성
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = await ethers.Wallet.fromEncryptedJson(fullEncryptedKey, walletPassword);
    const privateKey = wallet.privateKey;
    const userWallet = new ethers.Wallet(privateKey, provider);
    const userAddress = userWallet.address;

    // 서버 지갑
    const serverWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const serverAddress = serverWallet.address;

    // 토큰 컨트랙트
    const tokenAddress = process.env.TOKEN_ADDRESS;
    const ERC20_ABI = [
      "function transfer(address to, uint amount) public returns (bool)",
      "function decimals() public view returns (uint8)"
    ];
    const tokenContractUser = new ethers.Contract(tokenAddress, ERC20_ABI, userWallet);

    // 소수점 조회
    const rawAmount = amount;

    //  사용자 → 서버  토큰 전송
    const txToken = await tokenContractUser.transfer(serverAddress, rawAmount);
    await txToken.wait();

    // 비율 계산 1 token = 0.0001 ETH
    const ethAmount = amount * 100000000000000n;

    // 서버 → 사용자 ETH 송금
    const txETH = await serverWallet.sendTransaction({
      to: userAddress,
      value: ethAmount,
    });
    await txETH.wait();

    return res.json({
      success: true,
      message: `사용자로부터 ${amount} Token을 받고 ${ethers.formatEther(ethAmount)} ETH 전송 완료`,
      ethReceived: ethers.formatEther(ethAmount)
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Exchange failed" });
  }
});


/* -------------------------
 NFT Detail, NFT 거래
------------------------- */
// trade 테이블 정보 확인
app.get("/api/trades/:contractAddress/:tokenID", async (req, res) => {
  const { contractAddress, tokenID } = req.params;
  try {
    const [rows] = await db.query(
      "SELECT seq, tokenID, address, price, completed_at FROM trades WHERE tokenID=? AND address=? AND receiver IS NULL",
      [tokenID, contractAddress]
    );
    return res.json({ success: true, trades: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// trades 전체 조회
app.get("/api/trades", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT seq, tokenID, address, price, IF(receiver IS NULL, NULL, 'reserved') AS receiver, completed_at FROM trades"
    );
    res.json({ success: true, result: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// NFT 판매/구매 관련 API
app.post("/api/trades/:action", authMiddleware, async (req, res) => {
  const { action } = req.params; // sell, updatePrice, cancel, buy
  const { tokenID, contractAddress, price, seq } = req.body;

  try {
    if (!["sell", "updatePrice", "cancel", "buy"].includes(action)) {
      return res.status(400).json({ success: false, message: "Unknown action" });
    }
    const [[currentUser]] = await db.query(
      `SELECT u.sub, w.address FROM users u
       JOIN wallets1 w ON u.sub = w.sub WHERE u.id = ?`,
      [req.user.id]
    );
    if (!currentUser) return res.status(404).json({ message: "User wallet not found" });
    if (action === "sell") {
      const normalizedAddress = ethers.getAddress(contractAddress);
      const normalizedTokenId = String(tokenID ?? "").trim();
      if (!/^\d+$/.test(normalizedTokenId) || BigInt(normalizedTokenId) > BigInt(Number.MAX_SAFE_INTEGER)) {
        return res.status(400).json({ message: "Invalid token ID" });
      }
      const priceWei = ethers.parseEther(String(price));
      if (priceWei <= 0n || priceWei > ethers.parseEther("100")) {
        return res.status(400).json({ message: "Invalid sale price" });
      }
      const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      const NFTABI = JSON.parse(fs.readFileSync("./abi/SHINUNFT.json", "utf8"));
      const contract = new ethers.Contract(normalizedAddress, NFTABI, provider);
      const owner = await contract.ownerOf(normalizedTokenId);
      if (owner.toLowerCase() !== currentUser.address.toLowerCase()) {
        return res.status(403).json({ message: "Only the on-chain owner can list this NFT" });
      }
      // 판매 등록
      await db.query(
        "INSERT INTO trades (tokenID, address, price, nft_owner) VALUES (?, ?, ?, ?)",
        [normalizedTokenId, normalizedAddress, ethers.formatEther(priceWei), currentUser.sub]
      );
      return res.json({ success: true, message: "판매 등록 완료" });
    }

    if (action === "updatePrice") {
      const priceWei = ethers.parseEther(String(price));
      if (priceWei <= 0n || priceWei > ethers.parseEther("100")) {
        return res.status(400).json({ message: "Invalid sale price" });
      }
      // 가격 수정
      const [result] = await db.query(
        "UPDATE trades SET price = ? WHERE seq = ? AND nft_owner = ? AND receiver IS NULL",
        [ethers.formatEther(priceWei), seq, currentUser.sub]
      );
      if (result.affectedRows !== 1) return res.status(403).json({ message: "Not allowed to update this trade" });
      return res.json({ success: true, message: "가격 수정 완료" });
    }

    if (action === "cancel") {
      // 거래 취소
      const [result] = await db.query(
        "DELETE FROM trades WHERE seq = ? AND nft_owner = ? AND receiver IS NULL",
        [seq, currentUser.sub]
      );
      if (result.affectedRows !== 1) return res.status(403).json({ message: "Not allowed to cancel this trade" });
      return res.json({ success: true, message: "거래 취소 완료" });
    }

    if (action === "buy") {
      let reserved = false;
      let paymentSent = false;
      try {
        // ① 거래 조회
        const [[trade]] = await db.query("SELECT * FROM trades WHERE seq=? AND receiver IS NULL", [seq]);
        if (!trade) return res.status(404).json({ message: "거래 없음" });

        const tokenID = trade.tokenID;
        const price = trade.price;
        const nftAddress = trade.address;
        const sellerSub = trade.nft_owner;  // 판매자의 sub 저장되어 있다고 가정

        // ② 구매자 sub 조회
        const buyerSub = currentUser.sub;
        if (buyerSub === sellerSub) return res.status(400).json({ message: "You cannot buy your own NFT" });

        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

        // ================ 구매자 지갑 복호화 ================
        const [bw1] = await db.query("SELECT encrypted_key, address FROM wallets1 WHERE sub=?", [buyerSub]);
        const [bw2] = await db.query("SELECT encrypted_key, pw FROM wallets2 WHERE sub=?", [buyerSub]);
        if (bw1.length === 0 || bw2.length === 0) return res.status(404).json({ message: "구매자 지갑 없음" });

        const buyerEncrypted = String(bw1[0].encrypted_key) + String(bw2[0].encrypted_key);
        const buyerWalletPw = decryptSecret(bw2[0].pw, WALLET_MASTER_KEY);
        const buyerWalletDecrypted = await ethers.Wallet.fromEncryptedJson(buyerEncrypted, buyerWalletPw);
        const buyerWallet = new ethers.Wallet(buyerWalletDecrypted.privateKey, provider);
        const buyerAddress = buyerWallet.address;

        // ================ 판매자 지갑 복호화 ================
        const [sw1] = await db.query("SELECT encrypted_key, address FROM wallets1 WHERE sub=?", [sellerSub]);
        const [sw2] = await db.query("SELECT encrypted_key, pw FROM wallets2 WHERE sub=?", [sellerSub]);
        if (sw1.length === 0 || sw2.length === 0) return res.status(404).json({ message: "판매자 지갑 없음" });

        const sellerEncrypted = String(sw1[0].encrypted_key) + String(sw2[0].encrypted_key);
        const sellerWalletPw = decryptSecret(sw2[0].pw, WALLET_MASTER_KEY);
        const sellerWalletDecrypted = await ethers.Wallet.fromEncryptedJson(sellerEncrypted, sellerWalletPw);
        const sellerWallet = new ethers.Wallet(sellerWalletDecrypted.privateKey, provider);
        const sellerAddress = sellerWallet.address;

        // ================ NFT ABI 로드 ================
        const NFTABI = JSON.parse(fs.readFileSync("./abi/SHINUNFT.json", "utf8"));
        const nftContract = new ethers.Contract(nftAddress, NFTABI, sellerWallet);
        const owner = await nftContract.ownerOf(tokenID);
        if (owner.toLowerCase() !== sellerAddress.toLowerCase()) {
          return res.status(409).json({ message: "Seller no longer owns this NFT" });
        }
        const [reservation] = await db.query(
          "UPDATE trades SET receiver=? WHERE seq=? AND receiver IS NULL",
          [buyerSub, seq]
        );
        if (reservation.affectedRows !== 1) return res.status(409).json({ message: "Trade is already being processed" });
        reserved = true;

        // ================ 1) 구매자가 판매자에게 ETH 전송 ================
        const txETH = await buyerWallet.sendTransaction({
          to: sellerAddress,
          value: ethers.parseEther(price.toString()),
        });
        await txETH.wait();
        paymentSent = true;

        // ================ 2) 판매자가 구매자에게 NFT 전송 ================
        const txNFT = await nftContract.transferFrom(sellerAddress, buyerAddress, tokenID);
        await txNFT.wait();

        // ================ DB 업데이트 ================
        await db.query(
          "UPDATE trades SET completed_at=NOW() WHERE seq=? AND receiver=?",
          [seq, buyerSub]
        );

        return res.json({
          success: true,
          message: "NFT 구매 성공",
          buyer: buyerAddress,
          seller: sellerAddress,
          price
        });

    } catch (err) {
      console.error(err);
      if (reserved && !paymentSent) {
        await db.query("UPDATE trades SET receiver=NULL WHERE seq=? AND completed_at IS NULL", [seq]);
      }
      return res.status(500).json({
          success: false,
          message: "서버 내부 오류가 발생했습니다.",
          error: "Trade execution failed"
      });
    }
  }

    res.status(400).json({ success: false, message: "Unknown action" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* -------------------------
 게임 제출 API
------------------------- */
app.post("/api/game/submit", authMiddleware, sensitiveRateLimit, async (req, res) => {
  try {
    const input = typeof req.body?.input === "string" ? req.body.input.trim() : "";
    if (!input || input.length > 20 || Buffer.byteLength(input, "utf8") > 80) {
      return res.status(400).json({ error: "INVALID_INPUT" });
    }
    const [[authenticatedUser]] = await db.query("SELECT sub FROM users WHERE id=?", [req.user.id]);
    if (!authenticatedUser) return res.status(401).json({ error: "UNAUTHORIZED" });
    const sub = authenticatedUser.sub;

    // SHA256 해시
    const hashHex = crypto.createHash("sha256").update(input).digest("hex");
    const last16 = hashHex.slice(-16).toUpperCase();

    // 범위 체크
    const success = last16 >= LOW && last16 <= HIGH;

    // 중복 체크 (문자열 기준)
    const [existing] = await db.query("SELECT * FROM answers WHERE str = ?", [input]);
    if (existing.length > 0) {
      return res.json({
        success: false,
        duplicate: true,
        answer: last16,
        low: LOW,
        high: HIGH
      });
    }

    // 범위 성공 시 DB 저장
    if (success) {
      await db.query(
        "INSERT INTO answers (answer, sub, str, answered_at) VALUES (?, ?, ?, NOW())",
        [last16, sub, input]
      );
    }

    return res.json({
      success,
      duplicate: false,
      answer: last16,
      low: LOW,
      high: HIGH
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/* -------------------------
 리워드 관련
------------------------- */
app.post("/api/reward/open", authMiddleware, sensitiveRateLimit, async (req, res) => {
  let claimId;
  try {
    const [[user]] = await db.query(
      "SELECT u.sub, w.address FROM users u JOIN wallets1 w ON u.sub = w.sub WHERE u.id = ?",
      [req.user.id]
    );

    if (!user || !user.address)
      return res.status(400).json({ error: "사용자 지갑 주소가 없습니다." });

    const [[answer]] = await db.query(
      `SELECT a.str FROM answers a
       LEFT JOIN reward_claims r ON r.answer_str = a.str
       WHERE a.sub = ? AND r.id IS NULL
       ORDER BY a.answered_at ASC LIMIT 1`,
      [user.sub]
    );
    if (!answer) return res.status(409).json({ error: "No unclaimed successful answer" });

    const [claimResult] = await db.query(
      "INSERT INTO reward_claims (answer_str, sub, status) VALUES (?, ?, 'pending')",
      [answer.str, user.sub]
    );
    claimId = claimResult.insertId;
    const to = user.address;
    const amount = 1; // 지급 수량 1

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

    // 서버 지갑으로 서명 (privateKey는 .env에 넣어둠)
    const serverWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const tokenAddress = process.env.TOKEN_ADDRESS;
    const ERC20_ABI = [
      "function mint(address to, uint256 amount) public",
    ];
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, serverWallet);

    // 민팅
    const tx = await tokenContract.mint(to, amount);
    await db.query("UPDATE reward_claims SET status='submitted', tx_hash=? WHERE id=?", [tx.hash, claimId]);
    await tx.wait();
    await db.query("UPDATE reward_claims SET status='completed', completed_at=NOW() WHERE id=?", [claimId]);

    res.json({
      success: true,
      contractAddress: tokenAddress,
      to,
      amount,
      txHash: tx.hash
    });
  } catch (err) {
    console.error(err);
    if (claimId) await db.query("DELETE FROM reward_claims WHERE id=? AND tx_hash IS NULL", [claimId]);
    res.status(500).json({ success: false, error: "Reward transaction failed" });
  }
});

/* -------------------------
 리워드를 받아간 기록
------------------------- */
app.get("/api/reward/history", async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT a.str, u.id AS userId, a.answered_at
      FROM answers a
      JOIN users u ON a.sub = u.sub
      ORDER BY a.answered_at ASC
      `
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* -------------------------
 서버 시작
------------------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on ${PORT}`));
