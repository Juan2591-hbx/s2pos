import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Transfer() {
  const [locations, setLocations] = useState([])
  const [products, setProducts] = useState([])
  const [fromLocation, setFromLocation] = useState('')
  const [toLocation, setToLocation] = useState('')
  const [quantities, setQuantities] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      // Cargar ubicaciones
      const { data: locs } = await supabase
        .from('locations')
        .select('id, name')
        .order('name')

      setLocations(locs || [])

      // Cargar productos con stock actual en la ubicación origen
      if (fromLocation) {
        const { data: inventory } = await supabase
          .from('inventory_totals')
          .select(`
            product_id,
            total_stock,
            products (id, name)
          `)
          .eq('location_id', fromLocation)
          .gt('total_stock', 0)

        if (inventory) {
          const productsList = inventory.map(item => ({
            id: item.product_id,
            name: item.products?.name || item.product_id,
            stock: item.total_stock
          }))
          setProducts(productsList)
          
          // Inicializar cantidades en 0
          const initialQtys = {}
          productsList.forEach(p => { initialQtys[p.id] = 0 })
          setQuantities(initialQtys)
        } else {
          setProducts([])
        }
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Error cargando datos' })
    } finally {
      setLoadingData(false)
    }
  }

  // Actualizar productos cuando cambia la ubicación origen
  useEffect(() => {
    if (fromLocation) {
      fetchData()
    }
  }, [fromLocation])

  const handleQuantityChange = (productId, value) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: parseInt(value) || 0
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (!fromLocation || !toLocation) {
      setMessage({ type: 'error', text: 'Selecciona origen y destino' })
      setLoading(false)
      return
    }

    if (fromLocation === toLocation) {
      setMessage({ type: 'error', text: 'Origen y destino no pueden ser iguales' })
      setLoading(false)
      return
    }

    // Filtrar productos con cantidad > 0
    const transfers = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => ({ productId, qty }))

    if (transfers.length === 0) {
      setMessage({ type: 'error', text: 'No hay productos con cantidad a transferir' })
      setLoading(false)
      return
    }

    const fromName = locations.find(l => l.id === fromLocation)?.name
    const toName = locations.find(l => l.id === toLocation)?.name

    try {
      // Registrar cada transferencia
      for (const { productId, qty } of transfers) {
        // Salida
        const { error: errorOut } = await supabase
          .from('inventory_movements')
          .insert([{
            product_id: productId,
            location_id: fromLocation,
            quantity: -qty,
            movement_type: 'transfer_out',
            notes: `Transferencia masiva a ${toName}`
          }])

        if (errorOut) throw errorOut

        // Entrada
        const { error: errorIn } = await supabase
          .from('inventory_movements')
          .insert([{
            product_id: productId,
            location_id: toLocation,
            quantity: qty,
            movement_type: 'transfer_in',
            notes: `Transferencia masiva desde ${fromName}`
          }])

        if (errorIn) throw errorIn
      }

      setMessage({ 
        type: 'success', 
        text: `✅ Transferencia masiva completada: ${transfers.length} productos transferidos de ${fromName} a ${toName}` 
      })
      
      // Resetear cantidades
      const resetQtys = {}
      products.forEach(p => { resetQtys[p.id] = 0 })
      setQuantities(resetQtys)
      
      // Recargar productos (actualizar stock)
      fetchData()
      
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
        <h1>🚚 Transferencia Masiva</h1>
        <p>Cargando datos...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>🚚 Transferencia Masiva entre Bodegas</h1>
      
      <div style={{ 
        backgroundColor: '#fff3e0', 
        padding: '12px', 
        borderRadius: '5px', 
        marginBottom: '20px',
        borderLeft: '4px solid #ff9800'
      }}>
        💡 Selecciona origen y destino, luego ingresa las cantidades a transferir para cada producto.
      </div>
      
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <label>Bodega Origen:</label>
            <select
              value={fromLocation}
              onChange={(e) => setFromLocation(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              required
            >
              <option value="">Selecciona origen...</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          
          <div style={{ flex: 1 }}>
            <label>Bodega Destino:</label>
            <select
              value={toLocation}
              onChange={(e) => setToLocation(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              required
            >
              <option value="">Selecciona destino...</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>

        {fromLocation && products.length === 0 && (
          <div style={{ 
            backgroundColor: '#f8d7da', 
            padding: '20px', 
            borderRadius: '5px',
            textAlign: 'center',
            color: '#721c24'
          }}>
            No hay productos con stock en esta ubicación.
          </div>
        )}

        {fromLocation && products.length > 0 && (
          <>
            <h3>Productos disponibles en {locations.find(l => l.id === fromLocation)?.name}:</h3>
            
            <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th>Producto</th>
                  <th>Stock Actual</th>
                  <th>Cantidad a Transferir</th>
                 </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{product.stock}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max={product.stock}
                        value={quantities[product.id] || 0}
                        onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                        style={{ width: '120px', padding: '5px' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: '#ff9800',
                color: 'white',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '5px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                fontSize: '16px'
              }}
            >
              {loading ? 'Procesando...' : '🚚 Realizar Transferencia Masiva'}
            </button>
          </>
        )}

        {message && (
          <div style={{
            marginTop: '20px',
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
