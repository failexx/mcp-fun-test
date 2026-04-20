import OpenAI from "openai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ändra modellnamnet här. Hitta modeller på https://openrouter.ai/models
const MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

export async function* runAgent(userPrompt, model = MODEL) {
  const transport = new StdioClientTransport({
    command: "node",
    args: [join(__dirname, "server.js")],
  });

  const api_Key = process.env.OPENROUTER_API_KEY;
  const mcp = new Client({ name: "test-client", version: "1.0.0" });
  await mcp.connect(transport);

  const { tools } = await mcp.listTools();

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
    baseURL: "https://openrouter.ai/api/v1",
  });

  const messages = [
    {
      role: "system",
      content:
        "Du är en AI-agent med tillgång till tre verktyg: get_weather, get_pokemon och search_web.\n" +
        "Följ ALLTID denna ordning och gör bara ETT API-kall per steg, annars fastnar du onödigt:\n" +
        "1. Välj en känd storstad och anropa get_weather med stadens kända koordinater (du vet dessa utan att söka).\n" +
        "2. Baserat på temperaturen och väderkoden, välj en lämplig Pokémon och anropa get_pokemon.\n" +
        "3. Anropa search_web för att hitta en historisk händelse kopplad till staden. Välj inga militära, krig eller katastrofer.\n" +
        "4. Skriv ett roligt slutsvar som kopplar ihop vädret, Pokémonen och händelsen.\n" +
        "Använd ALDRIG search_web för att hitta koordinater – du kan dem redan.",
    },
    { role: "user", content: userPrompt },
  ];

  while (true) {
    const response = await client.chat.completions.create({
      model,
      tools: openaiTools,
      messages,
    });

    const choice = response.choices[0];
    messages.push({
      role: "assistant",
      content: choice.message.content,
      tool_calls: choice.message.tool_calls,
    });

    if (choice.finish_reason === "stop") {
      yield { type: "final", content: choice.message.content };
      break;
    }

    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        yield {
          type: "tool_call",
          name: toolCall.function.name,
          args: toolCall.function.arguments,
        };

        const args = JSON.parse(toolCall.function.arguments);
        const result = await mcp.callTool({
          name: toolCall.function.name,
          arguments: args,
        });

        yield {
          type: "tool_result",
          name: toolCall.function.name,
          result: result.content[0].text,
        };

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result.content[0].text,
        });
      }
    }
  }

  await mcp.close();
}
