export function safeNumber(v: unknown): number {
  if (typeof v === 'number') {
    return Number.isFinite(v) ? v : 0
  }
  if (typeof v === 'string') {
    const trimmed = v.trim()
    if (!trimmed) return 0
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export function calculateRoi(revenue: number, time: number): number {
  const rev = safeNumber(revenue)
  const t = safeNumber(time)
  if (!Number.isFinite(rev) || !Number.isFinite(t) || t <= 0) return 0
  return rev / t
}

export function formatNumber(n: number, decimals = 2): string {
  const v = Number.isFinite(n) ? n : 0
  return v.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatCurrency(n: number, currency: string = 'USD'): string {
  const v = Number.isFinite(n) ? n : 0
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(v)
  } catch {
    // Fallback in case of unsupported currency
    return '$' + formatNumber(v)
  }
}
