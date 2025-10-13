import { grant, deny, requireAll, requireAny, safePermissionCheck } from '../../src/lib/permissions';
import { PermissionResult } from '../../src/types/permissions';

describe('Permission Library', () => {
  describe('grant()', () => {
    it('should create a grant result', () => {
      const result = grant('user1', 'media1', 'media-read', 'Test reason');
      expect(result.granted).toBe(true);
      expect(result.operation).toBe('media-read');
      expect(result.reason).toBe('Test reason');
      expect(result.userId).toBe('user1');
      expect(result.resourceId).toBe('media1');
    });
    
    it('should include reason code and metadata when provided', () => {
      const result = grant('user1', 'media1', 'media-read', 'Test', 'PUBLIC_MEDIA', { facets: ['public'] });
      expect(result.reasonCode).toBe('PUBLIC_MEDIA');
      expect(result.metadata).toEqual({ facets: ['public'] });
    });
  });
  
  describe('deny()', () => {
    it('should create a deny result', () => {
      const result = deny('user1', 'media1', 'media-read', 'Test deny');
      expect(result.granted).toBe(false);
      expect(result.operation).toBe('media-read');
      expect(result.reason).toBe('Test deny');
    });
  });
  
  describe('requireAll()', () => {
    it('should return granted if all permissions granted', () => {
      const r1 = grant('u1', 'r1', 'op1', 'reason1');
      const r2 = grant('u1', 'r2', 'op2', 'reason2');
      const result = requireAll(r1, r2);
      expect(result.granted).toBe(true);
    });
    
    it('should return denied if any permission denied', () => {
      const r1 = grant('u1', 'r1', 'op1', 'reason1');
      const r2 = deny('u1', 'r2', 'op2', 'reason2');
      const result = requireAll(r1, r2);
      expect(result.granted).toBe(false);
      expect(result).toBe(r2);
    });
    
    it('should return first denied permission', () => {
      const r1 = grant('u1', 'r1', 'op1', 'reason1');
      const r2 = deny('u1', 'r2', 'op2', 'reason2');
      const r3 = deny('u1', 'r3', 'op3', 'reason3');
      const result = requireAll(r1, r2, r3);
      expect(result).toBe(r2);
    });
  });
  
  describe('requireAny()', () => {
    it('should return granted if any permission granted', () => {
      const r1 = deny('u1', 'r1', 'op1', 'reason1');
      const r2 = grant('u1', 'r2', 'op2', 'reason2');
      const result = requireAny(r1, r2);
      expect(result.granted).toBe(true);
      expect(result).toBe(r2);
    });
    
    it('should return denied if all permissions denied', () => {
      const r1 = deny('u1', 'r1', 'op1', 'reason1');
      const r2 = deny('u1', 'r2', 'op2', 'reason2');
      const result = requireAny(r1, r2);
      expect(result.granted).toBe(false);
      expect(result).toBe(r1);
    });
    
    it('should return first granted permission', () => {
      const r1 = deny('u1', 'r1', 'op1', 'reason1');
      const r2 = grant('u1', 'r2', 'op2', 'reason2');
      const r3 = grant('u1', 'r3', 'op3', 'reason3');
      const result = requireAny(r1, r2, r3);
      expect(result).toBe(r2);
    });
  });
  
  describe('safePermissionCheck()', () => {
    it('should return result when check succeeds', async () => {
      const checkFn = () => grant('u1', 'r1', 'op1', 'success');
      const result = await safePermissionCheck(checkFn);
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('success');
    });
    
    it('should return denial when check throws error', async () => {
      const checkFn = () => {
        throw new Error('Database error');
      };
      const result = await safePermissionCheck(checkFn, 'test-op');
      expect(result.granted).toBe(false);
      expect(result.operation).toBe('test-op');
      expect(result.reasonCode).toBe('PERMISSION_CHECK_ERROR');
    });
    
    it('should handle async check functions', async () => {
      const checkFn = async () => {
        return grant('u1', 'r1', 'op1', 'async success');
      };
      const result = await safePermissionCheck(checkFn);
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('async success');
    });
  });
});

