// scripts/test-billing-load.mjs
// Suite de Pruebas Unitarias, Integración y Simulación de Carga para "Brasas del Campus"
// Ejecutar con: node scripts/test-billing-load.mjs

import { calcularIGV, evaluarDescuentosCombos, validarDocumentoIdentidad } from '../src/lib/billing.ts';

console.log('====================================================');
console.log('🔥 BRASAS DEL CAMPUS — SUITE DE PRUEBAS AUTOMATIZADAS');
console.log('====================================================\n');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName, extra = '') {
  if (condition) {
    console.log(`  ✅ [PASSED] ${testName} ${extra}`);
    testsPassed++;
  } else {
    console.error(`  ❌ [FAILED] ${testName} ${extra}`);
    testsFailed++;
  }
}

// ---------------------------------------------------------------------------
// 1. PRUEBAS UNITARIAS: CÁLCULO DE IGV
// ---------------------------------------------------------------------------
console.log('--- 1. Pruebas Unitarias: Desglose de IGV (18% Perú) ---');

const test1 = calcularIGV(100.0);
assert(test1.total === 100.0, 'Total permanece en S/ 100.00');
assert(test1.subtotal === 84.75, `Subtotal (Op. Gravada) debe ser S/ 84.75 (obtenido: ${test1.subtotal})`);
assert(test1.igv === 15.25, `IGV (18%) debe ser S/ 15.25 (obtenido: ${test1.igv})`);
assert(Math.round((test1.subtotal + test1.igv) * 100) / 100 === 100.0, 'Subtotal + IGV suma exactamente el Total');

const testPollo = calcularIGV(52.0); // Pollo entero
assert(testPollo.subtotal === 44.07, `Pollo entero S/ 52.00 -> Base S/ 44.07 (obtenido: ${testPollo.subtotal})`);
assert(testPollo.igv === 7.93, `Pollo entero S/ 52.00 -> IGV S/ 7.93 (obtenido: ${testPollo.igv})`);

// ---------------------------------------------------------------------------
// 2. PRUEBAS UNITARIAS: DESCUENTOS EN COMBOS
// ---------------------------------------------------------------------------
console.log('\n--- 2. Pruebas Unitarias: Descuentos en Combos Promocionales ---');

const itemsConCombo = [
  { menuItemId: 'p1', nombre: 'Pollo a la brasa (entero)', precio: 52, cantidad: 1 },
  { menuItemId: 'b1', nombre: 'Jarra de Chicha morada', precio: 10, cantidad: 1 },
];

const resCombo = evaluarDescuentosCombos(itemsConCombo);
assert(resCombo.descuentoTotal === 6.0, `Combo Familiar descuenta S/ 6.00 (obtenido: ${resCombo.descuentoTotal})`);
assert(resCombo.combosAplicados.length === 1, 'Detecta exactamente 1 combo promocional');

const itemsSinCombo = [
  { menuItemId: 'e1', nombre: 'Tequeños de queso', precio: 14, cantidad: 2 },
];
const resSinCombo = evaluarDescuentosCombos(itemsSinCombo);
assert(resSinCombo.descuentoTotal === 0, 'No aplica descuento cuando no hay combos válidos');

// ---------------------------------------------------------------------------
// 3. PRUEBAS DE INTEGRACIÓN: VALIDACIÓN DE COMPROBANTES SUNAT
// ---------------------------------------------------------------------------
console.log('\n--- 3. Pruebas de Integración: Emisión de Comprobantes (Boleta/Factura) ---');

assert(validarDocumentoIdentidad('ticket').valido, 'Ticket interno no requiere documento');
assert(validarDocumentoIdentidad('boleta').valido, 'Boleta sin DNI es válida para montos menores');
assert(validarDocumentoIdentidad('boleta', '72345678').valido, 'Boleta con DNI de 8 dígitos es válida');
assert(!validarDocumentoIdentidad('boleta', '123').valido, 'Boleta con DNI incompleto es rechazada');

assert(!validarDocumentoIdentidad('factura').valido, 'Factura sin RUC es rechazada');
assert(!validarDocumentoIdentidad('factura', '12345678901').valido, 'Factura con RUC que no empieza con 10 o 20 es rechazada');
assert(validarDocumentoIdentidad('factura', '20601234567').valido, 'Factura con RUC válido (20...) es aceptada');
assert(validarDocumentoIdentidad('factura', '10456789012').valido, 'Factura con RUC persona natural con negocio (10...) es aceptada');

// ---------------------------------------------------------------------------
// 4. PRUEBAS DE CARGA EN HORA PICO (SIMULACIÓN DE CONCURRENCIA)
// ---------------------------------------------------------------------------
console.log('\n--- 4. Pruebas de Carga en Hora Pico (Simulación de Comandas Concurrente) ---');

const SIMULATED_ORDERS = 50; // Simula 50 comandas ingresando en ráfaga en hora pico
console.log(`  ⚡ Generando ${SIMULATED_ORDERS} comandas concurrentes simuladas...`);

const start = performance.now();
const latencyResults = [];

for (let i = 0; i < SIMULATED_ORDERS; i++) {
  const t0 = performance.now();
  // Simulación de procesamiento de comanda: consolidación de items, validación y desglose de IGV
  const items = [
    { menuItemId: `m-${i % 5}`, nombre: '1/4 Pollo a la brasa', precio: 16, cantidad: 2 },
    { menuItemId: `b-${i % 3}`, nombre: 'Inca Kola 500ml', precio: 5, cantidad: 2 },
  ];
  const { descuentoTotal } = evaluarDescuentosCombos(items);
  const totalBruto = items.reduce((acc, it) => acc + it.precio * it.cantidad, 0);
  const totalNeto = totalBruto - descuentoTotal;
  const fiscal = calcularIGV(totalNeto);
  const t1 = performance.now();
  latencyResults.push(t1 - t0);
}
const end = performance.now();

const totalDurationMs = end - start;
const avgLatencyMs = latencyResults.reduce((a, b) => a + b, 0) / latencyResults.length;
const maxLatencyMs = Math.max(...latencyResults);
const minLatencyMs = Math.min(...latencyResults);

console.log(`  ⏱️ Tiempo total de procesamiento para ${SIMULATED_ORDERS} comandas: ${totalDurationMs.toFixed(2)} ms`);
console.log(`  📊 Latencia promedio por comanda: ${avgLatencyMs.toFixed(3)} ms`);
console.log(`  🚀 Latencia mínima: ${minLatencyMs.toFixed(3)} ms | Máxima: ${maxLatencyMs.toFixed(3)} ms`);

assert(avgLatencyMs < 5.0, 'Rendimiento en Hora Pico: Latencia promedio inferior a 5ms por comanda');
assert(totalDurationMs < 200.0, 'Rendimiento en Hora Pico: Ráfaga completa procesada en menos de 200ms');

// ---------------------------------------------------------------------------
// RESULTADO FINAL
// ---------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`RESULTADO: ${testsPassed} pruebas superadas, ${testsFailed} falladas.`);
if (testsFailed === 0) {
  console.log('🎉 TODAS LAS PRUEBAS UNITARIAS, DE INTEGRACIÓN Y CARGA PASARON EXITOSAMENTE.');
}
console.log('====================================================\n');

