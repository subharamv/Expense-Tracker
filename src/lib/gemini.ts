import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface BillData {
  amount: number;
  date: string;
  vendorName: string;
  category: string;
}

export async function extractBillData(base64Image: string): Promise<BillData | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image,
              },
            },
            {
              text: "Extract information from this bill. Return a JSON object with amount (number), date (YYYY-MM-DD), vendorName (string), and category (one of: Food, Travel, Fuel, Lodging, Equipment, Miscellaneous).",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            date: { type: Type.STRING },
            vendorName: { type: Type.STRING },
            category: { type: Type.STRING },
          },
          required: ["amount", "date", "vendorName", "category"],
        },
      },
    });

    const text = response.text;
    return JSON.parse(text) as BillData;
  } catch (error) {
    console.error("Error extracting bill data:", error);
    return null;
  }
}
