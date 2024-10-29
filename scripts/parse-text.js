const path = require('path')
const fs = require('fs').promises
const proj4 = require('proj4')

proj4.defs('EPSG:28992', '+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.4171,50.3319,465.5524,1.9342,-1.6677,9.1019,4.0725 +units=m +no_defs +type=crs')
proj4.defs('EPSG:4326', '+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees');

const rows = 'GHJKLMNPQRSTV'
const rowHeight = 25
const columnWidth = 40
const notationFormat = /^([GHJKLMNPQRSTV]) ?([1-8])[.,]? ([1-6])([1-8])[.,]? ([1-4])([1-4])$/

function parseArea (notation) {
  if (!notationFormat.test(notation)) {
    throw new SyntaxError(`Not expecting "${notation}"`)
  }

  const coordinates = { x: -20, y: 300 }
  const parts = notation.trim().match(notationFormat).slice(1)

  // National grid
  coordinates.x += (parts[1] - 1) * columnWidth
  coordinates.y += (rows.length - rows.indexOf(parts[0])) * rowHeight

  // 8x6 'uurhokken' subgrid
  coordinates.x += (parts[3] - 1) * columnWidth / 8
  coordinates.y -= (parts[2] - 1) * rowHeight / 6

  // 2x2 subgrid
  coordinates.x += (parts[4] % 2 ? 0 : 1) * columnWidth / (8 * 2)
  coordinates.y -= (parts[4] > 2 ? 1 : 0) * rowHeight / (6 * 2)

  // 2x2 subgrid
  coordinates.x += (parts[5] % 2 ? 0 : 1) * columnWidth / (8 * 2 * 2)
  coordinates.y -= (parts[5] > 2 ? 1 : 0) * rowHeight / (6 * 2 * 2)

  // center
  coordinates.x += columnWidth / (8 * 2 * 2 * 2)
  coordinates.y -= rowHeight / (6 * 2 * 2 * 2)

  coordinates.x *= 1000
  coordinates.y *= 1000

  return {
    normalized: `${parts[0]} ${parts[1]}. ${parts[2]}${parts[3]}. ${parts[4]}${parts[5]}`,
    coordinates: proj4('EPSG:28992', 'EPSG:4326', coordinates)
  }
}

function parseFile (file) {
  const areas = {}
  const taxa = []

  for (const taxon of file.trim().split('\n\n')) {
    const [info, ...observations] = taxon.split('\n')

    if (observations.length === 0) {
      taxa.push(taxon)
    }

    for (const observation of observations) {
      if (!areas[observation]) { areas[observation] = [] }
      areas[observation].push(info)
    }
  }

  return { taxa, areas }
}

function formatArea (area, taxa) {
  const { normalized, coordinates } = parseArea(area)

  const data = {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [coordinates.x, coordinates.y]
    },
    properties: {
      location: normalized,
      taxa: [],
      label: `<b>${normalized}</b>`
    }
  }

  for (const taxon of taxa) {
    const [name, comments] = taxon.split(/: */)
    data.properties.taxa.push(name)
    if (comments) {
      data.properties.label += `<br><i>${name}</i>: ${comments}`
    } else {
      data.properties.label += `<br><i>${name}</i>`
    }
  }

  return data
}

async function main (file) {
  const text = await fs.readFile(path.join(process.cwd(), file), 'utf8')
  const { taxa, areas } = parseFile(text)

  for (const taxon of taxa) {
    const [name, comments] = taxon.split(/: */)
    if (comments) {
      console.error(`<li><i>${name}</i>: ${comments}</li>`)
    } else {
      console.error(`<li><i>${name}</i></li>`)
    }
  }

  const data = {
    type: 'FeatureCollection',
    features: []
  }

  for (const area in areas) {
    data.features.push(formatArea(area, areas[area]))
  }

  console.log(JSON.stringify(data, null, 2))
}

main(process.argv[2])
