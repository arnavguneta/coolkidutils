const Guild = require('@models/guild')
const { economyConfig } = require('@common/config')

class GuildRepository {
    constructor(id) {
        this.id = id;
    }
    async _create() {
        this.guild = new Guild({ id: guild.id, balance: economyConfig.getGuildInitBalance() })
        await this.guild.save()
    }
    _getData() {
        return this.guild
    }
    async fetchById() {
        this.guild = await Guild.findOne({ id: this.id });
        if (!this.guild) {
            await this._create()
            console.log(`${process.env.LOG_PREFIX} INFO: New guild ${this.guild.id} created`)
        }
        return this._getData();
    }
    getGuild() {
        return this.guild
    }
}

module.exports = GuildRepository 