import React from 'react';
import { Transaction } from '../types';
import { COUSINS } from '../constants';

interface CousinsViewProps {
  transactions: Transaction[];
}

const CousinsView: React.FC<CousinsViewProps> = ({ transactions }) => {
  
  const getCousinBalance = (name: string) => {
    // Logic: 
    // If Cousin Paid Expense -> Airbnb owes Cousin (+ Balance for Cousin)
    // If Cousin Loaned Money -> Airbnb owes Cousin (+ Balance)
    // If Cousin borrowed money -> Cousin owes Airbnb (- Balance)
    // If Cousin generated Income (unlikely unless they collected cash) -> depends on logic.
    
    // Simplification:
    // Expense paid by Cousin = Credit
    // Loan given by Cousin = Credit
    // Anything else? Maybe they collect cash from guest? Assuming no for now.

    let balance = 0;
    transactions.forEach(t => {
      // Check if this transaction is associated with the cousin
      // We need to match name or aliases. But data is normalized by Gemini to main name usually.
      if (t.paidBy.toLowerCase() === name.toLowerCase()) {
        if (t.category === 'Ingreso' || t.category === 'Pago Reserva') {
             // Cousin collected money? Or Cousin paid into box? 
             // "Pablo prestó 1000" -> Category Loan.
             // Usually cousins pay expenses.
        }
        
        if (['Insumos', 'Mantenimiento', 'Servicios', 'Cuentas', 'Impuestos'].includes(t.category)) {
           balance += t.amountUSD;
        }
        if (t.category === 'Préstamo') {
            balance += t.amountUSD;
        }
      }
    });
    return balance;
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
                    {balance > 0 ? 'A favor' : 'Al día'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-lg font-bold ${balance > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  USD {balance.toFixed(0)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-8 p-4 bg-blue-50 rounded-xl text-xs text-blue-700">
        Nota: El balance "A Favor" aumenta cuando un primo paga un gasto de la casa o presta dinero.
      </div>
    </div>
  );
};

export default CousinsView;