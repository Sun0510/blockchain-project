import crypto from "crypto";
import net from "net";

export function parseAllowedOrigins(value) {
  return String(value || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function cookieOptions(isProduction) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  };
}

export function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
}

export function requireTrustedOrigin(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    const origin = req.get("origin");
    if (!origin || allowed.has(origin.replace(/\/$/, ""))) return next();
    return res.status(403).json({ error: "Untrusted request origin" });
  };
}

export function createRateLimiter({ windowMs, max }) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({ error: "Too many requests" });
    }
    next();
  };
}

export function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function decodeMasterKey(value) {
  if (!value) return null;
  const key = /^[a-fA-F0-9]{64}$/.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("WALLET_MASTER_KEY must decode to exactly 32 bytes");
  return key;
}

export function encryptSecret(value, masterKeyValue) {
  const key = decodeMasterKey(masterKeyValue);
  if (!key) return String(value);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(value, masterKeyValue) {
  const text = String(value);
  if (!text.startsWith("enc:v1:")) return text;
  const key = decodeMasterKey(masterKeyValue);
  if (!key) throw new Error("WALLET_MASTER_KEY is required to decrypt wallet data");
  const [, , iv, tag, ciphertext] = text.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export function parsePositiveInteger(value, { max = 1_000_000 } = {}) {
  const text = String(value ?? "").trim();
  if (!/^[1-9]\d*$/.test(text)) throw new Error("Value must be a positive integer");
  const parsed = BigInt(text);
  if (parsed > BigInt(max)) throw new Error("Value exceeds the allowed maximum");
  return parsed;
}

export function validateProfile({ name, id }) {
  const cleanName = String(name ?? "").trim();
  const cleanId = String(id ?? "").trim();
  if (cleanName && (cleanName.length > 50 || /[\u0000-\u001f\u007f]/.test(cleanName))) {
    throw new Error("Invalid name");
  }
  if (cleanId && !/^[A-Za-z0-9_-]{3,30}$/.test(cleanId)) {
    throw new Error("ID must be 3-30 letters, numbers, underscores, or hyphens");
  }
  return { name: cleanName, id: cleanId };
}

function isPrivateIp(hostname) {
  if (!net.isIP(hostname)) return false;
  if (hostname === "::1") return true;
  if (hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:")) return true;
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

export function validateMetadataUrl(value, allowedHosts = []) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported metadata URL");
  if (url.username || url.password || isPrivateIp(url.hostname) || url.hostname === "localhost") {
    throw new Error("Unsafe metadata URL");
  }
  if (allowedHosts.length && !allowedHosts.includes(url.hostname.toLowerCase())) {
    throw new Error("Metadata host is not allowed");
  }
  return url.toString();
}
