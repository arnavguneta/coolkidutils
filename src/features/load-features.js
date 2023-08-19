const path = require('path')
const fs = require('fs')

module.exports = async (client) => {
  const readFeatures = async (dir) => {
    if (dir.includes('deprecated')) return
    const files = fs.readdirSync(path.join(__dirname, dir))
    for (const file of files) {
      const stat = fs.lstatSync(path.join(__dirname, dir, file))
      if (stat.isDirectory()) {
        await readFeatures(path.join(dir, file))
      } else if (file !== 'load-features.js') {
        const feature = require(path.join(__dirname, dir, file))
        console.log(`${process.env.LOG_PREFIX} INFO: Enabling feature "${file}"`)
        console.time(`${process.env.LOG_PREFIX} INFO: Loading "${file}" took`)
        await feature(client)
        console.timeEnd(`${process.env.LOG_PREFIX} INFO: Loading "${file}" took`)
      }
    }
  }
  await readFeatures('.')
}