import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { nanoid } from 'nanoid';
import { ethers } from 'ethers';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

/* --------------------------
   JWT Helper
-------------------------- */
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

/* --------------------------
   Start Server
-------------------------- */
const app = express();
app.use(cors());
app.use(express.json());

/* --------------------------
   lowdb v6+
-------------------------- */
const defaultData = {
  users: [],
  nfts: [],
  trades: [],
  tokens_tx: [],
  trade_requests: [],
  submissions: [],
  hex_ranges: [
    { id: 'range1', start: '0000000000000000', end: '00ffffffffffffff', active: true }
  ]
};

const adapter = new JSONFile('./db.json');
const db = new Low(adapter, defaultData);

// 초기 DB 세팅
await db.read();
db.data ||= defaultData;
db.data ||= {
  users: [],
  nfts: [],
  trades: [],
  tokens_tx: [],
  trade_requests: [],
  submissions: [],
  hex_ranges: [
    { id: 'range1', start: '0000000000000000', end: '00ffffffffffffff', active: true }
  ],
  nfts: [
    {
      id: '1',
      token_id: null,
      contract_address: null,
      title: 'Genesis Art',
      metadata_url: '',
      owner_user_id: null,
      listed_price: null,
      for_sale: false,
      created_at: Date.now()
    }
  ]
};
await db.write();

/* --------------------------
   Routes
-------------------------- */
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Signup
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email/password required' });

  const exists = db.data.users.find(u => u.email === email);
  if (exists) return res.status(400).json({ error: 'Already exists' });

  const passHash = await bcrypt.hash(password, 10);
  const wallet = ethers.Wallet.createRandom();
  const encryptedKey = await wallet.encrypt(password);

  const user = {
    id: nanoid(),
    email,
    name: name || '',
    password_hash: passHash,
    wallet_address: wallet.address,
    encrypted_private_key: encryptedKey,
    oauth_provider: null,
    created_at: Date.now()
  };

  db.data.users.push(user);
  await db.write();

  const token = signToken({ id: user.id, email });
  res.json({ ok: true, token, user: { id: user.id, email, wallet_address: wallet.address } });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.data.users.find(u => u.email === email);
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

  const token = signToken({ id: user.id, email });
  res.json({ ok: true, token, user: { id: user.id, wallet_address: user.wallet_address, email } });
});

// Hex ranges
app.get('/api/hex-ranges', (req, res) => {
  const ranges = db.data.hex_ranges.filter(r => r.active);
  res.json({ ok: true, ranges });
});

// Submit input
app.post('/api/submit', authMiddleware, async (req, res) => {
  const { input } = req.body;
  if (!input) return res.status(400).json({ error: 'input required' });

  const fullHash = crypto.createHash('sha256').update(String(input)).digest('hex');
  const last16 = fullHash.slice(-16);

  const range = db.data.hex_ranges.find(r => r.active);
  if (!range) return res.status(500).json({ error: 'No active range' });

  const v = BigInt('0x' + last16);
  const a = BigInt('0x' + range.start);
  const b = BigInt('0x' + range.end);
  const success = v >= a && v <= b;

  const sub = {
    id: nanoid(),
    user_id: req.user.id,
    input_text: input,
    hash_hex_full: fullHash,
    hash_last16: last16,
    result: success ? 'success' : 'fail',
    created_at: Date.now()
  };
  db.data.submissions.push(sub);
  await db.write();

  if (!success) return res.json({ ok: false, msg: 'Not in range', submission: sub });

  // Token minting optional
  if (!process.env.PROVIDER_URL || !process.env.OPERATOR_PRIVATE_KEY || !process.env.TOKEN_CONTRACT_ADDRESS) {
    return res.json({ ok: true, msg: 'Success. Token mint skipped.', submission: sub });
  }

  try {
    const provider = new ethers.JsonRpcProvider(process.env.PROVIDER_URL);
    const signer = new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);
    const tokenAbi = ["function mint(address to, uint256 amount) external"];
    const contract = new ethers.Contract(process.env.TOKEN_CONTRACT_ADDRESS, tokenAbi, signer);

    const user = db.data.users.find(u => u.id === req.user.id);
    const tx = await contract.mint(user.wallet_address, ethers.parseUnits("10", 18));
    await tx.wait();

    db.data.tokens_tx.push({
      id: nanoid(),
      user_id: user.id,
      amount: 10,
      tx_hash: tx.hash,
      status: 'done',
      created_at: Date.now()
    });
    await db.write();

    return res.json({ ok: true, msg: 'Success. Token minted.', txHash: tx.hash, submission: sub });
  } catch (e) {
    return res.json({ ok: false, msg: 'Matched but mint failed', error: e.message, submission: sub });
  }
});

// NFT List
app.get('/api/nfts', (req, res) => {
  const usersMap = Object.fromEntries(db.data.users.map(u => [u.id, u]));
  const nfts = db.data.nfts.map(n => ({
    ...n,
    owner_name: n.owner_user_id ? (usersMap[n.owner_user_id]?.name || usersMap[n.owner_user_id]?.email) : null
  }));
  res.json({ ok: true, nfts });
});

// NFT Detail
app.get('/api/nfts/:id', (req, res) => {
  const nft = db.data.nfts.find(n => n.id === req.params.id);
  if (!nft) return res.status(404).json({ error: 'not found' });

  const owner = db.data.users.find(u => u.id === nft.owner_user_id);
  res.json({ ok: true, nft: { ...nft, owner_name: owner ? owner.name || owner.email : null } });
});

// Trade Request
app.post('/api/nfts/:id/request-trade', authMiddleware, async (req, res) => {
  const { offered_price } = req.body;
  const nft = db.data.nfts.find(n => n.id === req.params.id);
  if (!nft) return res.status(404).json({ error: 'not found' });
  if (!nft.owner_user_id) return res.status(400).json({ error: 'NFT has no owner' });

  const tr = {
    id: nanoid(),
    nft_id: nft.id,
    buyer_user_id: req.user.id,
    offered_price: offered_price || null,
    status: 'pending',
    created_at: Date.now()
  };
  db.data.trade_requests.push(tr);
  await db.write();

  res.json({ ok: true, msg: 'Trade request submitted', trade_request: tr });
});

// My Page
app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.data.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'not found' });

  const myNfts = db.data.nfts.filter(n => n.owner_user_id === user.id);
  const myTokensTx = db.data.tokens_tx.filter(t => t.user_id === user.id);
  const myRequests = db.data.trade_requests.filter(t =>
    t.buyer_user_id === user.id || db.data.nfts.find(n => n.id === t.nft_id)?.owner_user_id === user.id
  );

  res.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      wallet_address: user.wallet_address,
      encrypted_private_key: !!user.encrypted_private_key
    },
    nfts: myNfts,
    tokens_tx: myTokensTx,
    trade_requests: myRequests
  });
});

// Admin Mint NFT
app.post('/api/admin/mint-nft', async (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (secret !== (process.env.ADMIN_SECRET || 'admin_secret'))
    return res.status(401).json({ error: 'unauthorized' });

  const { title, owner_user_id } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  const nft = {
    id: nanoid(),
    token_id: null,
    contract_address: null,
    title,
    metadata_url: '',
    owner_user_id: owner_user_id || null,
    listed_price: null,
    for_sale: false,
    created_at: Date.now()
  };

  db.data.nfts.push(nft);
  await db.write();
  res.json({ ok: true, nft });
});

/* --------------------------
   Start Server
-------------------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on ${PORT}`));
