
const {
  Client,
  GatewayIntentBits,
  AuditLogEvent,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionsBitField,
  Events
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== إعدادات القنوات والرتب =====
const LOGS = {
  joinLeave: "1483028878590087189",
  roles: "1483029015991287808",
  punishments: "1483029219721347102",
  messageDelete: "1483029256954187880",
  messageCreate: "1483429957819568158"
};

const GUILD_ID = "1480125656753766554";
const WELCOME_CHANNEL = "1480128982996357313";
const AUTO_ROLE_ID = "1480937552386064536";

// ===== التوكن =====
const TOKEN = process.env.TOKEN; // يقرأ التوكن من ملف .env

// ===== دالة ارسال بدون منشن =====
async function sendLog(channel, content) {
  if (!channel) return;
  channel
    .send({
      content,
      allowedMentions: { parse: [] },
      flags: 4096
    })
    .catch(() => {});
}

// ===== تشغيل البوت =====
client.once(Events.ClientReady, async clientInstance => {
  console.log(`✅ Bot Online: ${clientInstance.user.tag}`);

  // أوامر Slash
  const commands = [
    new SlashCommandBuilder().setName("lock").setDescription("قفل الشات"),
    new SlashCommandBuilder().setName("unlock").setDescription("فتح الشات"),
    new SlashCommandBuilder()
      .setName("say")
      .setDescription("ارسال رسالة عن طريق البوت")
      .addStringOption(o =>
        o.setName("text").setDescription("النص").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("تبنيد عضو")
      .addUserOption(o =>
        o.setName("user").setDescription("العضو").setRequired(true)
      )
      .addStringOption(o =>
        o.setName("reason").setDescription("السبب").setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("clear")
      .setDescription("مسح رسائل")
      .addStringOption(o =>
        o
          .setName("amount")
          .setDescription("عدد الرسائل أو all")
          .setRequired(true)
      )
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(clientInstance.user.id, GUILD_ID),
      { body: commands }
    );
    console.log("✅ Commands Loaded");
  } catch (err) {
    console.error("❌ Error loading commands:", err);
  }
});

// ================= دخول =================
client.on("guildMemberAdd", async member => {
  const channel = member.guild.channels.cache.get(LOGS.joinLeave);
  sendLog(
    channel,
    `📥 **دخول عضو**
👤 ${member}
🆔 ${member.id}
📅 <t:${Math.floor(Date.now() / 1000)}:F>`
  );

  const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL);
  if (welcomeChannel)
    welcomeChannel.send(`👋 أهلاً وسهلاً ${member} في السيرفر ❤️`);

  const role = member.guild.roles.cache.get(AUTO_ROLE_ID);
  if (role && !member.roles.cache.has(role.id)) {
    try {
      await member.roles.add(role);
      sendLog(
        channel,
        `🎁 تم اعطاء رتبة <@&${role.id}> للعضو ${member}`
      );
    } catch (err) {
      console.error("❌ خطأ عند اعطاء الرتبة:", err);
    }
  }
});

// ================= خروج / كيك =================
client.on("guildMemberRemove", async member => {
  const joinLeave = member.guild.channels.cache.get(LOGS.joinLeave);
  const punish = member.guild.channels.cache.get(LOGS.punishments);

  const logs = await member.guild
    .fetchAuditLogs({
      type: AuditLogEvent.MemberKick,
      limit: 1
    })
    .catch(() => {});

  const entry = logs?.entries.first();

  if (entry && entry.target.id === member.id) {
    sendLog(
      punish,
      `👢 **كيك**
👤 ${member.user.tag}
🛠️ بواسطة: ${entry.executor}`
    );
  } else {
    sendLog(
      joinLeave,
      `📤 **خروج عضو**
👤 ${member.user.tag}
🆔 ${member.id}
📅 <t:${Math.floor(Date.now() / 1000)}:F>`
    );
  }
});

// ================= بان =================
client.on("guildBanAdd", async ban => {
  const channel = ban.guild.channels.cache.get(LOGS.punishments);

  const logs = await ban.guild.fetchAuditLogs({
    type: AuditLogEvent.MemberBanAdd,
    limit: 1
  });

  const executor = logs.entries.first()?.executor;

  sendLog(
    channel,
    `🔨 **باند**
👤 ${ban.user.tag}
🛠️ بواسطة: ${executor}`
  );
});

// ================= تحديث عضو (رتب فقط) =================
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  const roleChannel = newMember.guild.channels.cache.get(LOGS.roles);

  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;

  const added = newRoles.filter(r => !oldRoles.has(r.id));
  const removed = oldRoles.filter(r => !newRoles.has(r.id));

  if (added.size || removed.size) {
    const logs = await newMember.guild.fetchAuditLogs({
      type: AuditLogEvent.MemberRoleUpdate,
      limit: 1
    });

    const executor = logs.entries.first()?.executor;

    added.forEach(role => {
      sendLog(
        roleChannel,
        `🎭 **إعطاء رتبة**
👤 ${newMember}
🎖️ ${role}
🛠️ بواسطة: ${executor}`
      );
    });

    removed.forEach(role => {
      sendLog(
        roleChannel,
        `❌ **سحب رتبة**
👤 ${newMember}
🎖️ ${role}
🛠️ بواسطة: ${executor}`
      );
    });
  }
});

