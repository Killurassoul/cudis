import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const viteCli = resolve(projectRoot, "node_modules/vite/bin/vite.js");
const env = { ...process.env };

// Node's fetch does not automatically read the Windows system proxy. Vite's
// local Supabase gateway needs that route on managed Windows networks.
if (process.platform === "win32" && !env.HTTPS_PROXY && !env.https_proxy) {
  try {
    const proxy = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "$target=[uri]'https://supabase.com/'; $p=[System.Net.WebRequest]::GetSystemWebProxy(); $u=$p.GetProxy($target); if (-not $p.IsBypassed($target) -and $u.AbsoluteUri -ne $target.AbsoluteUri) { $u.AbsoluteUri }",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    if (proxy) {
      env.HTTPS_PROXY = proxy;
      env.HTTP_PROXY ??= proxy;
      env.NODE_USE_ENV_PROXY = "1";
    }
  } catch {
    // Direct network access remains the normal fallback.
  }
}

const child = spawn(process.execPath, [viteCli, "dev", ...process.argv.slice(2)], {
  cwd: projectRoot,
  env,
  stdio: "inherit",
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
