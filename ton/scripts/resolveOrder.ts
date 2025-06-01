import { Address, beginCell, SendMode, toNano } from '@ton/core';
import { NetworkProvider, sleep } from '@ton/blueprint';
import { Op } from '../wrappers/opcodes';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();
    const orderId = Number(await ui.input('Enter order id:'));
    const orderAddress = await ui.input('Enter order address:');

    await provider.sender().send({
        to: Address.parse(orderAddress),
        value: toNano(0.05),
        body: beginCell().storeUint(Op.claim_order, 32).storeUint(0, 64).endCell(),
    });

    ui.write('Order resolve transaction was sent...');

    await sleep(30000);

    try {
        const result = await addOrder(provider.sender().address!!.toString(), orderId);
        console.log('Order added:', result);
    } catch (error) {
        console.error('Error adding order:', error);
    }
}

async function addOrder(userAddress: string, orderId: number) {
    const response = await fetch('https://ethprague-backend-cyrpf.ondigitalocean.app/update-order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            userAddress,
            orderId,
        }),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}
