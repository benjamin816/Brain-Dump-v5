import { ForwardResponse } from '../types';

/**
 * Forwards a note to the Calendar Agent Executor.
 * Uses text/plain and includes an OUTBOX_ID for idempotency.
 */
export const forwardToCalendar = async (
  rawText: string, 
  apiKey: string, 
  outboxId: string,
  baseUrl?: string
): Promise<ForwardResponse> => {
  try {
    const finalBaseUrl = baseUrl || process.env.CALENDAR_AGENT_BASE_URL || "https://my-calendar-agent-v2.vercel.app";
    const executorUrl = `${finalBaseUrl.replace(/\/$/, '')}/api/inbox`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    // Prepend idempotency key for the executor
    const payload = `OUTBOX_ID: ${outboxId}\n---\n${rawText}`;

    const response = await fetch(executorUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "x-chronos-key": apiKey
      },
      body: payload,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return { 
        success: false, 
        status: response.status, 
        error: `Calendar executor error (${response.status}): ${errorText.substring(0, 100)}` 
      };
    }

    const data = await response.json();
    return { 
      success: true, 
      status: response.status,
      data: data
    };
  } catch (error: any) {
    const isTimeout = error.name === 'AbortError';
    return { 
      success: false, 
      error: isTimeout ? "Request timed out" : error.message || "Unknown error" 
    };
  }
};