// ================= حذف رسالة =================
client.on("messageDelete", message => {
  if (!message.guild || message.author?.bot) return;

  const channel = message.guild.channels.cache.get(LOGS.messageDelete);
  sendLog(
    channel,
    `🗑️ **حذف رسالة**
👤 ${message.author}
📍 ${message.channel}
📝 ${message.content || "صورة/ملف"}`
  );
});

// ================= ارسال رسالة =================
client.on("messageCreate", message => {
  if (!message.guild || message.author.bot) return;

  const channel = message.guild.channels.cache.get(LOGS.messageCreate);
  sendLog(
    channel,
    `📩 **إرسال رسالة**
👤 ${message.author}
📍 ${message.channel}
📝 ${message.content}`
  );

  if (message.content.includes("كود")) {
    message.reply("nsmbkrpf");
  }
});

// ================= أوامر Slash =================
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  if (i.commandName === "lock") {
    if (!i.member.permissions.has(PermissionsBitField.Flags.ManageChannels))
      return i.reply({ content: "❌ ما عندك صلاحية", ephemeral: true });

    await i.channel.permissionOverwrites.edit(i.guild.id, {
      SendMessages: false
    });
    i.reply("🔒 Channel Locked");
  }

  if (i.commandName === "unlock") {
    if (!i.member.permissions.has(PermissionsBitField.Flags.ManageChannels))
      return i.reply({ content: "❌ ما عندك صلاحية", ephemeral: true });

    await i.channel.permissionOverwrites.edit(i.guild.id, {
      SendMessages: true
    });
    i.reply("🔓 Channel Unlocked");
  }

  if (i.commandName === "say") {
    const t = i.options.getString("text");
    await i.channel.send(t);
    i.reply({ content: "✅ تم", ephemeral: true });
  }

  if (i.commandName === "ban") {
    const u = i.options.getUser("user");
    const r = i.options.getString("reason") || "بدون سبب";
    await i.guild.members.ban(u.id, { reason: r });
    i.reply(`🔨 تم باند ${u}\n📌 ${r}`);
  }

  if (i.commandName === "clear") {
    if (!i.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return i.reply({ content: "❌ ما عندك صلاحية", ephemeral: true });

    const amount = i.options.getString("amount");
    const messages = await i.channel.messages.fetch({ limit: 100 });

    if (amount.toLowerCase() === "all") {
      await i.channel.bulkDelete(messages, true).catch(() => {});
      i.reply({
        content: `🧹 تم مسح جميع الرسائل في الروم`,
        ephemeral: true
      });
    } else {
      let num = parseInt(amount);
      if (isNaN(num) || num < 1) num = 1;
      if (num > 100) num = 100;

      await i.channel.bulkDelete(num, true).catch(() => {});
      i.reply({
        content: `🧹 تم مسح ${num} رسالة`,
        ephemeral: true
      });
    }
  }
});

client.login(TOKEN);
