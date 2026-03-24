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
  const [recentMovements, setRecentMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [locationName, setLocationName] = useState('McAllen')

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
      
      if (location) setLocationName(location.name)

      // 1. Total de productos y stock en McAllen
      const { data: inventory } = await supabase
        .from('inventory_totals')
        .select('total_stock')
        .eq('location_id', 'e6564cd8-6787-42be-8fd6-7de5fac125aa') // UUID de McAllen

      const totalStock = inventory?.reduce((sum, item) => sum + (item.total_stock || 0), 0) || 0
      const totalProducts = inventory?.length || 0

      // 2. Alertas desde la vista restock_alerts (filtradas por McAllen)
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

      const { data: movements } = await supabase
        .from('inventory_movements')
        .select('id')
        .eq('location_id', 'e6564cd8-6787-42be-8fd6-7de5fac125aa')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())

      // 4. Últimos 5 movimientos en McAllen
      const { data: lastMovements } = await supabase
        .from('inventory_movements')
        .select(`
          id,
          quantity,
          movement_type,
          created_at,
          products (name),
          locations (name)
        `)
        .eq('location_id', 'e6564cd8-6787-42be-8fd6-7de5fac125aa')
        .order('created_at', { ascending: false })
        .limit(5)

      setSummary({
        totalProducts,
        totalStock,
        activeAlerts,
        criticalAlerts,
        movementsToday: movements?.length || 0
      })
      setRecentMovements(lastMovements || [])

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
        <h1>🏪 S2POS - {locationName}</h1>
        <p>Cargando datos...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>🏪 S2POS - {locationName}</h1>
      
      {/* Tarjetas de resumen */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
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
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <Link href="/inventory" style={{ 
            backgroundColor: '#0070f3', 
            color: 'white', 
            padding: '10px 20px', 
            borderRadius: '8px', 
            textDecoration: 'none',
            display: 'inline-block'
          }}>
            📦 Ver Inventario
          </Link>
          <Link href="/alerts" style={{ 
            backgroundColor: '#ff9800', 
            color: 'white', 
            padding: '10px 20px', 
            borderRadius: '8px', 
            textDecoration: 'none'
          }}>
            📊 Dashboard Inventario
          </Link>
          <Link href="/movements" style={{ 
            backgroundColor: '#4caf50', 
            color: 'white', 
            padding: '10px 20px', 
            borderRadius: '8px', 
            textDecoration: 'none'
          }}>
            📝 Nuevo Movimiento
          </Link>
          <Link href="/transfer" style={{ 
            backgroundColor: '#9c27b0', 
            color: 'white', 
            padding: '10px 20px', 
            borderRadius: '8px', 
            textDecoration: 'none'
          }}>
            🚚 Transferencias
          </Link>
          <Link href="/movements-history" style={{ 
            backgroundColor: '#607d8b', 
            color: 'white', 
            padding: '10px 20px', 
            borderRadius: '8px', 
            textDecoration: 'none'
          }}>
            📜 Historial
          </Link>
        </div>
      </div>

      {/* Últimos movimientos */}
      <div>
        <h2>📋 Últimos Movimientos</h2>
        {recentMovements.length === 0 ? (
          <p>No hay movimientos recientes.</p>
        ) : (
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Notas</th>
                </tr>
            </thead>
            <tbody>
              {recentMovements.map((mov) => (
                <tr key={mov.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {new Date(mov.created_at).toLocaleDateString('es-MX')}
                    <br/>
                    <span style={{ fontSize: '11px', color: '#666' }}>
                      {new Date(mov.created_at).toLocaleTimeString('es-MX')}
                    </span>
                   </td>
                  <td>{mov.products?.name || mov.product_id?.slice(0, 8)}</td>
                  <td>
                    <span style={{ 
                      backgroundColor: mov.movement_type === 'sale' || mov.movement_type === 'transfer_out' ? '#f44336' :
                                     mov.movement_type === 'restock' || mov.movement_type === 'transfer_in' ? '#4caf50' : '#ff9800',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      display: 'inline-block'
                    }}>
                      {getMovementIcon(mov.movement_type)} {mov.movement_type}
                    </span>
                  </td>
                  <td style={{ 
                    textAlign: 'center',
                    color: mov.movement_type === 'restock' || mov.movement_type === 'transfer_in' ? '#4caf50' : '#f44336',
                    fontWeight: 'bold'
                  }}>
                    {mov.movement_type === 'restock' || mov.movement_type === 'transfer_in' ? `+${mov.quantity}` : 
                     mov.movement_type === 'sale' || mov.movement_type === 'transfer_out' ? `-${Math.abs(mov.quantity)}` : mov.quantity}
                  </td>
                  <td style={{ maxWidth: '200px', fontSize: '12px', color: '#666' }}>-</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
