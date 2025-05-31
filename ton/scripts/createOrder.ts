import { Address, beginCell, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { EscrowFactory } from '../wrappers/EscrowFactory';
import { createHash, randomBytes } from 'node:crypto';

const ESCROW_FACTORY = Address.parse('EQCOQAg-0KwOJVjysGI24K-GSLDpABqsAnYDxiFfEJhsLV98');

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();
    const factorySC = provider.open(EscrowFactory.createFromAddress(ESCROW_FACTORY));

    const secret = BigInt('0x' + randomBytes(256).toString('hex'));
    const hashKey = BigInt('0x' + createHash('sha256').update(secret.toString()).digest('hex'));

    await factorySC.sendCreateOrder(provider.sender(), {
        value: toNano(0.05),
        queryId: 123,
        orderId: 1,
        fromAmount: toNano(0.1),
        toNetwork: 1,
        toAddress: 123456789,
        toAmount: toNano(0.1),
        hashKey,
    });

    ui.write('Order creation transaction was sent...');
}
