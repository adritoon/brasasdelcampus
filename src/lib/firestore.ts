// src/lib/firestore.ts
// Funciones de Firestore para operaciones CRUD y listeners en tiempo real

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { MenuItem, Order, OrderItem, OrderStatus, Venta } from './types';

// ============================================
// MENÚ
// ============================================

export function subscribeToMenu(callback: (items: MenuItem[]) => void): Unsubscribe {
  const q = query(collection(db, 'menu'), orderBy('categoria'));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MenuItem[];
    callback(items);
  });
}

export async function addMenuItem(item: Omit<MenuItem, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'menu'), item);
  return docRef.id;
}

export async function updateMenuItem(id: string, data: Partial<MenuItem>): Promise<void> {
  await updateDoc(doc(db, 'menu', id), data);
}

export async function deleteMenuItem(id: string): Promise<void> {
  await deleteDoc(doc(db, 'menu', id));
}

// ============================================
// PEDIDOS
// ============================================

export function subscribeToOrders(
  callback: (orders: Order[]) => void,
  statusFilter?: OrderStatus[]
): Unsubscribe {
  let q;
  if (statusFilter && statusFilter.length > 0) {
    q = query(
      collection(db, 'pedidos'),
      where('estado', 'in', statusFilter),
      orderBy('creadoEn', 'desc')
    );
  } else {
    q = query(collection(db, 'pedidos'), orderBy('creadoEn', 'desc'));
  }

  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        creadoEn: data.creadoEn?.toDate?.() || new Date(),
        actualizadoEn: data.actualizadoEn?.toDate?.() || new Date(),
      };
    }) as Order[];
    callback(orders);
  });
}

export function subscribeToOrdersByMesa(
  mesa: number,
  callback: (orders: Order[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'pedidos'),
    where('mesa', '==', mesa),
    where('estado', 'in', ['pendiente', 'preparando', 'listo']),
    orderBy('creadoEn', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        creadoEn: data.creadoEn?.toDate?.() || new Date(),
        actualizadoEn: data.actualizadoEn?.toDate?.() || new Date(),
      };
    }) as Order[];
    callback(orders);
  });
}

export async function createOrder(
  mesa: number,
  items: OrderItem[],
  notas?: string
): Promise<string> {
  const total = items.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  const now = Timestamp.now();

  const docRef = await addDoc(collection(db, 'pedidos'), {
    mesa,
    items,
    estado: 'pendiente' as OrderStatus,
    total,
    creadoEn: now,
    actualizadoEn: now,
    notas: notas || '',
  });
  return docRef.id;
}

export async function updateOrderStatus(id: string, estado: OrderStatus): Promise<void> {
  await updateDoc(doc(db, 'pedidos', id), {
    estado,
    actualizadoEn: Timestamp.now(),
  });
}

export async function addItemsToOrder(id: string, newItems: OrderItem[]): Promise<void> {
  // Necesitamos obtener los items actuales primero
  const orderRef = doc(db, 'pedidos', id);
  const snapshot = await getDocs(
    query(collection(db, 'pedidos'), where('__name__', '==', id))
  );

  if (!snapshot.empty) {
    const current = snapshot.docs[0].data();
    const updatedItems = [...(current.items || []), ...newItems];
    const newTotal = updatedItems.reduce(
      (sum: number, item: OrderItem) => sum + item.precio * item.cantidad,
      0
    );

    await updateDoc(orderRef, {
      items: updatedItems,
      total: newTotal,
      actualizadoEn: Timestamp.now(),
    });
  }
}

// ============================================
// VENTAS
// ============================================

export async function closeOrder(
  orderId: string,
  metodoPago: Venta['metodoPago']
): Promise<string> {
  // Obtener datos del pedido
  const snapshot = await getDocs(
    query(collection(db, 'pedidos'), where('__name__', '==', orderId))
  );

  if (snapshot.empty) throw new Error('Pedido no encontrado');

  const orderData = snapshot.docs[0].data();

  // Crear registro de venta
  const ventaRef = await addDoc(collection(db, 'ventas'), {
    mesa: orderData.mesa,
    items: orderData.items,
    total: orderData.total,
    metodoPago,
    cerradoEn: Timestamp.now(),
    pedidoId: orderId,
  });

  // Marcar pedido como entregado
  await updateDoc(doc(db, 'pedidos', orderId), {
    estado: 'entregado' as OrderStatus,
    actualizadoEn: Timestamp.now(),
  });

  return ventaRef.id;
}

export function subscribeToVentas(
  callback: (ventas: Venta[]) => void
): Unsubscribe {
  const q = query(collection(db, 'ventas'), orderBy('cerradoEn', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const ventas = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        cerradoEn: data.cerradoEn?.toDate?.() || new Date(),
      };
    }) as Venta[];
    callback(ventas);
  });
}

