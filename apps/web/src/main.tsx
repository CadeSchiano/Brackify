import { FormEvent, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile, type User } from 'firebase/auth'
import './firebase'
import { auth } from './firebase'
import { addTournamentPlayer, createTournament, ensureUserProfile, generateDoubleEliminationBracket, generateRoundRobinSchedule, generateSingleEliminationBracket, joinTournamentByCode, recordMatchResult, removeTournamentPlayer, saveTeams, saveUserProfile, subscribeToMatches, subscribeToPlayers, subscribeToTeams, subscribeToTournaments, type StoredTournament, type TournamentMatch, type TournamentPlayer, type UserProfile } from '@brackify/firebase'
import { uploadTournamentImage } from './cloudinary'
import { Bell, ChevronDown, CircleHelp, ClipboardList, Crown, Eye, EyeOff, Grid2X2, LayoutDashboard, MapPin, Menu, MoreHorizontal, Play, Plus, Search, Settings, ShieldCheck, Sparkles, Trophy, Users, X } from 'lucide-react'
import './styles.css'

type Team = { id: string; name: string; initials: string; color: string; members: number; playerIds: string[] }
type Tournament = { name: string; subtitle: string; game: string; format: string; location: string; date: string; players: string[]; teamCount: number; visibility: 'private' | 'public' }

const teamTemplates = ['Falcons', 'Wolves', 'Knights', 'Ravens', 'Sharks', 'Titans', 'Vipers', 'Owls']
const emptyTournament: Tournament = { name: '', subtitle: '', game: '', format: 'Single elimination', location: '', date: '', players: [], teamCount: 4, visibility: 'private' }

