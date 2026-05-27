import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import FichaCliente from './FichaCliente'

function Clientes({ session }) {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [perfil, setPerfil] = useState('recreacional')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)

  useEffect(() => {
    fetchClientes()
  }, [])

  const fetchClientes = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setClientes(data)
    setLoading(false)
  }

  const agregarCliente = async () => {
    if (!nombre) return
    const { error } = await supabase.from('clientes').insert({
      nombre,
      apellido,
      email,
      telefono,
      objetivo,
      perfil,
      entrenador_id: session.user.id
    })
    if (!error) {
      setNombre('')
      setApellido('')
      setEmail('')
      setTelefono('')
      setObjetivo('')
      setPerfil('recreacional')
      setMostrarFormulario(false)
      fetchClientes()
    }
  }

  if (clienteSeleccionado) {
    return (
      <FichaCliente
        cliente={clienteSeleccionado}
        session={session}
        onVolver={() => { setClienteSeleccionado(null); fetchClientes() }}
        onActualizar={() => {
          fetchClientes()
          setClienteSeleccionado(prev => clientes.find(c => c.id === prev.id) || prev)
        }}
      />
    )
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Clientes</h2>

      <button
        onClick={() => setMostrarFormulario(!mostrarFormulario)}
        style={{ marginBottom: 16, padding: '8px 16px' }}
      >
        {mostrarFormulario ? 'Cancelar' : '+ Nuevo cliente'}
      </button>

      {mostrarFormulario && (
        <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <h3>Nuevo cliente</h3>
          <input placeholder="Nombre *" value={nombre} onChange={e => setNombre(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
          <input placeholder="Apellido" value={apellido} onChange={e => setApellido(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
          <input placeholder="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
          <input placeholder="Objetivo" value={objetivo} onChange={e => setObjetivo(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
          <select value={perfil} onChange={e => setPerfil(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: 12, padding: 8 }}>
            <option value="recreacional">Recreacional</option>
            <option value="atleta">Atleta</option>
          </select>
          <button onClick={agregarCliente} style={{ padding: '8px 24px' }}>
            Guardar cliente
          </button>
        </div>
      )}

      {loading ? (
        <p>Cargando...</p>
      ) : clientes.length === 0 ? (
        <p>No hay clientes todavía.</p>
      ) : (
        clientes.map(c => (
          <div
            key={c.id}
            onClick={() => setClienteSeleccionado(c)}
            style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 8, cursor: 'pointer' }}
          >
            <strong>{c.nombre} {c.apellido}</strong>
            <p style={{ margin: '4px 0', color: '#666' }}>{c.perfil} · {c.objetivo}</p>
            <p style={{ margin: 0, color: '#999', fontSize: 12 }}>{c.email} {c.telefono}</p>
          </div>
        ))
      )}
    </div>
  )
}

export default Clientes
