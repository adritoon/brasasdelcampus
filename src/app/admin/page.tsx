'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
  Download,
  Trophy,
  Clock,
  PieChart,
  Filter,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  subscribeToMenu,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  subscribeToVentas,
  seedMenu,
  limpiarBaseDeDatos,
  subscribeToCategories,
  updateCategories,
} from '@/lib/firestore';
import type { MenuItem, Venta } from '@/lib/types';
import styles from './admin.module.css';

type Tab = 'menu' | 'categorias' | 'ventas';

const emptyItem: Omit<MenuItem, 'id'> = {
  nombre: '',
  descripcion: '',
  precio: 0,
  categoria: 'Parrilla',
  disponible: true,
  imagen: '',
};

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('menu');
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [editando, setEditando] = useState<MenuItem | null>(null);
  const [nuevoItem, setNuevoItem] = useState<Omit<MenuItem, 'id'> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    const unsub1 = subscribeToMenu(setMenu);
    const unsub2 = subscribeToVentas(setVentas);
    const unsub3 = subscribeToCategories(setCategorias);
    return () => {
      unsub1();
      unsub2();
      unsub3();
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

  // Filtro de tiempo para análisis de ventas
  const [filtroPeriodo, setFiltroPeriodo] = useState<'hoy' | '7dias' | 'mes' | 'todos' | 'custom'>('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Ventas filtradas según rango
  const ventasFiltradas = useMemo(() => {
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const inicio7Dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    return ventas.filter((v) => {
      const fecha = new Date(v.cerradoEn);
      if (filtroPeriodo === 'hoy') return fecha >= inicioHoy;
      if (filtroPeriodo === '7dias') return fecha >= inicio7Dias;
      if (filtroPeriodo === 'mes') return fecha >= inicioMes;
      if (filtroPeriodo === 'custom') {
        const d = fechaDesde ? new Date(fechaDesde + 'T00:00:00') : null;
        const h = fechaHasta ? new Date(fechaHasta + 'T23:59:59') : null;
        if (d && fecha < d) return false;
        if (h && fecha > h) return false;
        return true;
      }
      return true;
    });
  }, [ventas, filtroPeriodo, fechaDesde, fechaHasta]);

  // Totales y estadísticas
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const ventasHoy = ventas.filter((v) => new Date(v.cerradoEn) >= hoy);
  const totalHoy = ventasHoy.reduce((s, v) => s + v.total, 0);
  const totalPeriodo = ventasFiltradas.reduce((s, v) => s + v.total, 0);
  const totalGeneral = ventas.reduce((s, v) => s + v.total, 0);

  // 1. Ranking Top 5 Platos Más Vendidos
  const rankingPlatos = useMemo(() => {
    const counts: Record<string, { count: number; total: number }> = {};
    ventasFiltradas.forEach((v) => {
      v.items.forEach((it) => {
        if (!counts[it.nombre]) {
          counts[it.nombre] = { count: 0, total: 0 };
        }
        counts[it.nombre].count += it.cantidad;
        counts[it.nombre].total += it.precio * it.cantidad;
      });
    });

    const sorted = Object.entries(counts)
      .map(([nombre, data]) => ({ nombre, ...data }))
      .sort((a, b) => b.count - a.count);

    const maxCount = sorted.length > 0 ? sorted[0].count : 1;
    return { list: sorted.slice(0, 5), maxCount };
  }, [ventasFiltradas]);

  // 2. Desglose de Ventas por Método de Pago
  const metodoStats = useMemo(() => {
    const totales = { efectivo: 0, yape: 0, plin: 0, tarjeta: 0 };
    const conteos = { efectivo: 0, yape: 0, plin: 0, tarjeta: 0 };

    ventasFiltradas.forEach((v) => {
      if (v.pagos && v.pagos.length > 0) {
        v.pagos.forEach((p) => {
          totales[p.metodo] = (totales[p.metodo] || 0) + p.monto;
          conteos[p.metodo] = (conteos[p.metodo] || 0) + 1;
        });
      } else {
        const m = v.metodoPago || 'efectivo';
        totales[m] = (totales[m] || 0) + v.total;
        conteos[m] = (conteos[m] || 0) + 1;
      }
    });

    const sumaTotal = Object.values(totales).reduce((a, b) => a + b, 0) || 1;
    return {
      totales,
      conteos,
      pctEfectivo: Math.round((totales.efectivo / sumaTotal) * 100),
      pctYape: Math.round((totales.yape / sumaTotal) * 100),
      pctPlin: Math.round((totales.plin / sumaTotal) * 100),
      pctTarjeta: Math.round((totales.tarjeta / sumaTotal) * 100),
    };
  }, [ventasFiltradas]);

  // 3. Distribución por Horas Pico (12:00 a 22:00)
  const horasPico = useMemo(() => {
    const horasRangos: Record<number, number> = {};
    for (let h = 12; h <= 22; h++) horasRangos[h] = 0;

    ventasFiltradas.forEach((v) => {
      const hora = new Date(v.cerradoEn).getHours();
      if (hora >= 12 && hora <= 22) {
        horasRangos[hora] = (horasRangos[hora] || 0) + 1;
      }
    });

    const maxOrders = Math.max(...Object.values(horasRangos), 1);
    return { rangos: horasRangos, maxOrders };
  }, [ventasFiltradas]);

  // 4. Agrupar ventas por día
  const ventasPorDia = useMemo(() => {
    return ventasFiltradas.reduce<Record<string, number>>((acc, v) => {
      const dia = new Date(v.cerradoEn).toLocaleDateString('es-PE');
      acc[dia] = (acc[dia] || 0) + v.total;
      return acc;
    }, {});
  }, [ventasFiltradas]);

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
            className={`tab ${tab === 'categorias' ? 'active' : ''}`}
            onClick={() => setTab('categorias')}
          >
            Categorías
          </button>
          <button
            className={`tab ${tab === 'ventas' ? 'active' : ''}`}
            onClick={() => setTab('ventas')}
          >
            Ventas
          </button>
        </div>
      </header>

      {tab === 'categorias' && (
        <div className={styles.content}>
          <div className={styles.menuActions}>
            <h2>Gestión de Categorías</h2>
          </div>
          <div className="card">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
              <input
                type="text"
                className="input"
                placeholder="Nueva categoría..."
                value={nuevaCategoria}
                onChange={(e) => setNuevaCategoria(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nuevaCategoria.trim()) {
                    if (!categorias.includes(nuevaCategoria.trim())) {
                      updateCategories([...categorias, nuevaCategoria.trim()]);
                      setNuevaCategoria('');
                      showToast('Categoría agregada');
                    } else {
                      showToast('La categoría ya existe');
                    }
                  }
                }}
              />
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (nuevaCategoria.trim() && !categorias.includes(nuevaCategoria.trim())) {
                    updateCategories([...categorias, nuevaCategoria.trim()]);
                    setNuevaCategoria('');
                    showToast('Categoría agregada');
                  }
                }}
              >
                Agregar
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {categorias.map((cat, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--carbon-800)', borderRadius: 'var(--radius-sm)' }}>
                  <span>{cat}</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)' }}
                    onClick={() => {
                      if (window.confirm(`¿Eliminar la categoría "${cat}"?`)) {
                        updateCategories(categorias.filter((c) => c !== cat));
                        showToast('Categoría eliminada');
                      }
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
              {categorias.length === 0 && (
                <p style={{ color: 'var(--smoke-400)', textAlign: 'center', padding: '1rem' }}>No hay categorías registradas.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'menu' && (
        <div className={styles.content}>
          <div className={styles.menuActions}>
            <h2>Gestión del menú</h2>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  if (window.confirm('¿Seguro que deseas limpiar todos los pedidos y ventas de la base de datos? Esto no borrará el menú.')) {
                    await limpiarBaseDeDatos();
                    alert('Pedidos y ventas eliminados correctamente.');
                  }
                }}
                style={{ color: 'var(--brick-400)' }}
              >
                Limpiar Base de Datos
              </button>
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
                        No hay platos cargados. Agrega uno o carga el menú de ejemplo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'ventas' && (
        <div className={styles.content}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
            <div>
              <h2 style={{ margin: 0 }}>Dashboard de Ventas</h2>
              <p style={{ color: 'var(--smoke-400)', fontSize: '0.875rem', marginTop: '2px' }}>
                Monitoreo en tiempo real, platos más vendidos y comportamiento de cobros QR.
              </p>
            </div>
            <button className="btn btn-ghost" onClick={() => {
              const data = ventasFiltradas.map(v => ({
                'ID Venta': v.id,
                'Fecha': new Date(v.cerradoEn).toLocaleDateString('es-PE'),
                'Hora': new Date(v.cerradoEn).toLocaleTimeString('es-PE'),
                'Mesa': v.mesa,
                'Comprobante': (v.tipoComprobante || 'Boleta').toUpperCase(),
                'Cliente Doc': v.clienteDoc || '-',
                'Cliente Nombre': v.clienteNombre || '-',
                'Método de Pago': v.metodoPago.toUpperCase(),
                'Detalle': v.items.map(it => `${it.cantidad}x ${it.nombre}`).join(' | '),
                'Total (S/)': Number(v.total.toFixed(2)),
              }));
              const ws = XLSX.utils.json_to_sheet(data);
              ws['!cols'] = [{wch: 25}, {wch: 12}, {wch: 10}, {wch: 8}, {wch: 14}, {wch: 14}, {wch: 22}, {wch: 15}, {wch: 55}, {wch: 12}];
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Ventas");
              XLSX.writeFile(wb, `Reporte_Ventas_${filtroPeriodo}.xlsx`);
            }} style={{ color: 'var(--amber-400)' }}>
              <Download size={16} />
              Exportar Excel ({ventasFiltradas.length})
            </button>
          </div>

          {/* Barra de Filtro de Fechas */}
          <div className={styles.filterBar}>
            <div className={styles.filterButtons}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--smoke-400)', alignSelf: 'center', marginRight: '4px' }}>
                <Filter size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
                Período:
              </span>
              <button
                className={`${styles.filterBtn} ${filtroPeriodo === 'todos' ? styles.filterBtnActive : ''}`}
                onClick={() => setFiltroPeriodo('todos')}
              >
                Histórico
              </button>
              <button
                className={`${styles.filterBtn} ${filtroPeriodo === 'hoy' ? styles.filterBtnActive : ''}`}
                onClick={() => setFiltroPeriodo('hoy')}
              >
                Hoy
              </button>
              <button
                className={`${styles.filterBtn} ${filtroPeriodo === '7dias' ? styles.filterBtnActive : ''}`}
                onClick={() => setFiltroPeriodo('7dias')}
              >
                Últimos 7 días
              </button>
              <button
                className={`${styles.filterBtn} ${filtroPeriodo === 'mes' ? styles.filterBtnActive : ''}`}
                onClick={() => setFiltroPeriodo('mes')}
              >
                Este mes
              </button>
              <button
                className={`${styles.filterBtn} ${filtroPeriodo === 'custom' ? styles.filterBtnActive : ''}`}
                onClick={() => setFiltroPeriodo('custom')}
              >
                Rango
              </button>
            </div>

            {filtroPeriodo === 'custom' && (
              <div className={styles.customDateRange}>
                <label>Desde:</label>
                <input
                  type="date"
                  className={styles.customDateInput}
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                />
                <label>Hasta:</label>
                <input
                  type="date"
                  className={styles.customDateInput}
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Tarjetas de Estadísticas Principales */}
          <div className={styles.statsGrid}>
            <div className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <DollarSign size={18} style={{ color: 'var(--amber-500)' }} />
                <span className="stat-label" style={{ margin: 0 }}>Ingresos Período</span>
              </div>
              <div className="stat-value">S/ {totalPeriodo.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <ShoppingCart size={18} style={{ color: 'var(--amber-500)' }} />
                <span className="stat-label" style={{ margin: 0 }}>Ventas cerradas</span>
              </div>
              <div className="stat-value">{ventasFiltradas.length}</div>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <TrendingUp size={18} style={{ color: 'var(--amber-500)' }} />
                <span className="stat-label" style={{ margin: 0 }}>Ventas Hoy</span>
              </div>
              <div className="stat-value">S/ {totalHoy.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <BarChart3 size={18} style={{ color: 'var(--amber-500)' }} />
                <span className="stat-label" style={{ margin: 0 }}>Ticket Promedio</span>
              </div>
              <div className="stat-value">
                S/ {ventasFiltradas.length > 0 ? (totalPeriodo / ventasFiltradas.length).toFixed(2) : '0.00'}
              </div>
            </div>
          </div>

          {/* Gráficos Visuales de Análisis */}
          <div className={styles.chartsGrid}>
            {/* Gráfico 1: Top 5 Platos Más Vendidos */}
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <div className={styles.chartTitle}>
                  <Trophy size={18} style={{ color: 'var(--amber-400)' }} />
                  <span>Platos Más Vendidos</span>
                </div>
                <span className={styles.chartSubtitle}>Por unidades despachadas</span>
              </div>

              {rankingPlatos.list.length === 0 ? (
                <p style={{ color: 'var(--smoke-400)', fontSize: '0.875rem', padding: '1rem', textAlign: 'center' }}>
                  Sin datos en este período.
                </p>
              ) : (
                <div className={styles.rankingList}>
                  {rankingPlatos.list.map((item, idx) => {
                    const pct = Math.round((item.count / rankingPlatos.maxCount) * 100);
                    return (
                      <div key={item.nombre} className={styles.rankingRow}>
                        <div className={styles.rankingInfo}>
                          <div className={styles.rankingName}>
                            <span className={`${styles.rankingBadge} ${idx === 0 ? styles.rankingBadgeTop : ''}`}>
                              {idx + 1}
                            </span>
                            <span>{item.nombre}</span>
                          </div>
                          <div className={styles.rankingNumbers}>
                            <span className={styles.rankingQty}>{item.count} un.</span>
                            <span className={styles.rankingAmount}>S/ {item.total.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className={styles.rankingBarBg}>
                          <div className={styles.rankingBarFill} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Gráfico 2: Métodos de Pago (Efectivo vs Yape/Plin vs Tarjeta) */}
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <div className={styles.chartTitle}>
                  <PieChart size={18} style={{ color: '#00c7b1' }} />
                  <span>Distribución de Pagos</span>
                </div>
                <span className={styles.chartSubtitle}>Impacto de Pagos Digitales</span>
              </div>

              <div className={styles.paymentSection}>
                {/* Barra multi-segmento */}
                <div className={styles.paymentMultiBar}>
                  <div style={{ width: `${metodoStats.pctEfectivo}%`, background: '#4a7c59' }} title={`Efectivo: ${metodoStats.pctEfectivo}%`} />
                  <div style={{ width: `${metodoStats.pctYape}%`, background: '#742284' }} title={`Yape: ${metodoStats.pctYape}%`} />
                  <div style={{ width: `${metodoStats.pctPlin}%`, background: '#00bca8' }} title={`Plin: ${metodoStats.pctPlin}%`} />
                  <div style={{ width: `${metodoStats.pctTarjeta}%`, background: '#4a6f8b' }} title={`Tarjeta: ${metodoStats.pctTarjeta}%`} />
                </div>

                <div className={styles.paymentLegend}>
                  <div className={styles.paymentLegendItem}>
                    <div className={styles.legendDot} style={{ background: '#742284' }} />
                    <span className={styles.legendLabel}>Yape (QR)</span>
                    <div className={styles.legendValues}>
                      <span className={styles.legendMonto}>S/ {metodoStats.totales.yape.toFixed(2)}</span>
                      <span className={styles.legendPercent}>{metodoStats.pctYape}%</span>
                    </div>
                  </div>

                  <div className={styles.paymentLegendItem}>
                    <div className={styles.legendDot} style={{ background: '#00bca8' }} />
                    <span className={styles.legendLabel}>Plin (QR)</span>
                    <div className={styles.legendValues}>
                      <span className={styles.legendMonto}>S/ {metodoStats.totales.plin.toFixed(2)}</span>
                      <span className={styles.legendPercent}>{metodoStats.pctPlin}%</span>
                    </div>
                  </div>

                  <div className={styles.paymentLegendItem}>
                    <div className={styles.legendDot} style={{ background: '#4a7c59' }} />
                    <span className={styles.legendLabel}>Efectivo</span>
                    <div className={styles.legendValues}>
                      <span className={styles.legendMonto}>S/ {metodoStats.totales.efectivo.toFixed(2)}</span>
                      <span className={styles.legendPercent}>{metodoStats.pctEfectivo}%</span>
                    </div>
                  </div>

                  <div className={styles.paymentLegendItem}>
                    <div className={styles.legendDot} style={{ background: '#4a6f8b' }} />
                    <span className={styles.legendLabel}>Tarjeta POS</span>
                    <div className={styles.legendValues}>
                      <span className={styles.legendMonto}>S/ {metodoStats.totales.tarjeta.toFixed(2)}</span>
                      <span className={styles.legendPercent}>{metodoStats.pctTarjeta}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Gráfico 3: Horas Pico (Almuerzo vs Cena) */}
            <div className={styles.chartCard} style={{ gridColumn: 'span 2' }}>
              <div className={styles.chartHeader}>
                <div className={styles.chartTitle}>
                  <Clock size={18} style={{ color: 'var(--amber-500)' }} />
                  <span>Distribución de Ventas por Hora Pico</span>
                </div>
                <span className={styles.chartSubtitle}>Comportamiento de 12:00 a 22:00</span>
              </div>

              <div className={styles.hoursHistogram}>
                {Object.entries(horasPico.rangos).map(([horaStr, count]) => {
                  const h = Number(horaStr);
                  const pct = Math.max(8, Math.round((count / horasPico.maxOrders) * 100));
                  const isPeak = count === horasPico.maxOrders && count > 0;
                  const isActive = count > 0;
                  return (
                    <div key={h} className={styles.hourCol}>
                      {count > 0 && <span className={styles.hourCount}>{count}</span>}
                      <div
                        className={`${styles.hourBar} ${isActive ? styles.hourBarActive : ''} ${isPeak ? styles.hourBarPeak : ''}`}
                        style={{ height: `${pct}%` }}
                        title={`${h}:00 hrs: ${count} ventas`}
                      />
                      <span className={styles.hourLabel}>{h}h</span>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--smoke-400)', marginTop: '8px', textAlign: 'center' }}>
                Picos típicos: 13:00 - 15:00 (Turno Almuerzo universitario) y 19:00 - 21:00 (Turno Parrillas & Cena).
              </p>
            </div>
          </div>

          {/* Resumen por día */}
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
            <h3 style={{ marginBottom: '1rem' }}>Últimas ventas registradas ({ventasFiltradas.length})</h3>
            {ventasFiltradas.length === 0 ? (
              <p style={{ color: 'var(--smoke-400)' }}>Sin ventas en el período seleccionado.</p>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Mesa</th>
                      <th>Comprobante</th>
                      <th>Items</th>
                      <th>Método</th>
                      <th>Fecha</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventasFiltradas.slice(0, 50).map((v) => (
                      <tr key={v.id}>
                        <td>
                          <span className="mesa-number">{v.mesa}</span>
                        </td>
                        <td>
                          <span className="badge badge-closed" style={{ textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                            {v.tipoComprobante || 'Boleta'}
                          </span>
                          {v.clienteDoc && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--smoke-400)', marginTop: '2px' }}>
                              {v.clienteDoc}
                            </div>
                          )}
                        </td>
                        <td>
                          {v.items.map((it) => `${it.cantidad}x ${it.nombre}`).join(', ')}
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background:
                                v.metodoPago === 'yape'
                                  ? 'rgba(116, 34, 132, 0.2)'
                                  : v.metodoPago === 'plin'
                                  ? 'rgba(0, 188, 168, 0.2)'
                                  : 'rgba(74, 124, 89, 0.2)',
                              color:
                                v.metodoPago === 'yape'
                                  ? '#d175e4'
                                  : v.metodoPago === 'plin'
                                  ? '#00c7b1'
                                  : '#6cb67e',
                              textTransform: 'uppercase',
                              fontSize: '0.6875rem',
                            }}
                          >
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
                  {categorias.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>URL de imagen (opcional)</label>
              <input
                className="input"
                value={nuevoItem.imagen || ''}
                onChange={(e) => setNuevoItem({ ...nuevoItem, imagen: e.target.value })}
                placeholder="https://ejemplo.com/foto-del-plato.jpg"
              />
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
                  {categorias.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>URL de imagen (opcional)</label>
              <input
                className="input"
                value={editando.imagen || ''}
                onChange={(e) => setEditando({ ...editando, imagen: e.target.value })}
                placeholder="https://ejemplo.com/foto-del-plato.jpg"
              />
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
              ¿Seguro que quieres eliminar este plato? Esta acción no se puede deshacer.
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
