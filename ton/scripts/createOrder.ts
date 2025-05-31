import { Address, beginCell, Cell, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { EscrowFactory } from '../wrappers/EscrowFactory';
import { createHash, randomBytes } from 'node:crypto';
import { Op } from '../wrappers/opcodes';

const ESCROW_FACTORY = Address.parse('EQCrB1b7x5xWsm4AqbWbRZyfEuutYnOfunbGUdiogILGOcZm');

async function sendMessage(provider: NetworkProvider, to: Address, value: bigint, body: Cell) {
    await provider.sender().send({
        to,
        value,
        body,
        bounce: true,
    });
}

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const fromAmount = toNano(await ui.input('Enter from TON amount:'));
    const toAddress = await ui.input('Enter to address in Eth network:');
    const toAmount = await ui.input('Enter to amount:');

    const factorySC = provider.open(EscrowFactory.createFromAddress(ESCROW_FACTORY));

    const secret = BigInt('0x' + randomBytes(256).toString('hex'));
    const hashKey = BigInt('0x' + createHash('sha256').update(secret.toString()).digest('hex'));

    // Example of using sendMessage
    const messageBody = beginCell()
        .storeUint(Op.create_order, 32)
        .storeUint(123, 64)
        .storeUint(1, 32)
        .storeCoins(fromAmount)
        .storeUint(1, 8)
        .storeUint(BigInt(toAddress.replace('0x', '')), 256)
        .storeUint(BigInt(toAmount), 128)
        .storeUint(hashKey, 256)
        .endCell();

    await sendMessage(provider, ESCROW_FACTORY, toNano(0.05) + fromAmount, messageBody);

    ui.write('Order creation transaction was sent...');
}
