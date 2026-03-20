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
      // 1. Traer inventario
      const { data: inventory, error: invError } = await supabase
        .from('inventory_totals')
        .select('*')

      if (invError) throw invError

      if (!inventory || inventory.length === 0) {
        setData([])
        setLoading(false)
        return
      }

      // 2. Obtener todos los productos únicos
      const productIds = [...new Set(inventory.map(item => item.product_id))]
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds)

      if (prodError) throw prodError

      // 3. Obtener todas las ubicaciones únicas
      const locationIds = [...new Set(inventory.map(item => item.location_id))]
      const { data: locations, error: locError } = await supabase
        .from('locations')
        .select('id, name')
        .in('id', locationIds)

      if (locError) throw locError

      // 4. Crear mapas para búsqueda rápida
      const productMap = {}
      products?.forEach(p => { productMap[p.id] = p.name })
      
      const locationMap = {}
      locations?.forEach(l => { locationMap[l.id] = l.name })

      // 5. Combinar datos
      const enrichedData = inventory.map(item => ({
        ...item,
        product_name: productMap[item.product_id] || item.product_id,
        location_name: locationMap[item.location_id] || item.location_id
      }))

      setData(enrichedData)
    } catch (err) {
      console.error('Error al cargar inventario:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>Inventario S2POS</h1>
        <p>Cargando datos...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>Inventario S2POS</h1>
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
              {data.map((item) => (
                <tr key={item.id}>
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
