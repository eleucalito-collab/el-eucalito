export type Currency = 'USD' | 'UYU';

export type Category = 
  | 'Ingreso' 
  | 'Insumos' 
  | 'Mantenimiento' 
  | 'Servicios' 
  | 'Cuentas' 
  | 'Impuestos' 
  | 'Préstamo' 
  | 'Pago Reserva'
  | 'Reembolso';

export interface Transaction {
  id: string;
  date: string; // ISO string
  description: string;
  amountUSD: number;
  originalAmount?: number; // If paid in UYU
  originalCurrency: Currency;
  category: Category;
  paidBy: string; // Cousin Name or 'Cliente'
  isConfirmed: boolean;
  createdAt: number;
}

export interface Booking {
  id: string;
  guestName: string;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD
  totalPriceUSD: number;
  isFamily: boolean; // True = Family (Color 1, Free), False = Client (Color 2, Paid)
  isPaid: boolean;
  notes?: string;
}

export interface CousinProfile {
  name: string;
  aliases: string[];
}

export type Tab = 'balance' | 'agenda' | 'chat' | 'cousins' | 'settings';

export interface AIResponse {
  type: 'transaction' | 'booking' | 'batch_transactions' | 'error';
  data?: any;
  message?: string;
}

export interface AppState {
  transactions: Transaction[];
  bookings: Booking[];
  apiKey: string;
  isLoading: boolean;
}