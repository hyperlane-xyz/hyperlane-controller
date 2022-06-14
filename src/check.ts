import { expect } from "chai";

import { AbacusRouterChecker, RouterConfig } from "@abacus-network/deploy";
import { ChainName } from "@abacus-network/sdk";
import { ControllerApp } from "./app";
import { ControllerConfig, ControllerContracts } from "./config";

export class ControllerChecker<
  Chain extends ChainName
> extends AbacusRouterChecker<
  Chain,
  ControllerContracts,
  ControllerApp<Chain>,
  ControllerConfig & RouterConfig
> {
  // ControllerRouter's owner is 0x0 on all chains except the controlling chain as setup in the constructor
  async checkOwnership(chain: Chain): Promise<void> {
    const contracts = this.app.getContracts(chain);

    // check router's owner with the config
    const routerOwner = await contracts.router.owner();
    expect(routerOwner).to.equal(this.configMap[chain].owner);

    // check ubc is owned by local router
    const ubcOwner = await contracts.upgradeBeaconController.owner();
    expect(ubcOwner).to.equal(contracts.router.address);
  }

  async checkChain(chain: Chain): Promise<void> {
    await super.checkChain(chain);
    // await this.checkProxiedContracts(chain);
    await this.checkRecoveryManager(chain);
  }

  // async checkProxiedContracts(chain: Chain): Promise<void> {
  //   // const addresses = this.app.contractsMap[chain].router;
  //   // await this.checkUpgradeBeacon(chain, "ControllerRouter", addresses);
  // }

  async checkRecoveryManager(chain: Chain): Promise<void> {
    const actual = await this.app.contractsMap[chain].router.recoveryManager();
    const config = this.configMap[chain];
    expect(actual).to.equal(config.recoveryManager);
  }
}
