import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createTemplateDesignerApi } from "./template-design-api";

const serverDirectory = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(serverDirectory, "..", "..");
const engineRoot = resolve(appRoot, "..", "..");
const workspaceRoot = resolve(process.env.KNOWLEDGE_EXPLAINER_WORKSPACE ?? `${homedir()}/.knowledge-explainer`);
const requestedPort = Number.parseInt(process.env.KNOWLEDGE_EXPLAINER_TEMPLATE_DESIGNER_PORT ?? "4173", 10);
const port = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort < 65_536
  ? requestedPort
  : 4173;

if (port !== requestedPort) {
  console.warn(`[template-designer] invalid port ${process.env.KNOWLEDGE_EXPLAINER_TEMPLATE_DESIGNER_PORT}; using 4173.`);
}

const server = await createServer({
  root: appRoot,
  configFile: false,
  server: { host: "127.0.0.1", port },
  plugins: [createTemplateDesignerApi({ engineRoot, workspaceRoot })]
});

await server.listen();
server.printUrls();
