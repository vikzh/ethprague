import { Address, toNano } from '@ton/core';
import { compile, NetworkProvider } from '@ton/blueprint';
import { EscrowFactory } from '../wrappers/EscrowFactory';


export async function run(provider: NetworkProvider) {
    const ui = provider.ui();

    const factorySC = provider.open(
        EscrowFactory.createFromConfig(
            {
                admin: provider.sender().address as Address,
                userEscrowCode: await compile('UserEscrow'),
            },
            await compile('EscrowFactory'),
        ),
    );

    ui.write('Deploy EscrowFactory contract');

    await factorySC.sendDeploy(provider.sender(), toNano('0.05'));
    await provider.waitForDeploy(factorySC.address);
}
