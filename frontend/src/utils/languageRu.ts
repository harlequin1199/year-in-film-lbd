const languageMap: Record<string, string> = {
  en: 'Английский',
  ru: 'Русский',
  ja: 'Японский',
  ko: 'Корейский',
  fr: 'Французский',
  de: 'Немецкий',
  it: 'Итальянский',
  es: 'Испанский',
  pt: 'Португальский',
  zh: 'Китайский',
  cn: 'Китайский',
  zho: 'Китайский',
  hi: 'Хинди',
  sv: 'Шведский',
  da: 'Датский',
  no: 'Норвежский',
  fi: 'Финский',
  nl: 'Нидерландский',
  pl: 'Польский',
  tr: 'Турецкий',
  ar: 'Арабский',
  he: 'Иврит',
  th: 'Тайский',
  id: 'Индонезийский',
  vi: 'Вьетнамский',
  uk: 'Украинский',
  cs: 'Чешский',
  kk: 'Казахский',
  kaz: 'Казахский',
}

export const getLanguageRu = (code: string | null | undefined): string => {
  if (!code) return ''
  const key = String(code).toLowerCase()
  return languageMap[key] || 'Неизвестный язык'
}
