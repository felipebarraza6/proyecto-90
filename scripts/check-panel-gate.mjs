import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const fail = (message) => {
  console.error(`check:panel: ${message}`);
  process.exit(1);
};

if (existsSync(join(root, "app", "weekly-team-panel.tsx"))) {
  fail("app/weekly-team-panel.tsx no debe volver. El panel es app/weekly-panel.");
}

function filesUnder(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) filesUnder(path, acc);
    else if (/\.(tsx|ts)$/.test(name)) acc.push(path);
  }
  return acc;
}

const appDir = join(root, "app");
for (const path of filesUnder(appDir)) {
  const rel = path.slice(root.length).replaceAll("\\", "/");
  if (rel.endsWith("app/weekly-panel/types.ts")) continue;
  const source = readFileSync(path, "utf8");
  if (source.includes(".panel_enabled")) {
    fail(`${rel} lee .panel_enabled. Ese campo no puede mostrar ni esconder la pantalla.`);
  }
}

const screen = readFileSync(join(root, "app", "weekly-panel", "screen.ts"), "utf8");
const gate = screen.slice(screen.indexOf("function staffPanelActive"));
if (!gate.startsWith("function staffPanelActive") || /panel_enabled/.test(gate)) {
  fail("staffPanelActive tiene que existir y no puede consultar panel_enabled.");
}

const app = readFileSync(join(root, "app", "functional-app.tsx"), "utf8");
if (!app.includes("staffPanelActive(panelConfig)")) {
  fail("functional-app.tsx tiene que decidir el panel con staffPanelActive(panelConfig).");
}

console.log("check:panel ok");
