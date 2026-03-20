import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Inventory() {
  const [data, setData] = useState([])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data, error } = await supabase
      .from('inventory_totals')
      .select('*')

    if (!error) setData(data)
  }

  return (
    <div>
      <h1>Inventario S2POS</h1>
       <table border="1">
        <thead>
           <tr>
            <th>Producto</th>
            <th>Location</th>
            <th>Stock</th>
           </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
               <td>{item.product_id}</td>
               <td>{item.location_id}</td>
               <td>{item.total_stock}</td>
             </tr>
          ))}
        </tbody>
       </table>
    </div>
  )
}
