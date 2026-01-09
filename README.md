# Streak Calendar Visualization

A beautiful calendar heatmap visualization (like GitHub's contribution graph) to track your daily streaks and task completions!

## Features

- **CSV Upload**: Upload your streak data from any app
- **Beautiful Heatmap**: GitHub-style calendar visualization showing your activity
- **Flexible Format**: Automatically detects common CSV formats
- **Sample Data**: Test it out with randomly generated data
- **Stats Display**: See total days tracked and completions
- **Responsive Design**: Works on desktop and mobile

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Development Server

```bash
npm run dev
```

The app will open at `http://localhost:5173`

### 3. Build for Production

```bash
npm run build
```

## How to Use

### Option 1: Upload Your CSV

1. Click the "Upload CSV File" button
2. Select your CSV file from your streaks app
3. The calendar will automatically render!

### Option 2: Try Sample Data

Click the "Load Sample Data" button to see how it works with random data.

## CSV Format

Your CSV file should have a header row with date and count columns. The app supports multiple formats:

**Standard Format:**
```csv
date,count
2025-01-09,5
2025-01-08,3
2025-01-07,4
```

**Alternative Formats (also supported):**
```csv
day,value
2025-01-09,2
```

```csv
Date,Count
2025-01-09,3
```

### Date Format

Dates should be in ISO format: `YYYY-MM-DD` (e.g., `2025-01-09`)

### Count

The count represents how many tasks/activities you completed that day. The color intensity increases with higher counts:

- **0**: Light gray (no activity)
- **1**: Light green
- **2**: Medium green
- **3-4**: Dark green
- **5+**: Darkest green

## Exporting Data from Your Streaks App

Most streaks/habit tracking apps support CSV export:

### Common Apps:

- **Habitica**: Settings → Data → Export Data
- **Streaks**: Settings → Export Data
- **Loop Habit Tracker**: Three dots menu → Export as CSV
- **Habitify**: Profile → Settings → Export Data
- **Way of Life**: Settings → Backup & Restore → Export

### Manual CSV Creation

If your app doesn't export CSV, you can create one manually:

1. Open Excel, Google Sheets, or Numbers
2. Create two columns: `date` and `count`
3. Fill in your data
4. Export as CSV

## Transferring CSV from Phone to Computer

### For Android/iOS to Windows:

1. **Email**: Email the file to yourself
2. **Cloud Storage**: Upload to Google Drive/OneDrive/Dropbox, download on PC
3. **USB Cable**: Connect phone to PC, browse files
4. **Messaging App**: Send to yourself on WhatsApp/Telegram "Saved Messages"

## Technologies Used

- **React** - UI framework
- **Vite** - Fast build tool
- **react-calendar-heatmap** - Calendar visualization
- **PapaParse** - CSV parsing
- **date-fns** - Date manipulation

## Customization

### Change Colors

Edit the color classes in `src/App.css`:

```css
.color-scale-1 { fill: #9be9a8; } /* Light */
.color-scale-2 { fill: #40c463; } /* Medium */
.color-scale-3 { fill: #30a14e; } /* Dark */
.color-scale-4 { fill: #216e39; } /* Darkest */
```

### Adjust Date Range

By default, the calendar shows the last 365 days. To change this, edit `src/App.jsx`:

```javascript
const startDate = subDays(endDate, 365) // Change 365 to your desired number
```

## Troubleshooting

### CSV Not Loading?

- Make sure your CSV has a header row
- Check that dates are in `YYYY-MM-DD` format
- Ensure the file is a plain CSV (not Excel .xlsx)

### Calendar Not Showing?

- Check the browser console for errors
- Make sure you have data for recent dates
- Try the "Load Sample Data" button to verify the app works

## Sample Data

A sample CSV file is included: `sample-streaks.csv`

Try uploading it to see how the visualization works!

## License

MIT - Free to use and modify!
