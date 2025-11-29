import React, { useState, useRef } from 'react';
import { Send, Image as ImageIcon, Loader2, Save, X, Users } from 'lucide-react';
import { processGeminiRequest, getHistoricalRate } from '../services/geminiService';
import { AIResponse, Category } from '../types';
import { addTransaction, addBooking } from '../services/firebase';
import { COUSINS, CATEGORIES } from '../constants';

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
      alert("Falta API Key en Ajustes.");
      return;
    }
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    processAI(userMsg);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!apiKey) { alert("Falta API Key"); return; }

    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        setMessages(prev => [...prev, { role: 'user', content: `[Imagen: ${file.name}]` }]);
        processAI("Analiza esta imagen y extrae gastos. Si escribí un nombre, asígnalo a todos.", base64);
    };
    reader.readAsDataURL(file);
  };

  const processAI = async (text: string, image?: string) => {
    setIsLoading(true);
    const result = await processGeminiRequest(apiKey, text, image);
    
    if (result.type === 'error') {
        setMessages(prev => [...prev, { role: 'ai', content: `Error: ${result.message}` }]);
        setIsLoading(false);
        return;
    }

    // POST-PROCESSING: Calculate USD with Historical Rates
    try {
        if (result.type === 'transaction') {
            const enriched = await enrichTransaction(result.data);
            setPendingData({ ...result, data: enriched });
        } else if (result.type === 'batch_transactions') {
            const enrichedList = await Promise.all((result.data as any[]).map(enrichTransaction));
            setPendingData({ ...result, data: enrichedList });
        } else {
            setPendingData(result);
        }
    } catch (e) {
        setMessages(prev => [...prev, { role: 'ai', content: "Error calculando cotizaciones." }]);
    }
    setIsLoading(false);
  };

  const enrichTransaction = async (data: any) => {
      let rate = 1;
      let amountUSD = data.originalAmount;
      
      // Si es UYU, buscamos la cotización histórica y dividimos
      if (data.originalCurrency === 'UYU') {
          rate = await getHistoricalRate(data.date);
          amountUSD = Number((data.originalAmount / rate).toFixed(2));
      } else {
          // Si es USD, el amountUSD es igual al originalAmount
          amountUSD = data.originalAmount;
      }

      return {
          ...data,
          amountUSD,
          exchangeRate: rate
      };
  };

  // Helper para actualizar datos en batch antes de confirmar
  const updatePendingItem = (index: number | null, field: string, value: any) => {
    if (!pendingData) return;

    if (pendingData.type === 'batch_transactions') {
        const newData = [...(pendingData.data as any[])];
        if (index !== null) {
            // Actualizar item individual
            newData[index] = { ...newData[index], [field]: value };
        } else {
            // Actualizar TODOS (Global)
            for(let i=0; i<newData.length; i++) {
                newData[i] = { ...newData[i], [field]: value };
            }
        }
        setPendingData({ ...pendingData, data: newData });
    } else if (pendingData.type === 'transaction') {
        setPendingData({ 
            ...pendingData, 
            data: { ...pendingData.data, [field]: value } 
        });
    }
  };

  const confirmAction = async () => {
    if (!pendingData) return;
    try {
      if (pendingData.type === 'transaction') {
        await addTransaction({ ...pendingData.data, isConfirmed: true, createdAt: Date.now() });
        setMessages(prev => [...prev, { role: 'ai', content: "✅ Guardado." }]);
      } else if (pendingData.type === 'batch_transactions') {
        for (const item of (pendingData.data as any[])) {
             await addTransaction({ ...item, isConfirmed: true, createdAt: Date.now() });
        }
        setMessages(prev => [...prev, { role: 'ai', content: `✅ ${pendingData.data.length} movimientos guardados.` }]);
      } else if (pendingData.type === 'booking') {
        await addBooking({ ...pendingData.data, isPaid: false });
        setMessages(prev => [...prev, { role: 'ai', content: "✅ Reserva agendada." }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', content: "❌ Error guardando." }]);
    }
    setPendingData(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 pb-20 relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && <div className="flex justify-start"><Loader2 className="w-5 h-5 animate-spin text-primary ml-2" /></div>}
      </div>

      {pendingData && (
        <div className="absolute inset-x-0 bottom-24 mx-4 bg-white rounded-2xl shadow-xl border-2 border-primary overflow-hidden z-20 max-h-[60vh] flex flex-col">
          <div className="bg-primary px-4 py-2 flex justify-between items-center shrink-0">
            <h3 className="text-white font-bold text-sm">Verificar Datos</h3>
            <button onClick={() => setPendingData(null)} className="text-white/80 hover:text-white"><X size={18}/></button>
          </div>
          
          <div className="p-4 text-sm text-slate-700 space-y-2 overflow-y-auto">
            {pendingData.type === 'batch_transactions' ? (
                <>
                 {/* GLOBAL SELECTOR */}
                 <div className="bg-slate-100 p-2 rounded-lg mb-2 flex items-center justify-between border border-slate-200">
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1"><Users size={12}/> Asignar todo a:</span>
                    <select 
                        className="bg-white text-xs border border-slate-300 rounded px-2 py-1 outline-none"
                        onChange={(e) => updatePendingItem(null, 'paidBy', e.target.value)}
                        defaultValue=""
                    >
                        <option value="" disabled>Elegir...</option>
                        {COUSINS.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        <option value="Familia">Familia</option>
                        <option value="Caja">Caja</option>
                        <option value="Cliente">Cliente</option>
                    </select>
                 </div>

                 {(pendingData.data as any[]).map((t: any, idx: number) => (
                    <div key={idx} className="border-b border-slate-100 pb-2 mb-2">
                        <div className="flex justify-between font-bold"><span>{t.description}</span><span>USD {t.amountUSD}</span></div>
                        <div className="text-xs text-slate-500 mb-1">
                             {t.date} 
                             {t.originalCurrency === 'UYU' && <span className="ml-1 bg-slate-100 px-1 rounded">TC: {t.exchangeRate?.toFixed(2)}</span>}
                        </div>
                        
                        {/* Inline Editors */}
                        <div className="flex gap-2 mt-1">
                            <select 
                                value={t.paidBy} 
                                onChange={(e) => updatePendingItem(idx, 'paidBy', e.target.value)}
                                className="text-xs border border-slate-200 rounded px-1 py-0.5 bg-slate-50 max-w-[100px]"
                            >
                                {COUSINS.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                <option value="Familia">Familia</option>
                                <option value="Caja">Caja</option>
                                <option value="Cliente">Cliente</option>
                            </select>
                            <select 
                                value={t.category} 
                                onChange={(e) => updatePendingItem(idx, 'category', e.target.value)}
                                className="text-xs border border-slate-200 rounded px-1 py-0.5 bg-slate-50 flex-1"
                            >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                ))}
                </>
            ) : pendingData.type === 'transaction' ? (
                <>
                    <p><strong>Gasto:</strong> {pendingData.data.description}</p>
                    <p><strong>Monto:</strong> USD {pendingData.data.amountUSD} {pendingData.data.originalCurrency === 'UYU' && <span className="text-xs bg-slate-100 px-1 rounded ml-1 text-slate-600">TC: {pendingData.data.exchangeRate?.toFixed(2)}</span>}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                            <label className="text-[10px] text-slate-500 font-bold block">Quién pagó</label>
                            <select 
                                value={pendingData.data.paidBy} 
                                onChange={(e) => updatePendingItem(null, 'paidBy', e.target.value)}
                                className="w-full text-sm border border-slate-200 rounded p-1"
                            >
                                {COUSINS.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                <option value="Familia">Familia</option>
                                <option value="Caja">Caja</option>
                                <option value="Cliente">Cliente</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 font-bold block">Categoría</label>
                            <select 
                                value={pendingData.data.category} 
                                onChange={(e) => updatePendingItem(null, 'category', e.target.value)}
                                className="w-full text-sm border border-slate-200 rounded p-1"
                            >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                </>
            ) : (
                <p>Reserva: {pendingData.data?.guestName} (USD {pendingData.data?.totalPriceUSD})</p>
            )}
          </div>
          <div className="p-4 pt-0 shrink-0">
            <button onClick={confirmAction} className="w-full bg-primary text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                <Save size={18} /> Confirmar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border-t border-slate-200 p-3 flex gap-2 items-center fixed bottom-[72px] left-0 right-0 z-10">
         <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-full transition-colors"><ImageIcon size={24} /></button>
         <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
         <div className="flex-1 relative"><input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Escribe aquí..." className="w-full bg-slate-100 text-slate-800 rounded-full py-3 px-4 outline-none focus:ring-2 focus:ring-primary/50"/></div>
         <button onClick={handleSend} disabled={!input.trim() && !isLoading} className="p-3 bg-primary text-white rounded-full disabled:bg-slate-300"><Send size={20} /></button>
      </div>
    </div>
  );
};

export default ChatView;