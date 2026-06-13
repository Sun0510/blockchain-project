import test from "node:test";
import assert from "node:assert/strict";
import {
  cookieOptions,
  decryptSecret,
  encryptSecret,
  parsePositiveInteger,
  safeEqual,
  validateMetadataUrl,
  validateProfile,
} from "./security.mjs";

test("production cookies are secure", () => {
  assert.deepEqual(cookieOptions(true), {
    httpOnly: true, secure: true, sameSite: "none", path: "/",
  });
  assert.equal(cookieOptions(false).sameSite, "lax");
});

test("positive integer parser rejects unsafe amounts", () => {
  assert.equal(parsePositiveInteger("10"), 10n);
  assert.throws(() => parsePositiveInteger("1.5"));
  assert.throws(() => parsePositiveInteger("-1"));
  assert.throws(() => parsePositiveInteger("1000001"));
});

test("profile input is constrained", () => {
  assert.deepEqual(validateProfile({ name: " Alice ", id: "alice_01" }), { name: "Alice", id: "alice_01" });
  assert.throws(() => validateProfile({ name: "Alice", id: "<script>" }));
});

test("metadata URL validation blocks local addresses", () => {
  assert.throws(() => validateMetadataUrl("http://127.0.0.1/admin"));
  assert.throws(() => validateMetadataUrl("file:///etc/passwd"));
  assert.equal(validateMetadataUrl("https://example.com/nft.json", ["example.com"]), "https://example.com/nft.json");
});

test("constant-time comparison handles mismatched values", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abcd"), false);
});

test("wallet secrets are encrypted with AES-GCM", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const encrypted = encryptSecret("wallet-password", key);
  assert.match(encrypted, /^enc:v1:/);
  assert.equal(decryptSecret(encrypted, key), "wallet-password");
});
