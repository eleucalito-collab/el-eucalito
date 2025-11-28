import { CousinProfile, Category } from './types';

export const COUSINS: CousinProfile[] = [
  { name: 'Pablo', aliases: ['pablo', 'pablito'] },
  { name: 'Camila', aliases: ['camila', 'cami'] },
  { name: 'Marie', aliases: ['marie', 'marielena', 'mari'] },
  { name: 'Marian', aliases: ['marian', 'mariam'] },
  { name: 'Rorro', aliases: ['rorro', 'rodrigo', 'rodri'] },
  { name: 'Martín', aliases: ['martín', 'martin', 'tincho'] },
  { name: 'Carolina', aliases: ['carolina', 'carol', 'caro'] },
  { name: 'Tony', aliases: ['tony', 'antonio'] },
  { name: 'Joaquín', aliases: ['joaquín', 'joaquin', 'joaco'] },
  { name: 'Mica', aliases: ['mica', 'micaela', 'miqui', 'miki'] },
  { name: 'Nico', aliases: ['nico', 'nicolás', 'nicolas'] },
  { name: 'Pauli', aliases: ['pauli', 'paula', 'paulita', 'pau'] },
];

export const CATEGORIES: Category[] = [
  'Ingreso', 'Insumos', 'Mantenimiento', 'Servicios', 'Cuentas', 'Impuestos', 'Préstamo', 'Pago Reserva', 'Reembolso'
];

export const CATEGORY_COLORS: Record<Category, string> = {
  'Ingreso': '#10b981', // Emerald
  'Pago Reserva': '#34d399', // Emerald Light
  'Insumos': '#f59e0b', // Amber
  'Mantenimiento': '#ef4444', // Red
  'Servicios': '#3b82f6', // Blue
  'Cuentas': '#6366f1', // Indigo
  'Impuestos': '#8b5cf6', // Violet
  'Préstamo': '#ec4899', // Pink
  'Reembolso': '#06b6d4', // Cyan
};

// Default exchange rate fallback if API fails
export const FALLBACK_UYU_TO_USD = 42.5;