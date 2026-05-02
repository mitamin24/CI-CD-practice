import path from "path";
import { fileURLToPath } from "url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ logger: true });

// Register CORS
await fastify.register(cors, {
  origin: "*",
});

// Health checkpoint
fastify.get("/health", async (request, reply) => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Additional helpful route for the frontend to fetch some info
fastify.get("/api/info", async (request, reply) => {
  return {
    appName: "CI/CD Pipeline & Modern Application",
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
  };
});

// Serve frontend static files in production
if (process.env.NODE_ENV === "production") {
  const frontendDist = path.join(__dirname, "../../frontend/dist");
  await fastify.register(fastifyStatic, {
    root: frontendDist,
    prefix: "/",
  });

  // SPA fallback: serve index.html for any unmatched route
  fastify.setNotFoundHandler((_request, reply) => {
    reply.sendFile("index.html");
  });
}

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3001;
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`Server is running at http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
