// src/lib/billing.ts
// Utilidades de facturación, cálculo de IGV, combos y comprobantes para Brasas del Campus

import type { OrderItem, TipoComprobante } from './types';

export interface DesgloseIGV {
  subtotal: number; // Base imponible u Operación Gravada
  igv: number;      // 18% de impuesto general a las ventas
  total: number;    // Monto final en soles (S/)
}

export interface ComboDescuento {
  nombreCombo: string;
  descuento: number;
  itemsInvolucrados: string[];
}

/**
 * En el Perú, los precios al consumidor final ya incluyen el 18% de IGV (Ley del IGV).
 * Esta función desglosa la base imponible y el tributo a partir del total.
 */
export function calcularIGV(total: number): DesgloseIGV {
  const totalLimpio = Math.max(0, Number(total) || 0);
  const subtotal = Math.round((totalLimpio / 1.18) * 100) / 100;
  const igv = Math.round((totalLimpio - subtotal) * 100) / 100;

  return {
    subtotal,
    igv,
    total: Math.round(totalLimpio * 100) / 100,
  };
}

/**
 * Reglas de combos predefinidos para la pollería:
 * - Combo Parrillero: Parrilla personal + Cerveza / Bebida -> Descuento S/ 4.00
 * - Combo Familiar: Pollo a la brasa (entero) + Chicha morada / Gaseosa -> Descuento S/ 6.00
 * - Dúo Brasa: 2x 1/4 Pollo a la brasa -> Descuento S/ 3.00
 */
export function evaluarDescuentosCombos(items: OrderItem[]): {
  itemsModificados: OrderItem[];
  descuentoTotal: number;
  combosAplicados: ComboDescuento[];
} {
  const combosAplicados: ComboDescuento[] = [];
  let descuentoTotal = 0;

  // Clona la lista
  const itemsCopia = items.map((i) => ({ ...i }));

  const buscarItem = (nombreParcial: string) =>
    itemsCopia.find(
      (it) => it.nombre.toLowerCase().includes(nombreParcial.toLowerCase()) && it.cantidad > 0
    );

  // 1. Combo Familiar: Pollo entero + Bebida (Chicha o Inca Kola)
  const polloEntero = buscarItem('Pollo a la brasa (entero)');
  const bebida = itemsCopia.find(
    (it) =>
      (it.nombre.toLowerCase().includes('chicha') || it.nombre.toLowerCase().includes('inca kola')) &&
      it.cantidad > 0
  );

  if (polloEntero && bebida) {
    const cantCombos = Math.min(polloEntero.cantidad, bebida.cantidad);
    const montoDesc = cantCombos * 6.0;
    descuentoTotal += montoDesc;
    combosAplicados.push({
      nombreCombo: 'Combo Familiar (Pollo Entero + Bebida)',
      descuento: montoDesc,
      itemsInvolucrados: [polloEntero.nombre, bebida.nombre],
    });
  }

  // 2. Combo Parrillero: Parrilla o Bife + Cerveza
  const parrilla = buscarItem('Parrilla personal') || buscarItem('Costillar BBQ');
  const cerveza = buscarItem('Cerveza');
  if (parrilla && cerveza) {
    const cantCombos = Math.min(parrilla.cantidad, cerveza.cantidad);
    const montoDesc = cantCombos * 4.0;
    descuentoTotal += montoDesc;
    combosAplicados.push({
      nombreCombo: 'Combo Parrillero (Parrilla + Cerveza)',
      descuento: montoDesc,
      itemsInvolucrados: [parrilla.nombre, cerveza.nombre],
    });
  }

  // 3. Dúo Cuartos: 2 cuartos de pollo
  const cuartoPollo = itemsCopia.find(
    (it) => it.nombre.toLowerCase().includes('1/4') && it.cantidad >= 2
  );
  if (cuartoPollo) {
    const cantPares = Math.floor(cuartoPollo.cantidad / 2);
    const montoDesc = cantPares * 3.0;
    descuentoTotal += montoDesc;
    combosAplicados.push({
      nombreCombo: 'Dúo Cuartos de Brasa',
      descuento: montoDesc,
      itemsInvolucrados: [cuartoPollo.nombre],
    });
  }

  return {
    itemsModificados: itemsCopia,
    descuentoTotal: Math.round(descuentoTotal * 100) / 100,
    combosAplicados,
  };
}

/**
 * Validador para comprobantes fiscales de SUNAT
 */
export function validarDocumentoIdentidad(
  tipo: TipoComprobante,
  numeroDoc?: string
): { valido: boolean; mensaje?: string } {
  if (tipo === 'ticket') return { valido: true };

  const doc = (numeroDoc || '').trim();

  if (tipo === 'boleta') {
    // Para boleta menor a S/ 700 no es obligatorio DNI en Perú, pero si se ingresa debe tener 8 dígitos
    if (!doc) return { valido: true };
    if (!/^\d{8}$/.test(doc)) {
      return { valido: false, mensaje: 'El DNI debe contener exactamente 8 dígitos numéricos.' };
    }
    return { valido: true };
  }

  if (tipo === 'factura') {
    // Factura exige RUC válido de 11 dígitos que empiece con 10 o 20
    if (!doc) {
      return { valido: false, mensaje: 'Para emitir Factura es obligatorio ingresar un RUC.' };
    }
    if (!/^(10|20)\d{9}$/.test(doc)) {
      return {
        valido: false,
        mensaje: 'RUC inválido. Debe tener 11 dígitos y empezar con 10 (persona natural) o 20 (empresa).',
      };
    }
    return { valido: true };
  }

  return { valido: true };
}

/**
 * Formateo estándar de moneda peruana (Soles)
 */
export function formatearSoles(monto: number): string {
  return `S/ ${Number(monto || 0).toFixed(2)}`;
}

