/**
 * Phone number normalization utilities
 * Used to match cotações (Supabase) with reservas (BigQuery) by phone number
 */

/**
 * Normalizes a phone number by removing all non-digit characters,
 * country code (+55), and leading zeros.
 * Returns the last 10-11 digits (DDD + number) for consistent matching.
 * 
 * Examples:
 *   "+55 84 99212 7762"  → "8499212776​2"
 *   "558492138227"       → "8492138227"
 *   "+55 8499470562"     → "8499470562"
 *   "+82 999167642"      → "82999167642" (international, kept as-is)
 */
export function normalizePhone(phone: string | null | undefined): string | null {
    if (!phone || typeof phone !== 'string') return null

    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, '')

    if (digits.length === 0) return null

    // Remove Brazil country code (55) if present at start
    if (digits.startsWith('55') && digits.length >= 12) {
        digits = digits.substring(2)
    }

    // Remove leading zero if present (some formats use 0 before DDD)
    if (digits.startsWith('0') && digits.length === 11) {
        digits = digits.substring(1)
    }

    // We expect 10-11 digits for Brazilian numbers (DDD + 8 or 9 digits)
    if (digits.length < 10 || digits.length > 11) {
        // International or malformed — return as-is for best-effort matching
        return digits
    }

    return digits
}

/**
 * Try to parse a date from various Brazilian formats.
 * Returns ISO date string (YYYY-MM-DD) or null if unparseable.
 * 
 * Supported formats:
 *   "25/02/2026" → "2026-02-25"
 *   "20/04/26"   → "2026-04-20"  
 *   "2026-02-25" → "2026-02-25"
 */
export function parseBrazilianDate(dateStr: string | null | undefined): string | null {
    if (!dateStr || typeof dateStr !== 'string') return null

    const trimmed = dateStr.trim()

    // Already ISO format
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.substring(0, 10)
    }

    // DD/MM/YYYY or DD/MM/YY
    const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
    if (brMatch) {
        const day = brMatch[1].padStart(2, '0')
        const month = brMatch[2].padStart(2, '0')
        let year = brMatch[3]
        if (year.length === 2) {
            year = `20${year}` // 26 → 2026
        }

        // Validate
        const monthNum = parseInt(month)
        const dayNum = parseInt(day)
        if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
            return `${year}-${month}-${day}`
        }
    }

    return null
}

/**
 * Extract destination/praça from cotação destino string.
 * Maps the free-text destino to normalized praça names.
 */
export function normalizeDestino(destino: string | null | undefined): string {
    if (!destino) return 'Não identificado'

    const lower = destino.toLowerCase().trim()

    if (lower.includes('pipa') || lower.includes('tibau do sul')) return 'Pipa'
    if (lower.includes('natal') || lower.includes('litoral sul')) return 'Natal e Litoral Sul'
    if (lower.includes('joão pessoa') || lower.includes('joao pessoa') || lower.includes('cabedelo')) return 'João Pessoa'
    if (lower.includes('milagres')) return 'Milagres'
    if (lower.includes('japaratinga')) return 'Japaratinga'
    if (lower.includes('cotovelo') || lower.includes('pirangi') || lower.includes('búzios') || lower.includes('buzios')) return 'Natal e Litoral Sul'
    if (lower.includes('gostoso') || lower.includes('são miguel')) return 'São Miguel do Gostoso'
    if (lower.includes('bananeiras')) return 'Bananeiras'
    if (lower.includes('jacumã') || lower.includes('jacuma')) return 'Jacumã'
    if (lower.includes('touros')) return 'Touros'

    return 'Outras'
}
