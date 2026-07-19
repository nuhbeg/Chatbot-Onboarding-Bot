require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const express = require('express');

// ─── Express health-check server ────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', bot: 'chatbout-onboarding-bot', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`[Express] Health server listening on port ${PORT}`);
});

// ─── Discord client ──────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// ─── Config (set these in your .env or Replit Secrets) ───────────────────────
const WELCOME_CHANNEL_NAME = process.env.WELCOME_CHANNEL_NAME || 'welcome';
const ONBOARDING_ROLE_NAME  = process.env.ONBOARDING_ROLE_NAME  || 'Member';
const RULES_CHANNEL_NAME    = process.env.RULES_CHANNEL_NAME    || 'rules';

// ─── Ready ───────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, () => {
  console.log(`[Discord] Logged in as ${client.user.tag}`);
  client.user.setActivity('onboarding new members 👋');
});

// ─── New member joins ─────────────────────────────────────────────────────────
client.on(Events.GuildMemberAdd, async (member) => {
  console.log(`[Discord] New member joined: ${member.user.tag}`);

  // 1. Assign onboarding role if it exists
  const role = member.guild.roles.cache.find(r => r.name === ONBOARDING_ROLE_NAME);
  if (role) {
    try {
      await member.roles.add(role);
      console.log(`[Discord] Assigned role "${ONBOARDING_ROLE_NAME}" to ${member.user.tag}`);
    } catch (err) {
      console.error(`[Discord] Failed to assign role: ${err.message}`);
    }
  }

  // 2. Send a welcome embed in the welcome channel
  const welcomeChannel = member.guild.channels.cache.find(
    c => c.name === WELCOME_CHANNEL_NAME && c.isTextBased()
  );

  if (welcomeChannel) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`👋 Welcome to ${member.guild.name}, ${member.user.username}!`)
      .setDescription(
        `We're thrilled to have you here.\n\n` +
        `**Getting started:**\n` +
        `• Read the <#${getRulesChannelId(member.guild)}> to learn the community guidelines.\n` +
        `• Introduce yourself and let us know how you found us!\n` +
        `• Reach out to any moderator if you need help.\n\n` +
        `Enjoy your time here! 🎉`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp()
      .setFooter({ text: `Member #${member.guild.memberCount}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('View Rules')
        .setStyle(ButtonStyle.Primary)
        .setCustomId('view_rules'),
      new ButtonBuilder()
        .setLabel('Introduce Yourself')
        .setStyle(ButtonStyle.Success)
        .setCustomId('introduce'),
    );

    try {
      await welcomeChannel.send({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error(`[Discord] Failed to send welcome message: ${err.message}`);
    }
  }

  // 3. DM the new member with onboarding instructions
  try {
    const dmEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(`🎉 Welcome to ${member.guild.name}!`)
      .setDescription(
        `Hey **${member.user.username}**, welcome aboard!\n\n` +
        `Here's a quick rundown to get you started:\n\n` +
        `**📋 Step 1 — Read the rules**\nCheck out the #${RULES_CHANNEL_NAME} channel to understand community standards.\n\n` +
        `**👋 Step 2 — Introduce yourself**\nTell us a bit about yourself in #${WELCOME_CHANNEL_NAME}.\n\n` +
        `**💬 Step 3 — Join the conversation**\nExplore channels and jump into discussions you care about.\n\n` +
        `If you have any questions, ping a moderator — we're happy to help!`
      )
      .setTimestamp();

    await member.send({ embeds: [dmEmbed] });
  } catch (err) {
    // DMs may be closed — silently ignore
    console.warn(`[Discord] Could not DM ${member.user.tag}: ${err.message}`);
  }
});

// ─── Button interactions ──────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'view_rules') {
    const rulesChannel = interaction.guild.channels.cache.find(
      c => c.name === RULES_CHANNEL_NAME && c.isTextBased()
    );
    const mention = rulesChannel ? `<#${rulesChannel.id}>` : `#${RULES_CHANNEL_NAME}`;
    await interaction.reply({
      content: `📜 You can find our rules in ${mention}`,
      ephemeral: true,
    });
  }

  if (interaction.customId === 'introduce') {
    await interaction.reply({
      content: `✍️ Head over to <#${getRulesChannelId(interaction.guild)}> — or any introduction channel — and tell us who you are!`,
      ephemeral: true,
    });
  }
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function getRulesChannelId(guild) {
  const ch = guild.channels.cache.find(c => c.name === RULES_CHANNEL_NAME && c.isTextBased());
  return ch ? ch.id : RULES_CHANNEL_NAME;
}

// ─── Login ────────────────────────────────────────────────────────────────────
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('[ERROR] DISCORD_BOT_TOKEN is not set. Add it to your Replit Secrets.');
  process.exit(1);
}

client.login(token).catch(err => {
  console.error(`[ERROR] Failed to login: ${err.message}`);
  process.exit(1);
});
