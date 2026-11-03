import "dotenv/config";
import { verifyExpenseWithAI } from "../lib/ai-verifier";

async function test() {
  console.log("--- TEST 1: HOME DEPOT (Debe ser VÁLIDO) ---");
  const res1 = await verifyExpenseWithAI(
    {
      concepto: "Pintura blanca 19L y brochas para muros",
      proveedor: "THE HOME DEPOT",
      subtotal: 1680.0,
      iva: 268.8,
      total: 1948.8,
    },
    ["/tickets/ticket-homedepot.png"]
  );
  console.log("Resultado Gasto 1:", res1);

  console.log("\n--- TEST 2: GASOMEX (Debe ser RECHAZADO por discrepancia) ---");
  const res2 = await verifyExpenseWithAI(
    {
      concepto: "Combustible para revolvedora y generador de obra",
      proveedor: "ESTACION DE SERVICIO GASOMEX",
      subtotal: 1034.48,
      iva: 165.52,
      total: 1200.0, // El ticket es de $450.00
    },
    ["/tickets/ticket-gasolina.png"]
  );
  console.log("Resultado Gasto 2:", res2);
}

test();

