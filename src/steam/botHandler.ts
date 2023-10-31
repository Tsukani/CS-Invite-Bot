import SteamUser from 'steam-user';
import SteamTotp from 'steam-totp';
import ProtobufJS from 'protobufjs';
import { colorLog } from '../logHandler';
import { encode, encodeUids } from './bufferHelpers';
import { sendToSteamGC } from './steamGCHandler';
import { BotRecord } from 'types/BotRecord';
import botList from './botList';
import { stopInviteLoop } from './inviteWrapper';

// Initialize needed protobufs to communicate with Steam and the CS Game Coordinator
const protos = new ProtobufJS.Root().loadSync(
    [
        './protobufs/steam/steammessages_base.proto',
        './protobufs/csgo/gcsdk_gcmessages.proto',
        './protobufs/csgo/gcsystemmsgs.proto',
        './protobufs/csgo/cstrike15_gcmessages.proto',

        './protobufs/steam/enums_clientserver.proto',
        './protobufs/steam/steammessages_clientserver_mms.proto'
    ],
    {
        keepCase: true
    }
);

// Signs into Steam and adds the bot to the botList
export const startBot = async (username: string, password: string, sharedSecret?: string) => {
    return new Promise<BotRecord>((resolve, reject) => {
        const client = new SteamUser();

        client.logOn({
            accountName: username,
            password: password,
            twoFactorCode: SteamTotp.generateAuthCode(sharedSecret || '')
        });

        client.on('loggedOn', async () => {
            if (client.steamID) {
                colorLog('magenta', 'Signed in...', username);
                botList[username] = {
                    botClient: client,
                    active: false,

                    username: username,
                    lobbyID: '',
                    rank: -1,
                    gamemode: 'competitive',
                    message: '',
                    inviteTime: -1,

                    interval: undefined,
                    timeout: undefined,

                    accounts: [],

                    originalEmbed: undefined
                };

                // Changes name to an invisible character, making it impossible to look up the bot account without dumping packets
                client.setPersona(SteamUser.EPersonaState.Invisible, '󠀡󠀡');
                colorLog('yellow', 'Changed name!', username);

                client.gamesPlayed(730);

                const gcResponse = await connectToGC(botList[username]);
                if (gcResponse.success) {
                    colorLog('green', 'Bot ready!', username);
                    resolve(botList[username]);
                } else {
                    reject('Failed to connect to GC!');
                }
            } else {
                reject('Could not get steamID!');
            }
        });
    });
};

// Connects to the CS Game Coordinator, imitating the game client
const connectToGC = async (bot: BotRecord) => {
    return new Promise<{ success: boolean; version: number; error?: string }>((resolve, reject) => {
        // Timeout to prevent the bot from getting stuck in the GC connection, retries after 5 seconds
        const timeout = setTimeout(async () => {
            colorLog('red', 'GC Timeout, retrying...', bot.username);
            resolve(await connectToGC(bot));
        }, 5000);

        const EGCBaseClientMsg = protos.lookupEnum('EGCBaseClientMsg');
        const CMsgClientHello = protos.lookupType('CMsgClientHello');

        // Requests connection to the CS Game Coordinator
        bot.botClient.sendToGC(
            730,
            EGCBaseClientMsg.values.k_EMsgGCClientHello,
            {},
            Buffer.from(CMsgClientHello.encode({}).finish())
        );

        // Listens for the response from the CS Game Coordinator and validates connection
        bot.botClient.once('receivedFromGC', (appid, type, message) => {
            if (appid === 730 && type === EGCBaseClientMsg.values.k_EMsgGCClientWelcome) {
                const CMsgClientWelcome = protos.lookupType('CMsgClientWelcome');
                const clientWelcomeMessage = CMsgClientWelcome.toObject(CMsgClientWelcome.decode(message));

                const CMsgGCCStrike15_v2_MatchmakingGC2ClientHello = protos.lookupType(
                    'CMsgGCCStrike15_v2_MatchmakingGC2ClientHello'
                );

                const matchmakingClientHelloMessage = CMsgGCCStrike15_v2_MatchmakingGC2ClientHello.toObject(
                    CMsgGCCStrike15_v2_MatchmakingGC2ClientHello.decode(clientWelcomeMessage.game_data2)
                );

                if (matchmakingClientHelloMessage.global_stats.required_appid_version) {
                    colorLog(
                        'blue',
                        `Connected to GC and got appid_version: ${matchmakingClientHelloMessage.global_stats.required_appid_version}!`,
                        bot.username
                    );

                    resolve({
                        success: true,
                        version: matchmakingClientHelloMessage.global_stats.required_appid_version
                    });

                    clearTimeout(timeout);
                } else {
                    reject({
                        success: false,
                        version: -1,
                        error: 'Could not get required_appid_version'
                    });
                }
            }
        });
    });
};

