const fs = require("fs");
const chokidar = require('chokidar');
const path = require('path')

let configs = {}, paths = {}
const main = 'main', economy = 'economy', cooldowns = 'cooldowns', servers = 'servers'
const configsFolder = '../config'

const readConfigs = (dir) => {
    const files = fs.readdirSync(path.join(__dirname, dir))
    for (const file of files) {
        const stat = fs.lstatSync(path.join(__dirname, dir, file))
        if (stat.isDirectory()) {
            readConfigs(path.join(dir, file))
        } else {
            const configName = file.replace('.json', '')
            const filePath = path.join(__dirname, dir, file)
            configs[configName] = require(filePath)
            paths[configName] = filePath
            console.log(`${process.env.LOG_PREFIX} INFO: Loading config "${file}"`)
            chokidar.watch(filePath).on('change', () => {
                delete require.cache[require.resolve(filePath)];
                configs[configName] = require(filePath);
                console.log(`${process.env.LOG_PREFIX} INFO: Reloading config "${file}"`)
            });
        }
    }
}
readConfigs(configsFolder)

function setConfig(type, key, state) {
    const props = key.split('.')
    let obj = configs[type]
    for (let i = 0; i < props.length - 1; i++) {
        obj = obj[props[i]];
    }
    key = (props.length > 1) ? props[props.length - 1] : key
    if (obj[key] === state) return state
    obj[key] = state
    fs.writeFileSync(paths[type], JSON.stringify(configs[type], null, 2), err => { })
    return state
}

module.exports = {
    mainConfig: {
        setDeployCommands(deploy) {
            return setConfig('main', 'settings.deployCommands', deploy)
        },
        getDeployCommands() {
            return configs[main].settings.deployCommands
        }
    },
    cooldownsConfig: {
        getCommands() {
            return configs[cooldowns].commands
        },
        getInfo(type) {
            return configs[cooldowns].commands[type] || configs[cooldowns][type]
        },
        getPadding() {
            return configs[cooldowns].PADDING
        },
        getSecondsInMs() {
            return configs[cooldowns].SECONDS_IN_MS
        },
        getExpiration(type) {
            return (configs[cooldowns].commands[type] || configs[cooldowns][type]).expiration
        },
    }
}
