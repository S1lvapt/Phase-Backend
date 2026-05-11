const MMCodes = require("../../../model/mmcodes.js");
const { MessageEmbed } = require("discord.js");
const log = require("../../../structs/log.js");
const config = require('../../../Config/config.json')

module.exports = {
    commandInfo: {
        name: "custom-match-code-list",
        description: "Lists all custom matchmaking codes.",
    },
    execute: async (interaction) => {
        if (!config.moderators.includes(interaction.user.id)) {
            return interaction.reply({ content: "You do not have moderator permissions.", ephemeral: true });
        }

        try {
            const codes = await MMCodes.find({});

            if (codes.length === 0) {
                return interaction.reply({ content: "No custom matchmaking codes found.", ephemeral: true });
            }

            const embed = new MessageEmbed()
                .setTitle("Custom Matchmaking Codes")
                .setDescription("Here is the list of all custom matchmaking codes:")
                .setColor("GREEN")
                .setTimestamp()
                .setFooter({
                    text: "Phase Backend",
                    iconURL: "https://cdn.discordapp.com/attachments/1464667023479930962/1491022027551805540/Obq4q2.jpg?ex=69dacb39&is=69d979b9&hm=4ce43a1db54f2860794a7a859b9e55a3f498f6d33938a1ac3dedc3e01e99bcb5"
                });

            codes.forEach(code => {
                embed.addFields([
                    { name: "Code", value: code.code, inline: true },
                    { name: "IP", value: code.ip, inline: true },
                    { name: "Port", value: code.port.toString(), inline: true }
                ]);
            });

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            log.error(error);
            return interaction.reply({ content: "An error occurred while fetching the codes.", ephemeral: true });
        }
    }
};