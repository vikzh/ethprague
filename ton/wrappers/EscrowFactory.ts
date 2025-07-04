import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import { Op } from './opcodes';

export type EscrowFactoryConfig = {
    admin: Address;
    userEscrowCode: Cell;
};

export function escrowFactoryConfigToCell(config: EscrowFactoryConfig): Cell {
    return beginCell().storeAddress(config.admin).storeRef(config.userEscrowCode).endCell();
}

export class EscrowFactory implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new EscrowFactory(address);
    }

    static createFromConfig(config: EscrowFactoryConfig, code: Cell, workchain = 0) {
        const data = escrowFactoryConfigToCell(config);
        const init = { code, data };
        return new EscrowFactory(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendCreateOrder(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryId: number;
            orderId: number;
            fromAmount: bigint;
            toNetwork: number;
            toToken: bigint;
            toAddress: bigint;
            toAmount: bigint;
            hashKey: bigint;
        },
    ) {
        return await provider.internal(via, {
            value: opts.value + opts.fromAmount,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Op.create_order, 32)
                .storeUint(opts.queryId, 64)
                .storeUint(opts.orderId, 32)
                .storeCoins(opts.fromAmount)
                .storeRef(
                    beginCell()
                        .storeUint(opts.toNetwork, 8)
                        .storeUint(opts.toToken, 256)
                        .storeUint(opts.toAddress, 256)
                        .storeUint(opts.toAmount, 128)
                        .endCell(),
                )
                .storeUint(opts.hashKey, 256)
                .endCell(),
        });
    }

    async getOrderAddress(provider: ContractProvider, creator: Address, orderId: bigint) {
        const result = await provider.get('get_order_address', [
            {
                type: 'slice',
                cell: beginCell().storeAddress(creator).endCell(),
            },
            {
                type: 'int',
                value: orderId,
            },
        ]);
        return result.stack.readAddress();
    }
}
