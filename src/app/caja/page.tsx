'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Flame,
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  X,
  Plus,
  Minus,
  DollarSign,
  SplitSquareHorizontal,
  Printer,
} from 'lucide-react';
import {
  subscribeToOrders,
  subscribeToMenu,
  closeTableAccount,
  addItemsToOrder,
  subscribeToCategories,
} from '@/lib/firestore';
import type { Order, MenuItem, OrderItem, Venta, MetodoPago, Pago } from '@/lib/types';
import { TOTAL_MESAS } from '@/lib/types';
import styles from './caja.module.css';

type ModalType = 'cobrar' | 'agregar' | 'boleta' | null;

interface BoletaData {
  mesa: number;
  items: OrderItem[];
  total: number;
  metodoPago: string;
  pagos?: Pago[];
  fecha: Date;
  vuelto?: number;
}

export default function CajaPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [mesaActiva, setMesaActiva] = useState<number | null>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [procesando, setProcesando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Items extra para agregar
  const [extraItems, setExtraItems] = useState<OrderItem[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [catExtra, setCatExtra] = useState<string>('Bebidas');

  // Vuelto (efectivo)
  const [montoRecibido, setMontoRecibido] = useState<string>('');

  // Pago dividido
  const [dividirCuenta, setDividirCuenta] = useState(false);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [pagoMetodo, setPagoMetodo] = useState<MetodoPago>('efectivo');
  const [pagoMonto, setPagoMonto] = useState<string>('');
  const [pagoRecibido, setPagoRecibido] = useState<string>('');
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set());

  // Boleta
  const [boletaData, setBoletaData] = useState<BoletaData | null>(null);
  const boletaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToOrders((incoming) => setOrders(incoming), [
      'pendiente',
      'preparando',
      'listo',
      'entregado',
    ]);
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeToMenu((items) => setMenu(items.filter((i) => i.disponible)));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeToCategories((cats) => {
      setCategorias(cats);
      if (cats.length > 0 && !cats.includes(catExtra)) {
        setCatExtra(cats[0]);
      }
    });
    return unsub;
  }, [catExtra]);

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

  // Todos los items de la mesa consolidados
  const itemsConsolidados = pedidosDeMesa.reduce<OrderItem[]>((acc, pedido) => {
    pedido.items.forEach(item => {
      const existing = acc.find(a => a.menuItemId === item.menuItemId);
      if (existing) {
        existing.cantidad += item.cantidad;
      } else {
        acc.push({ ...item });
      }
    });
    return acc;
  }, []);

  // Items unitarios para la calculadora
  const itemsIndividuales = useMemo(() => {
    const list: { id: string; nombre: string; precio: number }[] = [];
    pedidosDeMesa.forEach((p) => {
      p.items.forEach((item) => {
        for (let i = 0; i < item.cantidad; i++) {
          list.push({
            id: `${item.menuItemId}-${p.id}-${i}`,
            nombre: item.nombre,
            precio: item.precio,
          });
        }
      });
    });
    return list;
  }, [pedidosDeMesa]);

  const vuelto = montoRecibido ? parseFloat(montoRecibido) - totalMesa : 0;
  const totalPagos = pagos.reduce((sum, p) => sum + p.monto, 0);
  const restantePorPagar = totalMesa - totalPagos;

  const resetCobro = () => {
    setMontoRecibido('');
    setDividirCuenta(false);
    setPagos([]);
    setPagoMetodo('efectivo');
    setPagoMonto('');
    setPagoRecibido('');
    setPendingItems(new Set());
    setMetodoPago('efectivo');
  };

  const agregarPago = () => {
    const monto = parseFloat(pagoMonto);
    if (!monto || monto <= 0) return;
    const recibido = pagoMetodo === 'efectivo' && pagoRecibido ? parseFloat(pagoRecibido) : undefined;
    setPagos(prev => [...prev, { metodo: pagoMetodo, monto, recibido, items: Array.from(pendingItems) }]);
    setPagoMonto('');
    setPagoRecibido('');
    setPendingItems(new Set());
  };

  const quitarPago = (index: number) => {
    setPagos(prev => prev.filter((_, i) => i !== index));
  };

  const toggleItemCalc = (item: { id: string; precio: number }) => {
    setPendingItems(prev => {
      const next = new Set(prev);
      const actualMonto = parseFloat(pagoMonto) || 0;
      if (next.has(item.id)) {
        next.delete(item.id);
        setPagoMonto(Math.max(0, actualMonto - item.precio).toFixed(2));
      } else {
        next.add(item.id);
        setPagoMonto((actualMonto + item.precio).toFixed(2));
      }
      return next;
    });
  };

  const cobrarMesa = async () => {
    if (!mesaActiva || pedidosDeMesa.length === 0) return;

    // Validar pago dividido
    if (dividirCuenta && Math.abs(totalPagos - totalMesa) > 0.01) {
      showToast('El total de los pagos no coincide con la cuenta');
      return;
    }

    setProcesando(true);
    try {
      const pagosFinales = dividirCuenta ? pagos : undefined;
      const metodoFinal = dividirCuenta ? pagos[0]?.metodo || 'efectivo' : metodoPago;

      await closeTableAccount(mesaActiva, pedidosDeMesa, metodoFinal, pagosFinales);

      // Preparar datos para la boleta
      const boleta: BoletaData = {
        mesa: mesaActiva,
        items: itemsConsolidados,
        total: totalMesa,
        metodoPago: dividirCuenta ? 'Dividido' : metodoFinal,
        pagos: dividirCuenta ? pagos : undefined,
        fecha: new Date(),
        vuelto: !dividirCuenta && metodoPago === 'efectivo' && vuelto > 0 ? vuelto : undefined,
      };

      setBoletaData(boleta);
      setModal('boleta');
      showToast(`Mesa ${mesaActiva} cobrada — S/ ${totalMesa.toFixed(2)}`);
    } catch {
      showToast('Error al procesar el cobro');
    }
    setProcesando(false);
  };

  const cerrarBoleta = () => {
    setModal(null);
    setBoletaData(null);
    setMesaActiva(null);
    resetCobro();
  };

  const imprimirBoleta = () => {
    const printContent = boletaRef.current;
    if (!printContent) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Boleta - Brasas del Campus</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', monospace; width: 280px; padding: 16px; color: #000; }
            .header { text-align: center; margin-bottom: 12px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
            .header h1 { font-size: 16px; margin-bottom: 4px; }
            .header p { font-size: 11px; }
            .info { font-size: 11px; margin-bottom: 8px; }
            .items { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11px; }
            .items td { padding: 2px 0; }
            .items .right { text-align: right; }
            .sep { border-top: 1px dashed #000; margin: 6px 0; }
            .total { font-size: 14px; font-weight: bold; display: flex; justify-content: space-between; margin: 4px 0; }
            .pago { font-size: 11px; margin: 2px 0; display: flex; justify-content: space-between; }
            .footer { text-align: center; font-size: 10px; margin-top: 12px; border-top: 1px dashed #000; padding-top: 8px; }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    win.document.close();
    win.print();
    win.close();
  };

  const agregarExtras = async () => {
    if (extraItems.length === 0 || pedidosDeMesa.length === 0) return;
    setProcesando(true);
    try {
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

  const metodos: { value: MetodoPago; label: string; icon: React.ReactNode }[] = [
    { value: 'efectivo', label: 'Efectivo', icon: <Banknote size={18} /> },
    { value: 'tarjeta', label: 'Tarjeta', icon: <CreditCard size={18} /> },
    { value: 'yape', label: 'Yape', icon: <Smartphone size={18} /> },
    { value: 'plin', label: 'Plin', icon: <Smartphone size={18} /> },
  ];

  const metodoLabel = (m: string) => {
    const found = metodos.find(x => x.value === m);
    return found ? found.label : m;
  };

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
                    onClick={() => { setMesaActiva(num); resetCobro(); }}
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
              <p>Selecciona una mesa para ver la cuenta.</p>
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
                    onClick={() => { resetCobro(); setModal('cobrar'); }}
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
                      <span className={`badge badge-${
                        pedido.estado === 'pendiente' ? 'pending' :
                        pedido.estado === 'preparando' ? 'cooking' :
                        pedido.estado === 'listo' ? 'ready' : 'closed'
                      }`}>
                        {pedido.estado === 'entregado' ? 'servido' : pedido.estado}
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
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
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

            {/* Toggle dividir cuenta */}
            <div className={styles.dividirToggle}>
              <button
                className={`${styles.dividirBtn} ${!dividirCuenta ? styles.dividirBtnActive : ''}`}
                onClick={() => { setDividirCuenta(false); setPagos([]); }}
              >
                <DollarSign size={16} />
                Pago único
              </button>
              <button
                className={`${styles.dividirBtn} ${dividirCuenta ? styles.dividirBtnActive : ''}`}
                onClick={() => setDividirCuenta(true)}
              >
                <SplitSquareHorizontal size={16} />
                Dividir cuenta
              </button>
            </div>

            {!dividirCuenta ? (
              <>
                {/* Pago único */}
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

                {/* Cálculo de vuelto (solo efectivo) */}
                {metodoPago === 'efectivo' && (
                  <div className={styles.vueltoSection}>
                    <div className="form-group">
                      <label>Monto recibido (S/)</label>
                      <input
                        className="input"
                        type="number"
                        step="0.50"
                        min="0"
                        placeholder={`Mínimo S/ ${totalMesa.toFixed(2)}`}
                        value={montoRecibido}
                        onChange={(e) => setMontoRecibido(e.target.value)}
                        autoFocus
                      />
                    </div>
                    {montoRecibido && parseFloat(montoRecibido) >= totalMesa && (
                      <div className={styles.vueltoResult}>
                        <span>Vuelto</span>
                        <span className={styles.vueltoAmount}>
                          S/ {vuelto.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {montoRecibido && parseFloat(montoRecibido) < totalMesa && (
                      <div className={styles.vueltoResult} style={{ borderColor: 'var(--danger)' }}>
                        <span style={{ color: 'var(--danger)' }}>Falta</span>
                        <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                          S/ {Math.abs(vuelto).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Pago dividido */}
                <div className={styles.splitSection}>
                  <label className={styles.metodoLabel}>Agregar pagos</label>
                  <div className={styles.splitAdd}>
                    <select
                      className="input"
                      value={pagoMetodo}
                      onChange={(e) => setPagoMetodo(e.target.value as MetodoPago)}
                      style={{ flex: 1 }}
                    >
                      {metodos.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <input
                      className="input"
                      type="number"
                      step="0.50"
                      min="0"
                      placeholder="Debe"
                      value={pagoMonto}
                      onChange={(e) => setPagoMonto(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    {pagoMetodo === 'efectivo' && (
                      <input
                        className="input"
                        type="number"
                        step="0.50"
                        min="0"
                        placeholder="Recibido"
                        value={pagoRecibido}
                        onChange={(e) => setPagoRecibido(e.target.value)}
                        style={{ flex: 1 }}
                      />
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={agregarPago}>
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Asistente calculador */}
                  <div style={{ marginBottom: 'var(--space-md)' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--smoke-400)', marginBottom: 'var(--space-xs)' }}>
                      Calculadora rápida (toca para sumar):
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {itemsIndividuales.map((item) => {
                        const isPending = pendingItems.has(item.id);
                        const isConsumed = pagos.some(p => p.items?.includes(item.id));
                        
                        if (isConsumed) {
                          return (
                            <div
                              key={item.id}
                              className="badge"
                              style={{ border: '1px solid var(--carbon-700)', background: 'var(--carbon-900)', color: 'var(--carbon-500)', textDecoration: 'line-through' }}
                            >
                              {item.nombre}
                            </div>
                          );
                        }

                        return (
                          <button
                            key={item.id}
                            className={`badge ${isPending ? 'badge-ready' : 'badge-pending'}`}
                            style={{ cursor: 'pointer', border: isPending ? '1px solid #6cb67e' : '1px solid var(--carbon-600)', background: isPending ? 'rgba(108, 182, 126, 0.15)' : 'var(--carbon-800)' }}
                            onClick={() => toggleItemCalc(item)}
                          >
                            {isPending ? '✓ ' : '+ '}{item.nombre} (S/ {item.precio.toFixed(2)})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Lista de pagos */}
                  {pagos.length > 0 && (
                    <div className={styles.splitList}>
                      {pagos.map((p, i) => (
                        <div key={i} className={styles.splitItem}>
                          <div>
                            <span style={{ fontWeight: 500 }}>{metodoLabel(p.metodo)}</span>
                            {p.metodo === 'efectivo' && p.recibido && p.recibido > p.monto && (
                              <span style={{ fontSize: '0.75rem', color: '#6cb67e', marginLeft: '0.5rem' }}>
                                Vuelto: S/ {(p.recibido - p.monto).toFixed(2)}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ color: 'var(--amber-400)', fontWeight: 600 }}>
                              S/ {p.monto.toFixed(2)}
                            </span>
                            {p.recibido && (
                              <span style={{ color: 'var(--smoke-400)', fontSize: '0.75rem' }}>
                                (pagó {p.recibido.toFixed(2)})
                              </span>
                            )}
                            <button
                              className={styles.splitRemove}
                              onClick={() => quitarPago(i)}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Resumen del pago dividido */}
                  <div className={styles.splitSummary}>
                    <div className={styles.splitSummaryRow}>
                      <span>Total cuenta</span>
                      <span>S/ {totalMesa.toFixed(2)}</span>
                    </div>
                    <div className={styles.splitSummaryRow}>
                      <span>Pagado</span>
                      <span style={{ color: 'var(--amber-400)' }}>S/ {totalPagos.toFixed(2)}</span>
                    </div>
                    <div className={styles.splitSummaryRow} style={{
                      fontWeight: 700,
                      color: Math.abs(restantePorPagar) < 0.01 ? '#6cb67e' : 'var(--danger)',
                    }}>
                      <span>{restantePorPagar <= 0.01 ? 'Cubierto' : 'Falta'}</span>
                      <span>S/ {Math.abs(restantePorPagar).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--space-lg)' }}
              onClick={cobrarMesa}
              disabled={
                procesando ||
                (dividirCuenta && Math.abs(totalPagos - totalMesa) > 0.01) ||
                (!dividirCuenta && metodoPago === 'efectivo' && montoRecibido !== '' && parseFloat(montoRecibido) < totalMesa)
              }
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

      {/* Modal Boleta */}
      {modal === 'boleta' && boletaData && (
        <div className="modal-overlay" onClick={cerrarBoleta}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h2>Comprobante</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-ghost btn-sm" onClick={imprimirBoleta}>
                  <Printer size={16} />
                  Imprimir
                </button>
                <button className="btn btn-ghost btn-sm" onClick={cerrarBoleta}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Boleta visual */}
            <div ref={boletaRef} className={styles.boleta}>
              <div className="header">
                <h1>BRASAS DEL CAMPUS</h1>
                <p>Pollería y Parrillas</p>
                <p>Jr. Los Pinos 342</p>
              </div>

              <div className="info">
                <p>Mesa: {boletaData.mesa}</p>
                <p>Fecha: {boletaData.fecha.toLocaleDateString('es-PE')}</p>
                <p>Hora: {boletaData.fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>

              <div className="sep" />

              <table className="items">
                <tbody>
                  {boletaData.items.map((item, i) => (
                    <tr key={i}>
                      <td>{item.cantidad}x {item.nombre}</td>
                      <td className="right">S/ {(item.precio * item.cantidad).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="sep" />

              <div className="total">
                <span>TOTAL</span>
                <span>S/ {boletaData.total.toFixed(2)}</span>
              </div>

              {boletaData.pagos && boletaData.pagos.length > 0 ? (
                <>
                  <div className="sep" />
                  {boletaData.pagos.map((p, i) => (
                    <div key={i}>
                      <div className="pago">
                        <span>{metodoLabel(p.metodo)}</span>
                        <span>S/ {p.monto.toFixed(2)}</span>
                      </div>
                      {p.metodo === 'efectivo' && p.recibido && p.recibido > p.monto && (
                        <div className="pago" style={{ fontSize: '0.625rem' }}>
                          <span>  Recibido: S/ {p.recibido.toFixed(2)}</span>
                          <span>Vuelto: S/ {(p.recibido - p.monto).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <div className="pago">
                  <span>Pago: {metodoLabel(boletaData.metodoPago)}</span>
                </div>
              )}

              {boletaData.vuelto !== undefined && boletaData.vuelto > 0 && (
                <div className="pago" style={{ fontWeight: 700 }}>
                  <span>Vuelto</span>
                  <span>S/ {boletaData.vuelto.toFixed(2)}</span>
                </div>
              )}

              <div className="footer">
                <p>¡Gracias por su preferencia!</p>
                <p>Brasas del Campus</p>
              </div>
            </div>
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
              {categorias.map((cat) => (
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
