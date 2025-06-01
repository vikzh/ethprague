import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
    TupleReader,
} from '@ton/core';

export type UserEscrowConfig = {
    owner: Address;
    admin: Address;
    orderId: number | bigint;
    fromAmount?: number | bigint;
    toNetwork?: number | bigint;
    toAddress?: number | bigint;
    toAmount?: number | bigint;
    hashKey?: number | bigint;
    resolverAddress?: Address;
};

export function userEscrowConfigToCell(config: UserEscrowConfig): Cell {
    return (
        beginCell()
            .storeAddress(config.owner)
            .storeAddress(config.admin)
            .storeUint(config.orderId, 32)
            // .storeCoins(config.fromAmount)
            // .storeUint(config.toNetwork, 8)
            // .storeUint(config.toAddress, 256)
            // .storeUint(config.toAmount, 128)
            // .storeMaybeRef(beginCell().storeUint(config.hashKey, 256).storeAddress(config.resolverAddress).endCell())
            .endCell()
    );
}

export class UserEscrow implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new UserEscrow(address);
    }

    static createFromConfig(config: UserEscrowConfig, code: Cell, workchain = 0) {
        const data = userEscrowConfigToCell(config);
        const init = { code, data };
        return new UserEscrow(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async getEscrowData(provider: ContractProvider) {
        const result = await provider.get('get_escrow_data', []);
        return {
            orderId: result.stack.readNumber(),
            fromAddress: result.stack.readAddress(),
            fromAmount: result.stack.readBigNumber(),
            toNetwork: result.stack.readNumber(),
            toToken: result.stack.readBigNumber(),
            toAddress: result.stack.readBigNumber(),
            toAmount: result.stack.readBigNumber(),
            hashKey: result.stack.readBigNumber(),
            resolverAddress: this.readStringOrAddress(result.stack),
        };
    }

    readStringOrAddress(stack: TupleReader) {
        try {
            return stack.readAddress();
        } catch (e) {
            return '';
        }
    }
}
