const path = require('path')
const fs = require('fs')

module.exports = async (client) => {
    let registerPriority = true
    const readEvents = async (dir) => {
        if (!registerPriority && dir.includes('priority')) return
        const files = fs.readdirSync(path.join(__dirname, dir))
        for (const file of files) {
            const stat = fs.lstatSync(path.join(__dirname, dir, file))
            if (stat.isDirectory()) {
                readEvents(path.join(dir, file))
            } else if (file !== 'load-events.js') {
                const event = require(path.join(__dirname, dir, file))
                console.log(`${process.env.LOG_PREFIX} INFO: Registering event "${file}"`)
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args));
                } else {
                    client.on(event.name, (...args) => event.execute(...args));
                }
            }
        }
    }
    await readEvents('./events/priority')
    registerPriority = false
    await readEvents('.')
}