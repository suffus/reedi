/**
 * Utility functions for RabbitMQ queue and exchange namespacing
 */

/**
 * Get the system namespace from environment variable
 * Defaults to "reedi" if SYSTEM_NAME is not set or empty
 */
export function getSystemNamespace(): string {
  const systemName = process.env['SYSTEM_NAME']
  return systemName && systemName.trim() ? systemName.trim() : 'reedi'
}

/**
 * Create a namespaced name for RabbitMQ exchanges and queues
 */
export function createNamespacedName(baseName: string): string {
  const namespace = getSystemNamespace()
  return `${namespace}.${baseName}`
}

/**
 * Create namespaced exchange names
 */
export function createNamespacedExchanges() {
  return {
    requests: createNamespacedName('media.requests'),
    processing: createNamespacedName('media.processing'),
    updates: createNamespacedName('media.updates')
  }
}

/**
 * Create unified namespaced queue names for media processing
 * Single queue for all media types (image, video, zip)
 */
export function createNamespacedMediaQueues() {
  return {
    requests: createNamespacedName('media.processing.requests'),
    updates: createNamespacedName('media.processing.updates')
  }
}
