import '@nomiclabs/hardhat-waffle';
import { ethers } from 'hardhat';

import { hardhatMultiProvider } from '@abacus-network/hardhat';
import {
  AbacusCore,
  ChainMap,
  MultiProvider,
  TestChainNames
} from '@abacus-network/sdk';

import {
  ControllerChain,
  controllerConfigMap
} from '../config/test/controller';

import { ControllerApp } from './app';
import { ControllerChecker } from './check';
import { ControllerContracts } from './config';
import { ControllerDeployer } from './deploy';

describe('Checker', async () => {
  let multiProvider: MultiProvider<TestChainNames>;
  let deployer: ControllerDeployer<TestChainNames, ControllerChain>;
  let contracts: ChainMap<TestChainNames, ControllerContracts>;
  let core: AbacusCore<TestChainNames>;

  before(async () => {
    const [deployerSigner] = await ethers.getSigners();
    multiProvider = hardhatMultiProvider(ethers.provider, deployerSigner);
    core = AbacusCore.fromEnvironment('test', multiProvider);
    deployer = new ControllerDeployer(multiProvider, controllerConfigMap, core);
  });

  it('deploys', async () => {
    contracts = await deployer.deploy();
  });

  it('checks', async () => {
    const app = new ControllerApp(contracts, multiProvider);
    const checker = new ControllerChecker(
      multiProvider,
      app,
      controllerConfigMap,
      core,
    );
    await checker.check();
  });
});
