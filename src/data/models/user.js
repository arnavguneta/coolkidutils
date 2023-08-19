const mongoose = require('mongoose')
const { economyConfig } = require('@common/config')

const userSchema = new mongoose.Schema({
    tag: {
        type: String,
        required: false,
        trim: true,
        _id: false
    },
    id: {
        type: Object,
        required: true,
        trim: true,
        _id: false
    },
    accounts: [{
        guild: {
            type: Object,
            required: false,
            trim: true,
            _id: false
        }
    }]
})


userSchema.methods.hasGuildAccount = function (guildId) {
    for (account of this.accounts)
        if (account.guild === guildId)
            return true
    return false
}

userSchema.methods.getGuildAccount = function (guildId) {
    for (account of this.accounts)
        if (account.guild === guildId)
            return account
    return { guild: guildId, left: false, badges: [] }
}

const User = mongoose.model('User', userSchema)

module.exports = User