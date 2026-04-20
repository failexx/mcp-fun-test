import 'dotenv/config';
import express from "express";
import { runAgent } from "./agent.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.static(join(__dirname, "public")));
app.use(express.json());

const DEFAULT_PROMPT =
  "Välj en slumpmässig storstad i världen. Hämta vädret där, välj en Pokémon som passar klimatet, hitta en historisk händelse i staden och berätta hur Pokémonen hade påverkat händelsen.";

app.get("/run", async (req, res) => {
  const prompt = req.query.prompt?.trim() || DEFAULT_PROMPT;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    for await (const event of runAgent(prompt)) {
      send(event);
    }
  } catch (err) {
    send({ type: "error", message: err.message });
  }

  send({ type: "done" });
  res.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`UI körs på http://localhost:${PORT}`)
);
