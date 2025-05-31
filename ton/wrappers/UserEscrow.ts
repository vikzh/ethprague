import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type UserEscrowConfig = {
    owner: Address;
    admin: Address
    orderId: number | bigint
    fromAmount: number | bigint
    toNetwork: number | bigint
    toAddress: number | bigint
    toAmount: number | bigint
    hashKey: number | bigint
    resolverAddress: Address;
};

export function userEscrowConfigToCell(config: UserEscrowConfig): Cell {
    return beginCell()
        .storeAddress(config.owner)
        .storeAddress(config.admin)
        .storeUint(config.orderId, 32)
        .storeCoins(config.fromAmount)
        .storeUint(config.toNetwork, 8)
        .storeUint(config.toAddress, 256)
        .storeUint(config.toAmount, 128)
        .storeMaybeRef(
            beginCell()
                .storeUint(config.hashKey, 256)
                .storeAddress(config.resolverAddress)
                .endCell()
        )
        .endCell();
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
}
