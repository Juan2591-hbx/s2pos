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
      // Traer todas las alertas (ya tienen los nombres)
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

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>⚠️ Alertas de Inventario</h1>
        <p>Cargando alertas...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>⚠️ Alertas de Inventario</h1>
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
      <h1>⚠️ Alertas de Inventario</h1>
      
      {alerts.length === 0 ? (
        <div style={{ 
          backgroundColor: '#d4edda', 
          color: '#155724', 
          padding: '15px', 
          borderRadius: '5px',
          border: '1px solid #c3e6cb'
        }}>
          ✅ ¡Todas las existencias están en niveles saludables! No hay alertas activas.
        </div>
      ) : (
        <>
          <p style={{ marginBottom: '20px', color: '#ff9800' }}>
            ⚠️ Se encontraron {alerts.length} alerta(s) de productos con stock bajo:
          </p>
          
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#ff9800', color: 'white' }}>
                <th>Producto</th>
                <th>Ubicación</th>
                <th>Stock Actual</th>
                <th>Stock Objetivo</th>
                <th>Envío Sugerido</th>
                <th>Ratio Stock</th>
                <th>Nivel Alerta</th>
               </tr>
            </thead>
            <tbody>
              {alerts.map((alert, index) => (
                <tr key={index} style={{ backgroundColor: alert.alert_level === 'LOW' ? '#fff3e0' : '#ffe0e0' }}>
                  <td>{alert.product} </td>
                  <td>{alert.location} </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: alert.current_stock < alert.target_stock ? 'red' : 'green' }}>
                    {alert.current_stock}
                   </td>
                  <td style={{ textAlign: 'center' }}>{alert.target_stock}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#0070f3' }}>
                    {alert.suggested_send}
                   </td>
                  <td style={{ textAlign: 'center' }}>
                    {alert.stock_ratio}
                   </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ 
                      backgroundColor: alert.alert_level === 'LOW' ? '#ff9800' : '#f44336',
                      color: 'white', 
                      padding: '3px 8px', 
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}>
                      {alert.alert_level}
                    </span>
                   </td>
                 </tr>
              ))}
            </tbody>
           </table>
          
          <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
            Total de alertas: {alerts.length}
          </div>
        </>
      )}
      
      <div style={{ marginTop: '30px' }}>
        <a href="/inventory" style={{ color: '#0070f3', textDecoration: 'none' }}>
          ← Volver al Inventario
        </a>
      </div>
    </div>
  )
}
