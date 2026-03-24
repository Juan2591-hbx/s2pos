import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default function MovementsHistory() {
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [months, setMonths] = useState([])
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalMovements, setTotalMovements] = useState(0)
  const itemsPerPage = 20

  useEffect(() => {
    generateMonthOptions()
  }, [])

  useEffect(() => {
    if (selectedMonth) {
      fetchMovements()
    }
  }, [filter, currentPage, selectedMonth])

  const generateMonthOptions = () => {
    const options = []
    const today = new Date()
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const monthName = date.toLocaleString('es-MX', { month: 'long' })
      const value = `${year}-${String(month).padStart(2, '0')}-01`
      const label = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`
      options.push({ value, label, year, month })
    }
    
    setMonths(options)
    setSelectedMonth(options[0].value)
  }

  async function fetchMovements() {
    setLoading(true)
    try {
      // Calcular rango de fechas del mes seleccionado
      const [year, month] = selectedMonth.split('-')
      const startDate = `${year}-${month}-01`
      const endDate = new Date(parseInt(year), parseInt(month), 1)
      endDate.setMonth(endDate.getMonth() + 1)
      const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`

      // 1. Contar total de movimientos del mes
      let countQuery = supabase
        .from('inventory_movements')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate)
        .lt('created_at', endDateStr)

      if (filter !== 'all') {
        countQuery = countQuery.eq('movement_type', filter)
      }

      const { count, error: countError } = await countQuery
      if (countError) throw countError
      
      setTotalMovements(count || 0)
      setTotalPages(Math.ceil((count || 0) / itemsPerPage))

      // 2. Traer movimientos con paginación
      let query = supabase
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
        .gte('created_at', startDate)
        .lt('created_at', endDateStr)
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1)

      if (filter !== 'all') {
        query = query.eq('movement_type', filter)
      }

      const { data, error } = await query

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
    const icons = {
      sale: '💰', promo: '🎁', employee: '👥', expired: '⏰',
      damaged: '🔨', adjustment: '✏️', restock: '📦',
      transfer_in: '🚚⬅️', transfer_out: '🚚➡️'
    }
    return icons[type] || '📋'
  }

  const getMovementColor = (type, quantity) => {
    if (type === 'sale' || type === 'employee' || type === 'promo' || 
        type === 'expired' || type === 'damaged' || type === 'transfer_out') {
      return '#f44336'
    }
    if (type === 'restock' || type === 'transfer_in') {
      return '#4caf50'
    }
    return '#ff9800'
  }

  const getQuantityDisplay = (quantity, type) => {
    const absQty = Math.abs(quantity)
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

  const goToPage = (page) => {
    setCurrentPage(page)
  }

  const selectedMonthLabel = months.find(m => m.value === selectedMonth)?.label || ''

  if (loading) {
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
        <h1>📜 Historial de Movimientos</h1>
        <p>Cargando historial...</p>
      </div>
    )
  }

  if (error) {
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

      <h1>📜 Historial de Movimientos</h1>
      
      <div style={{ 
        backgroundColor: '#e3f2fd', 
        padding: '12px', 
        borderRadius: '5px', 
        marginBottom: '20px',
        borderLeft: '4px solid #2196f3'
      }}>
        💡 Historial completo de todos los movimientos de inventario.
      </div>

      {/* Filtros: Mes y Tipo */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ fontWeight: 'bold', marginRight: '10px' }}>📅 Mes:</label>
          <select
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value)
              setCurrentPage(1)
            }}
            style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
          >
            {months.map(month => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label style={{ fontWeight: 'bold', marginRight: '10px' }}>🔍 Tipo:</label>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              setCurrentPage(1)
            }}
            style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
          >
            {movementTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Información de paginación */}
      <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <span style={{ color: '#666' }}>
          Mostrando {movements.length} de {totalMovements} movimientos - {selectedMonthLabel}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              padding: '5px 10px',
              backgroundColor: currentPage === 1 ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            ← Anterior
          </button>
          <span style={{ padding: '5px 10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
            Página {currentPage} de {totalPages || 1}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            style={{
              padding: '5px 10px',
              backgroundColor: currentPage === totalPages || totalPages === 0 ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: currentPage === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            Siguiente →
          </button>
        </div>
      </div>

      {movements.length === 0 ? (
        <div style={{ 
          backgroundColor: '#fff3e0', 
          padding: '20px', 
          borderRadius: '5px',
          textAlign: 'center',
          color: '#ff9800'
        }}>
          No hay movimientos registrados {filter !== 'all' ? 'para este tipo' : ''} en {selectedMonthLabel}.
        </div>
      ) : (
        <>
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
              {movements.map((mov) => (
                <tr key={mov.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {new Date(mov.created_at).toLocaleDateString('es-MX')}
                    <br/>
                    <span style={{ fontSize: '11px', color: '#666' }}>
                      {new Date(mov.created_at).toLocaleTimeString('es-MX')}
                    </span>
                  </td>
                  <td>
                    <strong>{mov.products?.name || mov.product_id?.slice(0, 8)}</strong>
                    <br/>
                    <span style={{ fontSize: '10px', color: '#999' }}>
                      ID: {mov.product_id?.slice(0, 8)}...
                    </span>
                  </td>
                  <td>{mov.locations?.name || mov.location_id?.slice(0, 8)}</td>
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
          
          {/* Paginación inferior */}
          {totalPages > 1 && (
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                  padding: '5px 10px',
                  backgroundColor: currentPage === 1 ? '#ccc' : '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                ← Anterior
              </button>
              <span style={{ padding: '5px 10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                  padding: '5px 10px',
                  backgroundColor: currentPage === totalPages ? '#ccc' : '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
