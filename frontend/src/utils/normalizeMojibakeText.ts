function latin1Bytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i += 1) {
    out[i] = text.charCodeAt(i) & 0xff
  }
  return out
}

function decodeUtf8FromLatin1(text: string): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(latin1Bytes(text))
}

function decodeCp1251FromLatin1(text: string): string {
  return new TextDecoder('windows-1251').decode(latin1Bytes(text))
}

export function normalizeMojibakeText(text: string): string {
  if (!text) return text

  // Typical UTF-8 text read as Latin1 (e.g., "Ð¡ÐµÑ€...").
  if (/(?:Ð[\u0080-\u00BF]|Ñ[\u0080-\u00BF]|Ã[\u0080-\u00BF]|ï¿½)/.test(text)) {
    try {
      return decodeUtf8FromLatin1(text)
    } catch {
      return text
    }
  }

  // Typical CP1251 text read as Latin1 (e.g., "Ñåðâèñ...").
  if (/[À-ÿ]/.test(text) && !/[\u0400-\u04FF]/.test(text)) {
    try {
      return decodeCp1251FromLatin1(text)
    } catch {
      return text
    }
  }

  return text
}
