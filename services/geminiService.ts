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

REGLA DE ORO DE ASIGNACIÓN:
Si el usuario menciona un nombre en el texto (ej: "Rorro compró esto", "Gastos de Marie"), ASIGNA ESE NOMBRE ("Rorro", "Marie") al campo 'paidBy' de TODOS los items detectados, ignorando cualquier otro nombre que aparezca impreso en la boleta.

MONEDA:
- Identifica si es UYU (pesos) o USD (dólares).
- Extrae el monto ORIGINAL. 
- NO conviertas la moneda.

CATEGORÍAS Y LÓGICA FINANCIERA:
1. 'Insumos', 'Mantenimiento', 'Servicios', 'Cuentas', 'Impuestos': Gastos normales.
2. 'Ingreso', 'Pago Reserva': Dinero que entra por alquileres.
3. 'Préstamo': EL PRIMO PONE DINERO DE SU BOLSILLO EN LA CAJA (La caja le debe al primo).
4. 'Adelanto': EL PRIMO SACA DINERO DE LA CAJA (El primo le debe a la caja). 
   IMPORTANTE: En 'Adelanto', el campo 'paidBy' DEBE SER EL NOMBRE DEL PRIMO que retiró el dinero. NUNCA pongas 'Caja' en paidBy para un Adelanto.
5. 'Reembolso': Devolución de deuda.
6. 'Donación': Regalo.

CASOS COMPLEJOS (BATCH):
A. "Primo sacó plata y compró algo y se quedó el vuelto":
   CREAR DOS TRANSACCIONES:
   1. 'Adelanto' (Total sacado, paidBy: NOMBRE DEL PRIMO).
   2. 'Gasto' (Insumos/etc) (Costo de lo comprado, paidBy: NOMBRE DEL PRIMO).
   *El sistema matemático ajustará el saldo automáticamente.*

B. "Primo COMPRÓ algo y lo REGALÓ/DONÓ" (Ej: Compró cortinas y las regaló):
   Para que la matemática cuadre (Caja neutra, Deuda 0):
   1. 'Donación' (Monto del item, paidBy: PRIMO). -> Simula que el primo metió la plata a la caja.
   2. 'Gasto' (Monto del item, paidBy: 'Caja'). -> Simula que la caja pagó el item con esa plata.

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