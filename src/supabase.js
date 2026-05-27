import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fqfrsmxvnkcdsorpsqps.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxZnJzbXh2bmtjZHNvcnBzcXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Mjk1MDMsImV4cCI6MjA5NTQwNTUwM30.qJr-SEWEZj-ljKRGEFurCgbkMsBKRcWMukSqW-M81LU'

export const supabase = createClient(supabaseUrl, supabaseKey)
