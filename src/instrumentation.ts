export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertEncryptionKey } = await import('./lib/encrypt')
    assertEncryptionKey()
  }
}
