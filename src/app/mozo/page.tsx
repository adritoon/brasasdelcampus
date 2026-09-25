'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Flame,
  ArrowLeft,
  Plus,
  Minus,
  Send,
  X,
  StickyNote,
  Check,
  ShoppingCart,
} from 'lucide-react';
import { subscribeToMenu, createOrder, subscribeToOrdersByMesa } from '@/lib/firestore';
import type { MenuItem, OrderItem, Order } from '@/lib/types';
import { TOTAL_MESAS, CATEGORIAS } from '@/lib/types';
import styles from './mozo.module.css';

type ViewState = 'mesas' | 'pedido';

interface CartItem extends OrderItem {
  menuItemId: string;
}

export default function MozoPage() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [view, setView] = useState<ViewState>('mesas');
  const [mesaActiva, setMesaActiva] = useState<number | null>(null);
  const [carrito, setCarrito] = useState<CartItem[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState<string>('Parrilla');
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pedidosMesa, setPedidosMesa] = useState<Order[]>([]);

  useEffect(() => {
    const unsub = subscribeToMenu((items) => {
      setMenu(items.filter((i) => i.disponible));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (mesaActiva === null) return;
    const unsub = subscribeToOrdersByMesa(mesaActiva, (orders) => {
      setPedidosMesa(orders);
    });
    return unsub;
  }, [mesaActiva]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const seleccionarMesa = (num: number) => {
    setMesaActiva(num);
    setView('pedido');
    setCarrito([]);
    setNotas('');
  };

  const agregarAlCarrito = (item: MenuItem) => {
    setCarrito((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, cantidad: c.cantidad + 1 } : c
        );
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

  const cambiarCantidad = (menuItemId: string, delta: number) => {
    setCarrito((prev) => {
      return prev
        .map((c) =>
          c.menuItemId === menuItemId
            ? { ...c, cantidad: c.cantidad + delta }
            : c
        )
        .filter((c) => c.cantidad > 0);
    });
  };

  const totalCarrito = carrito.reduce(
    (sum, item) => sum + item.precio * item.cantidad,
    0
  );

  const enviarPedido = async () => {
    if (carrito.length === 0 || mesaActiva === null) return;
    setEnviando(true);
    try {
      await createOrder(
        mesaActiva,
        carrito.map((c) => ({
          menuItemId: c.menuItemId,
          nombre: c.nombre,
          precio: c.precio,
          cantidad: c.cantidad,
        })),
        notas
      );
      showToast(`Pedido enviado a cocina — Mesa ${mesaActiva}`);
      setCarrito([]);
      setNotas('');
    } catch {
      showToast('Error al enviar pedido');
    }
    setEnviando(false);
  };

  const menuFiltrado = menu.filter((item) => item.categoria === categoriaActiva);

  const cantidadEnCarrito = (itemId: string) =>
    carrito.find((c) => c.menuItemId === itemId)?.cantidad || 0;

  if (view === 'mesas') {
    return (
      <div className={styles.page}>
        <header className="view-header">
          <h1>
            <Flame size={20} className="brand-mark" />
            <span className="brand-mark">Mozo</span>
          </h1>
        </header>

        <div className={styles.mesasContainer}>
          <h2 className={styles.mesasTitle}>Seleccioná una mesa</h2>
          <div className={styles.mesasGrid}>
            {Array.from({ length: TOTAL_MESAS }, (_, i) => i + 1).map(
              (num) => (
                <button
                  key={num}
                  className={styles.mesaBtn}
                  onClick={() => seleccionarMesa(num)}
                >
                  <span className={styles.mesaNum}>{num}</span>
                  <span className={styles.mesaLabel}>Mesa {num}</span>
                </button>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setView('mesas');
              setMesaActiva(null);
            }}
          >
            <ArrowLeft size={16} />
          </button>
          <h1>
            <Flame size={20} className="brand-mark" />
            <span>Mesa {mesaActiva}</span>
          </h1>
        </div>
        {carrito.length > 0 && (
          <div className={styles.cartBadge}>
            <ShoppingCart size={16} />
            <span>{carrito.length}</span>
          </div>
        )}
      </header>

      <div className={styles.pedidoLayout}>
        {/* Panel izquierdo: Menú */}
        <div className={styles.menuPanel}>
          <div className="tabs">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat}
                className={`tab ${categoriaActiva === cat ? 'active' : ''}`}
                onClick={() => setCategoriaActiva(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className={styles.menuList}>
            {menuFiltrado.map((item) => {
              const qty = cantidadEnCarrito(item.id);
              return (
                <div key={item.id} className={styles.menuRow}>
                  <div className={styles.menuRowInfo}>
                    <span className={styles.menuRowName}>{item.nombre}</span>
                    <span className={styles.menuRowPrice}>
                      S/ {item.precio.toFixed(2)}
                    </span>
                  </div>
                  <div className={styles.menuRowActions}>
                    {qty > 0 ? (
                      <div className="qty-control">
                        <button onClick={() => cambiarCantidad(item.id, -1)}>
                          <Minus size={14} />
                        </button>
                        <span>{qty}</span>
                        <button onClick={() => cambiarCantidad(item.id, 1)}>
                          <Plus size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => agregarAlCarrito(item)}
                      >
                        <Plus size={14} />
                        Agregar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel derecho: Carrito + Pedidos activos */}
        <div className={styles.sidePanel}>
          {/* Carrito actual */}
          <div className={styles.cartSection}>
            <h3>Pedido nuevo</h3>
            {carrito.length === 0 ? (
              <p className={styles.cartEmpty}>
                Agregá items del menú para armar el pedido.
              </p>
            ) : (
              <>
                <div className={styles.cartItems}>
                  {carrito.map((item) => (
                    <div key={item.menuItemId} className={styles.cartItem}>
                      <div>
                        <span className={styles.cartItemName}>{item.nombre}</span>
                        <span className={styles.cartItemQty}>x{item.cantidad}</span>
                      </div>
                      <div className={styles.cartItemRight}>
                        <span>S/ {(item.precio * item.cantidad).toFixed(2)}</span>
                        <button
                          className={styles.removeBtn}
                          onClick={() =>
                            setCarrito((prev) =>
                              prev.filter((c) => c.menuItemId !== item.menuItemId)
                            )
                          }
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.notasSection}>
                  <label>
                    <StickyNote size={14} />
                    Notas para cocina
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ej: sin ají, bien cocido..."
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                  />
                </div>

                <div className={styles.cartTotal}>
                  <span>Total</span>
                  <span>S/ {totalCarrito.toFixed(2)}</span>
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={enviarPedido}
                  disabled={enviando}
                >
                  {enviando ? (
                    <div className="spinner" style={{ width: '1rem', height: '1rem' }} />
                  ) : (
                    <>
                      <Send size={16} />
                      Enviar a cocina
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Pedidos activos de la mesa */}
          {pedidosMesa.length > 0 && (
            <div className={styles.activePedidos}>
              <h3>Pedidos activos</h3>
              {pedidosMesa.map((pedido) => (
                <div key={pedido.id} className={styles.activePedido}>
                  <div className={styles.activePedidoHeader}>
                    <span className={`badge badge-${pedido.estado === 'pendiente' ? 'pending' : pedido.estado === 'preparando' ? 'cooking' : 'ready'}`}>
                      {pedido.estado}
                    </span>
                    <span className={styles.activePedidoTime}>
                      {new Date(pedido.creadoEn).toLocaleTimeString('es-PE', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <ul className={styles.activePedidoItems}>
                    {pedido.items.map((item, i) => (
                      <li key={i}>
                        {item.cantidad}x {item.nombre}
                      </li>
                    ))}
                  </ul>
                  {pedido.estado === 'listo' && (
                    <div className={styles.readyBanner}>
                      <Check size={14} />
                      Listo para servir
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && <div className="toast toast-success">{toast}</div>}
    </div>
  );
}
