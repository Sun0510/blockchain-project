import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { ethers } from 'ethers';
import mysql from "mysql2/promise";
import { OAuth2Client } from "google-auth-library";

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URL = process.env.GOOGLE_REDIRECT_URL;

const googleClient = new OAuth2Client({
  clientId: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  redirectUri: GOOGLE_REDIRECT_URL
});

/* -------------------------
 MySQL Connection
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
 Server Setup
------------------------- */
const app = express();
app.use(cors());
app.use(express.json());

/* -------------------------
 Routes
------------------------- */
app.get('/api/health', (req, res) => res.json({ ok: true }));

/* -------------------------
 Google OAuth Login
------------------------- */
app.get('/api/auth/google/login', (req, res) => {
  const url = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"]
  });
  res.json({ ok: true, url });
});

app.get('/api/auth/google/callback', async (req, res) => {
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
  const sub = payload.sub; // Google unique user id

  const [rows] = await db.query("SELECT * FROM users WHERE oauth_provider=? AND oauth_sub=?", ["google", sub]);

  let user;
  if (rows.length > 0) {
    // 이미 가입된 사용자
    user = rows[0];
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

  const token = signToken({ id: user.id, email: user.email });
  return res.json({
    ok: true,
    token,
    user: { id: user.id, email: user.email, name: user.name, wallet_address: user.wallet_address }
  });
});

/* -------------------------
 Submit Input
------------------------- */
app.post('/api/submit', authMiddleware, async (req, res) => {
  const { input } = req.body;
  if (!input) return res.status(400).json({ error: 'input required' });

  const fullHash = crypto.createHash('sha256').update(String(input)).digest('hex');
  const last16 = fullHash.slice(-16);

  const [[range]] = await db.query("SELECT * FROM hex_ranges WHERE active=1 LIMIT 1");
  if (!range) return res.status(500).json({ error: 'No active range' });

  const v = BigInt('0x' + last16);
  const a = BigInt('0x' + range.start);
  const b = BigInt('0x' + range.end);
  const success = v >= a && v <= b;

  const id = nanoid();
  await db.query(
    `INSERT INTO submissions (id, user_id, input_text, hash_hex_full, hash_last16, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, req.user.id, input, fullHash, last16, success ? 'success' : 'fail', Date.now()]
  );

  if (!success) return res.json({ ok: false, msg: 'Not in range' });

  if (!process.env.PROVIDER_URL || !process.env.OPERATOR_PRIVATE_KEY || !process.env.TOKEN_CONTRACT_ADDRESS) {
    return res.json({ ok: true, msg: 'Success. Token mint skipped.' });
  }

  try {
    const provider = new ethers.JsonRpcProvider(process.env.PROVIDER_URL);
    const signer = new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);
    const tokenAbi = ["function mint(address to, uint256 amount) external"];
    const contract = new ethers.Contract(process.env.TOKEN_CONTRACT_ADDRESS, tokenAbi, signer);

    const [[user]] = await db.query("SELECT * FROM users WHERE id=?", [req.user.id]);
    const tx = await contract.mint(user.wallet_address, ethers.parseUnits("10", 18));
    await tx.wait();

    await db.query(
      `INSERT INTO tokens_tx (id, user_id, amount, tx_hash, status, created_at)
       VALUES (?, ?, ?, ?, 'done', ?)`,
      [nanoid(), req.user.id, 10, tx.hash, Date.now()]
    );

    return res.json({ ok: true, msg: 'Success. Token minted.', txHash: tx.hash });

  } catch (e) {
    return res.json({ ok: false, msg: 'Matched but mint failed', error: e.message });
  }
});

/* -------------------------
 NFT List
------------------------- */
app.get('/api/nfts', async (req, res) => {
  const [rows] = await db.query(`
    SELECT n.*, u.name AS owner_name, u.email AS owner_email
    FROM nfts n
    LEFT JOIN users u ON n.owner_user_id = u.id
  `);
  res.json({ ok: true, nfts: rows });
});

/* -------------------------
 NFT Detail
------------------------- */
app.get('/api/nfts/:id', async (req, res) => {
  const [rows] = await db.query(`
    SELECT n.*, u.name AS owner_name, u.email AS owner_email
    FROM nfts n
    LEFT JOIN users u ON n.owner_user_id = u.id
    WHERE n.id = ?
  `, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true, nft: rows[0] });
});

/* -------------------------
 Trade Request
------------------------- */
app.post('/api/nfts/:id/request-trade', authMiddleware, async (req, res) => {
  const { offered_price } = req.body;
  const id = nanoid();
  await db.query(
    `INSERT INTO trade_requests (id, nft_id, buyer_user_id, offered_price, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
    [id, req.params.id, req.user.id, offered_price, Date.now()]
  );
  res.json({ ok: true, msg: 'Trade request submitted' });
});

/* -------------------------
 My Page
------------------------- */
app.get('/api/me', authMiddleware, async (req, res) => {
  const [[user]] = await db.query("SELECT * FROM users WHERE id=?", [req.user.id]);
  if (!user) return res.status(404).json({ error: 'not found' });

  const [nfts] = await db.query("SELECT * FROM nfts WHERE owner_user_id=?", [user.id]);
  const [tokens_tx] = await db.query("SELECT * FROM tokens_tx WHERE user_id=?", [user.id]);
  const [trade_requests] = await db.query(
    `SELECT * FROM trade_requests WHERE buyer_user_id=? OR nft_id IN (SELECT id FROM nfts WHERE owner_user_id=?)`,
    [user.id, user.id]
  );

  res.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      wallet_address: user.wallet_address
    },
    nfts, tokens_tx, trade_requests
  });
});

/* -------------------------
 Admin Mint NFT
------------------------- */
app.post('/api/admin/mint-nft', async (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (secret !== (process.env.ADMIN_SECRET || 'admin_secret'))
    return res.status(401).json({ error: 'unauthorized' });

  const { title, owner_user_id } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  const id = nanoid();
  await db.query(
    `INSERT INTO nfts (id, token_id, contract_address, title, metadata_url, owner_user_id, listed_price, for_sale, created_at)
     VALUES (?, NULL, NULL, ?, '', ?, NULL, 0, ?)`,
    [id, title, owner_user_id || null, Date.now()]
  );

  res.json({ ok: true, nft: { id, title, owner_user_id } });
});

/* -------------------------
 Launch Server
------------------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on ${PORT}`));
