import { webcrypto } from 'crypto'
import 'dotenv/config'

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto
}
