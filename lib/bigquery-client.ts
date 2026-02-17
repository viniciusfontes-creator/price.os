/**
 * BigQuery Client Configuration
 * 
 * This module provides BigQuery client without direct SDK imports.
 * The actual SDK import happens dynamically at runtime.
 * 
 * Requires environment variables:
 * - GCP_PROJECT_ID: Your Google Cloud project ID
 * - GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON (optional if using workload identity)
 */

// Type for BigQuery-like client
export interface BigQueryClientType {
    query: (options: string | { query: string; params?: Record<string, unknown> }) => Promise<[any[]]>
}

let bigQueryClient: BigQueryClientType | null = null

/**
 * Get or create BigQuery client instance
 * Uses dynamic require to avoid webpack bundling
 */
export async function getBigQueryClient(): Promise<BigQueryClientType> {
    if (!bigQueryClient) {
        const projectId = process.env.GCP_PROJECT_ID
        const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS

        if (!projectId) {
            throw new Error('GCP_PROJECT_ID environment variable is not set')
        }

        // Use dynamic import to prevent bundling issues
        const { BigQuery } = await import('@google-cloud/bigquery')

        const config: Record<string, any> = {
            projectId,
            location: process.env.BQ_LOCATION || 'us',
        }

        const clientEmail = process.env.GCP_CLIENT_EMAIL
        const privateKey = process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n')

        if (clientEmail && privateKey) {
            config.credentials = {
                client_email: clientEmail,
                private_key: privateKey,
            }
        } else if (keyFilename) {
            config.keyFilename = keyFilename
        }

        bigQueryClient = new BigQuery(config) as unknown as BigQueryClientType
    }

    return bigQueryClient as BigQueryClientType
}

/**
 * Execute a BigQuery SQL query and return typed results
 */
export async function executeQuery<T = Record<string, unknown>>(
    sql: string,
    params?: Record<string, unknown>
): Promise<T[]> {
    const client = await getBigQueryClient()

    const options: { query: string; params?: Record<string, unknown> } = { query: sql }
    if (params) {
        options.params = params
    }

    const [rows] = await client.query(options)
    return rows as T[]
}
