/** @todo come up with a better name for this (this gets readable stats from invite roles) */
function getStats (rule) {
  function relativeTime (oldTime) {
    const difference = Math.round((Date.now() - oldTime) / 1000)
    switch (true) {
      case difference < 1: return 'just now'
      case difference < 60: return difference + 's'
      case difference < 3600: return Math.floor(difference / 60) + 'm'
      case difference < 86400: return Math.floor(difference / 3600) + 'h'
      case difference < 86400 * 7: return Math.floor(difference / 86400) + 'd'
      default: return new Date(oldTime).toLocaleDateString()
    }
  }
  const { created_at: creationDate, updated_at: updateDate, occurrences } = rule
  return {
    created_at: relativeTime(creationDate),
    updated_at: relativeTime(updateDate),
    occurrences
  }
}

module.exports = { getStats }
