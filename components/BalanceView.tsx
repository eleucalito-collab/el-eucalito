import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Transaction, Booking, Category } from '../types';
import { CATEGORY_COLORS, CATEGORIES } from '../constants';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trash2, Pencil, X, Save, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';
import { deleteTransaction, updateTransaction } from '../services/firebase';

interface BalanceViewProps {
  transactions: Transaction[];
  bookings: Booking[];
}

const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatUYU = (amount: number) =>
  new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU' }).format(amount);

const BalanceView: React.FC<BalanceViewProps> = ({ transactions, bookings }) => {
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const stats = useMemo(() => {
    let businessIncome = 0; // Airbnb
    let contributions = 0; // Préstamos + Donaciones (Total Aportes)
    let totalDonations = 0; // Solo Donaciones (para cálculo de ganancia)
    let totalExpense = 0; // Gastos contables (no necesariamente de caja)
    
    // Variables de Estado Financiero Real
    let currentBox = 0; // Dinero físico en caja
    let totalPendingDebt = 0; // Cuánto debe el Eucalito a los Primos (Suma de saldos)
    
    transactions.forEach(t => {
      // Definimos quién es un "Primo" real (que genera deuda individual).
      // "Familia" se considera externo (como Cliente) para efectos de deuda individual.
      const isCousin = !['Caja', 'El Eucalito', 'Airbnb', 'Cliente', 'Familia'].includes(t.paidBy);

      // --- 1. CONTABILIDAD GENERAL (Visualización) ---
      if (t.category === 'Ingreso' || t.category === 'Pago Reserva') {
        businessIncome += t.amountUSD;
      } else if (t.category === 'Préstamo') {
        contributions += t.amountUSD;
      } else if (t.category === 'Donación') {
        contributions += t.amountUSD;
        totalDonations += t.amountUSD;
      } else if (!['Reembolso', 'Adelanto'].includes(t.category)) {
        // Gastos operativos (Insumos, etc)
        totalExpense += t.amountUSD;
      }

      // --- 2. LÓGICA DE CAJA Y DEUDA (Precisión) ---
      
      // A. GASTOS (Insumos, Mant, etc)
      if (!['Ingreso', 'Pago Reserva', 'Préstamo', 'Adelanto', 'Reembolso', 'Donación'].includes(t.category)) {
          if (isCousin) {
              // Pagó un primo con su plata -> La deuda sube (Caja debe al primo). La Caja física NO se mueve.
              totalPendingDebt += t.amountUSD;
          } else {
              // Pagó la Caja (o Familia/Cliente asumiendo regalo) -> La Caja baja si paga 'Caja'.
              if (t.paidBy === 'Caja') {
                  currentBox -= t.amountUSD;
              }
          }
      }

      // B. INGRESOS (Alquileres)
      if (['Ingreso', 'Pago Reserva'].includes(t.category)) {
          if (isCousin) {
              // Lo cobró un primo y se lo quedó -> La deuda BAJA (El primo le debe a la caja). Caja no se mueve.
              totalPendingDebt -= t.amountUSD;
          } else {
              // Entró a la Caja directo -> Caja sube.
              currentBox += t.amountUSD;
          }
      }

      // C. MOVIMIENTOS FINANCIEROS
      if (t.category === 'Préstamo') {
          // Primo pone plata en la caja -> Caja sube. Deuda sube.
          currentBox += t.amountUSD;
          totalPendingDebt += t.amountUSD;
      }

      if (t.category === 'Adelanto') {
          // Primo saca plata de la caja -> Caja baja. Deuda baja.
          currentBox -= t.amountUSD;
          totalPendingDebt -= t.amountUSD;
      }

      if (t.category === 'Reembolso') {
          // Caja paga deuda al primo -> Caja baja. Deuda baja.
          currentBox -= t.amountUSD;
          totalPendingDebt -= t.amountUSD;
      }

      if (t.category === 'Donación') {
          // 1. Donación de "Familia" o "Cliente": Entra dinero a caja. NO afecta deuda.
          if (!isCousin) {
              currentBox += t.amountUSD;
          } 
          // 2. Donación de Primo (Compra regalada):
          // En la IA esto se modela como "Donación (Primo)" + "Gasto (Caja)".
          // Aquí: "Donación (Primo)" -> No toca caja. Baja Deuda (porque asumimos que el sistema deuda sumó algo previamente, o simplemente es un aporte a fondo perdido).
          else {
              totalPendingDebt -= t.amountUSD; 
          }
      }
    });

    const expensesByCategory = CATEGORIES
      .filter(c => c !== 'Ingreso' && c !== 'Préstamo' && c !== 'Pago Reserva' && c !== 'Reembolso' && c !== 'Adelanto' && c !== 'Donación')
      .map(cat => {
        const catTransactions = transactions.filter(t => t.category === cat);
        const sum = catTransactions.reduce((acc, curr) => acc + curr.amountUSD, 0);
        return { name: cat, value: sum, transactions: catTransactions };
      })
      .filter(i => i.value > 0)
      .sort((a, b) => b.value - a.value);

    // CÁLCULO DE GANANCIA REAL (Profit)
    // Ingresos Operativos + Donaciones (Capital regalado) - Gastos
    const netProfit = (businessIncome + totalDonations) - totalExpense;

    return { 
        businessIncome, 
        contributions, 
        totalExpense, 
        totalPendingDebt, 
        currentBox, 
        expensesByCategory, 
        netProfit,
        totalDonations 
    };
  }, [transactions]);

  const recentTransactions = [...transactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleDelete = async (e: React.MouseEvent, id: string, description: string) => {
    e.stopPropagation();
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

  const getAmountColor = (category: Category) => {
      if (['Ingreso', 'Préstamo', 'Pago Reserva', 'Donación'].includes(category)) return 'text-emerald-600';
      if (category === 'Adelanto') return 'text-slate-500';
      if (category === 'Reembolso') return 'text-cyan-600'; 
      return 'text-slate-700';
  };

  return (
    <div className="p-4 space-y-6 pb-24 relative">
      {/* Edit Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
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

      {/* Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Row 1 */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Caja Actual</p>
          <p className={`text-xl font-bold ${stats.currentBox >= 0 ? 'text-primary' : 'text-red-500'}`}>{formatCurrency(stats.currentBox)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Gastos Totales</p>
          <p className="text-xl font-bold text-slate-700">{formatCurrency(stats.totalExpense)}</p>
        </div>
        
        {/* Row 2 */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ingresos</p>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(stats.businessIncome)}</p>
          <span className="text-[9px] text-slate-400">Reservas / Alquiler</span>
        </div>
        
        {/* Deuda / Donaciones Card */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Deuda / Donaciones</p>
          
          <div className="flex justify-between items-baseline mb-1 border-b border-slate-50 pb-1">
             <span className="text-[9px] text-slate-400">Neto Deuda</span>
             <span className={`text-sm font-bold ${stats.totalPendingDebt >= 0 ? 'text-pink-500' : 'text-emerald-500'}`}>
                {stats.totalPendingDebt >= 0 ? 'Caja Debe' : 'Primos Deben'} {formatCurrency(Math.abs(stats.totalPendingDebt))}
             </span>
          </div>

          <div className="flex justify-between items-baseline">
             <span className="text-[9px] text-slate-400">Donado</span>
             <span className="text-sm font-bold text-purple-600">
                {formatCurrency(stats.totalDonations)}
             </span>
          </div>
        </div>
      </div>

      {/* RENTABILIDAD / GANANCIA CARD */}
      <div className="bg-slate-800 p-4 rounded-2xl shadow-md border border-slate-700 flex justify-between items-center text-white">
         <div>
            <div className="flex items-center gap-2 mb-1">
                {stats.netProfit >= 0 ? <TrendingUp size={16} className="text-emerald-400"/> : <TrendingDown size={16} className="text-red-400"/>}
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ganancias Airbnb</p>
            </div>
            <p className="text-[10px] text-slate-400">
                (Ingresos + Donaciones) - Gastos
            </p>
         </div>
         <div className="text-right">
             <p className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(stats.netProfit)}
             </p>
         </div>
      </div>

      {/* CHART & CATEGORIES (Horizontal Layout) */}
      <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
         <div className="flex flex-row items-center h-[140px]">
            {/* Left: Title + Legend */}
            <div className="w-5/12 flex flex-col justify-center border-r border-slate-50 pr-2">
                <h3 className="text-xs font-bold text-slate-700 mb-2 leading-tight">Distribución<br/>de Gastos</h3>
                <div className="space-y-1 overflow-hidden">
                    {stats.expensesByCategory.length > 0 ? (
                        stats.expensesByCategory.slice(0, 5).map(cat => (
                            <div key={cat.name} className="flex items-center gap-1.5 w-full">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat.name as keyof typeof CATEGORY_COLORS] }} />
                                <span className="text-[9px] text-slate-500 truncate flex-1">{cat.name}</span>
                                <span className="text-[9px] font-bold text-slate-700">
                                    {(cat.value / (stats.totalExpense || 1) * 100).toFixed(0)}%
                                </span>
                            </div>
                        ))
                    ) : (
                        <span className="text-[9px] text-slate-400">Sin datos</span>
                    )}
                </div>
            </div>

            {/* Right: Pie Chart */}
            <div className="w-7/12 h-full relative">
                {stats.expensesByCategory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                            data={stats.expensesByCategory} 
                            cx="50%" 
                            cy="50%" 
                            innerRadius={35}
                            outerRadius={55} 
                            paddingAngle={2}
                            dataKey="value"
                            >
                            {stats.expensesByCategory.map((entry, index) => <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name as keyof typeof CATEGORY_COLORS]} />)}
                            </Pie>
                            <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-300">
                        No hay datos
                    </div>
                )}
            </div>
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
                        <button onClick={(e) => { e.stopPropagation(); setEditingTx(t); }}><Pencil size={12} className="text-slate-400 hover:text-blue-500"/></button>
                        <button onClick={(e) => handleDelete(e, t.id, t.description)}><Trash2 size={12} className="text-slate-400 hover:text-red-500"/></button>
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
                    <span className={`font-bold ${getAmountColor(t.category)}`}>
                    {['Ingreso', 'Préstamo', 'Pago Reserva', 'Donación'].includes(t.category) ? '+' : '-'}{formatCurrency(t.amountUSD)}
                    </span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setEditingTx(t); }} className="text-slate-300 hover:text-blue-500 p-1"><Pencil size={14} /></button>
                <button onClick={(e) => handleDelete(e, t.id, t.description)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BalanceView;