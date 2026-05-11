const { MessageEmbed } = require("discord.js");
const User = require("../../../model/user.js");
const fs = require("fs");
const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());

module.exports = {
    commandInfo: {
        name: "unban",
        description: "Unban a user from the backend by their username.",
        options: [
            {
                name: "username",
                description: "Target username.",
                required: true,
                type: 3
            }
        ]
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        if (!config.moderators.includes(interaction.user.id)) {
            return interaction.editReply({ content: "You do not have moderator permissions.", ephemeral: true });
        }

        const { options } = interaction;
        const targetUser = await User.findOne({ username_lower: (options.get("username").value).toLowerCase() });

        if (!targetUser) return interaction.editReply({ content: "The account username you entered does not exist.", ephemeral: true });
        else if (!targetUser.banned) return interaction.editReply({ content: "This account is already unbanned.", ephemeral: true });

        await targetUser.updateOne({ $set: { banned: false, banExpires: null, banReason: null } });

        let dmStatus = "";
        if (targetUser.discordId) {
            try {
                const discordUser = await interaction.client.users.fetch(targetUser.discordId);
                const unbanEmbed = new MessageEmbed()
                    .setTitle("Account Unbanned")
                    .setDescription(`Your account **${targetUser.username}** has been unbanned from **Phase**.`)
                    .setColor("#56ff00")
                    .addField("Status", "You can now log back into the game.", false)
                    .setTimestamp()
                    .setFooter({
                        text: "Phase Backend Team",
                        iconURL: "https://cdn.discordapp.com/attachments/1464667023479930962/1491022027551805540/Obq4q2.jpg?ex=69dacb39&is=69d979b9&hm=4ce43a1db54f2860794a7a859b9e55a3f498f6d33938a1ac3dedc3e01e99bcb5"
                    });

                await discordUser.send({ embeds: [unbanEmbed] });
                dmStatus = " (User notified via DM)";
            } catch (err) {
                dmStatus = " (Could not DM user - DMs closed or user not found)";
            }
        } else {
            dmStatus = " (User has no linked Discord ID)";
        }

        interaction.editReply({ content: `Successfully unbanned **${targetUser.username}**.${dmStatus}`, ephemeral: true });
    }
}