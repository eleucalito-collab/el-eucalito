import React, { useState } from 'react';
import { Transaction } from '../types';
import { COUSINS } from '../constants';
import { addTransaction } from '../services/firebase';
import { X, Save, Heart } from 'lucide-react';

interface CousinsViewProps {
  transactions: Transaction[];
}

const CousinsView: React.FC<CousinsViewProps> = ({ transactions }) => {
  const [settleModal, setSettleModal] = useState<{name: string, totalBalance: number} | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');

  const getCousinBalance = (name: string) => {
    let balance = 0;
    transactions.forEach(t => {
      // Normalizamos: paidBy debería ser el nombre del primo.
      if (t.paidBy.toLowerCase() === name.toLowerCase()) {
        
        // 1. EL PRIMO PONE PLATA (La caja le debe al primo)
        if (['Insumos', 'Mantenimiento', 'Servicios', 'Cuentas', 'Impuestos', 'Préstamo'].includes(t.category)) {
           balance += t.amountUSD;
        }

        // 2. EL PRIMO SACA PLATA O TIENE PLATA DE LA CAJA (El primo le debe a la caja)
        // Reembolso: La caja le pagó al primo.
        // Adelanto: El primo sacó dinero de la caja (Retiro).
        if (t.category === 'Reembolso' || t.category === 'Adelanto') {
            balance -= t.amountUSD;
        }
        
        // Ingreso/Pago Reserva: Si dice 'paidBy: Primo', significa que el primo cobró ese dinero y lo tiene en su bolsillo.
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

  const openSettleModal = (name: string, balance: number) => {
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
        // La Caja DEBE al Primo. (Saldo Positivo). La caja paga.
        category = "Reembolso";
        description = `Reembolso (Parcial/Total) a ${name}`;
    } else {
        // El Primo DEBE a la Caja. (Saldo Negativo). El primo paga.
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

  return (
    <div className="p-4 space-y-4 pb-24 relative">
      <h2 className="text-xl font-bold text-slate-800 mb-4">Estado de Cuenta Primos</h2>
      
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
            <div key={cousin.name} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg">
                  {cousin.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-800">{cousin.name}</p>
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
                        onClick={() => openSettleModal(cousin.name, balance)}
                        className="text-xs px-3 py-1 bg-slate-800 text-white rounded-full hover:bg-slate-700 transition-colors"
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
        <p><strong>A favor (Verde):</strong> El Airbnb le debe dinero al primo (porque pagó gastos).</p>
        <p><strong>Debe (Rojo):</strong> El primo tiene dinero del Airbnb, cobró una reserva no depositada o sacó un Adelanto.</p>
        <p><strong>Botón Saldar:</strong> Permite pagar la deuda total o parcial.</p>
      </div>
    </div>
  );
};

export default CousinsView;