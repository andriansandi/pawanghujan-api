// src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database,
  AI: any,
  API_KEY: string,
}

const app = new Hono<{ Bindings: Bindings }>()

// Setup CORS - Pastikan origin production kamu sudah benar
app.use('*', cors({
  origin: ['https://pawanghujan.xyz', 'http://localhost:5173', 'http://127.0.0.1:5173'], 
  allowMethods: ['POST', 'GET', 'OPTIONS'],
}))

// Middleware Keamanan (X-Pawang-Key)
const authMiddleware = async (c: any, next: any) => {
  const apiKey = c.req.header('X-Pawang-Key')
  if (!c.env.API_KEY || !apiKey || apiKey !== c.env.API_KEY) {
    return c.json({ success: false, error: 'Unidentified Pawang!' }, 401)
  }
  await next()
}

app.get('/', (c) => c.text('API Pawang Hujan Ready!'))

// --- ENDPOINT: LOG KE D1 ---
app.post('/log-location', authMiddleware, async (c) => {
  try {
    const { lat, lon, location_name, chance, weather_type } = await c.req.json()
    await c.env.DB.prepare(
      "INSERT INTO location_logs (lat, lon, location_name, chance, weather_type) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(lat, lon, location_name, chance, weather_type)
    .run()
    return c.json({ success: true, message: 'Data tersimpan' })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// --- ENDPOINT: GENERATE SAJAK (LLM) ---
app.post('/get-quote', authMiddleware, async (c) => {
  try {
    const { weather, location } = await c.req.json()
    const prompt = `Tulis sajak puitis 2-3 baris tentang cuaca ${weather} di ${location}. Gaya anak senja kontemplatif, maksimal 20 kata. Pakai newline. Tanpa tanda kutip.`;

    const result = await c.env.AI.run("@cf/meta/llama-3-8b-instruct", {
      messages: [
        { role: "system", content: "Kamu penyair estetik Indonesia." },
        { role: "user", content: prompt }
      ]
    })

    return c.json({ success: true, quote: result.response.trim() })
  } catch (e: any) {
    return c.json({ success: false, quote: "Langit sedang bercerita dalam diam.", error: e.message }, 500)
  }
})

app.post('/generate-image', authMiddleware, async (c) => {
  try {
    const { weather, location } = await c.req.json();

    // 1. Jalankan AI
    const response = await c.env.AI.run(
      "@cf/stabilityai/stable-diffusion-xl-base-1.0",
      {
        prompt: `Cinematic moody photography, ${weather} in ${location}, lo-fi aesthetic, 8k.`,
      }
    );

    if (!response) {
      return c.json({ success: false, error: "AI returned nothing" }, 500);
    }

    // 2. KUNCI UTAMA: Baca Stream sampai habis jadi ArrayBuffer
    const buffer = await new Response(response).arrayBuffer();

    // 3. KONVERSI KE BASE64
    // Kita pakai // @ts-ignore agar TypeScript tutup mata dan gak ngasih garis merah.
    // Pas di-deploy, Buffer ini PASTI jalan karena kamu sudah pasang nodejs_compat di wrangler.jsonc.
    
    // @ts-ignore
    const base64String = Buffer.from(buffer).toString('base64');

    if (base64String.length < 100) {
      return c.json({ success: false, error: "Base64 conversion failed" }, 500);
    }

    // 4. Kirim ke Frontend
    return c.json({
      success: true,
      image: `data:image/jpeg;base64,${base64String}`
    });

  } catch (e: any) {
    console.error("Worker Error:", e.message);
    return c.json({ success: false, error: e.message }, 500);
  }
})

export default app