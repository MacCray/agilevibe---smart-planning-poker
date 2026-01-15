
import { GoogleGenAI } from "@google/genai";

export const getEstimationInsight = async (taskTitle: string, taskDesc: string, votes: string[]) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      You are an expert Agile Coach. Analyze these Planning Poker results:
      Task: "${taskTitle}"
      Context: "${taskDesc}"
      Votes Received: ${votes.join(', ')}

      Analyze the voting distribution.
      If there is a consensus (similar values), explain why this is a good sign.
      If there is high variance (e.g. some 3 and some 13), identify potential hidden complexities or missing information that caused the gap.
      Be concise (max 3 sentences). Output in Russian language.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Не удалось получить анализ в данный момент.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "ИИ временно недоступен для анализа оценок.";
  }
};
