const { MessageEmbed } = require("discord.js");
const functions = require("../../../structs/functions.js");
const User = require("../../../model/user.js");
const log = require("../../../structs/log.js");

module.exports = {
    commandInfo: {
        name: "createhostaccount",
        description: "Creates a host account for Phase."
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        const serverOwnerId = interaction.guild.ownerId;

        if (interaction.user.id !== serverOwnerId) {
            return interaction.editReply({
                content: "Only the server owner can execute this command.",
                ephemeral: true
            });
        }

        const existingHostAccount = await User.findOne({ email: "hostaccount@reloadbackend.com" });

        if (existingHostAccount) {
            return interaction.editReply({
                content: "A host account has already been created.",
                ephemeral: true
            });
        }

        const username = "reloadbackendhostaccount";
        const email = "hostaccount@reloadbackend.com";
        const password = generateRandomPassword(12);

        try {
            await functions.registerUser(null, username, email, password).then(async (resp) => {
                let embed = new MessageEmbed()
                    .setColor(resp.status >= 400 ? "#ff0000" : "#56ff00")
                    .addFields(
                        { name: "Message", value: resp.message },
                        { name: "Username", value: `\`\`\`${username}\`\`\`` },
                        { name: "Email", value: `\`\`\`${email}\`\`\`` },
                        { name: "Password", value: `\`\`\`${password}\`\`\`` },
                    )
                    .setTimestamp()
                    .setFooter({
                        text: "Phase Backend",
                        iconURL: "https://cdn.discordapp.com/attachments/1464667023479930962/1491022027551805540/Obq4q2.jpg?ex=69dacb39&is=69d979b9&hm=4ce43a1db54f2860794a7a859b9e55a3f498f6d33938a1ac3dedc3e01e99bcb5"
                    });

                if (resp.status >= 400) {
                    return interaction.editReply({ embeds: [embed], ephemeral: true });
                }

                await interaction.editReply({
                    embeds: [embed],
                    ephemeral: true
                });
            });
        } catch (error) {
            log.error(error);
            return interaction.editReply({
                content: "An error occurred while creating the host account.",
                ephemeral: true
            });
        }
    }
};

function generateRandomPassword(length) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+<>?";
    let password = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    return password;
}