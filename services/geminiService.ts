import { GoogleGenAI, Type } from "@google/genai";
import { Category, GeminiNoteAnalysis, ItemType } from "../types";

export const analyzeNote = async (content: string): Promise<GeminiNoteAnalysis> => {
  const fallback: GeminiNoteAnalysis = {
    item_type: ItemType.IDEA,
    category: Category.OTHER,
    time_bucket: 'none',
    is_event: false,
    summary: content.substring(0, 50),
  };

  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("API_KEY missing for analyzeNote, using fallback.");
      return fallback;
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following note content for categorization and extraction.
      Note Content: "${content}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            item_type: {
              type: Type.STRING,
              description: "task, event, idea, or important_info",
            },
            category: {
              type: Type.STRING,
              description: "Work, Personal, Creative, Health, Finance, Admin, Social, or Other.",
            },
            time_bucket: {
              type: Type.STRING,
              description: "Timeframe or 'none'",
            },
            is_event: {
              type: Type.BOOLEAN,
              description: "Is this time-specific?",
            },
            summary: {
              type: Type.STRING,
              description: "Actionable summary.",
            },
          },
          required: ["item_type", "category", "time_bucket", "is_event", "summary"],
        },
      },
    });

    const rawText = response.text;
    if (!rawText) throw new Error("Empty response");

    const analysis = JSON.parse(rawText.trim()) as GeminiNoteAnalysis;
    
    if (!Object.values(Category).includes(analysis.category as Category)) {
      analysis.category = Category.OTHER;
    }

    return analysis;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return fallback;
  }
};
