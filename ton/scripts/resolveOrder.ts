import { Address, beginCell, SendMode, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { EscrowFactory } from '../wrappers/EscrowFactory';
import { createHash, randomBytes } from 'node:crypto';
import { Op } from '../wrappers/opcodes';

const ESCROW_FACTORY = Address.parse('EQCrB1b7x5xWsm4AqbWbRZyfEuutYnOfunbGUdiogILGOcZm');

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();
    const orderAddress = await ui.input('Enter order address:');

    await provider.sender().send({
        to: Address.parse(orderAddress),
        value: toNano(0.05),
        body: beginCell().storeUint(Op.claim_order, 32).storeUint(0, 64).endCell(),
    });

    ui.write('Order resolve transaction was sent...');
}
