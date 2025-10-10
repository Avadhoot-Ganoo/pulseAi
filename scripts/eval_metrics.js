/*
  Accuracy evaluation: compute MAE, RMSE, Pearson correlation, and Bland–Altman stats
  on arrays of predictions and ground truth. Usage:
    node scripts/eval_metrics.js --pred predictions.json --gt ground_truth.json
  Where each JSON file is an array of numbers or an object { values: number[] }.
*/
import fs from 'fs'

function readArray(path) {
  const raw = JSON.parse(fs.readFileSync(path, 'utf8'))
  return Array.isArray(raw) ? raw : Array.isArray(raw.values) ? raw.values : []
}

function mae(y, yhat) {
  const n = Math.min(y.length, yhat.length)
  let s = 0
  for (let i = 0; i < n; i++) s += Math.abs(yhat[i] - y[i])
  return s / Math.max(n, 1)
}

function rmse(y, yhat) {
  const n = Math.min(y.length, yhat.length)
  let s = 0
  for (let i = 0; i < n; i++) {
    const d = yhat[i] - y[i]
    s += d * d
  }
  return Math.sqrt(s / Math.max(n, 1))
}

function corr(y, yhat) {
  const n = Math.min(y.length, yhat.length)
  if (n === 0) return 0
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
  const my = mean(y.slice(0, n))
  const myh = mean(yhat.slice(0, n))
  let num = 0, dy2 = 0, dyh2 = 0
  for (let i = 0; i < n; i++) {
    const dy = y[i] - my
    const dyh = yhat[i] - myh
    num += dy * dyh
    dy2 += dy * dy
    dyh2 += dyh * dyh
  }
  return num / (Math.sqrt(dy2) * Math.sqrt(dyh2) || 1)
}

function blandAltman(y, yhat) {
  const n = Math.min(y.length, yhat.length)
  const diffs = []
  const means = []
  for (let i = 0; i < n; i++) {
    diffs.push(yhat[i] - y[i])
    means.push((yhat[i] + y[i]) / 2)
  }
  const meanDiff = diffs.reduce((a, b) => a + b, 0) / Math.max(n, 1)
  const sdDiff = Math.sqrt(
    diffs.reduce((a, b) => a + (b - meanDiff) * (b - meanDiff), 0) / Math.max(n - 1, 1)
  )
  const loaLower = meanDiff - 1.96 * sdDiff
  const loaUpper = meanDiff + 1.96 * sdDiff
  return { meanDiff, sdDiff, loaLower, loaUpper, points: means.map((m, i) => ({ mean: m, diff: diffs[i] })) }
}

function getArg(name, def) {
  const idx = process.argv.findIndex((a) => a === name)
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1]
  return def
}

const predPath = getArg('--pred')
const gtPath = getArg('--gt')
if (!predPath || !gtPath) {
  console.error('Usage: node scripts/eval_metrics.js --pred predictions.json --gt ground_truth.json')
  process.exit(1)
}

const pred = readArray(predPath)
const gt = readArray(gtPath)

const out = {
  count: Math.min(pred.length, gt.length),
  mae: mae(gt, pred),
  rmse: rmse(gt, pred),
  corr: corr(gt, pred),
  blandAltman: blandAltman(gt, pred),
}

console.log(JSON.stringify(out, null, 2))