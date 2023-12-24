import { colorLog } from '../logHandler';
import { config } from '../environmentConfig';

import { ActivityType, Client } from 'discord.js';
import { commands } from './commands';
import { buttons } from './buttons';

import { getBotStats } from '../steam/botList';
import { deployCommands } from './deployCommands';

const client = new Client({ intents: ['Guilds'] });

client.on('ready', async () => {
    colorLog('yellow', `Successfully logged in as ${client.user?.tag}!`, 'Discord');

    // Deploying commands in the development guild
    await deployCommands({ guildId: config.DEVELOPMENT_GUILD_ID! });
});

client.on('guildCreate', async (guild) => {
    // Automatically deploy commands to newly joined guilds
    await deployCommands({ guildId: guild.id });
});

client.on('interactionCreate', async (interaction) => {
    // Executes the "execute" method of commands and buttons once triggered
    if (interaction.isCommand()) {
        Object.values(commands)
            .find((command) => command.commandMeta.name === interaction.commandName)
            ?.execute(interaction);
    }
    if (interaction.isButton()) {
        Object.values(buttons)
            .find((button) => button.interactionMeta.name === interaction.customId)
            ?.execute(interaction);
    }
});

// Updates the bot's status to show the amount of available bots
export const updateAvailableBotCount = async () => {
    const botStats = getBotStats();
    client.user?.setPresence({
        activities: [
            {
                name: `[${botStats.available}/${botStats.total}] CS2 Inviting`,
                type: ActivityType.Competing
            }
        ],
        status: 'online'
    });
};

client.login(config.DISCORD_TOKEN);
