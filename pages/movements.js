import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default function Movements() {
  const [locations, setLocations] = useState([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedLocationType, setSelectedLocationType] = useState('')
  const [products, setProducts] = useState([])
  const [quantities, setQuantities] = useState({})
  const [batchNumbers, setBatchNumbers] = useState({})
  const [expirationDates, setExpirationDates] = useState({})
  const [movementType, setMovementType] = useState('restock')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [message, setMessage] = useState(null)

  const typesRequiringBatch = ['restock']

  const baseMovementTypes = [
    { type: 'adjustment_pos', description: '✏️ Ajuste Positivo (suma stock)', effect: '➕' },
    { type: 'adjustment_neg', description: '✏️ Ajuste Negativo (resta stock)', effect: '➖' },
    { type: 'employee', description: '👥 Empleado (resta stock)', effect: '➖' },
    { type: 'promo', description: '🎁 Promoción (resta stock)', effect: '➖' },
    { type: 'expired', description: '⏰ Vencido (resta stock)', effect: '➖' },
    { type: 'damaged', description: '🔨 Dañado (resta stock)', effect: '➖' }
  ]

  const warehouseTypes = [
    { type: 'restock', description: '📦 Reabastecimiento (suma stock)', effect: '➕' }
  ]

  const [movementTypes, setMovementTypes] = useState(baseMovementTypes)

  useEffect(() => {
    fetchLocationsAndProducts()
  }, [])

  useEffect(() => {
    if (selectedLocationType === 'warehouse' || selectedLocationType === 'hybrid') {
      setMovementTypes([...baseMovementTypes, ...warehouseTypes])
      const currentTypeAvailable = [...baseMovementTypes, ...warehouseTypes].some(t => t.type === movementType)
      if (!currentTypeAvailable) {
        setMovementType('restock')
      }
    } else {
      setMovementTypes(baseMovementTypes)
      const currentTypeAvailable = baseMovementTypes.some(t => t.type === movementType)
      if (!currentTypeAvailable) {
        setMovementType('adjustment_pos')
      }
    }
  }, [selectedLocationType])

  async function fetchLocationsAndProducts() {
    try {
      const { data: locs } = await supabase
        .from('locations')
        .select('id, name, type')
        .order('name')

      setLocations(locs || [])
      if (locs && locs.length > 0) {
        setSelectedLocation(locs[0].id)
        setSelectedLocationType(locs[0].type)
      }

      const { data: prods } = await supabase
        .from('products')
        .select('id, name')
        .order('name')

      setProducts(prods || [])
      
      const initialQtys = {}
      const initialBatches = {}
      const initialDates = {}
      prods?.forEach(p => { 
        initialQtys[p.id] = 0
        initialBatches[p.id] = ''
        initialDates[p.id] = ''
      })
      setQuantities(initialQtys)
      setBatchNumbers(initialBatches)
      setExpirationDates(initialDates)
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
    setQuantities(prev => ({ ...prev, [productId]: qty }))
  }

  const handleBatchChange = (productId, value) => {
    setBatchNumbers(prev => ({ ...prev, [productId]: value }))
  }

  const handleExpirationChange = (productId, value) => {
    setExpirationDates(prev => ({ ...prev, [productId]: value }))
  }

  const isExitMovement = (type) => {
    return ['adjustment_neg', 'employee', 'promo', 'expired', 'damaged'].includes(type)
  }

  const isEntryMovement = (type) => {
    return ['adjustment_pos', 'restock'].includes(type)
  }

  const requiresBatch = (type) => {
    return typesRequiringBatch.includes(type)
  }

  const getEffectText = (type, qty, currentStock) => {
    if (qty === 0) return '—'
    
    if (type === 'adjustment_pos') return '➕ Suma stock'
    if (type === 'adjustment_neg') {
      if (qty > currentStock) return '⚠️ Excede stock'
      return '➖ Resta stock'
    }
    if (isExitMovement(type)) {
      if (qty > currentStock) return '⚠️ Excede stock'
      return '➖ Resta stock'
    }
    if (isEntryMovement(type)) return '➕ Suma stock'
    return '—'
  }

  const getEffectColor = (type, qty, currentStock) => {
    if (qty === 0) return '#666'
    if (type === 'adjustment_pos') return '#4caf50'
    if (type === 'adjustment_neg') {
      if (qty > currentStock) return '#ff9800'
      return '#f44336'
    }
    if (isExitMovement(type)) {
      if (qty > currentStock) return '#ff9800'
      return '#f44336'
    }
    if (isEntryMovement(type)) return '#4caf50'
    return '#666'
  }

  const validateForm = () => {
    const entries = Object.entries(quantities).filter(([_, qty]) => qty > 0)
    
    if (entries.length === 0) {
      setMessage({ type: 'error', text: 'No hay productos con cantidad a registrar' })
      return false
    }

    if (requiresBatch(movementType)) {
      for (const [productId, qty] of entries) {
        const batch = batchNumbers[productId]
        const expiration = expirationDates[productId]
        
        if (!batch || batch.trim() === '') {
          const productName = products.find(p => p.id === productId)?.name
          setMessage({ type: 'error', text: `❌ El producto "${productName}" requiere un número de lote` })
          return false
        }
        
        if (!expiration) {
          const productName = products.find(p => p.id === productId)?.name
          setMessage({ type: 'error', text: `❌ El producto "${productName}" requiere una fecha de caducidad` })
          return false
        }
      }
    }

    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (loading) return
    
    setLoading(true)
    setMessage(null)

    if (!selectedLocation) {
      setMessage({ type: 'error', text: 'Selecciona una ubicación' })
      setLoading(false)
      return
    }

    if (!validateForm()) {
      setLoading(false)
      return
    }

    const movementsToRegister = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => ({ productId, qty }))

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
        
        if (movementType === 'adjustment_pos') {
          finalQuantity = qty
        } else if (movementType === 'adjustment_neg') {
          finalQuantity = -qty
        } else if (isExitMovement(movementType)) {
          finalQuantity = -qty
        } else if (isEntryMovement(movementType)) {
          finalQuantity = qty
        }

        let movementNotes = notes || `Movimiento masivo: ${movementInfo?.description}`
        
        if (requiresBatch(movementType)) {
          const lotNumber = batchNumbers[productId]
          const expirationDate = expirationDates[productId]
          movementNotes += ` | Lote: ${lotNumber} | Caducidad: ${expirationDate}`
        }

        // Solo insertar en inventory_movements
        // El trigger trigger_manual_inventory_movement se encarga de actualizar inventory_batches y inventory_totals
        const { error } = await supabase
          .from('inventory_movements')
          .insert([{
            product_id: productId,
            location_id: selectedLocation,
            quantity: finalQuantity,
            movement_type: movementType,
            notes: movementNotes
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
        💡 Registra múltiples productos en un solo movimiento. {requiresBatch(movementType) && 'Los reabastecimientos requieren número de lote y fecha de caducidad.'}
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
          
          <div style={{ flex: 1, minWidth: '220px' }}>
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
                {requiresBatch(movementType) && (
                  <>
                    <th>N° Lote</th>
                    <th>Fecha Caducidad</th>
                  </>
                )}
                <th>Cantidad</th>
                <th>Efecto</th>
               </thead>
            </thead>
            <tbody>
              {products.map(product => {
                const currentStock = stockMap[product.id] || 0
                const qty = quantities[product.id] || 0
                const effectText = getEffectText(movementType, qty, currentStock)
                const effectColor = getEffectColor(movementType, qty, currentStock)
                
                return (
                  <tr key={product.id} style={{ backgroundColor: qty > 0 ? '#f9f9f9' : 'white' }}>
                    <td><strong>{product.name}</strong>蹲
                    <td style={{ textAlign: 'center' }}>{currentStock}蹲
                    {requiresBatch(movementType) && (
                      <>
                        <td>
                          <input
                            type="text"
                            value={batchNumbers[product.id] || ''}
                            onChange={(e) => handleBatchChange(product.id, e.target.value)}
                            placeholder="Ej: LOTE-001"
                            style={{ width: '120px', padding: '5px' }}
                          />
                        蹲
                        <td>
                          <input
                            type="date"
                            value={expirationDates[product.id] || ''}
                            onChange={(e) => handleExpirationChange(product.id, e.target.value)}
                            style={{ width: '130px', padding: '5px' }}
                          />
                        蹲
                      </>
                    )}
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        value={qty}
                        onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                        style={{ width: '100px', padding: '5px', textAlign: 'center' }}
                      />
                    蹲
                    <td style={{ textAlign: 'center', color: effectColor, fontWeight: 'bold' }}>
                      {effectText}
                    蹲
                  蹲
                )
              })}
            </tbody>
          窗口
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
