import { prisma } from "../lib/db";

async function main() {
  console.log("Iniciando inyección de datos de prueba para IA...");

  // Buscar cualquier usuario para asignarlo como creador
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No hay usuarios en la base de datos.");

  // Buscar la obra más reciente (o cualquiera)
  let obra = await prisma.obra.findFirst();
  if (!obra) {
      // Create an obra if none exists
      obra = await prisma.obra.create({
          data: {
              nombre: "Obra de Prueba IA",
              presupuestoTotal: 100000
          }
      })
  }

  // Buscar un día de obra
  let diaObra = await prisma.diaObra.findFirst({
      where: { obraId: obra.id }
  });

  if (!diaObra) {
      diaObra = await prisma.diaObra.create({
          data: {
              obraId: obra.id,
              fecha: new Date(),
              presupuestoDiario: 1000
          }
      });
  }

  // URL de un ticket de ejemplo real (un ticket común de Contoso de Microsoft / Azure tests)
  // El ticket tiene fecha 6/10/2019, total de $143.32
  const imageUrl = "https://raw.githubusercontent.com/Azure-Samples/cognitive-services-REST-api-samples/master/curl/form-recognizer/contoso-receipt.png";

  // Gasto 1: Correcto (Los datos coinciden con la imagen)
  console.log("Creando Gasto 1 (Debería ser VERIFICADO)...");
  await prisma.gasto.create({
    data: {
      diaObraId: diaObra.id,
      creadoPorId: user.id,
      concepto: "Materiales de oficina (Prueba correcta)",
      proveedor: "Contoso",
      porcentajeIVA: 16,
      subtotal: 123.55,
      iva: 19.77,
      total: 143.32,
      estado: "PENDIENTE",
      fotos: {
        create: [
          {
            url: imageUrl,
            publicId: "mock_correct_image"
          }
        ]
      }
    }
  });

  // Gasto 2: Falso / Erróneo (Total diferente al de la imagen)
  console.log("Creando Gasto 2 (Debería ser RECHAZADO)...");
  await prisma.gasto.create({
    data: {
      diaObraId: diaObra.id,
      creadoPorId: user.id,
      concepto: "Falsa declaración de gasto (Prueba fraude)",
      proveedor: "Contoso",
      porcentajeIVA: 16,
      subtotal: 800.00,
      iva: 128.00,
      total: 928.00,
      estado: "PENDIENTE",
      fotos: {
        create: [
          {
            url: imageUrl, // Usamos la misma imagen que dice $143.32
            publicId: "mock_fraud_image"
          }
        ]
      }
    }
  });

  console.log("¡Datos de prueba inyectados correctamente!");
  console.log("Ve a la obra, abre el día y haz click en '✨ Asistente IA' para ver la magia.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
