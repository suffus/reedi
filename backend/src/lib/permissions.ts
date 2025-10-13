import { prisma } from '../db';
import { Authentication, PermissionResult, PermissionAuditOptions } from '../types/permissions';

/**
 * Grant permission with reason
 */
export function grant(
  userId: string | null,
  resourceId: string | null,
  operation: string,
  reason: string,
  reasonCode?: string,
  metadata?: Record<string, any>
): PermissionResult {
  return {
    granted: true,
    userId,
    resourceId,
    operation,
    reason,
    reasonCode,
    metadata,
    timestamp: new Date()
  };
}

/**
 * Deny permission with reason
 */
export function deny(
  userId: string | null,
  resourceId: string | null,
  operation: string,
  reason: string,
  reasonCode?: string,
  metadata?: Record<string, any>
): PermissionResult {
  return {
    granted: false,
    userId,
    resourceId,
    operation,
    reason,
    reasonCode,
    metadata,
    timestamp: new Date()
  };
}

/**
 * Log permission decision to audit system
 */
export async function auditPermission(
  result: PermissionResult,
  auth: Authentication,
  resourceType: string,
  options: PermissionAuditOptions = { shouldAudit: true, auditSensitive: true, asyncAudit: true }
): Promise<void> {
  if (!options.shouldAudit) return;

  const auditData = {
    userId: result.userId,
    resourceType,
    resourceId: result.resourceId || '',
    operation: result.operation,
    granted: result.granted,
    reason: result.reason,
    reasonCode: result.reasonCode,
    ipAddress: auth.ipAddress,
    userAgent: auth.userAgent,
    requestId: auth.requestId,
    facetsChecked: result.metadata?.facetsChecked,
    createdAt: result.timestamp
  };

  if (options.asyncAudit) {
    // Send to RabbitMQ for async processing
    // We'll import this dynamically to avoid circular dependencies
    try {
      const { publishToQueue } = await import('../services/rabbitmqService');
      await publishToQueue('permission-audit', auditData).catch(err => {
        console.error('Failed to publish audit log to queue:', err);
        // Fallback to direct DB write if queue fails
        return prisma.permissionAuditLog.create({ data: auditData as any });
      });
    } catch (err) {
      // If RabbitMQ service not available, fall back to direct write
      await prisma.permissionAuditLog.create({ data: auditData as any });
    }
  } else {
    // Direct DB write
    await prisma.permissionAuditLog.create({ data: auditData as any });
  }
}

/**
 * Wrapper to handle permission check errors
 * Ensures errors result in denial (fail-closed)
 */
export async function safePermissionCheck<T>(
  checkFn: () => Promise<PermissionResult> | PermissionResult,
  fallbackOperation: string = 'unknown-operation'
): Promise<PermissionResult> {
  try {
    return await checkFn();
  } catch (error) {
    console.error('Permission check error:', error);
    return deny(
      null,
      null,
      fallbackOperation,
      'Permission check failed due to internal error',
      'PERMISSION_CHECK_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Check multiple permissions and return if ALL are granted
 */
export function requireAll(
  ...results: PermissionResult[]
): PermissionResult {
  const denied = results.find(r => !r.granted);
  if (denied) return denied;
  
  return results[0]; // Return first if all granted
}

/**
 * Check multiple permissions and return if ANY are granted
 */
export function requireAny(
  ...results: PermissionResult[]
): PermissionResult {
  const granted = results.find(r => r.granted);
  if (granted) return granted;
  
  return results[0]; // Return first denial if none granted
}

/**
 * Filter array based on permission checks
 * Returns only items for which permission is granted
 */
export async function filterByPermission<T>(
  items: T[],
  auth: Authentication,
  checkFn: (item: T, auth: Authentication) => Promise<PermissionResult> | PermissionResult
): Promise<T[]> {
  const results = await Promise.all(
    items.map(async item => ({
      item,
      result: await safePermissionCheck(() => checkFn(item, auth))
    }))
  );
  
  return results
    .filter(({ result }) => result.granted)
    .map(({ item }) => item);
}

