import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAlerts()
  }, [])

  async function fetchAlerts() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('restock_alerts')
        .select('*')

      if (error) throw error
      setAlerts(data || [])
    } catch (err) {
      console.error('Error cargando alertas:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Función para obtener color según nivel
  const getLevelColor = (level) => {
    switch(level) {
      case 'CRITICAL': return '#d32f2f'
      case 'VERY LOW': return '#f44336'
      case 'LOW': return '#ff9800'
      case 'WARNING': return '#ffc107'
      case 'MEDIUM': return '#4caf50'
      default: return '#9e9e9e'
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>📊 Dashboard de Inventario</h1>
        <p>Cargando datos...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>📊 Dashboard de Inventario</h1>
        <div style={{ color: 'red', border: '1px solid red', padding: '10px', borderRadius: '5px' }}>
          <strong>Error:</strong> {error}
        </div>
        <button onClick={fetchAlerts} style={{ marginTop: '10px', padding: '8px 12px', cursor: 'pointer' }}>
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>📊 Dashboard de Inventario</h1>
      
      {alerts.length === 0 ? (
        <div style={{ 
          backgroundColor: '#d4edda', 
          color: '#155724', 
          padding: '15px', 
          borderRadius: '5px',
          border: '1px solid #c3e6cb'
        }}>
          ✅ No hay datos de inventario disponibles.
        </div>
      ) : (
        <>
          <p style={{ marginBottom: '20px', color: '#666' }}>
            Estado actual del inventario para cada producto y ubicación:
          </p>
          
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th>Producto</th>
                <th>Ubicación</th>
                <th>Stock Actual</th>
                <th>Stock Objetivo</th>
                <th>Envío Sugerido</th>
                <th>Ratio Stock</th>
                <th>Nivel Inventario</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert, index) => (
                <tr key={index}>
                  <td>{alert.product}</td>
                  <td>{alert.location}</td>
                  <td style={{ 
                    textAlign: 'center', 
                    fontWeight: 'bold',
                    color: alert.current_stock < alert.target_stock ? '#d32f2f' : '#2e7d32'
                  }}>
                    {alert.current_stock}
                  </td>
                  <td style={{ textAlign: 'center' }}>{alert.target_stock}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#1976d2' }}>
                    {alert.suggested_send}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {typeof alert.stock_ratio === 'number' 
                      ? `${(alert.stock_ratio * 100).toFixed(1)}%` 
                      : alert.stock_ratio}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ 
                      backgroundColor: getLevelColor(alert.alert_level),
                      color: 'white', 
                      padding: '4px 12px', 
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      display: 'inline-block'
                    }}>
                      {alert.alert_level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
            Total de productos: {alerts.length}
          </div>
        </>
      )}
      
      <div style={{ marginTop: '30px' }}>
        <a href="/inventory" style={{ color: '#0070f3', textDecoration: 'none', marginRight: '20px' }}>
          ← Volver al Inventario
        </a>
      </div>
    </div>
  )
}
