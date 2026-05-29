import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "../types";

const ai = new GoogleGenAI({ 
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" 
});

export async function getTutorResponse(messages: ChatMessage[]) {
  const model = "gemini-3-flash-preview";
  
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'model' ? 'model' : 'user' as const,
    parts: [{ text: m.content }]
  }));
  
  const lastMessage = messages[messages.length - 1].content;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [...history, { role: 'user', parts: [{ text: lastMessage }] }],
      config: {
        systemInstruction: `You are a professional cello mentor and pedagogical consultant. 
        The user uses this app for two purposes:
        1. Reflecting on lessons they RECEIVED (help them analyze teacher feedback or find practice methods).
        2. Managing lessons they GIVE (help them find exercises for their students, explain concepts to different types of learners).
        
        Be technical, encouraging, and provide deep pedagogical insight. 
        If the user asks for a student's problem (e.g., 'My student is struggling with intonation'), provide specific diagnostic steps and etudes.
        Use Korean.`,
      }
    });

    return response.text || "죄송합니다. 응답을 생성하는 중에 문제가 발생했습니다.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 튜터와 연결하는 데 실패했습니다. 나중에 다시 시도해주세요.";
  }
}
