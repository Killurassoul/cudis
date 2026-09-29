export function readEnv(name: string): string | undefined {
  const viteValue = import.meta.env?.[name];
  if (typeof viteValue === "string" && viteValue.length > 0) return viteValue;

  const processValue = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return processValue && processValue.length > 0 ? processValue : undefined;
}

export function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
