const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');
const app = express();

// Tiny web server so UptimeRobot can ping and keep Replit alive
app.get('/', (req, res) => {
    res.send('ChatBout Onboarding Bot is alive');
});

app.listen(3000, () => {
    console.log('Web server running on port 3000');
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});

// When a user joins your server, DM them their Discord ID
client.on('guildMemberAdd', async (member) => {
    const discordId = member.id;

    try {
        await member.send(
            `Welcome to ChatBout!? 👋

Your Discord User ID is **${discordId}**

Copy this into your registration form:
https://nuhbeg.com/registration`
        );
        console.log(`Sent Discord ID ${discordId} to ${member.user.username}`);
    } catch (err) {
        console.log("DM failed — user has DMs off.");
    }
});

client.login(process.env.BOT_TOKEN);
