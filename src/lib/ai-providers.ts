// ------------------------------------------------------------
// Abstraction fournisseur LLM pour l'assistant CUDIS.
//
// Le fournisseur actif est choisi par la variable AI_PROVIDER
// (gemini par défaut). Pour changer de fournisseur plus tard,
// il suffit de définir AI_PROVIDER=anthropic ou AI_PROVIDER=openai
// et la clé correspondante — aucune ligne de code à réécrire.
//
// Chaque implémentation ne connaît que : clé API, prompt système
// (périmètre CUDIS uniquement) et question du visiteur.
// Pas d'accès internet, pas de mémoire entre les sessions.
// ------------------------------------------------------------

export type AssistantProviderId = "gemini" | "anthropic" | "openai";

export type AssistantProviderInput = {
  apiKey: string;
  model: string;
  systemPrompt: string;
  question: string;
};

export type AssistantProviderResult = {
  answer: string;
  provider: AssistantProviderId;
  model: string;
};

export type AssistantProviderConfig = {
  id: AssistantProviderId;
  model: string;
  apiKey: string;
};

const MAX_ANSWER_LENGTH = 1500;

function trimAnswer(answer: string): string {
  return answer.trim().slice(0, MAX_ANSWER_LENGTH);
}

async function postJson(
  url: string,
  apiKey: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => `${response.status} ${response.statusText}`);
    throw new Error(`Assistant provider request failed: ${detail}`);
  }
  return response.json();
}

// ---------- Gemini (fournisseur par défaut) ----------

export async function callGeminiAssistant({
  apiKey,
  model,
  systemPrompt,
  question,
}: AssistantProviderInput): Promise<AssistantProviderResult> {
  const data = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    apiKey,
    {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: question }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
    },
  );

  const answer =
    (
      data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    )?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("") ?? "";

  return {
    answer: trimAnswer(answer) || "Je ne peux pas répondre pour le moment.",
    provider: "gemini",
    model,
  };
}

// ---------- Anthropic (Claude) — prêt, activable par variable ----------

export async function callAnthropicAssistant({
  apiKey,
  model,
  systemPrompt,
  question,
}: AssistantProviderInput): Promise<AssistantProviderResult> {
  const data = (await postJson(
    "https://api.anthropic.com/v1/messages",
    apiKey,
    {
      model,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    },
    { "anthropic-version": "2023-06-01", "x-api-key": apiKey },
  )) as { content?: Array<{ type?: string; text?: string }> };

  const answer = (data.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
  return {
    answer: trimAnswer(answer) || "Je ne peux pas répondre pour le moment.",
    provider: "anthropic",
    model,
  };
}

// ---------- OpenAI — prêt, activable par variable ----------

export async function callOpenaiAssistant({
  apiKey,
  model,
  systemPrompt,
  question,
}: AssistantProviderInput): Promise<AssistantProviderResult> {
  const data = (await postJson("https://api.openai.com/v1/chat/completions", apiKey, {
    model,
    max_tokens: 500,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ],
  })) as { choices?: Array<{ message?: { content?: string } }> };

  const answer = data.choices?.[0]?.message?.content ?? "";
  return {
    answer: trimAnswer(answer) || "Je ne peux pas répondre pour le moment.",
    provider: "openai",
    model,
  };
}

const providerCallers: Record<
  AssistantProviderId,
  (input: AssistantProviderInput) => Promise<AssistantProviderResult>
> = {
  gemini: callGeminiAssistant,
  anthropic: callAnthropicAssistant,
  openai: callOpenaiAssistant,
};

const defaultModels: Record<AssistantProviderId, string> = {
  gemini: "gemini-2.0-flash",
  anthropic: "claude-3-5-haiku-20241022",
  openai: "gpt-4o-mini",
};

const apiKeyEnvNames: Record<AssistantProviderId, string> = {
  gemini: "GEMINI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

function isProviderId(value: string | undefined): value is AssistantProviderId {
  return value === "gemini" || value === "anthropic" || value === "openai";
}

/**
 * Résout le fournisseur actif depuis l'environnement :
 * - AI_PROVIDER : gemini (défaut) | anthropic | openai
 * - AI_MODEL    : surcharge du modèle pour tous les fournisseurs
 * - <ID>_MODEL  : surcharge spécifique (ex. GEMINI_MODEL)
 * Retourne null si le fournisseur est inconnu ou la clé absente :
 * la route répond alors "configuration manquante" sans planter.
 */
export function resolveAssistantProvider(
  readEnv: (name: string) => string | undefined,
): AssistantProviderConfig | null {
  const requested = readEnv("AI_PROVIDER");
  const id: AssistantProviderId = isProviderId(requested) ? requested : "gemini";

  const apiKey = readEnv(apiKeyEnvNames[id]);
  if (!apiKey) return null;

  const model = readEnv(`${id.toUpperCase()}_MODEL`) ?? readEnv("AI_MODEL") ?? defaultModels[id];
  return { id, model, apiKey };
}

export async function callAssistantProvider(
  config: AssistantProviderConfig,
  systemPrompt: string,
  question: string,
): Promise<AssistantProviderResult> {
  return providerCallers[config.id]({
    apiKey: config.apiKey,
    model: config.model,
    systemPrompt,
    question,
  });
}
