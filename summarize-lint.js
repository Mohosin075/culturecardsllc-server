const fs = require('fs')
const data = JSON.parse(fs.readFileSync('lint-results.json', 'utf8'))

const summary = data
  .filter(file => file.errorCount > 0)
  .map(file => ({
    filePath: file.filePath,
    errorCount: file.errorCount,
    messages: file.messages.map(m => ({
      line: m.line,
      ruleId: m.ruleId,
      message: m.message,
    })),
  }))
  .sort((a, b) => b.errorCount - a.errorCount)

fs.writeFileSync('lint-summary.json', JSON.stringify(summary, null, 2))
console.log(`Found ${summary.length} files with errors.`)
