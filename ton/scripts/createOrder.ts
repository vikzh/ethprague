import { Address, toNano } from '@ton/core';
import { NetworkProvider, sleep } from '@ton/blueprint';
import { EscrowFactory } from '../wrappers/EscrowFactory';
import { createHash, randomBytes } from 'node:crypto';
import { ethAddressToBigInt, generateRandomBigInt } from '../wrappers/utils';
import { keccak256 } from 'js-sha3';
import { ethers } from 'ethers';

const ESCROW_FACTORY = Address.parse('EQAU6TikP2x2EX35n1o1EV7TRRYBlUzUCwPmpz7wAt8NI8ei');
const USDT_ADDRESS = '0x58b9147c2411F97841b0b53c42777De5502D54c8';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const orderId = Number(await ui.input('Enter order id:'));
    const fromAmount = toNano(await ui.input('Enter from TON amount:'));
    // const toToken = await ui.input('Enter to token address in Eth network:');
    const toToken = USDT_ADDRESS;
    const toAddress = await ui.input('Enter to address in Eth network:');
    const toAmount = await ui.input('Enter to amount:');

    const factorySC = provider.open(EscrowFactory.createFromAddress(ESCROW_FACTORY));

    const secret = generateRandomBigInt();
    ui.write(`User secret: ${secret}`);
    const hashKey = ethers.keccak256(ethers.toBeHex(secret));
    ui.write(`Hash key: ${hashKey}`);

    await factorySC.sendCreateOrder(provider.sender(), {
        value: toNano(0.05),
        queryId: 123,
        orderId: orderId,
        fromAmount: fromAmount,
        toNetwork: 1,
        toToken: ethAddressToBigInt(toToken),
        toAddress: ethAddressToBigInt(toAddress),
        toAmount: BigInt(toAmount),
        hashKey: BigInt(hashKey),
    });

    ui.write('Order creation transaction was sent...');

    await sleep(30000);

    try {
        const result = await addOrder(provider.sender().address!!.toString(), orderId);
        console.log('Order added:', result);
    } catch (error) {
        console.error('Error adding order:', error);
    }
}

async function addOrder(userAddress: string, orderId: number) {
    const response = await fetch('https://ethprague-backend-cyrpf.ondigitalocean.app/add-order', {
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
