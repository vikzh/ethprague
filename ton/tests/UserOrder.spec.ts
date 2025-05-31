import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { EscrowFactory } from '../wrappers/EscrowFactory';
import { createHash, randomBytes } from 'node:crypto';

describe('UserOrder', () => {
    let blockchain: Blockchain;

    let factoryCode: Cell;
    let orderCode: Cell;

    let deployer: SandboxContract<TreasuryContract>;
    let creator: SandboxContract<TreasuryContract>;
    let factorySC: SandboxContract<EscrowFactory>;

    beforeAll(async () => {
        factoryCode = await compile('EscrowFactory');
        orderCode = await compile('UserEscrow');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        creator = await blockchain.treasury('creator');

        factorySC = blockchain.openContract(
            EscrowFactory.createFromConfig(
                {
                    admin: deployer.address,
                    userEscrowCode: orderCode,
                },
                factoryCode,
            ),
        );
    });

    it('create a new order', async () => {
        const secret = BigInt('0x' + randomBytes(256).toString('hex'));
        const hashKey = BigInt('0x' + createHash('sha256').update(secret.toString()).digest('hex'));

        const res = await factorySC.sendCreateOrder(creator.getSender(), {
            value: toNano(0.05),
            queryId: 123,
            orderId: 1,
            fromAmount: toNano(0.1),
            toNetwork: 1,
            toAddress: 123456789,
            toAmount: toNano(0.1),
            hashKey,
        });
    });
});
