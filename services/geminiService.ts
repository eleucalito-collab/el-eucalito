import { GoogleGenAI } from "@google/genai";
import { COUSINS, FALLBACK_UYU_TO_USD } from "../constants";
import { AIResponse } from "../types";

// Obtener cotización histórica de una fecha específica
export const getHistoricalRate = async (dateStr: string): Promise<number> => {
    try {
        const today = new Date().toISOString().split('T')[0];
        if (dateStr >= today) {
             const res = await fetch('https://open.er-api.com/v6/latest/USD');
             const data = await res.json();
             return data.rates.UYU || FALLBACK_UYU_TO_USD;
        }

        const res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr}/v1/currencies/usd.json`);
        
        if (!res.ok) throw new Error("Historical API fail");
        
        const data = await res.json();
        return data.usd.uyu || FALLBACK_UYU_TO_USD;

    } catch (e) {
        console.warn("Error fetching historical rate, using fallback/current", e);
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
Actúa como un asistente contable para "El Eucalito".

USUARIOS: ${COUSINS.map(c => `${c.name} (${c.aliases.join(', ')})`).join('; ')}.

REGLA DE ORO DE ASIGNACIÓN (paidBy):
1. Si el usuario menciona un nombre (ej: "Rorro compró"), ASIGNA ESE NOMBRE a 'paidBy'.
2. Si es una DONACIÓN EXTERNA (ej: "La familia donó", "Fondo común", "Regalo de la abuela"), usa 'paidBy': "Familia".
3. Solo usa 'paidBy': "Caja" si el dinero SALE físicamente de la caja para pagar un gasto.

MONEDA: UYU (pesos) o USD (dólares). Extrae siempre el monto ORIGINAL. NO conviertas.

CATEGORÍAS:
1. GASTOS: 'Insumos', 'Mantenimiento', 'Servicios', 'Cuentas', 'Impuestos'.
2. INGRESOS: 'Ingreso', 'Pago Reserva'.
3. APORTES:
   - 'Préstamo': Primo pone plata y QUIERE que se la devuelvan.
   - 'Donación': Primo REGALA plata o bienes (No se devuelve).
4. INTERNOS:
   - 'Adelanto': Primo saca plata de la caja. IMPORTANTE: paidBy = NOMBRE DEL PRIMO (NUNCA 'Caja').
   - 'Reembolso': Devolución de deuda.

CASOS COMPLEJOS (BATCH):
A. "Primo sacó plata y compró algo y se quedó el vuelto":
   1. 'Adelanto' (Total sacado, paidBy: Primo).
   2. 'Gasto' (Costo item, paidBy: Primo).

B. "Primo COMPRÓ algo y lo REGALÓ/DONÓ" (Ej: Compró cortinas y las regaló):
   Para que la matemática cuadre (Caja neutra, Deuda 0):
   1. 'Donación' (Monto del item, paidBy: PRIMO). -> Simula que el primo metió la plata a la caja.
   2. 'Gasto' (Monto del item, paidBy: 'Caja'). -> Simula que la caja pagó el item con esa plata.

C. "Familia regaló dinero a la caja":
   1. 'Donación' (Monto, paidBy: "Familia").

SALIDA JSON:
OPCIÓN A: SINGLE
{ "type": "transaction", "data": { ... } }

OPCIÓN B: BATCH
{ "type": "batch_transactions", "data": [ { ... }, { ... } ] }

OPCIÓN C: RESERVA
{ "type": "booking", "data": { ... } }
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