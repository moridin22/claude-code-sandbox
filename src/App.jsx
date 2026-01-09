import { useState } from 'react'
import CalendarHeatmap from 'react-calendar-heatmap'
import Papa from 'papaparse'
import { subDays, format, parseISO } from 'date-fns'
import 'react-calendar-heatmap/dist/styles.css'
import './App.css'

function App() {
  const [data, setData] = useState([])
  const [error, setError] = useState(null)
  const [csvFormat, setCsvFormat] = useState('auto')
  const [fileInputKey, setFileInputKey] = useState(Date.now())

  // Generate sample data
  const generateSampleData = () => {
    const sampleData = []
    const today = new Date()

    // Create 365 days of sample data
    for (let i = 0; i < 365; i++) {
      const date = subDays(today, i)
      // Random completion count (0-5 tasks per day)
      const count = Math.floor(Math.random() * 6)
      if (count > 0) {
        sampleData.push({
          date: format(date, 'yyyy-MM-dd'),
          count: count
        })
      }
    }

    setData(sampleData)
    setError(null)
    setFileInputKey(Date.now()) // Reset file input
  }

  // Handle CSV file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        try {
          const parsedData = parseCSVData(results.data)
          setData(parsedData)
          setError(null)
          setFileInputKey(Date.now()) // Reset file input for next upload
        } catch (err) {
          setError(err.message)
        }
      },
      error: (err) => {
        setError('Failed to parse CSV: ' + err.message)
      }
    })
  }

  // Parse CSV data - supports multiple formats
  const parseCSVData = (csvData) => {
    // Check if this is a streaks app export (has entry_date and entry_type columns)
    const firstRow = csvData.find(row => row && Object.keys(row).length > 0)
    if (!firstRow) {
      throw new Error('CSV file is empty')
    }

    const isStreaksAppFormat = firstRow.hasOwnProperty('entry_date') && firstRow.hasOwnProperty('entry_type')

    if (isStreaksAppFormat) {
      return parseStreaksAppCSV(csvData)
    } else {
      return parseGenericCSV(csvData)
    }
  }

  // Helper: Get Sunday of the week containing a date
  const getSundayOfWeek = (date) => {
    const d = new Date(date)
    const day = d.getDay() // 0 = Sunday, 1 = Monday, etc.
    const diff = day // Days since Sunday
    return subDays(d, diff)
  }

  // Helper: Get all days from Sunday to Friday of a week
  const getWeekDays = (sundayDate) => {
    const days = []
    for (let i = 0; i <= 5; i++) { // Sunday (0) through Friday (5)
      const date = new Date(sundayDate)
      date.setDate(date.getDate() + i)
      days.push(format(date, 'yyyy-MM-dd'))
    }
    return days
  }

  // Parse streaks app CSV format
  const parseStreaksAppCSV = (csvData) => {
    const dateCounts = {}
    let parsedDailyCount = 0
    let parsedWeeklyCount = 0
    let skippedCount = 0

    csvData.forEach((row, index) => {
      // Skip empty rows
      if (!row || !row.entry_date || !row.entry_type) return

      // Only count completed tasks (ignore missed)
      if (!row.entry_type.toLowerCase().includes('completed')) {
        skippedCount++
        return
      }

      const pageValue = row.page ? row.page.trim() : ''
      const rawDate = row.entry_date.trim()

      // Convert YYYYMMDD to YYYY-MM-DD
      let dateStr
      try {
        if (rawDate.length === 8 && /^\d{8}$/.test(rawDate)) {
          // Format: YYYYMMDD
          const year = rawDate.substring(0, 4)
          const month = rawDate.substring(4, 6)
          const day = rawDate.substring(6, 8)
          dateStr = `${year}-${month}-${day}`
        } else {
          throw new Error('Invalid date format')
        }
      } catch (err) {
        console.warn(`Skipping row ${index + 1}: Invalid date format "${rawDate}"`)
        skippedCount++
        return
      }

      // Handle daily tasks (page 0 or empty)
      if (pageValue === '' || pageValue === '0') {
        if (!dateCounts[dateStr]) {
          dateCounts[dateStr] = 0
        }
        dateCounts[dateStr]++
        parsedDailyCount++
      }
      // Handle weekly tasks (page 1)
      else if (pageValue === '1') {
        const sunday = getSundayOfWeek(dateStr)
        const weekDays = getWeekDays(sunday)

        weekDays.forEach(day => {
          if (!dateCounts[day]) {
            dateCounts[day] = 0
          }
          dateCounts[day] += 1/3 // Add 1/3 completion to each day of the week
        })

        parsedWeeklyCount++
        console.log(`Added weekly task for week of ${format(sunday, 'MMM d, yyyy')} (${weekDays.length} days)`)
      }
      // Skip other pages
      else {
        console.log(`Skipping non-first/weekly-page entry: ${row.entry_date} (page: ${row.page})`)
        skippedCount++
      }
    })

    console.log(`Parsed ${parsedDailyCount} daily entries, ${parsedWeeklyCount} weekly entries, skipped ${skippedCount} entries`)

    // Convert to array format
    const parsed = Object.entries(dateCounts).map(([date, count]) => ({
      date,
      count
    }))

    if (parsed.length === 0) {
      throw new Error('No completed tasks found in CSV')
    }

    return parsed
  }

  // Parse generic CSV formats
  const parseGenericCSV = (csvData) => {
    const parsed = []

    csvData.forEach((row, index) => {
      // Skip empty rows
      if (!row || Object.keys(row).length === 0) return

      let date, count

      // Try to detect format automatically
      if (row.date || row.Date) {
        date = row.date || row.Date
        count = parseInt(row.count || row.Count || row.value || row.Value || 1)
      } else if (row.day || row.Day) {
        date = row.day || row.Day
        count = parseInt(row.count || row.Count || row.value || row.Value || 1)
      } else {
        // Try first two columns
        const keys = Object.keys(row)
        if (keys.length >= 1) {
          date = row[keys[0]]
          count = parseInt(row[keys[1]] || 1)
        }
      }

      if (date) {
        // Try to parse the date
        try {
          const dateStr = format(parseISO(date), 'yyyy-MM-dd')
          parsed.push({ date: dateStr, count: isNaN(count) ? 1 : count })
        } catch (err) {
          console.warn(`Skipping row ${index + 1}: Invalid date format`)
        }
      }
    })

    if (parsed.length === 0) {
      throw new Error('No valid data found. CSV should have columns like "date,count" or "day,value"')
    }

    return parsed
  }

  // Calculate date range dynamically based on data
  const calculateDateRange = () => {
    if (data.length === 0) {
      const endDate = new Date()
      const startDate = subDays(endDate, 365)
      return { startDate, endDate }
    }

    // Find min and max dates in the data
    const dates = data.map(d => new Date(d.date))
    const minDate = new Date(Math.min(...dates))
    const maxDate = new Date(Math.max(...dates))

    // Add some padding (30 days before and after)
    const startDate = subDays(minDate, 30)
    const endDate = new Date(Math.max(maxDate, new Date())) // At least show up to today

    return { startDate, endDate }
  }

  const { startDate, endDate } = calculateDateRange()

  // Get tooltip content
  const getTooltipDataAttrs = (value) => {
    if (!value || !value.date) {
      return null
    }
    // Format count to show decimals if fractional, otherwise whole number
    const countStr = value.count % 1 === 0 ? value.count.toString() : value.count.toFixed(2)
    const taskLabel = value.count === 1 ? 'task' : 'tasks'
    return {
      'data-tip': `${value.date}: ${countStr} ${taskLabel} completed`
    }
  }

  return (
    <div className="app">
      <h1>📅 Streak Calendar Visualization</h1>

      <div className="controls">
        <div className="upload-section">
          <label htmlFor="file-upload" className="file-label">
            📁 Upload CSV File
          </label>
          <input
            key={fileInputKey}
            id="file-upload"
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="file-input"
          />
          <button onClick={generateSampleData} className="sample-btn">
            🎲 Load Sample Data
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="info">
          <p><strong>Supported CSV Formats:</strong></p>
          <ul style={{ textAlign: 'left', margin: '0.5rem 0' }}>
            <li><strong>Streaks apps:</strong> Automatically detects exports with <code>entry_date</code> and <code>entry_type</code> columns</li>
            <li style={{ marginTop: '0.3rem' }}><strong>Daily tasks (page 0):</strong> Each completion counts as 1</li>
            <li style={{ marginTop: '0.3rem' }}><strong>Weekly tasks (page 1):</strong> Each completion adds 1/3 to every day from Sunday to Friday of that week</li>
            <li style={{ marginTop: '0.3rem' }}><strong>Generic:</strong> <code>date,count</code> or <code>day,value</code> format</li>
          </ul>
          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
            Only completed tasks are counted. Missed tasks are ignored.
          </p>
        </div>
      </div>

      {data.length > 0 && (
        <div className="calendar-container">
          <h2>Your Streak Calendar</h2>
          <p className="stats">
            Total days tracked: <strong>{data.length}</strong> |
            Total completions: <strong>{data.reduce((sum, d) => sum + d.count, 0)}</strong>
          </p>
          <p className="stats" style={{ fontSize: '0.85rem', color: '#666' }}>
            Date range: <strong>{format(startDate, 'MMM d, yyyy')}</strong> to <strong>{format(endDate, 'MMM d, yyyy')}</strong>
            {data.length > 0 && (
              <span> | First entry: <strong>{data.sort((a, b) => new Date(a.date) - new Date(b.date))[0].date}</strong> | Last entry: <strong>{data.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date}</strong></span>
            )}
          </p>

          <CalendarHeatmap
            startDate={startDate}
            endDate={endDate}
            values={data}
            classForValue={(value) => {
              if (!value || value.count === 0) {
                return 'color-empty'
              }
              // Support fractional counts from weekly tasks
              if (value.count < 1) return 'color-scale-1'
              if (value.count < 2) return 'color-scale-2'
              if (value.count < 4) return 'color-scale-3'
              return 'color-scale-4'
            }}
            tooltipDataAttrs={getTooltipDataAttrs}
            showWeekdayLabels={true}
          />

          <div className="legend">
            <span>Less</span>
            <div className="legend-scale">
              <div className="color-empty"></div>
              <div className="color-scale-1"></div>
              <div className="color-scale-2"></div>
              <div className="color-scale-3"></div>
              <div className="color-scale-4"></div>
            </div>
            <span>More</span>
          </div>
        </div>
      )}

      {data.length === 0 && !error && (
        <div className="empty-state">
          <p>👆 Upload a CSV file or load sample data to get started!</p>
        </div>
      )}
    </div>
  )
}

export default App
