/*
  Puppeteer E2E: Loads the production preview in demo mode, runs a full 30s scan,
  and verifies results are shown. Intended for CI and local use.
*/
import puppeteer from 'puppeteer'

function getArg(name, def) {
  const idx = process.argv.findIndex((a) => a === name)
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1]
  return def
}

const url = process.env.E2E_URL || getArg('--url', 'http://localhost:4173/?demo=1')

async function run() {
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  page.setDefaultTimeout(120000)
  await page.goto(url, { waitUntil: 'networkidle2' })

  // Click Start Scan
  const startButtonCandidates = await page.$x("//button[contains(., 'Start Scan')] | //button[contains(., 'Start')]")
  if (startButtonCandidates.length === 0) {
    throw new Error('Start button not found')
  }
  await startButtonCandidates[0].click()

  // Wait for results (ResultDashboard shows "Confidence:")
  await page.waitForFunction(() => document.body.innerText.includes('Confidence:'), { timeout: 90000 })

  // Extract a small snapshot of metrics text
  const text = await page.evaluate(() => document.body.innerText)
  const hrLine = (text.match(/HR\s*\n?\s*([0-9]+)\s*bpm/i) || [])[0] || 'HR value not parsed'
  const confLine = (text.match(/Confidence:\s*([0-9]+)%/i) || [])[0] || 'Confidence not parsed'

  console.log(JSON.stringify({ status: 'ok', url, hr: hrLine, confidence: confLine }))
  await browser.close()
}

run().catch(async (err) => {
  console.error('E2E failed:', err?.message || err)
  process.exit(1)
})