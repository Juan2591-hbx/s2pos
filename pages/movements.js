import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default function Movements() {
  const [locations, setLocations] = useState([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedLocationType, setSelectedLocationType] = useState('')
  const [products, setProducts] = useState([])
  const [quantities, setQuantities] = useState({})
  const [movementType, setMovementType] = useState('adjustment')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [message, setMessage] = useState(null)

  // Tipos base para todos (POS puede hacer estos)
  const baseMovementTypes = [
    { type: 'adjustment', description: '✏️ Ajuste (corrección)', effect: '🔄' },
    { type: 'employee', description: '👥 Empleado (resta stock)', effect: '➖' },
    { type: 'promo', description: '🎁 Promoción (resta stock)', effect: '➖' },
    { type: 'expired', description: '⏰ Vencido (resta stock)', effect: '➖' },
    { type: 'damaged', description: '🔨 Dañado (resta stock)', effect: '➖' },
    { type: 'transfer_in', description: '🚚 Transferencia Entrada (suma stock)', effect: '➕' }
  ]

  // Tipos adicionales solo para warehouse/hybrid
  const warehouseTypes = [
    { type: 'restock', description: '📦 Reabastecimiento (suma stock)', effect: '➕' },
    { type: 'transfer_out', description: '📤 Transferencia Salida (resta stock)', effect: '➖' }
  ]

  const [movementTypes, setMovementTypes] = useState(baseMovementTypes)

  useEffect(() => {
    fetchLocationsAndProducts()
  }, [])

  // Actualizar tipos de movimiento cuando cambia la ubicación seleccionada
  useEffect(() => {
    if (selectedLocationType === 'warehouse' || selectedLocationType === 'hybrid') {
      setMovementTypes([...baseMovementTypes, ...warehouseTypes])
      // Si el tipo actual no está disponible, resetear a adjustment
      const currentTypeAvailable = [...baseMovementTypes, ...warehouseTypes].some(t => t.type === movementType)
      if (!currentTypeAvailable) {
        setMovementType('adjustment')
      }
    } else {
      setMovementTypes(baseMovementTypes)
      // Si el tipo actual no está disponible, resetear a adjustment
      const currentTypeAvailable = baseMovementTypes.some(t => t.type === movementType)
      if (!currentTypeAvailable) {
        setMovementType('adjustment')
      }
    }
  }, [selectedLocationType])

  async function fetchLocationsAndProducts() {
    try {
      // Cargar todas las ubicaciones (incluyendo POS)
      const { data: locs } = await supabase
        .from('locations')
        .select('id, name, type')
        .order('name')

      setLocations(locs || [])
      if (locs && locs.length > 0) {
        setSelectedLocation(locs[0].id)
        setSelectedLocationType(locs[0].type)
      }

      // Cargar todos los productos
      const { data: prods } = await supabase
        .from('products')
        .select('id, name')
        .order('name')

      setProducts(prods || [])
      
      // Inicializar cantidades en 0
      const initialQtys = {}
      prods?.forEach(p => { initialQtys[p.id] = 0 })
      setQuantities(initialQtys)
    } catch (err) {
      console.error('Error cargando datos:', err)
      setMessage({ type: 'error', text: 'Error cargando productos y ubicaciones' })
    } finally {
      setLoadingData(false)
    }
  }

  const [stockMap, setStockMap] = useState({})
  
  useEffect(() => {
    if (selectedLocation) {
      fetchStockForLocation()
    }
  }, [selectedLocation])

  async function fetchStockForLocation() {
    try {
      const { data: inventory } = await supabase
        .from('inventory_totals')
        .select('product_id, total_stock')
        .eq('location_id', selectedLocation)

      const map = {}
      inventory?.forEach(item => {
        map[item.product_id] = item.total_stock
      })
      setStockMap(map)
    } catch (err) {
      console.error('Error cargando stock:', err)
    }
  }

  const handleQuantityChange = (productId, value) => {
    const qty = parseInt(value) || 0
    setQuantities(prev => ({
      ...prev,
      [productId]: qty
    }))
  }

  const isExitMovement = (type) => {
    return ['employee', 'promo', 'expired', 'damaged', 'transfer_out'].includes(type)
  }

  const isEntryMovement = (type) => {
    return ['restock', 'transfer_in'].includes(type)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (!selectedLocation) {
      setMessage({ type: 'error', text: 'Selecciona una ubicación' })
      setLoading(false)
      return
    }

    const movementsToRegister = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => ({ productId, qty }))

    if (movementsToRegister.length === 0) {
      setMessage({ type: 'error', text: 'No hay productos con cantidad a registrar' })
      setLoading(false)
      return
    }

    // Validar stock para movimientos de salida
    const errors = []
    for (const { productId, qty } of movementsToRegister) {
      if (isExitMovement(movementType)) {
        const currentStock = stockMap[productId] || 0
        if (qty > currentStock) {
          const productName = products.find(p => p.id === productId)?.name
          errors.push(`${productName}: stock actual ${currentStock}, no puedes restar ${qty}`)
        }
      }
    }

    if (errors.length > 0) {
      setMessage({ type: 'error', text: `❌ Error de stock:\n${errors.join('\n')}` })
      setLoading(false)
      return
    }

    const locationName = locations.find(l => l.id === selectedLocation)?.name
    const movementInfo = movementTypes.find(t => t.type === movementType)

    try {
      for (const { productId, qty } of movementsToRegister) {
        let finalQuantity = qty
        if (movementType === 'adjustment') {
          finalQuantity = qty
        } else if (isExitMovement(movementType)) {
          finalQuantity = -qty
        } else if (isEntryMovement(movementType)) {
          finalQuantity = qty
        }

        const { error } = await supabase
          .from('inventory_movements')
          .insert([{
            product_id: productId,
            location_id: selectedLocation,
            quantity: finalQuantity,
            movement_type: movementType,
            notes: notes || `Movimiento masivo: ${movementInfo?.description}`
          }])

        if (error) throw error
      }

      const productCount = movementsToRegister.length
      const totalUnits = movementsToRegister.reduce((sum, { qty }) => sum + qty, 0)
      
      setMessage({ 
        type: 'success', 
        text: `✅ Movimiento masivo registrado: ${productCount} productos, ${totalUnits} unidades totales en ${locationName}` 
      })
      
      const resetQtys = {}
      products.forEach(p => { resetQtys[p.id] = 0 })
      setQuantities(resetQtys)
      setNotes('')
      fetchStockForLocation()
      
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: `❌ Error: ${err.message}` })
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
        <h1>📝 Movimiento Masivo</h1>
        <p>Cargando datos...</p>
      </div>
    )
  }

  const selectedLocationName = locations.find(l => l.id === selectedLocation)?.name
  const selectedLocationTypeLabel = locations.find(l => l.id === selectedLocation)?.type

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

      <h1>📝 Movimiento Masivo</h1>
      
      <div style={{ 
        backgroundColor: '#e3f2fd', 
        padding: '12px', 
        borderRadius: '5px', 
        marginBottom: '20px',
        borderLeft: '4px solid #2196f3'
      }}>
        💡 Registra múltiples productos en un solo movimiento. Solo ingresa cantidades en los productos que deseas afectar.
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ 
          backgroundColor: '#f5f5f5', 
          padding: '15px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '20px',
          alignItems: 'flex-end'
        }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>📍 Ubicación:</label>
            <select
              value={selectedLocation}
              onChange={(e) => {
                setSelectedLocation(e.target.value)
                const loc = locations.find(l => l.id === e.target.value)
                setSelectedLocationType(loc?.type || '')
              }}
              style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
              required
            >
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
              ))}
            </select>
          </div>
          
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>🔍 Tipo de Movimiento:</label>
            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
              required
            >
              {movementTypes.map(type => (
                <option key={type.type} value={type.type}>
                  {type.effect} {type.description}
                </option>
              ))}
            </select>
          </div>
          
          <div style={{ flex: 2, minWidth: '250px' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>📝 Nota general (opcional):</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Compra mensual, Ajuste de inventario, etc."
              style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
            />
          </div>
        </div>

        <h3>Productos</h3>
        
        <div style={{ maxHeight: '500px', overflowY: 'auto', marginBottom: '20px' }}>
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0', position: 'sticky', top: 0 }}>
                <th>Producto</th>
                <th>Stock Actual</th>
                <th>Cantidad a Registrar</th>
                <th>Efecto</th>
                </tr>
            </thead>
            <tbody>
              {products.map(product => {
                const currentStock = stockMap[product.id] || 0
                const qty = quantities[product.id] || 0
                const isExit = isExitMovement(movementType)
                const isEntry = isEntryMovement(movementType)
                const isAdjustment = movementType === 'adjustment'
                
                let effectColor = '#666'
                let effectText = ''
                if (isExit || (isAdjustment && qty > 0 && qty > currentStock)) {
                  effectColor = '#f44336'
                  effectText = '➖ Resta stock'
                } else if (isEntry || (isAdjustment && qty > 0)) {
                  effectColor = '#4caf50'
                  effectText = '➕ Suma stock'
                } else if (isAdjustment && qty > currentStock) {
                  effectColor = '#ff9800'
                  effectText = '⚠️ Excede stock'
                } else if (qty === 0) {
                  effectText = '—'
                }
                
                return (
                  <tr key={product.id} style={{ backgroundColor: qty > 0 ? '#f9f9f9' : 'white' }}>
                    <td><strong>{product.name}</strong></td>
                    <td style={{ textAlign: 'center' }}>{currentStock}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        value={qty}
                        onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                        style={{ width: '100px', padding: '5px', textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ textAlign: 'center', color: effectColor, fontWeight: 'bold' }}>
                      {effectText}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {Object.values(quantities).some(q => q > 0) && (
          <div style={{ 
            backgroundColor: '#f5f5f5', 
            padding: '15px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div>
              <strong>📊 Resumen:</strong>{' '}
              {Object.entries(quantities).filter(([_, q]) => q > 0).length} productos |{' '}
              {Object.values(quantities).reduce((sum, q) => sum + q, 0)} unidades totales
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
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              {loading ? 'Registrando...' : '📤 Registrar Movimiento Masivo'}
            </button>
          </div>
        )}

        {message && (
          <div style={{
            marginTop: '15px',
            padding: '10px',
            backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
            color: message.type === 'success' ? '#155724' : '#721c24',
            borderRadius: '5px',
            whiteSpace: 'pre-line'
          }}>
            {message.text}
          </div>
        )}
      </form>
    </div>
  )
}
