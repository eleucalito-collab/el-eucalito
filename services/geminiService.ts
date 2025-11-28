import { GoogleGenAI } from "@google/genai";
import { COUSINS, FALLBACK_UYU_TO_USD } from "../constants";
import { AIResponse } from "../types";

// Obtener cotización histórica de una fecha específica
// API: @fawazahmed0/currency-api y fallback a open.er-api
export const getHistoricalRate = async (dateStr: string): Promise<number> => {
    try {
        // Comprobación simple: si es fecha futura o hoy, usa cotización actual.
        const today = new Date().toISOString().split('T')[0];
        if (dateStr >= today) {
             const res = await fetch('https://open.er-api.com/v6/latest/USD');
             const data = await res.json();
             return data.rates.UYU || FALLBACK_UYU_TO_USD;
        }

        // Para fechas pasadas, usamos la API histórica
        // Endpoint: https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@{date}/v1/currencies/usd.json
        const res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr}/v1/currencies/usd.json`);
        
        if (!res.ok) throw new Error("Historical API fail");
        
        const data = await res.json();
        // data.usd.uyu da cuántos UYU son 1 USD en esa fecha
        return data.usd.uyu || FALLBACK_UYU_TO_USD;

    } catch (e) {
        console.warn("Error fetching historical rate, using fallback/current", e);
        // Fallback a API actual si falla la histórica o no hay internet
        try {
            const res = await fetch('https://open.er-api.com/v6/latest/USD');
            const data = await res.json();
            return data.rates.UYU || FALLBACK_UYU_TO_USD;
        } catch (z) {
            return FALLBACK_UYU_TO_USD;
        }
    }
};

const buildSystemInstruction = () => `
Actúa como un asistente contable inteligente para "El Eucalito", un Airbnb familiar en Uruguay.
Tu objetivo es interpretar texto natural e imágenes para crear registros.

USUARIOS (Primos): ${COUSINS.map(c => `${c.name} (Alias: ${c.aliases.join(', ')})`).join('; ')}.
Si detectas un nombre o alias, normalízalo al nombre principal.

MONEDA:
- Identifica si es UYU (pesos) o USD (dólares).
- Extrae el monto ORIGINAL. 
- NO conviertas la moneda. Deja originalCurrency y originalAmount tal cual.

CATEGORÍAS PERMITIDAS:
'Ingreso', 'Insumos', 'Mantenimiento', 'Servicios', 'Cuentas', 'Impuestos', 'Préstamo', 'Pago Reserva', 'Reembolso'.

SALIDA JSON:
OPCIÓN A: UN SOLO MOVIMIENTO
{
  "type": "transaction",
  "data": {
    "date": "YYYY-MM-DD", 
    "description": "Breve descripción",
    "originalAmount": number,
    "originalCurrency": "UYU" | "USD",
    "category": "Categoría",
    "paidBy": "Nombre del primo"
  }
}

OPCIÓN B: BATCH (LISTA)
{
  "type": "batch_transactions",
  "data": [
      {
        "date": "YYYY-MM-DD", 
        "description": "Item 1",
        "originalAmount": number,
        "originalCurrency": "UYU" | "USD",
        "category": "Categoría",
        "paidBy": "Nombre del primo"
      },
      ...
  ]
}

OPCIÓN C: RESERVA
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
`;

export const processGeminiRequest = async (
  apiKey: string, 
  prompt: string, 
  imageBase64?: string
): Promise<AIResponse> => {
  if (!apiKey) return { type: 'error', message: 'Falta la API Key de Gemini.' };

  try {
    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = buildSystemInstruction();
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
            config: { systemInstruction, responseMimeType: 'application/json' }
        });
    } else {
        response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contextPrompt,
            config: { systemInstruction, responseMimeType: 'application/json' }
        });
    }

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    try {
      return JSON.parse(text);
    } catch (e) {
      return { type: 'error', message: 'Formato inválido de IA.' };
    }

  } catch (error: any) {
    return { type: 'error', message: error.message || 'Error Gemini.' };
  }
};