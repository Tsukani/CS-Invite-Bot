import { ButtonInteraction, CacheType, GuildMember, PermissionsBitField, EmbedBuilder } from 'discord.js';
import { createLobby, startInviteLoop } from './botHandler';
import botList, { resetBotStatus } from './botList';
import { colorLog } from '../logHandler';
import { config } from '../environmentConfig';
import { updateAvailableBotCount } from '../discord/discordMain';

// Prepare for inviting
export const beginInviting = async (
    profiles: string[],
    message: string,
    time: number,
    rank: number,
    gamemode: string
): Promise<{
    success: boolean;
    error?: string;
    messageLength?: number;
    profilesProvided?: number;
    botUsername?: string;
    accounts?: {
        steamID: string;
        name: string;
        avatar: string;
    }[];
}> => {
    if (!profiles.length) return { success: false, error: 'INVALID_PROFILE' };
    if (profiles.length > 5) return { success: false, error: 'TOO_MANY_PROFILES', profilesProvided: profiles.length };
    if (message.length > 60) return { success: false, error: 'LONG_MESSAGE', messageLength: message.length };

    const accounts: { steamID: string; name: string; avatar: string }[] = [];

    // Resolves the profile IDs and URLs to steam64 IDs using the Steam Web API
    await Promise.all(
        profiles.map(async (id) => {
            let resolvedID;
            // Check if the ID is already a steam64 ID and removes any non-numeric characters
            if (id.replace(/\D/g, '').startsWith('765')) resolvedID = id.replace(/\D/g, '');
            // Check if the ID is a profile URL and extract the steam64 ID
            else if (id.includes('/profiles/')) resolvedID = id.split('/profiles/')[1].split('/')[0];
            else {
                let cleanID;

                // Check if the ID is a custom URL and extracts the vanity
                if (id.includes('/id/')) cleanID = id.split('/id/')[1].split('/')[0];
                else cleanID = id.replace(/\//g, '');

                await fetch(
                    `http://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${config.STEAM_API}&vanityurl=${cleanID}`
                ).then(async (res) => {
                    const data = await res.json();
                    if (data.response.success === 1) {
                        resolvedID = data.response.steamid;
                    }
                });
            }

            if (resolvedID) {
                // Get the profile's name and avatar
                await fetch(
                    `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${config.STEAM_API}&steamids=${resolvedID}`
                ).then(async (res) => {
                    const data = await res.json();
                    if (data.response.players.length) {
                        accounts.push({
                            steamID: data.response.players[0].steamid,
                            name: data.response.players[0].personaname,
                            avatar: data.response.players[0].avatarfull
                        });
                    }
                });
            }
        })
    );

    if (profiles.length !== accounts.length) return { success: false, error: 'INVALID_PROFILE' };

    // Pick a bot that is not active
    const selectedBot = Object.values(botList).find((data) => !data.active);
    if (selectedBot) {
        // Set the bot's properties
        selectedBot.accounts = accounts;
        selectedBot.message = message;
        selectedBot.rank = rank;
        selectedBot.gamemode = gamemode as 'competitive' | 'scrimcomp2v2' | 'survival';
        selectedBot.inviteTime = time;
        selectedBot.active = true;

        colorLog('yellow', 'Starting invite bot!', selectedBot.username);

        // Create lobby, start the invite loop and update the available bot count
        selectedBot.lobbyID = (await createLobby(selectedBot)).lobbyID;
        await startInviteLoop(selectedBot);
        await updateAvailableBotCount();

        return {
            success: true,
            botUsername: selectedBot.username,
            accounts: accounts
        };
    } else {
        colorLog('red', 'No bots available!');
        return { success: false, error: 'NO_BOTS' };
    }
};

// Stops inviting and update the embed
export const stopInviteLoop = (args: { username?: string; interaction?: ButtonInteraction<CacheType> }) => {
    const { username, interaction } = args;

    // If an interaction is provided (button click), validate the event was triggered by the original inviter
    if (interaction) {
        if (
            interaction.message.interaction?.user.id !== interaction.user.id &&
            // Allow admins to stop other people's invites
            !(interaction.member as GuildMember)?.permissions.has(PermissionsBitField.Flags.Administrator)
        ) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("You cannot stop somebody else's invite!")
                        .setColor('#ff0000')
                        .setTimestamp()
                ],
                ephemeral: true
            });
        }
    }

    // Find the bot connected to the invite session (either with the original embed ID [interaction] or provided bot username [automatic stop after time])
    const selectedBot = Object.values(botList).find(
        (data) => data.active && (data.originalEmbed?.id === interaction?.message.id || data.username === username)
    );

    if (!selectedBot)
        return colorLog('red', 'Tried to stop inviting without an active task!', interaction?.message.id || username);

    clearInterval(selectedBot?.interval);
    clearTimeout(selectedBot?.timeout);

    // Copy the original embed and modify it to show the invite session has finished
    const originalEmbed = interaction?.message.embeds[0] || selectedBot.originalEmbed?.embeds[0]!;
    const newEmbed = {
        embeds: [
            new EmbedBuilder()
                .setTitle(originalEmbed.title!.replace('Started', `${interaction ? ' (Forced) ' : ''}Finished`))
                .setURL(originalEmbed.url!)
                .addFields(
                    {
                        name: originalEmbed.fields[0].name,
                        value: originalEmbed.fields[0].value,
                        inline: true
                    },
                    {
                        name: originalEmbed.fields[1].name,
                        value: originalEmbed.fields[1].value,
                        inline: true
                    },
                    {
                        name: originalEmbed.fields[2].name,
                        value: originalEmbed.fields[2].value,
                        inline: true
                    },
                    {
                        name: originalEmbed.fields[3].name,
                        value: originalEmbed.fields[3].value,
                        inline: true
                    }
                )
                .setThumbnail(
                    originalEmbed.thumbnail?.url || 'https://pbs.twimg.com/tweet_video_thumb/E5x8syQUUA4zcjG.jpg'
                )
                .setColor('#9600fa')
                .setTimestamp()
        ],
        components: []
    };

    // Check if the event was triggered by a button click or automatically after the time had passed
    if (interaction) {
        colorLog('red', `Force stopped inviting!`, selectedBot.username);
        interaction.update(newEmbed);
    } else {
        colorLog(
            'green',
            `Finished inviting ${selectedBot.accounts.map((account) => account.name).join(', ')} after ${
                selectedBot.inviteTime
            } seconds!`,
            selectedBot.username
        );

        selectedBot.originalEmbed?.edit(newEmbed);
    }

    resetBotStatus(selectedBot);
};
