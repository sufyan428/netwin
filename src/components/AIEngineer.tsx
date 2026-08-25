"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Send } from "lucide-react";
import { useNetTwin } from "@/lib/store";
import { AnalysisResult, NetNode, NetEdge, SimScenarioType } from "@/lib/types";
import { cn } from "@/lib/cn";

interface QuickAction {
  label: string;
  question: string;
  whatIf?: { type: SimScenarioType; target: "label" | "auto"; value?: number };
}

interface AskResponse {
  answer: string;
  aiAvailable: boolean;
  provider?: string;
}

export default function AIEngineer() {
  const chat = useNetTwin((s) => s.chat);
  const pushChat = useNetTwin((s) => s.pushChat);
  const setAiAvailable = useNetTwin((s) => s.setAiAvailable);
  const aiAvailable = useNetTwin((s) => s.aiAvailable);
  const nodes = useNetTwin((s) => s.nodes);
  const edges = useNetTwin((s) => s.edges);
  const analysis = useNetTwin((s) => s.analysis);
  const runWhatIf = useNetTwin((s) => s.runWhatIf);

  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat, typing]);

  async function send(question: string, freshNodes: NetNode[], freshEdges: NetEdge[], freshAnalysis: AnalysisResult) {
    pushChat({ role: "user", content: question });
    setTyping(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, nodes: freshNodes, edges: freshEdges, analysis: freshAnalysis }),
      });
      const data: AskResponse = await res.json();
      setAiAvailable(data.aiAvailable !== false);
      pushChat({ role: "assistant", content: data.answer, offline: data.aiAvailable === false });
    } catch {
      pushChat({
        role: "assistant",
        content: "I could not reach the reasoning service. The network is still simulated — no real devices were touched.",
        offline: true,
      });
      setAiAvailable(false);
    } finally {
      setTyping(false);
    }
  }

  async function ask(question: string) {
    if (!question.trim() || typing) return;
    setInput("");
    await send(question, nodes, edges, analysis);
  }

  async function runWhatIfAndAsk(action: QuickAction) {
    if (typing) return;
    if (action.whatIf) {
      let targetId: string | null = null;
      if (action.whatIf.target === "label") {
        const m = action.question.match(/(R\d+|H\d+)/i);
        const label = m ? m[1].toUpperCase() : null;
        const node = label ? nodes.find((n) => n.label.toUpperCase() === label) : null;
        if (node) targetId = node.id;
      }
      if (targetId) runWhatIf(action.whatIf.type, targetId, action.whatIf.value);
    }
    const s = useNetTwin.getState();
    await send(action.question, s.nodes, s.edges, s.analysis);
  }

  const quick: QuickAction[] = [
    { label: "What if R2 fails?", question: "What if R2 fails?", whatIf: { type: "router-fail", target: "label" } },
    { label: "Why did the network degrade?", question: "Why did the network degrade?" },
    { label: "What is the risk level?", question: "What is the risk level?" },
    { label: "What is the safest fix?", question: "What is the safest fix?" },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center border"
          style={{ borderColor: "var(--accent)", background: "var(--surface-2)" }}
        >
          <Sparkles size={12} color="var(--accent)" />
        </div>
        <div className="leading-none">
          <div className="text-xs font-semibold">AI Engineer</div>
          <div className="flex items-center gap-1 mt-1">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: aiAvailable ? "var(--success)" : "var(--warning)" }}
            />
            <span className="text-[9px]" style={{ color: aiAvailable ? "var(--success)" : "var(--warning)" }}>
              {aiAvailable ? "Simulation-aware" : "Offline mode"}
            </span>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3" style={{ minHeight: 0 }}>
        {chat.length === 0 && !typing && (
          <div className="text-center py-8 px-2">
            <div className="text-xs text-text-faint leading-relaxed">
              Ask me about the live network. I can see the current topology and any simulated
              failures, and explain what happened and how to recover — all within the simulation
              twin.
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {quick.map((q) => (
                <button
                  key={q.label}
                  onClick={() => (q.whatIf ? runWhatIfAndAsk(q) : ask(q.question))}
                  className="text-[11px] text-left px-3 py-2 rounded-lg border border-border bg-surface-2 text-text hover:border-accent hover:bg-surface-hover transition-colors"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {chat.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col"
          >
            <div
              className="text-[9px] uppercase tracking-wide mb-1 px-1"
              style={{
                color: m.role === "user" ? "var(--accent)" : "var(--accent-2)",
                textAlign: m.role === "user" ? "right" : "left",
              }}
            >
              {m.role === "user" ? "You" : "AI Engineer"}
            </div>
            <div
              className={cn(
                "rounded-xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap border",
                m.role === "user" ? "bg-accent/10 border-accent/20 ml-auto" : "bg-surface-2 border-border"
              )}
              style={{ maxWidth: "90%" }}
            >
              {m.content}
              {m.offline && (
                <div className="text-[9px] text-text-faint mt-1.5 pt-1.5 border-t border-border">
                  locally computed · no AI reachable
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {typing && (
          <div className="flex items-center gap-1.5 px-1 py-1">
            <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-2)" }} />
            <span
              className="typing-dot w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--accent-2)", animationDelay: "0.15s" }}
            />
            <span
              className="typing-dot w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--accent-2)", animationDelay: "0.3s" }}
            />
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder="Ask about the network…"
            rows={2}
            className="flex-1 resize-none text-[12px] rounded-lg border border-border bg-surface-2 px-3 py-2 text-text placeholder-text-faint outline-none focus:border-accent transition-colors"
          />
          <button
            onClick={() => ask(input)}
            disabled={!input.trim() || typing}
            aria-label="Send"
            className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center disabled:opacity-40 transition-colors hover:brightness-110"
            style={{ background: "var(--accent)" }}
          >
            <Send size={15} color="#ffffff" />
          </button>
        </div>
      </div>
    </div>
  );
}
