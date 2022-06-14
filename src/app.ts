import { ethers } from "ethers";
import { ControllerContracts } from "./config";

import { types } from "@abacus-network/utils";

import {
  AbacusApp,
  ChainMap,
  ChainName,
  ChainNameToDomainId,
  MultiProvider,
  objMap,
  promiseObjAll,
} from "@abacus-network/sdk";
import { Call } from "./utils";

export type Controller = {
  domain: number;
  identifier: string;
};

export class ControllerApp<
  Chain extends ChainName = ChainName
> extends AbacusApp<ControllerContracts, Chain> {
  calls: ChainMap<Chain, Call[]>;

  constructor(
    contractsMap: ChainMap<Chain, ControllerContracts>,
    public multiProvider: MultiProvider<Chain>
  ) {
    super(contractsMap, multiProvider);
    this.calls = objMap(contractsMap, () => []);
  }

  pushCall(chain: Chain, call: Call) {
    this.calls[chain].push(call);
  }

  routers = () => objMap(this.chainMap, (_, d) => d.router);

  routerAddresses = () => objMap(this.routers(), (_, r) => r.address);

  controller = async (): Promise<{
    chain: Chain;
    address: types.Address;
  }> => {
    const controllers = await promiseObjAll(
      objMap(this.routers(), (_chain, router) => router.controller())
    );
    const match = Object.entries(controllers).find(
      ([_, controller]) => controller !== ethers.constants.AddressZero
    ) as [Chain, types.Address] | undefined;
    if (match) {
      return { chain: match[0], address: match[1] };
    }
    throw new Error("No controller found");
  };

  build = async (): Promise<ethers.PopulatedTransaction[]> => {
    const controller = await this.controller();
    const controllerRouter = this.routers()[controller.chain];

    const chainTransactions = await promiseObjAll(
      objMap(this.calls, (chain, calls) => {
        if (calls.length === 0) {
          return Promise.resolve(null);
        }
        if (chain === controller.chain) {
          return controllerRouter.populateTransaction.call(calls);
        } else {
          return controllerRouter.populateTransaction.callRemote(
            ChainNameToDomainId[chain],
            calls
          );
        }
      })
    );
    return Object.values(chainTransactions).filter(
      (x) => !!x
    ) as ethers.PopulatedTransaction[];
  };

  execute = async () => {
    const controller = await this.controller();
    const chainConnection = this.multiProvider.getChainConnection(
      controller.chain
    );
    const signer = chainConnection.signer;
    if (!signer) {
      throw new Error(`No signer for chain ${controller.chain}`);
    }
    const signerAddress = await signer.getAddress();
    if (signerAddress !== controller.address) {
      throw new Error(
        `Signer ${signerAddress} is not the controller ${controller.address}`
      );
    }

    const transactions = await this.build();

    return Promise.all(
      transactions.map(async (tx) => {
        const response = await signer.sendTransaction(tx);
        return response.wait(chainConnection.confirmations);
      })
    );
  };

  estimateGas = async (): Promise<ethers.BigNumber[]> => {
    const transactions = await this.build();
    const controller = await this.controller();
    const provider = this.multiProvider.getChainConnection(
      controller.chain
    ).provider;
    return Promise.all(
      transactions.map(
        (tx) => provider.estimateGas({ ...tx, from: controller.address }) // Estimate gas as the controller
      )
    );
  };
}
