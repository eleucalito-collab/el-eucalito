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
Si el usuario menciona explícitamente un nombre en el texto (ej: "Rorro compró esto"), ASIGNA ESE NOMBRE a todos los items detectados en la imagen, ignorando cualquier nombre que pueda aparecer impreso en la boleta.

MONEDA:
- Identifica si es UYU (pesos) o USD (dólares).
- Extrae el monto ORIGINAL. 
- NO conviertas la moneda. Deja originalCurrency y originalAmount tal cual.

CATEGORÍAS Y LÓGICA FINANCIERA (IMPORTANTE):
1. 'Insumos', 'Mantenimiento', 'Servicios', 'Cuentas', 'Impuestos': Gastos normales del negocio.
2. 'Ingreso', 'Pago Reserva': Dinero que entra por alquileres.
3. 'Préstamo': EL PRIMO PONE DINERO DE SU BOLSILLO EN LA CAJA (La caja le debe al primo).
4. 'Adelanto': EL PRIMO SACA DINERO DE LA CAJA (El primo le debe a la caja). Úsalo cuando dicen "sacó plata", "retiró", "agarró de la caja".
5. 'Reembolso': Devolución de deuda.
6. 'Donación': Regalo.

CASOS COMPLEJOS (LÓGICA DE VUELTO):
Si el usuario dice: "Primo sacó X plata y compró Y cosa y se quedó el vuelto":
DEBES CREAR DOS (2) TRANSACCIONES (Batch):
1. 'Adelanto': Por el monto TOTAL que sacó de la caja (USD o UYU).
2. 'Gasto' (Insumos/etc): Por el costo de lo que compró.
*Esto ajustará automáticamente el saldo: Debe todo el adelanto, pero se le descuenta lo que gastó legítimamente.*

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