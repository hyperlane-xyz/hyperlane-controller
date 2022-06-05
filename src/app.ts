import { ControllerContracts } from './config';
import { ethers } from 'ethers';

import { types } from '@abacus-network/utils';

import { AbacusApp, ChainMap, ChainName, ChainNameToDomainId, MultiProvider, objMap, promiseObjAll } from '@abacus-network/sdk';
import { Call } from './utils';

export type Controller = {
  domain: number;
  identifier: string;
};

export class ControllerApp<
  Chain extends ChainName = ChainName,
> extends AbacusApp<ControllerContracts, Chain> {
  calls: ChainMap<Chain, Call[]>

  constructor(contractsMap: ChainMap<Chain, ControllerContracts>, multiProvider: MultiProvider<Chain>) {
    super(contractsMap, multiProvider)
    this.calls = objMap(contractsMap, () => [])
  }

  pushCall(chain: Chain, call: Call) {
    this.calls[chain].push(call);
  }

  routers = () => objMap(this.contractsMap, (_, d) => d.router.contract);

  routerAddresses = () => objMap(this.routers(), (_, r) => r.address);

  controller = async (): Promise<{
    chain: Chain;
    address: types.Address;
  }> => {
    const controllers = await promiseObjAll(
      objMap(this.routers(), (_chain, router) => router.controller()),
    );
    const match = Object.entries(controllers).find(
      ([_, controller]) => controller !== ethers.constants.AddressZero,
    ) as [Chain, types.Address] | undefined;
    if (match) {
      return { chain: match[0], address: match[1] };
    }
    throw new Error('No controller found');
  };

  build = async (): Promise<ethers.PopulatedTransaction[]> => {
    const controller = await this.controller();
    const controllerRouter = this.routers()[controller.chain];

    const chainTransactions = await promiseObjAll(
      objMap(this.calls, (chain, calls) => {
        if (chain === controller.chain) {
          return controllerRouter.populateTransaction.call(calls);
        } else {
          return controllerRouter.populateTransaction.callRemote(
            ChainNameToDomainId[chain],
            calls,
          );
        }
      }),
    );
    return Object.values(chainTransactions);
  };

  execute = async (signer: ethers.Signer) => {
    const controller = await this.controller();

    const signerAddress = await signer.getAddress();
    if (signerAddress !== controller.address) {
      throw new Error(
        `Signer ${signerAddress} is not the controller ${controller.address}`,
      );
    }

    const transactions = await this.build();

    return Promise.all(
      transactions.map(async (tx) => {
        const response = await signer.sendTransaction(tx);
        return response.wait(5);
      }),
    );
  };

  estimateGas = async (
    provider: ethers.providers.Provider,
  ): Promise<ethers.BigNumber[]> => {
    const transactions = await this.build();
    const controller = await this.controller();
    return Promise.all(
      transactions.map(
        (tx) => provider.estimateGas({ ...tx, from: controller.address }), // Estimate gas as the controller
      ),
    );
  };
}
