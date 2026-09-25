'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Flame,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  CalendarDays,
  BarChart3,
} from 'lucide-react';
import {
  subscribeToMenu,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  subscribeToVentas,
  seedMenu,
} from '@/lib/firestore';
import type { MenuItem, Venta } from '@/lib/types';
import { CATEGORIAS } from '@/lib/types';
import styles from './admin.module.css';

type Tab = 'menu' | 'ventas';

const emptyItem: Omit<MenuItem, 'id'> = {
  nombre: '',
  descripcion: '',
  precio: 0,
  categoria: 'Parrilla',
  disponible: true,
};

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('menu');
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [editando, setEditando] = useState<MenuItem | null>(null);
  const [nuevoItem, setNuevoItem] = useState<Omit<MenuItem, 'id'> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    const unsub1 = subscribeToMenu(setMenu);
    const unsub2 = subscribeToVentas(setVentas);
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSeedMenu = async () => {
    try {
      await seedMenu();
      setSeeded(true);
      showToast('Menú de ejemplo cargado');
    } catch {
      showToast('Error al cargar menú');
    }
  };

  const guardarNuevo = async () => {
    if (!nuevoItem || !nuevoItem.nombre || nuevoItem.precio <= 0) {
      showToast('Completá nombre y precio');
      return;
    }
    try {
      await addMenuItem(nuevoItem);
      showToast('Plato agregado');
      setNuevoItem(null);
    } catch {
      showToast('Error al guardar');
    }
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    try {
      const { id, ...data } = editando;
      await updateMenuItem(id, data);
      showToast('Plato actualizado');
      setEditando(null);
    } catch {
      showToast('Error al actualizar');
    }
  };

  const eliminar = async (id: string) => {
    try {
      await deleteMenuItem(id);
      showToast('Plato eliminado');
      setConfirmDelete(null);
    } catch {
      showToast('Error al eliminar');
    }
  };

  // Stats de ventas
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const ventasHoy = ventas.filter((v) => new Date(v.cerradoEn) >= hoy);
  const totalHoy = ventasHoy.reduce((s, v) => s + v.total, 0);
  const totalGeneral = ventas.reduce((s, v) => s + v.total, 0);

  // Agrupar ventas por día
  const ventasPorDia = ventas.reduce<Record<string, number>>((acc, v) => {
    const dia = new Date(v.cerradoEn).toLocaleDateString('es-PE');
    acc[dia] = (acc[dia] || 0) + v.total;
    return acc;
  }, {});

  return (
    <div className={styles.page}>
      <header className="view-header">
        <h1>
          <Flame size={20} className="brand-mark" />
          <span className="brand-mark">Admin</span>
        </h1>
        <div className="tabs" style={{ border: 'none' }}>
          <button
            className={`tab ${tab === 'menu' ? 'active' : ''}`}
            onClick={() => setTab('menu')}
          >
            Menú
          </button>
          <button
            className={`tab ${tab === 'ventas' ? 'active' : ''}`}
            onClick={() => setTab('ventas')}
          >
            Ventas
          </button>
        </div>
      </header>

      {tab === 'menu' ? (
        <div className={styles.content}>
          <div className={styles.menuActions}>
            <h2>Gestión del menú</h2>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              {menu.length === 0 && !seeded && (
                <button className="btn btn-ghost" onClick={handleSeedMenu}>
                  Cargar menú de ejemplo
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={() => setNuevoItem({ ...emptyItem })}
              >
                <Plus size={16} />
                Nuevo plato
              </button>
            </div>
          </div>

          {/* Tabla de platos */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Plato</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {menu.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div>
                          <strong style={{ color: 'var(--cream-50)' }}>{item.nombre}</strong>
                          <div
                            style={{
                              fontSize: '0.8125rem',
                              color: 'var(--smoke-400)',
                              marginTop: '2px',
                            }}
                          >
                            {item.descripcion.length > 60
                              ? item.descripcion.slice(0, 60) + '...'
                              : item.descripcion}
                          </div>
                        </div>
                      </td>
                      <td>{item.categoria}</td>
                      <td>
                        <span
                          style={{
                            fontFamily: 'var(--font-heading)',
                            fontWeight: 600,
                            color: 'var(--amber-400)',
                          }}
                        >
                          S/ {item.precio.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${item.disponible ? 'badge-ready' : 'badge-closed'}`}>
                          {item.disponible ? 'Disponible' : 'No disponible'}
                        </span>
                      </td>
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            gap: '0.5rem',
                            justifyContent: 'flex-end',
                          }}
                        >
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEditando({ ...item })}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setConfirmDelete(item.id)}
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {menu.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--smoke-400)' }}>
                        No hay platos cargados. Agregá uno o cargá el menú de ejemplo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.content}>
          <h2 style={{ marginBottom: 'var(--space-xl)' }}>Historial de ventas</h2>

          {/* Stats */}
          <div className={styles.statsGrid}>
            <div className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <DollarSign size={18} style={{ color: 'var(--amber-500)' }} />
                <span className="stat-label" style={{ margin: 0 }}>Ventas hoy</span>
              </div>
              <div className="stat-value">S/ {totalHoy.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <ShoppingCart size={18} style={{ color: 'var(--amber-500)' }} />
                <span className="stat-label" style={{ margin: 0 }}>Pedidos hoy</span>
              </div>
              <div className="stat-value">{ventasHoy.length}</div>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <TrendingUp size={18} style={{ color: 'var(--amber-500)' }} />
                <span className="stat-label" style={{ margin: 0 }}>Total acumulado</span>
              </div>
              <div className="stat-value">S/ {totalGeneral.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <BarChart3 size={18} style={{ color: 'var(--amber-500)' }} />
                <span className="stat-label" style={{ margin: 0 }}>Promedio por venta</span>
              </div>
              <div className="stat-value">
                S/ {ventas.length > 0 ? (totalGeneral / ventas.length).toFixed(2) : '0.00'}
              </div>
            </div>
          </div>

          {/* Ventas por día */}
          {Object.keys(ventasPorDia).length > 0 && (
            <div className={styles.ventasDia}>
              <h3>
                <CalendarDays size={18} />
                Resumen por día
              </h3>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(ventasPorDia).map(([dia, total]) => (
                      <tr key={dia}>
                        <td>{dia}</td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontFamily: 'var(--font-heading)',
                            fontWeight: 600,
                            color: 'var(--amber-400)',
                          }}
                        >
                          S/ {total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Historial detallado */}
          <div className={styles.ventasHistorial}>
            <h3>Últimas ventas</h3>
            {ventas.length === 0 ? (
              <p style={{ color: 'var(--smoke-400)' }}>Sin ventas registradas aún.</p>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Mesa</th>
                      <th>Items</th>
                      <th>Método</th>
                      <th>Fecha</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventas.slice(0, 50).map((v) => (
                      <tr key={v.id}>
                        <td>
                          <span className="mesa-number">{v.mesa}</span>
                        </td>
                        <td>
                          {v.items.map((it) => `${it.cantidad}x ${it.nombre}`).join(', ')}
                        </td>
                        <td>
                          <span className="badge badge-closed" style={{ textTransform: 'capitalize' }}>
                            {v.metodoPago}
                          </span>
                        </td>
                        <td>
                          {new Date(v.cerradoEn).toLocaleString('es-PE', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontFamily: 'var(--font-heading)',
                            fontWeight: 600,
                            color: 'var(--amber-400)',
                          }}
                        >
                          S/ {v.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Nuevo plato */}
      {nuevoItem && (
        <div className="modal-overlay" onClick={() => setNuevoItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Nuevo plato</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setNuevoItem(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="form-group">
              <label>Nombre</label>
              <input
                className="input"
                value={nuevoItem.nombre}
                onChange={(e) => setNuevoItem({ ...nuevoItem, nombre: e.target.value })}
                placeholder="Ej: Anticuchos de corazón"
              />
            </div>

            <div className="form-group">
              <label>Descripción</label>
              <input
                className="input"
                value={nuevoItem.descripcion}
                onChange={(e) => setNuevoItem({ ...nuevoItem, descripcion: e.target.value })}
                placeholder="Descripción corta del plato"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label>Precio (S/)</label>
                <input
                  className="input"
                  type="number"
                  step="0.5"
                  min="0"
                  value={nuevoItem.precio || ''}
                  onChange={(e) =>
                    setNuevoItem({ ...nuevoItem, precio: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="form-group">
                <label>Categoría</label>
                <select
                  className="input"
                  value={nuevoItem.categoria}
                  onChange={(e) => setNuevoItem({ ...nuevoItem, categoria: e.target.value })}
                >
                  {CATEGORIAS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={guardarNuevo}
            >
              <Save size={16} />
              Guardar plato
            </button>
          </div>
        </div>
      )}

      {/* Modal: Editar plato */}
      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Editar plato</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditando(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="form-group">
              <label>Nombre</label>
              <input
                className="input"
                value={editando.nombre}
                onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Descripción</label>
              <input
                className="input"
                value={editando.descripcion}
                onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label>Precio (S/)</label>
                <input
                  className="input"
                  type="number"
                  step="0.5"
                  min="0"
                  value={editando.precio || ''}
                  onChange={(e) =>
                    setEditando({ ...editando, precio: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="form-group">
                <label>Categoría</label>
                <select
                  className="input"
                  value={editando.categoria}
                  onChange={(e) => setEditando({ ...editando, categoria: e.target.value })}
                >
                  {CATEGORIAS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editando.disponible}
                  onChange={(e) => setEditando({ ...editando, disponible: e.target.checked })}
                  style={{ width: 'auto' }}
                />
                <span style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.9375rem' }}>
                  Disponible
                </span>
              </label>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={guardarEdicion}
            >
              <Save size={16} />
              Guardar cambios
            </button>
          </div>
        </div>
      )}

      {/* Modal: Confirmar eliminación */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Eliminar plato</h2>
            <p style={{ color: 'var(--smoke-300)', marginBottom: 'var(--space-lg)' }}>
              ¿Seguro que querés eliminar este plato? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={() => eliminar(confirmDelete)}>
                <Trash2 size={14} />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast toast-success">{toast}</div>}
    </div>
  );
}
