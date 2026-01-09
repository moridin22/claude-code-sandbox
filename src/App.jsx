import { useState, useEffect, useRef } from 'react'
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
  const [lastFileName, setLastFileName] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const calendarRef = useRef(null)
  const [tooltip, setTooltip] = useState({ show: false, content: '', x: 0, y: 0 })
  const [syncStatus, setSyncStatus] = useState('idle') // 'idle', 'loading', 'success', 'error'

  // Fixed bin ID for cloud storage
  const CLOUD_BIN_ID = '69610898ae596e708fd03729'
  const JSONBIN_API_KEY = '$2a$10$toQ/X6WsmY6l38zcuRG.1e2IaEtmWoS4Dy/8J7e8Ivns2.pulx2eS'

  // Load data from cloud on mount
  useEffect(() => {
    loadFromCloud()
  }, [])

  // Load data from cloud
  const loadFromCloud = async () => {
    setIsLoading(true)
    setSyncStatus('loading')

    try {
      console.log('Loading data from cloud...')
      const response = await fetch(`https://api.jsonbin.io/v3/b/${CLOUD_BIN_ID}/latest`, {
        headers: { 'X-Master-Key': JSONBIN_API_KEY }
      })

      if (!response.ok) {
        throw new Error(`Load failed: ${response.statusText}`)
      }

      const result = await response.json()
      const { csvData, fileName } = result.record

      if (csvData && fileName) {
        // Save to localStorage
        localStorage.setItem('streaks-csv-data', csvData)
        localStorage.setItem('streaks-csv-filename', fileName)

        // Parse and display data
        Papa.parse(csvData, {
          header: true,
          complete: (results) => {
            try {
              const parsedData = parseCSVData(results.data)
              setData(parsedData)
              setLastFileName(fileName)
              setError(null)
              setSyncStatus('idle')
              console.log(`Loaded from cloud: ${fileName}`)
            } catch (err) {
              setError('Failed to parse loaded data: ' + err.message)
              setSyncStatus('error')
            }
            setIsLoading(false)
          }
        })
      } else {
        // No data in cloud, try localStorage
        loadFromLocalStorage()
      }
    } catch (err) {
      console.log('Cloud load failed, trying localStorage:', err.message)
      loadFromLocalStorage()
    }
  }

  // Fallback to localStorage
  const loadFromLocalStorage = () => {
    const savedCSV = localStorage.getItem('streaks-csv-data')
    const savedFileName = localStorage.getItem('streaks-csv-filename')

    if (savedCSV && savedFileName) {
      Papa.parse(savedCSV, {
        header: true,
        complete: (results) => {
          try {
            const parsedData = parseCSVData(results.data)
            setData(parsedData)
            setLastFileName(savedFileName)
            setError(null)
            console.log(`Loaded from localStorage: ${savedFileName}`)
          } catch (err) {
            setError('Failed to load saved data: ' + err.message)
          }
          setIsLoading(false)
          setSyncStatus('idle')
        }
      })
    } else {
      setIsLoading(false)
      setSyncStatus('idle')
    }
  }

  // Handle CSV file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const csvContent = e.target.result

      Papa.parse(csvContent, {
        header: true,
        complete: (results) => {
          try {
            const parsedData = parseCSVData(results.data)
            setData(parsedData)
            setLastFileName(file.name)
            setError(null)
            setFileInputKey(Date.now()) // Reset file input for next upload

            // Save to localStorage
            localStorage.setItem('streaks-csv-data', csvContent)
            localStorage.setItem('streaks-csv-filename', file.name)
            console.log(`Saved CSV to localStorage: ${file.name}`)
          } catch (err) {
            setError(err.message)
          }
        },
        error: (err) => {
          setError('Failed to parse CSV: ' + err.message)
        }
      })
    }
    reader.readAsText(file)
  }

  // Clear saved CSV data
  const clearSavedData = () => {
    localStorage.removeItem('streaks-csv-data')
    localStorage.removeItem('streaks-csv-filename')
    setData([])
    setLastFileName(null)
    setError(null)
    setFileInputKey(Date.now())
    console.log('Cleared saved CSV data')
  }

  // Clean CSV data by removing unnecessary columns and trimming data
  const cleanCsvData = (csvText) => {
    const lines = csvText.split('\n')
    if (lines.length === 0) return csvText

    const header = lines[0].split(',')
    
    // Find indices of columns we want to keep
    const keepColumns = ['entry_date', 'entry_type', 'page', 'task_id']
    const keepIndices = keepColumns.map(col => 
      header.findIndex(h => h.trim().toLowerCase().includes(col.toLowerCase()))
    ).filter(idx => idx !== -1)

    if (keepIndices.length === 0) {
      // If no recognized columns, return original (might be generic CSV)
      return csvText
    }

    // Create new header with only kept columns
    const newHeader = keepIndices.map(idx => header[idx]).join(',')
    
    // Process data rows
    const newLines = [newHeader]
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue
      
      const row = lines[i].split(',')
      const newRow = keepIndices.map(idx => {
        let value = row[idx] || ''
        
        // Trim task_id to first 8 characters if it's the task_id column
        if (header[idx] && header[idx].toLowerCase().includes('task_id') && value.length > 8) {
          value = value.substring(0, 8)
        }
        
        return value
      }).join(',')
      
      newLines.push(newRow)
    }

    const cleanedCsv = newLines.join('\n')
    console.log(`CSV cleaned: ${csvText.length} -> ${cleanedCsv.length} chars (${Math.round((1 - cleanedCsv.length/csvText.length) * 100)}% reduction)`)
    
    return cleanedCsv
  }

  // Sync data to cloud (overwrites the fixed bin)
  const syncToCloud = async () => {
    const csvData = localStorage.getItem('streaks-csv-data')
    const fileName = localStorage.getItem('streaks-csv-filename')

    if (!csvData || !fileName) {
      setError('No data to sync')
      return
    }

    // Clean the CSV data to reduce size
    const cleanedCsvData = cleanCsvData(csvData)

    setSyncStatus('loading')
    try {
      const payload = {
        csvData: cleanedCsvData,
        fileName,
        lastUpdated: new Date().toISOString()
      }

      console.log('Syncing to cloud:', {
        payloadSize: JSON.stringify(payload).length,
        fileName,
        originalCsvLength: csvData.length,
        cleanedCsvLength: cleanedCsvData.length
      })

      const response = await fetch(`https://api.jsonbin.io/v3/b/${CLOUD_BIN_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': JSONBIN_API_KEY
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        throw new Error(`Sync failed: ${response.status} ${response.statusText}`)
      }

      console.log('Data synced to cloud!')
      setSyncStatus('success')
    } catch (err) {
      console.error('Sync error:', err)
      setError('Sync failed: ' + err.message)
      setSyncStatus('error')
      setTimeout(() => setSyncStatus('idle'), 3000)
    }
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
    const dateCounts = {} // { date: { dailyCompleted: 0, dailyTotal: 0, weeklyCompleted: 0, weeklyTotal: 0 } }
    let parsedDailyCount = 0
    let parsedWeeklyCount = 0
    let skippedCount = 0

    csvData.forEach((row, index) => {
      // Skip empty rows
      if (!row || !row.entry_date || !row.entry_type) return

      const entryType = row.entry_type.toLowerCase()
      const isCompleted = entryType.includes('completed')
      const isMissed = entryType.includes('missed')

      // Only count completed or missed tasks
      if (!isCompleted && !isMissed) {
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
          dateCounts[dateStr] = { dailyCompleted: 0, dailyTotal: 0, weeklyCompleted: 0, weeklyTotal: 0 }
        }
        dateCounts[dateStr].dailyTotal++
        if (isCompleted) {
          dateCounts[dateStr].dailyCompleted++
        }
        parsedDailyCount++
      }
      // Handle weekly tasks (page 1)
      else if (pageValue === '1') {
        const sunday = getSundayOfWeek(dateStr)
        const weekDays = getWeekDays(sunday)

        weekDays.forEach(day => {
          if (!dateCounts[day]) {
            dateCounts[day] = { dailyCompleted: 0, dailyTotal: 0, weeklyCompleted: 0, weeklyTotal: 0 }
          }
          // Weekly tasks add 1/3 to each day (not 1/6)
          // This gives weekly tasks more weight in the completion percentage
          dateCounts[day].weeklyTotal += 1/3
          if (isCompleted) {
            dateCounts[day].weeklyCompleted += 1/3
          }
        })

        parsedWeeklyCount++
        console.log(`Added weekly task (${isCompleted ? 'completed' : 'missed'}) for week of ${format(sunday, 'MMM d, yyyy')} (${weekDays.length} days)`)
      }
      // Skip other pages
      else {
        console.log(`Skipping non-first/weekly-page entry: ${row.entry_date} (page: ${row.page})`)
        skippedCount++
      }
    })

    console.log(`Parsed ${parsedDailyCount} daily entries, ${parsedWeeklyCount} weekly entries, skipped ${skippedCount} entries`)

    // Convert to array format with percentage as count
    const parsed = Object.entries(dateCounts).map(([date, counts]) => {
      const totalCompleted = counts.dailyCompleted + counts.weeklyCompleted
      const totalTasks = counts.dailyTotal + counts.weeklyTotal
      const percentage = totalTasks > 0 ? (totalCompleted / totalTasks) : 0
      return {
        date,
        count: percentage, // 0 to 1 representing 0% to 100%
        completed: totalCompleted,
        total: totalTasks,
        dailyCompleted: counts.dailyCompleted,
        dailyTotal: counts.dailyTotal,
        weeklyCompleted: counts.weeklyCompleted,
        weeklyTotal: counts.weeklyTotal
      }
    })

    // Filter out days with no tasks at all
    const filtered = parsed.filter(entry => entry.total > 0)

    if (filtered.length === 0) {
      throw new Error('No completed or missed tasks found in CSV')
    }

    return filtered
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

  // Setup custom tooltip handlers after calendar renders
  useEffect(() => {
    if (calendarRef.current && data.length > 0) {
      const timer = setTimeout(() => {
        // Remove empty title elements
        const emptyTitles = calendarRef.current.querySelectorAll('rect title:empty')
        emptyTitles.forEach(title => title.remove())

        // Add custom tooltip handlers
        const rects = calendarRef.current.querySelectorAll('rect[title]')
        rects.forEach(rect => {
          const handleMouseEnter = (e) => {
            const content = rect.getAttribute('title')
            if (content) {
              const containerRect = calendarRef.current.getBoundingClientRect()
              setTooltip({
                show: true,
                content,
                x: e.clientX - containerRect.left + 10,
                y: e.clientY - containerRect.top - 10
              })
            }
          }

          const handleMouseLeave = () => {
            setTooltip({ show: false, content: '', x: 0, y: 0 })
          }

          rect.addEventListener('mouseenter', handleMouseEnter)
          rect.addEventListener('mouseleave', handleMouseLeave)

          return () => {
            rect.removeEventListener('mouseenter', handleMouseEnter)
            rect.removeEventListener('mouseleave', handleMouseLeave)
          }
        })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [data])

  // Get tooltip content
  const getTooltipDataAttrs = (value) => {
    if (!value || !value.date) {
      return {}
    }

    // Build tooltip with breakdown
    const percentage = Math.round(value.count * 100)
    const parts = [`${value.date}: ${percentage}%`]

    // Add daily tasks breakdown if present
    if (value.dailyTotal > 0) {
      const dailyCompletedStr = value.dailyCompleted % 1 === 0 ? value.dailyCompleted.toString() : value.dailyCompleted.toFixed(1)
      const dailyTotalStr = value.dailyTotal % 1 === 0 ? value.dailyTotal.toString() : value.dailyTotal.toFixed(1)
      parts.push(`Daily: ${dailyCompletedStr}/${dailyTotalStr}`)
    }

    // Add weekly tasks breakdown if present
    if (value.weeklyTotal > 0) {
      const weeklyCompletedStr = value.weeklyCompleted % 1 === 0 ? value.weeklyCompleted.toString() : value.weeklyCompleted.toFixed(2)
      const weeklyTotalStr = value.weeklyTotal % 1 === 0 ? value.weeklyTotal.toString() : value.weeklyTotal.toFixed(2)
      parts.push(`Weekly: ${weeklyCompletedStr}/${weeklyTotalStr}`)
    }

    const tooltip = parts.join('\n')

    return {
      'title': tooltip
    }
  }

  if (isLoading) {
    const urlParams = new URLSearchParams(window.location.search)
    const urlDataId = urlParams.get('data')
    
    return (
      <div className="app">
        <h1>📅 Streak Calendar Visualization</h1>
        <div className="loading">
          {urlDataId ? 'Loading shared data from cloud...' : 'Loading saved data...'}
        </div>
      </div>
    )
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
          {lastFileName && (
            <>
              <button 
                onClick={syncToCloud} 
                className="sync-btn"
                disabled={syncStatus === 'loading'}
              >
                {syncStatus === 'loading' ? '☁️ Syncing...' : '☁️ Sync to Cloud'}
              </button>
              <button onClick={clearSavedData} className="clear-btn">
                🗑️ Clear Data
              </button>
            </>
          )}
        </div>

        {syncStatus === 'success' && (
          <div className="sync-status success">
            ✅ Data synced to cloud successfully!
          </div>
        )}

        {syncStatus === 'error' && (
          <div className="sync-status error">
            ❌ Sync failed. Check your internet connection and try again.
          </div>
        )}

        <div className="cloud-section">
          <button
            onClick={() => loadFromCloud()}
            className="refresh-btn"
            disabled={syncStatus === 'loading'}
          >
            {syncStatus === 'loading' ? '🔄 Loading...' : '🔄 Refresh from Cloud'}
          </button>
        </div>

        {lastFileName && (
          <div className="file-info">
            📄 Currently loaded: <strong>{lastFileName}</strong>
            <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
              (Auto-loads on next visit)
            </span>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="info">
          <p><strong>Supported CSV Formats:</strong></p>
          <ul style={{ textAlign: 'left', margin: '0.5rem 0' }}>
            <li><strong>Streaks apps:</strong> Automatically detects exports with <code>entry_date</code> and <code>entry_type</code> columns</li>
            <li style={{ marginTop: '0.3rem' }}><strong>Daily tasks (page 0):</strong> Counted as daily goals</li>
            <li style={{ marginTop: '0.3rem' }}><strong>Weekly tasks (page 1):</strong> Distributed evenly across Sunday to Friday</li>
            <li style={{ marginTop: '0.3rem' }}><strong>Generic:</strong> <code>date,count</code> or <code>day,value</code> format</li>
          </ul>
          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
            <strong>Color = Completion %:</strong> Darkest green means 100% of tasks completed for that day. Both completed and missed tasks are tracked.
          </p>
        </div>
      </div>

      {data.length > 0 && (
        <div className="calendar-container">
          <h2>Your Streak Calendar</h2>
          <p className="stats">
            Total days tracked: <strong>{data.length}</strong> |
            Overall completion: <strong>{Math.round((data.reduce((sum, d) => sum + d.completed, 0) / data.reduce((sum, d) => sum + d.total, 0)) * 100)}%</strong> ({data.reduce((sum, d) => sum + d.completed, 0).toFixed(1)} / {data.reduce((sum, d) => sum + d.total, 0).toFixed(1)} tasks)
          </p>
          <p className="stats" style={{ fontSize: '0.85rem', color: '#666' }}>
            Date range: <strong>{format(startDate, 'MMM d, yyyy')}</strong> to <strong>{format(endDate, 'MMM d, yyyy')}</strong>
            {data.length > 0 && (
              <span> | First entry: <strong>{data.sort((a, b) => new Date(a.date) - new Date(b.date))[0].date}</strong> | Last entry: <strong>{data.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date}</strong></span>
            )}
          </p>

          <div ref={calendarRef} style={{ position: 'relative' }}>
            <CalendarHeatmap
              startDate={startDate}
              endDate={endDate}
              values={data}
              classForValue={(value) => {
                if (!value || value.count === 0) {
                  return 'color-empty'
                }
                // Color based on completion percentage (0-1)
                if (value.count >= 1.0) return 'color-scale-4'  // 100% - darkest green
                if (value.count >= 0.75) return 'color-scale-3' // 75-99% - dark green
                if (value.count >= 0.5) return 'color-scale-2'  // 50-74% - medium green
                if (value.count >= 0.25) return 'color-scale-1' // 25-49% - light green
                return 'color-scale-0' // 1-24% - lightest green
              }}
              tooltipDataAttrs={getTooltipDataAttrs}
              showWeekdayLabels={true}
            />
            {tooltip.show && (
              <div
                style={{
                  position: 'absolute',
                  left: tooltip.x,
                  top: tooltip.y,
                  background: 'rgba(0, 0, 0, 0.8)',
                  color: 'white',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  whiteSpace: 'pre-line',
                  zIndex: 1000,
                  pointerEvents: 'none',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
              >
                {tooltip.content}
              </div>
            )}
          </div>

          <div className="legend">
            <span>0%</span>
            <div className="legend-scale">
              <div className="color-empty"></div>
              <div className="color-scale-0"></div>
              <div className="color-scale-1"></div>
              <div className="color-scale-2"></div>
              <div className="color-scale-3"></div>
              <div className="color-scale-4"></div>
            </div>
            <span>100%</span>
          </div>
        </div>
      )}

      {data.length === 0 && !error && (
        <div className="empty-state">
          <p>👆 Upload a CSV file to get started!</p>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#888' }}>
            Your file will be remembered and auto-loaded next time you visit.
          </p>
        </div>
      )}
    </div>
  )
}

export default App
