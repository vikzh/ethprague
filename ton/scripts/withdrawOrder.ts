import { Address, beginCell, SendMode, toNano } from '@ton/core';
import { NetworkProvider, sleep } from '@ton/blueprint';
import { Op } from '../wrappers/opcodes';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();
    const orderAddress = await ui.input('Enter order address:');
    const secret = BigInt(await ui.input('Enter secret:'));

    await provider.sender().send({
        to: Address.parse(orderAddress),
        value: toNano(0.05),
        body: beginCell().storeUint(Op.withdraw, 32).storeUint(0, 64).storeUint(secret, 256).endCell(),
    });

    ui.write('Withdraw transaction was sent...');
}
