import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import logger from './logger.js';

// ── Config types ────────────────────────────────────────────────

type HttpServerConfig = {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
  disabled?: boolean;
};

type StdioServerConfig = {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
};

type ServerConfig = HttpServerConfig | StdioServerConfig;

type McpConfig = {
  mcpServers: Record<string, ServerConfig>;
};

// ── Internals ───────────────────────────────────────────────────

type ConnectedServer = {
  name: string;
  client: Client;
  transport: StreamableHTTPClientTransport | StdioClientTransport;
  tools: Anthropic.Messages.Tool[];
  /** Original (un-namespaced) tool names for this server. */
  originalNames: Map<string, string>;
};

const TOOL_PREFIX = 'mcp';

function namespacedName(server: string, tool: string): string {
  return `${TOOL_PREFIX}__${server}__${tool}`;
}

/**
 * Replace `${VAR}` tokens with values from process.env.
 * Unresolved vars are replaced with an empty string.
 */
function interpolateEnv(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, key) => process.env[key] ?? '');
}

function interpolateRecord(obj: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = interpolateEnv(v);
  }
  return result;
}

// ── McpManager ──────────────────────────────────────────────────

class McpManager {
  private servers: ConnectedServer[] = [];
  private allTools: Anthropic.Messages.Tool[] = [];
  private toolToServer = new Map<string, ConnectedServer>();

  /**
   * Read mcp.json (if present), connect to all configured servers,
   * and discover their tools. Failures on individual servers are
   * logged but do not prevent startup.
   */
  async initialize(): Promise<void> {
    const configPath = resolve(process.cwd(), 'mcp.json');
    let raw: string;
    try {
      raw = await readFile(configPath, 'utf-8');
    } catch {
      // No config file — nothing to do.
      return;
    }

    let config: McpConfig;
    try {
      config = JSON.parse(raw) as McpConfig;
    } catch (err) {
      logger.warn({ err }, 'Failed to parse mcp.json — skipping MCP initialization');
      return;
    }

    const entries = Object.entries(config.mcpServers || {});
    if (entries.length === 0) return;

    const results = await Promise.allSettled(
      entries.map(([name, cfg]) => this.connectServer(name, cfg)),
    );

    for (const r of results) {
      if (r.status === 'rejected') {
        // Already logged inside connectServer — nothing extra needed.
      }
    }

    // Build the combined tool list.
    for (const srv of this.servers) {
      this.allTools.push(...srv.tools);
      for (const tool of srv.tools) {
        this.toolToServer.set(tool.name, srv);
      }
    }

    logger.info(
      { servers: this.servers.map((s) => s.name), toolCount: this.allTools.length },
      'MCP initialization complete',
    );
  }

  /** All MCP tools formatted for the Anthropic API. */
  getTools(): Anthropic.Messages.Tool[] {
    return this.allTools;
  }

  /** Returns true if `name` is an MCP-namespaced tool. */
  isMcpTool(name: string): boolean {
    return this.toolToServer.has(name);
  }

  /** Parse the server name from a namespaced tool name (e.g. mcp__arena__search → arena). */
  serverName(toolName: string): string {
    const parts = toolName.split('__');
    return parts.length >= 3 ? parts[1] : 'unknown';
  }

  /**
   * Call an MCP tool by its namespaced name.
   * Returns the text content and whether the server reported an error.
   */
  async callTool(
    namespacedToolName: string,
    args: Record<string, unknown>,
  ): Promise<{ content: string; isError: boolean }> {
    const srv = this.toolToServer.get(namespacedToolName);
    if (!srv) {
      return { content: `Unknown MCP tool: ${namespacedToolName}`, isError: true };
    }

    const originalName = srv.originalNames.get(namespacedToolName);
    if (!originalName) {
      return { content: `Cannot resolve original name for: ${namespacedToolName}`, isError: true };
    }

    try {
      const result = await srv.client.callTool({ name: originalName, arguments: args });

      // Flatten content array into a single string.
      const text = (result.content as Array<{ type: string; text?: string }>)
        .filter((c) => c.type === 'text' && c.text)
        .map((c) => c.text)
        .join('\n');

      return { content: text || '(empty response)', isError: result.isError === true };
    } catch (err) {
      logger.error({ err, tool: namespacedToolName }, 'MCP callTool failed');
      return { content: `MCP tool error: ${(err as Error).message}`, isError: true };
    }
  }

  /** Gracefully close all connections. */
  async shutdown(): Promise<void> {
    await Promise.allSettled(
      this.servers.map(async (srv) => {
        try {
          await srv.client.close();
        } catch {
          // best-effort
        }
      }),
    );
    this.servers = [];
    this.allTools = [];
    this.toolToServer.clear();
  }

  // ── Private ──────────────────────────────────────────────────

  private async connectServer(name: string, cfg: ServerConfig): Promise<void> {
    if (cfg.disabled) {
      logger.info({ server: name }, 'MCP server disabled — skipping');
      return;
    }

    let transport: StreamableHTTPClientTransport | StdioClientTransport;

    if (cfg.type === 'http') {
      const headers = cfg.headers ? interpolateRecord(cfg.headers) : undefined;
      transport = new StreamableHTTPClientTransport(new URL(interpolateEnv(cfg.url)), {
        requestInit: headers ? { headers } : undefined,
      });
    } else if (cfg.type === 'stdio') {
      transport = new StdioClientTransport({
        command: cfg.command,
        args: cfg.args,
        env: cfg.env ? { ...process.env, ...interpolateRecord(cfg.env) } as Record<string, string> : undefined,
      });
    } else {
      logger.warn({ server: name }, 'Unknown MCP transport type — skipping');
      return;
    }

    const client = new Client({ name: `hermes-${name}`, version: '1.0.0' });

    try {
      await client.connect(transport);
    } catch (err) {
      logger.warn({ err, server: name }, 'Failed to connect to MCP server');
      throw err;
    }

    // Discover tools.
    let tools: Anthropic.Messages.Tool[];
    const originalNames = new Map<string, string>();
    try {
      const result = await client.listTools();
      tools = result.tools.map((t) => {
        const nsName = namespacedName(name, t.name);
        originalNames.set(nsName, t.name);
        return {
          name: nsName,
          description: t.description ?? '',
          input_schema: t.inputSchema as Anthropic.Messages.Tool['input_schema'],
        };
      });
    } catch (err) {
      logger.warn({ err, server: name }, 'Failed to list tools from MCP server');
      await client.close().catch(() => {});
      throw err;
    }

    this.servers.push({ name, client, transport, tools, originalNames });
    logger.info({ server: name, tools: tools.map((t) => t.name) }, 'MCP server connected');
  }
}

export const mcpManager = new McpManager();
