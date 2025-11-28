import { GoogleGenAI } from "@google/genai";
import { COUSINS, FALLBACK_UYU_TO_USD } from "../constants";
import { AIResponse } from "../types";

// Helper to get fresh rate
const getExchangeRate = async (): Promise<number> => {
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        // data.rates.UYU is how many UYU for 1 USD. e.g. 42.5
        return data.rates.UYU || FALLBACK_UYU_TO_USD;
    } catch (e) {
        return FALLBACK_UYU_TO_USD;
    }
};

const buildSystemInstruction = (rate: number) => `
Actúa como un asistente contable inteligente para "El Eucalito", un Airbnb familiar en Uruguay.
Tu objetivo es interpretar texto natural (o transcripción de voz) e imágenes (boletas, tablas de excel, listas manuales) para crear registros estructurados.

USUARIOS (Primos): ${COUSINS.map(c => `${c.name} (Alias: ${c.aliases.join(', ')})`).join('; ')}.
Si detectas un nombre o alias, normalízalo al nombre principal. Si no detectas usuario, usa "Desconocido".

MONEDA Y CONVERSIÓN:
- COTIZACIÓN ACTUAL: 1 USD = ${rate.toFixed(2)} UYU.
- Si el usuario ingresa UYU (pesos uruguayos), DEBES convertir a USD usando esa cotización EXACTA.
- Si el usuario especifica otra cotización (ej: "a 40"), usa la del usuario.
- Retorna siempre el monto en USD final.

CATEGORÍAS PERMITIDAS:
'Ingreso', 'Insumos', 'Mantenimiento', 'Servicios', 'Cuentas', 'Impuestos', 'Préstamo', 'Pago Reserva', 'Reembolso' (usar Reembolso solo si se explícita devolución de deuda).

SALIDA JSON:
Debes responder SIEMPRE en formato JSON puro, sin markdown.

OPCIÓN A: UN SOLO MOVIMIENTO
{
  "type": "transaction",
  "data": {
    "date": "YYYY-MM-DD", 
    "description": "Breve descripción",
    "amountUSD": number,
    "originalAmount": number,
    "originalCurrency": "UYU" | "USD",
    "category": "Categoría",
    "paidBy": "Nombre del primo"
  }
}

OPCIÓN B: UNA LISTA DE MOVIMIENTOS (Para tablas, Excel o listas largas)
Si detectas múltiples ítems en una imagen o texto, usa este formato.
{
  "type": "batch_transactions",
  "data": [
      {
        "date": "YYYY-MM-DD", 
        "description": "Item 1",
        "amountUSD": number,
        "originalAmount": number,
        "originalCurrency": "UYU" | "USD",
        "category": "Categoría",
        "paidBy": "Nombre del primo"
      },
      ...
  ]
}

OPCIÓN C: RESERVA (AGENDA)
{
  "type": "booking",
  "data": {
    "guestName": "Nombre",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "totalPriceUSD": number,
    "isFamily": boolean,
    "notes": "string"
  }
}

SI ES UN ERROR:
{
  "type": "error",
  "message": "Explicación"
}
`;

export const processGeminiRequest = async (
  apiKey: string, 
  prompt: string, 
  imageBase64?: string
): Promise<AIResponse> => {
  if (!apiKey) return { type: 'error', message: 'Falta la API Key de Gemini.' };

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Fetch live rate
    const currentRate = await getExchangeRate();
    const systemInstruction = buildSystemInstruction(currentRate);

    // Add today's date context
    const contextPrompt = `Hoy es ${new Date().toISOString().split('T')[0]}. ${prompt}`;

    let response;
    
    if (imageBase64) {
         response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
                    { text: contextPrompt }
                ]
            },
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json'
            }
        });
    } else {
        response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contextPrompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json'
            }
        });
    }

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON", text);
      return { type: 'error', message: 'La IA no devolvió un formato válido.' };
    }

  } catch (error: any) {
    console.error("Gemini Error", error);
    return { type: 'error', message: error.message || 'Error conectando con Gemini.' };
  }
};