const fs = require('fs')
const ko = fs
  .readFileSync('./ko', 'utf8')
  .split('\n')
  .filter(x => !!x)
  .map((line, index) => {
    const id = line.split(' ').pop()
    const [date, time] = line.split(' ')
    return {
      id,
      index,
      line,
      timestamp: +new Date([date, time].join(' '))
    }
  })
  .sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1))
  .map(x => x.id)
fs.writeFileSync('./ids-ko.json', JSON.stringify(ko, null, 2))
