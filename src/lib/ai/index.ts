import { NetNode, NetEdge, AnalysisResult } from "@/lib/types";
import { buildNetworkContext, AI_SYSTEM_PROMPT } from "@/lib/aiContext";
import { completeWithFallback } from "./openrouter";
import { offlineAnswer } from "./offline";
import { AIAnswer } from "./types";

export async function getAIAnswer(
  question: string,
  nodes: NetNode[],
  edges: NetEdge[],
  analysis: AnalysisResult
): Promise<AIAnswer> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { answer: offlineAnswer(question, nodes, edges, analysis), aiAvailable: false };
  }

  const context = buildNetworkContext(nodes, edges, analysis);

  try {
    const { answer, model } = await completeWithFallback(
      [
        { role: "system", content: AI_SYSTEM_PROMPT },
        { role: "system", content: context },
        { role: "user", content: question },
      ],
      apiKey
    );
    return { answer, aiAvailable: true, provider: `openrouter:${model}` };
  } catch {
    return { answer: offlineAnswer(question, nodes, edges, analysis), aiAvailable: false };
  }
}
