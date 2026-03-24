import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

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
        .select('product_id, location_id, total_stock')

      if (invError) throw invError

      if (!inventory || inventory.length === 0) {
        setData([])
        setLoading(false)
        return
      }

      // 2. Traer productos
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, name')

      if (prodError) throw prodError
      console.log('Productos:', products)

      // 3. Traer ubicaciones
      const { data: locations, error: locError } = await supabase
        .from('locations')
        .select('id, name')

      if (locError) throw locError
      console.log('Ubicaciones:', locations)

      // 4. Crear mapas
      const productMap = {}
      products?.forEach(p => {
        productMap[p.id] = p.name
        console.log(`Mapeando: ${p.id} → ${p.name}`)
      })

      const locationMap = {}
      locations?.forEach(l => {
        locationMap[l.id] = l.name
      })

      // 5. Combinar
      const enrichedData = inventory.map(item => ({
        product_name: productMap[item.product_id] || item.product_id,
        location_name: locationMap[item.location_id] || item.location_id,
        total_stock: item.total_stock
      }))

      console.log('Mapa productos final:', productMap)
      console.log('Datos enriquecidos:', enrichedData)

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
      
      {/* Botón de Dashboard */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        marginBottom: '20px'
      }}>
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
