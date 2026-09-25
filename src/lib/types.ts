// src/lib/types.ts
// Tipos centrales de la aplicación

export interface MenuItem {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: string;
  disponible: boolean;
  imagen?: string;
}

export interface OrderItem {
  menuItemId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  notas?: string;
}

export type OrderStatus = 'pendiente' | 'preparando' | 'listo' | 'entregado';

export interface Order {
  id: string;
  mesa: number;
  items: OrderItem[];
  estado: OrderStatus;
  total: number;
  creadoEn: Date;
  actualizadoEn: Date;
  notas?: string;
}

export interface Mesa {
  numero: number;
  ocupada: boolean;
  pedidoActivo?: string; // ID del pedido activo
}

export interface Venta {
  id: string;
  mesa: number;
  items: OrderItem[];
  total: number;
  metodoPago: 'efectivo' | 'tarjeta' | 'yape' | 'plin';
  cerradoEn: Date;
}

// Categorías del menú
export const CATEGORIAS = [
  'Parrilla',
  'Pollos',
  'Guarniciones',
  'Entradas',
  'Bebidas',
  'Postres',
] as const;

export type Categoria = typeof CATEGORIAS[number];

// Número total de mesas
export const TOTAL_MESAS = 12;
