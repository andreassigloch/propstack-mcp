#!/usr/bin/env node
/**
 * PropStack MCP Server - Read-Only
 * @author andreas@siglochconsulting
 *
 * Provides read-only access to PropStack real estate data
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { PropStackClient, SearchParams, PROPSTACK_STATUS, extractValue } from './propstack-client.js';

// Get API key from environment
const PROPSTACK_API_KEY = process.env.PROPSTACK_API_KEY;

if (!PROPSTACK_API_KEY) {
  console.error('Error: PROPSTACK_API_KEY environment variable is required');
  process.exit(1);
}

// Initialize PropStack client
const propstack = new PropStackClient({ apiKey: PROPSTACK_API_KEY });

/**
 * DSGVO-compliant data sanitization
 * - Rounds GPS coordinates to ~111m precision (3 decimal places)
 * - Removes broker contact data
 * - Optionally removes media fields
 */
function sanitizeProperty(property: any, removeMedia = false): any {
  const sanitized = { ...property };

  // Round GPS coordinates to 3 decimal places (~111m precision)
  if (typeof sanitized.lat === 'number') {
    sanitized.lat = Math.round(sanitized.lat * 1000) / 1000;
  }
  if (typeof sanitized.lng === 'number') {
    sanitized.lng = Math.round(sanitized.lng * 1000) / 1000;
  }

  // Remove broker personal data
  delete sanitized.broker;
  delete sanitized.openimmo_email;
  delete sanitized.openimmo_firstname;
  delete sanitized.openimmo_lastname;
  delete sanitized.openimmo_phone;

  // Optionally remove media fields
  if (removeMedia) {
    delete sanitized.images;
    delete sanitized.documents;
    delete sanitized.videos;
    delete sanitized['360_views'];
  }

  return sanitized;
}

