import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default function Inventory() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [months, setMonths] = useState([])

  useEffect(() => {
    generateMonthOptions()
  }, [])

  useEffect(() => {
    if (selectedMonth) {
      fetchData()
    }
  }, [selectedMonth])

  // Generar lista de últimos 12 meses
  const generateMonthOptions = () => {
    const options = []
    const today = new Date()
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const monthName = date.toLocaleString('es-MX', { month: 'long' })
      const value = `${year}-${String(month).padStart(2, '0')}-01`
      const label = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`
      options.push({ value, label, year, month })
    }
    
    setMonths(options)
    setSelectedMonth(options[0].value) // Mes actual por defecto
  }

  async function fetchData() {
    setLoading(true)
    setError(null)
    
    try {
      const today = new Date()
      const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
      
      // Determinar si es mes actual o histórico
      const isCurrentMonth = selectedMonth === currentYearMonth
      
      let inventoryData = []
      
      if (isCurrentMonth) {
        // Mes actual: usar inventory_totals + productos + ubicaciones
        const { data: inventory, error: invError } = await supabase
          .from('inventory_totals')
          .select('product_id, location_id, total_stock')
        
        if (invError) throw invError
        
        if (!inventory || inventory.length === 0) {
          setData([])
          setLoading(false)
          return
        }
        
        // Traer productos y ubicaciones para nombres
        const { data: products } = await supabase
          .from('products')
          .select('id, name')
        
        const { data: locations } = await supabase
          .from('locations')
          .select('id, name')
        
        const productMap = {}
        products?.forEach(p => { productMap[p.id] = p.name })
        
        const locationMap = {}
        locations?.forEach(l => { locationMap[l.id] = l.name })
        
        inventoryData = inventory.map(item => ({
          product_name: productMap[item.product_id] || item.product_id,
          location_name: locationMap[item.location_id] || item.location_id,
          total_stock: item.total_stock
        }))
        
      } else {
        // Mes histórico: usar monthly_inventory_snapshot
        const { data: snapshot, error: snapError } = await supabase
          .from('monthly_inventory_snapshot')
          .select(`
            closing_stock,
            product_id,
            location_id,
            products (name),
            locations (name)
          `)
          .eq('year_month', selectedMonth)
        
        if (snapError) throw snapError
        
        if (!snapshot || snapshot.length === 0) {
          setData([])
          setLoading(false)
          return
        }
        
        inventoryData = snapshot.map(item => ({
          product_name: item.products?.name || item.product_id,
          location_name: item.locations?.name || item.location_id,
          total_stock: item.closing_stock
        }))
      }
      
      setData(inventoryData)
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
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
        <h1>📦 Inventario S2POS</h1>
        <p>Cargando datos...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
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

  const selectedMonthLabel = months.find(m => m.value === selectedMonth)?.label || ''

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
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
      
      <h1>📦 Inventario S2POS</h1>
      
      {/* Selector de mes */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontWeight: 'bold', marginRight: '10px' }}>📅 Mes:</label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
        >
          {months.map(month => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
        {selectedMonth !== months[0]?.value && (
          <span style={{ marginLeft: '10px', fontSize: '12px', color: '#ff9800' }}>
            ⚠️ Stock al cierre del mes
          </span>
        )}
      </div>
      
      {data.length === 0 ? (
        <div style={{ 
          backgroundColor: '#fff3e0', 
          padding: '20px', 
          borderRadius: '5px',
          textAlign: 'center',
          color: '#ff9800'
        }}>
          {selectedMonth === months[0]?.value 
            ? 'No hay productos en el inventario.' 
            : `No hay datos disponibles para ${selectedMonthLabel}. Ejecuta el cierre mensual cuando termine el mes.`}
        </div>
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
            {selectedMonth !== months[0]?.value && ' (Stock al cierre del mes)'}
          </div>
        </>
      )}
    </div>
  )
}
