import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database,
  AI: any,
  API_KEY: string,
}

const app = new Hono<{ Bindings: Bindings }>()

// Setup CORS
app.use('*', cors({
  origin: ['https://pawanghujan.xyz', 'http://localhost:5173'], 
  allowMethods: ['POST', 'GET', 'OPTIONS'],
}))

const authMiddleware = async (c: any, next: any) => {
  const apiKey = c.req.header('X-Pawang-Key')
  if (apiKey !== c.env.API_KEY) {
    return c.json({ success: false, error: 'Unidentified Pawang!' }, 401)
  }
  await next()
}

app.get('/', (c) => c.text('API Pawang Hujan Ready!'))

// --- ENDPOINT LOG LOCATION ---
app.post('/log-location', authMiddleware, async (c) => {
  try {
    const { lat, lon, location_name, chance, weather_type } = await c.req.json()

    await c.env.DB.prepare(
      "INSERT INTO location_logs (lat, lon, location_name, chance, weather_type) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(lat, lon, location_name, chance, weather_type)
    .run()

    return c.json({ success: true, message: 'Data tersimpan di D1 remote' })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

app.post('/get-quote', authMiddleware, async (c) => {
  try {
    const { weather, location } = await c.req.json()

    // Prompt estetik ala anak senja
    const prompt = `Berikan satu kalimat puitis singkat tentang cuaca ${weather} di ${location}. 
                    Gunakan gaya bahasa santai anak senja Indonesia, jangan kaku. 
                    Maksimal 12 kata. Langsung ke kalimatnya tanpa tanda kutip.`

    const result = await c.env.AI.run("@cf/meta/llama-3-8b-instruct", {
      messages: [
        { role: "system", content: "Kamu adalah asisten puitis yang pandai membuat quote estetik dalam Bahasa Indonesia." },
        { role: "user", content: prompt }
      ]
    })

    return c.json({ 
      success: true, 
      quote: result.response.trim() 
    })
  } catch (e: any) {
    return c.json({ 
      success: false, 
      quote: "Langit sedang bercerita, dengarkan saja dalam diam.", // Fallback jika AI error
      error: e.message 
    }, 500)
  }
})

export default app