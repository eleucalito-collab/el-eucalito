import React, { useState } from 'react';
import { Transaction, Booking } from '../types';
import { nukeDatabase, restoreDatabase, isFirebaseConfigured, saveGlobalApiKey } from '../services/firebase';
import { Download, Upload, Trash2, Key, AlertTriangle, Cloud, Globe } from 'lucide-react';

interface SettingsViewProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  transactions: Transaction[];
  bookings: Booking[];
}

const SettingsView: React.FC<SettingsViewProps> = ({ apiKey, setApiKey, transactions, bookings }) => {
  const [tempKey, setTempKey] = useState(apiKey);
  const [importData, setImportData] = useState<string>('');
  
  const handleSaveKey = async () => {
    if(!tempKey) return;
    const confirm = window.confirm("¿Guardar esta llave para TODOS los usuarios? \n\nEsto permitirá que tus primos usen la App sin tener que configurar nada. La llave se guardará de forma segura en tu base de datos.");
    if (confirm) {
        await saveGlobalApiKey(tempKey);
        setApiKey(tempKey);
        alert('✅ Llave guardada en la Nube. Todos los usuarios sincronizados ahora tienen acceso a la IA.');
    }
  };

  const handleExportJSON = () => {
    const data = JSON.stringify({ transactions, bookings }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_el_eucalito_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImportJSON = () => {
    try {
      const parsed = JSON.parse(importData);
      if (parsed.transactions && parsed.bookings) {
        if(window.confirm("Esto reemplazará o agregará datos. ¿Seguro?")) {
            restoreDatabase(parsed.transactions, parsed.bookings);
            alert("Restauración completada (o iniciada). Recarga la página.");
        }
      } else {
        alert("Formato JSON inválido.");
      }
    } catch (e) {
      alert("Error leyendo JSON.");
    }
  };

  const handleNuke = () => {
    if (window.confirm("¿ESTÁS SEGURO? Se borrará TODA la base de datos de la nube.")) {
        if (window.confirm("¿REALMENTE SEGURO? No se puede deshacer.")) {
            nukeDatabase();
        }
    }
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <h2 className="text-xl font-bold text-slate-800">Ajustes</h2>

      {/* Firebase Status */}
      <div className={`p-4 rounded-xl border ${isFirebaseConfigured() ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
        <p className="font-bold text-sm flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isFirebaseConfigured() ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {isFirebaseConfigured() ? 'Sincronización en Nube Activa' : 'Modo Local (Sin Sincronización)'}
        </p>
        {!isFirebaseConfigured() && <p className="text-xs mt-1">Configura Firebase en <code>services/firebase.ts</code> para habilitar sync.</p>}
      </div>

      {/* API Key */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Key size={18}/> Gemini API Key (Compartida)</h3>
        <p className="text-xs text-slate-500 mb-3">
            Ingresa la API Key aquí una sola vez. Se guardará en la nube y se activará automáticamente para todos tus primos.
        </p>
        <div className="flex gap-2">
            <input 
              type="password" 
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              placeholder="Pegar API Key aquí..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button onClick={handleSaveKey} className="bg-slate-800 text-white px-4 rounded-lg text-sm font-medium hover:bg-slate-900 flex items-center gap-2">
              <Cloud size={16} /> Guardar
            </button>
        </div>
      </div>

      {/* Backup */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
        <h3 className="font-bold text-slate-700 mb-2">Datos y Respaldos</h3>
        <button onClick={handleExportJSON} className="w-full flex items-center justify-center gap-2 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50">
          <Download size={16} /> Exportar Backup JSON
        </button>
        
        <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500 mb-2">Restaurar copia (Pegar JSON):</p>
            <textarea 
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                className="w-full bg-slate-50 p-2 text-xs rounded-lg border border-slate-200 h-20"
            />
            <button onClick={handleImportJSON} className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 py-2 rounded-lg text-sm hover:bg-blue-100">
                <Upload size={16} /> Restaurar Datos
            </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
        <h3 className="font-bold text-red-800 mb-2 flex items-center gap-2"><AlertTriangle size={18}/> Zona de Peligro</h3>
        <button onClick={handleNuke} className="w-full bg-red-600 text-white py-3 rounded-lg text-sm font-bold hover:bg-red-700 flex items-center justify-center gap-2">
          <Trash2 size={18} /> ELIMINAR TODO
        </button>
      </div>
    </div>
  );
};

export default SettingsView;