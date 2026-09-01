import { GoogleGenerativeAI } from "@google/generative-ai";

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

  // 1. Descargar las imágenes y convertirlas a formato Gemini
  const imageParts = [];
  for (const url of imageUrls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const mimeType = response.headers.get("content-type") || "image/jpeg";

      imageParts.push({
        inlineData: {
          data: base64,
          mimeType
        }
      });
    } catch (error) {
      console.error("Error downloading image for AI verification:", error);
    }
  }

  if (imageParts.length === 0) {
    return {
      valido: false,
      razon: "La IA no pudo analizar el comprobante porque no se pudo descargar o no hay imágenes legibles adjuntas."
    };
  }

  // 2. Preparar el prompt del sistema
  const prompt = `
Eres un riguroso auditor financiero para un sistema de construcción.
Tu trabajo es revisar comprobantes (facturas, tickets) y compararlos con los datos registrados por el usuario.

### Datos registrados por el capturista:
- Concepto/Descripción: "${gasto.concepto}"
- Proveedor: "${gasto.proveedor}"
- Subtotal: $${gasto.subtotal.toFixed(2)}
- IVA: $${gasto.iva.toFixed(2)}
- Total: $${gasto.total.toFixed(2)}

### Reglas de Verificación:
1. Busca en las imágenes el monto total. Debe coincidir con el total registrado. Tienes una tolerancia de hasta $2.00 pesos/dólares de diferencia (para errores menores de redondeo de centavos).
2. Busca el nombre del proveedor en la imagen. No tiene que ser exacto, pero debe ser razonablemente parecido.
3. Si la foto está muy borrosa y no puedes leer ningún número, rechaza el gasto.
4. Si encuentras los montos pero el total real es significativamente diferente, recházalo.

Debes responder ÚNICAMENTE con un JSON válido, sin Markdown (\`\`\`json) y sin texto adicional, con la siguiente estructura:
{
  "valido": true o false,
  "razon": "Explicación muy breve de por qué fue aprobado o rechazado (ej. 'Los montos coinciden perfectamente' o 'El ticket marca un total de $150 pero se registró $200')."
}
`;

  // 3. Llamar a Gemini 1.5 Pro
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text();
    
    // 4. Parsear el JSON
    const parsed = JSON.parse(responseText.trim());
    return {
      valido: !!parsed.valido,
      razon: parsed.razon || "Sin razón especificada."
    };
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return {
      valido: false,
      razon: "Error de conexión con el proveedor de Inteligencia Artificial."
    };
  }
}
