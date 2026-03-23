import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Movements() {
  const [form, setForm] = useState({
    product_id: '',
    location_id: '',
    quantity: '',
    movement_type: 'restock',
    notes: ''
  })
  const [products, setProducts] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [message, setMessage] = useState(null)

  // Cargar productos y ubicaciones al iniciar
  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      // Cargar productos (id + name)
      const { data: productsData, error: prodError } = await supabase
        .from('products')
        .select('id, name')
        .order('name')

      if (prodError) throw prodError
      setProducts(productsData || [])

      // Cargar ubicaciones (id + name)
      const { data: locationsData, error: locError } = await supabase
        .from('locations')
        .select('id, name')
        .order('name')

      if (locError) throw locError
      setLocations(locationsData || [])

    } catch (err) {
      console.error('Error cargando datos:', err)
      setMessage({ type: 'error', text: 'Error cargando productos y ubicaciones' })
    } finally {
      setLoadingData(false)
    }
  }

  // Tipos de movimiento (excluyendo 'sale')
  const movementTypes = [
    { type: 'restock', description: '📦 Reabastecimiento (suma stock)', effect: '➕' },
    { type: 'adjustment', description: '✏️ Ajuste (corrección)', effect: '🔄' },
    { type: 'employee', description: '👥 Empleado (resta stock)', effect: '➖' },
    { type: 'promo', description: '🎁 Promoción (resta stock)', effect: '➖' },
    { type: 'expired', description: '⏰ Vencido (resta stock)', effect: '➖' },
    { type: 'damaged', description: '🔨 Dañado (resta stock)', effect: '➖' },
    { type: 'transfer_in', description: '🚚 Transferencia Entrada (suma stock)', effect: '➕' },
    { type: 'transfer_out', description: '📤 Transferencia Salida (resta stock)', effect: '➖' }
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const { error } = await supabase.from('inventory_movements').insert([
        {
          product_id: form.product_id,
          location_id: form.location_id,
          quantity: parseInt(form.quantity),
          movement_type: form.movement_type,
          notes: form.notes || null
        }
      ])

      if (error) throw error

      const selectedType = movementTypes.find(t => t.type === form.movement_type)
      const productName = products.find(p => p.id === form.product_id)?.name
      const locationName = locations.find(l => l.id === form.location_id)?.name

      setMessage({ 
        type: 'success', 
        text: `✅ ${selectedType.description} | ${productName} en ${locationName} | Cantidad: ${form.quantity}` 
      })
      
      setForm({ ...form, quantity: '', notes: '' })
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>📝 Registrar Movimiento Manual</h1>
        <p>Cargando productos y ubicaciones...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>📝 Registrar Movimiento Manual</h1>
      
      <div style={{ 
        backgroundColor: '#e3f2fd', 
        padding: '12px', 
        borderRadius: '5px', 
        marginBottom: '20px',
        borderLeft: '4px solid #2196f3'
      }}>
        💡 <strong>Nota:</strong> Las ventas (sale) se registran automáticamente desde el sistema de órdenes.
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
            {products.map(product => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Ubicación:</label>
          <select
            value={form.location_id}
            onChange={(e) => setForm({...form, location_id: e.target.value})}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            required
          >
            <option value="">Selecciona una ubicación...</option>
            {locations.map(location => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Cantidad:</label>
          <input
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({...form, quantity: e.target.value})}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            required
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Tipo de Movimiento:</label>
          <select
            value={form.movement_type}
            onChange={(e) => setForm({...form, movement_type: e.target.value})}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            required
          >
            {movementTypes.map(type => (
              <option key={type.type} value={type.type}>
                {type.effect} {type.description}
              </option>
            ))}
          </select>
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
            backgroundColor: '#0070f3',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Registrando...' : 'Registrar Movimiento'}
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
        <a href="/movements-history" style={{ color: '#0070f3', textDecoration: 'none' }}>
          Ver Historial →
        </a>
      </div>
    </div>
  )
}
