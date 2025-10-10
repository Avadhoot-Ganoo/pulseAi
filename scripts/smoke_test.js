/**
 * Headless smoke test: navigates to deployed URL (?demo=1), clicks Start Scan,
 * and asserts console logs include 'worker-ready' and 'overlay drawLoop started'.
 */
import puppeteer from 'puppeteer'

const timeoutMs = 30000

async function main() {
  const rawUrl = process.env.SMOKE_URL || process.argv[2]
  if (!rawUrl) {
    console.log('SMOKE_URL not set; skipping smoke test')
    process.exit(0)
  }
  const url = rawUrl.includes('?') ? `${rawUrl}&demo=1` : `${rawUrl}?demo=1`
  console.log('Smoke URL:', url)

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const page = await browser.newPage()
  const logs = []
  page.on('console', (msg) => {
    const text = msg.text()
    logs.push(text)
    if (text.includes('worker-ready') || text.includes('overlay drawLoop started')) {
      console.log('[console]', text)
    }
  })

  await page.goto(url, { waitUntil: 'networkidle2', timeout: timeoutMs })

  // Click Start Scan
  await page.waitForSelector('button', { timeout: 8000 })
  await page.$$eval('button', (buttons) => {
    const btn = buttons.find((b) => (b.textContent || '').includes('Start Scan'))
    if (btn) (btn as HTMLButtonElement).click()
  })

  // Wait for logs
  const start = Date.now()
  let hasWorker = false
  let hasOverlay = false
  while (Date.now() - start < timeoutMs) {
    await page.waitForTimeout(500)
    hasWorker = logs.some((l) => l.includes('worker-ready'))
    hasOverlay = logs.some((l) => l.includes('overlay drawLoop started'))
    if (hasWorker && hasOverlay) break
  }

  // Output summary and assert
  console.log('Smoke Summary:', { hasWorker, hasOverlay })
  await browser.close()
  if (!hasWorker || !hasOverlay) {
    console.error('Smoke test failed: required logs missing')
    process.exit(1)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error('Smoke test error', e)
  process.exit(1)
})