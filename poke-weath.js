import OpenAI from "openai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import 'dotenv/config';

// Starta MCP-servern och koppla upp
const transport = new StdioClientTransport({
  command: "node",
  args: ["server.js"],
});

const api_Key = process.env.OPENROUTER_API_KEY;

const mcp = new Client({ name: "test-client", version: "1.0.0" });
await mcp.connect(transport);

// Hämta alla tools från servern
const { tools } = await mcp.listTools();

// Gör om tools till OpenAI-format
const openaiTools = tools.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
  },
}));

const client = new OpenAI({
  apiKey: api_Key,
  //jag använde mig av openrouter för att få api-nyckel
  baseURL: "https://openrouter.ai/api/v1",
});

const messages = [
  { role: "user", content: "Hej, hämta väder från en storstad i världen. Från det vädret så välj en pokemon som passar i klimatet. Sök sedan på wikipedia efter en händelse kopplat till staden, och se hur pokemonen hade kunnat ändra historian. Om du inte hittar ett bra svar så är det okej, avsluta loopen." }
];

// Agenloop
while (true) {
  const response = await client.chat.completions.create({
    model: "sätt in din ai-modell här",
    tools: openaiTools,
    messages,
  });

  const choice = response.choices[0];
  messages.push({ role: "assistant", content: choice.message.content, tool_calls: choice.message.tool_calls });

  if (choice.finish_reason === "stop") {
    console.log(choice.message.content);
    break;
  }

    if (choice.message.tool_calls) {
        for (const toolCall of choice.message.tool_calls) {
        console.log(`🔧 Anropar tool: ${toolCall.function.name}`);
        console.log(`📥 Argument:`, toolCall.function.arguments);
        
        const args = JSON.parse(toolCall.function.arguments);
        const result = await mcp.callTool({ name: toolCall.function.name, arguments: args });
        
        console.log(`📤 Svar:`, result.content[0].text);
        console.log("---");
        
        messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result.content[0].text,
        });
    }
  }
}

await mcp.close();