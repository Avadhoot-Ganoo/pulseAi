/*
  Performance smoke test: measures page metrics while a demo-mode scan runs.
  Outputs periodic JS heap and task duration snapshots. Usage:
    node scripts/perf_test.js --url http://localhost:4173/?demo=1 --seconds 20
*/
import puppeteer from 'puppeteer'

function getArg(name, def) {
  const idx = process.argv.findIndex((a) => a === name)
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1]
  return def
}

const url = process.env.PERF_URL || getArg('--url', 'http://localhost:4173/?demo=1')
const seconds = parseInt(getArg('--seconds', '20'), 10)

async function run() {
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  page.setDefaultTimeout(120000)
  await page.goto(url, { waitUntil: 'networkidle2' })

  const startButtonCandidates = await page.$x("//button[contains(., 'Start Scan')] | //button[contains(., 'Start')]")
  if (startButtonCandidates.length) await startButtonCandidates[0].click()

  const snapshots = []
  const intervalMs = 2000
  const end = Date.now() + seconds * 1000
  while (Date.now() < end) {
    const m = await page.metrics()
    snapshots.push({ ts: Date.now(), JSHeapUsedSize: m.JSHeapUsedSize, Nodes: m.Nodes, TaskDuration: m.TaskDuration })
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  console.log(JSON.stringify({ status: 'ok', url, seconds, snapshots }, null, 2))
  await browser.close()
}

run().catch((err) => {
  console.error('Perf test failed:', err?.message || err)
  process.exit(1)
})