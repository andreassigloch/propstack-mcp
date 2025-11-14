/**
 * PropStack API Client - Read-Only
 * @author andreas@siglochconsulting
 *
 * Matches ImmoTechDemo implementation for consistency
 */

const PROPSTACK_API_BASE = 'https://api.propstack.de/v1';

export interface PropStackConfig {
  apiKey: string;
}

// PropStack Status IDs mit semantischen Namen
export const PROPSTACK_STATUS = {
  AKQUISE: 133878,
  VORBEREITUNG: 133879,
  VERMARKTUNG: 133880,
  RESERVIERT: 133881,
  ABGESCHLOSSEN: 133882,
} as const;

// Status-Mapping: Name -> ID
export const STATUS_NAME_TO_ID: Record<string, number> = {
  'akquise': 133878,
  'vorbereitung': 133879,
  'vermarktung': 133880,
  'reserviert': 133881,
  'abgeschlossen': 133882,
};

export interface PropStackStatus {
  id: number;
  name: string;
  color: string;
  position: number;
  nonpublic: boolean;
}

export interface PropStackFieldValue<T = any> {
  label: string;
  value: T;
}

export interface PropStackUnit {
  id: number;
  name: string;
  title: string | PropStackFieldValue<string>;
  unit_id: string;
  project_id: number | null;
  marketing_type?: string;
  property_type?: string;

  // Status field name varies by expand parameter:
  // - WITHOUT expand=1: field is "status"
  // - WITH expand=1: field is "property_status"
  status?: PropStackStatus;
  property_status?: PropStackStatus;

  // Location
  street: string;
  house_number?: string;
  city: string;
  zip_code: string;
  district?: string | PropStackFieldValue<string>;
  region?: string;
  country?: string;
  lat: number | null;
  lng: number | null;
  short_address?: string;
  address?: string;

  // Pricing
  price: number | PropStackFieldValue<number> | null;
  base_rent: number | PropStackFieldValue<number> | null;

  // Features
  living_space: number | PropStackFieldValue<number> | null;
  number_of_rooms: number | PropStackFieldValue<number> | null;
  number_of_bed_rooms: number | PropStackFieldValue<number> | null;
  number_of_bath_rooms: number | PropStackFieldValue<number> | null;
  plot_area?: number | PropStackFieldValue<number> | null;
  construction_year?: number | PropStackFieldValue<number> | null;

  // Images
  images: PropStackImage[];
}

export interface PropStackImage {
  id?: number;
  url: string;
  big_url: string;
  medium_url: string;
  thumb_url: string;
  small_thumb_url: string;
  square_url: string;
  title?: string;
  tags?: string | string[] | null;
  is_floorplan?: boolean;
  is_private?: boolean;
  is_not_for_exposee?: boolean;
  position?: number;
}

export interface PropStackApiResponse {
  data: PropStackUnit[];
  meta?: {
    total_count: number;
  };
}

export interface PropStackResponse {
  units: PropStackUnit[];
  total: number;
}

export interface SearchParams {
  price_from?: number;
  price_to?: number;
  plot_area?: number;
  property_type?: string;
  status?: string;
  per?: number;  // Pagination: items per page
  page?: number; // Pagination: page number
}

/**
 * Helper to extract value from PropStackFieldValue or direct value
 */
export function extractValue<T>(field: T | PropStackFieldValue<T> | null | undefined): T | null {
  if (field === null || field === undefined) return null;
  if (typeof field === 'object' && field !== null && 'value' in field) {
    return (field as PropStackFieldValue<T>).value;
  }
  return field as T;
}

export class PropStackClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: PropStackConfig) {
    if (!config.apiKey) {
      throw new Error('PropStack API key is required');
    }

    // HTTPS enforcement (per MCP security spec)
    if (!PROPSTACK_API_BASE.startsWith('https://')) {
      throw new Error('HTTPS required for PropStack API');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = PROPSTACK_API_BASE;
  }

