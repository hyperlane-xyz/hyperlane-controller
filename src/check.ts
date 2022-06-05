import { expect } from 'chai';

import { AbacusRouterChecker } from '@abacus-network/deploy';
import {
  ChainMap,
  ChainName,
  MultiProvider,
} from '@abacus-network/sdk';
import { ControllerConfig, ControllerContracts } from './config';
import { ControllerApp } from './app';


export class ControllerChecker<
  Chain extends ChainName,
> extends AbacusRouterChecker<
  Chain,
  ControllerContracts,
  ControllerApp<Chain>,
  ControllerConfig
> {
  constructor(
    multiProvider: MultiProvider<any>,
    app: ControllerApp<Chain>,
    configMap: ChainMap<Chain, ControllerConfig & { abacusConnectionManager: string }>,
  ) {
    // Controller does not really check for ownership in the traditional sense, since it is it own owner
    // @ts-ignore
    super(multiProvider, app, configMap);
  }

  // ControllerRouter's owner is 0x0 on all chains except the controlling chain as setup in the constructor
  async checkOwnership(chain: Chain): Promise<void> {
    const contracts = this.app.getContracts(chain);

    // check router's owner with the config
    const routerOwner = await contracts.router.contract.owner();
    expect(routerOwner).to.equal(this.configMap[chain].owner);

    // check ubc is owned by local router
    const ubcOwner = await contracts.upgradeBeaconController.owner();
    expect(ubcOwner).to.equal(contracts.router.address);
  }

  async checkChain(chain: Chain): Promise<void> {
    await super.checkChain(chain);
    await this.checkProxiedContracts(chain);
    await this.checkRecoveryManager(chain);
  }

  async checkProxiedContracts(chain: Chain): Promise<void> {
    const addresses = this.app.contractsMap[chain].router.addresses
    await this.checkUpgradeBeacon(chain, 'ControllerRouter', addresses);
  }

  async checkRecoveryManager(chain: Chain): Promise<void> {
    const actual = await this.app.contractsMap[chain].router.contract.recoveryManager();
    const config = this.configMap[chain];
    expect(actual).to.equal(config.recoveryManager);
  }
}
