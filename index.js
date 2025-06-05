const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, Collection } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const config = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.commands = new Collection();


const adminDuyuruKomut = new SlashCommandBuilder()
  .setName('admin-duyuru')
  .setDescription('Belirli role sahip kişilere DM ile duyuru yollar.')
  .addStringOption(opt =>
    opt.setName('mesaj')
      .setDescription('Gönderilecek mesaj')
      .setRequired(true)
  );

const dmKomut = new SlashCommandBuilder()
  .setName('dm')
  .setDescription('Belirtilen kullanıcıya özel mesaj gönderir.')
  .addUserOption(option =>
    option.setName('kisi')
      .setDescription('Mesaj atılacak kişi')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('mesaj')
      .setDescription('Gönderilecek mesaj')
      .setRequired(true)
  );

const komutlar = [adminDuyuruKomut.toJSON(), dmKomut.toJSON()];
client.commands.set('admin-duyuru', adminDuyuruKomut);
client.commands.set('dm', dmKomut);

client.once('ready', async () => {
  console.log(`✅ Bot giriş yaptı: ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(config.token);
  try {
    console.log('🔄 Slash komutları yükleniyor...');
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: komutlar }
    );
    console.log('✅ Komutlar yüklendi.');
  } catch (err) {
    console.error('❌ Komut yükleme hatası:', err);
  }

 
  const guild = await client.guilds.fetch(config.guildId);
  const channel = guild.channels.cache.get(config.voiceChannelId);

  if (!channel || channel.type !== 2) { 
    return console.error('❌ Ses kanalı bulunamadı veya geçerli değil.');
  }

  try {
    joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,   // Kulaklık kapalı
      selfMute: false    // Mikrofon kapalı
    });
    console.log(`🔊 Bot "${channel.name}" kanalına katıldı.`);
  } catch (err) {
    console.error('❌ Ses kanalına bağlanırken hata:', err);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

 
  if (!interaction.member.roles.cache.has(config.authorizedRoleId)) {
    return interaction.reply({ content: '🚫 Bu komutu kullanmak için yetkin yok.', ephemeral: true });
  }

  if (interaction.commandName === 'admin-duyuru') {
    const mesaj = interaction.options.getString('mesaj');
    const hedefRol = interaction.guild.roles.cache.get(config.targetRoleId);
    if (!hedefRol) {
      return interaction.reply({ content: '❌ Hedef rol bulunamadı.', ephemeral: true });
    }

    await interaction.reply({ content: '📨 DM gönderiliyor...', ephemeral: true });

    let sayac = 0;
    const uyeler = await interaction.guild.members.fetch();
    for (const [_, u] of uyeler) {
      if (u.roles.cache.has(config.targetRoleId) && !u.user.bot) {
        try {
          await u.send(mesaj);
          sayac++;
        } catch (err) {
          console.log(`DM gönderilemedi: ${u.user.tag}`);
        }
      }
    }

    await interaction.followUp({ content: `✅ ${sayac} kişiye mesaj gönderildi.`, ephemeral: true });
  }

  if (interaction.commandName === 'dm') {
    const hedef = interaction.options.getUser('kisi');
    const mesaj = interaction.options.getString('mesaj');
    const gonderenMention = `<@${interaction.user.id}>`;

    try {
      await hedef.send(
        `📩 **Yeni bir mesajın var!**\n\n${mesaj}\n\n👤 *Bu mesaj ${gonderenMention} tarafından gönderildi.*`
      );

      await interaction.reply({
        content: `✅ Mesaj başarıyla ${hedef.tag} kullanıcısına gönderildi.`,
        ephemeral: true
      });
    } catch (error) {
      console.error('DM gönderilemedi:', error);
      await interaction.reply({
        content: '❌ Kullanıcının DM\'leri kapalı olabilir veya mesaj gönderilemedi.',
        ephemeral: true
      });
    }
  }
});

client.login(config.token);