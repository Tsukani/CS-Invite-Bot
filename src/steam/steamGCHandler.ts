import SteamUser from 'steam-user';
import ProtobufJS from 'protobufjs';

export const sendToSteamGC = async (
    client: SteamUser,
    reciever: number,
    header: object,
    encoder: ProtobufJS.Type,
    message: object,
    listener?: number,
    listenerResolver?: ProtobufJS.Type
) => {
    return new Promise((resolve) => {
        // Needs to be extended due to undocumented methods being used
        const extendedClient = client as SteamUser & {
            _send: (header: object, body: Uint8Array) => void;
            _handlerManager: {
                add: (listener: number, callback: (body: ByteBuffer) => void) => void;
                _handlers: {
                    [key: number]: (body: ByteBuffer) => void;
                };
            };
        };

        extendedClient._send(
            {
                msg: reciever,
                proto: header
            },
            encoder.encode(message).finish()
        );

        if (listener && listenerResolver) {
            extendedClient._handlerManager.add(listener, (body: ByteBuffer) => {
                delete extendedClient._handlerManager._handlers[listener];

                const resolveBody = listenerResolver.toObject(listenerResolver.decode(body.toBuffer()));
                resolve(resolveBody);
            });
        }
    });
};
