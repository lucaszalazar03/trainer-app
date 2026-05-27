import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const thStyle = { padding: '8px 6px', textAlign: 'left', fontSize: 12, color: '#666', fontWeight: 600, borderBottom: '2px solid #ddd', whiteSpace: 'nowrap' }
const tdStyle = { padding: '6px', fontSize: 13, borderBottom: '1px solid #eee', verticalAlign: 'middle' }
const inputStyle = { width: '100%', padding: '4px 6px', fontSize: 13, border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box' }

function Planes({ session, clienteId, clienteNombre }) {
  const [planes, setPlanes] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [nombre, setNombre] = useState('')
  const [nivelInicio, setNivelInicio] = useState('microciclo')
  const [notas, setNotas] = useState('')
  const [planSeleccionado, setPlanSeleccionado] = useState(null)

  useEffect(() => { fetchPlanes() }, [clienteId])

  const fetchPlanes = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('planes').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false })
    if (!error) setPlanes(data)
    setLoading(false)
  }

  const crearPlan = async () => {
    if (!nombre) return
    const { error } = await supabase.from('planes').insert({ cliente_id: clienteId, entrenador_id: session.user.id, nombre, nivel_inicio: nivelInicio, notas })
    if (!error) { setNombre(''); setNivelInicio('microciclo'); setNotas(''); setMostrarFormulario(false); fetchPlanes() }
  }

  const eliminarPlan = async (id) => {
    if (!window.confirm('Eliminar este plan?')) return
    await supabase.from('planes').delete().eq('id', id)
    fetchPlanes()
  }

  if (planSeleccionado) {
    return <DetallePlan plan={planSeleccionado} session={session} onVolver={() => setPlanSeleccionado(null)} />
  }

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ margin: '0 0 16px' }}>Planes de {clienteNombre}</h3>
      <button onClick={() => setMostrarFormulario(!mostrarFormulario)} style={{ marginBottom: 16, padding: '8px 16px' }}>
        {mostrarFormulario ? 'Cancelar' : '+ Nuevo plan'}
      </button>
      {mostrarFormulario && (
        <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <input placeholder="Nombre del plan *" value={nombre} onChange={e => setNombre(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
          <select value={nivelInicio} onChange={e => setNivelInicio(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }}>
            <option value="microciclo">Desde semanas</option>
            <option value="mesociclo">Desde mesociclo</option>
            <option value="macrociclo">Desde macrociclo</option>
          </select>
          <textarea placeholder="Notas" value={notas} onChange={e => setNotas(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 12, padding: 8, minHeight: 60 }} />
          <button onClick={crearPlan} style={{ padding: '8px 24px' }}>Crear plan</button>
        </div>
      )}
      {loading ? <p>Cargando...</p> : planes.length === 0 ? <p>No hay planes todavía.</p> : (
        planes.map(p => (
          <div key={p.id} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div onClick={() => setPlanSeleccionado(p)} style={{ cursor: 'pointer', flex: 1 }}>
              <strong>{p.nombre}</strong>
              <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>{p.nivel_inicio === 'microciclo' ? 'Desde semanas' : p.nivel_inicio === 'mesociclo' ? 'Desde mesociclo' : 'Macrociclo completo'}</p>
            </div>
            <button onClick={() => eliminarPlan(p.id)} style={{ padding: '4px 8px', fontSize: 12, color: 'red', background: 'none', border: '1px solid red', borderRadius: 4 }}>Eliminar</button>
          </div>
        ))
      )}
    </div>
  )
}function DetallePlan({ plan, session, onVolver }) {
  const [ciclos, setCiclos] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarFormCiclo, setMostrarFormCiclo] = useState(false)
  const [nombreCiclo, setNombreCiclo] = useState('')

  useEffect(() => { fetchCiclos() }, [])

  const fetchCiclos = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('ciclos').select('*, sesiones(*, ejercicios(*))').eq('plan_id', plan.id).is('parent_id', null).order('orden')
    if (!error) setCiclos(data)
    setLoading(false)
  }

  const crearCiclo = async () => {
    if (!nombreCiclo) return
    const { error } = await supabase.from('ciclos').insert({ plan_id: plan.id, tipo: plan.nivel_inicio, nombre: nombreCiclo, orden: ciclos.length + 1 })
    if (!error) { setNombreCiclo(''); setMostrarFormCiclo(false); fetchCiclos() }
  }

  const labelTipo = plan.nivel_inicio === 'microciclo' ? 'Semana' : plan.nivel_inicio === 'mesociclo' ? 'Mesociclo' : 'Macrociclo'

  return (
    <div style={{ padding: 16 }}>
      <button onClick={onVolver} style={{ marginBottom: 16, padding: '4px 12px', fontSize: 12 }}>← Volver a planes</button>
      <h3 style={{ margin: '0 0 4px' }}>{plan.nombre}</h3>
      {plan.notas && <p style={{ color: '#666', fontSize: 13, margin: '0 0 16px' }}>{plan.notas}</p>}
      <button onClick={() => setMostrarFormCiclo(!mostrarFormCiclo)} style={{ marginBottom: 16, padding: '8px 16px' }}>
        {mostrarFormCiclo ? 'Cancelar' : '+ Nueva ' + labelTipo}
      </button>
      {mostrarFormCiclo && (
        <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <input placeholder={'Nombre ej: ' + labelTipo + ' 1'} value={nombreCiclo} onChange={e => setNombreCiclo(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
          <button onClick={crearCiclo} style={{ padding: '8px 24px' }}>Crear {labelTipo}</button>
        </div>
      )}
      {loading ? <p>Cargando...</p> : ciclos.length === 0 ? <p>No hay {labelTipo.toLowerCase()}s todavía.</p> : (
        ciclos.map(ciclo => <CicloItem key={ciclo.id} ciclo={ciclo} onActualizar={fetchCiclos} />)
      )}
    </div>
  )
}

function CicloItem({ ciclo, onActualizar }) {
  const [expandido, setExpandido] = useState(false)
  const [mostrarFormSesion, setMostrarFormSesion] = useState(false)
  const [nombreSesion, setNombreSesion] = useState('')

  const crearSesion = async () => {
    if (!nombreSesion) return
    const { error } = await supabase.from('sesiones').insert({ ciclo_id: ciclo.id, nombre: nombreSesion, orden: (ciclo.sesiones?.length || 0) + 1 })
    if (!error) { setNombreSesion(''); setMostrarFormSesion(false); onActualizar() }
  }

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
      <div onClick={() => setExpandido(!expandido)} style={{ padding: '12px 16px', background: '#f9f9f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
        <strong>{ciclo.nombre}</strong>
        <span>{expandido ? '▲' : '▼'}</span>
      </div>
      {expandido && (
        <div style={{ padding: 12 }}>
          <button onClick={() => setMostrarFormSesion(!mostrarFormSesion)} style={{ marginBottom: 12, padding: '6px 12px', fontSize: 13 }}>
            {mostrarFormSesion ? 'Cancelar' : '+ Agregar sesión'}
          </button>
          {mostrarFormSesion && (
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, marginBottom: 12 }}>
              <input placeholder="Nombre (ej: Lunes, Sesión 1)" value={nombreSesion} onChange={e => setNombreSesion(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
              <button onClick={crearSesion} style={{ padding: '6px 16px' }}>Crear sesión</button>
            </div>
          )}
          {ciclo.sesiones?.length === 0 ? <p style={{ color: '#999', fontSize: 13 }}>No hay sesiones.</p> : (
            ciclo.sesiones?.map(sesion => <SesionItem key={sesion.id} sesion={sesion} onActualizar={onActualizar} />)
          )}
        </div>
      )}
    </div>
  )
}function SesionItem({ sesion, onActualizar }) {
  const [expandido, setExpandido] = useState(false)
  const [ejercicios, setEjercicios] = useState(sesion.ejercicios || [])
  const [agregando, setAgregando] = useState(false)
  const [nuevo, setNuevo] = useState({ nombre: '', series: '', reps: '', carga: '', notas: '' })

  const agregarEjercicio = async () => {
    if (!nuevo.nombre) return
    const { error } = await supabase.from('ejercicios').insert({ sesion_id: sesion.id, nombre: nuevo.nombre, series: nuevo.series ? parseInt(nuevo.series) : null, reps: nuevo.reps, carga: nuevo.carga, notas: nuevo.notas, orden: ejercicios.length + 1 })
    if (!error) {
      const { data } = await supabase.from('ejercicios').select('*').eq('sesion_id', sesion.id).order('orden')
      setEjercicios(data)
      setNuevo({ nombre: '', series: '', reps: '', carga: '', notas: '' })
      setAgregando(false)
    }
  }

  const eliminarEjercicio = async (id) => {
    await supabase.from('ejercicios').delete().eq('id', id)
    setEjercicios(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div style={{ border: '1px solid #eee', borderRadius: 6, marginBottom: 8 }}>
      <div onClick={() => setExpandido(!expandido)} style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', background: '#fafafa' }}>
        <strong style={{ fontSize: 14 }}>{sesion.nombre}</strong>
        <span style={{ fontSize: 12, color: '#999' }}>{ejercicios.length} ejercicios {expandido ? '▲' : '▼'}</span>
      </div>
      {expandido && (
        <div style={{ padding: 12 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, minWidth: 140 }}>EJERCICIO</th>
                  <th style={{ ...thStyle, width: 55, textAlign: 'center' }}>SERIES</th>
                  <th style={{ ...thStyle, width: 55, textAlign: 'center' }}>REPS</th>
                  <th style={{ ...thStyle, width: 65, textAlign: 'center' }}>CARGA</th>
                  <th style={{ ...thStyle, minWidth: 100 }}>NOTAS</th>
                  <th style={{ ...thStyle, width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {ejercicios.map(ej => (
                  <tr key={ej.id}>
                    <td style={tdStyle}>{ej.nombre}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{ej.series || '-'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{ej.reps || '-'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{ej.carga || '-'}</td>
                    <td style={tdStyle}>{ej.notas || '-'}</td>
                    <td style={tdStyle}>
                      <button onClick={() => eliminarEjercicio(ej.id)} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer', fontSize: 14 }}>✕</button>
                    </td>
                  </tr>
                ))}
                {agregando && (
                  <tr>
                    <td style={tdStyle}><input value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Ejercicio *" style={inputStyle} /></td>
                    <td style={{ ...tdStyle, width: 55 }}><input value={nuevo.series} onChange={e => setNuevo({ ...nuevo, series: e.target.value })} placeholder="4" style={inputStyle} /></td>
                    <td style={{ ...tdStyle, width: 55 }}><input value={nuevo.reps} onChange={e => setNuevo({ ...nuevo, reps: e.target.value })} placeholder="8" style={inputStyle} /></td>
                    <td style={{ ...tdStyle, width: 65 }}><input value={nuevo.carga} onChange={e => setNuevo({ ...nuevo, carga: e.target.value })} placeholder="60kg" style={inputStyle} /></td>
                    <td style={tdStyle}><input value={nuevo.notas} onChange={e => setNuevo({ ...nuevo, notas: e.target.value })} placeholder="Notas" style={inputStyle} /></td>
                    <td style={tdStyle}>
                      <button onClick={agregarEjercicio} style={{ background: 'none', border: 'none', color: 'green', cursor: 'pointer', fontSize: 16 }}>✓</button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button onClick={() => setAgregando(!agregando)} style={{ marginTop: 8, padding: '6px 12px', fontSize: 13 }}>
            {agregando ? 'Cancelar' : '+ Agregar ejercicio'}
          </button>
        </div>
      )}
    </div>
  )
}

export default Planes