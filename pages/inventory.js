import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Inventory() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      console.log('=== DIAGNÓSTICO DE INVENTARIO ===')
      
      // 1. Traer inventario
      const { data: inventory, error: invError } = await supabase
        .from('inventory_totals')
        .select('product_id, location_id, total_stock')

      if (invError) throw invError
      console.log('1. Inventario:', inventory)

      if (!inventory || inventory.length === 0) {
        setData([])
        setLoading(false)
        return
      }

      // 2. Obtener productos
      const productIds = inventory.map(item => item.product_id)
      console.log('2. Buscando productos con IDs:', productIds)
      
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, name')
      
      if (prodError) throw prodError
      console.log('3. Todos los productos disponibles:', products)
      
      // Crear mapa de productos
      const productMap = {}
      products?.forEach(p => {
        productMap[p.id] = products.name
      })
      console.log('4. Mapa de productos:', productMap)

      // 3. Obtener ubicaciones
      const locationIds = inventory.map(item => item.location_id)
      console.log('5. Buscando ubicaciones con IDs:', locationIds)
      
      const { data: locations, error: locError } = await supabase
        .from('locations')
        .select('id, name')
      
      if (locError) throw locError
      console.log('6. Todas las ubicaciones disponibles:', locations)
      
      // Crear mapa de ubicaciones
      const locationMap = {}
      locations?.forEach(l => {
        locationMap[l.id] = l.name
      })
      console.log('7. Mapa de ubicaciones:', locationMap)

      // 4. Combinar
      const enrichedData = inventory.map(item => {
        const productName = productMap[item.product_id]
        const locationName = locationMap[item.location_id]
        
        console.log(`🔍 Producto ID: ${item.product_id} → ${productName || 'NO ENCONTRADO'}`)
        console.log(`📍 Ubicación ID: ${item.location_id} → ${locationName || 'NO ENCONTRADO'}`)
        
        return {
          ...item,
          product_name: productName || `❌ ${item.product_id}`,
          location_name: locationName || `❌ ${item.location_id}`
        }
      })

      setData(enrichedData)
    } catch (err) {
      console.error('Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>📦 Inventario S2POS</h1>
        <p>Cargando datos...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>📦 Inventario S2POS</h1>
        <div style={{ color: 'red', border: '1px solid red', padding: '10px', borderRadius: '5px' }}>
          <strong>Error:</strong> {error}
        </div>
        <button onClick={fetchData} style={{ marginTop: '10px', padding: '8px 12px', cursor: 'pointer' }}>
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>📦 Inventario S2POS</h1>
      
      {data.length === 0 ? (
        <p>No hay productos en el inventario.</p>
      ) : (
        <>
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th>Producto</th>
                <th>Ubicación</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={index}>
                  <td>{item.product_name}</td>
                  <td>{item.location_name}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {item.total_stock}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
            Total de registros: {data.length}
          </div>
        </>
      )}
    </div>
  )
}
