import { useState } from 'react'
import automateFunction from './call'

const App = () => {
  const [backendUrl, setBackendUrl] = useState("templates-api.hamroyouthit.com")
  const [forwardedHost, setForwardedHost] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState('')

  const handleFillDemoData = async () => {
    if (!backendUrl.trim()) {
      setStatus('Enter a backend URL first.')
      return
    }

    setIsSubmitting(true)
    setStatus('Posting demo records...')

    try {
      console.log(backendUrl);
      console.log(forwardedHost);
      const result = await automateFunction(backendUrl, forwardedHost)
      const messages = [`Posted ${result.posted} records.`]
      if (result.failures.length) {
        messages.push(`${result.failures.length} requests failed.`)
        console.error('Demo data request failures:', result.failures)
      }
      if (result.skipped.length) {
        messages.push(`${result.skipped.length} endpoint(s) had no mock records.`)
      }
      setStatus(messages.join(' '))
    } catch (error) {
      setStatus(`Could not start the demo data requests: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <h1>API Endpoints</h1>
      <input
        type="text"
        placeholder="Enter backend URL"
        value={backendUrl}
        onChange={(event) => setBackendUrl(event.target.value)}
      />
      <input
        type="text"
        placeholder="Enter forwarded host"
        value={forwardedHost}
        onChange={(event) => setForwardedHost(event.target.value)}
      />
      <button onClick={handleFillDemoData} disabled={isSubmitting}>
        {isSubmitting ? 'Posting...' : 'Fill demo data'}
      </button>
      <p role="status" aria-live="polite">{status}</p>
    </div>
  )
}

export default App