function secureShuffle<T>(items: T[]) {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const limit = Math.floor(0x100000000 / (index + 1)) * (index + 1)
    let value = 0
    do {
      const random = new Uint32Array(1)
      crypto.getRandomValues(random)
      value = random[0]
    } while (value >= limit)
    const swapIndex = value % (index + 1)
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

function fromStoredTournament(tournament: StoredTournament): Tournament {
  return { name: tournament.name, subtitle: tournament.description || tournament.game, game: tournament.game, format: tournament.format, location: tournament.location, date: tournament.date, players: tournament.playerNames, teamCount: tournament.maxTeams, visibility: tournament.visibility }
}

function Avatar({ initials, color = '#5063ff' }: { initials: string; color?: string }) {
  return <span className="avatar" style={{ background: color }}>{initials}</span>
}

function App() {
  const [navOpen, setNavOpen] = useState(false)
  const [active, setActive] = useState('Overview')
  const [tournament, setTournament] = useState<Tournament>(emptyTournament)
  const [teams, setTeams] = useState<Team[]>([])
  const [notice, setNotice] = useState('')
  const [dialog, setDialog] = useState<'teams' | 'score' | 'create' | 'player' | 'share' | 'join' | 'app' | null>(null)
  const [score, setScore] = useState({ left: 0, right: 0 })
  const [newPlayer, setNewPlayer] = useState('')
  const [draft, setDraft] = useState<Tournament>(tournament)
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [savedTournaments, setSavedTournaments] = useState<StoredTournament[]>([])
  const [tournamentError, setTournamentError] = useState('')
  const [savingTournament, setSavingTournament] = useState(false)
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [roster, setRoster] = useState<TournamentPlayer[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [tournamentImage, setTournamentImage] = useState<File | null>(null)
  const selectedTournament = savedTournaments.find(item => item.id === selectedTournamentId)
  const canManageRoster = Boolean(user && selectedTournament?.organizerId === user.uid)

  useEffect(() => onAuthStateChanged(auth, currentUser => { setUser(currentUser); setAuthLoading(false) }), [])
  useEffect(() => {
    if (!user) { setProfile(null); return }
    setProfileLoading(true); setProfileError('')
    ensureUserProfile(user).then(setProfile).catch(() => setProfileError('We could not load your profile. Confirm that Cloud Firestore is enabled and its rules are deployed.')).finally(() => setProfileLoading(false))
  }, [user])
  useEffect(() => {
    if (!user) return
    return subscribeToTournaments(user.uid, setSavedTournaments, () => setTournamentError('Could not load tournaments.'))
  }, [user])
  useEffect(() => {
    setRoster([]); setTeams([])
    if (!selectedTournamentId) return
    const unsubscribePlayers = subscribeToPlayers(selectedTournamentId, players => { setRoster(players); setTournament(current => ({ ...current, players: players.map(player => player.name) })) })
    const unsubscribeTeams = subscribeToTeams(selectedTournamentId, storedTeams => setTeams(storedTeams.map(team => ({ ...team, initials: team.name.split(' ').map(word => word[0]).join('').slice(0, 2), members: team.playerIds.length }))))
    return () => { unsubscribePlayers(); unsubscribeTeams() }
  }, [selectedTournamentId])
  useEffect(() => {
    setMatches([])
    return selectedTournamentId ? subscribeToMatches(selectedTournamentId, setMatches) : undefined
  }, [selectedTournamentId])

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 2600) }
  const regenerate = () => {
    const colors = ['#d6ff3f', '#ff6b71', '#8a7cff', '#55c8ff']
    const shuffledPlayers = secureShuffle(roster)
    const shuffledNames = secureShuffle(teamTemplates).slice(0, tournament.teamCount)
    const generated = shuffledNames.map((name, index) => {
      const playerIds = shuffledPlayers.filter((_, playerIndex) => playerIndex % tournament.teamCount === index).map(player => player.id)
      return { id: `team-${index + 1}`, name: `Team ${name}`, initials: name.slice(0, 2).toUpperCase(), color: colors[index % colors.length], members: playerIds.length, playerIds }
    })
    setTeams(generated)
    if (selectedTournamentId) void saveTeams(selectedTournamentId, generated.map(({ id, name, color, playerIds }) => ({ id, name, color, playerIds }))).then(() => notify('Balanced teams saved')).catch(() => notify('Could not save generated teams'))
    else notify('Balanced teams generated')
  }
  const openCreate = () => { setDraft(emptyTournament); setNewPlayer(''); setTournamentImage(null); setDialog('create') }
  const addPlayer = () => {
    const name = newPlayer.trim()
    if (!name || draft.players.includes(name)) return
    setDraft(d => ({ ...d, players: [...d.players, name] })); setNewPlayer('')
  }
  const removePlayer = async (player: TournamentPlayer) => {
    if (!selectedTournamentId || !window.confirm(`Remove ${player.name} from the roster and any assigned team?`)) return
    try { await removeTournamentPlayer(selectedTournamentId, player.id); notify(`${player.name} removed from the roster`) }
    catch (error) { notify(error instanceof Error ? error.message : 'Could not remove player') }
  }
  const editTeam = async (teamId: string, changes: Partial<Pick<Team, 'name' | 'color'>>) => {
    const updated = teams.map(team => team.id === teamId ? { ...team, ...changes, initials: (changes.name || team.name).split(' ').map(word => word[0]).join('').slice(0, 2) } : team)
    setTeams(updated)
    if (!selectedTournamentId) return
    try { await saveTeams(selectedTournamentId, updated.map(({ id, name, color, playerIds }) => ({ id, name, color, playerIds }))); notify('Team customization saved') }
    catch { notify('Could not save team customization') }
  }
  const saveTournament = async () => {
    if (!draft.name.trim() || draft.players.length < 2) { notify('Add a name and at least two players'); return }
    setSavingTournament(true)
    try {
      const imageUrl = tournamentImage ? await uploadTournamentImage(tournamentImage) : undefined
      const stored = await createTournament(user!.uid, { name: draft.name.trim(), description: draft.subtitle.trim() || 'Tournament', game: draft.game.trim() || 'General', location: draft.location, date: draft.date, format: draft.format, visibility: draft.visibility, maxTeams: draft.teamCount, playerNames: draft.players, imageUrl })
      setTournament(fromStoredTournament(stored)); setSelectedTournamentId(stored.id); setTeams([]); setDialog(null); setActive('Teams'); notify('Tournament created — generate your teams')
    } catch { notify('Could not save tournament. Check Firestore rules.') } finally { setSavingTournament(false) }
  }
  const menu = [
    [LayoutDashboard, 'Overview'], [Users, 'Players'], [Trophy, 'Bracket'], [Users, 'Teams'], [ClipboardList, 'Matches'], [MapPin, 'Event hub'],
  ] as const

  if (authLoading) return <div className="auth-shell"><div className="auth-loading"><span className="brand-mark"><span /></span><b>Loading Brackify…</b></div></div>
  if (!user) return <AuthScreen />
  if (profileLoading) return <div className="auth-shell"><div className="auth-loading"><span className="brand-mark"><span /></span><b>Preparing your profile…</b></div></div>
  if (profileError) return <div className="auth-shell"><div className="auth-card"><div className="auth-brand"><span className="brand-mark"><span /></span><b>brackify</b></div><p className="auth-error">{profileError}</p><button className="button primary auth-submit" onClick={() => window.location.reload()}>Try again</button></div></div>
  if (profile && !profile.onboardingComplete) return <ProfileOnboarding user={user} profile={profile} onSaved={setProfile}/>

  return <main>
    <div className={'scrim ' + (navOpen ? 'show' : '')} onClick={() => setNavOpen(false)} />
    <aside className={navOpen ? 'open' : ''}>
      <div className="brand"><span className="brand-mark"><span /></span><span>brackify</span></div>
      <div className="event-switch"><span className="mini-mark">{tournament.name.slice(0, 2).toUpperCase()}</span><div><b>{tournament.name}</b><small>{tournament.subtitle}</small></div><ChevronDown size={16}/></div>
      <nav>
        <p>TOURNAMENT</p>
        {menu.map(([Icon, label]) => <button key={label} className={active === label ? 'selected' : ''} onClick={() => { setActive(label); setNavOpen(false) }}><Icon size={18}/>{label}</button>)}
        <p>WORKSPACE</p>
        <button onClick={() => openCreate()}><Plus size={18}/>Create tournament</button><button onClick={() => { setJoinCode(''); setDialog('join'); setNavOpen(false) }}><Users size={18}/>Join tournament</button><button onClick={() => { setActive('All tournaments'); setNavOpen(false) }}><Grid2X2 size={18}/>All tournaments</button><button><Settings size={18}/>Settings</button>
      </nav>
      <div className="upgrade"><Crown size={18}/><b>Go Premium</b><span>Unlock every format</span><button onClick={() => notify('Premium plans are coming soon')}>Explore plans</button></div>
      <button className="account" onClick={() => signOut(auth)} title="Sign out"><Avatar initials={(user.displayName || user.email || 'U').split(' ').map(x => x[0]).join('').slice(0, 2)} color="#ffc267"/><div><b>{user.displayName || user.email?.split('@')[0]}</b><small>Organizer · Sign out</small></div><MoreHorizontal size={18}/></button>
    </aside>

    <section className="content">
      <header><button className="mobile-menu" onClick={() => setNavOpen(true)}><Menu /></button><div className="crumb"><span>Tournaments</span><b>/</b><strong>{tournament.name}</strong></div><div className="header-actions"><button className="icon-button"><Search size={19}/></button><button className="icon-button notification"><Bell size={19}/><i /></button><button className="help"><CircleHelp size={19}/><span>Help</span></button></div></header>
      <div className="page-heading"><div><div className="eyebrow"><span className="live-dot"/>{selectedTournamentId ? 'LIVE TOURNAMENT' : 'YOUR WORKSPACE'}</div><h1>{active === 'Overview' ? `Welcome${profile?.name ? `, ${profile.name}` : ''}.` : active}</h1><p>{active === 'Overview' ? (selectedTournamentId ? 'Your tournament is ready to manage.' : 'Create or join a tournament to get started.') : `${tournament.name} · ${tournament.subtitle}`}</p></div><div className="heading-actions"><button className="button ghost mobile-app-button" onClick={() => setDialog('app')}>Get the app</button><button className="button ghost" disabled={!selectedTournamentId} onClick={() => setDialog('share')}><Users size={18}/>Invite</button><button className="button primary" onClick={() => active === 'All tournaments' ? openCreate() : selectedTournamentId ? setDialog('share') : openCreate()}><Sparkles size={17}/>{active === 'All tournaments' || !selectedTournamentId ? 'Create tournament' : 'Share tournament'}</button></div></div>

      {active === 'Overview' ? (selectedTournamentId ? <>
        <section className="status-card"><div className="status-top"><div><div className="status-title"><span className="status-icon"><Trophy size={20}/></span><div><h2>{tournament.name}</h2><p>{tournament.subtitle} · {tournament.format}</p></div></div><button className="more"><MoreHorizontal size={20}/></button></div><div className="event-meta"><span><MapPin size={16}/>{tournament.location || 'Location not set'}</span><span className="calendar-dot">◷</span><span>{tournament.date || 'Date not set'}</span></div><div className="progress-row"><div><span>TOURNAMENT STATUS</span><b>{matches.length ? 'Matches in progress' : teams.length ? 'Ready to generate bracket' : 'Ready to generate teams'}</b></div><div className="progress"><i style={{ width: matches.length ? '100%' : teams.length ? '55%' : '20%' }}/></div><strong>{matches.length ? 'LIVE' : 'SETUP'}</strong></div><div className="status-footer"><div className="attendees"><div>{tournament.players.slice(0, 4).map((x, i) => <Avatar key={x} initials={x.split(' ').map(n => n[0]).join('')} color={['#ee8a9e','#5ba9de','#c69cff','#51c8a5'][i]}/>)}</div><span>{tournament.players.length} players · {teams.length} teams</span></div><button className="button primary" onClick={() => setActive('Bracket')}><Play size={16} fill="currentColor"/>Manage matches</button></div></div></section>

        <section className="stats"><Stat icon={<Users/>} title="PLAYERS" value={String(tournament.players.length)} note="Saved roster" tone="purple"/><Stat icon={<Trophy/>} title="TEAMS" value={String(teams.length)} note={teams.length ? 'Teams generated' : 'Not generated'} tone="lime"/><Stat icon={<ClipboardList/>} title="MATCHES" value={String(matches.length)} note={matches.length ? 'Live match schedule' : 'Not generated'} tone="blue"/><Stat icon={<ShieldCheck/>} title="FORMAT" value={tournament.format} note="Tournament format" tone="orange"/></section>
        <div className="split"><section className="panel bracket-panel"><div className="panel-head"><div><h2>Bracket</h2><p>{matches.length ? 'Live match schedule is active.' : 'Generate teams and a bracket to begin.'}</p></div><button className="text-button" onClick={() => setActive('Bracket')}>View bracket <span>→</span></button></div><div className="bracket-empty"><Trophy size={22}/><span>{matches.length ? `${matches.length} live matches` : 'No bracket generated'}</span></div></section><section className="panel activity"><div className="panel-head"><div><h2>Live activity</h2><p>Event updates will appear here.</p></div></div><div className="activity-empty">No activity recorded yet.</div></section></div>
        <section className="panel team-panel"><div className="panel-head"><div><h2>Your teams</h2><p>{teams.length ? 'Balanced and ready to compete.' : 'Add players, then create balanced teams.'}</p></div><button className="text-button" onClick={() => setDialog('teams')}>{teams.length ? 'Regenerate teams' : 'Generate teams'} <span>→</span></button></div><div className="teams">{teams.length ? teams.map(t => <article className="team" key={t.id}><div className="team-logo" style={{ background: t.color }}>{t.initials}</div><div className="team-details"><h3>{t.name}</h3><p>{t.members} players</p><ul>{t.playerIds.map(playerId => <li key={playerId}>{roster.find(player => player.id === playerId)?.name || 'Unknown player'}</li>)}</ul></div></article>) : <button className="generate-empty" onClick={() => setDialog('teams')}><Sparkles/>Generate {tournament.teamCount} balanced teams</button>}</div></section>
      </> : <EmptyDashboard onCreate={openCreate} onBrowse={() => setActive('All tournaments')}/>) : active === 'All tournaments' ? <section className="tournament-list">{tournamentError && <p className="auth-error">{tournamentError}</p>}{savedTournaments.map(item => <button className="tournament-row" key={item.id} onClick={() => { setTournament(fromStoredTournament(item)); setSelectedTournamentId(item.id); setTeams([]); setActive('Overview') }}><span className="tournament-badge">{item.name.slice(0, 2).toUpperCase()}</span><div><b>{item.name}</b><p>{item.description || item.game} · {item.format}</p></div><span>{item.playerNames.length} players</span><span>Open →</span></button>)}{savedTournaments.length === 0 && <div className="empty-tournaments"><Trophy size={24}/><b>No tournaments yet</b><span>Create your first competition to see it here.</span></div>}<button className="new-tournament-row" onClick={openCreate}><Plus/>Create another tournament</button></section> : active === 'Bracket' ? <LiveBracket format={tournament.format} teams={teams} matches={matches} canGenerate={Boolean(selectedTournamentId)} onGenerate={() => selectedTournamentId && (tournament.format === 'Round robin' ? generateRoundRobinSchedule(selectedTournamentId, teams.map(({ id, name, color, playerIds }) => ({ id, name, color, playerIds }))) : tournament.format === 'Double elimination' ? generateDoubleEliminationBracket(selectedTournamentId, teams.map(({ id, name, color, playerIds }) => ({ id, name, color, playerIds })) ) : generateSingleEliminationBracket(selectedTournamentId, teams.map(({ id, name, color, playerIds }) => ({ id, name, color, playerIds })))).then(() => notify(`${tournament.format} schedule generated`)).catch(error => notify(error instanceof Error ? error.message : 'Could not generate bracket'))} onScore={match => { setSelectedMatch(match); setScore({ left: match.scoreA || 0, right: match.scoreB || 0 }); setDialog('score') }} /> : active === 'Players' ? <PlayerManager roster={roster} hasTournament={Boolean(selectedTournamentId)} canManage={canManageRoster} onAdd={() => setDialog('player')} onRemove={removePlayer} /> : active === 'Teams' ? <TeamAssignments teams={teams} roster={roster} onGenerate={() => setDialog('teams')} canManage={canManageRoster} onEdit={editTeam} /> : <section className="empty-state"><div><Trophy size={30}/></div><h2>{active} is ready for you</h2><p>Continue building this section from the tournament dashboard.</p><button className="button primary" onClick={() => setActive('Overview')}>Return to overview</button></section>}
    </section>
    {notice && <div className="toast">✓ {notice}</div>}
    {dialog === 'teams' && <div className="modal-wrap"><div className="modal"><button className="close" onClick={() => setDialog(null)}><X/></button><span className="modal-icon"><Users/></span><h2>Generate balanced teams</h2><p>{tournament.players.length} players will be split evenly into {tournament.teamCount} teams.</p><div className="player-list">{tournament.players.slice(0, 8).map((p, i) => <span key={p}><Avatar initials={p.split(' ').map(x => x[0]).join('')} color={['#ee8a9e','#5ba9de','#c69cff','#51c8a5'][i % 4]}/>{p}</span>)}</div><button className="button primary wide" onClick={() => { regenerate(); setDialog(null) }}><Sparkles size={17}/>Generate teams</button></div></div>}
    {dialog === 'score' && selectedMatch && <div className="modal-wrap"><div className="modal score-modal"><button className="close" onClick={() => setDialog(null)}><X/></button><span className="modal-icon"><ClipboardList/></span><h2>Record match score</h2><p>Round {selectedMatch.round} · Match {selectedMatch.position}</p><div className="score-grid"><b>{teams.find(team => team.id === selectedMatch.teamAId)?.name || 'TBD'}</b><input type="number" min="0" value={score.left} onChange={e => setScore(s => ({ ...s, left: +e.target.value }))}/><span>—</span><input type="number" min="0" value={score.right} onChange={e => setScore(s => ({ ...s, right: +e.target.value }))}/><b>{teams.find(team => team.id === selectedMatch.teamBId)?.name || 'TBD'}</b></div><button className="button primary wide" onClick={() => selectedTournamentId && recordMatchResult(selectedTournamentId, selectedMatch.id, score.left, score.right).then(() => { setDialog(null); notify('Score saved · winner advanced') }).catch(error => notify(error instanceof Error ? error.message : 'Could not save score'))}>Save & advance winner</button></div></div>}
    {dialog === 'player' && <div className="modal-wrap"><div className="modal"><button className="close" onClick={() => setDialog(null)}><X/></button><span className="modal-icon"><Users/></span><h2>Add a player</h2><p>Add them to this tournament’s shared roster.</p><input className="modal-input" autoFocus value={newPlayer} onChange={e => setNewPlayer(e.target.value)} onKeyDown={e => e.key === 'Enter' && selectedTournamentId && addTournamentPlayer(selectedTournamentId, newPlayer).then(() => { setNewPlayer(''); setDialog(null); notify('Player added and synced') }).catch(error => notify(error instanceof Error ? error.message : 'Could not add player'))} placeholder="Player name"/><button className="button primary wide" onClick={() => selectedTournamentId && addTournamentPlayer(selectedTournamentId, newPlayer).then(() => { setNewPlayer(''); setDialog(null); notify('Player added and synced') }).catch(error => notify(error instanceof Error ? error.message : 'Could not add player'))}>Add player</button></div></div>}
    {dialog === 'share' && <div className="modal-wrap"><div className="modal"><button className="close" onClick={() => setDialog(null)}><X/></button><span className="modal-icon"><Sparkles/></span><h2>Invite players</h2><p>Scan this QR code or enter the invite code to join.</p>{selectedTournamentId && savedTournaments.find(item => item.id === selectedTournamentId)?.inviteCode && <img className="web-qr" alt="Tournament invite QR code" src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`Join ${tournament.name} on Brackify with invite code ${savedTournaments.find(item => item.id === selectedTournamentId)?.inviteCode}.`)}`}/>}<div className="invite-code">{savedTournaments.find(item => item.id === selectedTournamentId)?.inviteCode || 'Open a saved tournament'}</div><button className="button primary wide" onClick={() => { const code = savedTournaments.find(item => item.id === selectedTournamentId)?.inviteCode; if (code) { navigator.clipboard?.writeText(code); notify('Invite code copied') } }}>Copy invite code</button></div></div>}
    {dialog === 'join' && <div className="modal-wrap"><div className="modal"><button className="close" onClick={() => setDialog(null)}><X/></button><span className="modal-icon"><Users/></span><h2>Join a tournament</h2><p>Enter the eight-character code shared by the organizer.</p><input className="modal-input invite-input" autoFocus value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={8} placeholder="ABCD1234"/><button className="button primary wide" onClick={() => joinTournamentByCode(user.uid, joinCode).then(id => { setSelectedTournamentId(id); setDialog(null); setActive('All tournaments'); notify('You joined the tournament') }).catch(error => notify(error instanceof Error ? error.message : 'Could not join tournament'))}>Join tournament</button></div></div>}
    {dialog === 'app' && <div className="modal-wrap"><div className="modal"><button className="close" onClick={() => setDialog(null)}><X/></button><span className="modal-icon"><Sparkles/></span><h2>Get Brackify on mobile</h2><p>The iPhone and Android apps are ready for testing. Store download links will appear here once they are published.</p><button className="button primary wide" onClick={() => { window.location.href = 'brackify://'; notify('Opening the Brackify app…') }}>Open Brackify app</button></div></div>}
    {dialog === 'create' && <div className="modal-wrap"><div className="modal create-modal"><button className="close" onClick={() => setDialog(null)}><X/></button><span className="modal-icon"><Plus/></span><h2>Create a tournament</h2><p>Set up the basics, then we’ll make your teams.</p><label>Tournament name<input autoFocus value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Friday Night Cup"/></label><label>Event subtitle<input value={draft.subtitle} onChange={e => setDraft(d => ({ ...d, subtitle: e.target.value }))} placeholder="Summer Showdown"/></label><div className="form-two"><label>Format<select value={draft.format} onChange={e => setDraft(d => ({ ...d, format: e.target.value }))}><option>Single elimination</option><option>Round robin</option><option>Double elimination</option></select></label><label>Teams<select value={draft.teamCount} onChange={e => setDraft(d => ({ ...d, teamCount: Number(e.target.value) }))}><option value="2">2 teams</option><option value="4">4 teams</option><option value="8">8 teams</option></select></label></div><div className="form-two"><label>Location<input value={draft.location} onChange={e => setDraft(d => ({ ...d, location: e.target.value }))} placeholder="Venue or online"/></label><label>Date & time<input value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} placeholder="Aug 3, 6:00 PM"/></label></div><label>Tournament image <small>Optional · 5 MB max</small><input type="file" accept="image/*" onChange={event => setTournamentImage(event.target.files?.[0] || null)}/>{tournamentImage && <span className="image-file-name">{tournamentImage.name}</span>}</label><label>Players <small>{draft.players.length} added</small><div className="add-player"><input value={newPlayer} onChange={e => setNewPlayer(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlayer()} placeholder="Add a player name"/><button type="button" onClick={addPlayer}>Add</button></div></label>{draft.players.length > 0 && <div className="player-chips">{draft.players.map(p => <button key={p} onClick={() => setDraft(d => ({ ...d, players: d.players.filter(x => x !== p) }))}>{p}<X size={11}/></button>)}</div>}<button disabled={savingTournament} className="button primary wide" onClick={saveTournament}>{savingTournament ? (tournamentImage ? 'Uploading image…' : 'Creating…') : 'Create tournament'}</button></div></div>}
  </main>
}

function TeamAssignments({ teams, roster, onGenerate, canManage, onEdit }: { teams: Team[]; roster: TournamentPlayer[]; onGenerate: () => void; canManage: boolean; onEdit: (teamId: string, changes: Partial<Pick<Team, 'name' | 'color'>>) => Promise<void> }) {
  if (!teams.length) return <section className="empty-state"><div><Users size={30}/></div><h2>Ready to make teams?</h2><p>Generate fair, random teams from your current roster.</p><button className="button primary" onClick={onGenerate}><Sparkles size={17}/>Generate teams</button></section>
  return <section className="panel team-panel team-assignments"><div className="panel-head"><div><h2>Team assignments</h2><p>Every player is listed under their assigned team.</p></div>{canManage && <button className="button ghost" onClick={onGenerate}><Sparkles size={16}/>Randomize again</button>}</div><div className="teams">{teams.map(team => <article className="team" key={team.id}><div className="team-logo" style={{ background: team.color }}>{team.initials}</div><div className="team-details"><h3>{team.name}</h3><p>{team.members} players</p><ul>{team.playerIds.map(playerId => <li key={playerId}>{roster.find(player => player.id === playerId)?.name || 'Unknown player'}</li>)}</ul>{canManage && <div className="team-customize"><button className="text-button" onClick={() => { const name = window.prompt('Team name', team.name); if (name?.trim() && name.trim() !== team.name) void onEdit(team.id, { name: name.trim() }) }}>Rename</button><label className="team-color-picker">Color <input aria-label={`${team.name} color`} type="color" value={team.color} onChange={event => void onEdit(team.id, { color: event.target.value })}/></label></div>}</div></article>)}</div></section>
}

function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setPending(true)
    try {
      if (mode === 'signup') {
        const credential = await createUserWithEmailAndPassword(auth, email, password)
        if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() })
      } else await signInWithEmailAndPassword(auth, email, password)
    } catch (caught) { setError(friendlyAuthError(caught)) } finally { setPending(false) }
  }
  const google = async () => {
    setError(''); setPending(true)
    try { await signInWithPopup(auth, new GoogleAuthProvider()) }
    catch (caught) { setError(friendlyAuthError(caught)) } finally { setPending(false) }
  }
  return <div className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><span /></span><b>brackify</b></div><div className="auth-copy"><h1>{mode === 'signin' ? 'Welcome back.' : 'Create your account.'}</h1><p>{mode === 'signin' ? 'Sign in to manage your tournaments.' : 'Start your next tournament in minutes.'}</p></div><button className="google-button" disabled={pending} onClick={google}><span>G</span>Continue with Google</button><div className="auth-divider"><i/>or continue with email<i/></div><form onSubmit={submit}>{mode === 'signup' && <label>Name<input required value={name} onChange={e => setName(e.target.value)} placeholder="Chris James" autoComplete="name"/></label>}<label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/></label><label>Password<span className="password-field"><input required type={passwordVisible ? 'text' : 'password'} minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}/><button type="button" className="password-toggle" aria-label={passwordVisible ? 'Hide password' : 'Show password'} onClick={() => setPasswordVisible(visible => !visible)}>{passwordVisible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></span></label>{error && <p className="auth-error">{error}</p>}<button disabled={pending} className="button primary auth-submit" type="submit">{pending ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button></form><p className="auth-switch">{mode === 'signin' ? 'New to Brackify?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></p></section></div>
}

function friendlyAuthError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (code.includes('invalid-credential')) return 'That email or password is incorrect.'
  if (code.includes('email-already-in-use')) return 'An account already uses that email.'
  if (code.includes('popup-closed')) return 'Google sign-in was cancelled.'
  if (code.includes('weak-password')) return 'Use a password with at least 6 characters.'
  return 'Something went wrong. Please try again.'
}

function ProfileOnboarding({ user, profile, onSaved }: { user: User; profile: UserProfile; onSaved: (profile: UserProfile) => void }) {
  const [draft, setDraft] = useState(profile)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const colors = ['#5263F5', '#FF6B71', '#D6AA13', '#29B68B', '#55A9E8', '#8A7CFF']
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!draft.name.trim() || !/^[a-z0-9_]{3,20}$/i.test(draft.username)) { setError('Add your name and a 3–20 character username using letters, numbers, or underscores.'); return }
    setSaving(true)
    try { const saved = await saveUserProfile(user.uid, { ...draft, name: draft.name.trim(), username: draft.username.trim().toLowerCase(), onboardingComplete: true }); onSaved(saved) }
    catch { setError('We could not save your profile. Please try again.') } finally { setSaving(false) }
  }
  return <div className="auth-shell"><section className="auth-card profile-onboarding"><div className="auth-brand"><span className="brand-mark"><span /></span><b>brackify</b></div><div className="auth-copy"><h1>Make it yours.</h1><p>Set up the profile other players will see.</p></div><form onSubmit={save}><div className="profile-preview" style={{ background: draft.favoriteColor }}>{(draft.name || user.email || 'U').split(' ').map(x => x[0]).join('').slice(0, 2)}</div><label>Name<input required value={draft.name} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))} placeholder="Chris James"/></label><label>Username<input required value={draft.username} onChange={e => setDraft(p => ({ ...p, username: e.target.value }))} placeholder="chrisjames"/><small>Used for player search and mentions.</small></label><label>Bio <em>Optional</em><textarea value={draft.bio} onChange={e => setDraft(p => ({ ...p, bio: e.target.value }))} placeholder="A little about you" maxLength={160}/></label><label>Favorite color<div className="color-options">{colors.map(color => <button type="button" key={color} aria-label={color} onClick={() => setDraft(p => ({ ...p, favoriteColor: color }))} className={draft.favoriteColor === color ? 'picked' : ''} style={{ background: color }}/>)}</div></label>{error && <p className="auth-error">{error}</p>}<button className="button primary auth-submit" disabled={saving}>{saving ? 'Saving…' : 'Finish profile'}</button></form></section></div>
}

function EmptyDashboard({ onCreate, onBrowse }: { onCreate: () => void; onBrowse: () => void }) {
  return <section className="empty-state dashboard-empty"><div><Trophy size={30}/></div><h2>No tournament selected</h2><p>Create a new tournament or open one you have already joined.</p><div><button className="button primary" onClick={onCreate}><Plus size={16}/>Create tournament</button><button className="button ghost" onClick={onBrowse}>Browse tournaments</button></div></section>
}

function LiveBracket({ format, teams, matches, canGenerate, onGenerate, onScore }: { format: string; teams: Team[]; matches: TournamentMatch[]; canGenerate: boolean; onGenerate: () => void; onScore: (match: TournamentMatch) => void }) {
  const maxRound = Math.max(...matches.map(match => match.round), 0)
  const teamName = (id: string | null) => teams.find(team => team.id === id)?.name || 'TBD'
  const standings = teams.map(team => matches.reduce((record, match) => { if (!match.winnerId || (match.teamAId !== team.id && match.teamBId !== team.id)) return record; record.played += 1; if (match.winnerId === team.id) record.wins += 1; else record.losses += 1; record.points += match.teamAId === team.id ? (match.scoreA || 0) : (match.scoreB || 0); return record }, { team, played: 0, wins: 0, losses: 0, points: 0 })).sort((a, b) => b.wins - a.wins || b.points - a.points)
  if (!canGenerate) return <section className="empty-state"><div><Trophy size={30}/></div><h2>Select a tournament first</h2><p>Open a saved tournament, then generate its bracket.</p></section>
  if (!matches.length) return <section className="empty-state"><div><Trophy size={30}/></div><h2>Ready to generate the bracket?</h2><p>{teams.length ? `${teams.length} teams will be seeded into a single-elimination tournament.` : 'Generate teams before creating a bracket.'}</p><button disabled={teams.length < 2} className="button primary" onClick={onGenerate}>Generate bracket</button></section>
  return <section className="panel live-bracket"><div className="panel-head"><div><h2>{format === 'Round robin' ? 'Round robin schedule' : 'Live bracket'}</h2><p>{format === 'Round robin' ? 'Standings update with every saved result.' : 'Scores and advancement update for every viewer.'}</p></div><button className="button ghost" onClick={onGenerate}>Regenerate</button></div>{format === 'Round robin' && <div className="standings"><small>LIVE STANDINGS</small>{standings.map((entry, index) => <div key={entry.team.id}><b>{index + 1}</b><span>{entry.team.name}</span><em>{entry.wins}–{entry.losses}</em><strong>{entry.points} pts</strong></div>)}</div>}<div className="bracket-board">{Array.from({ length: maxRound }, (_, index) => index + 1).map(round => <div className="bracket-column" key={round}><small>{format === 'Round robin' ? `ROUND ${round}` : round === maxRound ? 'CHAMPIONSHIP' : `ROUND ${round}`}</small>{matches.filter(match => match.round === round).map(match => <button className="live-match" key={match.id} disabled={!match.teamAId || !match.teamBId} onClick={() => onScore(match)}><span className={match.winnerId === match.teamAId ? 'winner' : ''}>{teamName(match.teamAId)}<b>{match.scoreA ?? '—'}</b></span><span className={match.winnerId === match.teamBId ? 'winner' : ''}>{teamName(match.teamBId)}<b>{match.scoreB ?? '—'}</b></span></button>)}</div>)}</div></section>
}

function PlayerManager({ roster, hasTournament, canManage, onAdd, onRemove }: { roster: TournamentPlayer[]; hasTournament: boolean; canManage: boolean; onAdd: () => void; onRemove: (player: TournamentPlayer) => void }) {
  if (!hasTournament) return <section className="empty-state"><div><Users size={30}/></div><h2>Select a tournament first</h2><p>Open a saved tournament, then manage its player roster here.</p><button className="button primary" onClick={() => window.location.hash = ''}>Return to overview</button></section>
  return <section className="panel player-manager"><div className="panel-head"><div><h2>Player roster</h2><p>{roster.length} players saved and syncing live.</p></div>{canManage && <button className="button primary" onClick={onAdd}><Plus size={16}/>Add player</button>}</div>{!canManage && <p className="roster-note">Only the organizer can change this roster.</p>}<div className="roster-list">{roster.length ? roster.map((player, index) => <div className="roster-row" key={player.id}><Avatar initials={player.name.split(' ').map(part => part[0]).join('').slice(0, 2)} color={['#ee8a9e','#5ba9de','#c69cff','#51c8a5'][index % 4]}/><b>{player.name}</b><span>{player.checkedIn ? 'Checked in' : 'Not checked in'}</span>{canManage && <button className="text-button roster-remove" onClick={() => onRemove(player)}>Remove</button>}</div>) : <p className="roster-note">No players yet. Add the first player to start the live roster.</p>}</div></section>
}

function Stat({ icon, title, value, note, tone }: { icon: React.ReactNode; title: string; value: string; note: string; tone: string }) { return <article className="stat"><span className={'stat-icon ' + tone}>{icon}</span><div><p>{title}</p><h2>{value}</h2><small>{note}</small></div></article> }
function Match({ a, b, aScore, bScore, aColor }: { a: string; b: string; aScore: string; bScore: string; aColor: string }) { return <div className="match"><div><i style={{ background: aColor }}/><span>{a}</span><b>{aScore}</b></div><div><i style={{ background: '#ff6b71' }}/><span>{b}</span><b>{bScore}</b></div></div> }
function Activity({ badge, color, title, text, time }: { badge: string; color: string; title: string; text: string; time: string }) { return <div className="activity-item"><span style={{ background: color }}>{badge}</span><div><b>{title}</b><p>{text}</p></div><time>{time}</time></div> }

createRoot(document.getElementById('root')!).render(<App />)
