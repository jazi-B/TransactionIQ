export function isSuspiciousTransaction(dateStr: string): boolean {
  if (!dateStr) return false

  try {
    // Try parsing directly
    let timestamp = Date.parse(dateStr)

    if (isNaN(timestamp)) {
      const cleanStr = dateStr.trim().replace(/\s+/g, " ")

      // Check for dd-mm-yyyy or dd/mm/yyyy
      const dmyMatch = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
      if (dmyMatch) {
        const day = Number(dmyMatch[1])
        const month = Number(dmyMatch[2]) - 1
        const year = Number(dmyMatch[3])
        timestamp = new Date(year, month, day).getTime()
      } else {
        // Check for yyyy-mm-dd or yyyy/mm/dd
        const ymdMatch = cleanStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
        if (ymdMatch) {
          const year = Number(ymdMatch[1])
          const month = Number(ymdMatch[2]) - 1
          const day = Number(ymdMatch[3])
          timestamp = new Date(year, month, day).getTime()
        }
      }
    }

    if (isNaN(timestamp)) {
      return false
    }

    const txDate = new Date(timestamp)
    txDate.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const diffTime = today.getTime() - txDate.getTime()
    const diffDays = diffTime / (1000 * 60 * 60 * 24)

    // Suspicious if 5 or more days old
    return diffDays >= 5
  } catch {
    return false
  }
}
