import {
  Client,
} from '@modelcontextprotocol/sdk/client/index';
import {
  InMemoryTransport,
} from '@modelcontextprotocol/sdk/inMemory';
import type {
  McpServer,
} from '@modelcontextprotocol/sdk/server/mcp';

/**
 * Set up an MCP client and server for testing purposes.
 * DO NOT USE OUTSIDE OF TESTS.
 * @param mcpServer
 * @experimental
 */
export const setUpClientAndServerForTesting = async (mcpServer: McpServer) => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  });
  await Promise.all([
    client.connect(clientTransport),
    mcpServer.server.connect(serverTransport)
  ]);
  return { mcpServer, client };
};
