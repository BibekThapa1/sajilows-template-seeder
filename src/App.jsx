import { useState } from 'react'
import automateFunction, { authorize, deleteAllData } from './call'
import { APIS } from './apis/api.js'
import './App.css'

const endpointTitle = (endpoint) => {
  const titles = {
    '/api/v1/resturant-menu/menu-category/': 'Menu categories',
    '/api/v1/resturant-menu/menu-item/': 'Menu items',
    '/api/v1/room/room-facilities-categories/': 'Room facility categories',
    '/api/v1/room/room-facilities-items/': 'Room facility items',
    '/api/v1/room/room-type/': 'Room types',
    '/api/v1/room/floors/': 'Floors',
    '/api/v1/room/rooms/': 'Rooms',
    '/api/v1/room/room-image/': 'Room images',
    '/api/v1/facilities/facilities/': 'Facilities page',
    '/api/v1/home-page/facilities-home-page/': 'Home page facilities',
    '/api/v1/gallery/gallery-category/': 'Gallery categories',
    '/api/v1/gallery/gallery-image/': 'Gallery images',
    '/api/v1/home-page/awards-and-recognition/': 'Awards & recognition',
    '/api/v1/home-page/benefits/': 'Benefits',
    '/api/v1/home-page/testemonail/': 'Testimonials',
  }
  return titles[endpoint] ?? endpoint
}

