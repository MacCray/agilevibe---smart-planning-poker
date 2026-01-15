
import { GoogleGenAI } from "@google/genai";

export const getEstimationInsight = async (taskTitle: string, taskDesc: string, votes: string[]) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      As an Agile Coach, analyze the following Planning Poker estimation results:
      Task: "${taskTitle}"
      Description: "${taskDesc}"
      Votes Received: ${votes.join(', ')}

      Provide a concise 2-3 sentence analysis. 
      If there is high variance (e.g., someone voted 3 and someone voted 13), suggest what technical risks or misunderstandings might be causing the gap.
      If consensus is high, suggest why the task is well-understood.
      Do not use markdown formatting, just plain text.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "No insights available at this time.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The AI coach is currently unavailable to analyze these votes.";
  }
};
