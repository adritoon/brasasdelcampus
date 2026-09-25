'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Flame,
  ChefHat,
  Clock,
  Check,
  CookingPot,
  AlertCircle,
} from 'lucide-react';
import { subscribeToOrders, updateOrderStatus } from '@/lib/firestore';
import type { Order, OrderStatus } from '@/lib/types';
import styles from './cocina.module.css';

export default function CocinaPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToOrders(
      (incoming) => setOrders(incoming),
      ['pendiente', 'preparando', 'listo']
    );
    return unsub;
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const cambiarEstado = async (orderId: string, nuevoEstado: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, nuevoEstado);
      const label = nuevoEstado === 'preparando' ? 'En preparación' : 'Marcado como listo';
      showToast(label);
    } catch {
      showToast('Error al actualizar estado');
    }
  };

  const tiempoTranscurrido = (fecha: Date) => {
    const mins = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const pendientes = orders.filter((o) => o.estado === 'pendiente');
  const preparando = orders.filter((o) => o.estado === 'preparando');
  const listos = orders.filter((o) => o.estado === 'listo');

  return (
    <div className={styles.page}>
      <header className="view-header">
        <h1>
          <Flame size={20} className="brand-mark" />
          <span className="brand-mark">Cocina</span>
        </h1>
        <div className={styles.headerStats}>
          <div className={styles.headerStat}>
            <AlertCircle size={14} />
            <span>{pendientes.length} pendientes</span>
          </div>
          <div className={styles.headerStat}>
            <CookingPot size={14} />
            <span>{preparando.length} preparando</span>
          </div>
          <div className={styles.headerStat}>
            <Check size={14} />
            <span>{listos.length} listos</span>
          </div>
        </div>
      </header>

      {orders.length === 0 ? (
        <div className="empty-state">
          <ChefHat size={48} />
          <p>No hay pedidos por ahora. Tranqui.</p>
        </div>
      ) : (
        <div className={styles.columns}>
          {/* Columna: Pendientes */}
          <div className={styles.column}>
            <div className={`${styles.columnHeader} ${styles.columnPending}`}>
              <AlertCircle size={16} />
              <span>Pendientes ({pendientes.length})</span>
            </div>
            <div className={styles.columnBody}>
              {pendientes.map((order) => (
                <article
                  key={order.id}
                  className={`${styles.orderCard} order-new`}
                >
                  <div className={styles.orderHeader}>
                    <div className={styles.orderMesa}>
                      <span className="mesa-number">{order.mesa}</span>
                      <span className={styles.orderMesaLabel}>Mesa {order.mesa}</span>
                    </div>
                    <div className={styles.orderTime}>
                      <Clock size={13} />
                      {tiempoTranscurrido(order.creadoEn)}
                    </div>
                  </div>

                  <ul className={styles.orderItems}>
                    {order.items.map((item, i) => (
                      <li key={i}>
                        <span className={styles.orderItemQty}>{item.cantidad}x</span>
                        <span>{item.nombre}</span>
                      </li>
                    ))}
                  </ul>

                  {order.notas && (
                    <div className={styles.orderNotas}>
                      <strong>Nota:</strong> {order.notas}
                    </div>
                  )}

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => cambiarEstado(order.id, 'preparando')}
                  >
                    <CookingPot size={16} />
                    Empezar a preparar
                  </button>
                </article>
              ))}
            </div>
          </div>

          {/* Columna: Preparando */}
          <div className={styles.column}>
            <div className={`${styles.columnHeader} ${styles.columnCooking}`}>
              <CookingPot size={16} />
              <span>Preparando ({preparando.length})</span>
            </div>
            <div className={styles.columnBody}>
              {preparando.map((order) => (
                <article key={order.id} className={styles.orderCard}>
                  <div className={styles.orderHeader}>
                    <div className={styles.orderMesa}>
                      <span className="mesa-number">{order.mesa}</span>
                      <span className={styles.orderMesaLabel}>Mesa {order.mesa}</span>
                    </div>
                    <div className={styles.orderTime}>
                      <Clock size={13} />
                      {tiempoTranscurrido(order.creadoEn)}
                    </div>
                  </div>

                  <ul className={styles.orderItems}>
                    {order.items.map((item, i) => (
                      <li key={i}>
                        <span className={styles.orderItemQty}>{item.cantidad}x</span>
                        <span>{item.nombre}</span>
                      </li>
                    ))}
                  </ul>

                  {order.notas && (
                    <div className={styles.orderNotas}>
                      <strong>Nota:</strong> {order.notas}
                    </div>
                  )}

                  <button
                    className="btn btn-success"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => cambiarEstado(order.id, 'listo')}
                  >
                    <Check size={16} />
                    Marcar listo
                  </button>
                </article>
              ))}
            </div>
          </div>

          {/* Columna: Listos */}
          <div className={styles.column}>
            <div className={`${styles.columnHeader} ${styles.columnReady}`}>
              <Check size={16} />
              <span>Listos ({listos.length})</span>
            </div>
            <div className={styles.columnBody}>
              {listos.map((order) => (
                <article key={order.id} className={`${styles.orderCard} ${styles.orderReady}`}>
                  <div className={styles.orderHeader}>
                    <div className={styles.orderMesa}>
                      <span className="mesa-number">{order.mesa}</span>
                      <span className={styles.orderMesaLabel}>Mesa {order.mesa}</span>
                    </div>
                    <div className={styles.orderTime}>
                      <Clock size={13} />
                      {tiempoTranscurrido(order.creadoEn)}
                    </div>
                  </div>

                  <ul className={styles.orderItems}>
                    {order.items.map((item, i) => (
                      <li key={i}>
                        <span className={styles.orderItemQty}>{item.cantidad}x</span>
                        <span>{item.nombre}</span>
                      </li>
                    ))}
                  </ul>

                  <div className={styles.readyLabel}>
                    <Check size={14} />
                    Esperando al mozo
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast toast-success">{toast}</div>}
    </div>
  );
}
