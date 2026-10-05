export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      block_exercises: {
        Row: {
          block_id: string
          exercise_id: string
          id: string
          orden: number
          reps: string | null
          series: number | null
        }
        Insert: {
          block_id: string
          exercise_id: string
          id?: string
          orden?: number
          reps?: string | null
          series?: number | null
        }
        Update: {
          block_id?: string
          exercise_id?: string
          id?: string
          orden?: number
          reps?: string | null
          series?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "block_exercises_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          color: string | null
          descanso: string | null
          descripcion: string | null
          id: string
          nombre: string
          orden: number
          session_id: string
        }
        Insert: {
          color?: string | null
          descanso?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          orden?: number
          session_id: string
        }
        Update: {
          color?: string | null
          descanso?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          orden?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          dolor: number | null
          energia: number | null
          fecha: string
          id: string
          student_id: string
          sueno: number | null
          visto: boolean
        }
        Insert: {
          dolor?: number | null
          energia?: number | null
          fecha?: string
          id?: string
          student_id: string
          sueno?: number | null
          visto?: boolean
        }
        Update: {
          dolor?: number | null
          energia?: number | null
          fecha?: string
          id?: string
          student_id?: string
          sueno?: number | null
          visto?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "checkins_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      ciclos: {
        Row: {
          id: string
          nombre: string
          orden: number | null
          parent_id: string | null
          plan_id: string | null
          tipo: string
        }
        Insert: {
          id?: string
          nombre: string
          orden?: number | null
          parent_id?: string | null
          plan_id?: string | null
          tipo: string
        }
        Update: {
          id?: string
          nombre?: string
          orden?: number | null
          parent_id?: string | null
          plan_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ciclos_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ciclos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ciclos_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          altura: number | null
          apellido: string | null
          created_at: string | null
          deporte: string | null
          email: string | null
          entrenador_id: string | null
          fecha_nacimiento: string | null
          id: string
          nombre: string
          notas: string | null
          objetivo: string | null
          perfil: string | null
          peso: number | null
          posicion: string | null
          telefono: string | null
        }
        Insert: {
          altura?: number | null
          apellido?: string | null
          created_at?: string | null
          deporte?: string | null
          email?: string | null
          entrenador_id?: string | null
          fecha_nacimiento?: string | null
          id?: string
          nombre: string
          notas?: string | null
          objetivo?: string | null
          perfil?: string | null
          peso?: number | null
          posicion?: string | null
          telefono?: string | null
        }
        Update: {
          altura?: number | null
          apellido?: string | null
          created_at?: string | null
          deporte?: string | null
          email?: string | null
          entrenador_id?: string | null
          fecha_nacimiento?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          objetivo?: string | null
          perfil?: string | null
          peso?: number | null
          posicion?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_entrenador_id_fkey"
            columns: ["entrenador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nombre: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      ejercicios: {
        Row: {
          carga: string | null
          id: string
          nombre: string
          notas: string | null
          orden: number | null
          reps: string | null
          series: number | null
          sesion_id: string | null
          tempo: string | null
          video_url: string | null
        }
        Insert: {
          carga?: string | null
          id?: string
          nombre: string
          notas?: string | null
          orden?: number | null
          reps?: string | null
          series?: number | null
          sesion_id?: string | null
          tempo?: string | null
          video_url?: string | null
        }
        Update: {
          carga?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          orden?: number | null
          reps?: string | null
          series?: number | null
          sesion_id?: string | null
          tempo?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ejercicios_sesion_id_fkey"
            columns: ["sesion_id"]
            isOneToOne: false
            referencedRelation: "sesiones"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_logs: {
        Row: {
          created_at: string
          exercise_id: string
          fecha: string
          id: string
          peso_kg: number
          student_id: string
          training_log_id: string | null
        }
        Insert: {
          created_at?: string
          exercise_id: string
          fecha?: string
          id?: string
          peso_kg: number
          student_id: string
          training_log_id?: string | null
        }
        Update: {
          created_at?: string
          exercise_id?: string
          fecha?: string
          id?: string
          peso_kg?: number
          student_id?: string
          training_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_logs_training_log_id_fkey"
            columns: ["training_log_id"]
            isOneToOne: false
            referencedRelation: "training_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          categoria_id: string | null
          coach_id: string
          created_at: string
          equipamiento: string | null
          grupo: string | null
          id: string
          nombre: string
          obs: string | null
          video_url: string | null
        }
        Insert: {
          categoria_id?: string | null
          coach_id: string
          created_at?: string
          equipamiento?: string | null
          grupo?: string | null
          id?: string
          nombre: string
          obs?: string | null
          video_url?: string | null
        }
        Update: {
          categoria_id?: string | null
          coach_id?: string
          created_at?: string
          equipamiento?: string | null
          grupo?: string | null
          id?: string
          nombre?: string
          obs?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      fotos_progreso: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          id: string
          medicion_id: string | null
          tipo: string | null
          url: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          id?: string
          medicion_id?: string | null
          tipo?: string | null
          url: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          id?: string
          medicion_id?: string | null
          tipo?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "fotos_progreso_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_progreso_medicion_id_fkey"
            columns: ["medicion_id"]
            isOneToOne: false
            referencedRelation: "mediciones"
            referencedColumns: ["id"]
          },
        ]
      }
      mediciones: {
        Row: {
          brazo_der: number | null
          brazo_izq: number | null
          cadera: number | null
          cintura: number | null
          cliente_id: string | null
          created_at: string | null
          entrenador_id: string | null
          fecha: string
          id: string
          masa_adiposa: number | null
          masa_magra: number | null
          muslo_der: number | null
          muslo_izq: number | null
          notas: string | null
          pecho: number | null
          peso: number | null
        }
        Insert: {
          brazo_der?: number | null
          brazo_izq?: number | null
          cadera?: number | null
          cintura?: number | null
          cliente_id?: string | null
          created_at?: string | null
          entrenador_id?: string | null
          fecha?: string
          id?: string
          masa_adiposa?: number | null
          masa_magra?: number | null
          muslo_der?: number | null
          muslo_izq?: number | null
          notas?: string | null
          pecho?: number | null
          peso?: number | null
        }
        Update: {
          brazo_der?: number | null
          brazo_izq?: number | null
          cadera?: number | null
          cintura?: number | null
          cliente_id?: string | null
          created_at?: string | null
          entrenador_id?: string | null
          fecha?: string
          id?: string
          masa_adiposa?: number | null
          masa_magra?: number | null
          muslo_der?: number | null
          muslo_izq?: number | null
          notas?: string | null
          pecho?: number | null
          peso?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mediciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mediciones_entrenador_id_fkey"
            columns: ["entrenador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      planes: {
        Row: {
          activo: boolean | null
          cliente_id: string | null
          created_at: string | null
          entrenador_id: string | null
          id: string
          nivel_inicio: string | null
          nombre: string
          notas: string | null
        }
        Insert: {
          activo?: boolean | null
          cliente_id?: string | null
          created_at?: string | null
          entrenador_id?: string | null
          id?: string
          nivel_inicio?: string | null
          nombre: string
          notas?: string | null
        }
        Update: {
          activo?: boolean | null
          cliente_id?: string | null
          created_at?: string | null
          entrenador_id?: string | null
          id?: string
          nivel_inicio?: string | null
          nombre?: string
          notas?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planes_entrenador_id_fkey"
            columns: ["entrenador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          email: string | null
          id: string
          nombre: string | null
          role: string | null
        }
        Insert: {
          email?: string | null
          id: string
          nombre?: string | null
          role?: string | null
        }
        Update: {
          email?: string | null
          id?: string
          nombre?: string | null
          role?: string | null
        }
        Relationships: []
      }
      programs: {
        Row: {
          coach_id: string
          created_at: string
          descripcion: string | null
          duracion_semanas: number | null
          id: string
          nivel: string | null
          nombre: string
          objetivo: string | null
          owner_student_id: string | null
        }
        Insert: {
          coach_id: string
          created_at?: string
          descripcion?: string | null
          duracion_semanas?: number | null
          id?: string
          nivel?: string | null
          nombre: string
          objetivo?: string | null
          owner_student_id?: string | null
        }
        Update: {
          coach_id?: string
          created_at?: string
          descripcion?: string | null
          duracion_semanas?: number | null
          id?: string
          nivel?: string | null
          nombre?: string
          objetivo?: string | null
          owner_student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_owner_student_id_fkey"
            columns: ["owner_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      registros_rendimiento: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          entrenador_id: string | null
          fecha: string
          id: string
          notas: string | null
          tipo: string
          unidad: string | null
          valor: number | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          entrenador_id?: string | null
          fecha?: string
          id?: string
          notas?: string | null
          tipo: string
          unidad?: string | null
          valor?: number | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          entrenador_id?: string | null
          fecha?: string
          id?: string
          notas?: string | null
          tipo?: string
          unidad?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_rendimiento_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_rendimiento_entrenador_id_fkey"
            columns: ["entrenador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sesiones: {
        Row: {
          ciclo_id: string | null
          id: string
          nombre: string
          orden: number | null
        }
        Insert: {
          ciclo_id?: string | null
          id?: string
          nombre: string
          orden?: number | null
        }
        Update: {
          ciclo_id?: string | null
          id?: string
          nombre?: string
          orden?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sesiones_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "ciclos"
            referencedColumns: ["id"]
          },
        ]
      }
      session_notes: {
        Row: {
          created_at: string
          fecha: string
          id: string
          student_id: string
          texto: string
        }
        Insert: {
          created_at?: string
          fecha?: string
          id?: string
          student_id: string
          texto: string
        }
        Update: {
          created_at?: string
          fecha?: string
          id?: string
          student_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          dia: string | null
          id: string
          movilidad: string | null
          nombre: string
          objetivo: string | null
          orden: number
          week_id: string
        }
        Insert: {
          created_at?: string
          dia?: string | null
          id?: string
          movilidad?: string | null
          nombre: string
          objetivo?: string | null
          orden?: number
          week_id: string
        }
        Update: {
          created_at?: string
          dia?: string | null
          id?: string
          movilidad?: string | null
          nombre?: string
          objetivo?: string | null
          orden?: number
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          altura_cm: number | null
          coach_id: string
          created_at: string
          deporte: string | null
          edad: number | null
          email: string | null
          estado: string
          id: string
          nombre: string
          notas: string | null
          objetivo: string | null
          peso_kg: number | null
          posicion: string | null
          programa_id: string | null
          semana_actual: number
          user_id: string | null
        }
        Insert: {
          altura_cm?: number | null
          coach_id: string
          created_at?: string
          deporte?: string | null
          edad?: number | null
          email?: string | null
          estado?: string
          id?: string
          nombre: string
          notas?: string | null
          objetivo?: string | null
          peso_kg?: number | null
          posicion?: string | null
          programa_id?: string | null
          semana_actual?: number
          user_id?: string | null
        }
        Update: {
          altura_cm?: number | null
          coach_id?: string
          created_at?: string
          deporte?: string | null
          edad?: number | null
          email?: string | null
          estado?: string
          id?: string
          nombre?: string
          notas?: string | null
          objetivo?: string | null
          peso_kg?: number | null
          posicion?: string | null
          programa_id?: string | null
          semana_actual?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          student_id: string
          team_id: string
        }
        Insert: {
          id?: string
          student_id: string
          team_id: string
        }
        Update: {
          id?: string
          student_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      template_block_exercises: {
        Row: {
          exercise_id: string
          id: string
          orden: number
          reps: string | null
          series: number | null
          template_block_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          orden?: number
          reps?: string | null
          series?: number | null
          template_block_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          orden?: number
          reps?: string | null
          series?: number | null
          template_block_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_block_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_block_exercises_template_block_id_fkey"
            columns: ["template_block_id"]
            isOneToOne: false
            referencedRelation: "template_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      template_blocks: {
        Row: {
          color: string | null
          descanso: string | null
          descripcion: string | null
          id: string
          nombre: string
          orden: number
          template_id: string
        }
        Insert: {
          color?: string | null
          descanso?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          orden?: number
          template_id: string
        }
        Update: {
          color?: string | null
          descanso?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          orden?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_blocks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_warmup_exercises: {
        Row: {
          exercise_id: string
          id: string
          orden: number
          reps: string | null
          series: number | null
          template_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          orden?: number
          reps?: string | null
          series?: number | null
          template_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          orden?: number
          reps?: string | null
          series?: number | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_warmup_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_warmup_exercises_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          nombre: string
          tipo: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          nombre: string
          tipo?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          nombre?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      training_logs: {
        Row: {
          comentario: string | null
          created_at: string
          done_blocks: Json
          fecha: string
          id: string
          programa_nombre: string | null
          session_id: string | null
          session_nombre: string | null
          student_id: string
          tiempo_min: number | null
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          done_blocks?: Json
          fecha?: string
          id?: string
          programa_nombre?: string | null
          session_id?: string | null
          session_nombre?: string | null
          student_id: string
          tiempo_min?: number | null
        }
        Update: {
          comentario?: string | null
          created_at?: string
          done_blocks?: Json
          fecha?: string
          id?: string
          programa_nombre?: string | null
          session_id?: string | null
          session_nombre?: string | null
          student_id?: string
          tiempo_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      warmup_exercises: {
        Row: {
          exercise_id: string
          id: string
          orden: number
          reps: string | null
          series: number | null
          session_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          orden?: number
          reps?: string | null
          series?: number | null
          session_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          orden?: number
          reps?: string | null
          series?: number | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warmup_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warmup_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      weeks: {
        Row: {
          created_at: string
          id: string
          numero: number
          program_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          numero: number
          program_id: string
        }
        Update: {
          created_at?: string
          id?: string
          numero?: number
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weeks_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_own_student: { Args: { sid: string }; Returns: boolean }
      link_my_student_account: { Args: never; Returns: undefined }
      student_coach_id: { Args: { sid: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
