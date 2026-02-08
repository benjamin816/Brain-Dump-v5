
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
    // Strictly use process.env.API_KEY as per instructions
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("API_KEY missing, using fallback classification.");
      return fallback;
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a world-class productivity assistant. Classify the following user thought for a personal "Intelligence Layer" system. 
      Input Note: "${text}"
      
      Requirements:
      1. item_type: Must be 'task' (something to do), 'event' (time-specific), 'idea' (concept/reflection), or 'important_info' (fact/data).
      2. is_event: Set to true if a specific date or time is mentioned (e.g., "5pm", "tomorrow", "Friday").
      3. category: Assign to one of: Work, Personal, Creative, Social, Health, Finance, Admin, or Other.
      4. time_bucket: Extract the mentioned date/time as an ISO string if possible, or use "today", "this_week", "none".
      5. summary: A sharp 5-word summary for quick scanning.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            item_type: { 
              type: Type.STRING, 
              description: "The type of the item (task, event, idea, or important_info)"
            },
            category: { 
              type: Type.STRING, 
              description: "High-level domain of life"
            },
            time_bucket: { 
              type: Type.STRING,
              description: "Detected timeframe or 'none'"
            },
            is_event: { 
              type: Type.BOOLEAN,
              description: "Whether it contains calendar-routable temporal data"
            },
            summary: { 
              type: Type.STRING,
              description: "Concise summary"
            }
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
