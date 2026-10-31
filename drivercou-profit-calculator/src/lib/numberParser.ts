const digitMap: Record<string, string> = {
  '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
  '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'
}
export function normalizeDigits(value: string) {
  return value.replace(/[٠-٩۰-۹]/g, d => digitMap[d] || d).replace(/[٬]/g, ',').replace(/[٫]/g, '.')
}
export function parseLocalizedNumber(value: string): number | null {
  let s = normalizeDigits(value).replace(/[^\d.,\-]/g, '')
  if (!s || s === '-') return null
  // Arabic screenshots commonly use comma as decimal separator (e.g. 1,9 km).
  if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '')
  else if (s.includes(',')) s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
export function parseDistance(text: string): number | null {
  const s = normalizeDigits(text.toLowerCase())
  const m = s.match(/([\d.,]+)\s*(متر|م\b|m\b|كم|كلم|كيلومتر|km\b)/i)
  if (!m) return null
  const n = parseLocalizedNumber(m[1])
  if (n === null) return null
  return /متر|م\b|m\b/i.test(m[2]) ? n / 1000 : n
}
export function parseDuration(text: string): number | null {
  const s = normalizeDigits(text.toLowerCase())
  let total = 0
  let found = false
  const hours = s.match(/([\d.,]+)\s*(?:ساعات|ساعة|س(?=[\s،,]|$)|سا|h\b|hr\b)/i)
  const mins = s.match(/([\d.,]+)\s*(?:دقائق|دقيقة|د(?=[\s،,]|$)|دق|m\b|min\b)/i)
  if (hours) { total += (parseLocalizedNumber(hours[1]) || 0) * 60; found = true }
  if (mins) { total += parseLocalizedNumber(mins[1]) || 0; found = true }
  if (!found) {
    const plain = s.match(/([\d.,]+)\s*(?:د|دقيقة|min)/i)
    if (plain) { total = parseLocalizedNumber(plain[1]) || 0; found = true }
  }
  return found ? Math.round(total) : null
}