// Creates a Steam lobby
export const createLobby = async (bot: BotRecord) => {
    return new Promise<{ success: boolean; lobbyID: string; error?: string }>((resolve, reject) => {
        colorLog('magenta', 'Creating lobby...', bot.username);

        const EMsg = protos.lookupEnum('EMsg');
        const CMsgClientMMSCreateLobby = protos.lookupType('CMsgClientMMSCreateLobby');
        const CMsgClientMMSCreateLobbyResponse = protos.lookupType('CMsgClientMMSCreateLobbyResponse');

        sendToSteamGC(
            bot.botClient,
            EMsg.values.k_EMsgClientMMSCreateLobby,
            {
                steamid: bot.botClient.steamID,
                routing_appid: 730
            },
            CMsgClientMMSCreateLobby,
            {
                app_id: 730,
                max_members: 1,
                lobby_type: 1,
                lobby_flags: 1
            },
            EMsg.values.k_EMsgClientMMSCreateLobbyResponse,
            CMsgClientMMSCreateLobbyResponse
        ).then(async (lobbyResponseMessage) => {
            // Retrieves the lobbyID from the response
            const data = lobbyResponseMessage as { app_id: number; steam_id_lobby: Long; eresult: number };
            if (data.steam_id_lobby) {
                colorLog('blue', `Got Lobby ID ${data.steam_id_lobby.toString()}!`, bot.username);
                await updateLobby(bot, data.steam_id_lobby.toString());

                resolve({
                    success: true,
                    lobbyID: data.steam_id_lobby.toString()
                });
            } else {
                reject({
                    success: false,
                    lobbyID: '',
                    error: 'Failed to create lobby - could not get lobbyID'
                });
            }
        });
    });
};

// Updates information about the lobby, including spoofed rank and country
const updateLobby = async (bot: BotRecord, lobbyID: string) => {
    return new Promise<{ success: boolean; message: string; error?: string }>((resolve, reject) => {
        const EMsg = protos.lookupEnum('EMsg');
        const CMsgClientMMSSetLobbyData = protos.lookupType('CMsgClientMMSSetLobbyData');
        const CMsgClientMMSSetLobbyDataResponse = protos.lookupType('CMsgClientMMSSetLobbyDataResponse');

        // Formats the message to fit 60 characters, making the message centered and fill up the entire screen
        let messageFormatted = '\n' + bot.message!.split('').join('\n') + '\n';
        messageFormatted =
            '\n'.repeat(Math.ceil(60 - bot.message!.length) / 2) +
            messageFormatted +
            '\n'.repeat(Math.ceil(60 - bot.message!.length) / 2);

        const lobbySettings = {
            // Skill group
            'game:ark': bot.rank + '0',
            // Country/Message
            'game:loc': messageFormatted,

            'game:mapgroupname': '',
            'game:mode': bot.gamemode,
            'game:prime': '1',
            'game:type': 'classic',
            'members:numPlayers': '1',
            'options:action': 'custommatch',
            'options:anytypemode': '0',
            'system:access': 'private',
            'system:network': 'LIVE',
            uids: [bot.botClient.steamID]
        };

        colorLog('magenta', 'Updating lobby...', bot.username);

        sendToSteamGC(
            bot.botClient,
            EMsg.values.k_EMsgClientMMSSetLobbyData,
            {
                steamid: bot.botClient.steamID,
                routing_appid: 730
            },
            CMsgClientMMSSetLobbyData,
            {
                app_id: 730,
                steam_id_lobby: lobbyID,
                steam_id_member: '0',
                max_members: 10,
                lobby_type: 1,
                lobby_flags: 1,
                metadata: encode(lobbySettings, [0x00, 0x00], [0x08], { uids: encodeUids }).toBuffer()
            },
            EMsg.values.k_EMsgClientMMSSetLobbyDataResponse,
            CMsgClientMMSSetLobbyDataResponse
        ).then(async (lobbyDataResponseMessage) => {
            // Validates that the lobby was updated
            const data = lobbyDataResponseMessage as { app_id: number; steam_id_lobby: Long; eresult: number };
            if (data.eresult === 1) {
                colorLog('blue', `Updated lobby (${data.steam_id_lobby}) with message "${bot.message}"!`, bot.username);
                resolve({
                    success: true,
                    message: bot.message || 'Error loading message!'
                });
            } else {
                reject({
                    success: false,
                    message: '',
                    error: 'Failed to update lobby'
                });
            }
        });
    });
};

// Invites a steamID to the lobby
export const inviteToLobby = (bot: BotRecord, steamID: string) => {
    let EMsg = protos.lookupEnum('EMsg');
    let CMsgClientMMSInviteToLobby = protos.lookupType('CMsgClientMMSInviteToLobby');

    sendToSteamGC(
        bot.botClient,
        EMsg.values.k_EMsgClientMMSInviteToLobby,
        {
            steamid: bot.botClient.steamID,
            routing_appid: 730
        },
        CMsgClientMMSInviteToLobby,
        {
            app_id: 730,
            steam_id_lobby: bot.lobbyID,
            steam_id_user_invited: steamID
        }
    );
};

// Handles loop logic to repeat/spam invitations
export const startInviteLoop = async (bot: BotRecord) => {
    colorLog(
        'green',
        `Started inviting ${bot.accounts.map((account) => account.name)} for ${bot.inviteTime} seconds!`,
        bot.username
    );

    let interval;

    if (bot.accounts.length > 1) {
        // More than one steamID provided (loop through them)
        let index = 0;
        interval = setInterval(() => {
            inviteToLobby(bot, bot.accounts[index].steamID);
            index >= bot.accounts.length - 1 ? (index = 0) : index++;
        }, 50);
    } else {
        // Only one steamID provided
        interval = setInterval(() => {
            inviteToLobby(bot, bot.accounts[0].steamID);
        }, 250);
    }

    // Stops inviting after the specified time
    const timeout = setTimeout(() => {
        stopInviteLoop({ username: bot.username });
    }, bot.inviteTime * 1000);

    bot.interval = interval;
    bot.timeout = timeout;
};
