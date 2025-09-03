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
 * Create namespaced queue names for video processing
 */
export function createNamespacedVideoQueues() {
  return {
    requests: createNamespacedName('media.video.processing.requests'),
    updates: createNamespacedName('media.video.processing.updates')
  }
}

/**
 * Create namespaced queue names for image processing
 */
export function createNamespacedImageQueues() {
  return {
    requests: createNamespacedName('media.images.processing.requests'),
    updates: createNamespacedName('media.images.processing.updates')
  }
}

/**
 * Create namespaced queue names for staged processing
 */
export function createNamespacedStagedQueues(mediaType: 'video' | 'images') {
  const prefix = `media.${mediaType}.processing`
  return {
    download: createNamespacedName(`${prefix}.download`),
    processing: createNamespacedName(`${prefix}.processing`),
    upload: createNamespacedName(`${prefix}.upload`),
    cleanup: createNamespacedName(`${prefix}.cleanup`),
    updates: createNamespacedName(`${prefix}.updates`)
  }
}
