import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default function Batches() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchBatches()
  }, [])

  async function fetchBatches() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventory_batches')
        .select(`
          id,
          quantity,
          lot_number,
          expiration_date,
          created_at,
          products (name),
          locations (name)
        `)
        .gt('quantity', 0)
        .order('expiration_date', { ascending: true }) // FIFO: los que vencen primero arriba

      if (error) throw error
      setBatches(data || [])
    } catch (err) {
      console.error('Error cargando lotes:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

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
        <button onClick={fetchBatches} style={{ marginTop: '10px', padding: '8px 12px', cursor: 'pointer' }}>
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
        💡 Listado de todos los lotes activos. Ordenados por fecha de caducidad (más cercana primero).
      </div>

      {batches.length === 0 ? (
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
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th>Producto</th>
                <th>N° Lote</th>
                <th>Ubicación</th>
                <th>Cantidad</th>
                <th>Fecha de Caducidad</th>
               </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td>{batch.products?.name || batch.product_id?.slice(0, 8)}</td>
                  <td>{batch.lot_number || '—'}</td>
                  <td>{batch.locations?.name || batch.location_id?.slice(0, 8)}</td>
                  <td style={{ textAlign: 'center' }}>{batch.quantity}</td>
                  <td style={{ textAlign: 'center' }}>
                    {new Date(batch.expiration_date).toLocaleDateString('es-MX')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
            Total de lotes activos: {batches.length}
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
