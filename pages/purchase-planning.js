import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default function PurchasePlanning() {
  const [locations, setLocations] = useState([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [leadTime, setLeadTime] = useState(0)
  const [locationName, setLocationName] = useState('')

  const SAFETY_STOCK_MONTHS = 1

  useEffect(() => {
    fetchLocations()
  }, [])

  useEffect(() => {
    if (selectedLocation) {
      fetchPlanningData()
    }
  }, [selectedLocation])

  async function fetchLocations() {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, type, country')
        .eq('type', 'warehouse')
        .order('name')

      if (error) throw error
      setLocations(data || [])
      if (data && data.length > 0) {
        setSelectedLocation(data[0].id)
      }
    } catch (err) {
      console.error('Error cargando ubicaciones:', err)
      setError(err.message)
    }
  }

  async function fetchPlanningData() {
    setLoading(true)
    try {
      const { data: locationData, error: locError } = await supabase
        .from('locations')
        .select('name, country')
        .eq('id', selectedLocation)
        .single()

      if (locError) throw locError
      setLocationName(locationData.name)

      // Lead time según país
      let leadTimeValue = 6.5
      switch (locationData.country) {
        case 'México':
          leadTimeValue = 4.5
          break
        case 'USA':
          leadTimeValue = 6.5
          break
        case 'Guatemala':
          leadTimeValue = 6.5
          break
        default:
          leadTimeValue = 6.5
      }
      setLeadTime(leadTimeValue)

      const { data: inventory, error: invError } = await supabase
        .from('inventory_totals')
        .select(`
          product_id,
          total_stock,
          products (
            id,
            name,
            sku
          )
        `)
        .eq('location_id', selectedLocation)
        .gt('total_stock', 0)

      if (invError) throw invError

      if (!inventory || inventory.length === 0) {
        setProducts([])
        setLoading(false)
        return
      }

      const productIds = inventory.map(item => item.product_id)
      const { data: salesAvg, error: avgError } = await supabase
        .from('product_sales_avg')
        .select('product_id, avg_monthly')
        .in('product_id', productIds)

      if (avgError) throw avgError

      const avgMap = new Map()
      salesAvg?.forEach(avg => {
        avgMap.set(avg.product_id, avg.avg_monthly)
      })

      const processedProducts = inventory.map(item => {
        const product = item.products
        const stock = item.total_stock
        const avgMonthly = avgMap.get(item.product_id) || 0
        const productLeadTime = leadTimeValue

        let mesesInventario = null
        let puntoReorden = null
        let diferencia = null
        let estado = 'sin_datos'
        let estadoTexto = 'Sin datos'
        let estadoColor = '#9e9e9e'

        if (avgMonthly > 0) {
          mesesInventario = stock / avgMonthly
          puntoReorden = productLeadTime + SAFETY_STOCK_MONTHS
          diferencia = mesesInventario - puntoReorden

          if (diferencia <= 0) {
            estado = 'urgente'
            estadoTexto = '🔴 URGENTE'
            estadoColor = '#f44336'
          } else if (diferencia <= 2) {
            estado = 'atencion'
            estadoTexto = '🟡 ATENCIÓN'
            estadoColor = '#ff9800'
          } else {
            estado = 'ok'
            estadoTexto = '🟢 OK'
            estadoColor = '#4caf50'
          }
        }

        return {
          id: product?.id,
          name: product?.name || item.product_id?.slice(0, 8),
          sku: product?.sku || '-',
          stock: stock,
          avgMonthly: avgMonthly,
          leadTime: productLeadTime,
          mesesInventario: mesesInventario,
          puntoReorden: puntoReorden,
          diferencia: diferencia,
          estado: estado,
          estadoTexto: estadoTexto,
          estadoColor: estadoColor
        }
      })

      processedProducts.sort((a, b) => {
        const order = { urgente: 0, atencion: 1, ok: 2, sin_datos: 3 }
        return order[a.estado] - order[b.estado]
      })

      setProducts(processedProducts)
    } catch (err) {
      console.error('Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getLeadTimeDisplay = (leadTime) => {
    return `${leadTime} meses (por país)`
  }

  const getDiferenciaDisplay = (diferencia) => {
    if (diferencia === null) return '-'
    return `${diferencia.toFixed(1)} meses`
  }

  const stats = {
    urgentes: products.filter(p => p.estado === 'urgente').length,
    atencion: products.filter(p => p.estado === 'atencion').length,
    ok: products.filter(p => p.estado === 'ok').length,
    sinDatos: products.filter(p => p.estado === 'sin_datos').length
  }

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
        <h1>📊 Planificación de Compras</h1>
        <p>Cargando datos...</p>
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
        <h1>📊 Planificación de Compras</h1>
        <div style={{ color: 'red', border: '1px solid red', padding: '10px', borderRadius: '5px' }}>
          <strong>Error:</strong> {error}
        </div>
        <button onClick={fetchPlanningData} style={{ marginTop: '10px', padding: '8px 12px', cursor: 'pointer' }}>
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

      <h1>📊 Planificación de Compras</h1>
      
      <div style={{ 
        backgroundColor: '#e3f2fd', 
        padding: '12px', 
        borderRadius: '5px', 
        marginBottom: '20px',
        borderLeft: '4px solid #2196f3'
      }}>
        💡 <strong>Punto de Reorden:</strong> Lead Time por país + Stock Seguridad (1 mes). Solo bodegas principales (warehouse) pueden generar órdenes de compra.
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontWeight: 'bold', marginRight: '10px' }}>🏭 Bodega (Warehouse):</label>
        <select
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
          style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', minWidth: '200px' }}
        >
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>
              {loc.name} ({loc.country})
            </option>
          ))}
        </select>
      </div>

      <div style={{ 
        backgroundColor: '#f5f5f5', 
        padding: '10px 15px', 
        borderRadius: '5px', 
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <span><strong>🏭 {locationName}</strong></span>
        <span><strong>⏱️ Lead Time por país:</strong> {leadTime} meses</span>
        <span><strong>🛡️ Stock Seguridad:</strong> {SAFETY_STOCK_MONTHS} mes</span>
      </div>

      {products.length === 0 ? (
        <div style={{ 
          backgroundColor: '#fff3e0', 
          padding: '20px', 
          borderRadius: '5px',
          textAlign: 'center',
          color: '#ff9800'
        }}>
          No hay productos con stock en esta bodega.
        </div>
      ) : (
        <>
          <div style={{ 
            display: 'flex', 
            gap: '20px', 
            marginBottom: '20px',
            flexWrap: 'wrap'
          }}>
            <div style={{ backgroundColor: '#ffebee', padding: '10px 15px', borderRadius: '8px' }}>
              🔴 <strong>Urgentes:</strong> {stats.urgentes}
            </div>
            <div style={{ backgroundColor: '#fff3e0', padding: '10px 15px', borderRadius: '8px' }}>
              🟡 <strong>Atención:</strong> {stats.atencion}
            </div>
            <div style={{ backgroundColor: '#e8f5e9', padding: '10px 15px', borderRadius: '8px' }}>
              🟢 <strong>OK:</strong> {stats.ok}
            </div>
            <div style={{ backgroundColor: '#f5f5f5', padding: '10px 15px', borderRadius: '8px' }}>
              ⚪ <strong>Sin datos:</strong> {stats.sinDatos}
            </div>
          </div>

          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th>Producto</th>
                <th>SKU</th>
                <th>Stock</th>
                <th>Promedio Mensual</th>
                <th>Meses Inventario</th>
                <th>Lead Time</th>
                <th>Punto Reorden</th>
                <th>Diferencia</th>
                <th>Estado</th>
                </tr>
            </thead>
            <tbody>
              {products.map((product, idx) => (
                <tr key={idx} style={{ backgroundColor: product.estadoColor === '#f44336' ? '#ffebee' : product.estadoColor === '#ff9800' ? '#fff3e0' : 'white' }}>
                  <td><strong>{product.name}</strong></td>
                  <td>{product.sku}</td>
                  <td style={{ textAlign: 'center' }}>{product.stock}</td>
                  <td style={{ textAlign: 'center' }}>
                    {product.avgMonthly > 0 ? `${product.avgMonthly} /mes` : 
                      <span style={{ color: '#999' }}>Sin datos</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {product.mesesInventario !== null ? `${product.mesesInventario.toFixed(1)} meses` : '-'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {getLeadTimeDisplay(product.leadTime)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {product.puntoReorden !== null ? `${product.puntoReorden.toFixed(1)} meses` : '-'}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: product.estadoColor }}>
                    {getDiferenciaDisplay(product.diferencia)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ 
                      backgroundColor: product.estadoColor,
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {product.estadoTexto}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            backgroundColor: '#e8f5e9', 
            borderRadius: '8px',
            borderLeft: '4px solid #4caf50'
          }}>
            <strong>💡 Recomendación de compras:</strong>
            {stats.urgentes > 0 && (
              <div>🔴 <strong>{stats.urgentes} productos urgentes</strong> - Requieren pedido inmediato para evitar rotura de stock.</div>
            )}
            {stats.atencion > 0 && (
              <div>🟡 <strong>{stats.atencion} productos en atención</strong> - Pueden esperar a la próxima orden consolidada (1-2 meses).</div>
            )}
            {stats.ok > 0 && (
              <div>🟢 <strong>{stats.ok} productos OK</strong> - Inventario suficiente, pueden esperar la siguiente orden planificada.</div>
            )}
            {stats.urgentes === 0 && stats.atencion === 0 && (
              <div>✅ Todos los productos tienen inventario suficiente. Puedes planificar la próxima orden con calma.</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
