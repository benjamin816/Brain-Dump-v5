import { GoogleGenAI, Type } from "@google/genai";

export interface ClassificationResult {
  item_type: "idea" | "task" | "event";
  category: string;
  time_bucket: string;
  is_event: boolean;
  summary: string;
  classificationSource: "gemini" | "fallback";
  rawModelTextPreview?: string;
}

/**
 * Normalizes a category string against the provided list.
 * Returns the original cased string from the list if a match is found.
 */
function matchCategory(target: string, allowed: string[]): string | null {
  if (!target || allowed.length === 0) return null;
  const normalizedTarget = target.trim().toLowerCase();
  return allowed.find(c => c.trim().toLowerCase() === normalizedTarget) || null;
}

export async function classifyNote(text: string, categories: string[] = []): Promise<ClassificationResult> {
  const categoryListStr = categories.length > 0 
    ? categories.join(', ') 
    : "work, personal, other";

  const getFallback = (rawText?: string): ClassificationResult => {
    // Try to find 'other' in categories, else use first one
    const otherMatch = matchCategory("other", categories);
    const fallbackCategory = otherMatch || (categories.length > 0 ? categories[0] : "Other");

    return {
      item_type: "idea",
      time_bucket: "none",
      category: fallbackCategory,
      is_event: false,
      summary: text.substring(0, 50),
      classificationSource: "fallback",
      rawModelTextPreview: rawText ? rawText.substring(0, 120) : undefined
    };
  };

  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("Gemini API key (API_KEY) missing.");
      return getFallback();
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Explicit instructions for classification types
    const systemPrompt = `You are a high-performance productivity assistant.
Classify the user's note based on these rules:

1. item_type:
   - "task": If it implies a specific action, verb, or chore to be done (e.g., "Buy...", "Call...", "Fix...", "Send...").
   - "event": If it specifies a specific meeting, appointment, or occurrence at a set time (e.g., "Dinner at 7", "Meeting Friday").
   - "idea": If it is a concept, reflection, brain dump, or information without a clear immediate action or appointment (e.g., "Video idea...", "Thought about...").

2. category:
   - MUST be exactly one from this list: [${categoryListStr}].
   - If unsure, use "other" if available in the list.

3. time_bucket:
   - If an explicit date or time is mentioned (e.g., "at 7pm", "on Oct 5th"), return it as an ISO-8601 string or a specific time string.
   - Otherwise, use one of: "none", "today", "this_week", "upcoming".

4. summary:
   - A concise 5-word summary.

Return ONLY JSON. No markdown backticks.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `User Note: "${text}"`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            item_type: { 
              type: Type.STRING, 
              enum: ["idea", "task", "event"],
              description: "The primary intent of the note"
            },
            category: { 
              type: Type.STRING, 
              description: "Must match the provided list exactly"
            },
            time_bucket: { 
              type: Type.STRING, 
              description: "Temporal context (ISO string, 'none', 'today', 'this_week', 'upcoming')"
            },
            is_event: { 
              type: Type.BOOLEAN, 
              description: "True if specific temporal metadata exists"
            },
            summary: { 
              type: Type.STRING, 
              description: "Sharp summary"
            }
          },
          required: ["item_type", "category", "time_bucket", "is_event", "summary"],
        },
      },
    });

    const rawText = response.text?.trim() || "";
    let result;
    try {
      result = JSON.parse(rawText);
    } catch (e) {
      console.error("JSON Parse Error on Gemini Output:", rawText);
      return getFallback(rawText);
    }

    // Strict Validation & Normalization
    const validItemTypes = ["idea", "task", "event"];
    if (!validItemTypes.includes(result.item_type)) {
      result.item_type = "idea";
    }

    const matchedCat = matchCategory(result.category, categories);
    if (!matchedCat) {
      const otherMatch = matchCategory("other", categories);
      result.category = otherMatch || (categories.length > 0 ? categories[0] : "Other");
    } else {
      result.category = matchedCat;
    }

    return {
      ...result,
      classificationSource: "gemini"
    };

  } catch (error) {
    console.error("Gemini Classification Error:", error);
    return getFallback();
  }
}
