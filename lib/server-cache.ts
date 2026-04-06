/**
 * Server-side In-Memory Cache
 * 
 * Provides a TTL-based cache for expensive BigQuery calls.
 * Since Next.js API routes run in the same Node process,
 * this cache is shared across all requests and prevents
 * redundant BigQuery queries within the cache window.
 */

interface CacheEntry<T> {
    data: T
    timestamp: number
    expiresAt: number
}

class ServerCache {
    private cache = new Map<string, CacheEntry<any>>()
    private defaultTTL: number

    constructor(defaultTTLSeconds: number = 300) {
        this.defaultTTL = defaultTTLSeconds * 1000 // convert to ms
    }

    /**
     * Get cached data if available and not expired
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key)
        if (!entry) return null

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key)
            return null
        }

        return entry.data as T
    }

    /**
     * Set cache data with optional TTL override
     */
    set<T>(key: string, data: T, ttlSeconds?: number): void {
        const ttl = (ttlSeconds ?? this.defaultTTL / 1000) * 1000
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            expiresAt: Date.now() + ttl,
        })
    }

    /**
     * Execute a function with caching. If cached data exists and isn't expired,
     * return it. Otherwise, execute the function and cache the result.
     */
    async getOrFetch<T>(key: string, fetchFn: () => Promise<T>, ttlSeconds?: number): Promise<T> {
        const cached = this.get<T>(key)
        if (cached !== null) {
            return cached
        }

        const data = await fetchFn()
        this.set(key, data, ttlSeconds)
        return data
    }

    /**
     * Invalidate a specific cache entry
     */
    invalidate(key: string): void {
        this.cache.delete(key)
    }

    /**
     * Invalidate all cache entries
     */
    invalidateAll(): void {
        this.cache.clear()
    }

    /**
     * Get cache stats for debugging
     */
    getStats(): { entries: number; keys: string[] } {
        // Clean expired entries first
        const now = Date.now()
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key)
            }
        }

        return {
            entries: this.cache.size,
            keys: Array.from(this.cache.keys()),
        }
    }
}

// Singleton instance with 5-minute default TTL
// This survives across API requests in the same Node process
export const serverCache = new ServerCache(300)

// Cache keys for BigQuery data
export const CACHE_KEYS = {
    DASHBOARD_DATA: 'dashboard-data',
    PRICING_INTELLIGENCE: 'pricing-intelligence',
    COTACOES: 'cotacoes-data',
    BASKETS_PROPERTIES: 'baskets-properties',
    BASKETS_TARIFARIO: 'baskets-tarifario',
} as const
