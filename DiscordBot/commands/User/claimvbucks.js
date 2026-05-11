const { MessageEmbed } = require("discord.js");
const Users = require('../../../model/user.js');
const Profiles = require('../../../model/profiles.js');
const log = require("../../../structs/log.js");

module.exports = {
    commandInfo: {
        name: "claimvbucks",
        description: "Claim your daily 250 V-Bucks"
    },
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const user = await Users.findOne({ discordId: interaction.user.id });
            if (!user) {
                return interaction.followUp({ content: "You are not registered", ephemeral: true });
            }

            const userProfile = await Profiles.findOne({ accountId: user?.accountId });

            const lastClaimed = userProfile?.profiles?.lastVbucksClaim;
            if (lastClaimed && (Date.now() - new Date(lastClaimed).getTime() < 24 * 60 * 60 * 1000)) {
                const timeLeft = 24 - Math.floor((Date.now() - new Date(lastClaimed).getTime()) / (1000 * 60 * 60));
                return interaction.followUp({
                    content: `You have already claimed your daily **V-Bucks.** Please wait the remainder: **${timeLeft} hours.**`,
                    ephemeral: true
                });
            }

            const filter = { accountId: user?.accountId };
            const updateCommonCore = { $inc: { 'profiles.common_core.items.Currency:MtxPurchased.quantity': 250 } };
            const updateProfile0 = { $inc: { 'profiles.profile0.items.Currency:MtxPurchased.quantity': 250 } };

            const userUpdatedProfile = await Profiles.findOneAndUpdate(
                filter,
                {
                    ...updateCommonCore,
                    $set: { 'profiles.lastVbucksClaim': Date.now() }
                },
                { new: true }
            );

            await Profiles.updateOne(filter, updateProfile0);

            const common_core = userUpdatedProfile.profiles["common_core"];
            const profile0 = userUpdatedProfile.profiles["profile0"];

            const newQuantityCommonCore = common_core.items['Currency:MtxPurchased'].quantity;
            const newQuantityProfile0 = profile0.items['Currency:MtxPurchased'].quantity;

            common_core.rvn += 1;
            common_core.commandRevision += 1;

            await Profiles.updateOne(filter, {
                $set: {
                    'profiles.common_core': common_core,
                    'profiles.profile0.items.Currency:MtxPurchased.quantity': newQuantityProfile0
                }
            });

            const embed = new MessageEmbed()
                .setTitle("Daily V-Bucks Claimed!")
                .setDescription(`You have claimed your daily **250 V-Bucks**!`)
                .setThumbnail("https://i.imgur.com/yLbihQa.png")
                .setColor("#1eff00")
                .setFooter({
                    text: "Phase Backend",
                    iconURL: "https://cdn.discordapp.com/attachments/1464667023479930962/1491022027551805540/Obq4q2.jpg?ex=69dacb39&is=69d979b9&hm=4ce43a1db54f2860794a7a859b9e55a3f498f6d33938a1ac3dedc3e01e99bcb5"
                });

            await interaction.followUp({
                embeds: [embed],
                ephemeral: true
            });

            return {
                profileRevision: common_core.rvn,
                profileCommandRevision: common_core.commandRevision,
                newQuantityCommonCore,
                newQuantityProfile0
            };

        } catch (error) {
            log.error(error);
        }
    }
};