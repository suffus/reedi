import { parseFacet, facetToString } from '../../src/lib/facets';

describe('Facet Library', () => {
  describe('parseFacet()', () => {
    it('should parse two-part facet', () => {
      const result = parseFacet('user-role:admin');
      expect(result).toEqual({
        scope: 'user-role',
        name: 'admin',
        value: undefined
      });
    });
    
    it('should parse three-part facet', () => {
      const result = parseFacet('org-division:sales:west');
      expect(result).toEqual({
        scope: 'org-division',
        name: 'sales',
        value: 'west'
      });
    });
    
    it('should throw on invalid format', () => {
      expect(() => parseFacet('invalid')).toThrow('Invalid facet format');
    });
    
    it('should handle facet with many colons (only first two matter)', () => {
      const result = parseFacet('scope:name:value:extra:parts');
      expect(result).toEqual({
        scope: 'scope',
        name: 'name',
        value: 'value:extra:parts'
      });
    });
  });
  
  describe('facetToString()', () => {
    it('should convert facet to string without value', () => {
      const result = facetToString({
        scope: 'user-role',
        name: 'admin'
      });
      expect(result).toBe('user-role:admin');
    });
    
    it('should include value if present', () => {
      const result = facetToString({
        scope: 'org-division',
        name: 'sales',
        value: 'west'
      });
      expect(result).toBe('org-division:sales:west');
    });
    
    it('should round-trip parse and stringify', () => {
      const original = 'org-division:sales:west';
      const parsed = parseFacet(original);
      const stringified = facetToString(parsed);
      expect(stringified).toBe(original);
    });
  });
});

