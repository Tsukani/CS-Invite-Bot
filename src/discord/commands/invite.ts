import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    SlashCommandBuilder,
    CommandInteraction
} from 'discord.js';
import { timeTranslations, rankTranslations, gamemodeTranslations, getCSRatingIcon } from '../translationList';
import { addEmbedToRecord } from '../../steam/botList';
import { beginInviting } from '../../steam/inviteWrapper';

export const commandMeta = new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Start an invite session')
    .addStringOption((option) => {
        return option
            .setName('profile')
            .setDescription('The profile to invite. This can be a Steam64, vanity ID or profile URL.')
            .setRequired(true);
    })
    .addStringOption((option) => {
        return option
            .setName('message')
            .setDescription('The message to include in the invites (max 60 characters).')
            .setRequired(true);
    })
    .addIntegerOption((option) => {
        return option
            .setName('rank')
            .setDescription(
                'The rank to desplay in the invite. Defaults to 99,999 in Premiere and Global Elite in Wingman.'
            );
    })
    .addIntegerOption((option) => {
        return option
            .setName('time')
            .setDescription('The time to invite for. Defaults to 5 minutes.')
            .setRequired(false)
            .addChoices(
                {
                    name: '5 seconds',
                    value: 5
                },
                {
                    name: '30 seconds',
                    value: 30
                },
                {
                    name: '1 minute',
                    value: 60
                },
                {
                    name: '5 minutes',
                    value: 300
                },
                {
                    name: '10 minutes',
                    value: 600
                }
            );
    })
    .addStringOption((option) => {
        return option
            .setName('gamemode')
            .setDescription('The gamemode of the rank. Defaults to Premiere.')
            .setRequired(false)
            .addChoices(
                {
                    name: 'Premiere (CS Rating)',
                    value: 'competitive'
                },
                {
                    name: 'Wingman (Old ranks)',
                    value: 'scrimcomp2v2'
                }
            );
    });

export const execute = async (interaction: CommandInteraction) => {
    // Get arguments provided from command
    const profiles = (interaction.options.get('profile')!.value as string).split(' ');
    const message = interaction.options.get('message')!.value as string;
    const time = (interaction.options.get('time')?.value as 5 | 30 | 60 | 300 | 600) ?? 300;
    const gamemode = (interaction.options.get('gamemode')?.value as 'competitive' | 'scrimcomp2v2') ?? 'competitive';
    let rank = (interaction.options.get('rank')?.value as number) ?? 99999;

    // Clamp values depending on gamemode
    if (gamemode === 'scrimcomp2v2' && rank > 18) rank = 18;
    if (rank < 1) rank = 1;
    if (rank > 99999) rank = 99999;

    if (profiles && message && time && rank && gamemode) {
        // Initializes a new invite session
        const inviteResult = await beginInviting(profiles, message, time, rank, gamemode);

        if (inviteResult.success) {
            // If the invite session was successfully started
            const embed = new EmbedBuilder()
                .setTitle(`Started inviting ${inviteResult.accounts?.map((account) => account.name).join(', ')}`)
                .addFields(
                    {
                        name: 'Message',
                        value: message,
                        inline: true
                    },
                    {
                        name: 'Time',
                        value: timeTranslations[time] || time.toString() + ' seconds',
                        inline: true
                    },
                    {
                        name: 'Rank',
                        value:
                            gamemode === 'scrimcomp2v2'
                                ? rankTranslations[rank] || rank.toString()
                                : `${getCSRatingIcon(rank)} ${rank
                                      .toString()
                                      .replace(/\B(?=(\d{3})+(?!\d))/g, ',')} CS Rating`,
                        inline: true
                    },
                    {
                        name: 'Gamemode',
                        value: gamemodeTranslations[gamemode] || gamemode,
                        inline: true
                    }
                )
                .setThumbnail(
                    inviteResult.accounts?.length === 1
                        ? inviteResult.accounts[0].avatar
                        : 'https://pbs.twimg.com/tweet_video_thumb/E5x8syQUUA4zcjG.jpg'
                )
                .setColor('#00ff00')
                .setTimestamp();

            if (inviteResult.accounts?.length === 1)
                embed.setURL(`https://steamcommunity.com/profiles/${inviteResult.accounts[0].steamID}`);

            const replyMessage = await interaction.reply({
                embeds: [embed],

                components: [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder().setCustomId(`stop`).setLabel('Stop inviting').setStyle(ButtonStyle.Danger)
                    )
                ],
                fetchReply: true
            });
            if (inviteResult.botUsername) addEmbedToRecord(replyMessage, inviteResult.botUsername!);
        } else {
            // If the invite session failed to start
            switch (inviteResult.error) {
                case 'NO_BOTS':
                    await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(`No bots available!`)
                                .setDescription('There are currently no bots available, please try again later.')
                                .setColor('#ff0000')
                                .setTimestamp()
                        ]
                    });
                    break;
                case 'INVALID_PROFILE':
                    await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(`Invalid profile!`)
                                .setDescription(
                                    'No profile was found with that ID. Command supports Steam64, vanity IDs and profile URLs.'
                                )
                                .setColor('#ff0000')
                                .setTimestamp()
                        ]
                    });
                    break;

                case 'LONG_MESSAGE':
                    await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(`Message too long!`)
                                .setDescription(
                                    `The max message length is 60 characters, your message was ${inviteResult.messageLength} characters long.`
                                )
                                .setColor('#ff0000')
                                .setTimestamp()
                        ]
                    });
                    break;

                case 'TOO_MANY_PROFILES':
                    await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(`Too many profiles!`)
                                .setDescription(
                                    `The max amount of supported profiles is 5, you have entered ${inviteResult.profilesProvided}.`
                                )
                                .setColor('#ff0000')
                                .setTimestamp()
                        ]
                    });
                    break;
            }
        }
    } else {
        // Extra fail-safe in case the command has somehow been called with invalid arguments
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle(`Invalid arguments provided!`)
                    .setDescription('Please ensure the arguments are valid.')
                    .setColor('#ff0000')
                    .setTimestamp()
            ]
        });
    }
};
