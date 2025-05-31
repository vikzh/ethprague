import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, Cell, toNano } from '@ton/core';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { EscrowFactory } from '../wrappers/EscrowFactory';
import { createHash, randomBytes } from 'node:crypto';
import { Op } from '../wrappers/opcodes';
import { UserEscrow } from '../wrappers/UserEscrow';

describe('UserOrder', () => {
    let blockchain: Blockchain;

    let factoryCode: Cell;
    let orderCode: Cell;

    let deployer: SandboxContract<TreasuryContract>;
    let creator: SandboxContract<TreasuryContract>;
    let resolver: SandboxContract<TreasuryContract>;
    let factorySC: SandboxContract<EscrowFactory>;

    beforeAll(async () => {
        factoryCode = await compile('EscrowFactory');
        orderCode = await compile('UserEscrow');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        creator = await blockchain.treasury('creator');
        resolver = await blockchain.treasury('resolver');

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

    it('create a new order successful', async () => {
        const secret = BigInt('0x' + randomBytes(256).toString('hex'));
        const hashKey = BigInt('0x' + createHash('sha256').update(secret.toString()).digest('hex'));

        await createOrder({
            factorySC,
            creator,
            fromAmount: toNano(0.1),
            orderId: 456,
            toAddress: BigInt(123456789),
            toAmount: toNano(0.1),
            hashKey: hashKey,
        });

        const orderSC = blockchain.openContract(
            UserEscrow.createFromConfig(
                {
                    owner: creator.address,
                    admin: factorySC.address,
                    orderId: 456,
                },
                orderCode,
            ),
        );
        const orderData = await orderSC.getEscrowData();
        expect(orderData.orderId).toEqual(456);
        expect(orderData.fromAddress.toString()).toEqual(creator.address.toString());
        expect(orderData.fromAmount).toEqual(toNano(0.1));
        expect(orderData.toNetwork).toEqual(1);
        expect(orderData.toAddress).toEqual(123456789);
        expect(orderData.toAmount).toEqual(toNano(0.1));
        expect(orderData.hashKey).toEqual(hashKey);
        expect(orderData.resolverAddress).toEqual('');
    });

    it('claim order successful', async () => {
        const secret = BigInt('0x' + randomBytes(256).toString('hex'));
        const hashKey = BigInt('0x' + createHash('sha256').update(secret.toString()).digest('hex'));
        const orderAddress = await createOrder({
            factorySC,
            creator,
            fromAmount: toNano(0.1),
            orderId: 456,
            toAddress: BigInt(123456789),
            toAmount: toNano(0.1),
            hashKey: hashKey,
        });

        const msg = beginCell().storeUint(Op.claim_order, 32).storeUint(0, 64).endCell();
        const res = await sendMessage(resolver, orderAddress, toNano(0.05), msg);

        expect(res.transactions).toHaveTransaction({
            from: resolver.address,
            to: orderAddress,
            op: Op.claim_order,
            success: true,
        });

        const orderSC = blockchain.openContract(UserEscrow.createFromAddress(orderAddress));
        const orderData = await orderSC.getEscrowData();
        expect(orderData.orderId).toEqual(456);
        expect(orderData.resolverAddress.toString()).toEqual(resolver.address.toString());
    });
});

async function sendMessage(from: SandboxContract<TreasuryContract>, to: Address, value: bigint, body: Cell) {
    return await from.send({
        to,
        value,
        body,
        bounce: true,
    });
}

async function createOrder(cfg: {
    factorySC: SandboxContract<EscrowFactory>;
    creator: SandboxContract<TreasuryContract>;
    fromAmount: bigint;
    orderId: 456;
    toAddress: bigint;
    toAmount: bigint;
    hashKey: bigint;
}): Promise<Address> {
    const res = await cfg.factorySC.sendCreateOrder(cfg.creator.getSender(), {
        value: toNano(0.05),
        queryId: 123,
        orderId: cfg.orderId,
        fromAmount: cfg.fromAmount,
        toNetwork: 1,
        toAddress: cfg.toAddress,
        toAmount: cfg.toAmount,
        hashKey: cfg.hashKey,
    });

    const orderAddr = await cfg.factorySC.getOrderAddress(cfg.creator.address, BigInt(456));
    expect(res.transactions).toHaveTransaction({
        from: cfg.factorySC.address,
        to: orderAddr,
        op: Op.create_order,
        success: true,
    });
    return orderAddr;
}
