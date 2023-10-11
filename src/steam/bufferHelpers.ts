import ByteBuffer from 'bytebuffer';
import SteamID from 'steamid';

const Type = {
    None: 0,
    String: 1,
    Int32: 2,
    Float32: 3,
    Pointer: 4,
    WideString: 5,
    Color: 6,
    UInt64: 7,
    End: 8
};

// Encodes an object into a ByteBuffer
export const encode = (
    _object: Record<string, unknown>,
    prefix: number[] = [0x00, 0x00],
    suffix: number[] = [],
    customEncodeFields: any = {}
) => {
    // Create a copy of the input object to avoid modifying it
    const object = { ..._object };
    const buffer = new ByteBuffer();

    // Write the prefix bytes to the buffer
    for (let pre of prefix) {
        buffer.writeByte(pre);
    }

    // Iterate through the object's properties and encode them
    for (let item in object) {
        if (object.hasOwnProperty(item) === false) {
            continue;
        }

        // If a custom encoder function exists for the property, use it
        if (typeof customEncodeFields[item] === 'function') {
            object[item] = customEncodeFields[item](object[item]);
        }
        _encode(object[item], buffer, item);
    }

    // Write the suffix bytes to the buffer
    for (let suf of suffix) {
        buffer.writeByte(suf);
    }

    // Write an End marker to the buffer
    buffer.writeByte(Type.End);
    buffer.flip(); // Prepare the buffer for reading
    return buffer;
};

// Encodes individual properties into the ByteBuffer
const _encode = (object: any, buffer: ByteBuffer, name: string) => {
    if (object instanceof Buffer) {
        // If the object is a Buffer
        buffer.writeByte(Type.String);
        buffer.writeCString(name);

        // Convert the Buffer to a hexadecimal string, split into 2-character parts, and write each part as a byte
        let parts = object
            .toString('hex')
            .toUpperCase()
            .match(/.{1,2}/g)!;

        for (let part of parts) {
            buffer.writeByte(parseInt('0x' + part));
        }
    } else {
        // If the object is not a Buffer, check its type
        switch (typeof object) {
            case 'object': {
                buffer.writeByte(Type.None);
                buffer.writeCString(name);

                for (let index in object) {
                    _encode(object[index], buffer, index); // Recursively encode each property
                }

                buffer.writeByte(Type.End);
                break;
            }
            case 'string': {
                buffer.writeByte(Type.String);
                buffer.writeCString(name);
                buffer.writeCString(object ? object : '');
                break;
            }
            case 'number': {
                buffer.writeByte(Type.String);
                buffer.writeCString(name);
                buffer.writeCString(object.toString());
                break;
            }
        }
    }
};

// Encode SteamIDs into a Buffer
export const encodeUids = (steamids: SteamID[]) => {
    const outputBuffer = [];

    for (let id of steamids.map((s) => s.accountid)) {
        while (id > 0x7f) {
            outputBuffer.push((id | 0x80) & 0xff);
            id >>= 7;
        }
        outputBuffer.push(id);
    }
    outputBuffer.push(0x00); // Null terminator
    return Buffer.from(outputBuffer);
};