  /**
   * Sanitize search query to prevent injection attacks
   */
  private sanitizeSearchQuery(query: string): string {
    return query.replace(/[;<>'"]/g, '');
  }

  /**
   * Sanitize error messages to prevent credential leakage
   */
  private sanitizeError(error: Error): Error {
    const message = error.message
      .replace(/key[=:]\s*\S+/gi, 'key=***')
      .replace(/token[=:]\s*\S+/gi, 'token=***')
      .replace(/bearer\s+\S+/gi, 'bearer ***');

    return new Error(message);
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(
          `PropStack API error: ${response.status} ${response.statusText}`
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      throw this.sanitizeError(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Search properties with filters
   * Note: Does NOT use expand=1 for efficiency (75% less data)
   * Without expand: 30 fields including "status" (~3.5MB for 500 units)
   * With expand: 275 fields with "property_status" (~16MB for 500 units)
   * For overview, 30 fields is sufficient. Use getProperty() for full details.
   */
  async searchProperties(params: SearchParams = {}): Promise<PropStackResponse> {
    const queryParams = new URLSearchParams();

    // Default parameters
    queryParams.set('per', String(params.per || 500));
    queryParams.set('with_meta', '1');
    // NO expand=1 - saves 75% bandwidth, status field still available

    // Optional filters
    if (params.price_from) queryParams.set('price_from', String(params.price_from));
    if (params.price_to) queryParams.set('price_to', String(params.price_to));
    if (params.plot_area) queryParams.set('plot_area', String(params.plot_area));
    if (params.property_type) {
      const sanitized = this.sanitizeSearchQuery(params.property_type);
      queryParams.set('property_type', sanitized);
    }
    if (params.status) {
      const normalizedStatus = PropStackClient.normalizeStatusParam(params.status);
      queryParams.set('status', normalizedStatus);
    }
    if (params.page) queryParams.set('page', String(params.page));

    const endpoint = `/units?${queryParams.toString()}`;
    const apiResponse = await this.request<PropStackApiResponse>(endpoint);

    // Handle new API response format with data and meta
    if (apiResponse.data && Array.isArray(apiResponse.data)) {
      return {
        units: apiResponse.data,
        total: apiResponse.meta?.total_count || apiResponse.data.length,
      };
    }

    // Fallback: if API returns array directly (old format)
    if (Array.isArray(apiResponse)) {
      return {
        units: apiResponse as unknown as PropStackUnit[],
        total: (apiResponse as unknown as PropStackUnit[]).length,
      };
    }

    throw new Error('Unexpected API response format');
  }

  /**
   * Get property by ID (unit_id)
   * Note: Uses search endpoint because direct /units/:id requires higher API permissions
   */
  async getProperty(unitId: string): Promise<PropStackUnit> {
    const queryParams = new URLSearchParams();
    queryParams.set('unit_id', unitId);
    queryParams.set('expand', '1');
    queryParams.set('with_meta', '1');

    const endpoint = `/units?${queryParams.toString()}`;
    const apiResponse = await this.request<PropStackApiResponse>(endpoint);

    // Handle response format
    if (apiResponse.data && Array.isArray(apiResponse.data)) {
      if (apiResponse.data.length === 0) {
        throw new Error(`Property with unit_id ${unitId} not found`);
      }
      return apiResponse.data[0];
    }

    // Fallback for old format
    if (Array.isArray(apiResponse)) {
      const units = apiResponse as unknown as PropStackUnit[];
      if (units.length === 0) {
        throw new Error(`Property with unit_id ${unitId} not found`);
      }
      return units[0];
    }

    throw new Error('Unexpected API response format');
  }

  /**
   * List property statuses
   */
  async listStatuses(): Promise<PropStackStatus[]> {
    const response = await this.request<{ data: PropStackStatus[] }>('/property_statuses');
    return response.data || [];
  }

  /**
   * Normalize status parameter: convert semantic names to IDs
   * Examples: "vermarktung" -> "133880", "vermarktung,reserviert" -> "133880,133881"
   */
  static normalizeStatusParam(status: string): string {
    const statusParts = status.split(',').map(s => s.trim().toLowerCase());
    const normalized = statusParts.map(part => {
      // If already numeric ID, keep it
      if (/^\d+$/.test(part)) return part;

      // Convert semantic name to ID
      const id = STATUS_NAME_TO_ID[part];
      return id ? String(id) : part;
    });

    return normalized.join(',');
  }
}
