import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Transfer() {
  const [form, setForm] = useState({
    product_id: '',
    from_location_id: '',
    to_location_id: '',
    quantity: '',
    notes: ''
  })
  const [products, setProducts] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name')
        .order('name')

      const { data: locationsData } = await supabase
        .from('locations')
        .select('id, name')
        .order('name')

      setProducts(productsData || [])
      setLocations(locationsData || [])
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Error cargando datos' })
    } finally {
      setLoadingData(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const quantity = parseInt(form.quantity)

    if (form.from_location_id === form.to_location_id) {
      setMessage({ type: 'error', text: '⚠️ La ubicación de origen y destino no pueden ser la misma' })
      setLoading(false)
      return
    }

    try {
      // 1. Registrar salida de la bodega origen
      const { error: errorOut } = await supabase
        .from('inventory_movements')
        .insert([
          {
            product_id: form.product_id,
            location_id: form.from_location_id,
            quantity: -quantity,  // Negativo para FIFO
            movement_type: 'transfer_out',
            notes: `Transferencia a ${locations.find(l => l.id === form.to_location_id)?.name} | ${form.notes || ''}`
          }
        ])

      if (errorOut) throw errorOut

      // 2. Registrar entrada en la bodega destino
      const { error: errorIn } = await supabase
        .from('inventory_movements')
        .insert([
          {
            product_id: form.product_id,
            location_id: form.to_location_id,
            quantity: quantity,  // Positivo para nuevo lote
            movement_type: 'transfer_in',
            notes: `Transferencia desde ${locations.find(l => l.id === form.from_location_id)?.name} | ${form.notes || ''}`
          }
        ])

      if (errorIn) throw errorIn

      const productName = products.find(p => p.id === form.product_id)?.name
      const fromName = locations.find(l => l.id === form.from_location_id)?.name
      const toName = locations.find(l => l.id === form.to_location_id)?.name

      setMessage({ 
        type: 'success', 
        text: `✅ Transferencia exitosa: ${quantity} unidades de ${productName} de ${fromName} a ${toName}` 
      })
      
      setForm({ ...form, quantity: '', notes: '' })
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: `❌ Error en transferencia: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>🚚 Transferencia entre Bodegas</h1>
        <p>Cargando datos...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>🚚 Transferencia entre Bodegas</h1>
      
      <div style={{ 
        backgroundColor: '#fff3e0', 
        padding: '12px', 
        borderRadius: '5px', 
        marginBottom: '20px',
        borderLeft: '4px solid #ff9800'
      }}>
        💡 Esta operación restará stock de la bodega origen y sumará a la bodega destino.
      </div>
      
      <form onSubmit={handleSubmit} style={{ maxWidth: '500px' }}>
        <div style={{ marginBottom: '15px' }}>
          <label>Producto:</label>
          <select
            value={form.product_id}
            onChange={(e) => setForm({...form, product_id: e.target.value})}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            required
          >
            <option value="">Selecciona un producto...</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Bodega Origen (sale):</label>
          <select
            value={form.from_location_id}
            onChange={(e) => setForm({...form, from_location_id: e.target.value})}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            required
          >
            <option value="">Selecciona origen...</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Bodega Destino (recibe):</label>
          <select
            value={form.to_location_id}
            onChange={(e) => setForm({...form, to_location_id: e.target.value})}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            required
          >
            <option value="">Selecciona destino...</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Cantidad a transferir:</label>
          <input
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({...form, quantity: e.target.value})}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            required
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Notas (opcional):</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({...form, notes: e.target.value})}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            rows="2"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: '#ff9800',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {loading ? 'Procesando...' : '🚚 Realizar Transferencia'}
        </button>

        {message && (
          <div style={{
            marginTop: '15px',
            padding: '10px',
            backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
            color: message.type === 'success' ? '#155724' : '#721c24',
            borderRadius: '5px'
          }}>
            {message.text}
          </div>
        )}
      </form>

      <div style={{ marginTop: '30px' }}>
        <a href="/inventory" style={{ color: '#0070f3', textDecoration: 'none', marginRight: '20px' }}>
          ← Ver Inventario
        </a>
        <a href="/movements" style={{ color: '#0070f3', textDecoration: 'none' }}>
          Movimientos Manuales →
        </a>
      </div>
    </div>
  )
}
