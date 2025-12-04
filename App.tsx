import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Calendar, PlusCircle, Users, Settings, Trees, Download } from 'lucide-react';
import { Tab, Transaction, Booking } from './types';
import { subscribeToTransactions, subscribeToBookings, subscribeToGlobalSettings, isFirebaseConfigured } from './services/firebase';
import BalanceView from './components/BalanceView';
import AgendaView from './components/AgendaView';
import ChatView from './components/ChatView';
import CousinsView from './components/CousinsView';
import SettingsView from './components/SettingsView';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('balance');
  const [apiKey, setApiKey] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isSynced, setIsSynced] = useState(false);

  useEffect(() => {
    // 1. Subscribe to Data
    const unsubTx = subscribeToTransactions((data) => setTransactions(data));
    const unsubBk = subscribeToBookings((data) => setBookings(data));
    
    // 2. Subscribe to Global Config (API Key)
    const unsubSettings = subscribeToGlobalSettings((key) => {
        if (key) {
            setApiKey(key);
            setIsSynced(true);
        }
    });

    return () => {
      unsubTx();
      unsubBk();
      unsubSettings();
    };
  }, []);

  const handleExportCSV = () => {
    // Helper para escapar comillas y evitar errores en CSV
    const escape = (val: any) => {
        if (val === null || val === undefined) return '';
        return `"${String(val).replace(/"/g, '""')}"`;
    };

    const formatDate = (dateStr: string) => dateStr;

    // --- SECCIÓN 1: MAESTRO (TODO) ---
    const masterHeaders = ["Fecha", "Descripción", "Categoría", "Quién Pagó", "Monto USD", "Monto Orig.", "Moneda", "T.C.", "Estado"];
    const sortedTx = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const masterRows = sortedTx.map(t => [
        escape(formatDate(t.date)),
        escape(t.description),
        escape(t.category),
        escape(t.paidBy),
        t.amountUSD,
        t.originalAmount || t.amountUSD,
        escape(t.originalCurrency),
        t.exchangeRate || 1,
        t.isConfirmed ? "Confirmado" : "Pendiente"
    ].join(","));

    // --- SECCIÓN 2: SOLO GASTOS (Por Categoría) ---
    const expenseTx = sortedTx.filter(t => !['Ingreso', 'Pago Reserva', 'Préstamo', 'Donación', 'Reembolso', 'Adelanto'].includes(t.category));
    // Ordenar por categoría y luego fecha
    expenseTx.sort((a, b) => a.category.localeCompare(b.category) || new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const expenseRows = expenseTx.map(t => [
        escape(formatDate(t.date)),
        escape(t.category),
        escape(t.description),
        escape(t.paidBy),
        t.amountUSD
    ].join(","));

    // --- SECCIÓN 3: INGRESOS Y DONACIONES ---
    const incomeTx = sortedTx.filter(t => ['Ingreso', 'Pago Reserva', 'Donación'].includes(t.category));
    const incomeRows = incomeTx.map(t => [
        escape(formatDate(t.date)),
        escape(t.category),
        escape(t.description),
        escape(t.paidBy),
        t.amountUSD
    ].join(","));

    // --- SECCIÓN 4: FINANCIERO (Préstamos y Deudas) ---
    const debtTx = sortedTx.filter(t => ['Préstamo', 'Reembolso', 'Adelanto'].includes(t.category));
    const debtRows = debtTx.map(t => [
        escape(formatDate(t.date)),
        escape(t.category),
        escape(t.description),
        escape(t.paidBy),
        t.amountUSD
    ].join(","));

    // --- CONSTRUCCIÓN DEL ARCHIVO FINAL ---
    const csvContent = [
        // ENCABEZADO REPORTE
        `REPORTE GENERAL EL EUCALITO`,
        `Generado el: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        "", // Línea vacía
        
        // BLOQUE 1
        "--- 1. HISTORIAL MAESTRO (TODOS LOS MOVIMIENTOS) ---",
        masterHeaders.join(","),
        ...masterRows,
        "", "", // Espacio
        
        // BLOQUE 2
        "--- 2. DETALLE DE GASTOS OPERATIVOS (POR CATEGORÍA) ---",
        "Fecha,Categoría,Descripción,Quién Pagó,Monto USD",
        ...expenseRows,
        "", "", // Espacio

        // BLOQUE 3
        "--- 3. INGRESOS Y DONACIONES ---",
        "Fecha,Tipo,Descripción,Quién/Origen,Monto USD",
        ...incomeRows,
        "", "", // Espacio

        // BLOQUE 4
        "--- 4. MOVIMIENTOS DE DEUDA (PRÉSTAMOS / ADELANTOS) ---",
        "Fecha,Tipo,Descripción,Primo,Monto USD",
        ...debtRows,
    ].join("\n");

    // Crear blob y descargar (con BOM para que Excel lea tildes correctamente)
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `El_Eucalito_Reporte_Completo_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'balance':
        return <BalanceView transactions={transactions} bookings={bookings} />;
      case 'agenda':
        return <AgendaView bookings={bookings} />;
      case 'chat':
        return <ChatView apiKey={apiKey} />;
      case 'cousins':
        return <CousinsView transactions={transactions} />;
      case 'settings':
        return <SettingsView apiKey={apiKey} setApiKey={setApiKey} transactions={transactions} bookings={bookings} />;
      default:
        return <BalanceView transactions={transactions} bookings={bookings} />;
    }
  };

  return (
    // CAMBIO IMPORTANTE: h-[100dvh] para altura dinámica real en móviles y flex-col para layout fijo
    <div className="h-[100dvh] bg-slate-50 font-sans text-slate-900 mx-auto max-w-md shadow-2xl flex flex-col overflow-hidden relative">
      
      {/* Header Fijo */}
      <header className="bg-white p-4 border-b border-slate-100 shrink-0 flex justify-between items-center z-10">
          <div className="flex items-center gap-2">
              {/* TÍTULO ACTUALIZADO: NEGRO, GRANDE, FUENTE OUTFIT */}
              <h1 className="text-2xl font-display font-black text-black flex items-center gap-2 uppercase tracking-widest">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Trees size={20} />
                  </div>
                  El Eucalito
              </h1>
              
              {/* Botón Exportar solo visible en Balance */}
              {activeTab === 'balance' && (
                  <button 
                      onClick={handleExportCSV}
                      className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded text-[10px] font-bold transition-colors"
                      title="Exportar a Excel/CSV"
                  >
                      <Download size={12} />
                      CSV
                  </button>
              )}
          </div>

          <div className="flex items-center gap-2">
              {isSynced && (
                  // INDICADOR ONLINE: SOLO PUNTO VERDE
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" title="Online"></div>
              )}
          </div>
      </header>

      {/* Contenido Scrolleable (ocupa el espacio restante) */}
      <main className="flex-1 overflow-y-auto no-scrollbar relative bg-slate-50">
          {renderContent()}
      </main>

      {/* Bottom Navigation Fija */}
      <nav className="bg-white border-t border-slate-200 flex justify-between px-6 py-3 pb-6 shrink-0 z-30 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)]">
        <button 
          onClick={() => setActiveTab('balance')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'balance' ? 'text-primary' : 'text-slate-400'}`}
        >
          <LayoutDashboard size={24} strokeWidth={activeTab === 'balance' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Balance</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('agenda')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'agenda' ? 'text-primary' : 'text-slate-400'}`}
        >
          <Calendar size={24} strokeWidth={activeTab === 'agenda' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Agenda</span>
        </button>

        {/* Central Add Button */}
        <div className="relative -top-8">
            <button 
              onClick={() => setActiveTab('chat')}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 ${
                  activeTab === 'chat' ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' : 'bg-primary text-white'
              }`}
            >
              <PlusCircle size={32} />
            </button>
        </div>

        <button 
          onClick={() => setActiveTab('cousins')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'cousins' ? 'text-primary' : 'text-slate-400'}`}
        >
          <Users size={24} strokeWidth={activeTab === 'cousins' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Primos</span>
        </button>

        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'settings' ? 'text-primary' : 'text-slate-400'}`}
        >
          <Settings size={24} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Ajustes</span>
        </button>
      </nav>

    </div>
  );
};

export default App;