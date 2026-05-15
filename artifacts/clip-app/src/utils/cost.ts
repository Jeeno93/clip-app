import { AiDepth, AiModules } from "../storage/clips";
import { getMaxTokens } from "./summarize";

export interface CostEstimate {
  tokens: number;
  usd: number;
  rub: number;
}

const PROVIDER_PRICES_USD: Record<string, number> = {
  deepseek: 0.27,
  gemini:   0.10,
  claude:   0.80,
  openai:   0.15,
  yandex:   0.20,
};

export function estimateCost(
  textLength: number,
  provider: string,
  depth: AiDepth,
  modules: AiModules
): CostEstimate {
  const inputTokens = Math.round(textLength / 3);
  const outputTokens = Math.round(getMaxTokens(depth, modules) / 2);
  const totalTokens = inputTokens + outputTokens;
  const pricePerMillion = PROVIDER_PRICES_USD[provider] ?? 0.30;
  const usd = (totalTokens / 1_000_000) * pricePerMillion;
  const rub = usd * 90;
  return {
    tokens: totalTokens,
    usd: Math.round(usd * 10000) / 10000,
    rub: Math.round(rub * 100) / 100,
  };
}
