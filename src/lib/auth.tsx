import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Database } from './database.types'
import { Status } from '../components/ui'
import { t } from '../locales/it'

export type Profile = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'username' | 'role' | 'created_at'>

// undefined = ancora in caricamento, null = assente
type Auth = { session?: Session | null; profile?: Profile | null; reloadProfile: () => Promise<void> }
const AuthContext = createContext<Auth>({ reloadProfile: async () => {} })
export const useAuth = () => useContext(AuthContext)
export const isCurator = (p?: Profile | null) => p?.role === 'curator' || p?.role === 'admin'

const fetchProfile = async (uid: string) =>
  (await supabase.from('profiles').select('id, username, role, created_at').eq('id', uid).maybeSingle()).data

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>()
  const [loaded, setLoaded] = useState<{ uid: string; profile: Profile | null }>()

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id
  useEffect(() => {
    if (!uid) return
    let live = true
    fetchProfile(uid).then((profile) => live && setLoaded({ uid, profile }))
    return () => { live = false }
  }, [uid])
  const reloadProfile = async () => { if (uid) setLoaded({ uid, profile: await fetchProfile(uid) }) }

  const profile = session === undefined ? undefined : !uid ? null
    : loaded?.uid === uid ? loaded.profile : undefined
  return (
    <AuthContext.Provider value={{ session, profile, reloadProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

/** Pagine riservate: senza sessione al login, senza profilo al completamento profilo. */
export function RequireMember({ curator, children }: { curator?: boolean; children: ReactNode }) {
  const { session, profile } = useAuth()
  const { pathname, search } = useLocation()
  const next = encodeURIComponent(pathname + search)
  if (session === null) return <Navigate to={`/accedi?next=${next}`} replace />
  if (profile === undefined) return <Status loading />
  if (profile === null) return <Navigate to={`/benvenuto?next=${next}`} replace />
  if (curator && !isCurator(profile)) return <Status empty={t.moderation.forbidden} />
  return children
}
