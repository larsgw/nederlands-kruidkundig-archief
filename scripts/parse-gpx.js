const fs = require('fs')
const path = require('path')

const file = path.join(process.cwd(), process.argv[2])
const text = fs.readFileSync(file, 'utf8')

const coordinates = [...text.matchAll(/lat="(.+?)" lon="(.+?)"/g)].map(match => match.slice(1, 3).map(parseFloat).reverse())

console.log(JSON.stringify(coordinates, null, 2).replace(/\n/g, '\n        ').trim())
