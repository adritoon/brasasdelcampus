'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Flame,
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  X,
  Plus,
  DollarSign,
} from 'lucide-react';
import {
  subscribeToOrders,
  subscribeToMenu,
  closeOrder,
  addItemsToOrder,
} from '@/lib/firestore';
import type { Order, MenuItem, OrderItem, Venta } from '@/lib/types';
import { TOTAL_MESAS, CATEGORIAS } from '@/lib/types';
import styles from './caja.module.css';

type ModalType = 'cobrar' | 'agregar' | null;

export default function CajaPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [mesaActiva, setMesaActiva] = useState<number | null>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const [metodoPago, setMetodoPago] = useState<Venta['metodoPago']>('efectivo');
  const [procesando, setProcesando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Items extra para agregar
  const [extraItems, setExtraItems] = useState<OrderItem[]>([]);
  const [catExtra, setCatExtra] = useState<string>('Bebidas');

  useEffect(() => {
    const unsub = subscribeToOrders((incoming) => setOrders(incoming), [
      'pendiente',
      'preparando',
      'listo',
    ]);
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeToMenu((items) => setMenu(items.filter((i) => i.disponible)));
    return unsub;
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Pedidos agrupados por mesa
  const mesasConPedidos = Array.from(
    new Set(orders.map((o) => o.mesa))
  ).sort((a, b) => a - b);

  const pedidosDeMesa = orders.filter((o) => o.mesa === mesaActiva);
  const totalMesa = pedidosDeMesa.reduce((sum, o) => sum + o.total, 0);

  const cobrarMesa = async () => {
    if (!mesaActiva || pedidosDeMesa.length === 0) return;
    setProcesando(true);
    try {
      for (const pedido of pedidosDeMesa) {
        await closeOrder(pedido.id, metodoPago);
      }
      showToast(`Mesa ${mesaActiva} cobrada — S/ ${totalMesa.toFixed(2)}`);
      setModal(null);
      setMesaActiva(null);
    } catch {
      showToast('Error al procesar el cobro');
    }
    setProcesando(false);
  };

  const agregarExtras = async () => {
    if (extraItems.length === 0 || pedidosDeMesa.length === 0) return;
    setProcesando(true);
    try {
      // Agregar al primer pedido activo
      await addItemsToOrder(pedidosDeMesa[0].id, extraItems);
      showToast('Items agregados a la cuenta');
      setExtraItems([]);
      setModal(null);
    } catch {
      showToast('Error al agregar items');
    }
    setProcesando(false);
  };

  const toggleExtra = (item: MenuItem) => {
    setExtraItems((prev) => {
      const existing = prev.find((e) => e.menuItemId === item.id);
      if (existing) {
        return prev.filter((e) => e.menuItemId !== item.id);
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          nombre: item.nombre,
          precio: item.precio,
          cantidad: 1,
        },
      ];
    });
  };

  const metodos: { value: Venta['metodoPago']; label: string; icon: React.ReactNode }[] = [
    { value: 'efectivo', label: 'Efectivo', icon: <Banknote size={18} /> },
    { value: 'tarjeta', label: 'Tarjeta', icon: <CreditCard size={18} /> },
    { value: 'yape', label: 'Yape', icon: <Smartphone size={18} /> },
    { value: 'plin', label: 'Plin', icon: <Smartphone size={18} /> },
  ];

  return (
    <div className={styles.page}>
      <header className="view-header">
        <h1>
          <Flame size={20} className="brand-mark" />
          <span className="brand-mark">Caja</span>
        </h1>
      </header>

      <div className={styles.layout}>
        {/* Lista de mesas con pedidos */}
        <aside className={styles.sidebar}>
          <h3 className={styles.sidebarTitle}>Mesas activas</h3>
          {mesasConPedidos.length === 0 ? (
            <p className={styles.sidebarEmpty}>Sin mesas activas</p>
          ) : (
            <div className={styles.mesasList}>
              {mesasConPedidos.map((num) => {
                const pedidos = orders.filter((o) => o.mesa === num);
                const total = pedidos.reduce((s, o) => s + o.total, 0);
                return (
                  <button
                    key={num}
                    className={`${styles.mesaItem} ${mesaActiva === num ? styles.mesaItemActive : ''}`}
                    onClick={() => setMesaActiva(num)}
                  >
                    <span className="mesa-number occupied">{num}</span>
                    <div className={styles.mesaItemInfo}>
                      <span>Mesa {num}</span>
                      <span className={styles.mesaItemTotal}>
                        S/ {total.toFixed(2)}
                      </span>
                    </div>
                    <span className={styles.mesaItemCount}>
                      {pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Detalle de mesa */}
        <main className={styles.main}>
          {mesaActiva === null ? (
            <div className="empty-state">
              <Receipt size={48} />
              <p>Seleccioná una mesa para ver la cuenta.</p>
            </div>
          ) : (
            <>
              <div className={styles.mainHeader}>
                <h2>Cuenta — Mesa {mesaActiva}</h2>
                <div className={styles.mainActions}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setExtraItems([]);
                      setCatExtra('Bebidas');
                      setModal('agregar');
                    }}
                  >
                    <Plus size={14} />
                    Agregar item
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => setModal('cobrar')}
                    disabled={pedidosDeMesa.length === 0}
                  >
                    <DollarSign size={16} />
                    Cobrar mesa
                  </button>
                </div>
              </div>

              {/* Detalle de pedidos */}
              <div className={styles.pedidosList}>
                {pedidosDeMesa.map((pedido) => (
                  <div key={pedido.id} className={styles.pedidoCard}>
                    <div className={styles.pedidoCardHeader}>
                      <span className={`badge badge-${pedido.estado === 'pendiente' ? 'pending' : pedido.estado === 'preparando' ? 'cooking' : 'ready'}`}>
                        {pedido.estado}
                      </span>
                      <span className={styles.pedidoTime}>
                        {new Date(pedido.creadoEn).toLocaleTimeString('es-PE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Cant.</th>
                            <th style={{ textAlign: 'right' }}>Precio</th>
                            <th style={{ textAlign: 'right' }}>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pedido.items.map((item, i) => (
                            <tr key={i}>
                              <td>{item.nombre}</td>
                              <td>{item.cantidad}</td>
                              <td style={{ textAlign: 'right' }}>
                                S/ {item.precio.toFixed(2)}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                S/ {(item.precio * item.cantidad).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className={styles.pedidoCardTotal}>
                      Subtotal: S/ {pedido.total.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total general */}
              <div className={styles.totalGeneral}>
                <span>Total cuenta</span>
                <span>S/ {totalMesa.toFixed(2)}</span>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Modal Cobrar */}
      {modal === 'cobrar' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Cobrar Mesa {mesaActiva}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div className={styles.cobroTotal}>
              <span>Total a cobrar</span>
              <span className={styles.cobroAmount}>S/ {totalMesa.toFixed(2)}</span>
            </div>

            <div className={styles.metodos}>
              <label className={styles.metodoLabel}>Método de pago</label>
              <div className={styles.metodoGrid}>
                {metodos.map((m) => (
                  <button
                    key={m.value}
                    className={`${styles.metodoBtn} ${metodoPago === m.value ? styles.metodoBtnActive : ''}`}
                    onClick={() => setMetodoPago(m.value)}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--space-lg)' }}
              onClick={cobrarMesa}
              disabled={procesando}
            >
              {procesando ? (
                <div className="spinner" style={{ width: '1rem', height: '1rem' }} />
              ) : (
                <>
                  <DollarSign size={18} />
                  Confirmar cobro
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modal Agregar Items */}
      {modal === 'agregar' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '600px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Agregar items — Mesa {mesaActiva}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="tabs" style={{ marginBottom: 'var(--space-md)' }}>
              {CATEGORIAS.map((cat) => (
                <button
                  key={cat}
                  className={`tab ${catExtra === cat ? 'active' : ''}`}
                  onClick={() => setCatExtra(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className={styles.extraList}>
              {menu
                .filter((m) => m.categoria === catExtra)
                .map((item) => {
                  const selected = extraItems.some((e) => e.menuItemId === item.id);
                  return (
                    <button
                      key={item.id}
                      className={`${styles.extraItem} ${selected ? styles.extraItemSelected : ''}`}
                      onClick={() => toggleExtra(item)}
                    >
                      <span>{item.nombre}</span>
                      <span className={styles.extraPrice}>
                        S/ {item.precio.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
            </div>

            {extraItems.length > 0 && (
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--space-md)' }}
                onClick={agregarExtras}
                disabled={procesando}
              >
                <Plus size={16} />
                Agregar {extraItems.length} {extraItems.length === 1 ? 'item' : 'items'}
              </button>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast toast-success">{toast}</div>}
    </div>
  );
}
