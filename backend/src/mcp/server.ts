import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchConversations, getByDateRange } from "./api-client";

export async function createMcpServer(){
    const server = new McpServer({
        name: 'jarvis-conversations',
        version: '1.0.0'
    })


    server.registerTool(
       'search_conversations',
        {
            description:'Semantic search through conversation history',
            inputSchema: { query: z.string().describe('Natural language search query')}
        },    
        async ({ query }) => {
            try {
                const data = await searchConversations({ query })
                return {
                    content: [ 
                        {
                            type:'text',
                            text: JSON.stringify(data, null, 2)
                        }
                    ]
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return {
                    content: [{ type: 'text', text: message}],
                    isError: true
                }
                
            }
        })
    
    server.registerTool(
        'get_conversations_by_date',
        {
            description:  'Get conversations within a date range',
            inputSchema: {
                from: z.string().datetime().optional().describe('Start date (ISO format)'),
                to: z.string().datetime().optional().describe('End date (ISO format)'),
            }
        },
        async ({ from, to }) => {
            try {
                const data = await getByDateRange({ from, to })
                return {
                    content: [ 
                        {
                            type:'text',
                            text: JSON.stringify(data, null, 2)
                        }
                    ]
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return {
                    content: [{ type: 'text', text: message}],
                    isError: true
                }
                
            }
        }
    )

  
    return server
}