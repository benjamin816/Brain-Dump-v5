
import { GoogleGenAI, Type } from "@google/genai";
import { Category, GeminiNoteAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeNote = async (content: string): Promise<GeminiNoteAnalysis> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following note content. 
      1. Determine its category from: ${Object.values(Category).filter(c => c !== Category.ALL).join(", ")}.
      2. Check if it's a time-specific task, appointment, or event (e.g., "Meeting at 5pm", "Buy milk tomorrow morning", "Dr appointment Tuesday").
      3. Provide a concise summary for the calendar if it is an event.
      4. If it's an event, try to extract the time/date mentioned.

      Note Content: "${content}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: "The most appropriate category for the note.",
            },
            isEvent: {
              type: Type.BOOLEAN,
              description: "Whether the note describes a time-specific event or task.",
            },
            summary: {
              type: Type.STRING,
              description: "A short, actionable summary of the note.",
            },
            detectedTime: {
              type: Type.STRING,
              description: "Extracted time or date information if available.",
            },
          },
          required: ["category", "isEvent", "summary"],
        },
      },
    });

    const analysis = JSON.parse(response.text.trim()) as GeminiNoteAnalysis;
    
    // Ensure the category is valid
    if (!Object.values(Category).includes(analysis.category as Category)) {
      analysis.category = Category.OTHER;
    }

    return analysis;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      category: Category.OTHER,
      isEvent: false,
      summary: content.substring(0, 50),
    };
  }
};
