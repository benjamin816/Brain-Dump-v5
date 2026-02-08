
const CALENDAR_AGENT_URL = "https://my-calendar-agent-v2.vercel.app/api/siri";

export interface ForwardResponse {
  success: boolean;
  status?: number;
  error?: string;
}

export const forwardToCalendar = async (rawText: string, apiKey: string): Promise<ForwardResponse> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    const response = await fetch(CALENDAR_AGENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "x-chronos-key": apiKey
      },
      body: rawText,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { 
        success: false, 
        status: response.status, 
        error: `Calendar agent error: ${response.statusText}` 
      };
    }

    return { success: true, status: response.status };
  } catch (error: any) {
    const isTimeout = error.name === 'AbortError';
    return { 
      success: false, 
      error: isTimeout ? "Request timed out" : error.message || "Unknown error" 
    };
  }
};
