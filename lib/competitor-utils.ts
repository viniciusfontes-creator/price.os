// Competitor Analysis Utilities

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371 // Earth radius in km
    const toRad = (deg: number) => (deg * Math.PI) / 180

    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

/**
 * Filter competitors by proximity to a property
 * @param competitors List of all competitors
 * @param propertyLat Property latitude
 * @param propertyLon Property longitude
 * @param radiusKm Radius in kilometers
 * @returns Filtered competitors within radius
 */
export function filterCompetitorsByProximity<T extends { latitude: number; longitude: number }>(
    competitors: T[],
    propertyLat: number,
    propertyLon: number,
    radiusKm: number = 5
): (T & { distance: number })[] {
    return competitors
        .map((competitor) => ({
            ...competitor,
            distance: calculateDistance(
                propertyLat,
                propertyLon,
                competitor.latitude,
                competitor.longitude
            ),
        }))
        .filter((c) => c.distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance)
}

/**
 * Calculate price gap percentage
 * @param myPrice My property price
 * @param marketPrice Market median/average price
 * @returns Percentage difference
 */
export function calculatePriceGap(myPrice: number, marketPrice: number): number {
    if (marketPrice === 0) return 0
    return ((myPrice - marketPrice) / marketPrice) * 100
}

/**
 * Calculate median of an array of numbers
 * @param values Array of numbers
 * @returns Median value
 */
export function calculateMedian(values: number[]): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid]
}
