import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Transaction, Booking } from '../types';
import { CATEGORY_COLORS, CATEGORIES } from '../constants';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { deleteTransaction } from '../services/firebase';

interface BalanceViewProps {
  transactions: Transaction[];
  bookings: Booking[];
}

const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const BalanceView: React.FC<BalanceViewProps> = ({ transactions, bookings }) => {
  
  const stats = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let totalPendingDebt = 0; // Deuda que la CAJA debe (dinero prestado por primos)
    
    transactions.forEach(t => {
      if (t.category === 'Ingreso' || t.category === 'Pago Reserva') {
        totalIncome += t.amountUSD;
      } else if (t.category === 'Préstamo') {
        // Préstamo significa que un primo puso plata en la caja para salvar las papas.
        // Entra dinero a la caja (Income) pero genera deuda.
        totalIncome += t.amountUSD; 
        totalPendingDebt += t.amountUSD;
      } else if (t.category === 'Reembolso') {
        // La caja paga a un primo. Sale dinero.
        // Esto reduce la deuda con el primo, y reduce la caja.
        totalExpense += t.amountUSD;
        totalPendingDebt -= t.amountUSD; // Asumimos que Reembolso paga deuda vieja
      } else {
        totalExpense += t.amountUSD;
      }
    });

    const currentBox = totalIncome - totalExpense;

    // Chart Data
    const expensesByCategory = CATEGORIES
      .filter(c => c !== 'Ingreso' && c !== 'Préstamo' && c !== 'Pago Reserva')
      .map(cat => {
        const sum = transactions
          .filter(t => t.category === cat)
          .reduce((acc, curr) => acc + curr.amountUSD, 0);
        return { name: cat, value: sum };
      })
      .filter(i => i.value > 0);

    return { totalIncome, totalExpense, totalPendingDebt, currentBox, expensesByCategory };
  }, [transactions]);

  const recentTransactions = [...transactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleDelete = async (id: string, description: string) => {
    if (window.confirm(`¿Seguro que quieres eliminar el movimiento "${description}"?`)) {
        await deleteTransaction(id);
    }
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      
      {/* Cards Header */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 font-medium uppercase">Caja Actual</p>
          <p className={`text-2xl font-bold ${stats.currentBox >= 0 ? 'text-primary' : 'text-red-500'}`}>
            {formatCurrency(stats.currentBox)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 font-medium uppercase">Gastos Totales</p>
          <p className="text-2xl font-bold text-slate-700">
            {formatCurrency(stats.totalExpense)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 font-medium uppercase">Ingresos</p>
          <p className="text-lg font-semibold text-emerald-600">
            {formatCurrency(stats.totalIncome)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500 font-medium uppercase">Deudas (Préstamos)</p>
          <p className="text-lg font-semibold text-orange-500">
            {formatCurrency(stats.totalPendingDebt)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 h-80">
        <h3 className="text-sm font-bold text-slate-700 mb-2">Gastos por Categoría</h3>
        {stats.expensesByCategory.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats.expensesByCategory}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {stats.expensesByCategory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name as keyof typeof CATEGORY_COLORS]} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{fontSize: '10px'}} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">Sin gastos registrados</div>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <h3 className="p-4 text-sm font-bold text-slate-700 border-b border-slate-100 bg-slate-50">Últimos Movimientos</h3>
        <div className="max-h-96 overflow-y-auto no-scrollbar">
          {recentTransactions.map((t) => (
            <div key={t.id} className="p-4 border-b border-slate-50 last:border-0 flex justify-between items-center hover:bg-slate-50 transition-colors group">
              <div className="flex flex-col">
                <span className="text-xs text-slate-400">{format(new Date(t.date), 'dd MMM yyyy', { locale: es })} • {t.paidBy}</span>
                <span className="text-sm text-slate-800 font-medium">{t.description}</span>
                <span className="text-xs px-2 py-0.5 rounded-full w-fit mt-1 text-white" style={{ backgroundColor: CATEGORY_COLORS[t.category] }}>
                  {t.category}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                    <span className={`font-bold ${['Ingreso', 'Préstamo', 'Pago Reserva'].includes(t.category) ? 'text-emerald-600' : 'text-slate-700'}`}>
                    {['Ingreso', 'Préstamo', 'Pago Reserva'].includes(t.category) ? '+' : '-'}{formatCurrency(t.amountUSD)}
                    </span>
                    {t.originalCurrency === 'UYU' && (
                    <span className="text-xs text-slate-400">($U {t.originalAmount})</span>
                    )}
                </div>
                <button 
                    onClick={() => handleDelete(t.id, t.description)}
                    className="text-slate-300 hover:text-red-500 transition-colors p-2"
                    title="Eliminar movimiento"
                >
                    <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {recentTransactions.length === 0 && (
             <div className="p-8 text-center text-slate-400 text-sm">No hay movimientos aún.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BalanceView;