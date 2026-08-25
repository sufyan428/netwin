export interface AIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIAnswer {
  answer: string;
  aiAvailable: boolean;
  provider?: string;
}
