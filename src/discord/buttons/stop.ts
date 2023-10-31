import { ButtonInteraction } from 'discord.js';
import { stopInviteLoop } from '../../steam/inviteWrapper';

export const interactionMeta = {
    name: 'stop'
};

export const execute = async (interaction: ButtonInteraction) => {
    await stopInviteLoop({ interaction });
};