const App = () => {
  const [backendUrl, setBackendUrl] = useState('templates-api.hamroyouthit.com')
  const [forwardedHost, setForwardedHost] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [progress, setProgress] = useState([])
  const [issues, setIssues] = useState([])
  const [runSummary, setRunSummary] = useState(null)
  const [deleteSummary, setDeleteSummary] = useState(null)
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('sajillow-access-token') ?? '')
  const [authenticatedUser, setAuthenticatedUser] = useState(() => localStorage.getItem('sajillow-auth-user') ?? '')
  const [showAuthorize, setShowAuthorize] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [loginEndpoint, setLoginEndpoint] = useState(APIS.auth.login)
  const [email, setEmail] = useState('admin1@gmail.com')
  const [password, setPassword] = useState('admin')
  const [authError, setAuthError] = useState('')
  const [isAuthorizing, setIsAuthorizing] = useState(false)

  const handleAuthorize = async (event) => {
    event.preventDefault()
    setAuthError('')
    setIsAuthorizing(true)
    try {
      const session = await authorize(backendUrl, loginEndpoint, email, password, forwardedHost)
      localStorage.setItem('sajillow-access-token', session.accessToken)
      if (session.user?.email) localStorage.setItem('sajillow-auth-user', session.user.email)
      setAccessToken(session.accessToken)
      setAuthenticatedUser(session.user?.email ?? email)
      setShowAuthorize(false)
    } catch (error) {
      const data = error.response?.data
      const detail = data?.detail ?? data?.message ?? data
      setAuthError(typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : error.message ?? 'Authorization failed.')
    } finally {
      setIsAuthorizing(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('sajillow-access-token')
    localStorage.removeItem('sajillow-auth-user')
    setAccessToken('')
    setAuthenticatedUser('')
  }

  const trackProgress = (event) => {
    setProgress((current) => {
      const existing = current.find((entry) => entry.endpoint === event.endpoint)
      const updated = { ...(existing ?? {
        endpoint: event.endpoint,
        state: 'queued',
        completed: 0,
        total: 0,
        posted: 0,
        deleted: 0,
        failed: 0,
        blocked: 0,
        reason: '',
      }) }

      if (event.type === 'endpoint-start') {
        updated.state = 'running'
        updated.action = 'post'
        updated.total = event.total
      } else if (event.type === 'request-success') {
        updated.completed = event.completed
        updated.posted += 1
      } else if (event.type === 'request-failure') {
        updated.completed = event.completed ?? updated.completed
        updated.failed += 1
        updated.state = 'failed'
      } else if (event.type === 'dependency-blocked') {
        updated.blocked += 1
        updated.state = 'blocked'
        updated.reason = event.reason
      } else if (event.type === 'endpoint-skipped') {
        updated.state = 'skipped'
        updated.reason = event.reason
      } else if (event.type === 'endpoint-complete') {
        updated.total = event.attempted
        updated.posted = event.posted
        updated.failed = event.failed
        updated.state = event.failed ? 'failed' : 'complete'
      } else if (event.type === 'delete-start') {
        updated.action = 'delete'
        updated.total = event.total
        updated.state = 'running'
      } else if (event.type === 'delete-empty') {
        updated.action = 'delete'
        updated.state = 'empty'
        updated.reason = event.message
      } else if (event.type === 'delete-success') {
        updated.action = 'delete'
        updated.deleted += 1
        updated.completed = event.completed
      } else if (event.type === 'delete-failure') {
        updated.action = 'delete'
        updated.failed += 1
        updated.completed = event.completed ?? updated.completed
        updated.state = 'failed'
      } else if (event.type === 'delete-endpoint-complete') {
        updated.action = 'delete'
        updated.total = event.total
        updated.deleted = event.deleted
        updated.failed = event.failed
        updated.state = event.failed ? 'failed' : 'complete'
      }

      return existing
        ? current.map((entry) => entry.endpoint === event.endpoint ? updated : entry)
        : [...current, updated]
    })

    if (['request-failure', 'delete-failure', 'delete-empty', 'dependency-blocked', 'endpoint-skipped', 'foreign-key-fallback'].includes(event.type)) {
      setIssues((current) => [...current, event])
    }
  }

  const handleRun = async (event) => {
    event.preventDefault()
    if (!backendUrl.trim() || isDeleting) return
    if (!accessToken) {
      setAuthError('Authorize before starting the data seed.')
      setShowAuthorize(true)
      return
    }

    setIsSubmitting(true)
    setProgress([])
    setIssues([])
    setRunSummary(null)
    setDeleteSummary(null)
    try {
      const result = await automateFunction(backendUrl, forwardedHost, accessToken, trackProgress)
      setRunSummary(result)
    } catch (error) {
      setIssues([{ type: 'fatal', message: error.message }])
      setRunSummary({ posted: 0, failures: [{}], blockers: [], skipped: [] })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteAll = async () => {
    if (!accessToken) {
      setAuthError('Authorize before deleting backend data.')
      setShowAuthorize(true)
      setShowDeleteConfirm(false)
      return
    }

    setIsDeleting(true)
    setShowDeleteConfirm(false)
    setProgress([])
    setIssues([])
    setRunSummary(null)
    setDeleteSummary(null)
    try {
      const result = await deleteAllData(backendUrl, forwardedHost, accessToken, trackProgress)
      setDeleteSummary(result)
    } catch (error) {
      setIssues([{ type: 'fatal', message: error.message }])
    } finally {
      setIsDeleting(false)
    }
  }

  const postedCount = runSummary?.posted ?? progress.reduce((total, row) => total + (row.posted ?? 0), 0)
  const deletedCount = progress.reduce((total, row) => total + (row.deleted ?? 0), 0)
  const failedCount = (runSummary?.failures.length ?? deleteSummary?.failures.length) ?? progress.reduce((total, row) => total + row.failed, 0)
  const blockedCount = runSummary?.blockers?.length ?? progress.reduce((total, row) => total + row.blocked, 0)
  const completedCount = progress.filter((row) => ['complete', 'failed', 'blocked', 'skipped'].includes(row.state)).length
  const isBusy = isSubmitting || isDeleting

  return (
    <main className="workspace">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Sajillow seeder home">
          <span className="wordmark-mark">S</span><span>SAJILLOW <i>SEEDER</i></span>
        </a>
        <div className="topbar-actions">
          <div className="connection-indicator">
            <span className={`connection-dot ${isBusy ? 'is-live' : ''}`} />
            {isBusy ? (isDeleting ? 'DELETE IN PROGRESS' : 'RUN IN PROGRESS') : accessToken ? `AUTHORIZED${authenticatedUser ? ` · ${authenticatedUser}` : ''}` : 'NOT AUTHORIZED'}
          </div>
          {accessToken
            ? <button className="auth-button auth-logout" type="button" onClick={handleLogout} disabled={isBusy}>Log out</button>
            : <button className="auth-button" type="button" onClick={() => { setAuthError(''); setShowAuthorize(true) }}>Authorize</button>}
        </div>
      </header>

      {showAuthorize && (
        <div className="auth-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAuthorize(false) }}>
          <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <div className="auth-dialog-heading">
              <div><span className="section-index">SECURITY / BEARER TOKEN</span><h2 id="auth-title">Authorize</h2></div>
              <button className="auth-close" type="button" aria-label="Close authorization dialog" onClick={() => setShowAuthorize(false)}>×</button>
            </div>
            <p className="auth-description">Sign in to receive an access token. It is saved in this browser and attached to requests.</p>
            <form className="auth-form" onSubmit={handleAuthorize}>
              <label className="field"><span>LOGIN ENDPOINT</span><input value={loginEndpoint} onChange={(event) => setLoginEndpoint(event.target.value)} required /></label>
              <label className="field"><span>EMAIL</span><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              <label className="field"><span>PASSWORD</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
              {authError && <p className="auth-error" role="alert">{authError}</p>}
              <button className="run-button auth-submit" type="submit" disabled={isAuthorizing}><span>{isAuthorizing ? 'Authorizing...' : 'Authorize'}</span><b aria-hidden="true">{isAuthorizing ? '···' : '↗'}</b></button>
            </form>
          </section>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="auth-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowDeleteConfirm(false) }}>
          <section className="auth-dialog delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <div className="auth-dialog-heading">
              <div><span className="section-index">DESTRUCTIVE ACTION</span><h2 id="delete-title">Delete existing data?</h2></div>
              <button className="auth-close" type="button" aria-label="Close delete confirmation" onClick={() => setShowDeleteConfirm(false)}>×</button>
            </div>
            <p className="auth-description">This fetches each collection and deletes every returned record individually, in dependency order. This cannot be undone.</p>
            <div className="delete-actions">
              <button className="auth-button auth-logout" type="button" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="delete-button" type="button" onClick={handleDeleteAll}><span>Delete all records</span><b aria-hidden="true">×</b></button>
            </div>
          </section>
        </div>
      )}

      <section className="intro" id="top">
        <div className="intro-copy">
          <p className="eyebrow"><span>01</span> TEMPLATE DATA TRANSFER</p>
          <h1>Seed the site.<br /><em>See every request.</em></h1>
          <p className="intro-note">Sequential writes resolve related IDs as records are created. Failures and blocked dependencies appear below.</p>
        </div>
        <div className="intro-stamp" aria-hidden="true"><span>LIVE</span><strong>POST<br />LOG</strong><small>15 ROUTES</small></div>
      </section>

      <section className="control-band" aria-labelledby="connection-title">
        <div className="section-heading"><span className="section-index">01 / CONNECTION</span><h2 id="connection-title">Backend target</h2></div>
        <form className="connection-form" onSubmit={handleRun}>
          <label className="field backend-field"><span>BACKEND URL</span><input type="text" placeholder="api.example.com" value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} onBlur={() => setBackendUrl((value) => { const trimmed = value.trim(); return trimmed && !/^https?:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed })} disabled={isBusy} required /></label>
          <label className="field"><span>TENANT HOST <small>OPTIONAL</small></span><input type="text" placeholder="tenant.example.com" value={forwardedHost} onChange={(event) => setForwardedHost(event.target.value)} onBlur={() => setForwardedHost((value) => value.trim().replace(/^https?:\/\//i, '').split('/')[0])} disabled={isBusy} /></label>
          <div className="run-actions">
            <button className="run-button" type="submit" disabled={isBusy || !backendUrl.trim()}><span>{isSubmitting ? 'Sending records' : 'Run data seed'}</span><b aria-hidden="true">{isSubmitting ? '···' : '↗'}</b></button>
            <button className="delete-button" type="button" disabled={isBusy || !backendUrl.trim()} onClick={() => setShowDeleteConfirm(true)}><span>{isDeleting ? 'Deleting data' : 'Delete all data'}</span><b aria-hidden="true">{isDeleting ? '···' : '×'}</b></button>
          </div>
        </form>
      </section>

      <section className="monitor" aria-labelledby="monitor-title">
        <div className="monitor-heading"><div><span className="section-index">02 / REQUEST MONITOR</span><h2 id="monitor-title">Run activity</h2></div>{isBusy && <span className="live-label"><i /> {isDeleting ? 'SEQUENTIAL DELETE' : 'SEQUENTIAL POST'}</span>}</div>
        <div className="metrics" aria-live="polite">
          <div className="metric metric-posted"><span>{isDeleting || deleteSummary ? 'DELETED' : 'POSTED'}</span><strong>{isDeleting || deleteSummary ? deletedCount : postedCount}</strong></div>
          <div className="metric metric-failed"><span>FAILED</span><strong>{failedCount}</strong></div>
          <div className="metric metric-blocked"><span>BLOCKED</span><strong>{blockedCount}</strong></div>
          <div className="metric metric-routes"><span>ROUTES</span><strong>{progress.length}<small> / 15</small></strong></div>
        </div>

        {progress.length > 0 ? (
          <div className="route-list" aria-live="polite">{progress.map((row) => (
            <article className={`route-row route-${row.state}`} key={row.endpoint}>
              <span className="route-state-mark" aria-hidden="true" />
              <div className="route-copy"><strong>{endpointTitle(row.endpoint)}</strong><code>{row.endpoint}</code>{row.reason && <p>{row.reason}</p>}</div>
              <div className="route-count"><b>{row.action === 'delete' ? (row.deleted ?? 0) : (row.posted ?? 0)}{row.total > 0 && <small> / {row.total}</small>}</b><span>{row.state === 'running' ? (row.action === 'delete' ? 'DELETING' : 'SENDING') : row.state.toUpperCase()}</span></div>
            </article>
          ))}</div>
        ) : <div className="empty-monitor"><span className="empty-mark" aria-hidden="true">↳</span><div><strong>{runSummary || deleteSummary ? 'Run finished' : 'No run recorded'}</strong><p>Endpoint activity will appear here when a seed starts.</p></div></div>}

        {issues.length > 0 && <section className="issue-panel" aria-labelledby="issues-title">
          <div className="issue-heading"><div><span className="section-index">03 / DIAGNOSTICS</span><h2 id="issues-title">Needs attention <b>{issues.length}</b></h2></div></div>
          <div className="issue-list" aria-live="assertive">{issues.map((issue, index) => (
            <article className={`issue-row issue-${issue.type}`} key={`${issue.endpoint ?? 'run'}-${index}`}>
              <span className="issue-kind">{issue.type === 'request-failure' ? `${issue.method ?? 'POST'} FAILED` : issue.type === 'delete-failure' ? 'DELETE FAILED' : issue.type === 'dependency-blocked' ? 'FK BLOCKED' : issue.type === 'foreign-key-fallback' ? 'FK RECOVERED' : issue.type === 'endpoint-skipped' ? 'SKIPPED' : 'RUN ERROR'}</span>
              <span className="issue-kind">{issue.type === 'request-failure' ? `${issue.method ?? 'POST'} FAILED` : issue.type === 'delete-failure' ? 'DELETE FAILED' : issue.type === 'delete-empty' ? 'GET EMPTY' : issue.type === 'dependency-blocked' ? 'FK BLOCKED' : issue.type === 'foreign-key-fallback' ? 'FK RECOVERED' : issue.type === 'endpoint-skipped' ? 'SKIPPED' : 'RUN ERROR'}</span>
              <div className="issue-copy"><strong>{issue.record ? `${endpointTitle(issue.endpoint)} · ${issue.record}` : endpointTitle(issue.endpoint ?? 'Run')}</strong><p>{issue.message ?? issue.reason}</p>{issue.status && <code>HTTP {issue.status}</code>}{issue.endpoint && <code>{issue.endpoint}</code>}</div>
            </article>
          ))}</div>
        </section>}
        {runSummary && issues.length === 0 && <div className="run-complete" role="status"><span className="complete-mark">✓</span><span>Run completed: {runSummary.posted} records posted across {completedCount} endpoint groups.</span></div>}
        {deleteSummary && issues.length === 0 && <div className="run-complete delete-complete" role="status"><span className="complete-mark">✓</span><span>Delete completed: {deleteSummary.deleted} records deleted across {deleteSummary.endpointResults.length} endpoint groups.</span></div>}
      </section>
      <footer className="footer-line"><span>SAJILLOW TEMPLATE PREVIEWER</span><span>REQUESTS ARE SENT ONE RECORD AT A TIME</span></footer>
    </main>
  )
}

export default App