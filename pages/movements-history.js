import { useEffect, useState, Fragment } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default function MovementsHistory() {
  const [groupedData, setGroupedData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [months, setMonths] = useState([])
  const [expandedGroups, setExpandedGroups] = useState({})
  const [totalSummary, setTotalSummary] = useState({
    ventas: 0,
    empleados: 0,
    promociones: 0,
    vencidos: 0,
    dañados: 0,
    ajustes: 0,
    reabastecimientos: 0,
    transferencias_entrada: 0,
    transferencias_salida: 0
  })

  useEffect(() => {
    generateMonthOptions()
  }, [])

  useEffect(() => {
    if (selectedMonth) {
      fetchMovements()
    }
  }, [selectedMonth])

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
      options.push({ value, label })
    }
    
    setMonths(options)
    setSelectedMonth(options[0].value)
  }

  async function fetchMovements() {
    setLoading(true)
    try {
      const [year, month] = selectedMonth.split('-')
      const startDate = `${year}-${month}-01`
      const endDate = new Date(parseInt(year), parseInt(month), 1)
      endDate.setMonth(endDate.getMonth() + 1)
      const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`

      // Traer todos los movimientos del mes con sus relaciones
      const { data: movements, error } = await supabase
        .from('inventory_movements')
        .select(`
          id,
          quantity,
          movement_type,
          notes,
          created_at,
          reference_id,
          product_id,
          location_id,
          products (name),
          locations (name)
        `)
        .gte('created_at', startDate)
        .lt('created_at', endDateStr)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (!movements || movements.length === 0) {
        setGroupedData([])
        setLoading(false)
        return
      }

      // Para ventas: obtener order_number de orders
      const orderIds = movements
        .filter(m => m.movement_type === 'sale' && m.reference_id)
        .map(m => m.reference_id)
      
      let orderMap = {}
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from('orders')
          .select('id, order_number')
          .in('id', orderIds)
        
        if (orders) {
          orderMap = orders.reduce((acc, o) => {
            acc[o.id] = o.order_number
            return acc
          }, {})
        }
      }

      // Agrupar por producto + tipo + ubicación
      const groups = new Map()
      const summary = {
        ventas: 0,
        empleados: 0,
        promociones: 0,
        vencidos: 0,
        dañados: 0,
        ajustes: 0,
        reabastecimientos: 0,
        transferencias_entrada: 0,
        transferencias_salida: 0
      }

      movements.forEach(mov => {
        const productName = mov.products?.name || mov.product_id?.slice(0, 8)
        const locationName = mov.locations?.name || mov.location_id?.slice(0, 8)
        const type = mov.movement_type
        const quantity = mov.quantity
        const absQuantity = Math.abs(quantity)
        const key = `${productName}_${type}_${locationName}`

        // Acumular para resumen
        switch(type) {
          case 'sale': summary.ventas += absQuantity; break
          case 'employee': summary.empleados += absQuantity; break
          case 'promo': summary.promociones += absQuantity; break
          case 'expired': summary.vencidos += absQuantity; break
          case 'damaged': summary.dañados += absQuantity; break
          case 'adjustment': summary.ajustes += absQuantity; break
          case 'restock': summary.reabastecimientos += absQuantity; break
          case 'transfer_in': summary.transferencias_entrada += absQuantity; break
          case 'transfer_out': summary.transferencias_salida += absQuantity; break
        }

        if (!groups.has(key)) {
          groups.set(key, {
            product: productName,
            type: type,
            location: locationName,
            totalQuantity: 0,
            movements: []
          })
        }

        const group = groups.get(key)
        group.totalQuantity += quantity
        
        // Preparar detalle según tipo
        let detailText = ''
        if (type === 'sale' && mov.reference_id) {
          const orderNumber = orderMap[mov.reference_id] || mov.reference_id?.slice(0, 8)
          detailText = `Orden ${orderNumber}`
        } else if (type === 'transfer_in') {
          detailText = 'Entrada por transferencia'
        } else if (type === 'transfer_out') {
          detailText = 'Salida por transferencia'
        } else {
          detailText = mov.notes || 'Sin nota'
        }
        
        group.movements.push({
          id: mov.id,
          date: mov.created_at,
          quantity: mov.quantity,
          detail: detailText
        })
      })

      // Convertir a array y ordenar
      const groupedArray = Array.from(groups.values())
      groupedArray.sort((a, b) => {
        const order = { sale: 1, employee: 2, promo: 3, expired: 4, damaged: 5, adjustment: 6, transfer_out: 7, restock: 8, transfer_in: 9 }
        return (order[a.type] || 10) - (order[b.type] || 10)
      })

      setGroupedData(groupedArray)
      setTotalSummary(summary)
      setExpandedGroups({})
    } catch (err) {
      console.error('Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getTypeName = (type) => {
    const names = {
      sale: '💰 Ventas',
      employee: '👥 Empleados',
      promo: '🎁 Promociones',
      expired: '⏰ Vencidos',
      damaged: '🔨 Dañados',
      adjustment: '✏️ Ajustes',
      restock: '📦 Reabastecimientos',
      transfer_in: '🚚 Transferencia (entrada)',
      transfer_out: '🚚 Transferencia (salida)'
    }
    return names[type] || type
  }

  const getTypeColor = (type) => {
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

  const toggleExpand = (key) => {
    setExpandedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
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
        💡 Historial agrupado por tipo. Haz clic en "Ver detalles" para expandir.
      </div>

      {/* Selector de mes */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontWeight: 'bold', marginRight: '10px' }}>📅 Mes:</label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
        >
          {months.map(month => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
      </div>

      {groupedData.length === 0 ? (
        <div style={{ 
          backgroundColor: '#fff3e0', 
          padding: '20px', 
          borderRadius: '5px',
          textAlign: 'center',
          color: '#ff9800'
        }}>
          No hay movimientos registrados en {selectedMonthLabel}.
        </div>
      ) : (
        <>
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Ubicación</th>
                <th></th>
                </tr>
            </thead>
            <tbody>
              {groupedData.map((group, idx) => {
                const groupKey = `${group.product}_${group.type}_${group.location}`
                const isExpanded = expandedGroups[groupKey]
                const totalQty = group.totalQuantity
                const isExit = group.type === 'sale' || group.type === 'employee' || group.type === 'promo' || 
                               group.type === 'expired' || group.type === 'damaged' || group.type === 'transfer_out'
                const qtyColor = isExit ? '#f44336' : (group.type === 'restock' || group.type === 'transfer_in' ? '#4caf50' : '#ff9800')
                
                return (
                  <Fragment key={groupKey}>
                    <tr style={{ backgroundColor: '#fafafa' }}>
                      <td><strong>{group.product}</strong></td>
                      <td>
                        <span style={{ 
                          backgroundColor: getTypeColor(group.type),
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px'
                        }}>
                          {getTypeName(group.type)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: qtyColor }}>
                        {getQuantityDisplay(totalQty, group.type)}
                      </td>
                      <td>{group.location}</td>
                      <td>
                        <button
                          onClick={() => toggleExpand(groupKey)}
                          style={{
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: '#0070f3',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          {isExpanded ? '▲ Ocultar detalles' : `▼ Ver detalles (${group.movements.length} movimientos)`}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan="5" style={{ padding: '0', backgroundColor: '#f9f9f9' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#e8e8e8' }}>
                                <th style={{ padding: '8px', textAlign: 'left' }}>Detalle</th>
                                <th style={{ padding: '8px', textAlign: 'left' }}>Fecha</th>
                                <th style={{ padding: '8px', textAlign: 'left' }}>Cantidad</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.movements.map(mov => (
                                <tr key={mov.id} style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '8px' }}>{mov.detail}</td>
                                  <td style={{ padding: '8px' }}>
                                    {new Date(mov.date).toLocaleDateString('es-MX')} {new Date(mov.date).toLocaleTimeString('es-MX')}
                                  </td>
                                  <td style={{ padding: '8px', fontWeight: 'bold', color: getTypeColor(group.type) }}>
                                    {getQuantityDisplay(mov.quantity, group.type)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>

          {/* Totales al pie */}
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            backgroundColor: '#f5f5f5', 
            borderRadius: '8px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '20px',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <strong>📊 Totales del mes:</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginTop: '8px' }}>
                {totalSummary.ventas > 0 && <span>💰 Ventas: <strong style={{ color: '#f44336' }}>-{totalSummary.ventas}</strong></span>}
                {totalSummary.empleados > 0 && <span>👥 Empleados: <strong style={{ color: '#f44336' }}>-{totalSummary.empleados}</strong></span>}
                {totalSummary.promociones > 0 && <span>🎁 Promociones: <strong style={{ color: '#f44336' }}>-{totalSummary.promociones}</strong></span>}
                {totalSummary.vencidos > 0 && <span>⏰ Vencidos: <strong style={{ color: '#f44336' }}>-{totalSummary.vencidos}</strong></span>}
                {totalSummary.dañados > 0 && <span>🔨 Dañados: <strong style={{ color: '#f44336' }}>-{totalSummary.dañados}</strong></span>}
                {totalSummary.ajustes > 0 && <span>✏️ Ajustes: <strong style={{ color: '#ff9800' }}>{totalSummary.ajustes}</strong></span>}
                {totalSummary.reabastecimientos > 0 && <span>📦 Reabastecimientos: <strong style={{ color: '#4caf50' }}>+{totalSummary.reabastecimientos}</strong></span>}
                {totalSummary.transferencias_entrada > 0 && <span>🚚 Transferencias (entrada): <strong style={{ color: '#4caf50' }}>+{totalSummary.transferencias_entrada}</strong></span>}
                {totalSummary.transferencias_salida > 0 && <span>🚚 Transferencias (salida): <strong style={{ color: '#f44336' }}>-{totalSummary.transferencias_salida}</strong></span>}
              </div>
            </div>
            <div>
              <strong>Total neto:</strong>{' '}
              <span style={{ 
                fontSize: '20px', 
                fontWeight: 'bold',
                color: (totalSummary.reabastecimientos + totalSummary.transferencias_entrada) - 
                       (totalSummary.ventas + totalSummary.empleados + totalSummary.promociones + 
                        totalSummary.vencidos + totalSummary.dañados + totalSummary.transferencias_salida) >= 0 
                        ? '#4caf50' : '#f44336'
              }}>
                {(totalSummary.reabastecimientos + totalSummary.transferencias_entrada) - 
                 (totalSummary.ventas + totalSummary.empleados + totalSummary.promociones + 
                  totalSummary.vencidos + totalSummary.dañados + totalSummary.transferencias_salida)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
