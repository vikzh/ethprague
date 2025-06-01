import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, Cell, toNano } from '@ton/core';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { EscrowFactory } from '../wrappers/EscrowFactory';
import { Errors, Op } from '../wrappers/opcodes';
import { UserEscrow } from '../wrappers/UserEscrow';
import { ethAddressToBigInt, generateRandomBigInt } from '../wrappers/utils';
import { ethers } from 'ethers';

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
        const secret = generateRandomBigInt();
        const hashKey = ethers.keccak256(ethers.toBeHex(secret));

        await createOrder({
            factorySC,
            creator,
            fromAmount: toNano(0.1),
            orderId: 456,
            toToken: ethAddressToBigInt('0x1111111111111111111111111111111111111111'),
            toAddress: ethAddressToBigInt('0x2222222222222222222222222222222222222222'),
            toAmount: toNano(0.1),
            hashKey: BigInt(hashKey),
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
        expect(orderData.toToken).toEqual(ethAddressToBigInt('0x1111111111111111111111111111111111111111'));
        expect(orderData.toAddress).toEqual(ethAddressToBigInt('0x2222222222222222222222222222222222222222'));
        expect(orderData.toAmount).toEqual(toNano(0.1));
        expect(orderData.hashKey).toEqual(BigInt(hashKey));
        expect(orderData.resolverAddress).toEqual('');
    });

    it('claim order successful', async () => {
        const secret = generateRandomBigInt();
        const hashKey = ethers.keccak256(ethers.toBeHex(secret));
        const orderAddress = await createOrder({
            factorySC,
            creator,
            fromAmount: toNano(0.1),
            orderId: 456,
            toToken: ethAddressToBigInt('0x1cCf94c59f0Aaf8090921c587f04Ccb8620aE588'),
            toAddress: ethAddressToBigInt('0x1cCf94c59f0Aaf8090921c587f04Ccb8620aE588'),
            toAmount: toNano(0.1),
            hashKey: BigInt(hashKey),
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

    it('check keccak method validity', async () => {
        const secret = BigInt(1);
        // calculated keccak256 value for "1"
        const ethHash = '0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6';
        const hashKey = ethers.keccak256(ethers.zeroPadValue(ethers.toBeHex(secret), 32));

        expect(ethHash).toEqual(hashKey);

        await createOrder({
            factorySC,
            creator,
            fromAmount: toNano(0.1),
            orderId: 456,
            toToken: ethAddressToBigInt('0x1111111111111111111111111111111111111111'),
            toAddress: ethAddressToBigInt('0x2222222222222222222222222222222222222222'),
            toAmount: toNano(0.1),
            hashKey: BigInt(hashKey),
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

        const tonHash = await orderSC.getHash(secret);
        expect(tonHash).toEqual(BigInt(ethHash));
        expect(tonHash).toEqual(BigInt(hashKey));

        expect(await orderSC.getSecretValid(secret)).toEqual(-1);
    });

    it('withdraw order successful', async () => {
        // Create order
        const secret = generateRandomBigInt();
        const hashKey = ethers.keccak256(ethers.toBeHex(secret));
        const orderAddress = await createOrder({
            factorySC,
            creator,
            fromAmount: toNano(123),
            orderId: 456,
            toToken: ethAddressToBigInt('0x1cCf94c59f0Aaf8090921c587f04Ccb8620aE588'),
            toAddress: ethAddressToBigInt('0x1cCf94c59f0Aaf8090921c587f04Ccb8620aE588'),
            toAmount: toNano(345),
            hashKey: BigInt(hashKey),
        });

        // Claim order
        let msg = beginCell().storeUint(Op.claim_order, 32).storeUint(0, 64).endCell();
        await sendMessage(resolver, orderAddress, toNano(0.05), msg);

        const resolverTonBefore = (await blockchain.getContract(resolver.address)).balance;
        msg = beginCell().storeUint(Op.withdraw, 32).storeUint(0, 64).storeUint(secret, 256).endCell();
        const res = await sendMessage(resolver, orderAddress, toNano(0.05), msg);

        expect(res.transactions).toHaveTransaction({
            from: resolver.address,
            to: orderAddress,
            op: Op.withdraw,
            success: true,
        });

        const resolverTonAfter = (await blockchain.getContract(resolver.address)).balance;
        expect(resolverTonAfter).toBeGreaterThan(resolverTonBefore);
        // small portion of TON goes to network commissions
        expect(resolverTonAfter - resolverTonBefore).toBeGreaterThan(toNano(122.9));
    });

    it('withdraw order with wrong secret', async () => {
        // Create order
        const secret = generateRandomBigInt();
        const hashKey = ethers.keccak256(ethers.toBeHex(secret));
        const orderAddress = await createOrder({
            factorySC,
            creator,
            fromAmount: toNano(123),
            orderId: 456,
            toToken: ethAddressToBigInt('0x1cCf94c59f0Aaf8090921c587f04Ccb8620aE588'),
            toAddress: ethAddressToBigInt('0x1cCf94c59f0Aaf8090921c587f04Ccb8620aE588'),
            toAmount: toNano(345),
            hashKey: BigInt(hashKey),
        });

        // Claim order
        let msg = beginCell().storeUint(Op.claim_order, 32).storeUint(0, 64).endCell();
        await sendMessage(resolver, orderAddress, toNano(0.05), msg);

        const resolverTonBefore = (await blockchain.getContract(resolver.address)).balance;
        // provide another secret (the chance of correctness is super small)
        const wrongSecret = generateRandomBigInt();
        msg = beginCell().storeUint(Op.withdraw, 32).storeUint(0, 64).storeUint(wrongSecret, 256).endCell();
        const res = await sendMessage(resolver, orderAddress, toNano(0.05), msg);

        expect(res.transactions).toHaveTransaction({
            from: resolver.address,
            to: orderAddress,
            op: Op.withdraw,
            success: false,
            exitCode: Errors.wrong_secret,
        });

        const resolverTonAfter = (await blockchain.getContract(resolver.address)).balance;
        expect(resolverTonAfter).toBeLessThanOrEqual(resolverTonBefore);
    });

    it('withdraw order by wrong resolver', async () => {
        const wrongResolver = await blockchain.treasury('wrongResolver');
        // Create order
        const secret = generateRandomBigInt();
        const hashKey = ethers.keccak256(ethers.toBeHex(secret));
        const orderAddress = await createOrder({
            factorySC,
            creator,
            fromAmount: toNano(123),
            orderId: 456,
            toToken: ethAddressToBigInt('0x1cCf94c59f0Aaf8090921c587f04Ccb8620aE588'),
            toAddress: ethAddressToBigInt('0x1cCf94c59f0Aaf8090921c587f04Ccb8620aE588'),
            toAmount: toNano(345),
            hashKey: BigInt(hashKey),
        });

        // Claim order
        let msg = beginCell().storeUint(Op.claim_order, 32).storeUint(0, 64).endCell();
        await sendMessage(resolver, orderAddress, toNano(0.05), msg);

        const resolverTonBefore = (await blockchain.getContract(resolver.address)).balance;
        msg = beginCell().storeUint(Op.withdraw, 32).storeUint(0, 64).storeUint(secret, 256).endCell();
        const res = await sendMessage(wrongResolver, orderAddress, toNano(0.05), msg);

        // wrong resolver can not get TON even with valid secret
        expect(res.transactions).toHaveTransaction({
            from: wrongResolver.address,
            to: orderAddress,
            op: Op.withdraw,
            success: false,
            exitCode: Errors.forbidden,
        });

        const resolverTonAfter = (await blockchain.getContract(resolver.address)).balance;
        expect(resolverTonAfter).toBeLessThanOrEqual(resolverTonBefore);
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
    toToken: bigint;
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
        toToken: cfg.toToken,
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
