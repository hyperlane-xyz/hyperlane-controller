import { expect } from 'chai';

import { AbacusRouterChecker, RouterConfig } from '@abacus-network/deploy';
import { AbacusCore, ChainName, MultiProvider } from '@abacus-network/sdk';

import { ControllerApp } from './app';
import {
  ControllerConfig,
  ControllerConfigMap,
  ControllerContracts,
} from './config';
import { buildRouterConfigMap } from './utils';

export class ControllerChecker<
  Chain extends ChainName,
  ControllerChain extends Chain,
> extends AbacusRouterChecker<
  Chain,
  ControllerContracts,
  ControllerApp<Chain>,
  ControllerConfig<any> & RouterConfig
> {
  constructor(
    multiProvider: MultiProvider<Chain>,
    app: ControllerApp<Chain>,
    configMap: ControllerConfigMap<Chain, ControllerChain>,
    core: AbacusCore<Chain>,
  ) {
    super(multiProvider, app, buildRouterConfigMap(configMap, core));
  }

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
