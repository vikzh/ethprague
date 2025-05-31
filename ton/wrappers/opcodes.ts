import { crc32 } from 'node:zlib';

export const Op = {
    create_order: crc32('create_order'),
};
