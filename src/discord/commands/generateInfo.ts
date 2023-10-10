import { EmbedBuilder, CommandInteraction, SlashCommandBuilder } from 'discord.js';

export const commandMeta = new SlashCommandBuilder()
    .setName('generate-info')
    .setDescription('[ADMIN] Generate information about the bot.');

export const execute = async (interaction: CommandInteraction) => {
    // Deferring and deleting the reply is a hack to hide the "NAME used /invite" text shown above the embed
    await interaction.deferReply();
    await interaction.deleteReply();
    await interaction.channel!.send({
        embeds: [
            new EmbedBuilder()
                .setTitle('How to use the bot')
                .setDescription(
                    'An invite session can be started using the `/invite` command. If a bot is available it will start inviting the specified profile.\nThe command takes the following arguments:'
                )
                .addFields(
                    {
                        name: 'profile (required)',
                        value: 'The profile to invite. This can be a Steam64, vanity ID or profile URL.'
                    },
                    {
                        name: ' ',
                        value: ' '
                    },
                    {
                        name: 'message (required)',
                        value: 'The message to include in the invites (max 60 characters).'
                    },
                    {
                        name: ' ',
                        value: ' '
                    },
                    {
                        name: 'time (optional)',
                        value: 'The time to invite for. Defaults to 5 minutes.'
                    },
                    {
                        name: ' ',
                        value: ' '
                    },
                    {
                        name: 'rank (optional)',
                        value: 'The rank shown in the invite. If the selected gamemode is __Premiere__ the rank will be shown as a CS Rating and goes between **1 - 99,999**.\nIf the selected gamemode is __Wingman__ the rank will show as the classic CS Skill Groups and goes between between **1 - 18**.\nDefaults to CS Rating 99,999 (Premiere) or The Global Elite (Wingman).'
                    },
                    {
                        name: ' ',
                        value: ' '
                    },
                    {
                        name: 'gamemode (optional)',
                        value: 'The gamemode of the rank. Defaults to Premiere.'
                    }
                )
                .setColor('#9600fa')
                .setThumbnail('https://pbs.twimg.com/tweet_video_thumb/E5x8syQUUA4zcjG.jpg')
        ]
    });
};
