// SHA-256, HMAC-SHA256 and PBKDF2-HMAC-SHA256 in plain TypeScript
// (FIPS 180-4, RFC 2104, RFC 8018). The app has no native crypto module, and
// adding one would need a new APK; this ships by OTA. Used for the app PIN
// (specs/mobile-app-pin BR-02). Checked against the NIST / RFC 7914 vectors.

const K = Int32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const IV = Int32Array.from([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const BLOCK_BYTES = 64;
const HASH_BYTES = 32;
// One 32-byte message after a 64-byte key block, in bits: PBKDF2's inner loop.
const KEYED_DIGEST_BITS = (BLOCK_BYTES + HASH_BYTES) * 8;

// One compression of a 16-word block into state; out may be state itself.
function compress(state: Int32Array, block: Int32Array, out: Int32Array, w: Int32Array): void {
  for (let i = 0; i < 16; i++) w[i] = block[i];
  for (let i = 16; i < 64; i++) {
    const x = w[i - 15];
    const y = w[i - 2];
    const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
    const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
    w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
  }
  let a = state[0];
  let b = state[1];
  let c = state[2];
  let d = state[3];
  let e = state[4];
  let f = state[5];
  let g = state[6];
  let h = state[7];
  for (let i = 0; i < 64; i++) {
    const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const t1 = (h + s1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
    const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const t2 = (s0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
    h = g;
    g = f;
    f = e;
    e = (d + t1) | 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) | 0;
  }
  out[0] = (state[0] + a) | 0;
  out[1] = (state[1] + b) | 0;
  out[2] = (state[2] + c) | 0;
  out[3] = (state[3] + d) | 0;
  out[4] = (state[4] + e) | 0;
  out[5] = (state[5] + f) | 0;
  out[6] = (state[6] + g) | 0;
  out[7] = (state[7] + h) | 0;
}

// Hashes data on from state, which has already taken prefixBytes (0 or one
// key block), padding with the total length.
function finish(state: Int32Array, data: Uint8Array, prefixBytes: number): Int32Array {
  const total = prefixBytes + data.length;
  const padded = Math.ceil((data.length + 9) / BLOCK_BYTES) * BLOCK_BYTES;
  const bytes = new Uint8Array(padded);
  bytes.set(data);
  bytes[data.length] = 0x80;
  const bits = total * 8;
  // Lengths here stay far below 2^32 bits; the high word is 0.
  bytes[padded - 4] = (bits >>> 24) & 0xff;
  bytes[padded - 3] = (bits >>> 16) & 0xff;
  bytes[padded - 2] = (bits >>> 8) & 0xff;
  bytes[padded - 1] = bits & 0xff;

  const out = Int32Array.from(state);
  const block = new Int32Array(16);
  const w = new Int32Array(64);
  for (let offset = 0; offset < padded; offset += BLOCK_BYTES) {
    for (let i = 0; i < 16; i++) {
      const p = offset + i * 4;
      block[i] = (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3];
    }
    compress(out, block, out, w);
  }
  return out;
}

function wordsToBytes(words: Int32Array): Uint8Array {
  const out = new Uint8Array(words.length * 4);
  for (let i = 0; i < words.length; i++) {
    out[i * 4] = words[i] >>> 24;
    out[i * 4 + 1] = (words[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (words[i] >>> 8) & 0xff;
    out[i * 4 + 3] = words[i] & 0xff;
  }
  return out;
}

export function sha256(data: Uint8Array): Uint8Array {
  return wordsToBytes(finish(IV, data, 0));
}

// The states after one block of key ^ ipad and key ^ opad (RFC 2104).
function keyedStates(key: Uint8Array): { inner: Int32Array; outer: Int32Array } {
  const k = key.length > BLOCK_BYTES ? sha256(key) : key;
  const ipad = new Int32Array(16);
  const opad = new Int32Array(16);
  for (let i = 0; i < 16; i++) {
    const p = i * 4;
    const word = ((k[p] ?? 0) << 24) | ((k[p + 1] ?? 0) << 16) | ((k[p + 2] ?? 0) << 8) | (k[p + 3] ?? 0);
    ipad[i] = word ^ 0x36363636;
    opad[i] = word ^ 0x5c5c5c5c;
  }
  const w = new Int32Array(64);
  const inner = new Int32Array(8);
  const outer = new Int32Array(8);
  compress(IV, ipad, inner, w);
  compress(IV, opad, outer, w);
  return { inner, outer };
}

export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const { inner, outer } = keyedStates(key);
  return wordsToBytes(finish(outer, wordsToBytes(finish(inner, message, BLOCK_BYTES)), BLOCK_BYTES));
}

/**
 * PBKDF2-HMAC-SHA256. Each iteration after the first is exactly two
 * compressions from the precomputed keyed states, with no allocation.
 */
export function pbkdf2Sha256(password: Uint8Array, salt: Uint8Array, iterations: number, length: number = HASH_BYTES): Uint8Array {
  const { inner, outer } = keyedStates(password);
  const out = new Uint8Array(length);
  const block = new Int32Array(16);
  const tmp = new Int32Array(8);
  const w = new Int32Array(64);
  const saltIndex = new Uint8Array(salt.length + 4);
  saltIndex.set(salt);

  for (let index = 1, offset = 0; offset < length; index++, offset += HASH_BYTES) {
    saltIndex[salt.length] = index >>> 24;
    saltIndex[salt.length + 1] = (index >>> 16) & 0xff;
    saltIndex[salt.length + 2] = (index >>> 8) & 0xff;
    saltIndex[salt.length + 3] = index & 0xff;
    const u = finish(outer, wordsToBytes(finish(inner, saltIndex, BLOCK_BYTES)), BLOCK_BYTES);
    const t = Int32Array.from(u);

    block.fill(0);
    block[8] = 0x80000000 | 0;
    block[15] = KEYED_DIGEST_BITS;
    for (let i = 1; i < iterations; i++) {
      for (let j = 0; j < 8; j++) block[j] = u[j];
      compress(inner, block, tmp, w);
      for (let j = 0; j < 8; j++) block[j] = tmp[j];
      compress(outer, block, u, w);
      for (let j = 0; j < 8; j++) t[j] ^= u[j];
    }
    out.set(wordsToBytes(t).subarray(0, Math.min(HASH_BYTES, length - offset)), offset);
  }
  return out;
}

export function utf8Bytes(value: string): Uint8Array {
  const bytes: number[] = [];
  for (const ch of value) {
    let cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return Uint8Array.from(bytes);
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Equal length and content, in time that does not depend on where they differ. */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
