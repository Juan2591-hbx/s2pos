import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default function Batches() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchBatchesByProduct()
  }, [])

  async function fetchBatchesByProduct() {
    setLoading(true)
    try {
      // Primero traemos todos los productos que tienen lotes activos
      const { data: batchesData, error: batchesError } = await supabase
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

      // Agrupar por producto
      const productMap = new Map()
      
      batchesData?.forEach(batch => {
        const productId = batch.product_id
        const productName = batch.products?.name || productId?.slice(0, 8)
        
        if (!productMap.has(productId)) {
          productMap.set(productId, {
            id: productId,
            name: productName,
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

      // Convertir mapa a array y ordenar productos por nombre
      const productList = Array.from(productMap.values())
      productList.sort((a, b) => a.name.localeCompare(b.name))
      
      setProducts(productList)
    } catch (err) {
      console.error('Error cargando lotes:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const totalLotes = products.reduce((sum, p) => sum + p.batches.length, 0)
  const totalUnidades = products.reduce((sum, p) => sum + p.batches.reduce((s, b) => s + b.quantity, 0), 0)

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>📦 Control de Lotes</h1>
        <p>Cargando lotes...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>📦 Control de Lotes</h1>
        <div style={{ color: 'red', border: '1px solid red', padding: '10px', borderRadius: '5px' }}>
          <strong>Error:</strong> {error}
        </div>
        <button onClick={fetchBatchesByProduct} style={{ marginTop: '10px', padding: '8px 12px', cursor: 'pointer' }}>
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>📦 Control de Lotes</h1>
      
      <div style={{ 
        backgroundColor: '#e3f2fd', 
        padding: '12px', 
        borderRadius: '5px', 
        marginBottom: '20px',
        borderLeft: '4px solid #2196f3'
      }}>
        💡 Lotes agrupados por producto. Ordenados por fecha de caducidad (más cercana primero dentro de cada producto).
      </div>

      {products.length === 0 ? (
        <div style={{ 
          backgroundColor: '#fff3e0', 
          padding: '20px', 
          borderRadius: '5px',
          textAlign: 'center',
          color: '#ff9800'
        }}>
          No hay lotes activos.
        </div>
      ) : (
        <>
          {products.map((product) => (
            <div key={product.id} style={{ marginBottom: '30px' }}>
              <h2 style={{ 
                backgroundColor: '#f0f0f0', 
                padding: '10px', 
                borderRadius: '8px',
                marginBottom: '10px'
              }}>
                {product.name}
              </h2>
              
              <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th>N° Lote</th>
                    <th>Ubicación</th>
                    <th>Cantidad</th>
                    <th>Fecha de Caducidad</th>
                   </tr>
                </thead>
                <tbody>
                  {product.batches.map((batch) => (
                    <tr key={batch.id}>
                      <td>{batch.lot_number || '—'}</td>
                      <td>{batch.location}</td>
                      <td style={{ textAlign: 'center' }}>{batch.quantity}</td>
                      <td style={{ textAlign: 'center' }}>
                        {new Date(batch.expiration_date).toLocaleDateString('es-MX')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Totales por producto */}
              <div style={{ 
                marginTop: '8px', 
                fontSize: '12px', 
                color: '#666',
                textAlign: 'right'
              }}>
                Total: {product.batches.reduce((sum, b) => sum + b.quantity, 0)} unidades | 
                Lotes: {product.batches.length}
              </div>
            </div>
          ))}
          
          {/* Totales generales */}
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            backgroundColor: '#f5f5f5', 
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <strong>📊 Resumen general:</strong> {products.length} productos | {totalLotes} lotes | {totalUnidades} unidades totales
          </div>
        </>
      )}

      <div style={{ marginTop: '30px' }}>
        <Link href="/inventory" style={{ color: '#0070f3', textDecoration: 'none', marginRight: '20px' }}>
          ← Ver Inventario
        </Link>
        <Link href="/" style={{ color: '#0070f3', textDecoration: 'none' }}>
          Dashboard →
        </Link>
      </div>
    </div>
  )
}
