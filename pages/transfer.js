import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default function Transfer() {
  const [locations, setLocations] = useState([])
  const [sourceLocations, setSourceLocations] = useState([])
  const [products, setProducts] = useState([])
  const [fromLocation, setFromLocation] = useState('')
  const [toLocation, setToLocation] = useState('')
  const [quantities, setQuantities] = useState({})
  const [batchNumbers, setBatchNumbers] = useState({})
  const [expirationDates, setExpirationDates] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (fromLocation) {
      loadProducts()
    }
  }, [fromLocation])

  async function fetchData() {
    try {
      const { data: allLocs } = await supabase
        .from('locations')
        .select('id, name, type')
        .order('name')

      setLocations(allLocs || [])
      const sources = (allLocs || []).filter(
        loc => loc.type === 'warehouse' || loc.type === 'hybrid'
      )
      setSourceLocations(sources)
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Error cargando ubicaciones' })
    } finally {
      setLoadingData(false)
    }
  }

  async function loadProducts() {
    if (!fromLocation) return

    try {
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
        
        const initialQtys = {}
        const initialBatches = {}
        const initialDates = {}
        productsList.forEach(p => {
          initialQtys[p.id] = 0
          initialBatches[p.id] = ''
          initialDates[p.id] = ''
        })
        setQuantities(initialQtys)
        setBatchNumbers(initialBatches)
        setExpirationDates(initialDates)
      } else {
        setProducts([])
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Error cargando productos' })
    }
  }

  const handleFromLocationChange = (locationId) => {
    setFromLocation(locationId)
    setToLocation('')
    setProducts([])
  }

  const handleQuantityChange = (productId, value) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: parseInt(value) || 0
    }))
  }

  const handleBatchChange = (productId, value) => {
    setBatchNumbers(prev => ({
      ...prev,
      [productId]: value
    }))
  }

  const handleExpirationChange = (productId, value) => {
    setExpirationDates(prev => ({
      ...prev,
      [productId]: value
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (loading) return
    
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

    if (fromLoc.type === 'pos') {
      setMessage({ type: 'error', text: 'Los puntos de venta (POS) no pueden realizar transferencias' })
      setLoading(false)
      return
    }

    const transfers = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => ({ productId, qty }))

    if (transfers.length === 0) {
      setMessage({ type: 'error', text: 'No hay productos con cantidad a transferir' })
      setLoading(false)
      return
    }

    for (const { productId, qty } of transfers) {
      const batch = batchNumbers[productId]
      const expiration = expirationDates[productId]
      
      if (!batch || batch.trim() === '') {
        const product = products.find(p => p.id === productId)
        setMessage({ type: 'error', text: `El producto "${product?.name}" requiere un número de lote` })
        setLoading(false)
        return
      }
      
      if (!expiration) {
        const product = products.find(p => p.id === productId)
        setMessage({ type: 'error', text: `El producto "${product?.name}" requiere una fecha de caducidad` })
        setLoading(false)
        return
      }
    }

    const fromName = fromLoc.name
    const toName = toLoc.name

    try {
      for (const { productId, qty } of transfers) {
        // DEFINIR LAS VARIABLES AQUÍ
        const batchNumber = batchNumbers[productId]
        const expirationDate = expirationDates[productId]
        
        // TRANSFER_OUT (salida) - solo nota
        const { error: errorOut } = await supabase
          .from('inventory_movements')
          .insert([{
            product_id: productId,
            location_id: fromLocation,
            quantity: -qty,
            movement_type: 'transfer_out',
            notes: `Transferencia a ${toName} | Lote: ${batchNumber} | Caducidad: ${expirationDate}`
          }])

        if (errorOut) throw errorOut

        // TRANSFER_IN (entrada) - con lot_number y expiration_date
        const { error: errorIn } = await supabase
          .from('inventory_movements')
          .insert([{
            product_id: productId,
            location_id: toLocation,
            quantity: qty,
            movement_type: 'transfer_in',
            lot_number: batchNumber,
            expiration_date: expirationDate,
            notes: `Transferencia desde ${fromName} | Lote: ${batchNumber} | Caducidad: ${expirationDate}`
          }])

        if (errorIn) throw errorIn
      }

      setMessage({ 
        type: 'success', 
        text: `Transferencia completada: ${transfers.length} productos transferidos de ${fromName} a ${toName}` 
      })
      
      const resetQtys = {}
      const resetBatches = {}
      const resetDates = {}
      products.forEach(p => {
        resetQtys[p.id] = 0
        resetBatches[p.id] = ''
        resetDates[p.id] = ''
      })
      setQuantities(resetQtys)
      setBatchNumbers(resetBatches)
      setExpirationDates(resetDates)
      loadProducts()
      
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: `Error en transferencia: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <Link href="/inventory" style={{ 
            backgroundColor: '#0070f3', 
            color: 'white', 
            padding: '8px 16px', 
            borderRadius: '5px', 
            textDecoration: 'none',
            fontSize: '14px'
          }}>
            ← Ver Inventario
          </Link>
          <Link href="/" style={{ 
            backgroundColor: '#0070f3', 
            color: 'white', 
            padding: '8px 16px', 
            borderRadius: '5px', 
            textDecoration: 'none',
            fontSize: '14px'
          }}>
            Dashboard →
          </Link>
        </div>
        <h1>🚚 Transferencia entre Bodegas</h1>
        <p>Cargando datos...</p>
      </div>
    )
  }

  const fromLocInfo = locations.find(l => l.id === fromLocation)
  const toLocInfo = locations.find(l => l.id === toLocation)

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Link href="/inventory" style={{ 
          backgroundColor: '#0070f3', 
          color: 'white', 
          padding: '8px 16px', 
          borderRadius: '5px', 
          textDecoration: 'none',
          fontSize: '14px'
        }}>
          ← Ver Inventario
        </Link>
        <Link href="/" style={{ 
          backgroundColor: '#0070f3', 
          color: 'white', 
          padding: '8px 16px', 
          borderRadius: '5px', 
          textDecoration: 'none',
          fontSize: '14px'
        }}>
          Dashboard →
        </Link>
      </div>

      <h1>🚚 Transferencia entre Bodegas</h1>
      
      <div style={{ 
        backgroundColor: '#fff3e0', 
        padding: '12px', 
        borderRadius: '5px', 
        marginBottom: '20px',
        borderLeft: '4px solid #ff9800'
      }}>
        💡 Las transferencias requieren número de lote y fecha de caducidad para cada producto.
      </div>
      
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <label>Bodega Origen (envía):</label>
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
          </div>
          
          <div style={{ flex: 1 }}>
            <label>Bodega Destino (recibe):</label>
            <select
              value={toLocation}
              onChange={(e) => setToLocation(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              required
              disabled={!fromLocation}
            >
              <option value="">Selecciona destino...</option>
              {locations
                .filter(l => l.id !== fromLocation)
                .map(l => (
                  <option key={l.id} value={l.id}>
                    {getLocationIcon(l.type)} {l.name} ({l.type})
                  </option>
                ))
              }
            </select>
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
            
            <div style={{ maxHeight: '500px', overflowY: 'auto', marginBottom: '20px' }}>
              <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f0f0', position: 'sticky', top: 0 }}>
                    <th>Producto</th>
                    <th>Stock Actual</th>
                    <th>N° Lote</th>
                    <th>Fecha Caducidad</th>
                    <th>Cantidad a Transferir</th>
                    <th>Destino</th>
                   </thead>
                </thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product.id}>
                      <td><strong>{product.name}</strong></td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{product.stock}</td>
                      <td>
                        <input
                          type="text"
                          value={batchNumbers[product.id] || ''}
                          onChange={(e) => handleBatchChange(product.id, e.target.value)}
                          placeholder="Ej: LOTE-001"
                          style={{ width: '120px', padding: '5px' }}
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={expirationDates[product.id] || ''}
                          onChange={(e) => handleExpirationChange(product.id, e.target.value)}
                          style={{ width: '130px', padding: '5px' }}
                          required
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          max={product.stock}
                          value={quantities[product.id] || 0}
                          onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                          style={{ width: '100px', padding: '5px', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {toLocInfo ? `${getLocationIcon(toLocInfo.type)} ${toLocInfo.name}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
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
    </div>
  )
}
