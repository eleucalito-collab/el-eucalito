import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Calendar, PlusCircle, Users, Settings, Trees } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 mx-auto max-w-md shadow-2xl overflow-hidden relative">
      
      {/* Main Content Area */}
      <main className="h-screen overflow-hidden flex flex-col">
        {/* Dynamic Header based on Tab */}
        <header className="bg-white p-4 border-b border-slate-100 sticky top-0 z-10 flex justify-between items-center">
            <h1 className="text-xl font-bold text-primary flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Trees size={20} />
                </div>
                El Eucalito
            </h1>
            <div className="flex items-center gap-2">
                {isSynced && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">ONLINE</span>}
            </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar">
            {renderContent()}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 w-full bg-white border-t border-slate-200 flex justify-between px-6 py-3 pb-6 z-30 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)]">
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