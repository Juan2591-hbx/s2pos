import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Transfer() {
  const [locations, setLocations] = useState([])
  const [sourceLocations, setSourceLocations] = useState([])  // Pueden enviar
  const [targetLocations, setTargetLocations] = useState([])  // Pueden recibir
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
      const { data: allLocs } = await supabase
        .from('locations')
        .select('id, name, type')
        .order('name')

      setLocations(allLocs || [])

      // Pueden ENVIAR: warehouse y hybrid (POS NO)
      const sources = (allLocs || []).filter(
        loc => loc.type === 'warehouse' || loc.type === 'hybrid'
      )
      setSourceLocations(sources)

      // Pueden RECIBIR: todos (warehouse, hybrid, pos)
      // Pero si es POS, solo puede recibir, no enviar
      setTargetLocations(allLocs || [])

    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Error cargando ubicaciones' })
    } finally {
      setLoadingData(false)
    }
  }

  async function loadProducts(locationId) {
    if (!locationId) return

    try {
      const { data: inventory } = await supabase
        .from('inventory_totals')
        .select(`
          product_id,
          total_stock,
          products (id, name)
        `)
        .eq('location_id', locationId)
        .gt('total_stock', 0)

      if (inventory) {
        const productsList = inventory.map(item => ({
          id: item.product_id,
          name: item.products?.name || item.product_id,
          stock: item.total_stock
        }))
        setProducts(productsList)
        
        const initialQtys = {}
        productsList.forEach(p => { initialQtys[p.id] = 0 })
        setQuantities(initialQtys)
      } else {
        setProducts([])
        setQuantities({})
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Error cargando productos' })
    }
  }

  const handleFromLocationChange = (locationId) => {
    setFromLocation(locationId)
    setToLocation('')
    loadProducts(locationId)
  }

  const handleQuantityChange = (productId, value) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: parseInt(value) || 0
    }))
  }

  const getLocationIcon = (type) => {
    switch(type) {
      case 'warehouse': return '🏭'
      case 'hybrid': return '🔄'
      case 'pos': return '🏪'
      default: return '📍'
    }
  }

  const getLocationDescription = (type) => {
    switch(type) {
      case 'warehouse': return 'Bodega (envía y recibe)'
      case 'hybrid': return 'Híbrido (envía, recibe y vende)'
      case 'pos': return 'Punto de Venta (solo recibe y vende)'
      default: return ''
    }
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

    const fromLoc = locations.find(l => l.id === fromLocation)
    const toLoc = locations.find(l => l.id === toLocation)

    // Validar que origen pueda enviar (warehouse o hybrid)
    if (fromLoc.type === 'pos') {
      setMessage({ 
        type: 'error', 
        text: '❌ Los puntos de venta (POS) no pueden realizar transferencias. Solo pueden recibir productos.' 
      })
      setLoading(false)
      return
    }

    // POS puede recibir, así que no hay restricción para destino

    const transfers = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => ({ productId, qty }))

    if (transfers.length === 0) {
      setMessage({ type: 'error', text: 'No hay productos con cantidad a transferir' })
      setLoading(false)
      return
    }

    const fromName = fromLoc.name
    const toName = toLoc.name

    try {
      for (const { productId, qty } of transfers) {
        // Salida del origen
        const { error: errorOut } = await supabase
          .from('inventory_movements')
          .insert([{
            product_id: productId,
            location_id: fromLocation,
            quantity: -qty,
            movement_type: 'transfer_out',
            notes: `Transferencia a ${toName} (${fromLoc.type} → ${toLoc.type})`
          }])

        if (errorOut) throw errorOut

        // Entrada al destino
        const { error: errorIn } = await supabase
          .from('inventory_movements')
          .insert([{
            product_id: productId,
            location_id: toLocation,
            quantity: qty,
            movement_type: 'transfer_in',
            notes: `Transferencia desde ${fromName} (${fromLoc.type} → ${toLoc.type})`
          }])

        if (errorIn) throw errorIn
      }

      setMessage({ 
        type: 'success', 
        text: `✅ Transferencia completada: ${transfers.length} productos transferidos de ${fromName} (${fromLoc.type}) a ${toName} (${toLoc.type})` 
      })
      
      const resetQtys = {}
      products.forEach(p => { resetQtys[p.id] = 0 })
      setQuantities(resetQtys)
      loadProducts(fromLocation)
      
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
        <h1>🚚 Transferencia de Inventario</h1>
        <p>Cargando datos...</p>
      </div>
    )
  }

  const fromLocInfo = locations.find(l => l.id === fromLocation)
  const toLocInfo = locations.find(l => l.id === toLocation)

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>🚚 Transferencia de Inventario</h1>
      
      <div style={{ 
        backgroundColor: '#fff3e0', 
        padding: '12px', 
        borderRadius: '5px', 
        marginBottom: '20px',
        borderLeft: '4px solid #ff9800'
      }}>
        💡 <strong>Reglas:</strong><br/>
        • 🏭 Warehouse y 🔄 Hybrid pueden <strong>ENVIAR</strong> productos<br/>
        • Todos (Warehouse, Hybrid, POS) pueden <strong>RECIBIR</strong> productos<br/>
        • 🏪 POS solo pueden recibir (no pueden enviar)
      </div>
      
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <label>Origen (envía):</label>
            <select
              value={fromLocation}
              onChange={(e) => handleFromLocationChange(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              required
            >
              <option value="">Selecciona origen...</option>
              {sourceLocations.map(l => (
                <option key={l.id} value={l.id}>
                  {getLocationIcon(l.type)} {l.name} ({l.type})
                </option>
              ))}
            </select>
            {fromLocInfo && (
              <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                {getLocationDescription(fromLocInfo.type)}
              </p>
            )}
          </div>
          
          <div style={{ flex: 1 }}>
            <label>Destino (recibe):</label>
            <select
              value={toLocation}
              onChange={(e) => setToLocation(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              required
              disabled={!fromLocation}
            >
              <option value="">Selecciona destino...</option>
              {targetLocations
                .filter(l => l.id !== fromLocation)
                .map(l => (
                  <option key={l.id} value={l.id}>
                    {getLocationIcon(l.type)} {l.name} ({l.type})
                  </option>
                ))
              }
            </select>
            {toLocInfo && (
              <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                {getLocationDescription(toLocInfo.type)}
              </p>
            )}
          </div>
        </div>

        {fromLocation && fromLocInfo && (
          <div style={{ 
            backgroundColor: '#e3f2fd', 
            padding: '8px 12px', 
            borderRadius: '5px', 
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            📍 <strong>Desde {fromLocInfo.name}</strong> ({fromLocInfo.type}) 
            {fromLocInfo.type === 'warehouse' && ' → Puede enviar a cualquier ubicación'}
            {fromLocInfo.type === 'hybrid' && ' → Puede enviar a cualquier ubicación'}
            {toLocInfo && ` → Hacia ${toLocInfo.name} (${toLocInfo.type})`}
          </div>
        )}

        {fromLocation && products.length === 0 && (
          <div style={{ 
            backgroundColor: '#f8d7da', 
            padding: '20px', 
            borderRadius: '5px',
            textAlign: 'center',
            color: '#721c24'
          }}>
            No hay productos con stock disponible en {fromLocInfo?.name}.
          </div>
        )}

        {fromLocation && products.length > 0 && (
          <>
            <h3>Productos disponibles en {fromLocInfo?.name}:</h3>
            
            <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th>Producto</th>
                  <th>Stock Actual</th>
                  <th>Cantidad a Transferir</th>
                  <th>Destino</th>
                  <th>Tipo Destino</th>
                 </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.id}>
                     <td>{product.name}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{product.stock}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        max={product.stock}
                        value={quantities[product.id] || 0}
                        onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                        style={{ width: '100px', padding: '5px' }}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {toLocInfo ? toLocInfo.name : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {toLocInfo && (
                        <span style={{ 
                          backgroundColor: toLocInfo.type === 'pos' ? '#ff9800' : '#4caf50',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px'
                        }}>
                          {toLocInfo.type}
                        </span>
                      )}
                    </td>
                   </tr>
                ))}
              </tbody>
            </table>
            
            <button
              type="submit"
              disabled={loading || !toLocation}
              style={{
                backgroundColor: '#ff9800',
                color: 'white',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '5px',
                cursor: (loading || !toLocation) ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                fontSize: '16px'
              }}
            >
              {loading ? 'Procesando...' : '🚚 Realizar Transferencia'}
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
