import { useState } from 'react'
import automateFunction from './call'
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
  const [progress, setProgress] = useState([])
  const [issues, setIssues] = useState([])
  const [runSummary, setRunSummary] = useState(null)

  const trackProgress = (event) => {
    setProgress((current) => {
      const existing = current.find((entry) => entry.endpoint === event.endpoint)
      const next = existing ?? {
        endpoint: event.endpoint,
        state: 'queued',
        completed: 0,
        total: 0,
        posted: 0,
        failed: 0,
        blocked: 0,
        reason: '',
      }
      const updated = { ...next }

      if (event.type === 'endpoint-start') {
        updated.state = 'running'
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
      }

      return existing
        ? current.map((entry) => entry.endpoint === event.endpoint ? updated : entry)
        : [...current, updated]
    })

      if (event.type === 'request-failure' || event.type === 'dependency-blocked') {
      setIssues((current) => [...current, event])
    } else if (event.type === 'endpoint-skipped' || event.type === 'foreign-key-fallback') {
      setIssues((current) => [...current, event])
    }
  }

  const handleRun = async (event) => {
    event.preventDefault()
    if (!backendUrl.trim()) return

    setIsSubmitting(true)
    setProgress([])
    setIssues([])
    setRunSummary(null)

    try {
      const result = await automateFunction(backendUrl, forwardedHost, trackProgress)
      setRunSummary(result)
    } catch (error) {
      setIssues([{ type: 'fatal', message: error.message }])
      setRunSummary({ posted: 0, failures: [{}], blockers: [], skipped: [] })
    } finally {
      setIsSubmitting(false)
    }
  }

  const postedCount = runSummary?.posted ?? progress.reduce((total, row) => total + row.posted, 0)
  const failedCount = runSummary?.failures.length ?? progress.reduce((total, row) => total + row.failed, 0)
  const blockedCount = runSummary?.blockers.length ?? progress.reduce((total, row) => total + row.blocked, 0)
  const completedCount = progress.filter((row) => ['complete', 'failed', 'blocked', 'skipped'].includes(row.state)).length

  return (
    <main className="workspace">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Sajillow seeder home">
          <span className="wordmark-mark">S</span>
          <span>SAJILLOW <i>SEEDER</i></span>
        </a>
        <div className="connection-indicator">
          <span className={`connection-dot ${isSubmitting ? 'is-live' : ''}`} />
          {isSubmitting ? 'RUN IN PROGRESS' : 'API WORKSPACE'}
        </div>
      </header>

      <section className="intro" id="top">
        <div className="intro-copy">
          <p className="eyebrow"><span>01</span> TEMPLATE DATA TRANSFER</p>
          <h1>Seed the site.<br /><em>See every request.</em></h1>
          <p className="intro-note">Sequential writes resolve related IDs as records are created. Failures and blocked dependencies appear below.</p>
        </div>
        <div className="intro-stamp" aria-hidden="true">
          <span>LIVE</span>
          <strong>POST<br />LOG</strong>
          <small>15 ROUTES</small>
        </div>
      </section>

      <section className="control-band" aria-labelledby="connection-title">
        <div className="section-heading">
          <span className="section-index">01 / CONNECTION</span>
          <h2 id="connection-title">Backend target</h2>
        </div>
        <form className="connection-form" onSubmit={handleRun}>
          <label className="field backend-field">
            <span>BACKEND URL</span>
            <input
              type="text"
              placeholder="https://api.example.com"
              value={backendUrl}
              onChange={(event) => setBackendUrl(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </label>
          <label className="field">
            <span>TENANT HOST <small>OPTIONAL</small></span>
            <input
              type="text"
              placeholder="tenant.example.com"
              value={forwardedHost}
              onChange={(event) => setForwardedHost(event.target.value)}
              disabled={isSubmitting}
            />
          </label>
          <button className="run-button" type="submit" disabled={isSubmitting || !backendUrl.trim()}>
            <span>{isSubmitting ? 'Sending records' : 'Run data seed'}</span>
            <b aria-hidden="true">{isSubmitting ? '···' : '↗'}</b>
          </button>
        </form>
      </section>

      <section className="monitor" aria-labelledby="monitor-title">
        <div className="monitor-heading">
          <div>
            <span className="section-index">02 / REQUEST MONITOR</span>
            <h2 id="monitor-title">Run activity</h2>
          </div>
          {isSubmitting && <span className="live-label"><i /> SEQUENTIAL POST</span>}
        </div>

        <div className="metrics" aria-live="polite">
          <div className="metric metric-posted"><span>POSTED</span><strong>{postedCount}</strong></div>
          <div className="metric metric-failed"><span>FAILED</span><strong>{failedCount}</strong></div>
          <div className="metric metric-blocked"><span>BLOCKED</span><strong>{blockedCount}</strong></div>
          <div className="metric metric-routes"><span>ROUTES</span><strong>{progress.length}<small> / 15</small></strong></div>
        </div>

        {progress.length > 0 ? (
          <div className="route-list" aria-live="polite">
            {progress.map((row) => (
              <article className={`route-row route-${row.state}`} key={row.endpoint}>
                <span className="route-state-mark" aria-hidden="true" />
                <div className="route-copy">
                  <strong>{endpointTitle(row.endpoint)}</strong>
                  <code>{row.endpoint}</code>
                  {row.reason && <p>{row.reason}</p>}
                </div>
                <div className="route-count">
                  <b>{row.posted}{row.total > 0 && <small> / {row.total}</small>}</b>
                  <span>{row.state === 'running' ? 'SENDING' : row.state.toUpperCase()}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-monitor">
            <span className="empty-mark" aria-hidden="true">↳</span>
            <div><strong>{runSummary ? 'Run finished' : 'No run recorded'}</strong><p>Endpoint activity will appear here when a seed starts.</p></div>
          </div>
        )}

        {issues.length > 0 && (
          <section className="issue-panel" aria-labelledby="issues-title">
            <div className="issue-heading">
              <div><span className="section-index">03 / DIAGNOSTICS</span><h2 id="issues-title">Needs attention <b>{issues.length}</b></h2></div>
            </div>
            <div className="issue-list" aria-live="assertive">
              {issues.map((issue, index) => (
                <article className={`issue-row issue-${issue.type}`} key={`${issue.endpoint ?? 'run'}-${index}`}>
                  <span className="issue-kind">{issue.type === 'request-failure' ? `${issue.method ?? 'POST'} FAILED` : issue.type === 'dependency-blocked' ? 'FK BLOCKED' : issue.type === 'foreign-key-fallback' ? 'FK RECOVERED' : issue.type === 'endpoint-skipped' ? 'SKIPPED' : 'RUN ERROR'}</span>
                  <div className="issue-copy">
                    <strong>{issue.record ? `${endpointTitle(issue.endpoint)} · ${issue.record}` : endpointTitle(issue.endpoint ?? 'Run')}</strong>
                    <p>{issue.message ?? issue.reason}</p>
                    {issue.status && <code>HTTP {issue.status}</code>}
                    {issue.endpoint && <code>{issue.endpoint}</code>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {runSummary && issues.length === 0 && (
          <div className="run-complete" role="status">
            <span className="complete-mark">✓</span>
            <span>Run completed: {runSummary.posted} records posted across {completedCount} endpoint groups.</span>
          </div>
        )}
      </section>

      <footer className="footer-line"><span>SAJILLOW TEMPLATE PREVIEWER</span><span>REQUESTS ARE SENT ONE RECORD AT A TIME</span></footer>
    </main>
  )
}

export default App