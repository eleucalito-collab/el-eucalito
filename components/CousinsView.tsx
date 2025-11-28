import React from 'react';
import { Transaction } from '../types';
import { COUSINS } from '../constants';
import { addTransaction } from '../services/firebase';

interface CousinsViewProps {
  transactions: Transaction[];
}

const CousinsView: React.FC<CousinsViewProps> = ({ transactions }) => {
  
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

  const handleSettle = async (name: string, balance: number) => {
    if (balance === 0) return;

    const absBalance = Math.abs(balance);
    let message = "";
    let category = "";
    let description = "";

    if (balance > 0) {
        // La Caja DEBE al Primo. La caja paga.
        message = `¿Confirmar que se le pagaron USD ${absBalance} a ${name} para saldar la deuda?`;
        category = "Reembolso";
        description = `Reembolso total a ${name}`;
    } else {
        // El Primo DEBE a la Caja. El primo paga.
        message = `¿Confirmar que ${name} entregó USD ${absBalance} a la caja?`;
        category = "Ingreso";
        description = `Saldo de deuda de ${name}`;
    }

    if (window.confirm(message)) {
        await addTransaction({
            date: new Date().toISOString().split('T')[0],
            description: description,
            amountUSD: absBalance,
            originalCurrency: 'USD',
            category: category as any,
            paidBy: name,
            isConfirmed: true,
            createdAt: Date.now()
        });
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      <h2 className="text-xl font-bold text-slate-800 mb-4">Estado de Cuenta Primos</h2>
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
                    {balance === 0 ? 'Al día' : (balance > 0 ? 'A favor (Caja debe)' : 'Debe (Caja cobra)')}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`text-lg font-bold ${balance > 0 ? 'text-emerald-600' : (balance < 0 ? 'text-red-500' : 'text-slate-400')}`}>
                  {balance === 0 ? '-' : `USD ${Math.abs(balance).toFixed(0)}`}
                </span>
                {balance !== 0 && (
                    <button 
                        onClick={() => handleSettle(cousin.name, balance)}
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
      <div className="mt-8 p-4 bg-blue-50 rounded-xl text-xs text-blue-700 space-y-1">
        <p><strong>A favor (Verde):</strong> El Airbnb le debe dinero al primo (porque pagó gastos).</p>
        <p><strong>Debe (Rojo):</strong> El primo tiene dinero del Airbnb, cobró una reserva no depositada o sacó un Adelanto.</p>
        <p><strong>Botón Saldar:</strong> Crea automáticamente un movimiento para dejar la cuenta en 0.</p>
      </div>
    </div>
  );
};

export default CousinsView;