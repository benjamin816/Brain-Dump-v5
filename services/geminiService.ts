
import { GoogleGenAI, Type } from "@google/genai";
import { Category, GeminiNoteAnalysis, ItemType } from "../types";

export const analyzeNote = async (content: string): Promise<GeminiNoteAnalysis> => {
  // Fix: Object literal must match GeminiNoteAnalysis interface (added missing properties and corrected isEvent -> is_event)
  const fallback: GeminiNoteAnalysis = {
    item_type: ItemType.IDEA,
    category: Category.OTHER,
    time_bucket: 'none',
    is_event: false,
    summary: content.substring(0, 50),
  };

  try {
    // Guidelines: Use process.env.API_KEY exclusively
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("API_KEY missing for analyzeNote, using fallback.");
      return fallback;
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following note content. 
      1. item_type: Must be 'task' (something to do), 'event' (time-specific), 'idea' (concept/reflection), or 'important_info' (fact/data).
      2. category: Determine from: ${Object.values(Category).filter(c => c !== Category.ALL).join(", ")}.
      3. is_event: Set to true if it describes a time-specific task, appointment, or event.
      4. time_bucket: Extract the time/date mentioned or use "none".
      5. summary: Provide a sharp, concise summary.

      Note Content: "${content}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            item_type: {
              type: Type.STRING,
              description: "The type of the item (task, event, idea, or important_info)",
            },
            category: {
              type: Type.STRING,
              description: "The most appropriate category for the note.",
            },
            time_bucket: {
              type: Type.STRING,
              description: "Extracted time or timeframe information if available, else 'none'.",
            },
            is_event: {
              type: Type.BOOLEAN,
              description: "Whether the note describes a time-specific event or task.",
            },
            summary: {
              type: Type.STRING,
              description: "A short, actionable summary of the note.",
            },
          },
          required: ["item_type", "category", "time_bucket", "is_event", "summary"],
        },
      },
    });

    const rawText = response.text;
    if (!rawText) {
      throw new Error("No text content returned from Gemini service.");
    }

    const trimmedText = rawText.trim();
    if (!trimmedText) {
      throw new Error("Empty text content returned from Gemini service.");
    }

    const analysis = JSON.parse(trimmedText) as GeminiNoteAnalysis;
    
    // Ensure the category is valid
    if (!Object.values(Category).includes(analysis.category as Category)) {
      analysis.category = Category.OTHER;
    }

    return analysis;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return fallback;
  }
};
