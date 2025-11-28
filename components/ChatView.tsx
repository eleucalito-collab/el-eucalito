import React, { useState, useRef } from 'react';
import { Mic, Send, Image as ImageIcon, Loader2, Save, X } from 'lucide-react';
import { processGeminiRequest, AIResponse } from '../services/geminiService';
import { addTransaction, addBooking } from '../services/firebase';
import { format } from 'date-fns';

interface ChatViewProps {
  apiKey: string;
}

const ChatView: React.FC<ChatViewProps> = ({ apiKey }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string | React.ReactNode}[]>([]);
  const [pendingData, setPendingData] = useState<AIResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!apiKey) {
      alert("Por favor configura la API Key en Ajustes primero.");
      return;
    }

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsLoading(true);

    const result = await processGeminiRequest(apiKey, userMsg);
    
    setIsLoading(false);
    handleAIResult(result);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!apiKey) {
        alert("Configura API Key en Ajustes.");
        return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        setMessages(prev => [...prev, { role: 'user', content: `[Imagen Subida: ${file.name}]` }]);
        setIsLoading(true);
        const result = await processGeminiRequest(apiKey, "Analiza esta imagen y extrae los datos.", base64String);
        setIsLoading(false);
        handleAIResult(result);
    };
    reader.readAsDataURL(file);
  };

  const handleAIResult = (result: AIResponse) => {
    if (result.type === 'error') {
      setMessages(prev => [...prev, { role: 'ai', content: `Error: ${result.message}` }]);
    } else {
      setPendingData(result);
      // Show preview card in chat
    }
  };

  const confirmAction = async () => {
    if (!pendingData) return;

    try {
      if (pendingData.type === 'transaction') {
        await addTransaction({
            ...pendingData.data,
            isConfirmed: true,
            createdAt: Date.now()
        });
        setMessages(prev => [...prev, { role: 'ai', content: "✅ Transacción guardada con éxito." }]);
      } else if (pendingData.type === 'booking') {
        await addBooking({
            ...pendingData.data,
            isPaid: false
        });
        setMessages(prev => [...prev, { role: 'ai', content: "✅ Reserva agendada con éxito." }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', content: "❌ Error guardando en base de datos." }]);
    }
    setPendingData(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 pb-20 relative">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 text-sm text-slate-600">
          Hola, soy la IA de El Eucalito. Dime qué gastos o reservas quieres anotar.
          <br/><i>Ej: "Pauli gastó 500 pesos en super ayer" o sube una foto de la boleta.</i>
        </div>
        
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
              m.role === 'user' 
                ? 'bg-primary text-white rounded-br-none' 
                : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        
        {isLoading && (
            <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl rounded-bl-none shadow-sm border border-slate-200">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
            </div>
        )}
      </div>

      {/* Confirmation Modal / Overlay for Pending Data */}
      {pendingData && (
        <div className="absolute inset-x-0 bottom-24 mx-4 bg-white rounded-2xl shadow-xl border-2 border-primary overflow-hidden animation-slide-up z-20">
          <div className="bg-primary px-4 py-2 flex justify-between items-center">
            <h3 className="text-white font-bold text-sm">Verifica los datos</h3>
            <button onClick={() => setPendingData(null)} className="text-white/80 hover:text-white"><X size={18}/></button>
          </div>
          <div className="p-4 text-sm text-slate-700 space-y-2">
            {pendingData.type === 'transaction' && (
                <>
                    <p><strong>Tipo:</strong> Gasto/Ingreso</p>
                    <p><strong>Descripción:</strong> {pendingData.data.description}</p>
                    <p><strong>Monto:</strong> USD {pendingData.data.amountUSD}</p>
                    <p><strong>Quién:</strong> {pendingData.data.paidBy}</p>
                    <p><strong>Fecha:</strong> {pendingData.data.date}</p>
                    <p><strong>Categoría:</strong> {pendingData.data.category}</p>
                </>
            )}
            {pendingData.type === 'booking' && (
                <>
                    <p><strong>Tipo:</strong> Reserva</p>
                    <p><strong>Huésped:</strong> {pendingData.data.guestName}</p>
                    <p><strong>Fechas:</strong> {pendingData.data.startDate} al {pendingData.data.endDate}</p>
                    <p><strong>Precio:</strong> USD {pendingData.data.totalPriceUSD}</p>
                    <p><strong>Tipo:</strong> {pendingData.data.isFamily ? "Familia (Sin costo)" : "Airbnb"}</p>
                </>
            )}
            <button 
                onClick={confirmAction}
                className="w-full mt-2 bg-primary text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all"
            >
                <Save size={18} /> Confirmar y Guardar
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t border-slate-200 p-3 flex gap-2 items-center fixed bottom-[72px] left-0 right-0 z-10">
         <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-full transition-colors">
            <ImageIcon size={24} />
         </button>
         <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleFileUpload}
         />
         
         <div className="flex-1 relative">
            <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Escribe aquí..."
                className="w-full bg-slate-100 text-slate-800 rounded-full py-3 px-4 outline-none focus:ring-2 focus:ring-primary/50"
            />
         </div>

         {/* Mic button (visual only for this demo, web speech api is complex to perfect in one-shot) */}
         <button className="p-3 text-slate-400 hover:text-slate-600 rounded-full">
            <Mic size={24} />
         </button>

         <button 
            onClick={handleSend}
            disabled={!input.trim() && !isLoading}
            className="p-3 bg-primary text-white rounded-full disabled:bg-slate-300 disabled:cursor-not-allowed shadow-md hover:bg-emerald-700 transition-colors"
         >
            <Send size={20} />
         </button>
      </div>
    </div>
  );
};

export default ChatView;