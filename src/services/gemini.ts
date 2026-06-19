import { ChatMessage } from "../types";

export type TutorResponse = {
  answer: string;
  grounded: boolean;
  sources: any[];
  warning?: string;
  error?: string;
};

export async function getTutorResponse(
  messages: ChatMessage[],
  language: 'ko' | 'en' | 'de',
  token: string,
  profile?: object
): Promise<TutorResponse> {
  const history = messages.slice(0, -1).map(m => ({
    role: m.role,
    content: m.content
  }));
  
  const lastMessage = messages[messages.length - 1]?.content || '';

  try {
    const response = await fetch('/api/ai-tutor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        question: lastMessage,
        language,
        history,
        profile
      })
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
         return { answer: '', grounded: false, sources: [], error: 'auth_error' };
      }
      if (response.status === 429) {
         return { answer: '', grounded: false, sources: [], error: 'quota_error' };
      }
      if (response.status === 400 && data?.error?.includes('4000')) {
         return { answer: '', grounded: false, sources: [], error: 'length_error' };
      }
      if (data?.error?.includes('Admin settings missing')) {
         return { answer: '', grounded: false, sources: [], error: 'admin_error' };
      }
      if (data?.error?.includes('Gemini API Settings missing')) {
         return { answer: '', grounded: false, sources: [], error: 'gemini_error' };
      }
      return { answer: '', grounded: false, sources: [], error: data.error || `HTTP ${response.status}` };
    }

    return {
      answer: data.answer || '',
      grounded: data.grounded || false,
      sources: data.sources || [],
      warning: data.warning
    };
  } catch (error: any) {
    console.error("AI Tutor API Error:", error);
    return { answer: '', grounded: false, sources: [], error: "Network error" };
  }
}

