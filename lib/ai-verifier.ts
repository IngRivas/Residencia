import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export interface AIVerificationResult {
  valido: boolean;
  razon: string;
}

export async function verifyExpenseWithAI(
  gasto: {
    concepto: string;
    proveedor: string;
    total: number;
    subtotal: number;
    iva: number;
  },
  imageUrls: string[]
): Promise<AIVerificationResult> {
  if (!genAI) {
    throw new Error("GEMINI_API_KEY no está configurada en .env");
  }

  // 1. Obtener los buffers de las imágenes
  const imageParts = [];
  for (const url of imageUrls) {
    try {
      let buffer: Buffer | null = null;
      let mimeType = "image/png";

      if (url.startsWith("/")) {
        const localPath = path.join(process.cwd(), "public", url);
        if (fs.existsSync(localPath)) {
          buffer = fs.readFileSync(localPath);
          if (url.endsWith(".jpg") || url.endsWith(".jpeg")) mimeType = "image/jpeg";
          else if (url.endsWith(".webp")) mimeType = "image/webp";
          else mimeType = "image/png";
        }
      } else if (url.startsWith("data:")) {
        const matches = url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          buffer = Buffer.from(matches[2], "base64");
        }
      } else if (url.startsWith("http://") || url.startsWith("https://")) {
        const response = await fetch(url);
        if (response.ok) {
          const ab = await response.arrayBuffer();
          buffer = Buffer.from(ab);
          mimeType = response.headers.get("content-type") || "image/jpeg";
        }
      }

      if (buffer) {
        const base64 = buffer.toString("base64");
        imageParts.push({
          inlineData: {
            data: base64,
            mimeType,
          },
        });
      }
    } catch (error) {
      console.error("Error cargando imagen para verificación IA:", error);
    }
  }

  if (imageParts.length === 0) {
    return {
      valido: false,
      razon: "La IA no pudo analizar el comprobante porque no se pudo descargar o no hay imágenes legibles adjuntas.",
    };
  }

  // 2. Preparar el prompt del sistema
  const prompt = `
Eres un riguroso auditor financiero para un sistema de control de gastos en construcción.
Tu trabajo es revisar comprobantes (facturas, tickets de compra) y compararlos con los datos registrados por el capturista.

### Datos registrados por el capturista:
- Concepto/Descripción: "${gasto.concepto}"
- Proveedor registrado: "${gasto.proveedor}"
- Subtotal: $${gasto.subtotal.toFixed(2)}
- IVA: $${gasto.iva.toFixed(2)}
- Total registrado: $${gasto.total.toFixed(2)}

### Reglas de Verificación:
1. Busca en la imagen del ticket el monto TOTAL a pagar. Debe coincidir con el total registrado. Tienes una tolerancia de hasta $2.00 pesos de diferencia por redondeos menores de centavos.
2. Compara el nombre del proveedor en el comprobante. Debe corresponder al establecimiento o razón social registrada (ej. "THE HOME DEPOT", "GASOMEX", etc.).
3. Si el ticket marca un monto significativamente distinto al total registrado (por ejemplo, si el ticket dice $450 pero el capturista declaró $1,200), DEBES RECHAZARLO indicando la diferencia real encontrada.
4. Si los montos coinciden y el comprobante corresponde al tipo de compra descrita, APRUÉBALO.

Debes responder ÚNICAMENTE con un objeto JSON válido, sin bloques de código markdown (\`\`\`json) y sin explicaciones extra:
{
  "valido": true o false,
  "razon": "Explicación breve y concisa en español (ej. 'Comprobante válido: El total de $1,948.80 coincide perfectamente con la compra en The Home Depot' o 'Rechazado: El ticket marca un total de $450.00 pero se registraron $1,200.00')."
}
`;

  // 3. Llamar a modelos de Gemini disponibles (1.5 Flash -> 2.0 Flash -> 1.5 Pro)
  const modelsToTry = [
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
  ];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      const result = await model.generateContent([prompt, ...imageParts]);
      const responseText = result.response.text();

      let cleanJson = responseText.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      const parsed = JSON.parse(cleanJson);
      return {
        valido: !!parsed.valido,
        razon: parsed.razon || "Sin razón especificada.",
      };
    } catch (error: any) {
      console.warn(`Intento con ${modelName} falló:`, error?.message || error);
      lastError = error;
    }
  }

  console.error("Gemini AI Error:", lastError);
  return {
    valido: false,
    razon: "Error al comunicarse con el servicio de IA: " + (lastError?.message || "Sin respuesta."),
  };
}
