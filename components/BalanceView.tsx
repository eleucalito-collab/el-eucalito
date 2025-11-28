import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Transaction, Booking, Category } from '../types';
import { CATEGORY_COLORS, CATEGORIES } from '../constants';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2, Pencil, X, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { deleteTransaction, updateTransaction } from '../services/firebase';

interface BalanceViewProps {
  transactions: Transaction[];
  bookings: Booking[];
}

const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatUYU = (amount: number) =>
  new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU' }).format(amount);

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const BalanceView: React.FC<BalanceViewProps> = ({ transactions, bookings }) => {
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const stats = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let totalPendingDebt = 0;
    
    transactions.forEach(t => {
      if (t.category === 'Ingreso' || t.category === 'Pago Reserva') {
        totalIncome += t.amountUSD;
      } else if (t.category === 'Préstamo') {
        totalIncome += t.amountUSD; 
        totalPendingDebt += t.amountUSD;
      } else if (t.category === 'Reembolso') {
        totalExpense += t.amountUSD;
        totalPendingDebt -= t.amountUSD;
      } else {
        totalExpense += t.amountUSD;
      }
    });

    const currentBox = totalIncome - totalExpense;
    
    // Group expenses for chart and accordion
    const expensesByCategory = CATEGORIES
      .filter(c => c !== 'Ingreso' && c !== 'Préstamo' && c !== 'Pago Reserva' && c !== 'Reembolso')
      .map(cat => {
        const catTransactions = transactions.filter(t => t.category === cat);
        const sum = catTransactions.reduce((acc, curr) => acc + curr.amountUSD, 0);
        return { name: cat, value: sum, transactions: catTransactions };
      })
      .filter(i => i.value > 0)
      .sort((a, b) => b.value - a.value); // Sort by highest expense

    return { totalIncome, totalExpense, totalPendingDebt, currentBox, expensesByCategory };
  }, [transactions]);

  const recentTransactions = [...transactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleDelete = async (id: string, description: string) => {
    if (window.confirm(`¿Seguro que quieres eliminar "${description}"?`)) {
        await deleteTransaction(id);
    }
  };

  const handleEditSave = async () => {
    if (!editingTx) return;
    await updateTransaction(editingTx.id, {
        description: editingTx.description,
        amountUSD: Number(editingTx.amountUSD),
        category: editingTx.category,
        date: editingTx.date,
        originalAmount: Number(editingTx.originalAmount || editingTx.amountUSD),
        exchangeRate: (editingTx.originalCurrency === 'UYU' && editingTx.originalAmount && editingTx.amountUSD) 
            ? Number((editingTx.originalAmount / editingTx.amountUSD).toFixed(2)) 
            : editingTx.exchangeRate
    });
    setEditingTx(null);
  };

  const toggleCategory = (catName: string) => {
    setExpandedCategory(expandedCategory === catName ? null : catName);
  };

  return (
    <div className="p-4 space-y-6 pb-24 relative">
      {/* Edit Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                <div className="bg-primary p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold">Editar Movimiento</h3>
                    <button onClick={() => setEditingTx(null)}><X size={20}/></button>
                </div>
                <div className="p-4 space-y-3">
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Descripción</label>
                        <input type="text" value={editingTx.description} onChange={e => setEditingTx({...editingTx, description: e.target.value})} className="w-full bg-slate-50 border p-2 rounded-lg"/>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-slate-500 block mb-1">Monto (USD)</label>
                            <input type="number" step="0.01" value={editingTx.amountUSD} onChange={e => setEditingTx({...editingTx, amountUSD: parseFloat(e.target.value)})} className="w-full bg-slate-50 border p-2 rounded-lg"/>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 block mb-1">Fecha</label>
                            <input type="date" value={editingTx.date} onChange={e => setEditingTx({...editingTx, date: e.target.value})} className="w-full bg-slate-50 border p-2 rounded-lg"/>
                        </div>
                    </div>
                    {editingTx.originalCurrency === 'UYU' && (
                         <div>
                            <label className="text-xs text-slate-500 block mb-1">Monto Original (UYU)</label>
                            <input type="number" value={editingTx.originalAmount} onChange={e => setEditingTx({...editingTx, originalAmount: parseFloat(e.target.value)})} className="w-full bg-slate-50 border p-2 rounded-lg"/>
                        </div>
                    )}
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Categoría</label>
                        <select value={editingTx.category} onChange={e => setEditingTx({...editingTx, category: e.target.value as Category})} className="w-full bg-slate-50 border p-2 rounded-lg">
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <button onClick={handleEditSave} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl mt-2 flex justify-center gap-2"><Save size={18}/> Guardar Cambios</button>
                </div>
            </div>
        </div>
      )}

      {/* Cards Grid - Updated with more stats */}
      <div className="grid grid-cols-2 gap-3">
        {/* Row 1 */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Caja Actual</p>
          <p className={`text-xl font-bold ${stats.currentBox >= 0 ? 'text-primary' : 'text-red-500'}`}>{formatCurrency(stats.currentBox)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ingresos Tot.</p>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(stats.totalIncome)}</p>
        </div>
        
        {/* Row 2 */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Gastos Tot.</p>
          <p className="text-xl font-bold text-slate-700">{formatCurrency(stats.totalExpense)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Deuda (Préstamos)</p>
          <p className="text-xl font-bold text-pink-500">{formatCurrency(stats.totalPendingDebt)}</p>
        </div>
      </div>

      {/* Chart - Smaller Size */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
         <h3 className="text-sm font-bold text-slate-700 mb-2 w-full">Distribución de Gastos</h3>
         <div style={{ width: '100%', height: 180 }}>
           {stats.expensesByCategory.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={stats.expensesByCategory} 
                      cx="50%" 
                      cy="50%" 
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={60} 
                      fill="#8884d8" 
                      dataKey="value"
                    >
                      {stats.expensesByCategory.map((entry, index) => <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name as keyof typeof CATEGORY_COLORS]} />)}
                    </Pie>
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{fontSize: '10px', marginTop: '5px'}} />
                  </PieChart>
                </ResponsiveContainer>
           ) : (
               <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                   No hay gastos registrados.
               </div>
           )}
         </div>
      </div>

      {/* Breakdown by Category (Accordion) */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-700 ml-1">Desglose por Categoría</h3>
        {stats.expensesByCategory.map((cat) => (
          <div key={cat.name} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <button 
              onClick={() => toggleCategory(cat.name)}
              className="w-full p-4 flex justify-between items-center hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat.name as keyof typeof CATEGORY_COLORS] }} />
                <span className="font-bold text-slate-700 text-sm">{cat.name}</span>
                <span className="text-xs text-slate-400">({cat.transactions.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700 text-sm">{formatCurrency(cat.value)}</span>
                {expandedCategory === cat.name ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
              </div>
            </button>
            
            {expandedCategory === cat.name && (
              <div className="bg-slate-50 border-t border-slate-100">
                {cat.transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (
                  <div key={t.id} className="p-3 border-b border-slate-200 last:border-0 pl-9 pr-4 flex justify-between items-start">
                    <div>
                      <div className="flex gap-2 items-center">
                        <span className="text-xs font-bold text-slate-700">{format(new Date(t.date), 'dd/MM/yy')}</span>
                        <span className="text-xs text-slate-500">• {t.paidBy}</span>
                      </div>
                      <p className="text-sm text-slate-800">{t.description}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold text-slate-700">{formatCurrency(t.amountUSD)}</span>
                      {t.originalCurrency === 'UYU' && (
                        <span className="text-[10px] text-slate-400">
                          {formatUYU(t.originalAmount || 0)} (TC: {t.exchangeRate?.toFixed(2)})
                        </span>
                      )}
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => setEditingTx(t)}><Pencil size={12} className="text-slate-400 hover:text-blue-500"/></button>
                        <button onClick={() => handleDelete(t.id, t.description)}><Trash2 size={12} className="text-slate-400 hover:text-red-500"/></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent Movements (All mixed) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <h3 className="p-4 text-sm font-bold text-slate-700 border-b border-slate-100 bg-slate-50">Todos los Movimientos</h3>
        <div className="max-h-60 overflow-y-auto no-scrollbar">
          {recentTransactions.map((t) => (
            <div key={t.id} className="p-4 border-b border-slate-50 last:border-0 flex justify-between items-center hover:bg-slate-50 transition-colors">
              <div className="flex flex-col">
                <span className="text-xs text-slate-400">{format(new Date(t.date), 'dd MMM', { locale: es })} • {t.paidBy}</span>
                <span className="text-sm text-slate-800 font-medium truncate max-w-[150px]">{t.description}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full w-fit mt-1 text-white" style={{ backgroundColor: CATEGORY_COLORS[t.category] }}>{t.category}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end">
                    <span className={`font-bold ${['Ingreso', 'Préstamo', 'Pago Reserva'].includes(t.category) ? 'text-emerald-600' : 'text-slate-700'}`}>
                    {['Ingreso', 'Préstamo', 'Pago Reserva'].includes(t.category) ? '+' : '-'}{formatCurrency(t.amountUSD)}
                    </span>
                </div>
                <button onClick={() => setEditingTx(t)} className="text-slate-300 hover:text-blue-500 p-1"><Pencil size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BalanceView;