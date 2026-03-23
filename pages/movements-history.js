import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function MovementsHistory() {
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all') // all, sale, restock, etc.

  useEffect(() => {
    fetchMovements()
  }, [])

  async function fetchMovements() {
    setLoading(true)
    try {
      // Traer movimientos con nombres de productos y ubicaciones
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`
          id,
          quantity,
          movement_type,
          notes,
          created_at,
          product_id,
          location_id,
          products (name),
          locations (name)
        `)
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) throw error
      setMovements(data || [])
    } catch (err) {
      console.error('Error cargando movimientos:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getMovementIcon = (type) => {
    switch(type) {
      case 'sale': return '💰'
      case 'restock': return '📦'
      case 'employee': return '👥'
      case 'promo': return '🎁'
      case 'expired': return '⏰'
      case 'damaged': return '🔨'
      case 'adjustment': return '✏️'
      case 'transfer_in': return '🚚⬅️'
      case 'transfer_out': return '🚚➡️'
      default: return '📋'
    }
  }

  const getMovementColor = (type, quantity) => {
    // Por tipo de movimiento
    if (type === 'sale' || type === 'employee' || type === 'promo' || 
        type === 'expired' || type === 'damaged' || type === 'transfer_out') {
      return '#f44336' // Rojo (salidas)
    }
    if (type === 'restock' || type === 'transfer_in') {
      return '#4caf50' // Verde (entradas)
    }
    return '#ff9800' // Naranja (ajustes)
  }

  const getQuantityDisplay = (quantity, type) => {
    const absQty = Math.abs(quantity)
    
    // Determinar si es entrada o salida
    const isEntry = (type === 'restock' || type === 'transfer_in')
    const isExit = (type === 'sale' || type === 'employee' || type === 'promo' || 
                    type === 'expired' || type === 'damaged' || type === 'transfer_out')
    
    if (isEntry || (type === 'adjustment' && quantity > 0)) {
      return `+ ${absQty}`
    }
    if (isExit || (type === 'adjustment' && quantity < 0)) {
      return `- ${absQty}`
    }
    return `${quantity}`
  }

  const filteredMovements = filter === 'all' 
    ? movements 
    : movements.filter(m => m.movement_type === filter)

  const movementTypes = [
    { value: 'all', label: '📋 Todos' },
    { value: 'sale', label: '💰 Ventas' },
    { value: 'restock', label: '📦 Reabastecimientos' },
    { value: 'employee', label: '👥 Empleados' },
    { value: 'promo', label: '🎁 Promociones' },
    { value: 'transfer_in', label: '🚚 Transferencias (entrada)' },
    { value: 'transfer_out', label: '🚚 Transferencias (salida)' },
    { value: 'adjustment', label: '✏️ Ajustes' },
    { value: 'expired', label: '⏰ Vencidos' },
    { value: 'damaged', label: '🔨 Dañados' }
  ]

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>📜 Historial de Movimientos</h1>
        <p>Cargando historial...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>📜 Historial de Movimientos</h1>
        <div style={{ color: 'red', border: '1px solid red', padding: '10px', borderRadius: '5px' }}>
          <strong>Error:</strong> {error}
        </div>
        <button onClick={fetchMovements} style={{ marginTop: '10px', padding: '8px 12px', cursor: 'pointer' }}>
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>📜 Historial de Movimientos</h1>
      
      <div style={{ 
        backgroundColor: '#e3f2fd', 
        padding: '12px', 
        borderRadius: '5px', 
        marginBottom: '20px',
        borderLeft: '4px solid #2196f3'
      }}>
        💡 Historial completo de todos los movimientos de inventario: ventas, transferencias, ajustes, etc.
      </div>

      {/* Filtros */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {movementTypes.map(type => (
          <button
            key={type.value}
            onClick={() => setFilter(type.value)}
            style={{
              padding: '6px 12px',
              backgroundColor: filter === type.value ? '#0070f3' : '#f0f0f0',
              color: filter === type.value ? 'white' : '#333',
              border: 'none',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            {type.label}
          </button>
        ))}
      </div>

      {filteredMovements.length === 0 ? (
        <div style={{ 
          backgroundColor: '#f8d7da', 
          padding: '20px', 
          borderRadius: '5px',
          textAlign: 'center',
          color: '#721c24'
        }}>
          No hay movimientos registrados {filter !== 'all' ? 'para este tipo' : ''}.
        </div>
      ) : (
        <>
          <p style={{ marginBottom: '10px', color: '#666' }}>
            Mostrando {filteredMovements.length} de {movements.length} movimientos totales
          </p>
          
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Ubicación</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Notas</th>
                <th>ID</th>
               </tr>
            </thead>
            <tbody>
              {filteredMovements.map((mov) => (
                <tr key={mov.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {new Date(mov.created_at).toLocaleDateString('es-MX')}
                    <br/>
                    <span style={{ fontSize: '11px', color: '#666' }}>
                      {new Date(mov.created_at).toLocaleTimeString('es-MX')}
                    </span>
                  </td>
                  <td>
                    <strong>{mov.products?.name || mov.product_id}</strong>
                    <br/>
                    <span style={{ fontSize: '10px', color: '#999' }}>
                      ID: {mov.product_id?.slice(0, 8)}...
                    </span>
                  </td>
                  <td>{mov.locations?.name || mov.location_id}</td>
                  <td>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: getMovementColor(mov.movement_type, mov.quantity),
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '15px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {getMovementIcon(mov.movement_type)} {mov.movement_type}
                    </span>
                  </td>
                  <td style={{ 
                    textAlign: 'center', 
                    fontWeight: 'bold',
                    color: getMovementColor(mov.movement_type, mov.quantity)
                  }}>
                    {getQuantityDisplay(mov.quantity, mov.movement_type)}
                  </td>
                  <td style={{ maxWidth: '200px', fontSize: '12px', color: '#666' }}>
                    {mov.notes || '-'}
                  </td>
                  <td style={{ fontSize: '10px', color: '#999' }}>
                    {mov.id?.slice(0, 8)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      
      <div style={{ marginTop: '30px', display: 'flex', gap: '15px' }}>
        <a href="/inventory" style={{ color: '#0070f3', textDecoration: 'none' }}>
          ← Ver Inventario
        </a>
        <a href="/movements" style={{ color: '#0070f3', textDecoration: 'none' }}>
          Nuevo Movimiento →
        </a>
        <a href="/transfer" style={{ color: '#0070f3', textDecoration: 'none' }}>
          Transferencias →
        </a>
      </div>
    </div>
  )
}
