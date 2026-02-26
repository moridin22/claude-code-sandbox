import { test, expect } from '@playwright/test'

// Generate CSV entries for the past 60 days so the calendar always has data to show
function generateCSV() {
  const rows = ['date,count']
  const today = new Date('2026-02-26')
  for (let i = 0; i < 60; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    rows.push(`${d.toISOString().split('T')[0]},${(i % 5) + 1}`)
  }
  return rows.join('\n')
}

const SAMPLE_CSV = generateCSV()

async function loadAppWithData(page) {
  await page.goto('/')
  await page.evaluate((csv) => {
    localStorage.setItem('streaks-csv-data', csv)
    localStorage.setItem('streaks-csv-filename', 'test.csv')
  }, SAMPLE_CSV)
  await page.reload()
  await page.waitForSelector('rect[title]', { timeout: 8000 })
  await page.waitForTimeout(300) // let tooltip event handlers attach
}

// Measure both elements in the same viewport-relative coordinate space.
// We use getBoundingClientRect() directly in the browser to avoid the coordinate
// system mismatch between Playwright's page-relative boundingBox() and a
// position:fixed tooltip (which lives in viewport coordinates).
async function measurePositions(rect, tooltip) {
  const rectBBox = await rect.evaluate(el => {
    const r = el.getBoundingClientRect()
    return { right: r.right, top: r.top }
  })
  const tooltipBBox = await tooltip.evaluate(el => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y }
  })
  return { rectBBox, tooltipBBox }
}

test.describe('Calendar tooltip positioning', () => {
  test('desktop hover: tooltip appears next to the hovered rect', async ({ page }) => {
    await loadAppWithData(page)

    const rect = page.locator('rect[title]').first()
    await rect.hover()

    const tooltip = page.getByTestId('calendar-tooltip')
    await expect(tooltip).toBeVisible()

    const { rectBBox, tooltipBBox } = await measurePositions(rect, tooltip)
    console.log(`  rect.right=${rectBBox.right.toFixed(1)}  rect.top=${rectBBox.top.toFixed(1)}`)
    console.log(`  tooltip.left=${tooltipBBox.x.toFixed(1)}  tooltip.top=${tooltipBBox.y.toFixed(1)}`)

    // Tooltip left edge should be just right of the rect's right edge (+4px offset)
    expect(Math.abs(tooltipBBox.x - (rectBBox.right + 4))).toBeLessThan(15)
    // Tooltip should start near the top of the rect (within 100px — may be clamped upward)
    expect(Math.abs(tooltipBBox.y - rectBBox.top)).toBeLessThan(100)
  })

  test('touch: touchstart handler fires and tooltip appears next to the rect', async ({ page }) => {
    await loadAppWithData(page)

    const rect = page.locator('rect[title]').first()
    await rect.scrollIntoViewIfNeeded()

    // Dispatch touchstart directly — more reliable on SVG elements than Playwright's tap(),
    // and faithfully simulates what a mobile browser sends on finger-down.
    await rect.evaluate(el => {
      const r = el.getBoundingClientRect()
      const touch = new Touch({
        identifier: 1,
        target: el,
        clientX: r.x + r.width / 2,
        clientY: r.y + r.height / 2,
      })
      el.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches: [touch],
        changedTouches: [touch],
      }))
    })

    const tooltip = page.getByTestId('calendar-tooltip')
    await expect(tooltip).toBeVisible()

    const { rectBBox, tooltipBBox } = await measurePositions(rect, tooltip)
    console.log(`  [touch] rect.right=${rectBBox.right.toFixed(1)}  rect.top=${rectBBox.top.toFixed(1)}`)
    console.log(`  [touch] tooltip.left=${tooltipBBox.x.toFixed(1)}  tooltip.top=${tooltipBBox.y.toFixed(1)}`)

    expect(Math.abs(tooltipBBox.x - (rectBBox.right + 4))).toBeLessThan(15)
    expect(Math.abs(tooltipBBox.y - rectBBox.top)).toBeLessThan(100)
  })

  test('zoom/pan: tooltip stays anchored to the rect even with large visualViewport offsets', async ({ page }) => {
    await loadAppWithData(page)

    // Simulate a zoomed + panned state: visualViewport.offsetLeft/Top are large non-zero values.
    //
    // OLD buggy code set: tooltip.x = e.clientX - vvLeft + 12
    //   With vvLeft=300 the tooltip would land ~300px to the LEFT of where it should be.
    // NEW fixed code sets: tooltip.x = getBoundingClientRect().right + 4
    //   Completely unaffected by visualViewport offsets.
    await page.evaluate(() => {
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        value: {
          offsetLeft: 300,
          offsetTop: 150,
          width: window.innerWidth,
          height: window.innerHeight,
          scale: 2,
          addEventListener: () => {},
          removeEventListener: () => {},
        },
      })
    })

    const rect = page.locator('rect[title]').first()
    await rect.hover()

    const tooltip = page.getByTestId('calendar-tooltip')
    await expect(tooltip).toBeVisible()

    const { rectBBox, tooltipBBox } = await measurePositions(rect, tooltip)
    console.log(`  [zoom] rect.right=${rectBBox.right.toFixed(1)}  rect.top=${rectBBox.top.toFixed(1)}`)
    console.log(`  [zoom] tooltip.left=${tooltipBBox.x.toFixed(1)}  tooltip.top=${tooltipBBox.y.toFixed(1)}`)
    console.log(`  [zoom] old buggy position would have been x=${(rectBBox.right - 300 + 12).toFixed(1)} (300px off)`)

    // Tooltip must still be anchored to the rect, not displaced by the faked offsets
    expect(Math.abs(tooltipBBox.x - (rectBBox.right + 4))).toBeLessThan(15)
    expect(Math.abs(tooltipBBox.y - rectBBox.top)).toBeLessThan(100)
  })
})
