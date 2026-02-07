
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function classifyNote(text: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Classify the following note text for a productivity system.
      Note: "${text}"
      
      Output strictly JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            item_type: { 
              type: Type.STRING, 
              enum: ["task", "event", "idea", "education", "important_info"] 
            },
            time_bucket: { 
              type: Type.STRING, 
              description: "An ISO8601 timestamp string OR one of: today, this_week, upcoming, none" 
            },
            category: { 
              type: Type.STRING, 
              enum: ["personal", "work", "creative", "social_marketing", "health", "money", "food", "home", "travel", "learning", "admin", "wishlist"] 
            },
          },
          required: ["item_type", "time_bucket", "category"],
        },
      },
    });

    const result = JSON.parse(response.text.trim());
    return result;
  } catch (error) {
    console.error("Gemini Classification Error:", error);
    return {
      item_type: "idea",
      time_bucket: "none",
      category: "admin"
    };
  }
}
