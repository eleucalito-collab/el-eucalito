import React, { useState } from 'react';
import { Transaction } from '../types';
import { COUSINS } from '../constants';
import { addTransaction } from '../services/firebase';
import { X, Save, Heart, History, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface CousinsViewProps {
  transactions: Transaction[];
}

const CousinsView: React.FC<CousinsViewProps> = ({ transactions }) => {
  const [settleModal, setSettleModal] = useState<{name: string, totalBalance: number} | null>(null);
  const [historyModal, setHistoryModal] = useState<string | null>(null); // Nombre del primo seleccionado
  const [settleAmount, setSettleAmount] = useState<string>('');

  const getCousinBalance = (name: string) => {
    let balance = 0;
    transactions.forEach(t => {
      if (t.paidBy.toLowerCase() === name.toLowerCase()) {
        // 1. EL PRIMO PONE PLATA (La caja le debe al primo)
        if (['Insumos', 'Mantenimiento', 'Servicios', 'Cuentas', 'Impuestos', 'Préstamo'].includes(t.category)) {
           balance += t.amountUSD;
        }
        // 2. EL PRIMO SACA PLATA O TIENE PLATA DE LA CAJA (El primo le debe a la caja)
        if (t.category === 'Reembolso' || t.category === 'Adelanto') {
            balance -= t.amountUSD;
        }
        // Ingreso/Pago Reserva: Si dice 'paidBy: Primo', significa que el primo cobró ese dinero y lo tiene.
        if (['Ingreso', 'Pago Reserva'].includes(t.category)) {
            balance -= t.amountUSD;
        }
      }
    });
    return balance;
  };

  const getFamilyDonationsTotal = () => {
      return transactions
        .filter(t => t.category === 'Donación' && t.paidBy === 'Familia')
        .reduce((acc, curr) => acc + curr.amountUSD, 0);
  };

  const openSettleModal = (e: React.MouseEvent, name: string, balance: number) => {
      e.stopPropagation(); // Evitar abrir el historial
      setSettleModal({ name, totalBalance: balance });
      setSettleAmount(Math.abs(balance).toString());
  }

  const handleConfirmSettle = async () => {
    if (!settleModal || !settleAmount) return;
    
    const amountToPay = parseFloat(settleAmount);
    if (isNaN(amountToPay) || amountToPay <= 0) {
        alert("Ingresa un monto válido");
        return;
    }

    const { name, totalBalance } = settleModal;
    let category = "";
    let description = "";

    if (totalBalance > 0) {
        category = "Reembolso";
        description = `Reembolso (Parcial/Total) a ${name}`;
    } else {
        category = "Ingreso";
        description = `Pago deuda (Parcial/Total) de ${name}`;
    }

    await addTransaction({
        date: new Date().toISOString().split('T')[0],
        description: description,
        amountUSD: amountToPay,
        originalCurrency: 'USD',
        category: category as any,
        paidBy: name,
        isConfirmed: true,
        createdAt: Date.now()
    });

    setSettleModal(null);
    setSettleAmount('');
  };

  const familyDonations = getFamilyDonationsTotal();

  // Filtrar transacciones para el historial del primo seleccionado
  const getCousinHistory = (name: string) => {
      return transactions
        .filter(t => t.paidBy.toLowerCase() === name.toLowerCase())
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const isPositiveImpact = (category: string) => {
      // Devuelve true si el movimiento AUMENTA la deuda de la caja hacia el primo (Verde)
      return ['Insumos', 'Mantenimiento', 'Servicios', 'Cuentas', 'Impuestos', 'Préstamo'].includes(category);
  };

  return (
    <div className="p-4 space-y-4 pb-24 relative">
      <h2 className="text-xl font-bold text-slate-800 mb-4">Estado de Cuenta Primos</h2>
      
      {/* HISTORY MODAL */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setHistoryModal(null)}>
            <div className="bg-white w-full h-[85vh] sm:h-auto sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-slate-800 p-4 flex justify-between items-center text-white shrink-0">
                    <h3 className="font-bold flex items-center gap-2">
                        <History size={18}/> Historial: {historyModal}
                    </h3>
                    <button onClick={() => setHistoryModal(null)}><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-0">
                    {getCousinHistory(historyModal).length === 0 ? (
                        <div className="p-8 text-center text-slate-400">No hay movimientos registrados.</div>
                    ) : (
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0">
                                <tr>
                                    <th className="p-3 border-b">Fecha/Desc</th>
                                    <th className="p-3 border-b text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {getCousinHistory(historyModal).map(t => {
                                    const isPositive = isPositiveImpact(t.category);
                                    return (
                                        <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                            <td className="p-3 align-top">
                                                <div className="font-bold text-slate-700 text-xs mb-0.5">{format(new Date(t.date), 'dd/MM/yy')}</div>
                                                <div className="text-slate-600 leading-tight">{t.description}</div>
                                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full inline-block mt-1">{t.category}</span>
                                            </td>
                                            <td className="p-3 text-right align-top">
                                                <span className={`font-bold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    {isPositive ? '+' : '-'} USD {t.amountUSD}
                                                </span>
                                                {t.originalCurrency === 'UYU' && (
                                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                                        ({t.originalAmount} UYU)
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50 text-center text-xs text-slate-500 shrink-0">
                    Verde (+) = Aumenta Deuda a Favor • Rojo (-) = Disminuye Deuda
                </div>
            </div>
        </div>
      )}

      {/* SETTLE MODAL */}
      {settleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
                <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold">Saldar Cuenta: {settleModal.name}</h3>
                    <button onClick={() => setSettleModal(null)}><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="text-center mb-4">
                        <p className="text-sm text-slate-500">Deuda Total Actual</p>
                        <p className={`text-2xl font-bold ${settleModal.totalBalance > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {settleModal.totalBalance > 0 ? 'A Favor (Caja Debe)' : 'En Contra (Debe a Caja)'}
                            <br/>
                            USD {Math.abs(settleModal.totalBalance).toFixed(2)}
                        </p>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                            Monto a saldar hoy (USD)
                        </label>
                        <input 
                            type="number" 
                            step="0.01"
                            value={settleAmount}
                            onChange={(e) => setSettleAmount(e.target.value)}
                            className="w-full text-lg border-2 border-slate-200 rounded-xl p-3 focus:border-primary outline-none"
                            placeholder="0.00"
                        />
                        <p className="text-xs text-slate-400 mt-2 text-center">
                            Si ingresas menos del total, quedará un saldo pendiente.
                        </p>
                    </div>

                    <button 
                        onClick={handleConfirmSettle}
                        className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl flex justify-center gap-2 hover:bg-emerald-700 transition-colors"
                    >
                        <Save size={18} /> Confirmar Transacción
                    </button>
                </div>
             </div>
        </div>
      )}

      <div className="space-y-3">
        {COUSINS.map((cousin) => {
          const balance = getCousinBalance(cousin.name);
          return (
            <div 
                key={cousin.name} 
                onClick={() => setHistoryModal(cousin.name)}
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg group-hover:bg-primary group-hover:text-white transition-colors">
                  {cousin.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                      <p className="font-bold text-slate-800">{cousin.name}</p>
                      <ChevronRight size={14} className="text-slate-300"/>
                  </div>
                  <p className="text-xs text-slate-400">
                    {Math.abs(balance) < 0.01 ? 'Al día' : (balance > 0 ? 'A favor (Caja debe)' : 'Debe (Caja cobra)')}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`text-lg font-bold ${balance > 0 ? 'text-emerald-600' : (balance < 0 ? 'text-red-500' : 'text-slate-400')}`}>
                  {Math.abs(balance) < 0.01 ? '-' : `USD ${Math.abs(balance).toFixed(0)}`}
                </span>
                {Math.abs(balance) >= 0.01 && (
                    <button 
                        onClick={(e) => openSettleModal(e, cousin.name, balance)}
                        className="text-xs px-3 py-1 bg-slate-800 text-white rounded-full hover:bg-slate-700 transition-colors z-10"
                    >
                        Saldar
                    </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* DONACIONES FAMILIARES */}
      <div className="mt-6 border-t border-slate-200 pt-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Fondo Común</h3>
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-xl shadow-sm border border-purple-100 flex justify-between items-center">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-purple-600 shadow-sm">
                  <Heart size={20} fill="currentColor" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Donaciones Familia</p>
                  <p className="text-xs text-slate-500">Aportes externos / Regalos</p>
                </div>
            </div>
            <span className="text-lg font-bold text-purple-600">
                  USD {familyDonations.toFixed(0)}
            </span>
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-xl text-xs text-blue-700 space-y-1">
        <p><strong>Click en el nombre:</strong> Ver historial detallado del primo.</p>
        <p><strong>A favor (Verde):</strong> El Airbnb le debe dinero al primo.</p>
        <p><strong>Debe (Rojo):</strong> El primo tiene dinero del Airbnb.</p>
      </div>
    </div>
  );
};

export default CousinsView;