// Create MCP server
const server = new Server(
  {
    name: 'propstack-mcp-server',
    version: '0.1.1',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

/**
 * List available tools (read-only)
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'propstack_search_properties',
        description:
          'Search properties with filters (IMPORTANT: Always use filters to reduce result set and context usage). Returns overview: id, unit_id, name, city, street, status, price, living_space, rooms. Use propstack_get_property for full details. BEST PRACTICE: Filter by status (e.g., "vermarktung,reserviert" for active listings) and limit results with "per" parameter (default 500, reduce if needed).',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: `Property status filter (RECOMMENDED for context efficiency). Supports semantic names (akquise, vorbereitung, vermarktung, reserviert, abgeschlossen) or IDs (${PROPSTACK_STATUS.VERMARKTUNG}, ${PROPSTACK_STATUS.RESERVIERT}). Use comma-separated for multiple: "vermarktung,reserviert" or "133880,133881". TIP: Most queries want active listings = "vermarktung,reserviert"`,
            },
            price_from: {
              type: 'number',
              description: 'Minimum price in EUR (use to filter results)',
            },
            price_to: {
              type: 'number',
              description: 'Maximum price in EUR (use to filter results)',
            },
            plot_area: {
              type: 'number',
              description: 'Minimum plot area in square meters',
            },
            property_type: {
              type: 'string',
              description: 'Property type (e.g., APARTMENT, SINGLE_FAMILY_HOUSE, VILLA)',
            },
            per: {
              type: 'number',
              description: 'Items per page (default: 500, max: 500). REDUCE this number if you only need a few results to save context.',
              default: 500,
            },
            page: {
              type: 'number',
              description: 'Page number for pagination (starts at 1)',
            },
          },
        },
      },
      {
        name: 'propstack_get_property',
        description: 'Get complete details for a specific property by unit_id. Returns ALL fields including images, descriptions, and detailed features (~275 fields). WORKFLOW: Use propstack_search_properties first to get overview and unit_ids, then use this tool to get full details for specific properties of interest.',
        inputSchema: {
          type: 'object',
          properties: {
            unit_id: {
              type: 'string',
              description: 'PropStack unit_id from search results (e.g., "100", "2071903")',
            },
          },
          required: ['unit_id'],
        },
      },
      {
        name: 'propstack_list_statuses',
        description: 'List all available property statuses with their IDs',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case 'propstack_search_properties': {
        const params = request.params.arguments as SearchParams;
        const response = await propstack.searchProperties(params);

        // Extract overview data: id, unit_id, name, city, street, status
        const overview = response.units.map(unit => {
          // Status field name varies: "status" without expand, "property_status" with expand
          const statusObj = unit.status || unit.property_status;
          return {
            id: unit.id,
            unit_id: unit.unit_id,
            name: unit.name,
            title: extractValue(unit.title),
            city: unit.city,
            street: unit.street,
            house_number: unit.house_number,
            status: statusObj?.name || 'Unknown',
            status_id: statusObj?.id,
            price: extractValue(unit.price),
            living_space: extractValue(unit.living_space),
            rooms: extractValue(unit.number_of_rooms),
          };
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                properties: overview,
                total: response.total,
                count: overview.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'propstack_get_property': {
        const { unit_id } = request.params.arguments as { unit_id: string };
        const property = await propstack.getProperty(unit_id);

        // Sanitize: round GPS, remove broker data
        const sanitized = sanitizeProperty(property, false);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(sanitized, null, 2),
            },
          ],
        };
      }

      case 'propstack_list_statuses': {
        const statuses = await propstack.listStatuses();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(statuses, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * List available resources
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'propstack://properties/all',
        name: 'All Properties',
        description: 'Overview of all properties (id, name, city, street, status)',
        mimeType: 'application/json',
      },
      {
        uri: 'propstack://properties/active',
        name: 'Active Properties',
        description: 'Properties with status Vermarktung or Reserviert',
        mimeType: 'application/json',
      },
      {
        uri: 'propstack://properties/single/{unit_id}',
        name: 'Single Property (without media)',
        description: 'Complete property details WITHOUT media fields (images, documents, videos, 360_views). Context-efficient for data analysis. Use unit_id from search results.',
        mimeType: 'application/json',
      },
      {
        uri: 'propstack://properties/single_all/{unit_id}',
        name: 'Single Property (complete)',
        description: 'Complete property details WITH all media fields. Use when images/documents are needed. Larger context footprint.',
        mimeType: 'application/json',
      },
    ],
  };
});

/**
 * Read resource content
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (uri === 'propstack://properties/all') {
    const response = await propstack.searchProperties({ per: 500 });
    const overview = response.units.map(unit => {
      const statusObj = unit.status || unit.property_status;
      return {
        id: unit.id,
        unit_id: unit.unit_id,
        name: unit.name,
        city: unit.city,
        street: unit.street,
        status: statusObj?.name || 'Unknown',
      };
    });

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ properties: overview, total: response.total }, null, 2),
        },
      ],
    };
  }

  if (uri === 'propstack://properties/active') {
    const status = `${PROPSTACK_STATUS.VERMARKTUNG},${PROPSTACK_STATUS.RESERVIERT}`;
    const response = await propstack.searchProperties({ status, per: 500 });
    const overview = response.units.map(unit => {
      const statusObj = unit.status || unit.property_status;
      return {
        id: unit.id,
        unit_id: unit.unit_id,
        name: unit.name,
        city: unit.city,
        street: unit.street,
        status: statusObj?.name || 'Unknown',
      };
    });

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ properties: overview, total: response.total }, null, 2),
        },
      ],
    };
  }

  // Handle propstack://properties/single/{unit_id} - without media
  const singleMatch = uri.match(/^propstack:\/\/properties\/single\/(.+)$/);
  if (singleMatch) {
    const unit_id = singleMatch[1];
    const property = await propstack.getProperty(unit_id);

    // Sanitize: round GPS, remove broker data AND media fields
    const sanitized = sanitizeProperty(property, true);

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(sanitized, null, 2),
        },
      ],
    };
  }

  // Handle propstack://properties/single_all/{unit_id} - with all media
  const singleAllMatch = uri.match(/^propstack:\/\/properties\/single_all\/(.+)$/);
  if (singleAllMatch) {
    const unit_id = singleAllMatch[1];
    const property = await propstack.getProperty(unit_id);

    // Sanitize: round GPS, remove broker data (keep media)
    const sanitized = sanitizeProperty(property, false);

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(sanitized, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

/**
 * List available prompts
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'propstack-overview',
        description: 'Generate overview summary of all properties',
        arguments: [
          {
            name: 'status_filter',
            description: 'Optional: Filter by status (e.g., "133880,133881" for active)',
            required: false,
          },
        ],
      },
    ],
  };
});

/**
 * Get prompt content
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'propstack-overview') {
    const status_filter = args?.status_filter as string | undefined;
    const params: SearchParams = { per: 500 };
    if (status_filter) params.status = status_filter;

    const response = await propstack.searchProperties(params);

    // Sanitize all units: round GPS, remove broker data (minimal overview, no media)
    const sanitizedUnits = response.units.map(unit => sanitizeProperty(unit, true));

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Generate a summary overview for these ${response.total} properties:\n${JSON.stringify(sanitizedUnits, null, 2)}`,
          },
        },
      ],
    };
  }

  throw new Error(`Unknown prompt: ${name}`);
});

/**
 * Start server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PropStack MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
