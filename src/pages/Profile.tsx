// FR-23 profilo pubblico, FR-24 eliminazione account; il proprietario vede anche pending e rifiutati
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { CARD, formatDate, must, useData, useTitle, type Card } from '../lib/data'
import { ErrorText, MemeCard, Status, secondary } from '../components/ui'
import { t } from '../locales/it'

type Row = Card & { status: string; moderation_note: string | null }

export function Profile() {
  const { username = '' } = useParams()
  const { profile: me } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string>()
  const { data, loading, error: loadError } = useData(async () => {
    const p = await supabase.from('profiles').select('id, username, created_at').eq('username', username).maybeSingle()
    if (p.error) throw p.error
    if (!p.data) return null
    // RLS: il pubblico riceve solo gli approvati, il proprietario anche gli altri
    const memes = await supabase.from('memes').select(`${CARD}, status, moderation_note`)
      .eq('uploader_id', p.data.id).order('created_at', { ascending: false })
    return { user: p.data, memes: must(memes) as Row[] }
  }, [username, me?.id])
  useTitle(data ? t.profile.title(data.user.username) : undefined)

  if (loadError) return <Status error />
  if (loading) return <Status loading />
  if (!data) return <Status empty={t.profile.notFound} />
  const own = me?.id === data.user.id
  const approved = data.memes.filter((m) => m.status === 'approved')
  const others = data.memes.filter((m) => m.status !== 'approved')

  async function deleteAccount() {
    if (!confirm(t.profile.deleteConfirm)) return
    const { error } = await supabase.rpc('delete_my_account')
    if (error) return setError(t.errors.generic)
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">{data.user.username}</h1>
      <p className="text-slate-600">{t.profile.since(formatDate(data.user.created_at))} · {t.profile.approved(approved.length)}</p>

      {own && others.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">{t.profile.yours}</h2>
          <ul className="mt-3 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
            {others.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${m.status === 'pending' ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-900'}`}>
                  {t.statusBadge[m.status]}
                </span>
                {m.status === 'pending' ? <Link className="font-medium underline" to={`/meme/${m.slug}`}>{m.title}</Link>
                  : <span className="font-medium">{m.title}</span>}
                {m.moderation_note && m.status !== 'pending' && <span className="w-full text-slate-600">{m.moderation_note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        {approved.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {approved.map((m) => <li key={m.id}><MemeCard meme={m} /></li>)}
          </ul>
        ) : <Status empty={t.profile.none} />}
      </section>

      {own && (
        <section className="mt-10 flex flex-wrap gap-3 border-t border-slate-200 pt-4">
          <button className={secondary} onClick={() => supabase.auth.signOut().then(() => navigate('/'))}>{t.profile.signOut}</button>
          <button className={`${secondary} text-rose-700`} onClick={deleteAccount}>{t.profile.deleteAccount}</button>
          <ErrorText>{error}</ErrorText>
        </section>
      )}
    </>
  )
}
