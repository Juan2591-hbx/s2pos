import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default function FIFOAnalysis() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchFIFOAnalysis()
  }, [])

  async function fetchFIFOAnalysis() {
    setLoading(true)
    try {
      // 1. Traer todos los lotes activos
      const { data: batches, error: batchesError } = await supabase
        .from('inventory_batches')
        .select(`
          id,
          quantity,
          lot_number,
          expiration_date,
          product_id,
          location_id,
          locations (name),
          products (name)
        `)
        .gt('quantity', 0)
        .order('expiration_date', { ascending: true })

      if (batchesError) throw batchesError

      // 2. Traer promedios de venta mensuales
      const { data: salesAvg, error: avgError } = await supabase
        .from('product_sales_avg')
        .select('product_id, avg_monthly')

      if (avgError) throw avgError

      // Crear mapa de promedios
      const avgMap = new Map()
      salesAvg?.forEach(avg => {
        avgMap.set(avg.product_id, avg.avg_monthly)
      })

      // 3. Agrupar lotes por producto
      const productMap = new Map()
      
      batches?.forEach(batch => {
        const productId = batch.product_id
        const productName = batch.products?.name || productId?.slice(0, 8)
        const avgMonthly = avgMap.get(productId) || 0
        
        if (!productMap.has(productId)) {
          productMap.set(productId, {
            id: productId,
            name: productName,
            avgMonthly: avgMonthly,
            batches: []
          })
        }
        
        productMap.get(productId).batches.push({
          id: batch.id,
          lot_number: batch.lot_number,
          location: batch.locations?.name || batch.location_id?.slice(0, 8),
          quantity: batch.quantity,
          expiration_date: batch.expiration_date
        })
      })

      // 4. Calcular análisis FIFO para cada producto
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const productList = Array.from(productMap.values())
      
      productList.forEach(product => {
        let accumulatedMonths = 0
        const avgMonthly = product.avgMonthly || 0
        
        product.batches.forEach(batch => {
          const quantity = batch.quantity
          const expDate = new Date(batch.expiration_date)
          expDate.setHours(0, 0, 0, 0)
          
          // Meses hasta caducidad
          const monthsUntilExp = (expDate - today) / (1000 * 60 * 60 * 24 * 30)
          
          // Meses que cubre este lote
          let monthsToSell = 0
          if (avgMonthly > 0) {
            monthsToSell = quantity / avgMonthly
          } else {
            monthsToSell = Infinity // Sin promedio, no se puede calcular
          }
          
          // Meses acumulados (incluyendo este lote)
          const startMonth = accumulatedMonths
          const endMonth = accumulatedMonths + monthsToSell
          
          // Determinar estado
          let status = 'unknown'
          let statusColor = '#9e9e9e'
          let statusText = 'Sin promedio'
          
          if (avgMonthly === 0) {
            status = 'no_avg'
            statusColor = '#9e9e9e'
            statusText = 'Sin promedio'
          } else if (monthsToSell <= monthsUntilExp) {
            // Alcanza bien
            status = 'ok'
            statusColor = '#4caf50'
            statusText = '✅ OK'
          } else {
            const deficit = monthsToSell - monthsUntilExp
            if (deficit <= 2) {
              // Justo, margen pequeño
              status = 'warning'
              statusColor = '#ff9800'
              statusText = '⚠️ Atención'
            } else {
              // No alcanza
              status = 'risk'
              statusColor = '#f44336'
              statusText = '🔴 Riesgo'
            }
          }
          
          batch.monthsUntilExp = monthsUntilExp.toFixed(1)
          batch.monthsToSell = monthsToSell === Infinity ? 'N/A' : monthsToSell.toFixed(1)
          batch.startMonth = startMonth.toFixed(1)
          batch.endMonth = endMonth === Infinity ? 'N/A' : endMonth.toFixed(1)
          batch.status = status
          batch.statusColor = statusColor
          batch.statusText = statusText
          batch.avgMonthly = avgMonthly
          
          // Actualizar acumulado para el siguiente lote
          if (avgMonthly > 0) {
            accumulatedMonths += monthsToSell
          }
        })
        
        // Calcular estado general del producto
        const hasRisk = product.batches.some(b => b.status === 'risk')
        const hasWarning = product.batches.some(b => b.status === 'warning')
        const hasNoAvg = product.batches.some(b => b.status === 'no_avg')
        
        if (hasRisk) {
          product.overallStatus = 'risk'
          product.overallColor = '#f44336'
          product.overallText = '🔴 Riesgo de caducidad'
        } else if (hasWarning) {
          product.overallStatus = 'warning'
          product.overallColor = '#ff9800'
          product.overallText = '⚠️ Atención requerida'
        } else if (hasNoAvg) {
          product.overallStatus = 'no_avg'
          product.overallColor = '#9e9e9e'
          product.overallText = '⚪ Sin promedio de venta'
        } else {
          product.overallStatus = 'ok'
          product.overallColor = '#4caf50'
          product.overallText = '✅ Inventario saludable'
        }
        
        // Total de unidades
        product.totalUnits = product.batches.reduce((sum, b) => sum + b.quantity, 0)
      })
      
      // Ordenar productos: primero los que tienen riesgo, luego atención, luego ok
      productList.sort((a, b) => {
        const order = { risk: 0, warning: 1, no_avg: 2, ok: 3 }
        return order[a.overallStatus] - order[b.overallStatus]
      })
      
      setProducts(productList)
    } catch (err) {
      console.error('Error cargando análisis FIFO:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>📊 Análisis FIFO</h1>
        <p>Cargando análisis...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>📊 Análisis FIFO</h1>
        <div style={{ color: 'red', border: '1px solid red', padding: '10px', borderRadius: '5px' }}>
          <strong>Error:</strong> {error}
        </div>
        <button onClick={fetchFIFOAnalysis} style={{ marginTop: '10px', padding: '8px 12px', cursor: 'pointer' }}>
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>📊 Análisis FIFO</h1>
      
      <div style={{ 
        backgroundColor: '#e3f2fd', 
        padding: '12px', 
        borderRadius: '5px', 
        marginBottom: '20px',
        borderLeft: '4px solid #2196f3'
      }}>
        💡 <strong>Análisis de riesgo por caducidad (FIFO):</strong> Evalúa si los lotes alcanzarán a venderse antes de caducar.
        El cálculo respeta el orden de los lotes (primero los que vencen antes).
      </div>

      {products.length === 0 ? (
        <div style={{ 
          backgroundColor: '#fff3e0', 
          padding: '20px', 
          borderRadius: '5px',
          textAlign: 'center',
          color: '#ff9800'
        }}>
          No hay datos para analizar.
        </div>
      ) : (
        <>
          {products.map((product) => (
            <div key={product.id} style={{ 
              marginBottom: '30px',
              border: `2px solid ${product.overallColor}`,
              borderRadius: '10px',
              overflow: 'hidden'
            }}>
              {/* Cabecera del producto */}
              <div style={{ 
                backgroundColor: product.overallColor, 
                color: 'white', 
                padding: '12px 15px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px' }}>{product.name}</h2>
                  <div style={{ fontSize: '12px', opacity: 0.9 }}>
                    📊 Promedio mensual: {product.avgMonthly || 'No definido'} unidades/mes
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold' }}>{product.overallText}</div>
                  <div style={{ fontSize: '12px' }}>Total: {product.totalUnits} unidades</div>
                </div>
              </div>
              
              {/* Tabla de lotes */}
              <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th>N° Lote</th>
                    <th>Ubicación</th>
                    <th>Cantidad</th>
                    <th>Caducidad</th>
                    <th>Meses hasta caducidad</th>
                    <th>Meses para vender</th>
                    <th>Inicio (meses acum)</th>
                    <th>Fin (meses acum)</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {product.batches.map((batch) => (
                    <tr key={batch.id} style={{ backgroundColor: batch.statusColor === '#f44336' ? '#ffebee' : batch.statusColor === '#ff9800' ? '#fff3e0' : 'white' }}>
                      <td>{batch.lot_number || '—'}</td>
                      <td>{batch.location}</td>
                      <td style={{ textAlign: 'center' }}>{batch.quantity}</td>
                      <td style={{ textAlign: 'center' }}>{new Date(batch.expiration_date).toLocaleDateString('es-MX')}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: batch.statusColor }}>
                        {batch.monthsUntilExp} meses
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: batch.statusColor }}>
                        {batch.monthsToSell} meses
                      </td>
                      <td style={{ textAlign: 'center' }}>{batch.startMonth}</td>
                      <td style={{ textAlign: 'center' }}>{batch.endMonth}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ 
                          backgroundColor: batch.statusColor,
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}>
                          {batch.statusText}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Nota si no hay promedio */}
              {product.avgMonthly === 0 && (
                <div style={{ 
                  padding: '8px 15px', 
                  backgroundColor: '#f5f5f5', 
                  fontSize: '12px',
                  color: '#666'
                }}>
                  ⚠️ No hay promedio de venta definido para este producto. Configúralo en la tabla product_sales_avg.
                </div>
              )}
            </div>
          ))}
          
          {/* Leyenda */}
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            backgroundColor: '#f5f5f5', 
            borderRadius: '8px',
            fontSize: '12px'
          }}>
            <strong>📋 Leyenda:</strong>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '8px' }}>
              <span>🟢 <span style={{ color: '#4caf50' }}>OK</span> - Alcanza a vender antes de caducar</span>
              <span>🟡 <span style={{ color: '#ff9800' }}>Atención</span> - Justo, margen ≤ 2 meses</span>
              <span>🔴 <span style={{ color: '#f44336' }}>Riesgo</span> - No alcanza a vender (déficit > 2 meses)</span>
              <span>⚪ <span style={{ color: '#9e9e9e' }}>Sin promedio</span> - Configurar promedio mensual</span>
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: '30px' }}>
        <Link href="/batches" style={{ color: '#0070f3', textDecoration: 'none', marginRight: '20px' }}>
          ← Ver Lotes
        </Link>
        <Link href="/" style={{ color: '#0070f3', textDecoration: 'none' }}>
          Dashboard →
        </Link>
      </div>
    </div>
  )
}
