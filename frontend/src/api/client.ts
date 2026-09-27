// App é 100% client-side (sem backend) — este módulo só existe para o hash de
// deduplicação de logs, usado por `logStore.addLog`.

export async function computeHash(file: File): Promise<string> {
  const buffer     = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer)
  const hex        = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `sha1:${hex}`
}
