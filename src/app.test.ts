import '@nomiclabs/hardhat-waffle';
import { expect } from 'chai';
import { Signer } from 'ethers';
import { ethers } from 'hardhat';

import { TestRecipient__factory } from '@abacus-network/core';
import { hardhatMultiProvider } from '@abacus-network/hardhat';
import { TestCoreApp } from '@abacus-network/hardhat/dist/src/TestCoreApp';
import { TestCoreDeploy } from '@abacus-network/hardhat/dist/src/TestCoreDeploy';
import { ChainMap, MultiProvider, TestChainNames } from '@abacus-network/sdk';
import { addressToBytes32 } from '@abacus-network/utils/dist/src/utils';

import {
  ControllerChain,
  controllerConfigMap,
} from '../config/test/controller';

import { ControllerApp } from './app';
import { ControllerContracts } from './config';
import { ControllerDeployer } from './deploy';

describe('ControllerApp', async () => {
  let multiProvider: MultiProvider<TestChainNames>;
  let deployer: ControllerDeployer<TestChainNames, ControllerChain>;
  let contracts: ChainMap<TestChainNames, ControllerContracts>;
  let controllerSigner: Signer;
  let core: TestCoreApp;

  before(async () => {
    const [controller] = await ethers.getSigners();
    controllerSigner = controller;
    multiProvider = hardhatMultiProvider(ethers.provider, controller);
    const coreDeployer = new TestCoreDeploy(multiProvider);
    core = await coreDeployer.deployCore();
    deployer = new ControllerDeployer(multiProvider, controllerConfigMap, core);
    contracts = await deployer.deploy();
  });

  describe('calls', () => {
    let app: ControllerApp<TestChainNames>;
    beforeEach(async () => {
      app = new ControllerApp(contracts, multiProvider);

      const recipientF = new TestRecipient__factory(controllerSigner);
      const recipient = await recipientF.deploy();

      const functionCall = await recipient.populateTransaction.handle(
        0,
        addressToBytes32(recipient.address),
        '0x',
      );
      app.pushCall('test2', {
        to: addressToBytes32(recipient.address),
        data: functionCall.data!,
      });
    });

    it('can build calls', async () => {
      const calls = await app.build();
      expect(calls).to.have.lengthOf(1);
    });

    it('can estimateGas', async () => {
      await app.estimateGas();
    });

    it('can execute', async () => {
      await app.execute();
      await core.processMessages();
    });
  });
});
