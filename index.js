const djs = require("discord.js");
const bot = new djs.Client();
bot.login(process.env.DUMPER_TOKEN);

const fs = require("fs-extra");
const path = require("path");
fs.ensureDir(path.resolve("./dumps"));

const logDate = Date.now().toString();

bot.on("ready", async () => {
    const id = process.argv[2];

    if (bot.guilds.get(id)) {
        process.stdout.write(`Logging the "${bot.guilds.get(id).name}" guild.\n`);
        bot.guilds.get(id).channels.forEach(channel => {
            log(channel);
        });
    } else if (bot.channels.get(id)) {
        process.stdout.write(`Logging the "${displayName(bot.channels.get(id))}" channel.\n`);
        log(bot.channels.get(id));
    } else if (bot.users.get(id).channel) {
        process.stdout.write(`Logging the "${bot.users.get(id).dmChannel}" channel.\n`);
        log(bot.users.get(id).dmChannel);
    } else {
        process.stdout.write("There was not a guild or channel with that ID that I could access.\n");
    }
});

async function channelify(channel) {
    const guildName = channel.guild ? channel.guild.id : "guildless";
    const pathToChannel = path.resolve(`./dumps/${guildName}/${logDate}/${channel.id}.txt`);

    await fs.ensureFile(pathToChannel);

    return pathToChannel;
}
async function log(channel) {
    const logPath = await channelify(channel);
    const logStream = fs.createWriteStream(logPath);

    logStream.write([
        `ℹ️ Name: ${displayName(channel)} (${channel.type})`,
        `ℹ️ ID: ${channel.id}`,
        `ℹ️ Topic: ${channel.topic ? channel.topic : "(Cannot or does not have a topic.)"}`,
        `ℹ️ Creation Date: ${channel.createdAt.toLocaleString()}`
    ].join("\n"));

    if (channel.fetchMessages) {
        logStream.write("\n\n");

        let oldestLogged = null;

        const interval = setInterval(async () => {
            try {
                const fetches = await channel.fetchMessages({
                    limit: 100,
                    before: oldestLogged ? oldestLogged : null,
                });

                if (fetches.size < 1) {
                    process.stdout.write(`Finished logging the ${displayName(channel)} channel.\n`)
                    logStream.end();
                    clearInterval(interval);
                } else {
                    const msgs = fetches.array();
                    oldestLogged = fetches.last().id;

                    msgs.forEach(msg => {
                        logMessage(logStream, msg);
                    });
                }
            } catch (error) {
                process.stdout.write(error + "\n");
            }
        }, 500);
    }
}
function logMessage(logStream, msg) {
    switch (msg.type) {
        case "PINS_ADD":
            return logStream.write(`📌 [${msg.createdAt.toLocaleString()}] A message in this channel was pinned by ${msg.author.tag}.\n`);
        case "GUILD_MEMBER_JOIN":
            return logStream.write(`👋🏼 [${msg.createdAt.toLocaleString()}] ${msg.author.tag} joined the server.\n`);
        case "DEFAULT":
            if (msg.attachments.array().length > 0) {
                return logStream.write(`📎 [${msg.createdAt.toLocaleString()}] (${msg.author.tag}): ${msg.attachments.array().map(atch => atch.url).join(" ")}\n`);
            } else {
                return logStream.write(`💬 [${msg.createdAt.toLocaleString()}] (${msg.author.tag}): ${msg.cleanContent.replace(/\n/g, "\\n")}\n`);
            }
        default:
            logStream.write(`❓ [${msg.createdAt.toLocaleString()}] (${msg.author.tag}): <unknown message of type ${msg.type}>\n`)
    }
}
function displayName(channel) {
    switch (channel.type) {
        case "dm":
            return `${channel.recipient.tag} (${channel.recipient.id})`;
        case "text":
            return "#" + channel.name;
        default:
            return channel.name;
    }
}