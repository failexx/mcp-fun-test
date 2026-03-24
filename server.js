import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "pokemon-weather-mcp",
  version: "1.0.0",
});

// Tool 1: Hämta pokemon
server.tool("get_pokemon", { name: z.string() }, async ({ name }) => {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`);
  const data = await res.json();
  return {
    content: [{
      type: "text",
      text: `${data.name} | Typer: ${data.types.map(t => t.type.name).join(", ")} | Vikt: ${data.weight / 10}kg`
    }]
  };
});

// Tool 2: Hämta väder (Open-Meteo)
server.tool("get_weather", { lat: z.number(), lon: z.number() }, async ({ lat, lon }) => {
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode`);
  const data = await res.json();
  return {
    content: [{
      type: "text",
      text: `Temp: ${data.current.temperature_2m}°C | Kod: ${data.current.weathercode}`
    }]
  };
});

// Tool 3: wikipedia-sökning
server.tool("search_web", { query: z.string() }, async ({ query }) => {
  // Sök först efter rätt artikelnamn
  const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`);
  const searchData = await searchRes.json();
  
  const firstResult = searchData.query?.search?.[0]?.title;
  if (!firstResult) return { content: [{ type: "text", text: "Inget svar hittades." }] };

  // Hämta sammanfattning för den artikeln
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstResult)}`);
  const data = await res.json();

  return {
    content: [{ type: "text", text: data.extract || "Inget svar hittades." }]
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);