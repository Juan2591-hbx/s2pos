import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default function Dashboard() {
  const [summary, setSummary] = useState({
    totalProducts: 0,
    totalStock: 0,
    activeAlerts: 0,
    criticalAlerts: 0,
    movementsToday: 0
  })
  const [criticalAlertsList, setCriticalAlertsList] = useState([])
  const [movementsSummary, setMovementsSummary] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    setLoading(true)
    try {
      // Obtener ubicación actual (hardcodeado para McAllen)
      const { data: location } = await supabase
        .from('locations')
        .select('name')
        .eq('name', 'McAllen')
        .single()
      
      // 1. Total de productos y stock en McAllen
      const { data: inventory } = await supabase
        .from('inventory_totals')
        .select('total_stock')
        .eq('location_id', 'e6564cd8-6787-42be-8fd6-7de5fac125aa')

      const totalStock = inventory?.reduce((sum, item) => sum + (item.total_stock || 0), 0) || 0
      const totalProducts = inventory?.length || 0

      // 2. Alertas desde la vista restock_alerts
      const { data: alerts } = await supabase
        .from('restock_alerts')
        .select('*')
        .eq('location', 'McAllen')

      const activeAlerts = alerts?.length || 0
      const criticalAlerts = alerts?.filter(a => a.alert_level === 'CRITICAL' || a.alert_level === 'VERY LOW').length || 0
      const criticalOnly = alerts?.filter(a => a.alert_level === 'CRITICAL' || a.alert_level === 'VERY LOW').slice(0, 5) || []
      setCriticalAlertsList(criticalOnly)

      // 3. Movimientos de hoy en McAllen
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data: movementsToday } = await supabase
        .from('inventory_movements')
        .select('id')
        .eq('location_id', 'e6564cd8-6787-42be-8fd6-7de5fac125aa')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())

      // 4. Resumen de movimientos (últimos 30 días)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const { data: movements30 } = await supabase
        .from('inventory_movements')
        .select('movement_type, quantity')
        .eq('location_id', 'e6564cd8-6787-42be-8fd6-7de5fac125aa')
        .gte('created_at', thirtyDaysAgo.toISOString())

      // Agrupar por tipo de movimiento
      const summaryMap = new Map()
      movements30?.forEach(mov => {
        const type = mov.movement_type
        const qty = Math.abs(mov.quantity)
        
        if (!summaryMap.has(type)) {
          summaryMap.set(type, { type, total: 0, count: 0 })
        }
        const current = summaryMap.get(type)
        current.total += qty
        current.count += 1
      })

      const summaryList = Array.from(summaryMap.values())
      // Ordenar por total de unidades (mayor primero)
      summaryList.sort((a, b) => b.total - a.total)
      setMovementsSummary(summaryList)

      setSummary({
        totalProducts,
        totalStock,
        activeAlerts,
        criticalAlerts,
        movementsToday: movementsToday?.length || 0
      })

    } catch (err) {
      console.error('Error cargando dashboard:', err)
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

  const getMovementName = (type) => {
    const names = {
      sale: 'Ventas', promo: 'Promociones', employee: 'Empleados', expired: 'Vencidos',
      damaged: 'Dañados', adjustment: 'Ajustes', restock: 'Reabastecimientos',
      transfer_in: 'Transferencias (entrada)', transfer_out: 'Transferencias (salida)'
    }
    return names[type] || type
  }

  const getAlertColor = (level) => {
    switch(level) {
      case 'CRITICAL': return '#d32f2f'
      case 'VERY LOW': return '#f44336'
      case 'LOW': return '#ff9800'
      default: return '#9e9e9e'
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>🏪 S2POS - McAllen</h1>
        <p>Cargando datos...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>🏪 S2POS - McAllen</h1>
      
      {/* Tarjetas de resumen */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
        gap: '15px',
        marginBottom: '30px'
      }}>
        <div style={{ backgroundColor: '#e3f2fd', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{summary.totalProducts}</div>
          <div style={{ color: '#666' }}>Productos</div>
        </div>
        <div style={{ backgroundColor: '#e8f5e9', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{summary.totalStock}</div>
          <div style={{ color: '#666' }}>Unidades en stock</div>
        </div>
        <div style={{ backgroundColor: '#fff3e0', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: summary.activeAlerts > 0 ? '#ff9800' : '#4caf50' }}>
            {summary.activeAlerts}
          </div>
          <div style={{ color: '#666' }}>Alertas activas</div>
        </div>
        <div style={{ backgroundColor: '#fce4ec', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f44336' }}>
            {summary.criticalAlerts}
          </div>
          <div style={{ color: '#666' }}>Alertas críticas</div>
        </div>
        <div style={{ backgroundColor: '#f3e5f5', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{summary.movementsToday}</div>
          <div style={{ color: '#666' }}>Movimientos hoy</div>
        </div>
      </div>

      {/* Alertas críticas */}
      {criticalAlertsList.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h2>⚠️ Alertas Críticas</h2>
          <div style={{ backgroundColor: '#fff3e0', padding: '15px', borderRadius: '10px' }}>
            {criticalAlertsList.map((alert, idx) => (
              <div key={idx} style={{ 
                padding: '10px', 
                borderBottom: idx < criticalAlertsList.length - 1 ? '1px solid #ffe0b2' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>
                  <span style={{ 
                    backgroundColor: getAlertColor(alert.alert_level),
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    marginRight: '10px'
                  }}>
                    {alert.alert_level}
                  </span>
                  <strong>{alert.product}</strong>
                </span>
                <span style={{ color: '#f44336', fontWeight: 'bold' }}>
                  Stock: {alert.current_stock} / Objetivo: {alert.target_stock}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accesos rápidos */}
      <div style={{ marginBottom: '30px' }}>
        <h2>🚀 Accesos Rápidos</h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link href="/inventory" style={{ 
            backgroundColor: '#0070f3', 
            color: 'white', 
            padding: '10px 18px', 
            borderRadius: '8px', 
            textDecoration: 'none',
            fontSize: '14px'
          }}>
            📦 Inventario
          </Link>
          <Link href="/alerts" style={{ 
            backgroundColor: '#ff9800', 
            color: 'white', 
            padding: '10px 18px', 
            borderRadius: '8px', 
            textDecoration: 'none',
            fontSize: '14px'
          }}>
            📊 Alertas
          </Link>
          <Link href="/movements" style={{ 
            backgroundColor: '#4caf50', 
            color: 'white', 
            padding: '10px 18px', 
            borderRadius: '8px', 
            textDecoration: 'none',
            fontSize: '14px'
          }}>
            📝 Movimientos
          </Link>
          <Link href="/transfer" style={{ 
            backgroundColor: '#9c27b0', 
            color: 'white', 
            padding: '10px 18px', 
            borderRadius: '8px', 
            textDecoration: 'none',
            fontSize: '14px'
          }}>
            🚚 Transferencias
          </Link>
          <Link href="/movements-history" style={{ 
            backgroundColor: '#607d8b', 
            color: 'white', 
            padding: '10px 18px', 
            borderRadius: '8px', 
            textDecoration: 'none',
            fontSize: '14px'
          }}>
            📜 Historial
          </Link>
          <Link href="/batches" style={{ 
            backgroundColor: '#795548', 
            color: 'white', 
            padding: '10px 18px', 
            borderRadius: '8px', 
            textDecoration: 'none',
            fontSize: '14px'
          }}>
            📦 Lotes
          </Link>
          <Link href="/fifo-analysis" style={{ 
            backgroundColor: '#f44336', 
            color: 'white', 
            padding: '10px 18px', 
            borderRadius: '8px', 
            textDecoration: 'none',
            fontSize: '14px'
          }}>
            📊 Análisis FIFO
          </Link>
        </div>
      </div>

      {/* Resumen de movimientos (últimos 30 días) */}
      <div>
        <h2>📊 Resumen de Movimientos (últimos 30 días)</h2>
        {movementsSummary.length === 0 ? (
          <p>No hay movimientos en los últimos 30 días.</p>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '12px'
          }}>
            {movementsSummary.map((item) => (
              <div key={item.type} style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '12px', 
                borderRadius: '8px',
                borderLeft: `4px solid ${item.type === 'sale' || item.type === 'transfer_out' ? '#f44336' : item.type === 'restock' || item.type === 'transfer_in' ? '#4caf50' : '#ff9800'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>{getMovementIcon(item.type)}</span>
                  <strong>{getMovementName(item.type)}</strong>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{item.total}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>{item.count} movimientos</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
