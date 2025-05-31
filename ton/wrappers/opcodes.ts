import { crc32 } from 'node:zlib';

export const Op = {
    create_order: crc32('create_order'),
    claim_order: crc32('claim_order'),
    withdraw: crc32('withdraw'),
};
