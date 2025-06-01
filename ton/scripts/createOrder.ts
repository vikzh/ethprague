import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { EscrowFactory } from '../wrappers/EscrowFactory';
import { createHash, randomBytes } from 'node:crypto';
import { ethAddressToBigInt } from '../wrappers/utils';
import { keccak256 } from 'js-sha3';

const ESCROW_FACTORY = Address.parse('EQCrB1b7x5xWsm4AqbWbRZyfEuutYnOfunbGUdiogILGOcZm');

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const fromAmount = toNano(await ui.input('Enter from TON amount:'));
    const toToken = await ui.input('Enter to token address in Eth network:');
    const toAddress = await ui.input('Enter to address in Eth network:');
    const toAmount = await ui.input('Enter to amount:');

    const factorySC = provider.open(EscrowFactory.createFromAddress(ESCROW_FACTORY));

    const secret = randomBytes(256).toString('hex');
    const hashKey = BigInt('0x' + keccak256(secret));

    await factorySC.sendCreateOrder(provider.sender(), {
        value: toNano(0.05),
        queryId: 123,
        orderId: 1,
        fromAmount: fromAmount,
        toNetwork: 1,
        toToken: ethAddressToBigInt(toToken),
        toAddress: ethAddressToBigInt(toAddress),
        toAmount: BigInt(toAmount),
        hashKey,
    });

    ui.write('Order creation transaction was sent...');
}