// ============================================
// SEED DATA — para desarrollo
// ============================================

export async function seedMenu(): Promise<void> {
  const existing = await getDocs(collection(db, 'menu'));
  if (!existing.empty) return; // Ya hay datos

  const menuItems: Omit<MenuItem, 'id'>[] = [
    // Parrilla
    {
      nombre: 'Anticuchos de corazón',
      descripcion: 'Tres palitos de corazón de res marinado en ají panca, servidos con papa dorada y ají.',
      precio: 18,
      categoria: 'Parrilla',
      disponible: true,
    },
    {
      nombre: 'Parrilla personal',
      descripcion: 'Bife de chorizo, chorizo criollo, mollejita y chinchulín. Con papas fritas y ensalada.',
      precio: 38,
      categoria: 'Parrilla',
      disponible: true,
    },
    {
      nombre: 'Costillar BBQ',
      descripcion: 'Medio rack de costillas de cerdo bañadas en nuestra salsa BBQ ahumada. Con coleslaw.',
      precio: 42,
      categoria: 'Parrilla',
      disponible: true,
    },
    {
      nombre: 'Chuleta a la parrilla',
      descripcion: 'Chuleta de cerdo gruesa, marinada con chimichurri y servida con camotes glaseados.',
      precio: 32,
      categoria: 'Parrilla',
      disponible: true,
    },
    // Pollos
    {
      nombre: 'Pollo a la brasa (1/4)',
      descripcion: 'Cuarto de pollo a la brasa con papas fritas, ensalada y cremas.',
      precio: 16,
      categoria: 'Pollos',
      disponible: true,
    },
    {
      nombre: 'Pollo a la brasa (1/2)',
      descripcion: 'Medio pollo a la brasa con papas fritas, ensalada y cremas.',
      precio: 28,
      categoria: 'Pollos',
      disponible: true,
    },
    {
      nombre: 'Pollo a la brasa (entero)',
      descripcion: 'Pollo entero a la brasa con papas fritas, ensalada y cremas. Para compartir.',
      precio: 52,
      categoria: 'Pollos',
      disponible: true,
    },
    // Entradas
    {
      nombre: 'Tequeños de queso',
      descripcion: 'Seis tequeños crocantes rellenos de queso, con guacamole y ají.',
      precio: 14,
      categoria: 'Entradas',
      disponible: true,
    },
    {
      nombre: 'Salchipapas',
      descripcion: 'Papas fritas con salchicha hot dog, huevo frito, ketchup, mostaza y mayonesa.',
      precio: 12,
      categoria: 'Entradas',
      disponible: true,
    },
    // Guarniciones
    {
      nombre: 'Papas fritas',
      descripcion: 'Porción generosa de papas fritas crocantes.',
      precio: 8,
      categoria: 'Guarniciones',
      disponible: true,
    },
    {
      nombre: 'Ensalada fresca',
      descripcion: 'Lechuga, tomate, palta y cebolla con vinagreta de limón.',
      precio: 10,
      categoria: 'Guarniciones',
      disponible: true,
    },
    {
      nombre: 'Arroz con choclo',
      descripcion: 'Arroz graneado con granos de choclo y mantequilla.',
      precio: 7,
      categoria: 'Guarniciones',
      disponible: true,
    },
    // Bebidas
    {
      nombre: 'Chicha morada',
      descripcion: 'Jarra de chicha morada casera (1L).',
      precio: 10,
      categoria: 'Bebidas',
      disponible: true,
    },
    {
      nombre: 'Inca Kola 500ml',
      descripcion: 'La bebida del sabor nacional.',
      precio: 5,
      categoria: 'Bebidas',
      disponible: true,
    },
    {
      nombre: 'Limonada frozen',
      descripcion: 'Limonada helada preparada al momento.',
      precio: 8,
      categoria: 'Bebidas',
      disponible: true,
    },
    {
      nombre: 'Cerveza personal',
      descripcion: 'Cerveza rubia helada de 330ml.',
      precio: 8,
      categoria: 'Bebidas',
      disponible: true,
    },
    // Postres
    {
      nombre: 'Suspiro limeño',
      descripcion: 'Clásico postre peruano con merengue de oporto.',
      precio: 12,
      categoria: 'Postres',
      disponible: true,
    },
    {
      nombre: 'Brownie con helado',
      descripcion: 'Brownie tibio de chocolate con una bola de helado de vainilla.',
      precio: 14,
      categoria: 'Postres',
      disponible: true,
    },
  ];

  for (const item of menuItems) {
    await addDoc(collection(db, 'menu'), item);
  }
}
