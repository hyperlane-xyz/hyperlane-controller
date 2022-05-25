import { ethers } from "ethers";

import { UpgradeBeaconController__factory } from "@abacus-network/core";
import { AbacusRouterDeployer } from "@abacus-network/deploy";
import {
  ControllerAddresses,
  objMap,
  promiseObjAll,
  TestChainNames,
} from "@abacus-network/sdk";
import { types } from "@abacus-network/utils";

import { ControllerRouter, ControllerRouter__factory } from "../../../types";

export type ControllingEntity = {
  chain: TestChainNames;
  address: types.Address;
};

export type ControllerConfig = {
  timelock: number;
  controller: ControllingEntity;
  recoveryManager: types.Address;
  abacusConnectionManager: types.Address;
};

export class ControllerDeploy extends AbacusRouterDeployer<
  TestChainNames,
  ControllerConfig,
  ControllerAddresses
> {
  mustGetRouter(
    chain: TestChainNames,
    addresses: ControllerAddresses
  ): ControllerRouter {
    return ControllerRouter__factory.connect(
      addresses.router.proxy,
      this.multiProvider.getChainConnection(chain).signer!
    );
  }
  async deployContracts(
    chain: TestChainNames,
    config: ControllerConfig
  ): Promise<ControllerAddresses> {
    const dc = this.multiProvider.getChainConnection(chain);
    const signer = dc.signer!;

    const ubc = await this.deployContract(
      chain,
      "UpgradeBeaconController",
      new UpgradeBeaconController__factory(signer),
      []
    );

    const router = await this.deployProxiedContract(
      chain,
      "ControllerRouter",
      new ControllerRouter__factory(signer),
      [config.timelock],
      ubc.address,
      [config.abacusConnectionManager]
    );

    return {
      upgradeBeaconController: ubc.address,
      router: router.addresses,
      abacusConnectionManager: config.abacusConnectionManager,
    };
  }

  async deploy() {
    const result = await super.deploy();

    await promiseObjAll(
      objMap(result, async (chain, addresses) => {
        const config = this.configMap[chain];
        const controller =
          chain === config.controller.chain
            ? config.controller.address
            : ethers.constants.AddressZero;
        const router = this.mustGetRouter(chain, addresses);
        await router.setController(controller);
        await router.transferOwnership(config.recoveryManager);
      })
    );

    return result;
  }
}
