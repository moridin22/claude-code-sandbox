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

  // Calculate date range (show last year)
  const endDate = new Date()
  const startDate = subDays(endDate, 365)

  // Get tooltip content
  const getTooltipDataAttrs = (value) => {
    if (!value || !value.date) {
      return null
    }
    return {
      'data-tip': `${value.date}: ${value.count} task${value.count !== 1 ? 's' : ''} completed`
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
          <p><strong>CSV Format:</strong> Your file should have columns like:</p>
          <code>date,count</code> or <code>day,value</code>
          <p>Example: <code>2024-01-15,3</code> (completed 3 tasks on Jan 15)</p>
        </div>
      </div>

      {data.length > 0 && (
        <div className="calendar-container">
          <h2>Your Streak Calendar</h2>
          <p className="stats">
            Total days tracked: <strong>{data.length}</strong> |
            Total completions: <strong>{data.reduce((sum, d) => sum + d.count, 0)}</strong>
          </p>

          <CalendarHeatmap
            startDate={startDate}
            endDate={endDate}
            values={data}
            classForValue={(value) => {
              if (!value || value.count === 0) {
                return 'color-empty'
              }
              if (value.count === 1) return 'color-scale-1'
              if (value.count === 2) return 'color-scale-2'
              if (value.count <= 4) return 'color-scale-3'
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
