/**
 * PropStack API Client Unit Tests
 * @author andreas@siglochconsulting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PropStackClient } from '../src/propstack-client.js';

describe('Unit: PropStackClient', () => {
  let client: PropStackClient;

  beforeEach(() => {
    client = new PropStackClient({ apiKey: 'test-key-12345' });
  });

  describe('constructor', () => {
    it('should require API key', () => {
      expect(() => new PropStackClient({ apiKey: '' })).toThrow(
        'PropStack API key is required'
      );
    });

    it('should enforce HTTPS', () => {
      expect(client['baseUrl']).toBe('https://api.propstack.de/v1');
    });
  });

  describe('sanitizeSearchQuery', () => {
    it('should remove dangerous characters', () => {
      const dangerous = "APARTMENT; DROP TABLE users;--";
      const sanitized = client['sanitizeSearchQuery'](dangerous);

      expect(sanitized).not.toContain(';');
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).not.toContain("'");
      expect(sanitized).not.toContain('"');
    });

    it('should preserve valid query text', () => {
      const valid = 'APARTMENT-123';
      const sanitized = client['sanitizeSearchQuery'](valid);

      expect(sanitized).toBe(valid);
    });
  });

  describe('sanitizeError', () => {
    it('should redact API keys from error messages', () => {
      const error = new Error('Request failed with key=secret-123');
      const sanitized = client['sanitizeError'](error);

      expect(sanitized.message).not.toContain('secret-123');
      expect(sanitized.message).toContain('key=***');
    });

    it('should redact tokens from error messages', () => {
      const error = new Error('Auth failed: bearer token12345');
      const sanitized = client['sanitizeError'](error);

      expect(sanitized.message).not.toContain('token12345');
      expect(sanitized.message).toContain('bearer ***');
    });
  });

  describe('searchProperties', () => {
    it('should build correct query parameters with defaults', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: { total_count: 0 } }),
      });
      global.fetch = mockFetch;

      await client.searchProperties({
        price_from: 300000,
        price_to: 500000,
        plot_area: 1500,
        property_type: 'APARTMENT',
      });

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('per=500');
      expect(callUrl).toContain('with_meta=1');
      expect(callUrl).not.toContain('expand=1'); // Removed for efficiency (75% less data)
      expect(callUrl).toContain('price_from=300000');
      expect(callUrl).toContain('price_to=500000');
      expect(callUrl).toContain('plot_area=1500');
      expect(callUrl).toContain('property_type=APARTMENT');
    });

    it('should sanitize property_type parameter', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: { total_count: 0 } }),
      });
      global.fetch = mockFetch;

      await client.searchProperties({
        property_type: "APARTMENT'; DROP TABLE--",
      });

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).not.toContain(';');
      expect(callUrl).not.toContain("'");
    });

    it('should handle data/meta response format', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 1, unit_id: '123', name: 'Test', images: [] }],
          meta: { total_count: 1 },
        }),
      });
      global.fetch = mockFetch;

      const result = await client.searchProperties();

      expect(result.units).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.units[0].id).toBe(1);
    });
  });

  describe('getProperty', () => {
    it('should fetch property via search with unit_id parameter', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{
            id: 2071903,
            unit_id: '2071903',
            name: 'Test Property',
            images: [],
          }],
          meta: { total_count: 1 },
        }),
      });
      global.fetch = mockFetch;

      const property = await client.getProperty('2071903');

      expect(property.id).toBe(2071903);
      expect(property.unit_id).toBe('2071903');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('unit_id=2071903'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-KEY': 'test-key-12345',
          }),
        })
      );
    });

    it('should throw error when property not found', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [],
          meta: { total_count: 0 },
        }),
      });
      global.fetch = mockFetch;

      await expect(client.getProperty('999999')).rejects.toThrow(
        'Property with unit_id 999999 not found'
      );
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      global.fetch = mockFetch;

      await expect(client.getProperty('999999')).rejects.toThrow(
        'PropStack API error: 404 Not Found'
      );
    });

    it('should sanitize credentials in error messages', async () => {
      const mockFetch = vi.fn().mockRejectedValue(
        new Error('Auth failed with key=secret-123')
      );
      global.fetch = mockFetch;

      try {
        await client.getProperty('2071903');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).not.toContain('secret-123');
        expect((error as Error).message).toContain('key=***');
      }
    });
  });

  describe('authentication', () => {
    it('should include X-API-KEY header in all requests', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: { total_count: 0 } }),
      });
      global.fetch = mockFetch;

      await client.searchProperties();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-KEY': 'test-key-12345',
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('listStatuses', () => {
    it('should fetch property statuses', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 133880, name: 'Vermarktung', color: '#green', position: 1, nonpublic: false },
            { id: 133881, name: 'Reserviert', color: '#yellow', position: 2, nonpublic: false },
          ],
        }),
      });
      global.fetch = mockFetch;

      const statuses = await client.listStatuses();

      expect(statuses).toHaveLength(2);
      expect(statuses[0].id).toBe(133880);
      expect(statuses[0].name).toBe('Vermarktung');
    });
  });

  describe('normalizeStatusParam', () => {
    it('should convert semantic names to IDs', () => {
      expect(PropStackClient.normalizeStatusParam('vermarktung')).toBe('133880');
      expect(PropStackClient.normalizeStatusParam('reserviert')).toBe('133881');
      expect(PropStackClient.normalizeStatusParam('akquise')).toBe('133878');
    });

    it('should handle comma-separated values', () => {
      expect(PropStackClient.normalizeStatusParam('vermarktung,reserviert')).toBe('133880,133881');
      expect(PropStackClient.normalizeStatusParam('akquise, vorbereitung, vermarktung')).toBe('133878,133879,133880');
    });

    it('should preserve numeric IDs', () => {
      expect(PropStackClient.normalizeStatusParam('133880')).toBe('133880');
      expect(PropStackClient.normalizeStatusParam('133880,133881')).toBe('133880,133881');
    });

    it('should handle mixed semantic and numeric values', () => {
      expect(PropStackClient.normalizeStatusParam('vermarktung,133881')).toBe('133880,133881');
    });

    it('should be case-insensitive', () => {
      expect(PropStackClient.normalizeStatusParam('VERMARKTUNG')).toBe('133880');
      expect(PropStackClient.normalizeStatusParam('Reserviert')).toBe('133881');
    });
  });
});
