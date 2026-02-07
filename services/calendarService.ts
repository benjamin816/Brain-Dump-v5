
const CALENDAR_AGENT_URL = "https://my-calendar-agent-v2.vercel.app/api/siri";

export const forwardToCalendar = async (rawText: string): Promise<boolean> => {
  try {
    const response = await fetch(CALENDAR_AGENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: rawText,
    });

    if (!response.ok) {
      console.warn("Calendar agent responded with error:", response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to forward to calendar agent:", error);
    return false;
  }
};
