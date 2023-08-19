const User = require('@models/user')

class UserRepository {
    constructor(id, tag = null, guildId = null) {
        this.id = id;
        this.guildId = guildId;
        this.tag = tag ?? '';
    }
    async _create() {
        try {
            this.user = new User({ tag: this.tag, id: this.id })
            await this.user.save()
        } catch (error) {
            console.error(`${process.env.LOG_PREFIX} ERROR: Saving user ${this.id} with tag ${this.tag} to database failed`)
        }
    }
    _getData() {
        return { user: this.user, guildAccount: this.guildAccount }
    }
    async fetchById() {
        this.user = await User.findOne({ id: this.id });
        return this.user
    }

    async fetchByIdOrSync() {
        await this.fetchById()
        if (!this.user) {
            await this._create()
            console.log(`${process.env.LOG_PREFIX} INFO: User ${this.tag} account created for guild ${this.guildId}`)
        }

        if (!this.guildId) return this._getData();
        this.guildAccount = this.user.getGuildAccount(this.guildId)
        if (!this.user.hasGuildAccount(this.guildId)) {
            this.user.accounts = [...this.user.accounts, this.guildAccount]
            await this.user.save()
            console.log(`${process.env.LOG_PREFIX} INFO: User ${this.tag} guild account added for guild ${this.guildId}`)
        } else if (this.guildAccount.left) {
            this.guildAccount.left = false
            await this.user.save()
        }
        return this._getData();
    }
    getUser() {
        return this.user
    }
    getGuildAccount() {
        return this.guildAccount
    }
    get() {
        return this._getData()
    }
}

module.exports = UserRepository 