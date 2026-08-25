import { NextRequest, NextResponse } from "next/server";
import { NetNode, NetEdge, AnalysisResult } from "@/lib/types";
import { getAIAnswer } from "@/lib/ai";

// The client sends the live topology snapshot + analysis. We build a context
// string server-side and ask the configured AI provider (OpenRouter) to
// reason about it. If no key is set, or every provider attempt fails, we
// fall back to a topology-aware rule-based offline answer — always on.

export async function POST(req: NextRequest) {
  let body: {
    question: string;
    nodes: NetNode[];
    edges: NetEdge[];
    analysis: AnalysisResult;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { question, nodes, edges, analysis } = body;
  if (typeof question !== "string" || !Array.isArray(nodes) || !Array.isArray(edges) || !analysis) {
    return NextResponse.json({ error: "Missing question, nodes, edges, or analysis" }, { status: 400 });
  }

  // Reconstruct analysis with Set fields. JSON.stringify turns Set fields
  // into {} on the client, so normalize whatever shape arrives to arrays.
  const toArr = (v: unknown): string[] => {
    if (Array.isArray(v)) return v as string[];
    if (v && typeof v === "object" && Symbol.iterator in (v as object))
      return Array.from(v as Iterable<string>);
    return [];
  };
  const reconstructed: AnalysisResult = {
    ...analysis,
    routeEdgeIds: new Set(toArr(analysis.routeEdgeIds)),
    routeNodeIds: new Set(toArr(analysis.routeNodeIds)),
  };

  const result = await getAIAnswer(question, nodes, edges, reconstructed);
  return NextResponse.json(result);
}
