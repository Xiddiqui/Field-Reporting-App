type RandomSource = { getRandomValues?: <T extends ArrayBufferView>(array: T) => T }

// RFC 4122 v4 UUID. Uses crypto.getRandomValues when the runtime provides it, falling back to
// Math.random: the ID only has to be unique (it is an idempotency key), not secret.
export const uuidv4 = (): string => {
  const bytes = new Uint8Array(16)
  const crypto = (globalThis as { crypto?: RandomSource }).crypto
  if (crypto?.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  // Version (4) and variant (RFC 4122) bits
  // eslint-disable-next-line no-bitwise
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  // eslint-disable-next-line no-bitwise
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
