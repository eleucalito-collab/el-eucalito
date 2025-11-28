import React, { useState } from 'react';
import { Booking, Transaction } from '../types';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, isWithinInterval, parseISO, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckCircle, Clock } from 'lucide-react';
import { addTransaction } from '../services/firebase';

interface AgendaViewProps {
  bookings: Booking[];
}

const AgendaView: React.FC<AgendaViewProps> = ({ bookings }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Add empty placeholders for start of month alignment
  const startDay = monthStart.getDay(); 
  const emptyDays = Array(startDay).fill(null);

  const handleConfirmPayment = async (booking: Booking) => {
    if (booking.isPaid) return;
    const confirm = window.confirm(`¿Confirmar pago de USD ${booking.totalPriceUSD} para ${booking.guestName}?`);
    if (confirm) {
      // 1. Add Transaction
      await addTransaction({
        date: new Date().toISOString().split('T')[0],
        description: `Pago reserva: ${booking.guestName}`,
        amountUSD: booking.totalPriceUSD,
        originalCurrency: 'USD',
        category: 'Pago Reserva',
        paidBy: 'Cliente',
        isConfirmed: true,
        createdAt: Date.now()
      });
      // 2. Mark booking as paid (This logic would need an update function in firebase.ts, let's assume updateBooking handles it or we re-trigger)
      // For simplicity in this structure, we would trigger an update. 
      // *Wait, I added updateBooking in firebase.ts*
      const { updateBooking } = await import('../services/firebase');
      await updateBooking(booking.id, { isPaid: true });
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-full">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h2 className="text-lg font-bold text-slate-800 capitalize">
          {format(currentDate, 'MMMM yyyy', { locale: es })}
        </h2>
        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-full">
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white p-4 rounded-2xl shadow-sm flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 mb-2">
          {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(day => (
            <div key={day} className="text-center text-xs font-bold text-slate-400 py-2">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {emptyDays.map((_, i) => <div key={`empty-${i}`} className="aspect-square" />)}
          {daysInMonth.map((day) => {
            const dayBookings = bookings.filter(b => 
              isWithinInterval(day, { start: parseISO(b.startDate), end: parseISO(b.endDate) })
            );

            // Determine cell color based on bookings
            let bgColor = 'bg-slate-50';
            let textColor = 'text-slate-700';
            let borderColor = 'border-transparent';

            if (dayBookings.length > 0) {
              const b = dayBookings[0];
              if (b.isFamily) {
                bgColor = 'bg-blue-100'; // Family
                textColor = 'text-blue-700';
              } else if (!b.isPaid) {
                bgColor = 'bg-amber-100'; // Pending Payment
                textColor = 'text-amber-700';
                borderColor = 'border-amber-300';
              } else {
                bgColor = 'bg-emerald-100'; // Paid
                textColor = 'text-emerald-700';
              }
            }
            
            const isToday = isSameDay(day, new Date());

            return (
              <div 
                key={day.toISOString()} 
                className={`aspect-square rounded-lg flex flex-col items-center justify-center relative border ${borderColor} ${bgColor} ${isToday ? 'ring-2 ring-slate-800' : ''}`}
              >
                <span className={`text-sm font-medium ${textColor}`}>{format(day, 'd')}</span>
                {dayBookings.length > 0 && (
                   <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming / Active Bookings List */}
      <div className="space-y-3">
        <h3 className="font-bold text-slate-700 ml-1">Reservas del Mes</h3>
        {bookings
          .filter(b => {
             const start = parseISO(b.startDate);
             const end = parseISO(b.endDate);
             return isWithinInterval(start, { start: monthStart, end: monthEnd }) || isWithinInterval(end, { start: monthStart, end: monthEnd });
          })
          .sort((a,b) => a.startDate.localeCompare(b.startDate))
          .map(b => (
            <div key={b.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
              <div>
                <p className="font-bold text-slate-800">{b.guestName}</p>
                <p className="text-xs text-slate-500">
                  {format(parseISO(b.startDate), 'd MMM', {locale:es})} - {format(parseISO(b.endDate), 'd MMM', {locale:es})}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-md mt-1 inline-block ${b.isFamily ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {b.isFamily ? 'Familia' : `USD ${b.totalPriceUSD}`}
                </span>
              </div>
              
              {!b.isFamily && (
                <button 
                  onClick={() => handleConfirmPayment(b)}
                  disabled={b.isPaid}
                  className={`p-2 rounded-full ${b.isPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600 hover:bg-amber-200'}`}
                >
                  {b.isPaid ? <CheckCircle size={20} /> : <Clock size={20} />}
                </button>
              )}
            </div>
          ))}
      </div>
    </div>
  );
};

export default AgendaView;