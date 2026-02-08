import { GoogleGenAI, Type } from "@google/genai";

export async function classifyNote(text: string) {
  const fallback = {
    item_type: "idea",
    time_bucket: "none",
    category: "Other",
    is_event: false,
    summary: text.substring(0, 50)
  };

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY or API_KEY missing, using fallback classification.");
      return fallback;
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Classify this note for a personal productivity system. 
      Note: "${text}"
      
      Requirements:
      1. item_type: task, event, idea, or important_info.
      2. is_event: true if there is a specific date or time mentioned.
      3. category: Work, Personal, Creative, Social, Health, Finance, Admin, or Other.
      4. time_bucket: Extract date/time as ISO string or "today", "this_week", "none".
      5. summary: A 5-word actionable summary.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            item_type: { type: Type.STRING, enum: ["task", "event", "idea", "important_info"] },
            category: { type: Type.STRING, enum: ["Work", "Personal", "Creative", "Social", "Health", "Finance", "Admin", "Other"] },
            time_bucket: { type: Type.STRING },
            is_event: { type: Type.BOOLEAN },
            summary: { type: Type.STRING }
          },
          required: ["item_type", "category", "time_bucket", "is_event", "summary"],
        },
      },
    });

    const rawText = response.text;
    if (!rawText) throw new Error("Empty response from Gemini");
    
    return JSON.parse(rawText.trim());
  } catch (error) {
    console.error("Gemini Classification Error:", error);
    return fallback;
  }
}