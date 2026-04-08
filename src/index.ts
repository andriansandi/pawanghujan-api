import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Setup CORS agar Frontend kamu bisa akses
app.use('*', cors({
  origin: ['https://pawanghujan.xyz', 'http://localhost:5173'], // Sesuaikan domain frontend
  allowMethods: ['POST', 'GET', 'OPTIONS'],
}))

app.get('/', (c) => c.text('API Pawang Hujan Ready!'))

app.post('/log-location', async (c) => {
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

export default app